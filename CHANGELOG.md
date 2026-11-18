# Changelog

All notable changes, newest first. Format: SemVer (`vX.Y.Z` tags on `main`).

## Unreleased

- 2D Office canvas: zoom (wheel/buttons, 50–600%) and pan in all directions, with a `Fit` reset
- Scene uses SVG `contain` scaling; letterboxed space filled with outdoor grass
- Smaller, crisper sprites and larger agent labels; names wrap to two short lines
- Walled office with a real door; every trip to pantry, lounge or garden routes through door and desk aisles
- Agents stay at their desk 60s after the last run, then relax at the desk (video/book/game) or roam
- Working agents show extra task windows and an overload badge when tasks are pending while running
- Garden is now outside the building: large pool, deck chairs, trees, flower beds, lamps and string lights

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
