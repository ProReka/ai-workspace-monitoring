"""Adapter ECS: desired vs running per service. Read-only.

Butuh: AWS_REGION + ECS_CLUSTER + kredensial AWS standar (env/SSO/role).
Tanpa boto3/kredensial -> mode mock (mapping dari KNOWN_DAEMONS).
"""
from __future__ import annotations

from . import config

# daemon_id -> substring nama service ECS (lihat outputs.tf worker_service_names).
SERVICE_HINT = {
    "proreka-always-on": "multica-always-on",
    "proreka-devops": "multica-devops",
    "proreka-backend": "multica-backend",
    "proreka-frontend": "multica-frontend",
    "proreka-mobile": "multica-mobile",
}


def collect() -> dict:
    try:
        import boto3  # noqa: PLC0415
    except ImportError:
        return _mock("boto3 belum di-install")
    try:
        ecs = boto3.client("ecs", region_name=config.AWS_REGION)
        names = _service_names(ecs)
        if not names:
            return _mock("cluster/service tidak ditemukan")
        desc = ecs.describe_services(cluster=config.ECS_CLUSTER, services=names)
        rows = []
        for s in desc.get("services", []):
            rows.append(
                {
                    "service": s.get("serviceName"),
                    "desired": s.get("desiredCount"),
                    "running": s.get("runningCount"),
                    "pending": s.get("pendingCount"),
                    "status": s.get("status"),
                }
            )
        # autoscaler service (kalau ada)
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


def _service_names(ecs) -> list[str]:
    try:
        arns = ecs.list_services(cluster=config.ECS_CLUSTER).get("serviceArns", [])
        return [a.split("/")[-1] for a in arns]
    except Exception:
        return []


def _mock(why: str) -> dict:
    return {
        "ok": True,
        "mode": "mock",
        "cluster": config.ECS_CLUSTER,
        "services": [
            {"service": "gfs-ai-multica-always-on", "desired": 1, "running": 1,
             "pending": 0, "status": "ACTIVE"},
            {"service": "gfs-ai-multica-backend", "desired": 0, "running": 0,
             "pending": 0, "status": "ACTIVE"},
            {"service": "gfs-ai-multica-frontend", "desired": 0, "running": 0,
             "pending": 0, "status": "ACTIVE"},
            {"service": "gfs-ai-multica-autoscaler", "desired": 1, "running": 1,
             "pending": 0, "status": "ACTIVE"},
        ],
        "autoscaler_present": True,
        "alerts": [],
        "note": why,
    }
