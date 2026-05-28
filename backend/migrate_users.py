#!/usr/bin/env python3
"""
HRL Metadata-Engine -> hbrl_central User Migration
Migrates users from SQLite (music_metadata.db) to PostgreSQL User table.
Usage: python migrate_users.py [--dry-run] [--sqlite-path PATH]
"""
import os, sys, sqlite3, psycopg2, argparse, logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migrate_users")

PG_URL = os.getenv("DATABASE_URL")
if not PG_URL:
    logger.error("DATABASE_URL not set"); sys.exit(1)

def map_user(row):
    full = (row.get("full_name") or "").strip()
    parts = full.split(" ", 1)
    return {
        "id": row["id"], "email": row["email"],
        "passwordHash": row["password_hash"],
        "firstName": parts[0] if parts else "Migrated",
        "lastName": parts[1] if len(parts) > 1 else "User",
        "role": "ADMIN" if row.get("is_superuser") else "STUDENT",
        "status": "active" if row.get("is_active", 1) else "inactive",
        "companyId": None, "isActive": bool(row.get("is_active", 1)),
        "lastLoginAt": row.get("last_login"),
        "createdAt": row.get("created_at", datetime.utcnow().isoformat()),
        "updatedAt": datetime.utcnow().isoformat(),
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--sqlite-path", default=os.path.join(os.path.dirname(__file__),"..","data","music_metadata.db"))
    a = p.parse_args()
    sp = os.path.abspath(a.sqlite_path)
    if not os.path.exists(sp): logger.error(f"Not found: {sp}"); sys.exit(1)
    sq = sqlite3.connect(sp); sq.row_factory = sqlite3.Row
    users = sq.execute("SELECT * FROM users").fetchall()
    logger.info(f"SQLite users: {len(users)}"); sq.close()
    pg = psycopg2.connect(PG_URL); pg.autocommit = False; c = pg.cursor()
    emails = [r["email"] for r in users if r["email"]]
    c.execute('SELECT email FROM "User" WHERE email = ANY(%s)', (emails,))
    existing = {r[0] for r in c.fetchall()}
    ins = sk = er = 0
    sql = 'INSERT INTO "User" (id, email, "passwordHash", "firstName", "lastName", role, status, "companyId", "isActive", "lastLoginAt", "createdAt", "updatedAt") VALUES (%(id)s, %(email)s, %(passwordHash)s, %(firstName)s, %(lastName)s, %(role)s, %(status)s, %(companyId)s, %(isActive)s, %(lastLoginAt)s, %(createdAt)s, %(updatedAt)s) ON CONFLICT (email) DO NOTHING'
    for r in users:
        if not r["email"]: sk += 1; continue
        if r["email"] in existing: sk += 1; continue
        m = map_user(dict(r))
        if a.dry_run: logger.info(f"[DRY] {m['email']} ({m['role']})"); continue
        try: c.execute(sql, m); ins += 1
        except Exception as e: er += 1; logger.error(f"{r['email']}: {e}")
    if not a.dry_run: pg.commit()
    c.close(); pg.close()
    logger.info(f"Inserted={ins} Skipped={sk} Errors={er}")

if __name__ == "__main__": main()
