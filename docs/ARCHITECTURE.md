# Architecture

This describes the system as it actually runs, not as the whitepaper
imagined it.

## Shape

```
Browser (React SPA, Vercel)                VPS (Docker)
  app-metadata.hardbanrecordslab.online      metadata.hardbanrecordslab.online
  ├─ essentia.js (WASM) — in-browser DSP     └─ Nginx ──► metadata-backend container
  ├─ jsmediatags — read existing tags             FastAPI (app.main:app), 1 worker
  └─ /api/* ──proxied──► VPS                       ├─ PostgreSQL  hbrl-postgres / metadata_engine
                                                   ├─ Essentia + Librosa (server DSP)
                                                   ├─ LLM ensemble (Groq/Gemini/OpenRouter)
                                                   ├─ WeasyPrint (certificate PDF)
                                                   └─ Pinata (IPFS pin)
```

- One FastAPI container. No microservices, no worker cluster, no message
  queue — the "job queue" is a `jobs` table in the database plus an in-process
  async task.
- The frontend is a **routerless SPA**: `index.tsx` renders `<App/>` for every
  path except `/verify/<id>` (certificate verification page). Vercel rewrites
  everything to `index.html` and proxies `/api/*` to the VPS.
- Real-time analysis progress and streamed description tokens go over a
  WebSocket (`app/utils/websocket_manager.py`).

## Backend layout (`backend/app/`)

| Area | Files |
|---|---|
| Entry / wiring | `main.py`, `config.py`, `db.py`, `dependencies.py`, `rate_limit.py`, `startup.py` |
| Auth & security | `routes/auth.py`, `security.py`, `admin_config.py` |
| DSP analysis | `services/deep_audio_analyzer.py`, `services/audio_analyzer.py`, `services/mir.py`, `services/sonic_intelligence.py`, `routes/mir.py` |
| Orchestration | `services/fresh_track_analyzer.py`, `services/batch_processor.py`, `routes/analysis.py`, `routes/fresh_analysis.py` |
| AI classification | `services/llm_ensemble.py`, `services/metadata_enricher.py`, `routes/ai_proxy.py` |
| Identification | `routes/acr.py` (ACRCloud), `routes/audd.py` (AudD), AcoustID + MusicBrainz via `config` + `musicbrainzngs` |
| Enrichment | `routes/spotify.py`, `routes/lastfm.py`, `routes/discogs.py` |
| Lyrics | `services/groq_whisper.py` (Groq-hosted Whisper), local `openai-whisper` (CPU) fallback in `fresh_track_analyzer` |
| Exports | `routes/export.py`, `routes/ddex.py` + `services/ddex_*` + `utils/ddex_ern.py`, `routes/cwr.py` + `services/cwr_gen.py` + `utils/cwr_handler.py` |
| Certificates | `routes/certificate.py`, `services/certificate_pdf.py`, `services/ipfs_pinning.py`, `utils/pinata_client.py`, `utils/provenance.py` |
| Billing | `routes/billing.py`, `services/stripe_billing.py`, `routes/webhooks.py`, `routes/redeem_codes.py` |
| Tools | `routes/tools.py` (strip-metadata, convert, fingerprint), `routes/tagging.py`, `routes/generative.py` (cover art) |

Routers are mounted under both `/api` and `/auth` prefixes (`main.py`) — the
`/auth`-prefixed copies exist for the Vercel proxy path; treat `/api/*` as
canonical.

## Data model (`app/db.py`, PostgreSQL in prod)

`User`, `Job`, `CreditPurchase`, `RedeemCode`, `RedeemedCode`,
`AnalysisHistory`, `Certificate`, `VerificationEvent`.
Schema is created by `Base.metadata.create_all()` and patched idempotently by
`run_migrations()` on startup — there are no standalone migration scripts.

## The analysis pipeline

1. **Ingest** — file uploaded (`/api/analysis/*`), validated, normalised.
2. **DSP** — Essentia + Librosa extract tempo, key/mode, RMS energy, spectral
   centroid/rolloff/flatness/contrast, harmonic-percussive ratio, LUFS,
   dynamic range, vocal presence. The browser also runs essentia.js for an
   instant preview.
3. **ML hints** — lightweight genre/mood hints feed the prompt.
4. **AI consensus** (`llm_ensemble.consensus_classification`) — see below.
5. **Synthesis** — DSP + consensus merged; validated
   (`_validate_and_refine_classification`); SHA-256 Authenticity DNA computed.
