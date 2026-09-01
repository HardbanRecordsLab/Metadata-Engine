# docs/archive

One-off scripts kept only for historical reference. Do **not** run these
against production.

- `migrate_users.py` — one-time migration of the app's SQLite `users` table
  into the central `hbrl_central."User"` table (camelCase / Prisma schema of
  the separate Access-Manager service). Executed once during the 2026
  consolidation; the app itself no longer uses `hbrl_central`. Superseded by
  the app's own `app/db.py` (`create_all` + `run_migrations`).
