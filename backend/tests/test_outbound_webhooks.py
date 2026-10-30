"""Outbound webhooks: URL safety (SSRF), signing, delivery with retries, and which jobs fire which event.

No network: DNS is replaced by a fake resolver and the HTTP layer by httpx.MockTransport."""
import json
import time
import uuid

import httpx
import pytest

from app.db import Job, SessionLocal, User, WebhookEndpoint
from app.services import outbound_webhooks as wh

PUBLIC_IP = "93.184.216.34"


def public(host, port):
    return [PUBLIC_IP]


def resolves_to(*ips):
    return lambda host, port: list(ips)


# ───────────────────────────── URL safety ─────────────────────────────
def test_accepts_a_public_https_url():
    host, port, ips = wh.check_url("https://hooks.example.com/metadata?token=1", public)
    assert (host, port, ips) == ("hooks.example.com", 443, [PUBLIC_IP])
    assert wh.check_url("https://hooks.example.com:8443/x", public)[1] == 8443


@pytest.mark.parametrize("url", [
    "http://hooks.example.com/x", "ftp://hooks.example.com/x", "hooks.example.com/x", "", "https://",
    "https://user:pass@hooks.example.com/x", "https://hooks.example.com:99999/x", "https://hooks.example.com/" + "a" * 2100,
])
def test_rejects_unusable_urls(url):
    with pytest.raises(ValueError):
        wh.check_url(url, public)


@pytest.mark.parametrize("ip", [
    "127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.5", "169.254.169.254", "0.0.0.0", "224.0.0.1", "100.64.0.1", "192.0.2.1", "255.255.255.255",
    "::1", "fe80::1", "fc00::5", "::ffff:10.0.0.1", "::ffff:127.0.0.1",
])
def test_rejects_hosts_that_resolve_inside_our_network(ip):
    with pytest.raises(ValueError, match="private or internal"):
        wh.check_url("https://hooks.example.com/x", resolves_to(ip))


def test_one_private_answer_among_public_ones_is_enough_to_refuse():
    with pytest.raises(ValueError):
        wh.check_url("https://hooks.example.com/x", resolves_to(PUBLIC_IP, "10.0.0.7"))


def test_unresolvable_host_is_refused():
    def boom(host, port):
        raise OSError("no such host")
    with pytest.raises(ValueError, match="does not resolve"):
        wh.check_url("https://nope.invalid/x", boom)


# ───────────────────────────── signing ─────────────────────────────
def test_signature_round_trip_and_tampering():
    secret, body = wh.new_secret(), b'{"a":1}'
    assert secret.startswith("whsec_") and len(secret) > 40
    header = wh.sign(secret, body)
    assert wh.verify_signature(secret, body, header)
    assert not wh.verify_signature(secret, b'{"a":2}', header)                       # body changed
    assert not wh.verify_signature(wh.new_secret(), body, header)                   # wrong secret
    assert not wh.verify_signature(secret, body, "garbage")
    assert not wh.verify_signature(secret, body, "t=abc,v1=00")
    old = wh.sign(secret, body, timestamp=int(time.time()) - 3600)
    assert not wh.verify_signature(secret, body, old)                                # replay of an old delivery
    assert wh.verify_signature(secret, body, old, tolerance_s=7200)


def test_signature_matches_an_independent_hmac():
    import hashlib
    import hmac
    header = wh.sign("whsec_x", b"payload", timestamp=1700000000)
    mac = hmac.new(b"whsec_x", b"1700000000.payload", hashlib.sha256).hexdigest()
    assert header == f"t=1700000000,v1={mac}"


# ───────────────────────────── events ─────────────────────────────
class FakeJob:
    def __init__(self, status, result=None, error=None):
        self.id, self.file_name, self.status, self.result, self.error, self.user_id = "job-1", "song.wav", status, result, error, "u1"


