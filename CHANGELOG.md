# Changelog

All notable changes, newest first. Format: SemVer (`vX.Y.Z` tags on `main`).

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
