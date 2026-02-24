"""
Database Migration Script (Clean)
Adds 'message', 'duration', 'structure', 'coverArt' columns to jobs table if missing.
"""
import sqlite3
import os

DB_PATH = "music_metadata.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} does not exist.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check current columns
        cursor.execute("PRAGMA table_info(jobs)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"Current columns in 'jobs': {columns}")
        
        cols_to_add = {
            'message': 'TEXT',
            'duration': 'REAL',
            'structure': 'JSON',
            'coverArt': 'TEXT'
        }
        
        for col, col_type in cols_to_add.items():
            if col not in columns:
                print(f"Adding '{col}' column to jobs table...")
                cursor.execute(f"ALTER TABLE jobs ADD COLUMN {col} {col_type}")
                conn.commit()
                print(f"  Column '{col}' added.")
            else:
                print(f"  Column '{col}' already exists.")
        
        print("Migration process finished.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
