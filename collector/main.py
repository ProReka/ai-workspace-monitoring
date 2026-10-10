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
from .snapshot import snapshot
from .store import history, write_snapshot
from .nine_router import live_traffic

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
    while True:
        with _lock:
            _cache["refreshing"] = True
        _update()
        time.sleep(REFRESH_S)


@app.on_event("startup")
def _start() -> None:
    threading.Thread(target=_loop, daemon=True).start()


@app.get("/api/history")
def api_history(range: str = "week") -> dict:
    return history(range if range in ("day", "week", "month") else "week")


_live_cache: dict = {"data": None, "ts": 0.0}
LIVE_TTL_S = 10


@app.get("/api/live")
def api_live() -> dict:
    if time.time() - _live_cache["ts"] > LIVE_TTL_S or not _live_cache["data"]:
        _live_cache["data"] = live_traffic()
        _live_cache["ts"] = time.time()
    out = dict(_live_cache["data"])
    out["age_s"] = round(time.time() - _live_cache["ts"], 1)
    return out


@app.get("/healthz")
def healthz() -> dict:
    with _lock:
        age = time.time() - _cache["ts"] if _cache["data"] else -1
    return {"ok": True, "cache_age_s": round(age, 1)}


@app.get("/api/snapshot")
def api_snapshot() -> dict:
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
