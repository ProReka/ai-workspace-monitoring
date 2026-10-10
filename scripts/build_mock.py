#!/usr/bin/env python3
"""Build a public-safe mock fixture from live collector data.

Reads /api/snapshot + /api/live (localhost:8080), sanitizes anything
company-specific, adds fictional providers, writes collector/mock_data.json.

Sanitized: workspace names/ids, daemon hostnames, emails, account names,
daemon ids, router URL, agent instructions (dropped), long error blobs (kept short).
Kept shapes 1:1 so the UI renders exactly like production.
"""
from __future__ import annotations

import json
import random
import re
import sys
import time
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
OUT = "collector/mock_data.json"

WS_ID = "aaaaaaaa-1111-2222-3333-444444444444"
ROUTER = "http://router.demo.local"

NAMES = ["Nova", "Pixel", "Forge", "Scout", "Ledger", "Beacon", "Atlas", "Quill",
         "Vektor", "Halide"]
DAEMONS = {"proreka-always-on": "demo-always-on", "proreka-devops": "demo-devops",
           "proreka-backend": "demo-backend", "proreka-frontend": "demo-frontend",
           "proreka-mobile": "demo-mobile"}


def get(path: str):
    with urllib.request.urlopen(BASE + path, timeout=90) as r:
        return json.load(r)


SCRUB_RES = [
    (re.compile(r"proreka[\w.-]*", re.I), "demo"),
    (re.compile(r"\bgfs[\w-]*", re.I), "demo"),
    (re.compile(r"globalfutura[\w.-]*", re.I), "demo"),
    (re.compile(r"lazio[\w.-]*", re.I), "demo"),
    (re.compile(r"gorama[\w.-]*", re.I), "demo"),
    (re.compile(r"baiq[\w.-]*", re.I), "demo"),
    (re.compile(r"munio[\w.-]*", re.I), "demo"),
    (re.compile(r"trias[\w.-]*", re.I), "demo"),
    (re.compile(r"ai-router[\w.-]*", re.I), "router.demo.local"),
    (re.compile(r"7146f64f[0-9a-f-]*", re.I), WS_ID),
]


def scrub_string(s: str) -> str:
    for rx, rep in SCRUB_RES:
        s = rx.sub(rep, s)
    return s


def scrub(obj):
    if isinstance(obj, str):
        return scrub_string(obj)
    if isinstance(obj, list):
        return [scrub(x) for x in obj]
    if isinstance(obj, dict):
        return {k: scrub(v) for k, v in obj.items()}
    return obj


