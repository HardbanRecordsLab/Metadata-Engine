# Operations

Everything needed to run, deploy and maintain the Service.

## Topology

| Piece | Where |
|---|---|
| Frontend (React SPA) | Vercel — `app-metadata.hardbanrecordslab.online` |
| Backend (FastAPI) | VPS `84.247.162.167`, Docker container `metadata-backend`, host `127.0.0.1:8888` → container `7860` |
| Public API | `metadata.hardbanrecordslab.online/api` (Nginx → the container) |
| Database | **PostgreSQL** `metadata_engine` in the shared `hbrl-postgres` container (external Docker network `hbrl-db`); `DATABASE_URL` lives only in the VPS `.env` |
| Repo path on VPS | `/srv/hbrl/Metadata-Engine` |

Vercel's `frontend/vercel.json` proxies `/api/*` to the VPS and rewrites
everything else to `index.html`.

> The container also lives among other services on that box (WordPress,
> AzuraCast, a CMLP platform, Vault, Postgres instances). This app uses the
> `metadata_engine` database of the shared `hbrl-postgres` instance (migrated from
> SQLite on 2026-09-17; the old `data/music_metadata.db` is a stale leftover).
> Production runs from **`docker-compose.yml`**. The former
> `vps.docker-compose.yml` pinned `DATABASE_URL` to SQLite, which switched
> production to an empty database on 2026-09-21 — it is now only a deprecated
> alias of `docker-compose.yml`.

## Deploy pipeline

`.github/workflows/deploy.yml` — triggered by push to `main`:

1. `appleboy/ssh-action@v1.2.2` SSHes to the VPS (`VPS_HOST` / `VPS_USER` /
   `VPS_PORT` / `VPS_SSH_KEY` secrets).
2. **Guard:** refuses to run unless the VPS `.env` has a `DATABASE_URL` pointing
   at `hbrl-postgres:5432/metadata_engine`.
3. Backs up the current `.env`, then rewrites it from **GitHub repo Secrets**
   (heredoc — keep its 12-space indentation or the workflow fails to parse).
   `DATABASE_URL` is **not** taken from the secrets: the value from the old
   `.env` is carried over and re-checked.
4. `git fetch` + `git checkout main` + `git merge --ff-only origin/main` (fails
   instead of mixing commits if the VPS checkout diverged).
5. Tags the running image as `music-metadata-engine:previous`, then
   `export BUILDKIT_PROGRESS=plain` (the old TTY progress renderer broke the
   SSH action) and `docker compose -f docker-compose.yml up -d --build`
   (`command_timeout: 30m`; no `down` — a failed build leaves the old container up).
6. **Verify:** waits up to 5 min for `healthy` and checks that the container's
   `DATABASE_URL` is still `hbrl-postgres/metadata_engine`; otherwise it restores
   `music-metadata-engine:previous` and fails the run.

Check runs at **GitHub → Actions → "Deploy to VPS"**. "Re-run jobs" replays
the *old* workflow file — to pick up a workflow change, push a fresh commit.

Manual deploy (when the pipeline is down):
```bash
ssh root@84.247.162.167
cd /srv/hbrl/Metadata-Engine
git fetch origin main && git checkout main && git merge --ff-only origin/main
docker compose -f docker-compose.yml up -d --build
```

## Environment variables

Full annotated list: **`backend/.env.example`**. Summary:

| Variable | Used by | Notes |
|---|---|---|
| `SECRET_KEY` | `security.py` | JWT signing — **app won't start without it**. `openssl rand -hex 32`. Also accepts `JWT_SECRET`. |
| `DATABASE_URL` | `db.py` | Prod: `postgresql://…@hbrl-postgres:5432/metadata_engine`, set **only** in the VPS `.env` (not from GitHub Secrets). Unset → local SQLite. |
| `CORS_ORIGINS` | `config.py` | Explicit origin list. |
| `GROQ_API_KEY` | ensemble, Whisper | Required for analysis. |
| `GEMINI_API_KEY` | ensemble, proxy | Required for analysis. |
| `OPENROUTER_API_KEY` | ensemble (3rd vote) | Free-tier daily limit is 50/day, or 1000/day once the account has ever bought ≥$10 credit (`GET /api/v1/key` → `is_free_tier`). |
| `OPENROUTER_ALLOW_PAID` | ensemble | Repo **Variable**, not a secret. `true` → cheap paid fallback when all free models fail. |
| `PINATA_JWT`, `PINATA_GATEWAY` | certificates / IPFS | |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PACK_*` | billing | see Stripe setup below |
| `SPOTIFY_*`, `LASTFM_API_KEY`, `DISCOGS_API_KEY`, `DISCOGS_SECRETS`, `ACOUSTID_API`, `ACOUSTID_API_TOKEN`, `ACR_*` | enrichment / identification | optional |
| `SENTRY_DSN` / `SENTRY_ENV` / `SENTRY_TRACES_SAMPLE_RATE` | `main.py` | error monitoring; no-op if `SENTRY_DSN` unset. Free tier at sentry.io is plenty. |
| `APP_BASE_URL` | `auth.py` | public frontend URL used in email links (default is the canonical app domain) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_STARTTLS` | `utils/email.py` | transactional email (password reset, email verification). **If `SMTP_HOST` is unset, emails are logged instead of sent AND email verification is skipped** (new accounts are created verified). Set these in prod to turn verification on. |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | `startup.py` | optional; creates a superuser on first boot if that email doesn't exist |

