"""Stripe webhook must credit a paid checkout.

Regression: stripe-python >= 12 returns StripeObjects without dict ``.get`` — the handler crashed with 500 on every real
paid checkout (credits were never added). It now works on the verified raw JSON.
"""
import asyncio
import hashlib
import hmac
import json
import time
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.routes import billing

SECRET = "whsec_test_secret"


def _signed(event: dict):
    body = json.dumps(event).encode()
    t = str(int(time.time()))
    sig = hmac.new(SECRET.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return body, f"t={t},v1={sig}"


class _Req:
    def __init__(self, body, sig):
        self._body, self.headers = body, {"stripe-signature": sig}

    async def body(self):
        return self._body


def _db(user):
    db = MagicMock()
    q = db.query.return_value.filter.return_value
    # 1st .first(): no CreditPurchase with this session yet; 2nd: the user
    q.first.side_effect = [None, user]
    return db


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", SECRET)


def test_paid_checkout_adds_credits():
    user = SimpleNamespace(id="u1", credits=2, tier="free", is_premium=False)
    event = {"id": "evt_1", "object": "event", "type": "checkout.session.completed", "data": {"object": {
        "id": "cs_1", "object": "checkout.session", "payment_status": "paid", "amount_total": 900, "currency": "usd",
        "metadata": {"user_id": "u1", "pack_id": "starter", "credits": "10"}}}}
    body, sig = _signed(event)
    db = _db(user)
    out = asyncio.run(billing.stripe_webhook(_Req(body, sig), db))
    assert user.credits == 12
    assert db.commit.called
    assert out.get("status") in (None, "success") or "credits" in json.dumps(out)


def test_unpaid_checkout_is_ignored():
    event = {"id": "evt_2", "object": "event", "type": "checkout.session.completed",
             "data": {"object": {"id": "cs_2", "object": "checkout.session", "payment_status": "unpaid", "metadata": {}}}}
    body, sig = _signed(event)
    out = asyncio.run(billing.stripe_webhook(_Req(body, sig), MagicMock()))
    assert out == {"status": "ignored", "reason": "not paid"}


def test_bad_signature_is_rejected():
    body, _ = _signed({"type": "checkout.session.completed"})
    with pytest.raises(Exception) as e:
        asyncio.run(billing.stripe_webhook(_Req(body, "t=1,v1=bad"), MagicMock()))
    assert getattr(e.value, "status_code", None) == 400
