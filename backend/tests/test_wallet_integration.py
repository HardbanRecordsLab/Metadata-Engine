"""Metadata Engine with HRL Wallet switched on: one sign-up for all HRL apps, credits kept in the wallet, the local path untouched when the flag is off.

The wallet is replaced by an in-memory fake that behaves like the real one (its own suite is in the HRL-Wallet repo); an isolated FastAPI app and SQLite
are used so the heavy DSP import chain is not needed (same approach as test_rate_limiting.py).
"""
import asyncio
import os
import tempfile
import uuid

_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_tmp_db.name}")
os.environ.setdefault("SECRET_KEY", "test-secret-for-wallet-integration")

import dotenv  # noqa: E402

dotenv.load_dotenv = lambda *a, **k: None

import sys  # noqa: E402
import types  # noqa: E402

sys.modules.setdefault("weasyprint", types.ModuleType("weasyprint"))
sys.modules["weasyprint"].HTML = getattr(sys.modules["weasyprint"], "HTML", lambda *a, **k: None)

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import SessionLocal, User  # noqa: E402
from app.rate_limit import limiter  # noqa: E402
from app.routes import auth, billing, redeem_codes  # noqa: E402
from app.dependencies import decrement_user_credits, get_user_and_check_quota  # noqa: E402  (after the routes: app.dependencies and app.routes import each other)
from app.security import create_purpose_token  # noqa: E402
from app.services import wallet  # noqa: E402

PW = "correct horse battery"


class FakeWallet:
    def __init__(self):
        self.accounts, self.keys, self.down = {}, {}, False
        self.codes = {"WELCOME10": 10}
        self.checkouts = []

    def seed(self, email, password=PW, credits=3, start=0):
        self.accounts[email] = {"id": uuid.uuid4().hex, "pw": password, "credits": credits, "start": start, "links": set()}

    def by_id(self, aid):
        return next(a for a in self.accounts.values() if a["id"] == aid)

    def __call__(self, method, path, json=None, params=None):
        if self.down:
            raise wallet.WalletUnavailable(503, "wallet_unavailable", "down")
        json = json or {}
        if path == "/v1/accounts/register":
            if len(json["password"]) < 8:
                raise wallet.WalletError(422, "weak_password", "password must be 8 to 200 characters")
            if json["email"] in self.accounts:
                raise wallet.WalletError(409, "email_taken", "exists")
            self.seed(json["email"], json["password"], credits=3, start=27)
            return {"ok": True, "account_id": self.accounts[json["email"]]["id"], "credits": 30}
        if path == "/v1/accounts/login":
            a = self.accounts.get(json["email"])
            if not a or a["pw"] != json["password"]:
                raise wallet.WalletError(401, "bad_credentials", "wrong e-mail or password")
            return {"ok": True, "account_id": a["id"], "credits": a["credits"]}
        if path == "/v1/accounts/password":
            a = self.by_id(json["account_id"])
            if a["pw"] != json["old_password"]:
                raise wallet.WalletError(401, "bad_credentials", "wrong password")
            a["pw"] = json["new_password"]
            return {"ok": True}
        if path == "/v1/accounts/set-password":
            self.by_id(json["account_id"])["pw"] = json["new_password"]
            return {"ok": True}
        if path == "/v1/accounts/unlink":
            a = self.by_id(json["account_id"])
            if a["pw"] != json["password"]:
                raise wallet.WalletError(401, "bad_credentials", "wrong password")
            self.accounts = {e: x for e, x in self.accounts.items() if x is not a}
            return {"ok": True, "account_deleted": True}
        aid = path.split("/")[3] if path.startswith("/v1/wallet/") and path.count("/") > 3 else json.get("account_id")
        if path.endswith("/balance"):
            a = self.by_id(aid)
            return {"ok": True, "credits": a["credits"] + a.get("start", 0), "available": a["credits"], "unlimited": False}
        if path == "/v1/wallet/charge":
            a = self.by_id(aid)
            if json["idempotency_key"] in self.keys:
                return {"ok": True, "replayed": True, "credits": a["credits"]}
            if a["credits"] < json["units"]:
                raise wallet.WalletError(402, "insufficient_credits", "not enough")
            a["credits"] -= json["units"]
            self.keys[json["idempotency_key"]] = json["units"]
            return {"ok": True, "replayed": False, "credits": a["credits"]}
        if path == "/v1/wallet/redeem":
            a = self.by_id(aid)
            if json["code"] not in self.codes:
                raise wallet.WalletError(400, "wallet_error", "invalid or inactive code")
            granted = self.codes.pop(json["code"])
            a["credits"] += granted
            return {"ok": True, "granted": granted, "credits": a["credits"]}
        if path.endswith("/purchases"):
            return {"ok": True, "purchases": [{"id": "cs_1", "pack_id": "starter", "credits": 10, "amount_cents": 900, "currency": "usd", "created_at": "2026-10-31T00:00:00+00:00"}]}
        if path == "/v1/checkout":
            self.checkouts.append(json)
            return {"ok": True, "checkout_url": "https://checkout.stripe.test/c1", "session_id": "cs_c1"}
        raise AssertionError("unexpected wallet call " + path)


