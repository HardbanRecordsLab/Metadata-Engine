from sqlalchemy import create_engine, Column, Integer, String, DateTime, text
from sqlalchemy.types import JSON
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os
import logging

logger = logging.getLogger(__name__)

# Determine database path (use /data on HF Spaces for persistence if available)
PERSISTENT_DATA_PATH = "/data"
SQLITE_DB_NAME = "music_metadata.db"

if os.path.exists(PERSISTENT_DATA_PATH):
    DEFAULT_DB_URL = f"sqlite:///{PERSISTENT_DATA_PATH}/{SQLITE_DB_NAME}"
else:
    DEFAULT_DB_URL = f"sqlite:///./{SQLITE_DB_NAME}"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class Base(DeclarativeBase):
    pass

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)
    status = Column(String, default="pending")
    file_name = Column(String)
    result = Column(JSON, nullable=True)
    error = Column(String, nullable=True)
    message = Column(String, nullable=True)
    duration = Column(Integer, nullable=True)
    structure = Column(JSON, nullable=True)
    coverArt = Column(String, nullable=True)
    ipfs_hash = Column(String, nullable=True)
    ipfs_url = Column(String, nullable=True)
    timestamp = Column(DateTime)

class AnalysisHistory(Base):
    __tablename__ = "analysis_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    file_name = Column(String)
    result = Column(JSON)
    timestamp = Column(DateTime)

# Helper for migrations
def run_migrations():
    if "sqlite" not in DATABASE_URL:
        return
    
    try:
        with engine.connect() as conn:
            # Check for missing columns in 'jobs'
            result = conn.execute(text("PRAGMA table_info(jobs)"))
            cols = [row[1] for row in result.fetchall()]
            
            if not cols:
                return # Table doesn't exist yet, create_all will handle it
                
            required = {
                "message": "TEXT",
                "duration": "INTEGER",
                "structure": "JSON",
                "coverArt": "TEXT",
                "ipfs_hash": "TEXT",
                "ipfs_url": "TEXT",
            }
            
            for col, col_type in required.items():
                if col not in cols:
                    logger.info(f"Adding missing column '{col}' to 'jobs' table...")
                    conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col} {col_type}"))
                    conn.commit()
    except Exception as e:
        logger.error(f"Migration error: {e}")

# Apply migrations and create tables
Base.metadata.create_all(bind=engine)
run_migrations()
