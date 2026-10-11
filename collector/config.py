"""Config: everything from env. Empty = mock/unconfigured (UI still renders)."""
from __future__ import annotations

import os

__version__ = "0.1.4"


def env(name: str, default: str = "") -> str:
    v = os.environ.get(name)
    return v if v not in (None, "") else default


def env_int(name: str, default: int) -> int:
    try:
        return int(env(name, str(default)))
    except (TypeError, ValueError):
        return default


MULTICA_TOKEN = env("MULTICA_TOKEN")
MULTICA_WORKSPACE = env("MULTICA_WORKSPACE", "")
MULTICA_SERVER_URL = env("MULTICA_SERVER_URL")

NINEROUTER_URL = env("NINEROUTER_URL").rstrip("/")
NINEROUTER_KEY = env("NINEROUTER_KEY")
NINEROUTER_PASSWORD = env("NINEROUTER_PASSWORD")
NINEROUTER_COOKIE = env("NINEROUTER_COOKIE")

AWS_REGION = env("AWS_REGION", "")
ECS_CLUSTER = env("ECS_CLUSTER", "")

POLL_MULTICA_S = env_int("POLL_MULTICA_S", 20)
POLL_ROUTER_S = env_int("POLL_ROUTER_S", 15)
POLL_ECS_S = env_int("POLL_ECS_S", 30)
PORT = env_int("PORT", 8080)
COMPANY_NAME = env("COMPANY_NAME", "Command Center")

# Daemon IDs treated as first-class (vs "stale" registrations).
# Comma-separated, e.g. KNOWN_DAEMONS=main,backend,frontend. Empty = all known.
KNOWN_DAEMONS = [d.strip() for d in env("KNOWN_DAEMONS", "").split(",") if d.strip()]


def is_known_daemon(daemon_id: str) -> bool:
    return not KNOWN_DAEMONS or daemon_id in KNOWN_DAEMONS

# Threshold stuck detector (detik).
STUCK_QUEUED_S = 15 * 60       # queued >15 mnt = peringatan
STUCK_DISPATCHED_S = 5 * 60    # dispatched >5 mnt = ikut aturan Multica = gagal
EXPIRE_QUEUED_S = 2 * 60 * 60  # queued >2 jam = Multica tandai failed
QUOTA_WARN_PCT = 20.0
