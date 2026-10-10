"""ECS adapter: desired vs running per service. Read-only, optional.

Needs AWS_REGION + ECS_CLUSTER + standard AWS credentials (env/SSO/role).
Without them (or without boto3) it reports mode mock — the runtimes panel
stays the source of truth and the Infra section hides itself.
"""
from __future__ import annotations

from . import config


def collect() -> dict:
    if not config.AWS_REGION or not config.ECS_CLUSTER:
        return _mock("AWS_REGION/ECS_CLUSTER not configured")
    try:
        import boto3  # noqa: PLC0415
    except ImportError:
        return _mock("boto3 not installed")
    try:
        ecs = boto3.client("ecs", region_name=config.AWS_REGION)
        arns = ecs.list_services(cluster=config.ECS_CLUSTER).get("serviceArns", [])
        names = [a.split("/")[-1] for a in arns]
        if not names:
            return _mock("no services in cluster")
        desc = ecs.describe_services(cluster=config.ECS_CLUSTER, services=names)
        rows = [
            {
                "service": s.get("serviceName"),
                "desired": s.get("desiredCount"),
                "running": s.get("runningCount"),
                "pending": s.get("pendingCount"),
                "status": s.get("status"),
            }
            for s in desc.get("services", [])
        ]
        auto = [r for r in rows if "autoscaler" in (r["service"] or "")]
        return {
            "ok": True, "mode": "live", "cluster": config.ECS_CLUSTER,
            "services": rows,
            "autoscaler_present": bool(auto),
            "alerts": [],
        }
    except Exception as e:
        out = _mock(str(e)[:200])
        out["ok"] = False
        out["error"] = str(e)[:300]
        return out


def _mock(why: str) -> dict:
    return {
        "ok": True,
        "mode": "mock",
        "cluster": config.ECS_CLUSTER or "demo-cluster",
        "services": [
            {"service": "demo-multica-always-on", "desired": 1, "running": 1,
             "pending": 0, "status": "ACTIVE"},
            {"service": "demo-multica-backend", "desired": 0, "running": 0,
             "pending": 0, "status": "ACTIVE"},
            {"service": "demo-multica-frontend", "desired": 1, "running": 1,
             "pending": 0, "status": "ACTIVE"},
            {"service": "demo-multica-autoscaler", "desired": 1, "running": 1,
             "pending": 0, "status": "ACTIVE"},
        ],
        "autoscaler_present": True,
        "alerts": [],
        "note": why,
    }
