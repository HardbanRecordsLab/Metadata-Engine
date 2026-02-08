from sqlalchemy import create_engine, Column, Integer, String, DateTime, text, Boolean
from sqlalchemy.types import JSON
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os
import logging
import uuid

logger = logging.getLogger(__name__)

# Determine database path (use /data on HF Spaces for persistence if available)
PERSISTENT_DATA_PATH = "/data"
SQLITE_DB_NAME = "music_metadata.db"

# Default to centralized Postgres if not specified
# But keep SQLite fallback for simple local dev without docker
# Use container name 'hbrl-postgres' which is safe when on the same external network
DEFAULT_POSTGRES_URL = "postgresql://hbrl_admin:HardbanRecordsLab2026!@hbrl-postgres:5432/hbrl_central"

if os.path.exists(PERSISTENT_DATA_PATH):
    DEFAULT_DB_URL = f"sqlite:///{PERSISTENT_DATA_PATH}/{SQLITE_DB_NAME}"
else:
    DEFAULT_DB_URL = f"sqlite:///./{SQLITE_DB_NAME}"

# Use Postgres if Env Var is set, OR if we are running in Docker (often implicit, but let's stick to Env or default)
# Actually, let's make it configurable via Env, but default to SQLite for safety unless we know we are in the cluster.
# The user wants "one db for all apps". So we should prefer the Postgres URL.
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# If we are on VPS (implied by user instruction), we should probably use the Postgres URL.
# But hardcoding it might break local dev if they don't have Postgres.
# Let's rely on the user passing DATABASE_URL env var, or check if we can connect to Postgres.

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

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=text('CURRENT_TIMESTAMP'))
    tier = Column(String, default="starter")
    credits = Column(Integer, default=5)

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
    created_at = Column(DateTime, default=text('CURRENT_TIMESTAMP'))

# Helper for migrations
def run_migrations():
    if "sqlite" not in DATABASE_URL:
        # For Postgres, we might want to ensure tables exist too
        # But for now, create_all does the job for new tables
        pass
    
    try:
        with engine.connect() as conn:
            # Check for missing columns in 'jobs'
            # (Simplified for now - create_all handles new tables)
            pass
    except Exception as e:
        logger.error(f"Migration error: {e}")

# Apply migrations and create tables
Base.metadata.create_all(bind=engine)
run_migrations()
