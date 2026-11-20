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

## Dokploy (+ Traefik)

Image: `ghcr.io/proreka/ai-workspace-monitoring:latest` (or pin a released tag,
e.g. `:1.0.7`), container port `8080`.
Traefik Host-rule + https redirect, as usual — nothing special required.

Env (Dokploy → Environment, values are literal — **no quotes**):

| Key | Notes |
|---|---|
| `MULTICA_TOKEN` / `MULTICA_WORKSPACE` | CLI auto-logs in at container start |
| `KNOWN_DAEMONS` | comma-separated daemon IDs, or empty |
| `NINEROUTER_URL` | **Must be reachable from the container.** Internal Docker hostnames of *other* Dokploy apps do NOT resolve (separate networks) — use the **public** 9Router URL (`https://…`) unless both services share a network |
| `NINEROUTER_PASSWORD` | Only if the 9Router dashboard login is enabled (cookie session, auto-refreshed). Leave empty when 9Router has no password — data endpoints work without it |
| `NINEROUTER_KEY` | Optional (only cross-checks `/v1/models`) |
| `COMPANY_NAME` | Header white-label, no quotes |
| `OFFICE_TZ` | 2D Office clock + daylight timezone (IANA), default `Asia/Jakarta` |
| `OFFICE_LOGO_URL` | 2D Office plaque logo; empty = Multica workspace avatar, else workspace name |
| `PORT=8080`, `REFRESH_S=60` | |

Check container logs after deploy: the first snapshot prints
`snapshot modes={...}` plus a hint line per non-live source.
Optional: mount a volume at `/app/data` to keep history + session across redeploys.

## Env

`MULTICA_TOKEN, MULTICA_WORKSPACE[, MULTICA_WORKSPACE_NAME], NINEROUTER_URL,
NINEROUTER_KEY, NINEROUTER_PASSWORD[, NINEROUTER_COOKIE], AWS_REGION, ECS_CLUSTER`
(+ `PORT`, `REFRESH_S` snapshot cadence default 60, `DATA_DIR` default `./data`).

Tanpa token/CLI, tiap adapter mode mock (UI tetap tampil untuk demo/screenshot):
`env -i PATH="$PATH" PORT=8081 HOME="$HOME" DATA_DIR=/tmp/ov-mock ./.venv/bin/python -m collector.main`

## Release automation

- `.github/workflows/release-please.yml` runs on every push to `main` and opens/updates a
  Release PR using `release-please-config.json` + `.release-please-manifest.json`.
- Conventional commits decide the bump: `feat` → minor, `fix` → patch, `BREAKING CHANGE` → major.
- Humans review and merge the Release PR. Only then does release-please create the GitHub
  Release plus a `vX.Y.Z` tag; there is no manual tagging step.
- `.github/workflows/release.yml` pushes the multi-arch GHCR image with `:X.Y.Z`, `:X.Y` and
  `:latest`. It is reusable and is called by the `image` job of `release-please.yml` with the
  new tag, because tags created with `GITHUB_TOKEN` do not trigger a tag `push` workflow.
  Human-created `v*` tags still trigger it directly.
- For a tag that already exists but has no image (e.g. one created before this fix), dispatch
  `release` manually with input `tag: vX.Y.Z`, or run:
  `gh workflow run release.yml --repo ProReka/ai-workspace-monitoring --field tag=vX.Y.Z`
  Build/push is an artifact publication, not a production deploy; it still needs Owner approval.
- `v0.1.7` and `v1.0.7` are duplicate tags on commit `43e179f`; the manifest pins `1.0.7` as
  the authoritative last release so release-please does not replay old commits or re-release.
- Rollback: revert the automation PR. No tag, release, image or deployment is created until a
  Release PR is merged by a human.

## Notes

- `data/`: `office.db` (history), `router_cookie.json` (session), `server.log`. Gitignored.
- First snapshot is slow (~5s+); later served from cache. Cookie auto-refreshes.
- ECS is `mock` without AWS creds — to go live, grant `ecs:DescribeServices/DescribeTasks`
  on your cluster (read-only) via env/SSO/role and set `AWS_REGION` + `ECS_CLUSTER`.

## Roadmap

- Phase 2: per-day minutes/tasks/tokens analytics, quota-exhaustion forecast, per-runtime
  9Router keys for token attribution (all workers currently share one key).
- Phase 3: Telegram/Slack webhook alerts from snapshot alerts.
- Phase 4 (needs approval): wake/sleep/retry actions — autoscaler stays sole writer until then.
- Optional: Multica WebSocket for true per-request streaming; React+shadcn migration if UI outgrows vanilla.
