# Operations

## Local run

```bash
cp .env.example .env   # fill tokens; never commit .env
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
brew install multica-ai/tap/multica
set -a; source .env; set +a; export PATH="/opt/homebrew/bin:$PATH"
nohup ./.venv/bin/python -m collector.main > data/server.log 2>&1 < /dev/null & disown
# open http://localhost:8080/
```

Or `docker compose up --build` (needs `.env`; Multica adapter needs CLI — mock otherwise).

## Env

`MULTICA_TOKEN, MULTICA_WORKSPACE[, MULTICA_WORKSPACE_NAME], NINEROUTER_URL,
NINEROUTER_KEY, NINEROUTER_PASSWORD[, NINEROUTER_COOKIE], AWS_REGION, ECS_CLUSTER`
(+ `PORT`, `REFRESH_S` snapshot cadence, default 60).

## Notes

- `data/`: `office.db` (history), `router_cookie.json` (session), `server.log`. Gitignored.
- First snapshot is slow (~5s+); later served from cache. Cookie auto-refreshes.
- ECS is `mock` without AWS creds — to go live, grant `ecs:DescribeServices/DescribeTasks`
  on the `gfs-ai-ecs` cluster (read-only) via env/SSO/role.

## Roadmap

- Phase 2: per-day minutes/tasks/tokens analytics, quota-exhaustion forecast, per-runtime
  9Router keys for token attribution (all workers currently share one key).
- Phase 3: Telegram/Slack webhook alerts from snapshot alerts.
- Phase 4 (needs approval): wake/sleep/retry actions — autoscaler stays sole writer until then.
- Optional: Multica WebSocket for true per-request streaming; React+shadcn migration if UI outgrows vanilla.
