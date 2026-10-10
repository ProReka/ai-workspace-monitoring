# Command Center — AI Team Ops

Satu layar untuk mengawasi tim AI: siapa kerja / antri / nganggur / error,
sisa kuota LLM, kesehatan combo 9Router, dan traffic live — tanpa buka banyak tab.

![stack](https://img.shields.io/badge/backend-FastAPI_%3A8080-green)
![multica](https://img.shields.io/badge/Multica-live-blue)
![9router](https://img.shields.io/badge/9Router-live-blue)

## Tampilan

Layout model IDE yang mengunci viewport (tanpa scroll halaman):

- **Kiri** — Overview, LLM quota per akun, combos (collapsible)
- **Tengah** — Virtual workspace 2D (kartu agent live) + bottom dock Live LLM traffic (collapsible, bisa di-drag tingginya)
- **Kanan** — Notifications, Activity heatmap (Day/Week/Month), Monitoring + System info (collapsible)

Dark/light mode (tombol bulan di header), semua teks Inggris, ikon Phosphor,
klik kartu/row mana pun untuk detail (modal, ESC untuk tutup).

## Jalan cepat (lokal, macOS)

```bash
cp .env.example .env   # isi token (lihat bawah)
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
brew install multica-ai/tap/multica   # CLI untuk data Multica live
set -a; source .env; set +a
./.venv/bin/python -m collector.main  # buka http://localhost:8080/
```

Frontend React (`web/`). Setelah ubah UI: `npm run build --prefix web`
(atau `cd web && npm install && npm run dev` untuk dev + hot reload).

Yang dibutuhkan di `.env` (tidak pernah di-commit):

| Key | Dari mana |
|---|---|
| `MULTICA_TOKEN` | multica.ai → settings → tokens |
| `NINEROUTER_URL` | mis. `http://ai-router.proreka.id` |
| `NINEROUTER_KEY` | dashboard 9Router → Keys (untuk `/v1/*`) |
| `NINEROUTER_PASSWORD` | password dashboard (auto-login cookie 24 jam) |

Tanpa token, tiap sumber otomatis mode mock supaya UI tetap bisa dinilai.

## Dokumentasi

- `AGENTS.md` — untuk AI agent yang mengerjakan repo ini (aturan + SOP)
- `docs/architecture.md` — arsitektur + alur data
- `docs/api.md` — endpoint collector + bentuk JSON
- `docs/sources.md` — integrasi 9Router & Multica (endpoint asli hasil eksplorasi)
- `docs/operations.md` — run/deploy/server, roadmap