def test_completed_event_carries_a_summary_and_a_link_not_the_whole_result():
    job = FakeJob("completed", {"title": "T", "artist": "A", "bpm": 124, "key": "A", "mainGenre": "House", "hasVocals": False,
                                "trust": {"grade": "A", "needsReview": False}, "syncReadiness": {"score": 0.32}, "sha256": "ab" * 32,
                                "analysisReasoning": "long text that must not be copied into the event" * 50})
    ev = wh.build_event("analysis.completed", job, "https://api.example/api/")
    assert ev["type"] == "analysis.completed" and ev["id"].startswith("evt_")
    d = ev["data"]
    assert d["job_id"] == "job-1" and d["summary"]["bpm"] == 124 and d["summary"]["trustGrade"] == "A"
    assert d["result_url"] == "https://api.example/api/analysis/job/job-1"
    assert "analysisReasoning" not in json.dumps(ev)


def test_failed_event_has_a_bounded_error():
    ev = wh.build_event("analysis.failed", FakeJob("error", error="x" * 1000), "https://api.example/api")
    assert ev["data"]["status"] == "error" and len(ev["data"]["error"]) == 300 and "summary" not in ev["data"]


# ───────────────────────────── one delivery ─────────────────────────────
async def test_delivery_is_pinned_to_the_resolved_ip_and_signed_over_the_exact_body():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["headers"], seen["body"] = str(request.url), dict(request.headers), request.content
        return httpx.Response(204)

    event = {"id": "evt_1", "type": "analysis.completed", "created": 1, "data": {"job_id": "j"}}
    status, error = await wh.attempt_delivery("https://hooks.example.com/in?x=1", "whsec_k", event,
                                              resolver=public, transport=httpx.MockTransport(handler))
    assert (status, error) == (204, None)
    assert seen["url"] == f"https://{PUBLIC_IP}/in?x=1"                                # connects to the checked address ...
    assert seen["headers"]["host"] == "hooks.example.com"                               # ... but speaks for the real host
    assert seen["headers"]["x-hrl-event"] == "analysis.completed" and seen["headers"]["x-hrl-delivery"] == "evt_1"
    assert json.loads(seen["body"]) == event
    assert wh.verify_signature("whsec_k", seen["body"], seen["headers"]["x-hrl-signature"])


async def test_non_2xx_and_network_errors_are_reported_not_raised():
    ev = {"id": "evt_2", "type": "webhook.test", "created": 1, "data": {}}
    s, e = await wh.attempt_delivery("https://h.example.com/", "s", ev, resolver=public, transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    assert s == 500 and "HTTP 500" in e

    def down(request):
        raise httpx.ConnectError("refused")
    s, e = await wh.attempt_delivery("https://h.example.com/", "s", ev, resolver=public, transport=httpx.MockTransport(down))
    assert s is None and "ConnectError" in e


async def test_a_private_address_is_refused_before_any_request_is_made():
    calls = []
    ev = {"id": "evt_3", "type": "webhook.test", "created": 1, "data": {}}
    s, e = await wh.attempt_delivery("https://h.example.com/", "s", ev, resolver=resolves_to("169.254.169.254"),
                                     transport=httpx.MockTransport(lambda r: calls.append(r) or httpx.Response(200)))
    assert s is None and "private or internal" in e and calls == []


async def test_redirects_are_not_followed():
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(302, headers={"Location": "https://169.254.169.254/latest/meta-data"})
    ev = {"id": "evt_4", "type": "webhook.test", "created": 1, "data": {}}
    s, e = await wh.attempt_delivery("https://h.example.com/", "s", ev, resolver=public, transport=httpx.MockTransport(handler))
    assert s == 302 and len(calls) == 1


# ───────────────────────────── retries and bookkeeping (database) ─────────────────────────────
@pytest.fixture()
def endpoint():
    db = SessionLocal()
    uid = str(uuid.uuid4())
    db.add(User(id=uid, email=f"wh-{uid}@example.test", password_hash="x"))
    ep = WebhookEndpoint(user_id=uid, url="https://hooks.example.com/in", secret="whsec_test", is_active=True)
    db.add(ep)
    db.commit()
    ids = (uid, ep.id)
    db.close()
    yield ids
    db = SessionLocal()
    db.query(Job).filter(Job.user_id == ids[0]).delete()
    db.query(WebhookEndpoint).filter(WebhookEndpoint.user_id == ids[0]).delete()
    db.query(User).filter(User.id == ids[0]).delete()
    db.commit()
    db.close()


def state(ep_id):
    db = SessionLocal()
    try:
        ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == ep_id).first()
        return ep.last_status, ep.last_error, ep.consecutive_failures, ep.is_active
    finally:
        db.close()


