# AGENTS.md — working rules for AI agents in this repo

Read `docs/architecture.md`, then only the doc file relevant to your task
(`api` / `sources` / `operations`). Keep context small; don't re-read everything.

## Map

- `collector/config.py` — env only. `collector/main.py` — FastAPI + cache + routes.
- `collector/snapshot.py` — merges adapters + correlate + meta/notices.
- `collector/multica.py` — Multica CLI wrapper. `collector/nine_router.py` — 9Router session + fetch.
- `collector/ecs.py` — ECS read-only (mock without AWS creds). `collector/store.py` — SQLite history.
- `frontend/` — Vite **build output** (do not edit by hand). Source: `web/src/`
  (`App.jsx`, `components.jsx`, `parts.jsx`, `fmt.js`, `hooks.js`, `api.js`, `index.css`).
- Icons: Phosphor via CDN (`<i class="ph ...">`), provider logos from 9Router `/providers/*.png`.

## Rules

1. **Secrets**: never print/commit `.env`, `data/router_cookie.json`, tokens. `.env.example` = placeholders only.
2. **UI language**: English only, no emoji in chrome (agent avatars from Multica are data, allowed).
3. **No mock data in live paths**: adapters degrade per-endpoint, never fake numbers. `mode` must stay honest (`live`/`mock`/`unconfigured`).
4. **9Router login**: single POST only when cookie missing/expiring/401. Never brute-force (server lockout).
5. **No fabricated URLs**: Multica deep links unverified — only `https://multica.ai` + internal modals.
6. **Design tokens**: sharp corners (`--radius: 0`), Phosphor icons, CSS vars for themes. Keep `prefers-reduced-motion`.
7. **A11y**: clickable = `role=button tabindex=0` + label + Enter/Space; modal focus in/out; `npm run build` must pass.

## SOP: verify after every change

```bash
./.venv/bin/python -m py_compile collector/*.py
npm run build --prefix web   # after any web/src change; aborts on error
set -a; source .env; set +a; export PATH="/opt/homebrew/bin:$PATH"
# restart: pkill -f collector.main; nohup ./.venv/bin/python -m collector.main > data/server.log 2>&1 < /dev/null & disown
curl -s localhost:8080/api/snapshot | python3 -c "import json,sys;s=json.load(sys.stdin);print(s['modes'])"
```

## SOP: server

- Logs: `data/server.log`. DB: `data/office.db`. Never delete `data/` blindly (history + cookie).
- zsh here: no `timeout` cmd; quote URLs containing `?`.
- Multica CLI profile is global (`~/.multica`); always pass `--workspace-id` (see `multica._cmd`).

## Gotchas

- Cookie `auth_token` lives ~24h; auto-login covers it. `NINEROUTER_KEY` (Bearer) is only for `/v1/*`, dashboard `/api/*` needs the cookie.
- Dual runtime registrations per daemon (claude+opencode); agents bind by `runtime_id`, never guess by daemon.
- Snapshot cost ~5s (parallel CLI); `/api/snapshot` serves 60s cache, `/api/live` 10s TTL.
