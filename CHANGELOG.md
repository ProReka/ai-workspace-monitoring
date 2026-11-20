# Changelog

All notable changes, newest first. Format: SemVer (`vX.Y.Z` tags on `main`).

## Unreleased

- 2D Office canvas: zoom (wheel/buttons, 40–800%) and pan in all directions, with a `Fit` reset
- Scene uses SVG `contain` scaling; letterboxed space filled with outdoor grass
- Smaller, crisper sprites and larger agent labels; names wrap to two short lines
- Centered building with one main exit; explicit open space, pantry and lounge doors; every trip routes through the correct door
- Agents stay at their desk 5 min after the last run, then relax (video/book/game) and only roam after 10 min idle
- Offline runtime: agent stays at the desk with the monitor off (no longer leaves)
- Default zoom fits the building so its walls touch the viewport edge
- Indoor ceiling lamps glow at night while only the outdoors darkens; garden gets flowers, bushes, path and benches
- Working agents show extra task windows and an overload badge when tasks are pending while running
- Croppable yard around the building: grass and varied-size trees only, no pool and no outer border
- More office details: corridor chairs and sofas, whiteboard, printer, coffee machine, stove, bookshelf and plants

## [1.1.3](https://github.com/ProReka/ai-workspace-monitoring/compare/v1.1.2...v1.1.3) (2026-11-20)


### Bug Fixes