**Currently read by nothing / inert code** — safe to omit:
`MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY` (disabled ensemble
adapters), `API_CLIENT_ID`, `API_CLIENT_SECRET` (no code references),
`ANTHROPIC_API_KEY` (the `/ai_proxy` Claude branch exists but no key is
provisioned).

To add or rotate a secret: **GitHub → repo → Settings → Secrets and variables
→ Actions**, then push (or re-run the last deploy). Bulk-import from a dotenv
file with `gh secret set -f <file>`.

## Admin

Admin = `is_superuser = true` on the `users` row (plus the allow-list in
`backend/app/admin_config.py`, currently just
`hardbanrecordslab.pl@gmail.com`). Superusers bypass the credit quota.

Reset a password (no way to recover the hash):
```bash
ssh -t root@84.247.162.167 \
  "docker exec -it metadata-backend python reset_pwd.py <email>"
```
`reset_pwd.py` prompts (hidden). To also force `is_superuser` / create a
missing account, run a short inline script via `docker exec -i metadata-backend
python` using `app.db` + `app.security.get_password_hash`.

## Health & smoke test

- `GET https://metadata.hardbanrecordslab.online/api/health/` → `200`
- `GET /api/billing/packs` → the four packs
- `POST /api/tools/fingerprint` (with a file) → a fingerprint
- `POST /api/analysis/transcribe` (with a file) → needs `GROQ_API_KEY`
- Container: `docker ps --filter name=metadata-backend` → `Up … (healthy)`

## Stripe setup (Test → Live)

1. Dashboard → **Products** → create 4 products, each with a **one-time**
   price ($9 / $35 / $89 / $199).
2. Copy each **Price ID** (`price_…`) into the matching
   `STRIPE_PRICE_PACK_*` secret.
3. **Developers → Webhooks** → add endpoint
   `https://metadata.hardbanrecordslab.online/api/billing/webhook/stripe`,
   event `checkout.session.completed`; copy the **Signing secret** into
   `STRIPE_WEBHOOK_SECRET`.
4. **Developers → API keys** → Secret key into `STRIPE_SECRET_KEY`.
5. Local test: `stripe listen --forward-to
   localhost:8888/api/billing/webhook/stripe`, use the CLI's `whsec_…`.

Idempotency: the webhook keys on `credit_purchases.stripe_session_id`.

## Backups

State = the `metadata_engine` database in `hbrl-postgres` + `/srv/hbrl/Metadata-Engine/data/`
(uploaded certificates, stale SQLite leftover).

**Automated:** `.github/workflows/backup.yml` runs daily at 03:00 UTC (and on
manual dispatch). It runs `pg_dump -Fc metadata_engine` inside `hbrl-postgres`,
verifies the dump (size + `pg_restore --list`), stores it as
`data/backups/mme-pg-<stamp>.dump` on the VPS (mode 600, keeps the last 14 of
these, `latest-pg.dump` points at the newest). It is **not** uploaded to GitHub:
the repo is public and the dump holds user data. There is no off-site copy yet
(restic — handbook decision D-1). Before 2026-09-21 this job snapshotted the
retired SQLite file with a `sqlite3` CLI that is not installed on the VPS, so it
failed daily and no backup existed.

**Restore** (try it on a scratch database first if unsure):
```bash
cd /srv/hbrl/Metadata-Engine
docker compose -f docker-compose.yml stop backend
docker exec -i hbrl-postgres pg_restore -U hbrl_admin -d metadata_engine --clean --if-exists \
  < data/backups/latest-pg.dump
docker compose -f docker-compose.yml start backend
```

The deploy also drops timestamped `.env.backup.*` files in the repo dir — prune
them occasionally.

## Frontend build notes

- `torch` is pinned to `2.13.0+cpu` in `backend/requirements.txt` (CPU wheel
  index) — do not let it drift back to the CUDA build (~2 GB, times the deploy
  out).
- Frontend main bundle is >1 MB; a code-split pass is a future improvement.
