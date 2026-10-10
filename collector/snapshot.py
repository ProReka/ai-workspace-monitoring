"""Snapshot builder: gabung 3 adapter + cross-check idle-vs-queue.

Aturan korelasi Phase 1 (tanpa token attribution):
- queued>0 tapi runtime offline/desired 0  -> "butuh wake, cek autoscaler"
- queued>0 tapi quota semua habis           -> "bukan salah runtime, kuota habis"
- running 0 + queued 0 + online             -> idle sehat
"""
from __future__ import annotations

import time

from . import config, ecs, multica, nine_router


def snapshot() -> dict:
    m = multica.collect()
    r = nine_router.collect()
    e = ecs.collect()

    quotas = r.get("quotas", []) if isinstance(r, dict) else []
    # Habis = semua koneksi AKTIF kehabisan SEMUA window-nya (remaining 0).
    # Koneksi nonaktif / tanpa data tidak dihitung (bukan bukti habis).
    conns = [c for c in r.get("connections", [])] if isinstance(r, dict) else []
    active = [c for c in conns if c.get("isActive")]

    def _conn_exhausted(c: dict) -> bool:
        wins = [w for w in c.get("windows", []) if w.get("remaining_pct") is not None]
        if not wins:
            return False
        return all((w["remaining_pct"] or 0) <= 0 for w in wins)

    all_exhausted = bool(active) and all(_conn_exhausted(c) for c in active)

    insights: list[dict] = []
    for a in m.get("agents", []):
        pending = int(a.get("pending_total") or 0)
        online = bool(a.get("runtime_online"))
        if pending > 0 and not online and not all_exhausted:
            insights.append(
                {"level": "warn", "source": "correlate",
                 "msg": f"{a.get('agent_name')}: {pending} pending but runtime is offline — autoscaler should wake it."}
            )
        elif pending > 0 and all_exhausted:
            insights.append(
                {"level": "crit", "source": "correlate",
                 "msg": f"{a.get('agent_name')}: {pending} pending but ALL quotas exhausted — waking won't help."}
            )

    alerts = list(m.get("alerts", [])) + list(r.get("alerts", [])) + list(e.get("alerts", [])) + insights
    order = {"crit": 0, "warn": 1}
    alerts.sort(key=lambda x: order.get(x.get("level", "warn"), 2))

    # Notices info (bukan error): ringkasan operasional untuk panel notifikasi.
    notices: list[dict] = []
    online_workers = sum(1 for a in m.get("agents", []) if a.get("runtime_online"))
    running_now = sum(int(a.get("running") or 0) for a in m.get("agents", []))
    notices.append({"level": "info", "source": "multica",
                    "msg": f"{online_workers}/{len(m.get('agents', []))} agent runtimes online · {running_now} tasks running"})
    for q in r.get("quotas", []):
        if q.get("remaining_pct") is not None and q["remaining_pct"] > config.QUOTA_WARN_PCT:
            notices.append({"level": "info", "source": "9router",
                            "msg": f"{q.get('provider')} ({q.get('account')}) {q.get('window')}: {q['remaining_pct']:.0f}% left — resets {q.get('reset')}"})
    down_combos = [c["name"] for c in r.get("combos", []) if c.get("verdict") == "down"]
    if down_combos:
        notices.append({"level": "crit", "source": "9router",
                        "msg": f"Combos fully down: {', '.join(down_combos)}"})

    for n in notices:
        n["ts"] = time.time()

    meta = {
        "workspace": multica.workspace_name(),
        "workspace_id": config.MULTICA_WORKSPACE,
        "router_url": config.NINEROUTER_URL,
        "router_version": (r.get("version") or {}).get("currentVersion", "?") if isinstance(r, dict) else "?",
        "multica_cli": multica.cli_version(),
        "ecs_cluster": config.ECS_CLUSTER,
        "aws_region": config.AWS_REGION,
        "refresh_s": 60,  # selaras REFRESH_S di main.py
    }

    return {
        "ts": time.time(),
        "modes": {"multica": m.get("mode"), "router": r.get("mode"), "ecs": e.get("mode")},
        "multica": m,
        "router": r,
        "ecs": e,
        "insights": insights,
        "alerts": alerts,
        "notices": notices,
        "meta": meta,
        "thresholds": {
            "stuck_queued_s": config.STUCK_QUEUED_S,
            "stuck_dispatched_s": config.STUCK_DISPATCHED_S,
            "expire_queued_s": config.EXPIRE_QUEUED_S,
            "quota_warn_pct": config.QUOTA_WARN_PCT,
        },
    }
