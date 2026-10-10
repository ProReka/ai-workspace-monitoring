# Changelog

All notable changes, newest first. Format: SemVer (`vX.Y.Z` tags on `main`).

## Unreleased

## v0.1.0 — 2026-10-11

First public release.

- Command-center dashboard: workspace agent cards, LLM quota per account,
  combo health graph, live request/token stream, activity heatmaps, notifications
- Sources: 9Router (cookie session + auto-login, quota/combos/usage stream),
  Multica (CLI, workspace-scoped), AWS ECS (optional, hidden when unconfigured)
- Public-safe demo: `MOCK_TOTAL=1` + `scripts/build_mock.py` fixture generator
- `ghcr.io/proreka/ai-workspace-monitoring:0.1.0`
