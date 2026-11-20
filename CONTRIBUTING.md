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
- Update `docs/` when you change endpoints, shapes, or env vars. Add notes to
  `CHANGELOG.md` under `Unreleased` only — released sections are owned by release-please.
- Use Conventional Commits on `main`: `feat:` bumps minor, `fix:` bumps patch,
  `BREAKING CHANGE:` bumps major.

## Versioning

SemVer, automated by release-please (`.github/workflows/release-please.yml`).
Every push to `main` opens or updates a Release PR. A maintainer reviews and merges
that PR; release-please then creates the GitHub Release and the `vX.Y.Z` tag.
The existing `.github/workflows/release.yml` builds and pushes
`ghcr.io/proreka/ai-workspace-monitoring:X.Y.Z` + `:latest` on that tag.

Current version lives in `.release-please-manifest.json` and `version.txt`.
Do not hand-tag releases: `v0.1.7` and `v1.0.7` both point at commit `43e179f`,
so the manifest value (`1.0.7`) is the single source of truth.
