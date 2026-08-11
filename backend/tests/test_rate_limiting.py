"""Verifies the rate limiter on the login endpoint actually triggers,
rather than trusting the decorator is wired correctly. Uses a fresh,
isolated FastAPI app + in-memory SQLite so it doesn't need the full
app.main import chain (heavy DSP deps) or a live database.
"""
import os
import tempfile

# A real file, not sqlite:///:memory: — SQLAlchemy picks a different
# default connection pool for in-memory SQLite (needs StaticPool to
# actually persist across connections) than for file-based SQLite, which
# is what production actually uses. Match that so this test exercises the
# same code path production runs, not an artifact of :memory:'s pooling.
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db.name}"
os.environ["SECRET_KEY"] = "test-secret-for-rate-limit-tests"

# app.config calls load_dotenv(override=True), which would clobber the env
# vars just set above with whatever's in a local backend/.env (dotenv
# resolves relative to config.py's location, not this test's cwd/PYTHONPATH,
# so there's no path-based way around it). No-op it before that import runs.
import dotenv
dotenv.load_dotenv = lambda *a, **k: None

# Importing app.routes.auth transitively imports every other route module
# via routes/__init__.py, including ones that need weasyprint — which in
# turn needs system-level GTK/Pango libraries not installable via pip on
# this machine. Stub it out; this test never touches PDF generation.
import sys
import types
_weasyprint_stub = types.ModuleType("weasyprint")
_weasyprint_stub.HTML = lambda *a, **k: None
sys.modules.setdefault("weasyprint", _weasyprint_stub)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.rate_limit import limiter
from app.routes.auth import router as auth_router


def make_client():
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(auth_router, prefix="/api")
    return TestClient(app)


def test_login_rate_limit_triggers_after_5_per_minute():
    client = make_client()
    limiter.reset()

    statuses = []
    for _ in range(7):
        resp = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "wrong"},
        )
        statuses.append(resp.status_code)

    # First 5 requests hit real app logic (401 for bad credentials on an
    # empty in-memory DB); the 6th and 7th must be blocked by the limiter
    # before reaching the route at all.
    assert statuses[:5] == [401] * 5
    assert 429 in statuses[5:]


def test_register_rate_limit_triggers_after_10_per_minute():
    client = make_client()
    limiter.reset()

    statuses = []
    for i in range(12):
        resp = client.post(
            "/api/auth/register",
            json={"email": f"user{i}@example.com", "password": "password123"},
        )
        statuses.append(resp.status_code)

    assert 429 in statuses[10:]
