
import sqlite3
import json
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class AnalysisCache:
    """
    Persistent cache for analysis results using SQLite.
    Keyed by SHA-256 hash.
    """
    
    def __init__(self, db_path: str = "analysis_cache.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cache (
                    hash TEXT PRIMARY KEY,
                    result TEXT,
                    timestamp DATETIME
                )
            ''')
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to initialize analysis cache: {e}")

    def get(self, file_hash: str):
        if not file_hash:
            return None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT result FROM cache WHERE hash = ?", (file_hash,))
            row = cursor.fetchone()
            conn.close()
            if row:
                logger.info(f"Cache hit for hash: {file_hash[:16]}...")
                return json.loads(row[0])
        except Exception as e:
            logger.error(f"Failed to read from cache: {e}")
        return None

    def set(self, file_hash: str, result: dict):
        if not file_hash or not result:
            return
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR REPLACE INTO cache (hash, result, timestamp) VALUES (?, ?, ?)",
                (file_hash, json.dumps(result), datetime.utcnow())
            )
            conn.commit()
            conn.close()
            logger.info(f"Cached result for hash: {file_hash[:16]}...")
        except Exception as e:
            logger.error(f"Failed to write to cache: {e}")

# Global instance for easy import
cache = AnalysisCache()
