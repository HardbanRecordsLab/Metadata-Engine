# Operations

Everything needed to run, deploy and maintain the Service.

## Topology

| Piece | Where |
|---|---|
| Frontend (React SPA) | Vercel — `app-metadata.hardbanrecordslab.online` |
| Backend (FastAPI) | VPS `84.247.162.167`, Docker container `metadata-backend`, host `127.0.0.1:8888` → container `7860` |
| Public API | `metadata.hardbanrecordslab.online/api` (Nginx → the container) |
| Database | **SQLite** at `/data/music_metadata.db` inside the container, bind-mounted from `/srv/hbrl/Metadata-Engine/data/` |
| Repo path on VPS | `/srv/hbrl/Metadata-Engine` |

Vercel's `frontend/vercel.json` proxies `/api/*` to the VPS and rewrites
everything else to `index.html`.

> The container also lives among other services on that box (WordPress,
> AzuraCast, a CMLP platform, Vault, Postgres instances). Those Postgres
> databases belong to other services — **this app uses SQLite**, despite any
> Postgres URL a `.env` example might show. `vps.docker-compose.yml` pins
> `DATABASE_URL=sqlite:////data/music_metadata.db` via `environment:`, which
> overrides `env_file`.

## Deploy pipeline

`.github/workflows/deploy.yml` — triggered by push to `main`:

1. `appleboy/ssh-action@v1.2.2` SSHes to the VPS (`VPS_HOST` / `VPS_USER` /
   `VPS_PORT` / `VPS_SSH_KEY` secrets).
2. Backs up the current `.env`, then rewrites `/srv/hbrl/Metadata-Engine/.env`
   from **GitHub repo Secrets** (heredoc — keep its 12-space indentation or
   the workflow fails to parse).
3. `git pull origin main`.
4. `export BUILDKIT_PROGRESS=plain` (the old TTY progress renderer broke the
   SSH action), then
   `docker compose -f vps.docker-compose.yml up -d --build`
   (`command_timeout: 30m`).

Check runs at **GitHub → Actions → "Deploy to VPS"**. "Re-run jobs" replays
the *old* workflow file — to pick up a workflow change, push a fresh commit.

Manual deploy (when the pipeline is down):
```bash
ssh root@84.247.162.167
cd /srv/hbrl/Metadata-Engine
git pull origin main
docker compose -f vps.docker-compose.yml up -d --build
```

## Environment variables

Full annotated list: **`backend/.env.example`**. Summary:

| Variable | Used by | Notes |
|---|---|---|
| `SECRET_KEY` | `security.py` | JWT signing — **app won't start without it**. `openssl rand -hex 32`. Also accepts `JWT_SECRET`. |
| `DATABASE_URL` | `db.py` | Overridden to SQLite by compose in prod. |
| `CORS_ORIGINS` | `config.py` | Explicit origin list. |
| `GROQ_API_KEY` | ensemble, Whisper | Required for analysis. |
| `GEMINI_API_KEY` | ensemble, proxy | Required for analysis. |
| `OPENROUTER_API_KEY` | ensemble (3rd vote) | Free-tier daily limit is 50/day, or 1000/day once the account has ever bought ≥$10 credit (`GET /api/v1/key` → `is_free_tier`). |
| `OPENROUTER_ALLOW_PAID` | ensemble | Repo **Variable**, not a secret. `true` → cheap paid fallback when all free models fail. |
| `PINATA_JWT`, `PINATA_GATEWAY` | certificates / IPFS | |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PACK_*` | billing | see Stripe setup below |
| `SPOTIFY_*`, `LASTFM_API_KEY`, `DISCOGS_API_KEY`, `DISCOGS_SECRETS`, `ACOUSTID_API`, `ACOUSTID_API_TOKEN`, `ACR_*` | enrichment / identification | optional |
| `APP_BASE_URL` | `auth.py` | public frontend URL used in email links (default is the canonical app domain) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_STARTTLS` | `utils/email.py` | transactional email (password reset). **If `SMTP_HOST` is unset, emails are written to the container logs instead of sent** — set these in prod. |
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

The whole state is `/srv/hbrl/Metadata-Engine/data/` (SQLite + any uploads):
```bash
ssh root@84.247.162.167 \
  "tar czf /root/mme-backup-$(date +%F).tar.gz -C /srv/hbrl/Metadata-Engine data"
```
The deploy also drops timestamped `.env.backup.*` files in the repo dir — prune
them occasionally.

## Frontend build notes

- `torch` is pinned to `2.13.0+cpu` in `backend/requirements.txt` (CPU wheel
  index) — do not let it drift back to the CUDA build (~2 GB, times the deploy
  out).
- Frontend main bundle is >1 MB; a code-split pass is a future improvement.
