"""Adapter 9Router 0.5.95 — endpoint dashboard asli, auth cookie session.

Sumber data (hasil eksplorasi HAR + source 9Router):
  GET /api/version
  GET /api/auth/status
  GET /api/providers/client?page&pagesize&accountStatus&sort  (loop semua pages)
  GET /api/usage/<connectionId>   (per koneksi AKTIF saja; nonaktif dilewati)
  GET /api/combos
  GET /api/provider-nodes          (best-effort, untuk kesehatan node custom)
  GET /v1/models                   (Bearer NINEROUTER_KEY, cross-check combo)

Auth: cookie `auth_token` untuk /api/*. Satu-satunya POST adalah
/api/auth/login {"password"} yang meng-issue session milik sendiri — dan
hanya dipanggil bila: tidak ada cookie manual, cookie file hilang/kedaluwarsa,
atau server jawab 401. Tidak pernah retry beruntun (server punya lockout).

Semua fetch per-endpoint/per-koneksi diisolasi: 1 gagal tidak menggugurkan lain.
"""
from __future__ import annotations

import base64
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import httpx

from . import config

TIMEOUT = 10.0
PAGE_SIZE = 100
MAX_PAGES = 20
REFRESH_SKEW_S = 3600  # refresh proaktif bila exp < 1 jam
COOKIE_NAME = "auth_token"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
COOKIE_FILE = DATA_DIR / "router_cookie.json"

# Prefix model -> provider, hanya yang high-confidence. Selain ini: coba
# provider-nodes, lalu nested combo, terakhir "unknown" (jujur, bukan merah palsu).
PREFIX_ALIAS = {"cc": "claude", "oc": "opencode"}


# --- session ---------------------------------------------------------------

def _jwt_exp(token: str) -> float | None:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return float(json.loads(base64.urlsafe_b64decode(payload)).get("exp", 0)) or None
    except (ValueError, IndexError, TypeError):
        return None


def _usable(token: str | None) -> bool:
    if not token:
        return False
    exp = _jwt_exp(token)
    if exp is None:  # bukan JWT / tanpa exp: anggap bisa dipakai, server yang menilai via 401
        return True
    return exp - time.time() > REFRESH_SKEW_S


def _read_file_cookie() -> str | None:
    try:
        data = json.loads(COOKIE_FILE.read_text())
        tok = data.get(COOKIE_NAME)
        return tok if isinstance(tok, str) else None
    except (OSError, ValueError):
        return None


def _write_file_cookie(token: str) -> None:
    try:
        import os
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        COOKIE_FILE.write_text(json.dumps({COOKIE_NAME: token}))
        os.chmod(COOKIE_FILE, 0o600)
    except OSError:
        pass


def _login(base: str) -> str | None:
    """POST /api/auth/login sekali. Return auth_token atau None."""
    if not config.NINEROUTER_PASSWORD:
        return None
    try:
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.post(f"{base}/api/auth/login", json={"password": config.NINEROUTER_PASSWORD})
        if r.status_code != 200:
            return None
        tok = r.cookies.get(COOKIE_NAME)
        if tok:
            _write_file_cookie(tok)
        return tok
    except httpx.HTTPError:
        return None


def _session_token(base: str) -> str | None:
    if config.NINEROUTER_COOKIE and _usable(config.NINEROUTER_COOKIE):
        return config.NINEROUTER_COOKIE
    tok = _read_file_cookie()
    if _usable(tok):
        return tok
    return _login(base)


# --- fetch -----------------------------------------------------------------

def _get(client: httpx.Client, base: str, path: str, token: str | None,
         statuses: dict) -> tuple[int | None, object | None]:
    try:
        h = {"Cookie": f"{COOKIE_NAME}={token}"} if token else {}
        r = client.get(f"{base}{path}", headers=h, timeout=TIMEOUT)
    except httpx.HTTPError:
        statuses[path] = "ERR"
        return None, None
    statuses[path] = r.status_code
    if r.status_code != 200:
        return r.status_code, None
    try:
        return r.status_code, r.json()
    except ValueError:
        return r.status_code, None


