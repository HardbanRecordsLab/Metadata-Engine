"""Public timestamps for passports (OpenTimestamps): the file format, the digest, the calendar round, and the two endpoints.

The files were also parsed with the official `opentimestamps` library against the real calendars (alice, bob, finney) when this was
written; here nothing touches the network."""
import base64

import httpx
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.services import ots_stamp, passport


@pytest.fixture()
def pp():
    passport.use_key_for_tests(Ed25519PrivateKey.generate())
    p = passport.build_passport({"sha256": "ab" * 32, "title": "T", "bpm": 124.0, "key": "A"},
                                {"score": 0.9, "grade": "A", "needsReview": False, "flags": []}, None)
    yield p
    passport.use_key_for_tests(None)


def test_file_layout_and_round_trip():
    digest = bytes(range(32))
    ots = ots_stamp.build_ots(digest, b"\x08\xf0\x10" + b"\x00" * 16)
    assert ots.startswith(b"\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94")
    assert ots[31:33] == b"\x01\x08"                                   # version 1, SHA-256
    assert ots_stamp.ots_digest(ots) == digest
    assert ots.endswith(b"\x08\xf0\x10" + b"\x00" * 16)                # the calendar's tree follows the digest untouched


def test_rejects_what_is_not_a_timestamp_file():
    assert ots_stamp.ots_digest(b"") is None
    assert ots_stamp.ots_digest(b"hello" * 20) is None
    assert ots_stamp.ots_digest(ots_stamp.HEADER_MAGIC + b"\x02\x08" + bytes(33)) is None      # unknown version
    assert ots_stamp.ots_digest(ots_stamp.HEADER_MAGIC + b"\x01\x02" + bytes(33)) is None      # not SHA-256
    with pytest.raises(ValueError):
        ots_stamp.build_ots(b"short", b"x")


def test_digest_covers_the_whole_signed_passport(pp):
    d = ots_stamp.passport_digest(pp)
    assert len(d) == 32 and d == ots_stamp.passport_digest(dict(pp))
    tampered = {**pp, "payload": {**pp["payload"], "claims": {**pp["payload"]["claims"], "title": "Other"}}}
    assert ots_stamp.passport_digest(tampered) != d
    resigned = {**pp, "signature": base64.b64encode(b"\x00" * 64).decode()}
    assert ots_stamp.passport_digest(resigned) != d                      # the signature is stamped too, not only the payload


async def test_every_calendar_that_answers_gets_its_own_file(pp):
    seen = []

    def handler(request: httpx.Request):
        seen.append((str(request.url), request.content, request.headers["accept"]))
        if "bob" in request.url.host:
            return httpx.Response(500)
        if "finney" in request.url.host:
            raise httpx.ConnectError("down")
        return httpx.Response(200, content=b"\xf0\x10" + b"\x01" * 16 + b"\x08\x00")

    res = await ots_stamp.submit(pp, transport=httpx.MockTransport(handler))
    digest = ots_stamp.passport_digest(pp)
    assert res["status"] == "pending" and res["digest"] == digest.hex()
    assert [s["calendar"] for s in res["stamps"]] == [ots_stamp.CALENDARS[0]]
    assert all(c == digest for _, c, _ in seen) and len(seen) == 3                       # only the digest left the server
    assert all(u.endswith("/digest") and a == "application/vnd.opentimestamps.v1" for u, _, a in seen)
    raw = base64.b64decode(res["stamps"][0]["ots_b64"])
    assert ots_stamp.ots_digest(raw) == digest


async def test_no_calendar_answering_is_reported_not_raised(pp):
    res = await ots_stamp.submit(pp, transport=httpx.MockTransport(lambda r: httpx.Response(503)))
    assert res["status"] == "unavailable" and res["stamps"] == [] and "try again" in res["next"]
    huge = await ots_stamp.submit(pp, transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x" * 50_000)))
    assert huge["stamps"] == []                                                          # an absurd answer is not stored


# ───────────────────────────── endpoints ─────────────────────────────
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.rate_limit import limiter  # noqa: E402
from app.routes.intelligence import router as intel_router  # noqa: E402


@pytest.fixture()
def client(monkeypatch):
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(intel_router, prefix="/api")
    return TestClient(app)


def test_timestamp_endpoint_only_stamps_a_valid_passport(client, pp, monkeypatch):
    got = {}

    async def fake_submit(p):
        got["p"] = p
        return {"status": "pending", "stamps": [], "digest": ots_stamp.passport_digest(p).hex()}
    monkeypatch.setattr(ots_stamp, "submit", fake_submit)

    ok = client.post("/api/intelligence/passport/timestamp", json={"passport": pp})
    assert ok.status_code == 200 and ok.json()["digest"] == ots_stamp.passport_digest(pp).hex() and got["p"] == pp

    forged = {**pp, "payload": {**pp["payload"], "claims": {"title": "Forged"}}}
    r = client.post("/api/intelligence/passport/timestamp", json={"passport": forged})
    assert r.status_code == 400 and "valid passport" in r.json()["detail"]
    assert client.post("/api/intelligence/passport/timestamp", json={"passport": {"nope": 1}}).status_code == 400


def test_check_endpoint_matches_file_to_passport(client, pp):
    ots = ots_stamp.build_ots(ots_stamp.passport_digest(pp), b"\x00")
    b64 = base64.b64encode(ots).decode()
    r = client.post("/api/intelligence/passport/timestamp/check", json={"passport": pp, "ots_b64": b64}).json()
    assert r["matches"] is True and r["passportValid"] is True

    other = passport.build_passport({"sha256": "cd" * 32, "title": "Other"}, None, None)
    assert client.post("/api/intelligence/passport/timestamp/check", json={"passport": other, "ots_b64": b64}).json()["matches"] is False

    junk = base64.b64encode(b"not a timestamp" * 10).decode()
    assert client.post("/api/intelligence/passport/timestamp/check", json={"passport": pp, "ots_b64": junk}).json() == {"matches": False, "reason": "not an OpenTimestamps file"}
    assert client.post("/api/intelligence/passport/timestamp/check", json={"passport": pp, "ots_b64": "%%%"}).status_code == 400