async def test_retries_until_the_receiver_answers_and_then_clears_the_failure_count(endpoint, monkeypatch):
    _, ep_id = endpoint
    answers = iter([500, 503, 200])
    seen = []

    def handler(request):
        seen.append(request.headers["x-hrl-delivery"])
        return httpx.Response(next(answers))
    ev = {"id": "evt_5", "type": "analysis.completed", "created": 1, "data": {}}
    status, error = await wh.deliver(ep_id, ev, retries=(0, 0, 0, 0), transport=httpx.MockTransport(handler), resolver=public)
    assert (status, error) == (200, None)
    assert seen == ["evt_5"] * 3                                                       # same delivery id on every retry
    assert state(ep_id) == (200, None, 0, True)


async def test_a_permanent_rejection_is_not_retried(endpoint):
    _, ep_id = endpoint
    calls = []
    ev = {"id": "evt_6", "type": "analysis.completed", "created": 1, "data": {}}
    status, error = await wh.deliver(ep_id, ev, retries=(0, 0, 0, 0), resolver=public,
                                     transport=httpx.MockTransport(lambda r: calls.append(1) or httpx.Response(404)))
    assert status == 404 and len(calls) == 1
    assert state(ep_id)[:3] == (404, "The receiver answered HTTP 404.", 1)
    # 429 and 5xx are retried
    calls.clear()
    await wh.deliver(ep_id, ev, retries=(0, 0, 0), resolver=public, transport=httpx.MockTransport(lambda r: calls.append(1) or httpx.Response(429)))
    assert len(calls) == 3


