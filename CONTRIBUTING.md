# Contributing

Thanks for helping out. Small, focused PRs merge fastest.

## Setup

```bash
cp .env.example .env          # empty = mock mode, enough for UI work
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cd web && npm install
```

No tokens needed for UI work — every adapter degrades to labeled mock data.
For live data, fill `.env` (never commit it) and install the Multica CLI.

## Workflow

1. Backend change → `./.venv/bin/python -m py_compile collector/*.py`
2. Frontend change → `npm run build --prefix web` (must pass)
3. Serve + verify: `./.venv/bin/python -m collector.main`, check
   `/api/snapshot` modes and open http://localhost:8080/
4. Regenerate the demo fixture if shapes changed:
   `./.venv/bin/python scripts/build_mock.py` (needs live :8080)

See `AGENTS.md` for repo map, rules (English UI, no emoji chrome, honest modes,
no fabricated URLs), and gotchas.

## Rules for PRs

- Keep UI text English; keep `--radius: 0` sharp-corner design tokens.
- No secrets in code, fixtures, screenshots, or logs (CI secret gate must pass).
- Mock fixture (`collector/mock_data.json`) must stay public-safe — regenerate via script, never hand-edit live data into it.
- Update `docs/` when you change endpoints, shapes, or env vars. Update `CHANGELOG.md` under Unreleased.

## Versioning

SemVer. Maintainers tag `vX.Y.Z` on `main`; CI builds and pushes
`ghcr.io/proreka/ai-workspace-monitoring:X.Y.Z` + `:latest` on tags.