* **web:** clarify seated agents and attach resting hands ([8f03235](https://github.com/ProReka/ai-workspace-monitoring/commit/8f0323589b16e16f0799e9692ee164d49e507014))
* **web:** face desk agents toward laptop and use office chairs ([92f5e4a](https://github.com/ProReka/ai-workspace-monitoring/commit/92f5e4a0236eedd8ace6b3471a73be7c109a9f80))
* **web:** polish office visuals and harden canvas controls ([0596d9d](https://github.com/ProReka/ai-workspace-monitoring/commit/0596d9df599e63abe2d1d47a016e22ce11c4b842))
* **web:** polish office visuals and harden canvas controls ([b977dcb](https://github.com/ProReka/ai-workspace-monitoring/commit/b977dcb036ce7d77ac7b0645d26bd266cea189f7))

## [1.1.2](https://github.com/ProReka/ai-workspace-monitoring/compare/v1.1.1...v1.1.2) (2026-11-20)


### Bug Fixes

* **web:** stabilize office agents, walls and floors ([d1ebb2a](https://github.com/ProReka/ai-workspace-monitoring/commit/d1ebb2ae53226bfa39b94568c293c9cff96c60d8))
* **web:** stabilize office agents, walls and floors ([29c70cc](https://github.com/ProReka/ai-workspace-monitoring/commit/29c70ccad38c4a691afd8de0e214ffe09617b18a))

## [1.1.1](https://github.com/ProReka/ai-workspace-monitoring/compare/v1.1.0...v1.1.1) (2026-11-20)


### Bug Fixes

* **ci:** build release image when release-please creates a tag ([28045aa](https://github.com/ProReka/ai-workspace-monitoring/commit/28045aa26b4fe4c714ed8b50d987e7c279c8654b))
* **ci:** build release image when release-please creates a tag ([f4ceea6](https://github.com/ProReka/ai-workspace-monitoring/commit/f4ceea6360136582f4bc80bdfebb66df81d0bfdd))

## [1.1.0](https://github.com/ProReka/ai-workspace-monitoring/compare/v1.0.7...v1.1.0) (2026-11-20)


### Features

* **web:** make 2D Office zoomable and route agents through door ([b831597](https://github.com/ProReka/ai-workspace-monitoring/commit/b83159713d9d34e2a46abf4a15b01ee5550d0977))
* **web:** make 2D Office zoomable and route agents through door ([1b41c8a](https://github.com/ProReka/ai-workspace-monitoring/commit/1b41c8a4e0e73c981090d9c6040490c8f121a98c))
* **web:** rebuild office rooms and outdoor yard ([6da5bb4](https://github.com/ProReka/ai-workspace-monitoring/commit/6da5bb4a533a4de84451f99fd658d08bdf036f88))


### Bug Fixes

* **web:** keep offline agents at desk, longer hold, edge-fit zoom and indoor lamps ([bf1010e](https://github.com/ProReka/ai-workspace-monitoring/commit/bf1010e14f2e2f478f25ec4af6257ba87ec13b3d))
* **web:** refine office zoom, rooms, walls and lighting ([90a3a71](https://github.com/ProReka/ai-workspace-monitoring/commit/90a3a71f31745eefb4a5b21fca04a520b3236407))

## v0.1.7 — 2026-11-18

- View Mode toggle: `Standard` / `2D Office` (pixel-art top-down office, persisted)
- 2D Office: desk + computer per agent; typing when running, roaming pantry/lounge/garden when idle,
  screen off while runtime offline; wall clock + daylight from `OFFICE_TZ` (default `Asia/Jakarta`)
- Outdoor garden around the building inside a perimeter wall; night dims outside only, garden lamps glow, office interior stays lit
- Office fills the panel full-width (garden extends to edges), pixel scale capped; long agent names wrap to 2 lines
- Workspace plaque: `OFFICE_LOGO_URL` or Multica workspace avatar, falls back to name in Pixelify Sans

## v0.1.6 — 2026-10-11

- Derive `remaining_pct` from used/total when 9Router omits it (e.g. Codex
  showed "—" while the dashboard correctly shows 100%)

## v0.1.5 — 2026-10-11

- Quota rows show used/total tooltips; accounts without quota data labeled, not blank
- `app_version` in snapshot meta (know which build a deployment runs)
- Quota alerts only for active providers (dead ones stay quiet)

## v0.1.4 — 2026-10-11

- Quota merged per provider (accounts stacked, inactive in disclosure, other windows ticker)
- Combo rows: provider icon + verdict badge overlay + full-width fallback bar
- 22 provider logos bundled (local → router → colored initial fallback chain)
- Alerts only for active providers; countdowns in days; compact capped notifications
- `KNOWN_DAEMONS` env, neutral OSS defaults, ECS explicitly optional

## v0.1.3 — 2026-10-11

- Provider rows: full-height icon + stacked info, inactive providers in disclosure
- Compact combo health chips (no arrows), colored initial badges for missing logos
- Countdowns in days, one-line alert sanitizing, compact capped notifications
- `KNOWN_DAEMONS` env (empty = all known), neutral OSS defaults, ECS optional+explicit

## v0.1.2 — 2026-10-11

- 9Router without dashboard password now goes live (was wrongly `unconfigured`);
  locked-out instances still report `unconfigured` with an accurate message
- Startup probe log (`snapshot modes=` + per-source hints) for container deploys
- Dokploy deployment guide in `docs/operations.md`
- `DATA_DIR` override, cookie file 0600, server.log rotation, `REFRESH_S` env

## v0.1.1 — 2026-10-11

- Frontend rewritten in React + Vite (1s clock/elapsed ticker, keyed lists, no remount flicker)
- Live LLM traffic: usage ranges Today/24H/7D/30D (mirrors 9Router), provider pie + routing,
  per-model rates, in-flight feed, per-key usage, realtime area chart
- Agent cards: status line, 60-min heartbeat sparkline, current task + elapsed ticker,
  compact icon load indicators; timeline + profile + ErrBlock in modals
- IDE layout: push sidebars, resizable panels, draggable bottom dock, viewport-locked canvas
- Command-center polish: sharp corners, Phosphor icons, light/dark themes, modals everywhere
- Production hardening: CLI auto-login, cookie 0600, log rotation, `DATA_DIR` override,
  render isolation, reduced-motion support

## v0.1.0 — 2026-10-11

First public release.

- Command-center dashboard: workspace agent cards, LLM quota per account,
  combo health graph, live request/token stream, activity heatmaps, notifications
- Sources: 9Router (cookie session + auto-login, quota/combos/usage stream),
  Multica (CLI, workspace-scoped), AWS ECS (optional, hidden when unconfigured)
- Public-safe demo: `MOCK_TOTAL=1` + `scripts/build_mock.py` fixture generator
- `ghcr.io/proreka/ai-workspace-monitoring:0.1.0`