async def test_an_endpoint_that_keeps_failing_is_switched_off(endpoint):
    _, ep_id = endpoint
    db = SessionLocal()
    db.query(WebhookEndpoint).filter(WebhookEndpoint.id == ep_id).update({"consecutive_failures": wh.DISABLE_AFTER - 1})
    db.commit()
    db.close()
    ev = {"id": "evt_7", "type": "analysis.completed", "created": 1, "data": {}}
    await wh.deliver(ep_id, ev, retries=(0,), resolver=public, transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    status, error, failures, active = state(ep_id)
    assert active is False and failures == wh.DISABLE_AFTER and "Switched off" in error
    # once off, nothing more is sent
    sent = []
    r = await wh.deliver(ep_id, ev, retries=(0,), resolver=public, transport=httpx.MockTransport(lambda req: sent.append(1) or httpx.Response(200)))
    assert sent == [] and r[1] == "endpoint missing or switched off"


# ───────────────────────────── which jobs fire ─────────────────────────────
async def test_notify_job_sends_the_right_event_only_to_owners_with_an_active_endpoint(endpoint, monkeypatch):
    uid, ep_id = endpoint
    sent = []

    async def fake_deliver(endpoint_id, event, **kw):
        sent.append((endpoint_id, event["type"], event["data"]["job_id"]))
        return 200, None
    monkeypatch.setattr(wh, "deliver", fake_deliver)

    db = SessionLocal()
    db.add_all([
        Job(id="wh-done", user_id=uid, status="completed", file_name="a.wav", result={"title": "T", "bpm": 120}),
        Job(id="wh-err", user_id=uid, status="error", file_name="b.wav", error="boom"),
        Job(id="wh-busy", user_id=uid, status="processing", file_name="c.wav"),
        Job(id="wh-anon", user_id=None, status="completed", file_name="d.wav", result={}),
    ])
    db.commit()
    db.close()
    for jid in ("wh-done", "wh-err", "wh-busy", "wh-anon", "wh-missing"):
        await wh.notify_job(jid)
    assert sent == [(ep_id, "analysis.completed", "wh-done"), (ep_id, "analysis.failed", "wh-err")]

    sent.clear()
    db = SessionLocal()
    db.query(WebhookEndpoint).filter(WebhookEndpoint.id == ep_id).update({"is_active": False})
    db.commit()
    db.close()
    await wh.notify_job("wh-done")
    assert sent == []                                                                  # switched off: silence
    db = SessionLocal()
    db.query(Job).filter(Job.id.in_(["wh-done", "wh-err", "wh-busy", "wh-anon"])).delete(synchronize_session=False)
    db.commit()
    db.close()


# ───────────────────────────── the API (own mini app: no need to import the whole engine) ─────────────────────────────
from types import SimpleNamespace  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.routes.outbound_webhooks import router as wh_router  # noqa: E402  (importing the route package first keeps app.dependencies' import order as in production)
from app.dependencies import get_current_user_optional  # noqa: E402


@pytest.fixture()
def api(endpoint, monkeypatch):
    uid, _ = endpoint
    db = SessionLocal()
    db.query(WebhookEndpoint).filter(WebhookEndpoint.user_id == uid).delete()      # start without a webhook
    db.commit()
    db.close()
    monkeypatch.setattr(wh, "_resolve", lambda host, port: [PUBLIC_IP])
    app = FastAPI()
    app.include_router(wh_router, prefix="/api")
    app.dependency_overrides[get_current_user_optional] = lambda: SimpleNamespace(id=uid)
    return app, uid


def test_api_needs_a_signed_in_user():
    app = FastAPI()
    app.include_router(wh_router, prefix="/api")
    app.dependency_overrides[get_current_user_optional] = lambda: None
    assert TestClient(app).get("/api/webhook-endpoint").status_code == 401


def test_api_set_get_rotate_test_delete(api, monkeypatch):
    app, uid = api
    c = TestClient(app)
    assert c.get("/api/webhook-endpoint").json() == {"configured": False, "events": ["analysis.completed", "analysis.failed"]}

    bad = c.put("/api/webhook-endpoint", json={"url": "http://hooks.example.com/in"})
    assert bad.status_code == 400 and "https" in bad.json()["detail"]
    monkeypatch.setattr(wh, "_resolve", lambda host, port: ["10.0.0.9"])
    assert c.put("/api/webhook-endpoint", json={"url": "https://hooks.example.com/in"}).status_code == 400
    monkeypatch.setattr(wh, "_resolve", lambda host, port: [PUBLIC_IP])

    made = c.put("/api/webhook-endpoint", json={"url": "https://hooks.example.com/in"})
    assert made.status_code == 200 and made.json()["secret"].startswith("whsec_") and made.json()["active"] is True
    secret = made.json()["secret"]

    got = c.get("/api/webhook-endpoint").json()
    assert got["configured"] and got["url"] == "https://hooks.example.com/in" and "secret" not in got       # shown once, never again

    changed = c.put("/api/webhook-endpoint", json={"url": "https://hooks.example.com/v2"}).json()
    assert changed["url"] == "https://hooks.example.com/v2" and "secret" not in changed
    db = SessionLocal()
    assert db.query(WebhookEndpoint).filter(WebhookEndpoint.user_id == uid).one().secret == secret          # the URL change kept the secret
    db.close()

    rotated = c.post("/api/webhook-endpoint/rotate-secret").json()
    assert rotated["secret"].startswith("whsec_") and rotated["secret"] != secret

    async def fake_deliver(endpoint_id, event, **kw):
        assert event["type"] == "webhook.test"
        return 200, None
    monkeypatch.setattr(wh, "deliver", fake_deliver)
    assert c.post("/api/webhook-endpoint/test").json() == {"delivered": True, "status": 200, "error": None}

    assert c.delete("/api/webhook-endpoint").json() == {"configured": False}
    assert c.get("/api/webhook-endpoint").json()["configured"] is False
    assert c.post("/api/webhook-endpoint/rotate-secret").status_code == 404
    assert c.post("/api/webhook-endpoint/test").status_code == 404


def test_api_a_changed_url_switches_a_dead_endpoint_back_on(api):
    app, uid = api
    c = TestClient(app)
    c.put("/api/webhook-endpoint", json={"url": "https://hooks.example.com/in"})
    db = SessionLocal()
    db.query(WebhookEndpoint).filter(WebhookEndpoint.user_id == uid).update({"is_active": False, "consecutive_failures": 20, "last_error": "Switched off"})
    db.commit()
    db.close()
    assert c.get("/api/webhook-endpoint").json()["active"] is False
    back = c.put("/api/webhook-endpoint", json={"url": "https://hooks.example.com/in"}).json()
    assert back["active"] is True and back["consecutive_failures"] == 0 and back["last_error"] is None
