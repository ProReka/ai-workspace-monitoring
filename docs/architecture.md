# Architecture

```
9Router (cookie session) ──┐
Multica CLI (--workspace) ─┼─► snapshot() ─► /api/snapshot (60s cache, background refresh)
AWS ECS (boto3/mocked) ────┘         ├─► SQLite data/office.db (7d retention)
                                     └─► /api/live (10s TTL) + /api/history (day/week/month)
```

- `snapshot()` merges 3 adapters, adds correlate insights (`pending+offline→wake`,
  `pending+quotas-exhausted→won't help`), info notices, and non-secret `meta`.
- Adapters never raise: per-endpoint/per-connection isolation, degrade to empty.
- History: 1 row per agent + per quota-window per refresh (~60s).
- Frontend polls `/api/snapshot` 20s, `/api/history` 60s, `/api/live` 10s.
  React 18 + Vite (`web/`); `npm run build` emits static files into `frontend/`
  served by FastAPI. Single 1s `useNow()` tick drives clock/elapsed/ago;
  keyed lists avoid remount flicker. Viewport-locked IDE grid; no page scroll.
