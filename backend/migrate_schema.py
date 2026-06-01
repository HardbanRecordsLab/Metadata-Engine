from app.db import engine, text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

COLUMNS_TO_ADD = {
    "users": [
        ("username", "VARCHAR", True),
        ("full_name", "VARCHAR", True),
        ("is_superuser", "BOOLEAN", False),
        ("is_premium", "BOOLEAN", False),
        ("tier", "VARCHAR", "starter"),
        ("credits", "INTEGER", 10),
        ("last_login", "TIMESTAMP", True),
        ("api_key", "VARCHAR", True),
    ],
    "certificates": [
        ("price_usd", "FLOAT", 0.5),
        ("view_token", "VARCHAR", True),
    ],
}


def _column_exists(conn, table: str, col_name: str) -> bool:
    if engine.dialect.name == "sqlite":
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return any(row[1] == col_name for row in rows)
    check_query = text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :col"
    )
    return conn.execute(check_query, {"table": table, "col": col_name}).fetchone() is not None


def _alter_sql(table: str, col_name: str, col_type: str, default_val) -> str:
    if default_val is True:
        return f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
    if isinstance(default_val, bool):
        default = "TRUE" if default_val else "FALSE"
        if engine.dialect.name == "sqlite":
            default = "1" if default_val else "0"
        return f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT {default}"
    if isinstance(default_val, (int, float)):
        return f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT {default_val}"
    return f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT '{default_val}'"


def migrate():
    with engine.connect() as conn:
        for table, cols in COLUMNS_TO_ADD.items():
            for col_name, col_type, default_val in cols:
                try:
                    if _column_exists(conn, table, col_name):
                        logger.info("Column %s already exists in %s.", col_name, table)
                        continue
                    alter_query = text(_alter_sql(table, col_name, col_type, default_val))
                    logger.info("Adding column %s to table %s...", col_name, table)
                    conn.execute(alter_query)
                    conn.commit()
                    logger.info("Successfully added %s.", col_name)
                except Exception as e:
                    logger.error("Failed to add column %s to %s: %s", col_name, table, e)

    logger.info("Migration finished.")


if __name__ == "__main__":
    migrate()
