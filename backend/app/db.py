from sqlalchemy import create_engine, Column, Integer, String, DateTime, text, Boolean, ForeignKey, Float
from sqlalchemy.types import JSON
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

# Determine database path
PERSISTENT_DATA_PATH = "/data"
SQLITE_DB_NAME = "music_metadata.db"

# Default to centralized Postgres if not specified
DEFAULT_POSTGRES_URL = "postgresql://hbrl_admin:HardbanRecordsLab2026!@hbrl-postgres:5432/hbrl_central"

if os.path.exists(PERSISTENT_DATA_PATH):
    DEFAULT_DB_URL = f"sqlite:///{PERSISTENT_DATA_PATH}/{SQLITE_DB_NAME}"
else:
    DEFAULT_DB_URL = f"sqlite:///./{SQLITE_DB_NAME}"

DATABASE_URL = "sqlite:////data/music_metadata.db"

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
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, nullable=True) # Optional for legacy
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    tier = Column(String, default="starter")
    credits = Column(Integer, default=5)
    api_key = Column(String, unique=True, nullable=True, default=lambda: str(uuid.uuid4()))

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)
    status = Column(String, default="pending", index=True)
    file_name = Column(String, nullable=False)
    result = Column(JSON, nullable=True)
    error = Column(String, nullable=True)
    message = Column(String, nullable=True)
    duration = Column(Float, nullable=True)
    structure = Column(JSON, nullable=True)
    coverArt = Column(String, nullable=True)
    ipfs_hash = Column(String, nullable=True, unique=True)
    ipfs_url = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class RedeemCode(Base):
    __tablename__ = "redeem_codes"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    credits = Column(Integer)
    max_uses = Column(Integer, default=1)
    used_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AnalysisHistory(Base):
    __tablename__ = "analysis_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    file_name = Column(String)
    result = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    certificate_id = Column(String, unique=True, index=True)
    user_id = Column(String, index=True, nullable=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=True)
    file_name = Column(String)
    sha256 = Column(String, index=True)
    certificate_metadata = Column(JSON)
    verification_status = Column(String, default="pending")
    price_usd = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

class VerificationEvent(Base):
    __tablename__ = "verification_events"
    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(String, ForeignKey("certificates.id"))
    status = Column(String)
    client_ip = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Helper for migrations
def run_migrations():
    try:
        with engine.connect() as conn:
            # We could add column checks here if needed
            pass
    except Exception as e:
        logger.error(f"Migration error: {e}")

# Apply migrations and create tables
Base.metadata.create_all(bind=engine)
run_migrations()
