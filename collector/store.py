"""History ringan: ringkasan tiap snapshot untuk heatmap aktivitas.

Retensi 7 hari, tulis 1x per refresh (~60 dtk). Bukan data mentah task.
"""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB = DATA_DIR / "office.db"
RETENTION_S = 7 * 24 * 3600
POINTS = 60  # jumlah titik heatmap


def _db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    con.execute("""CREATE TABLE IF NOT EXISTS agent_hist(
        ts INTEGER, agent_id TEXT, agent_name TEXT,
        online INTEGER, pending INTEGER, running INTEGER)""")
    con.execute("""CREATE TABLE IF NOT EXISTS quota_hist(
        ts INTEGER, provider TEXT, account TEXT, window TEXT, remaining REAL)""")
    con.execute("CREATE INDEX IF NOT EXISTS ix_ah ON agent_hist(ts, agent_id)")
    con.execute("CREATE INDEX IF NOT EXISTS ix_qh ON quota_hist(ts, provider, account, window)")
    return con


def write_snapshot(s: dict) -> None:
    ts = int(s.get("ts", time.time()))
    try:
        con = _db()
        for a in s.get("multica", {}).get("agents", []):
            con.execute(
                "INSERT INTO agent_hist VALUES (?,?,?,?,?,?)",
                (ts, a.get("agent_id"), a.get("agent_name"),
                 1 if a.get("runtime_online") else 0,
                 int(a.get("pending_total") or 0), int(a.get("running") or 0)))
        for q in s.get("router", {}).get("quotas", []):
            if q.get("remaining_pct") is None:
                continue
            con.execute(
                "INSERT INTO quota_hist VALUES (?,?,?,?,?)",
                (ts, q.get("provider"), q.get("account"), q.get("window"),
                 float(q["remaining_pct"])))
        cutoff = ts - RETENTION_S
        con.execute("DELETE FROM agent_hist WHERE ts < ?", (cutoff,))
        con.execute("DELETE FROM quota_hist WHERE ts < ?", (cutoff,))
        con.commit()
        con.close()
    except OSError:
        pass


def history(kind: str = "week") -> dict:
    """GitHub-style activity: agents x time buckets.

    kind: day (24 hourly buckets) | week (7 daily) | month (30 daily).
    Score per sample = running*3 + pending, summed per bucket.
    """
    spec = {"day": (24, 3600), "week": (7, 86400), "month": (30, 86400)}
    n, bucket = spec.get(kind, spec["week"])
    now = int(time.time())
    start = now - n * bucket
    try:
        con = _db()
    except OSError:
        return {"agents": {}, "buckets": [], "bucket_s": bucket, "kind": kind}
    rows = con.execute(
        """SELECT agent_id, agent_name, (ts/?)*? AS b, SUM(running*3+pending)
           FROM agent_hist WHERE ts >= ? GROUP BY agent_id, b ORDER BY agent_id, b""",
        (bucket, bucket, start)).fetchall()
    agents: dict[str, dict] = {}
    for aid, name, b, score in rows:
        a = agents.setdefault(aid, {"name": name, "cells": {}})
        a["name"] = name or a["name"]
        a["cells"][b] = int(score or 0)
    buckets = [start - (start % bucket) + i * bucket for i in range(n + 1)][1:]
    out = []
    for aid, a in agents.items():
        out.append({"id": aid, "name": a["name"],
                    "scores": [a["cells"].get(b, 0) for b in buckets]})
    quotas: dict[str, dict] = {}
    for prov, acc, win, ts, rem in con.execute(
            """SELECT provider, account, window, ts, remaining FROM quota_hist
               WHERE ts >= ? ORDER BY provider, account, window, ts""",
            (now - 24 * 3600,)):
        q = quotas.setdefault(f"{prov}│{acc}│{win}",
                              {"label": f"{prov} · {acc} · {win}", "points": []})
        q["points"].append([ts, rem])
    for q in quotas.values():
        q["points"] = q["points"][-60:]
    con.close()
    return {"agents": out, "buckets": buckets, "bucket_s": bucket, "kind": kind,
            "quotas": list(quotas.values())}


def history_points(n: int = 60) -> dict:
    """Legacy: last n raw samples per agent (kept for compat)."""
    try:
        con = _db()
    except OSError:
        return {"agents": {}, "quotas": []}
    agents: dict[str, dict] = {}
    for aid, name, ts, online, pending, running in con.execute(
            """SELECT agent_id, agent_name, ts, online, pending, running FROM (
                 SELECT *, ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY ts DESC) rn
                 FROM agent_hist) WHERE rn <= ? ORDER BY agent_id, ts""", (POINTS,)):
        a = agents.setdefault(aid, {"name": name, "points": []})
        a["name"] = name or a["name"]
        score = (running or 0) * 3 + (pending or 0) + (0 if online else 0)
        a["points"].append([ts, score])
    quotas: dict[str, dict] = {}
    for prov, acc, win, ts, rem in con.execute(
            """SELECT provider, account, window, ts, remaining FROM (
                 SELECT *, ROW_NUMBER() OVER (PARTITION BY provider, account, window ORDER BY ts DESC) rn
                 FROM quota_hist) WHERE rn <= ? ORDER BY provider, account, window, ts""", (POINTS,)):
        q = quotas.setdefault(f"{prov}│{acc}│{win}", {"label": f"{prov} · {acc} · {win}", "points": []})
        q["points"].append([ts, rem])
    con.close()
    return {"agents": agents, "quotas": list(quotas.values())}
