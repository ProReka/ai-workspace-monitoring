"""Adapter Multica: reuse pola autoscaler.py (CLI JSON), read-only.

Commands used (tidak ada yang write):
  multica agent list --output json
  multica runtime list --output json
  multica agent tasks <agent-id> --output json
Dilogin sekali via MULTICA_TOKEN bila ada; tanpa token -> mode mock.
"""
from __future__ import annotations

import functools
import json
import subprocess
import time
from datetime import datetime, timezone
from . import config

NON_TERMINAL = {"queued", "dispatched", "running", "pending", "in_progress", "claimed"}
RUNNING = {"running", "dispatched", "in_progress", "claimed"}

_WS = config.MULTICA_WORKSPACE


def _cmd(*args: str) -> list[str]:
    """Perintah CLI selalu di-scope ke workspace GFS bila diisi."""
    cmd = ["multica", *args]
    if _WS:
        cmd += ["--workspace-id", _WS]
    return cmd


@functools.lru_cache(maxsize=1)
def cli_version() -> str:
    try:
        import json as _j
        import subprocess as _sp
        r = _sp.run(["multica", "version", "--output", "json"],
                    capture_output=True, text=True, timeout=15)
        d = _j.loads(r.stdout or "{}")
        return str(d.get("version", "?")) if isinstance(d, dict) else "?"
    except Exception:
        return "?"


@functools.lru_cache(maxsize=1)
def workspace_name() -> str:
    if config.env("MULTICA_WORKSPACE_NAME"):
        return config.env("MULTICA_WORKSPACE_NAME")
    try:
        import json as _j
        import subprocess as _sp
        r = _sp.run(_cmd("workspace", "list", "--output", "json"),
                    capture_output=True, text=True, timeout=20)
        d = _j.loads(r.stdout or "null")
        items = d if isinstance(d, list) else (d.get("workspaces", []) if isinstance(d, dict) else [])
        for w in items:
            if isinstance(w, dict) and str(w.get("id")) == _WS:
                return str(w.get("name") or w.get("slug") or _WS[:8])
    except Exception:
        pass
    return _WS[:8] if _WS else "?"


