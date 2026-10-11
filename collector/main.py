"""Serve snapshot + frontend statis. `python -m collector.main` -> :8080.

Snapshot di-cache dan di-refresh oleh background thread tiap REFRESH_S agar
/api/snapshot selalu jawab instan (pengumpulan live butuh puluhan detik:
10 agent x `agent tasks` + usage per koneksi). Response asli + meta:
`cache_age_s` (umur data) dan `refreshing` (refresh berjalan?).
"""
from __future__ import annotations

import pathlib
import threading
import time

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .mock import fixture
from .snapshot import snapshot
from .store import history, write_snapshot
from .nine_router import live_traffic

MOCK_TOTAL = bool(config.env("MOCK_TOTAL"))

app = FastAPI(title="office-visualizer")
BASE = pathlib.Path(__file__).resolve().parent.parent

REFRESH_S = config.env_int("REFRESH_S", 60)

_cache: dict = {"data": None, "ts": 0.0, "refreshing": False}
_lock = threading.Lock()


def _rotate_log() -> None:
    """Rotate server.log di bawah 5MB agar tidak tumbuh tanpa batas."""
    try:
        log = BASE / "data" / "server.log"
        if log.exists() and log.stat().st_size > 5 * 1024 * 1024:
            log.replace(BASE / "data" / "server.log.1")
    except OSError:
        pass


_rotate_log()


def _update() -> None:
    try:
        s = snapshot()
        write_snapshot(s)
    except Exception as e:  # jangan bunuh thread refresh
        s = {"ok": False, "error": str(e)[:200], "ts": time.time(),
             "modes": {}, "multica": {}, "router": {}, "ecs": {},
             "insights": [], "alerts": []}
    with _lock:
        _cache["data"] = s
        _cache["ts"] = time.time()
        _cache["refreshing"] = False


def _loop() -> None:
    first = True
    while True:
        with _lock:
            _cache["refreshing"] = True
        _update()
        if first:
            first = False
            try:
                import logging
                d = (_cache["data"] or {})
                modes = d.get("modes", {})
                logging.getLogger("uvicorn").warning(
                    "office-visualizer snapshot modes=%s company=%s",
                    modes, (d.get("meta") or {}).get("company"))
                if (d.get("router") or {}).get("mode") != "live":
                    logging.getLogger("uvicorn").warning(
                        "9Router not live: set NINEROUTER_URL reachable from this "
                        "container + NINEROUTER_PASSWORD (dashboard login)")
                if (d.get("multica") or {}).get("mode") != "live":
                    logging.getLogger("uvicorn").warning(
                        "Multica not live: set MULTICA_TOKEN (+ install CLI - already in image)")
            except Exception:
                pass
        time.sleep(REFRESH_S)


@app.on_event("startup")
def _start() -> None:
    threading.Thread(target=_loop, daemon=True).start()


@app.get("/api/history")
def api_history(range: str = "week") -> dict:
    if MOCK_TOTAL:
        return fixture("history", {}).get(range, {})
    return history(range if range in ("day", "week", "month") else "week")


_live_cache: dict = {}
LIVE_TTL_S = 10


@app.get("/api/live")
def api_live(period: str = "all") -> dict:
    if MOCK_TOTAL:
        out = dict(fixture("live", {"ok": False}))
        out["age_s"] = 3.0
        return out
    if period not in ("today", "24h", "7d", "30d", "all"):
        period = "all"
    slot = _live_cache.get(period)
    if slot is None or time.time() - slot["ts"] > LIVE_TTL_S:
        slot = {"data": live_traffic(period), "ts": time.time()}
        _live_cache[period] = slot
    out = dict(slot["data"])
    out["age_s"] = round(time.time() - slot["ts"], 1)
    return out


@app.get("/healthz")
def healthz() -> dict:
    with _lock:
        age = time.time() - _cache["ts"] if _cache["data"] else -1
    return {"ok": True, "cache_age_s": round(age, 1)}


@app.get("/api/snapshot")
def api_snapshot() -> dict:
    if MOCK_TOTAL:
        out = dict(fixture("snapshot", {}))
        out["ts"] = time.time()
        out["cache_age_s"] = 4.0
        out["refreshing"] = False
        out["modes"] = {"multica": "mock", "router": "mock", "ecs": "mock"}
        return out
    with _lock:
        data, ts, refreshing = _cache["data"], _cache["ts"], _cache["refreshing"]
    if data is None:
        # Hit pertama saat refresh awal belum selesai: hitung inline (lambat sekali).
        _update()
        with _lock:
            data, ts, refreshing = _cache["data"], _cache["ts"], _cache["refreshing"]
    out = dict(data)
    out["cache_age_s"] = round(time.time() - ts, 1)
    out["refreshing"] = refreshing
    return out


app.mount("/", StaticFiles(directory=BASE / "frontend", html=True), name="frontend")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(BASE / "frontend" / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("collector.main:app", host="0.0.0.0", port=config.PORT, reload=False)