@pytest.fixture()
def fw(monkeypatch):
    fake = FakeWallet()
    monkeypatch.setattr(wallet, "_call", fake)
    monkeypatch.setattr(settings, "WALLET_ENABLED", True)
    monkeypatch.setattr(settings, "WALLET_URL", "http://wallet.test")
    monkeypatch.setattr(settings, "WALLET_TOKEN", "t")
    return fake


@pytest.fixture()
def client():
    limiter.enabled = False
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router, prefix="/api")
    app.include_router(billing.router, prefix="/api")
    app.include_router(redeem_codes.router, prefix="/api")
    yield TestClient(app)
    limiter.enabled = True


def email():
    return f"w{uuid.uuid4().hex[:10]}@example.com"


def signup(client, em, pw=PW):
    r = client.post("/api/auth/register", json={"email": em, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()


def local_user(em):
    with SessionLocal() as db:
        return db.query(User).filter(User.email == em).first()


def bearer(token):
    return {"Authorization": f"Bearer {token['access_token']}"}


def test_sign_up_creates_the_wallet_account_and_the_balance_is_the_wallets(client, fw):
    em = email()
    tok = signup(client, em)
    u = local_user(em)
    assert u.wallet_account_id == fw.accounts[em]["id"] and u.credits == 0
    me = client.get("/api/auth/me", headers=bearer(tok)).json()
    assert me["credits"] == 3                                     # the 3 free analyses; the 27 credits of the free MasteringPro tracks are not analyses


def test_the_same_person_signing_up_in_the_second_app_is_linked_not_given_a_second_grant(client, fw):
    em = email()
    fw.seed(em, PW, credits=12)                                   # already registered in MasteringPro and has spent some
    tok = signup(client, em)
    assert client.get("/api/auth/me", headers=bearer(tok)).json()["credits"] == 12
    other = email()
    fw.seed(other, "another password 1")
    r = client.post("/api/auth/register", json={"email": other, "password": PW})
    assert r.status_code == 409 and "different password" in r.json()["detail"]


def test_login_goes_through_the_wallet_and_keeps_the_local_hash_in_step(client, fw):
    em = email()
    signup(client, em)
    assert client.post("/api/auth/login", json={"email": em, "password": "wrong password!"}).status_code == 401
    fw.accounts[em]["pw"] = "changed in masteringpro"             # the person changed the password in the other app
    assert client.post("/api/auth/login", json={"email": em, "password": PW}).status_code == 401
    ok = client.post("/api/auth/login", json={"email": em, "password": "changed in masteringpro"})
    assert ok.status_code == 200
    from app.security import verify_password
    assert verify_password("changed in masteringpro", local_user(em).password_hash)


def test_one_analysis_is_one_credit_charged_once_and_an_empty_balance_is_refused(client, fw):
    em = email()
    signup(client, em)
    u = local_user(em)
    with SessionLocal() as db:
        assert get_user_and_check_quota(u, db) is u
        assert asyncio.run(decrement_user_credits(u.id, db, ref="job:abc12345")) is True
        assert asyncio.run(decrement_user_credits(u.id, db, ref="job:abc12345")) is True      # a retry of the same job
        assert fw.accounts[em]["credits"] == 2
        fw.accounts[em]["credits"] = 0
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as e:
            get_user_and_check_quota(u, db)
        assert e.value.status_code == 402
        assert asyncio.run(decrement_user_credits(u.id, db, ref="job:zzzzzzzz")) is False


def test_when_the_wallet_is_down_nothing_is_guessed(client, fw):
    em = email()
    signup(client, em)
    fw.down = True
    assert client.post("/api/auth/login", json={"email": em, "password": PW}).status_code == 503
    from fastapi import HTTPException
    with SessionLocal() as db:
        with pytest.raises(HTTPException) as e:
            get_user_and_check_quota(local_user(em), db)
        assert e.value.status_code == 503


def test_redeem_checkout_and_history_use_the_wallet(client, fw):
    em = email()
    tok = signup(client, em)
    h = bearer(tok)
    r = client.post("/api/quota/redeem", json={"code": "welcome10"}, headers=h)
    assert r.status_code == 200 and r.json()["credits"] == 13
    bad = client.post("/api/quota/redeem", json={"code": "NOPE"}, headers=h)
    assert bad.status_code == 400 and "Invalid" in bad.json()["error"]
    c = client.post("/api/billing/checkout", json={"pack_id": "producer"}, headers=h)
    assert c.status_code == 200 and c.json()["checkout_url"].startswith("https://checkout.stripe.test/")
    assert fw.checkouts[0]["pack_id"] == "producer" and fw.checkouts[0]["account_id"] == fw.accounts[em]["id"]
    hist = client.get("/api/billing/history", headers=h).json()["purchases"]
    assert hist[0]["credits_added"] == 10 and hist[0]["amount_total"] == 900


def test_password_change_reset_and_account_deletion_reach_the_wallet(client, fw):
    em = email()
    tok = signup(client, em)
    h = bearer(tok)
    bad = client.post("/api/auth/me/change-password", json={"current_password": "nope nope nope", "new_password": "a second password"}, headers=h)
    assert bad.status_code == 403
    assert client.post("/api/auth/me/change-password", json={"current_password": PW, "new_password": "a second password"}, headers=h).status_code == 200
    assert fw.accounts[em]["pw"] == "a second password"
    reset = create_purpose_token(local_user(em).id, auth.PWD_RESET_PURPOSE, expires_minutes=5)
    assert client.post("/api/auth/reset-password", json={"token": reset, "new_password": "a third password"}).status_code == 200
    assert fw.accounts[em]["pw"] == "a third password"
    wrong = client.request("DELETE", "/api/auth/me", json={"password": "nope nope nope"}, headers=h)
    assert wrong.status_code == 403 and em in fw.accounts
    assert client.request("DELETE", "/api/auth/me", json={"password": "a third password"}, headers=h).status_code == 200
    assert em not in fw.accounts and local_user(em) is None


def test_flag_off_means_the_old_local_credits_untouched(client, monkeypatch):
    monkeypatch.setattr(settings, "WALLET_ENABLED", False)
    called = []
    monkeypatch.setattr(wallet, "_call", lambda *a, **k: called.append(a))
    em = email()
    tok = signup(client, em)
    u = local_user(em)
    assert u.wallet_account_id is None and u.credits == 3
    assert client.get("/api/auth/me", headers=bearer(tok)).json()["credits"] == 3
    with SessionLocal() as db:
        assert asyncio.run(decrement_user_credits(u.id, db)) is True
    assert local_user(em).credits == 2 and called == []


def test_an_account_not_linked_to_the_wallet_keeps_its_local_credits_even_with_the_flag_on(client, fw):
    em = email()
    with SessionLocal() as db:
        from app.security import get_password_hash
        db.add(User(id=str(uuid.uuid4()), email=em, username=em, password_hash=get_password_hash(PW), credits=1_000_000, is_verified=True))
        db.commit()
    assert client.post("/api/auth/login", json={"email": em, "password": PW}).status_code == 200      # local hash, no wallet call
    u = local_user(em)
    with SessionLocal() as db:
        assert get_user_and_check_quota(u, db) is u
        assert asyncio.run(decrement_user_credits(u.id, db)) is True
    assert local_user(em).credits == 999_999