def _run_json(cmd: list[str]) -> object | None:
    """Run a multica CLI command and parse JSON stdout; None on failure."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        return None
    except subprocess.TimeoutExpired:
        return None
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout or "null")
    except json.JSONDecodeError:
        return None


def _as_list(data: object, *keys: str) -> list:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in keys:
            v = data.get(k)
            if isinstance(v, list):
                return v
    return []


def _parse_ts(v: object) -> float | None:
    if not v:
        return None
    try:
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).replace("Z", "+00:00")
        return datetime.fromisoformat(s).timestamp()
    except (ValueError, TypeError):
        return None


def _age_s(task: dict) -> float | None:
    now = time.time()
    for k in ("created_at", "createdAt", "queued_at", "updated_at", "updatedAt"):
        ts = _parse_ts(task.get(k))
        if ts:
            return max(0.0, now - ts)
    return None


_authed: bool | None = None


def _have_cli() -> bool:
    import shutil
    return shutil.which("multica") is not None


def _ensure_login() -> bool:
    """Login CLI sekali per proses bila ada token (idempotent)."""
    global _authed
    if _authed is not None:
        return _authed
    _authed = False
    if not config.MULTICA_TOKEN or not _have_cli():
        return False
    try:
        r = subprocess.run(["multica", "login", "--token", config.MULTICA_TOKEN],
                           capture_output=True, text=True, timeout=60)
        _authed = r.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        _authed = False
    return _authed


def collect() -> dict:
    """Return {'ok', 'mode', 'agents', 'runtimes_known', 'runtimes_stale', 'alerts'}."""
    if not config.MULTICA_TOKEN or not _have_cli():
        out = _mock()
        out["note"] = "mock (no MULTICA_TOKEN or multica CLI)"
        return out
    _ensure_login()
    try:
        return _live()
    except Exception as e:
        out = _mock()
        out["ok"] = False
        out["error"] = f"multica: {e}"
        return out


def _live() -> dict:
    from concurrent.futures import ThreadPoolExecutor

    raw_agents = _run_json(_cmd("agent", "list", "--output", "json"))
    raw_runtimes = _run_json(_cmd("runtime", "list", "--output", "json"))
    if raw_agents is None and raw_runtimes is None:
        # CLI ada tapi tidak terautentikasi / gagal total — coba login ulang sekali.
        global _authed
        _authed = None
        if _ensure_login():
            raw_agents = _run_json(_cmd("agent", "list", "--output", "json"))
            raw_runtimes = _run_json(_cmd("runtime", "list", "--output", "json"))
        if raw_agents is None and raw_runtimes is None:
            raise RuntimeError("multica CLI not authenticated (login failed)")
    agents = _as_list(raw_agents, "agents")
    runtimes = _as_list(raw_runtimes, "runtimes")
    # Scope ketat: hanya workspace GFS (bukan hasil workspace lain).
    agents = [a for a in agents
              if isinstance(a, dict) and (not _WS or a.get("workspace_id", _WS) == _WS)]
    runtimes = [r for r in runtimes
                if isinstance(r, dict) and (not _WS or r.get("workspace_id", _WS) == _WS)]
    rt_by_id = {r.get("id"): r for r in runtimes if isinstance(r, dict)}

    known_rt = [r for r in runtimes if r.get("daemon_id") in config.KNOWN_DAEMONS]
    stale_rt = [r for r in runtimes if r.get("daemon_id") not in config.KNOWN_DAEMONS]

    agents = [a for a in agents if isinstance(a, dict)]

    def tasks_of(aid: str) -> list:
        return _as_list(
            _run_json(_cmd("agent", "tasks", aid, "--output", "json")), "tasks"
        )[:20]

    with ThreadPoolExecutor(max_workers=4) as ex:
        all_tasks = list(ex.map(tasks_of, [str(a.get("id", "")) for a in agents]))

    rows: list[dict] = []
    alerts: list[dict] = []
    for a, tasks in zip(agents, all_tasks):
        aid = str(a.get("id", ""))
        counts = {"queued": 0, "dispatched": 0, "running": 0}
        oldest_pending: float | None = None
        oldest_waiting: float | None = None  # queued/dispatched saja (running = kerja, bukan stuck)
        last_status = "-"
        last_error = ""
        current: dict | None = None
        if tasks:
            t0 = tasks[0] if isinstance(tasks[0], dict) else {}
            last_status = str(t0.get("status", "-"))
            raw_err = str(t0.get("error") or "")
            first_line = raw_err.split("\n")[0].strip()
            freason = str(t0.get("failure_reason") or "")
            last_error = first_line[:200]
            if freason and freason not in last_error:
                last_error = (f"{last_error} [{freason}]" if last_error else f"[{freason}]")[:220]
        for t in tasks:
            if not isinstance(t, dict):
                continue
            st = str(t.get("status", "")).lower()
            if st in counts:
                counts[st] += 1
            if st in NON_TERMINAL:
                age = _age_s(t)
                if age is not None:
                    oldest_pending = age if oldest_pending is None else max(oldest_pending, age)
                    if st in ("queued", "dispatched", "pending", "claimed"):
                        oldest_waiting = age if oldest_waiting is None else max(oldest_waiting, age)
                if current is None:
                    start = _parse_ts(t.get("started_at")) or _parse_ts(t.get("created_at"))
                    current = {
                        "status": st,
                        "summary": str(t.get("trigger_summary") or t.get("title") or t.get("kind") or "task"),
                        "issue": str(t.get("issue_key") or t.get("issue_id") or ""),
                        "kind": str(t.get("kind") or ""),
                        "kind_label": _kind_label(str(t.get("kind") or "")),
                        "elapsed_s": round(time.time() - start, 0) if start else None,
                    }
        recent = []
        for t in tasks[:6]:
            if not isinstance(t, dict):
                continue
            start = _parse_ts(t.get("started_at")) or _parse_ts(t.get("created_at"))
            end = _parse_ts(t.get("completed_at"))
            recent.append({
                "status": str(t.get("status", "-")),
                "summary": str(t.get("trigger_summary") or t.get("title") or t.get("kind") or "task"),
                "issue": str(t.get("issue_key") or t.get("issue_id") or ""),
                "kind": str(t.get("kind") or ""),
                "kind_label": _kind_label(str(t.get("kind") or "")),
                "elapsed_s": round((end or time.time()) - start, 0) if start else None,
                "started_at": t.get("started_at") or t.get("created_at"),
                "ended_at": t.get("completed_at"),
                "error": str(t.get("error") or "").split("\n")[0].strip()[:160],
            })
        rid = a.get("runtime_id")
        rt = rt_by_id.get(rid, {})
        did = str(rt.get("daemon_id", "-"))
        # Registrasi basi kadang ber-daemon_id UUID — tampilkan nama runtime-nya.
        if len(did) >= 32 and "-" in did:
            did = str(rt.get("custom_name") or rt.get("name") or did)
        stale = did not in config.KNOWN_DAEMONS
        rows.append(
            {
                "agent_id": aid,
                "agent_name": a.get("name", aid[:8]),
                "avatar": a.get("avatar_url", ""),
                "model": a.get("model"),
                "runtime_id": rid,
                "daemon_id": did,
                "runtime_name": str(rt.get("custom_name") or rt.get("name") or did),
                "runtime_provider": rt.get("provider"),
                "runtime_online": bool(rt.get("online", rt.get("status") == "online")),
                "concurrency": a.get("max_concurrent_tasks"),
                "queued": counts["queued"],
                "dispatched": counts["dispatched"],
                "running": counts["running"],
                "pending_total": sum(counts.values()),
                "oldest_pending_s": oldest_pending,
                "last_status": last_status,
                "last_error": last_error[:220],
                "stale_runtime": stale,
                "current": current,
                "recent": recent,
            }
        )
        if oldest_waiting and oldest_waiting > config.STUCK_QUEUED_S:
            lvl = "warn" if oldest_waiting < config.EXPIRE_QUEUED_S else "crit"
            alerts.append(
                {
                    "level": lvl,
                    "source": "multica",
                    "msg": f"{a.get('name', aid)} queued for {oldest_waiting/60:.0f} min with no runtime picking it up",
                }
            )
    return {"ok": True, "mode": "live", "agents": rows,
            "runtimes_known": _rt_summary(known_rt),
            "runtimes_stale": _rt_summary(stale_rt),
            "alerts": alerts}


def _kind_label(kind: str) -> str:
    return {
        "autopilot": "Running autopilot",
        "direct": "Replying to DM",
        "issue": "Working on issue",
        "chat": "Chatting",
        "mention": "Replying to mention",
        "comment": "Replying to comment",
    }.get(kind.lower(), f"Working ({kind})" if kind else "Working")


def _rt_summary(runtimes: list[dict]) -> list[dict]:
    # Dedupe per daemon (registrasi ganda claude+opencode), utamakan yang online.
    best: dict[str, dict] = {}
    for r in runtimes:
        d = str(r.get("daemon_id"))
        cur = best.get(d)
        if cur is None or (r.get("status") == "online" and cur.get("status") != "online"):
            best[d] = r
    out = []
    for r in best.values():
        out.append({
            "id": r.get("id"),
            "daemon_id": r.get("daemon_id"),
            "name": r.get("custom_name") or r.get("name"),
            "online": r.get("status") == "online",
            "provider": r.get("provider"),
            "last_seen": r.get("last_seen_at"),
        })
    return out


def _mock() -> dict:
    return {
        "ok": True,
        "mode": "mock",
        "agents": [
            {
                "agent_id": "mock-be",
                "agent_name": "Backend",
                "runtime_id": "rt-be",
                "daemon_id": "proreka-backend",
                "runtime_online": False,
                "concurrency": 3,
                "queued": 2,
                "dispatched": 0,
                "running": 0,
                "pending_total": 2,
                "oldest_pending_s": 1320,
                "last_status": "queued",
                "last_error": "",
            },
            {
                "agent_id": "mock-always",
                "agent_name": "Always-On",
                "runtime_id": "rt-always",
                "daemon_id": "proreka-always-on",
                "runtime_online": True,
                "concurrency": 3,
                "queued": 0,
                "dispatched": 0,
                "running": 1,
                "pending_total": 1,
                "oldest_pending_s": 180,
                "last_status": "running",
                "last_error": "",
            },
        ],
        "alerts": [
            {
                "level": "warn",
                "source": "multica",
                "msg": "Backend pending for 22 min but runtime is offline (needs wake?)",
            }
        ],
    }