def _rel(reset_at: str | None) -> str:
    if not reset_at:
        return "-"
    try:
        ts = datetime.fromisoformat(str(reset_at).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return str(reset_at)
    delta = ts - time.time()
    if delta <= 0:
        return "now"
    h, rem = divmod(int(delta), 3600)
    m = rem // 60
    return f"{h}h {m}m" if h else f"{m} min"


# --- collect ---------------------------------------------------------------

def collect() -> dict:
    base = (config.NINEROUTER_URL or "").rstrip("/")
    if not base:
        return _mock("NINEROUTER_URL kosong")
    statuses: dict[str, object] = {}
    try:
        with httpx.Client(follow_redirects=True, timeout=TIMEOUT) as c:
            token = _session_token(base)
            _, version = _get(c, base, "/api/version", token, statuses)
            code, auth = _get(c, base, "/api/auth/status", token, statuses)
            if code == 401 and config.NINEROUTER_PASSWORD:
                # Cookie basi (mis. manual) -> login ulang sekali.
                token = _login(base)
                _, auth = _get(c, base, "/api/auth/status", token, statuses)
            authenticated = bool(isinstance(auth, dict) and auth.get("authenticated"))

            connections = _connections(c, base, token, statuses) if authenticated else []
            usage_map = _usages(base, connections, token, statuses)
            _, combos_raw = _get(c, base, "/api/combos", token, statuses)
            _, nodes_raw = _get(c, base, "/api/provider-nodes", token, statuses)
            models = _models(base)
    except Exception as e:  # pragma: no cover - degrade total
        out = _mock(f"exception: {e}"[:200])
        out["ok"] = False
        return out

    if not authenticated:
        return {
            "ok": False, "mode": "unconfigured",
            "connections": [], "quotas": [], "combos": [], "models_count": 0,
            "endpoint_status": statuses, "alerts": [
                {"level": "crit", "source": "9router",
                 "msg": "9Router: not authenticated — set NINEROUTER_PASSWORD or NINEROUTER_COOKIE in .env"},
            ],
            "note": f"auth_status={auth}",
        }

    conns, quotas, alerts = _build_quotas(connections, usage_map)
    combos = _build_combos(combos_raw, nodes_raw, conns)
    n_models = len(models["data"]) if isinstance(models, dict) and isinstance(models.get("data"), list) else 0
    return {
        "ok": True, "mode": "live",
        "version": version if isinstance(version, dict) else {},
        "authenticated": True,
        "connections": conns, "quotas": quotas, "combos": combos,
        "models_count": n_models,
        "endpoint_status": statuses, "alerts": alerts,
        "note": "",
    }


def _connections(c: httpx.Client, base: str, token: str | None, statuses: dict) -> list[dict]:
    out: list[dict] = []
    for page in range(1, MAX_PAGES + 1):
        _, data = _get(
            c, base,
            f"/api/providers/client?page={page}&pageSize={PAGE_SIZE}&accountStatus=all&sort=priority",
            token, statuses,
        )
        if not isinstance(data, dict):
            break
        batch = data.get("connections", [])
        if not isinstance(batch, list):
            break
        out.extend(b for b in batch if isinstance(b, dict))
        pg = data.get("pagination", {})
        if not isinstance(pg, dict) or page >= int(pg.get("totalPages", page)):
            break
    return out


def _usages(base: str, connections: list[dict], token: str | None,
            statuses: dict) -> dict[str, object | None]:
    active = [co.get("id") for co in connections
              if co.get("isActive") and isinstance(co.get("id"), str)]
    result: dict[str, object | None] = {}

    def one(cid: str) -> tuple[str, object | None]:
        try:
            with httpx.Client(timeout=TIMEOUT) as c:
                h = {"Cookie": f"{COOKIE_NAME}={token}"} if token else {}
                r = c.get(f"{base}/api/usage/{cid}", headers=h)
                statuses[f"/api/usage/{cid[:8]}…"] = r.status_code
                if r.status_code != 200:
                    return cid, None
                try:
                    return cid, r.json()
                except ValueError:
                    return cid, None
        except httpx.HTTPError:
            statuses[f"/api/usage/{cid[:8]}…"] = "ERR"
            return cid, None

    with ThreadPoolExecutor(max_workers=4) as ex:
        for cid, data in ex.map(one, active):
            result[cid] = data
    return result


def _models(base: str) -> object | None:
    if not config.NINEROUTER_KEY:
        return None
    try:
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.get(f"{base}/v1/models",
                      headers={"Authorization": f"Bearer {config.NINEROUTER_KEY}"})
            if r.status_code != 200:
                return None
            return r.json()
    except httpx.HTTPError:
        return None


_prev_live: dict = {"ts": 0.0, "models": {}}
_nodes_cache: dict = {"ts": 0.0, "map": {}}
NODES_TTL_S = 300


def _node_names(c: httpx.Client, base: str, token: str | None) -> dict:
    if time.time() - _nodes_cache["ts"] < NODES_TTL_S and _nodes_cache["map"]:
        return _nodes_cache["map"]
    try:
        r = c.get(f"{base}/api/provider-nodes",
                  headers={"Cookie": f"{COOKIE_NAME}={token}"} if token else {},
                  timeout=TIMEOUT)
        nodes = (r.json().get("nodes", []) if r.status_code == 200 else [])
        m = {n.get("id"): n.get("name") for n in nodes
             if isinstance(n, dict) and n.get("id") and n.get("name")}
        if m:
            _nodes_cache.update(ts=time.time(), map=m)
            return m
    except (httpx.HTTPError, ValueError):
        pass
    return _nodes_cache["map"]


def live_traffic() -> dict:
    """Live LLM traffic from /api/usage/stats with per-model req/min deltas.

    Returns {ok, totals, models[top 8 by rate], dt_s}. Cheap (~1s), cookie auth.
    """
    global _prev_live
    base = (config.NINEROUTER_URL or "").rstrip("/")
    if not base:
        return {"ok": False, "models": [], "totals": {}, "dt_s": 0}
    now = time.time()
    try:
        with httpx.Client(follow_redirects=True, timeout=TIMEOUT) as c:
            token = _session_token(base)
            st: dict = {}
            code, data = _get(c, base, "/api/usage/stats", token, st)
            if code == 401 and config.NINEROUTER_PASSWORD:
                token = _login(base)
                code, data = _get(c, base, "/api/usage/stats", token, st)
            names = _node_names(c, base, token)
            stream = _stream(c, base, token, names)
    except Exception:
        return {"ok": False, "models": [], "providers": [], "totals": {}, "dt_s": 0}
    if code != 200 or not isinstance(data, dict):
        return {"ok": False, "models": [], "providers": [], "totals": {}, "dt_s": 0}
    dt = now - _prev_live["ts"] if _prev_live["ts"] else 0.0
    prev = _prev_live["models"]
    rows = []
    by_model = data.get("byModel", {})
    if isinstance(by_model, dict):
        for label, m in by_model.items():
            if not isinstance(m, dict):
                continue
            reqs = int(m.get("requests") or 0)
            pin = int(m.get("promptTokens") or 0)
            pout = int(m.get("completionTokens") or 0)
            pr = prev.get(label, {})
            rate = (reqs - int(pr.get("requests", reqs))) / dt * 60 if dt > 5 else None
            tin = (pin - int(pr.get("pin", pin))) / dt * 60 if dt > 5 else None
            rows.append({
                "model": str(m.get("rawModel") or label),
                "label": str(label),
                "provider": _friendly(names, str(m.get("provider") or "?")),
                "requests": reqs,
                "req_min": round(rate, 1) if rate is not None and rate >= 0 else None,
                "tok_min": round((tin or 0) + 0, 0) if tin is not None and tin >= 0 else None,
                "cost": round(float(m.get("cost") or 0), 2),
                "last_used": m.get("lastUsed"),
            })
    rows.sort(key=lambda r: (r["req_min"] is None, -(r["req_min"] or 0)))
    _prev_live = {"ts": now, "models": {
        r["label"]: {"requests": r["requests"], "pin": 0} for r in rows}}
    # store pin for next delta (recompute from current totals below)
    if isinstance(by_model, dict):
        for label, m in by_model.items():
            if isinstance(m, dict) and label in _prev_live["models"]:
                _prev_live["models"][label]["pin"] = int(m.get("promptTokens") or 0)
    totals = {k: data.get(k) for k in
              ("totalRequests", "totalPromptTokens", "totalCompletionTokens", "totalCost")}
    providers = []
    by_prov = data.get("byProvider", {})
    if isinstance(by_prov, dict):
        tot_req = int(data.get("totalRequests") or 0)
        for key, p in by_prov.items():
            if not isinstance(p, dict):
                continue
            reqs = int(p.get("requests") or 0)
            providers.append({
                "provider": _friendly(names, str(key)),
                "requests": reqs,
                "share": round(reqs / tot_req * 100, 1) if tot_req else 0,
                "cost": round(float(p.get("cost") or 0), 2),
            })
    providers.sort(key=lambda p: -p["requests"])
    return {"ok": True, "models": rows[:8], "providers": providers,
            "totals": totals, "dt_s": round(dt, 1), **stream}


def _friendly(names: dict, raw: str) -> str:
    if not raw:
        return "?"
    if raw in names:
        return names[raw]
    low = raw.lower()
    if low == "claude":
        return "Claude"
    if low == "opencode":
        return "OpenCode"
    for nid, nm in names.items():
        if low.startswith(nid[:8].lower()) or nid.lower().startswith(low[:8]):
            return nm
    return raw if len(raw) < 24 else raw[:18] + "…"


def _stream(c: httpx.Client, base: str, token: str | None, names: dict) -> dict:
    """Recent accesses + in-flight + per-minute + per-key usage (usage page feed)."""
    out = {"recent": [], "active": [], "per_min": [], "by_key": []}
    try:
        r = c.get(f"{base}/api/usage/history",
                  headers={"Cookie": f"{COOKIE_NAME}={token}"} if token else {},
                  timeout=TIMEOUT)
        if r.status_code != 200:
            return out
        h = r.json()
    except (httpx.HTTPError, ValueError):
        return out
    if not isinstance(h, dict):
        return out
    for q in (h.get("recentRequests", []) or [])[:12]:
        if not isinstance(q, dict):
            continue
        out["recent"].append({
            "ts": q.get("timestamp"),
            "model": str(q.get("model") or "?"),
            "provider": _friendly(names, str(q.get("provider") or "")),
            "in_tok": int(q.get("promptTokens") or 0),
            "out_tok": int(q.get("completionTokens") or 0),
            "status": str(q.get("status") or "?"),
        })
    for q in (h.get("activeRequests", []) or [])[:8]:
        if not isinstance(q, dict):
            continue
        out["active"].append({
            "model": str(q.get("model") or "?"),
            "provider": _friendly(names, str(q.get("provider") or "")),
            "account": str(q.get("account") or ""),
            "count": int(q.get("count") or 1),
        })
    out["per_min"] = [int(b.get("requests") or 0) for b in (h.get("last10Minutes", []) or [])
                      if isinstance(b, dict)][:10]
    keys: dict[str, dict] = {}
    by_key = h.get("byApiKey", {})
    if isinstance(by_key, dict):
        for composite, q in by_key.items():
            if not isinstance(q, dict):
                continue
            name = str(q.get("keyName") or composite.split("|")[0][:14])
            k = keys.setdefault(name, {"key": name, "requests": 0, "in_tok": 0,
                                       "out_tok": 0, "last_used": None})
            k["requests"] += int(q.get("requests") or 0)
            k["in_tok"] += int(q.get("promptTokens") or 0)
            k["out_tok"] += int(q.get("completionTokens") or 0)
            if q.get("lastUsed") and (not k["last_used"] or q["lastUsed"] > k["last_used"]):
                k["last_used"] = q["lastUsed"]
    out["by_key"] = sorted(keys.values(), key=lambda k: -k["requests"])
    return out


def _build_quotas(connections: list[dict],
                  usage_map: dict[str, object | None]) -> tuple[list, list, list]:
    conns: list[dict] = []
    quotas: list[dict] = []
    alerts: list[dict] = []
    for co in connections:
        cid = str(co.get("id", ""))
        provider = str(co.get("provider", "?"))
        account = str(co.get("name") or co.get("email") or cid[:8])
        active = bool(co.get("isActive"))
        tstat = str(co.get("testStatus") or "?")
        err = str(co.get("lastError") or co.get("errorCode") or "")
        usage = usage_map.get(cid)
        windows: list[dict] = []
        if isinstance(usage, dict) and isinstance(usage.get("quotas"), dict):
            for label, q in usage["quotas"].items():
                if not isinstance(q, dict):
                    continue
                rem = q.get("remainingPercentage")
                try:
                    rem_f = float(rem) if rem is not None else None
                except (TypeError, ValueError):
                    rem_f = None
                reset = q.get("resetAt")
                w = {"label": str(label), "used": q.get("used"), "total": q.get("total"),
                     "remaining_pct": rem_f, "reset_at": reset, "reset_in": _rel(reset)}
                windows.append(w)
                quotas.append({"provider": provider, "account": account, "window": str(label),
                               "used": q.get("used"), "total": q.get("total"),
                               "remaining_pct": rem_f, "reset": w["reset_in"],
                               "status": tstat, "last_error": err[:160]})
                if rem_f is not None and rem_f <= config.QUOTA_WARN_PCT:
                    alerts.append({"level": "warn", "source": "9router",
                                   "msg": f"{provider} ({account}) {label}: {rem_f:.0f}% left — resets {w['reset_in']}"})
        worst = min((w["remaining_pct"] for w in windows if w["remaining_pct"] is not None),
                    default=None)
        conns.append({"id": cid, "provider": provider, "account": account,
                      "isActive": active, "testStatus": tstat, "last_error": err[:220],
                      "plan": (usage.get("plan") if isinstance(usage, dict) else None),
                      "windows": windows, "worst_remaining": worst,
                      "usage_ok": usage is not None})
        if active and usage is None:
            alerts.append({"level": "warn", "source": "9router",
                           "msg": f"{provider} ({account}): usage unreadable (endpoint failed) — quota unknown"})
        if err or tstat.lower() in ("error", "failed", "down"):
            alerts.append({"level": "crit", "source": "9router",
                           "msg": f"{provider} ({account}): {tstat} {err}".strip()})
    return conns, quotas, alerts


def _build_combos(combos_raw: object, nodes_raw: object,
                  conns: list[dict]) -> list[dict]:
    by_provider = {c["provider"].lower(): c for c in conns}
    nodes = set()
    if isinstance(nodes_raw, dict):
        for k in ("nodes", "data", "items", "providerNodes"):
            if isinstance(nodes_raw.get(k), list):
                nodes = {str(n.get("name", "")).lower() for n in nodes_raw[k]
                         if isinstance(n, dict)}
                break
    elif isinstance(nodes_raw, list):
        nodes = {str(n.get("name", "")).lower() for n in nodes_raw if isinstance(n, dict)}

    combos: list[dict] = []
    raw_list: list = combos_raw.get("combos", []) if isinstance(combos_raw, dict) else []
    raw_by_name = {str(c.get("name")): c for c in raw_list if isinstance(c, dict)}

    def link_status(link: str, depth: int = 0) -> tuple[str, str, str]:
        """-> (kind, status, detail). status: ok|low|exhausted|error|inactive|unknown."""
        if link in raw_by_name and depth < 3:
            # Nested combo: nilai dari rantai dalamnya langsung (order-independent).
            inner_models = raw_by_name[link].get("models", [])
            inner_stats = [link_status(str(m), depth + 1)[1]
                           for m in (inner_models if isinstance(inner_models, list) else [])]
            usable = {"ok", "low"}
            if inner_stats and inner_stats[0] in usable:
                return "combo", "ok", f"combo:{link}=ok"
            if any(s in usable for s in inner_stats):
                return "combo", "low", f"combo:{link}=degraded"
            if inner_stats and all(s in ("exhausted", "error", "inactive") for s in inner_stats):
                return "combo", "error", f"combo:{link}=down"
            return "combo", "unknown", f"combo:{link}=unknown"
        head = link.split("/")[0].lower() if "/" in link else ""
        target = by_provider.get(PREFIX_ALIAS.get(head, head), None)
        if target is None and head in nodes:
            return "node", "ok", f"node:{head} (registered)"
        if target is None:
            return "upstream", "unknown", f"{head or link}: not mapped to any connection"
        if not target["isActive"]:
            return "upstream", "inactive", f"{head}: connection inactive"
        if target["last_error"] or target["testStatus"].lower() in ("error", "failed", "down"):
            return "upstream", "error", f"{head}: {target['testStatus']} {target['last_error']}".strip()
        w = target["worst_remaining"]
        if w is not None and w <= 0:
            return "upstream", "exhausted", f"{head}: quota exhausted"
        if w is not None and w <= config.QUOTA_WARN_PCT:
            return "upstream", "low", f"{head}: {w:.0f}% left"
        return "upstream", "ok", f"{head}: ok"

    for c in raw_list:
        if not isinstance(c, dict):
            continue
        name = str(c.get("name", "?"))
        models = c.get("models", [])
        chain = [{"link": str(m), "kind": k, "status": s, "detail": d}
                 for m in (models if isinstance(models, list) else [])
                 for (k, s, d) in [link_status(str(m))]]
        stats = [l["status"] for l in chain]
        usable = {"ok", "low"}
        if stats and stats[0] in usable:
            verdict = "ok"
        elif any(s in usable for s in stats):
            verdict = "degraded"
        elif stats and all(s in ("exhausted", "error", "inactive") for s in stats):
            verdict = "down"
        else:
            verdict = "unknown"
        combos.append({"name": name, "chain": chain, "verdict": verdict})
    return combos


def _mock(why: str = "") -> dict:
    return {
        "ok": True, "mode": "mock",
        "version": {}, "authenticated": False,
        "connections": [], "endpoint_status": {},
        "combos": [
            {"name": "coding", "chain": [{"link": "cc/*", "kind": "upstream", "status": "unknown", "detail": "mock"}],
             "verdict": "unknown"},
        ],
        "quotas": [
            {"provider": "claude", "account": "mock", "window": "session (5h)",
             "used": 60, "total": 100, "remaining_pct": 40, "reset": "mock",
             "status": "ok", "last_error": ""},
        ],
        "models_count": 0, "alerts": [],
        "note": why or "mock",
    }
