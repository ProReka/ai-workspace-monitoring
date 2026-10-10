"""Public-safe demo fixture (committed). Loaded only when MOCK_TOTAL=1."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

FILE = Path(__file__).resolve().parent / "mock_data.json"


@lru_cache(maxsize=1)
def _data() -> dict:
    try:
        return json.loads(FILE.read_text())
    except (OSError, ValueError):
        return {}


def fixture(key: str, default=None):
    d = _data()
    v = d.get(key, default)
    return v if v is not None else default