6. **Output** — result cards in the UI; on demand: MP3Tag CSV, JSON,
   DDEX ERN 4.3, CWR 2.1, and a Certificate of Authenticity (PDF + IPFS).

If too few models answer, `_fallback_classification()` produces a
deterministic DSP-only result so the user never gets "Unknown".

## The LLM consensus ensemble

`backend/app/services/llm_ensemble.py`. Instead of trusting one model, several
independent models classify the same track and a vote decides.

- **flash mode** — Groq (Llama) + Google Gemini (`gemini-flash-latest`).
- **pro mode** — adds a third, independent voice via **OpenRouter**:
  - `OPENROUTER_FREE_MODELS` — tried in order (all `:free`, all must support
    `response_format` JSON). Verified live 2026-09-01:
    `nvidia/nemotron-3-super-120b-a12b:free` and `minimax/minimax-m3:free`
    answer fast; `z-ai/glm-5.2:free` / `google/gemma-4-31b-it:free` are often
    upstream-rate-limited, kept only as tail probes.
  - `OPENROUTER_CHEAP_MODELS` — paid fallback, used **only** when
    `OPENROUTER_ALLOW_PAID` is truthy and every free model failed
    (`gemini-2.5-flash-lite`, then `mistral-small-24b`, then `gpt-oss-120b`);
    a few hundredths of a cent per analysis.
- `_vote()` — `Counter`-based consensus per field, min-vote thresholds for
  lists, a quality score for the written description, confidence derived from
  agreement rate × average model confidence.
- xAI / Mistral / DeepSeek adapters (`_xai_classify`, `_mistral_classify`,
  `_deepseek_classify`) exist but `consensus_classification()` does not call
  them — inert until billing on those providers is resolved.

Keep the model lists current by re-querying `GET
https://openrouter.ai/api/v1/models` — the free catalogue turns over and
guessed slugs are usually wrong.

## Auth & quota

JWT (HS256, `SECRET_KEY`, 1-week expiry), bcrypt password hashes.
`get_current_user` resolves the token; `get_user_and_check_quota`
(`dependencies.py`) enforces credits — **superusers are unlimited**, everyone
else needs `credits > 0`, decremented after a successful analysis.
Admin = `is_superuser` in `users` plus the allow-list in `admin_config.py`.

## Billing

`routes/billing.py` + `services/stripe_billing.py`.
`GET /api/billing/packs` lists the four packs (Price IDs from
`STRIPE_PRICE_PACK_*`). `POST /api/billing/checkout` (Bearer) creates a Stripe
Checkout Session. Stripe fires `checkout.session.completed` to
`POST /api/billing/webhook/stripe`; the handler verifies the signature
(`STRIPE_WEBHOOK_SECRET`) and adds credits, using the `credit_purchases`
table (unique `stripe_session_id`) for idempotency. Redeem codes
(`routes/redeem_codes.py`) grant credits without payment, one redemption per
`(user, code)`.

## Certificates & IPFS

`certificate_pdf.py` renders a PDF (WeasyPrint). `ipfs_pinning.py` /
`pinata_client.py` pin the certificate JSON to IPFS via Pinata
(`PINATA_JWT`). Each certificate has a `view_token` and a public page at
`/verify/<certificate_id>`; verification hits are logged in
`verification_events`.

## Deploy

Push to `main` → `.github/workflows/deploy.yml`:
`appleboy/ssh-action@v1.2.2` SSHes to the VPS, refreshes
`/srv/hbrl/Metadata-Engine/.env` from **GitHub repo Secrets** (never
`DATABASE_URL` — the VPS `.env` owns it and the deploy refuses to run unless it
points at `hbrl-postgres/metadata_engine`), fast-forwards the checkout, then
`docker compose -f docker-compose.yml up -d --build`
(`BUILDKIT_PROGRESS=plain`, `command_timeout: 30m`). The container joins the
external `hbrl-db` network to reach Postgres. After the swap the job waits for
`healthy`, re-checks the container's `DATABASE_URL` and rolls back to the
`music-metadata-engine:previous` image on failure. `vps.docker-compose.yml` is a
deprecated alias (`include: docker-compose.yml`) — it no longer pins SQLite.
Full operational detail: [OPERATIONS.md](OPERATIONS.md).

## Notable constraints

- `openai-whisper` pulls `torch`; `requirements.txt` pins `torch==2.13.0+cpu`
  from the PyTorch CPU wheel index so the image doesn't drag in ~2 GB of CUDA.
- `essentia` is installed only off Windows (`; sys_platform != "win32"`).
- The frontend main bundle is >1 MB (no code-splitting yet).
