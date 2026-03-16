from app.db import engine, text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

def migrate():
    columns_to_add = {
        "users": [
            ("username", "VARCHAR", True),
            ("full_name", "VARCHAR", True),
            ("is_superuser", "BOOLEAN", False),
            ("is_premium", "BOOLEAN", False),
            ("tier", "VARCHAR", "starter"),
            ("credits", "INTEGER", 10),
            ("last_login", "TIMESTAMP", True),
            ("api_key", "VARCHAR", True)
        ],
        "certificates": [
            ("price_usd", "FLOAT", 0.5),
            ("view_token", "VARCHAR", True)
        ]
    }

    with engine.connect() as conn:
        for table, cols in columns_to_add.items():
            for col_name, col_type, default_val in cols:
                try:
                    # Check if column exists
                    check_query = text(f"SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = '{col_name}'")
                    res = conn.execute(check_query).fetchone()
                    
                    if not res:
                        logger.info(f"Adding column {col_name} to table {table}...")
                        
                        if default_val is True: # Nullable
                            alter_query = text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
                        elif isinstance(default_val, (int, float)):
                            alter_query = text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT {default_val}")
                        elif isinstance(default_val, bool):
                            alter_query = text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT {'TRUE' if default_val else 'FALSE'}")
                        else: # String
                            alter_query = text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT '{default_val}'")
                        
                        conn.execute(alter_query)
                        conn.commit()
                        logger.info(f"Successfully added {col_name}.")
                    else:
                        logger.info(f"Column {col_name} already exists in {table}.")
                except Exception as e:
                    logger.error(f"Failed to add column {col_name} to {table}: {e}")
        
    logger.info("Migration finished.")

if __name__ == "__main__":
    migrate()
