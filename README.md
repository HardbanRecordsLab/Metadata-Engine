---
title: Metadata Engine
emoji: 🎵
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: other
---

# 🎵 Metadata Engine

**AI-powered music metadata: DSP analysis, multi-model classification, and
industry-standard exports.**

Metadata Engine turns a raw audio file into professional, distribution-ready
metadata — BPM and key, genre/mood/instrumentation, a written track
description, identification against public databases, and exports in the
formats DSPs and PROs actually accept (DDEX ERN 4.3, CWR 2.1, MP3Tag CSV,
JSON).

Full documentation lives in **[`docs/`](docs/README.md)**.

---

## What it does

- **DSP analysis** — Essentia + Librosa on the server, essentia.js (WASM) in
  the browser: tempo, key/mode, LUFS loudness, energy, spectral profile,
  harmonic/percussive balance, SHA-256 fingerprint.
- **AI classification (consensus ensemble)** — Groq (Llama), Google Gemini
  and OpenRouter vote on genre, sub-genre, mood, instrumentation, vocal
  style, use-cases and a marketing-grade description. See
  [`backend/app/services/llm_ensemble.py`](backend/app/services/llm_ensemble.py).
- **Identification & enrichment** — ACRCloud / AcoustID / MusicBrainz for
  recognition; Spotify / Last.fm / Discogs for catalogue data.
- **Exports** — MP3Tag CSV, full JSON, DDEX ERN 4.3 XML, CWR 2.1.
- **Certificates** — signed analysis certificate (PDF) pinned to IPFS
  (Pinata) with a public verification page at `/verify/<id>`.
- **Accounts & billing** — JWT auth, credit model (3 free on signup, one-time
  credit packs via Stripe). See [`docs/BUSINESS.md`](docs/BUSINESS.md).

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.10), SQLAlchemy, PostgreSQL (shared `hbrl-postgres`; SQLite only for local dev) |
| Audio | Essentia, Librosa, openai-whisper (CPU), FFmpeg + Chromaprint |
| AI | Groq, Google Gemini, OpenRouter |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Infra | Docker Compose on a VPS, Nginx, GitHub Actions; frontend on Vercel |

---

## Run locally

```bash
# backend
cd backend
python -m venv .venv && . .venv/Scripts/activate   # or .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in at least SECRET_KEY + GROQ/GEMINI/OPENROUTER
uvicorn app.main:app --reload --port 8888

# frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Or both at once from the repo root: `npm run start` (uses `concurrently`).

API docs: `http://localhost:8888/docs` (FastAPI Swagger).

---

## Deploy

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) SSHes to the
VPS, refreshes `.env` from **GitHub repo Secrets** (except `DATABASE_URL`, which the
VPS `.env` owns), fast-forwards the checkout and runs
`docker compose -f docker-compose.yml up -d --build`, then verifies health and the
Postgres connection and rolls back to the previous image if either check fails.

Everything about env vars, secrets, the VPS layout and operational procedures
is in **[`docs/OPERATIONS.md`](docs/OPERATIONS.md)**.

---

## Documentation

| Doc | For |
|---|---|
| [`docs/BUSINESS.md`](docs/BUSINESS.md) | Product, market, pricing, roadmap |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the system is built |
| [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) | Using the app end-to-end |
| [`docs/LEGAL-OVERVIEW.md`](docs/LEGAL-OVERVIEW.md) | Plain-language map of the on-site legal docs |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Deploy, env, secrets, admin, backups |
| [`docs/SEO.md`](docs/SEO.md) | SEO setup and maintenance |

---

## License

Proprietary — © 2026 HardbanRecords Lab. All rights reserved.
Contact: **contact@hardbanrecordslab.online**
