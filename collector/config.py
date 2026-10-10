"""Config: semua dari env, semua opsional -> mode mock bila kosong."""
from __future__ import annotations

import os


def env(name: str, default: str = "") -> str:
    v = os.environ.get(name)
    return v if v not in (None, "") else default


def env_int(name: str, default: int) -> int:
    try:
        return int(env(name, str(default)))
    except (TypeError, ValueError):
        return default


MULTICA_TOKEN = env("MULTICA_TOKEN")
MULTICA_WORKSPACE = env("MULTICA_WORKSPACE", "7146f64f-4d76-4e58-b179-3bf8c0c9e287")
MULTICA_SERVER_URL = env("MULTICA_SERVER_URL")

NINEROUTER_URL = env("NINEROUTER_URL").rstrip("/")
NINEROUTER_KEY = env("NINEROUTER_KEY")
NINEROUTER_PASSWORD = env("NINEROUTER_PASSWORD")
NINEROUTER_COOKIE = env("NINEROUTER_COOKIE")

AWS_REGION = env("AWS_REGION", "ap-southeast-3")
ECS_CLUSTER = env("ECS_CLUSTER", "gfs-ai-ecs")

POLL_MULTICA_S = env_int("POLL_MULTICA_S", 20)
POLL_ROUTER_S = env_int("POLL_ROUTER_S", 15)
POLL_ECS_S = env_int("POLL_ECS_S", 30)
PORT = env_int("PORT", 8080)

# Daemon IDs known dari environments/ai (jadi default mapping, bukan hardcode mati).
KNOWN_DAEMONS = [
    "proreka-always-on",
    "proreka-devops",
    "proreka-backend",
    "proreka-frontend",
    "proreka-mobile",
]

# Threshold stuck detector (detik).
STUCK_QUEUED_S = 15 * 60       # queued >15 mnt = peringatan
STUCK_DISPATCHED_S = 5 * 60    # dispatched >5 mnt = ikut aturan Multica = gagal
EXPIRE_QUEUED_S = 2 * 60 * 60  # queued >2 jam = Multica tandai failed
QUOTA_WARN_PCT = 20.0