def main() -> None:
    snap = get("/api/snapshot")
    live = get("/api/live")

    agents = snap["multica"]["agents"]
    for i, a in enumerate(agents):
        a["agent_name"] = NAMES[i % len(NAMES)] + (f" {i // len(NAMES) + 1}" if i >= len(NAMES) else "")
        a["agent_id"] = f"00000000-0000-4000-8000-{i:012d}"
        a["runtime_id"] = f"11111111-1111-4111-8111-{i:012d}"
        prof = a.get("profile") or {}
        prof["instructions"] = ""
        prof["description"] = "Demo agent profile for screenshots."
        a["profile"] = prof
        for t in (a.get("recent") or []):
            t.pop("error", None)
        a.pop("last_error", None)

    for r in snap["multica"].get("runtimes_known", []) + snap["multica"].get("runtimes_stale", []):
        did = str(r.get("daemon_id", ""))
        r["daemon_id"] = DAEMONS.get(did, "demo-legacy")
        r["name"] = {"demo-always-on": "Always-On Runtime", "demo-devops": "DevOps Runtime",
                     "demo-backend": "Backend Runtime", "demo-frontend": "Frontend Runtime",
                     "demo-mobile": "Mobile Runtime"}.get(r["daemon_id"], "Legacy Runtime")
        r["last_seen"] = None
    for a in agents:
        a["daemon_id"] = DAEMONS.get(a.get("daemon_id", ""), "demo-legacy")

    snap["meta"]["workspace"] = "Demo"
    snap["meta"]["workspace_id"] = WS_ID
    snap["meta"]["router_url"] = ROUTER
    snap["meta"]["ecs_cluster"] = "demo-ecs"
    snap["multica"]["alerts"] = []

    # --- fictional providers -------------------------------------------------
    extra_conns = [
        ("openai", "Ops Account", True, [("session (5h)", 71, 100), ("weekly (7d)", 58, 100)], "GPT Plus"),
        ("opencode", "Free Tier", True, [("daily", 34, 100)], "Free"),
        ("deepseek", "API Key", True, [("balance ($)", 12.4, 50.0)], "Pay-as-you-go"),
        ("antigravity", "Studio", False, [], None),
    ]
    for i, (prov, acc, active, wins, plan) in enumerate(extra_conns):
        cid = f"33333333-3333-4333-8333-{i:012d}"
        wlist, qlist = [], []
        for label, used, total in wins:
            rem = round((total - used) / total * 100, 1)
            wlist.append({"label": label, "used": used, "total": total,
                          "remaining_pct": rem, "reset_at": None, "reset_in": "soon"})
            qlist.append({"provider": prov, "account": acc, "window": label,
                          "used": used, "total": total, "remaining_pct": rem,
                          "reset": "soon", "status": "active", "last_error": ""})
        snap["router"]["connections"].append(
            {"id": cid, "provider": prov, "account": acc, "isActive": active,
             "testStatus": "active", "last_error": "", "plan": plan,
             "windows": wlist, "worst_remaining": min([w["remaining_pct"] for w in wlist], default=None),
             "primary": wlist[0]["label"] if wlist else None, "usage_ok": True})
        snap["router"]["quotas"].extend(qlist)

    snap["router"]["combos"].append(
        {"name": "chat", "chain": [
            {"link": "oa/gpt-5", "kind": "upstream", "status": "ok", "detail": "oa: ok"},
            {"link": "ds/deepseek-chat", "kind": "upstream", "status": "ok", "detail": "ds: ok"}],
         "verdict": "ok"})

    live["providers"] = [
        {"provider": "OpenAI", "requests": 4120, "share": 38.2, "cost": 21.40},
        {"provider": "Claude", "requests": 2870, "share": 26.6, "cost": 96.10},
        {"provider": "OpenCode", "requests": 2210, "share": 20.5, "cost": 0},
        {"provider": "DeepSeek", "requests": 1590, "share": 14.7, "cost": 3.22},
    ]
    live["models"] = [
        {"model": "gpt-5", "label": "gpt-5 (openai)", "provider": "OpenAI",
         "requests": 3120, "req_min": 4.0, "tok_min": 82000, "cost": 18.20,
         "last_used": "2026-10-11T00:00:00Z"},
        {"model": "claude-opus-5-5", "label": "claude-opus-5-5 (claude)", "provider": "Claude",
         "requests": 631, "req_min": 2.0, "tok_min": 41000, "cost": 96.10,
         "last_used": "2026-10-11T00:00:00Z"},
        {"model": "muse-spark-1.3", "label": "muse-spark-1.3 (opencode)", "provider": "OpenCode",
         "requests": 2210, "req_min": 1.0, "tok_min": 12000, "cost": 0,
         "last_used": "2026-10-10T23:58:00Z"},
        {"model": "deepseek-chat", "label": "deepseek-chat (deepseek)", "provider": "DeepSeek",
         "requests": 1590, "req_min": 0.0, "tok_min": None, "cost": 3.22,
         "last_used": "2026-10-10T22:10:00Z"},
    ]
    live["active"] = [{"model": "gpt-5", "provider": "OpenAI", "account": "Ops Account", "count": 2}]
    live["recent"] = [
        {"ts": "2026-10-11T00:01:10Z", "model": "gpt-5", "provider": "OpenAI",
         "in_tok": 45210, "out_tok": 812, "status": "ok"},
        {"ts": "2026-10-11T00:00:47Z", "model": "claude-opus-5-5", "provider": "Claude",
         "in_tok": 88534, "out_tok": 477, "status": "ok"},
        {"ts": "2026-10-11T00:00:12Z", "model": "muse-spark-1.3", "provider": "OpenCode",
         "in_tok": 8210, "out_tok": 402, "status": "ok"},
        {"ts": "2026-10-10T23:59:33Z", "model": "deepseek-chat", "provider": "DeepSeek",
         "in_tok": 15230, "out_tok": 911, "status": "ok"},
        {"ts": "2026-10-10T23:58:51Z", "model": "gpt-5", "provider": "OpenAI",
         "in_tok": 12044, "out_tok": 350, "status": "ok"},
        {"ts": "2026-10-10T23:57:20Z", "model": "claude-opus-5-5", "provider": "Claude",
         "in_tok": 64012, "out_tok": 1204, "status": "error"},
    ]
    live["per_min"] = [2, 3, 1, 4, 6, 3, 5, 2, 4, 7]
    live["by_key"] = [
        {"key": "CI Runner", "requests": 8210, "in_tok": 38120044, "out_tok": 1204404, "last_used": "2026-10-11T00:01:10Z"},
        {"key": "Team Key", "requests": 2140, "in_tok": 8210440, "out_tok": 310220, "last_used": "2026-10-11T00:00:47Z"},
        {"key": "Visualizer", "requests": 96, "in_tok": 12044, "out_tok": 1810, "last_used": "2026-10-10T23:58:00Z"},
    ]
    live["totals"] = {"totalRequests": 10790, "totalPromptTokens": 512048114,
                       "totalCompletionTokens": 4021918, "totalCost": 120.72}

    rng = random.Random(7)
    hist_agents = []
    for a in agents:
        scores = []
        for i in range(168):
            hour = (int(time.time()) // 3600 - 167 + i) % 24
            base = 3 if 9 <= hour < 18 else (1 if 7 <= hour < 22 else 0)
            scores.append(max(0, base + rng.randint(-1, 2)))
        hist_agents.append({"id": a["agent_id"], "name": a["agent_name"], "scores": scores})
    buckets = [int(time.time()) // 3600 * 3600 - (167 - i) * 3600 for i in range(168)]
    history = {
        "week": {"agents": hist_agents, "buckets": buckets, "bucket_s": 3600, "kind": "week",
                 "quotas": []},
        "month": {"agents": [], "buckets": [], "bucket_s": 86400, "kind": "month", "quotas": []},
        "day": {"agents": [], "buckets": [], "bucket_s": 3600, "kind": "day", "quotas": []},
    }

    snap = scrub(snap)
    # restore intentional demo markers scrubbed above
    data = {"snapshot": snap, "live": live, "history": history}
    blob = json.dumps(data, indent=1)
    bad_found = False
    for bad in ("proreka", "globalfutura", "lazio", "gorama", "baiq", "munio",
                "trias", "ai-router", "7146f64f", "gfs-ai", "gfs_"):
        if bad in blob.lower():
            print(f"WARN: leftover sensitive token: {bad}")
            bad_found = True
    if bad_found:
        raise SystemExit("refusing to write fixture with leftovers")
    with open(OUT, "w") as f:
        f.write(blob)
    print(f"wrote {OUT} ({len(blob)//1024} KB)")


if __name__ == "__main__":
    main()
