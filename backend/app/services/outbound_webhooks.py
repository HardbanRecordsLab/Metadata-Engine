"""Outbound webhooks: tell a customer's own server when an analysis has finished, so pipelines need not poll.

One endpoint per account. Each delivery is a signed JSON POST:

    X-HRL-Event:      analysis.completed | analysis.failed | webhook.test
    X-HRL-Delivery:   unique id of this delivery (same across retries)
    X-HRL-Signature:  t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the endpoint secret>

The URL is customer-supplied, so it is the classic server-side-request-forgery door: only https, no credentials in the URL, and
every address the host resolves to must be public. The connection is made to the resolved IP (Host header and TLS server name
keep the real host), so a DNS answer that changes between the check and the request cannot redirect it inside our network.
Redirects are never followed. See docs/WEBHOOKS.md for how a receiver verifies the signature.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import ipaddress
import json
import logging
import os
import secrets
import socket
import time
import uuid
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlsplit

import httpx

logger = logging.getLogger("app.webhooks")

EVENTS = ("analysis.completed", "analysis.failed")
MAX_URL_LEN = 2048
TIMEOUT_S = 10.0
#: seconds to wait before attempt 1, 2, 3, 4 (a receiver that is down for a minute still gets the event)
RETRY_DELAYS: Tuple[float, ...] = (0.0, 2.0, 10.0, 60.0)
#: after this many failed deliveries in a row the endpoint is switched off (the owner sees why and can switch it back on)
DISABLE_AFTER = 20

Resolver = Callable[[str, int], List[str]]


def _resolve(host: str, port: int) -> List[str]:
    return sorted({ai[4][0] for ai in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)})


def is_public_ip(ip: str) -> bool:
    a = ipaddress.ip_address(ip)
    if isinstance(a, ipaddress.IPv6Address) and a.ipv4_mapped:
        a = a.ipv4_mapped
    return a.is_global and not a.is_multicast          # is_global also rules out carrier-grade NAT (100.64/10), documentation and reserved ranges


def check_url(url: str, resolver: Optional[Resolver] = None) -> Tuple[str, int, List[str]]:
    """Validate a webhook URL; returns (host, port, public IPs). Raises ValueError with a message safe to show the user."""
    if not url or len(url) > MAX_URL_LEN:
        raise ValueError("The URL is empty or longer than %d characters." % MAX_URL_LEN)
    parts = urlsplit(url.strip())
    if parts.scheme != "https":
        raise ValueError("Only https:// URLs are accepted.")
    if not parts.hostname:
        raise ValueError("The URL has no host.")
    if parts.username or parts.password:
        raise ValueError("Credentials inside the URL are not accepted; use the signature to authenticate us.")
    try:
        port = parts.port or 443
    except ValueError:
        raise ValueError("The URL has an invalid port.")
    try:
        ips = (resolver or _resolve)(parts.hostname, port)
    except OSError:
        raise ValueError("The host name does not resolve.")
    if not ips:
        raise ValueError("The host name does not resolve.")
    if not all(is_public_ip(ip) for ip in ips):
        raise ValueError("The host resolves to a private or internal address, which is not allowed.")
    return parts.hostname, port, ips


def new_secret() -> str:
    return "whsec_" + secrets.token_hex(24)


def sign(secret: str, body: bytes, timestamp: Optional[int] = None) -> str:
    t = int(time.time()) if timestamp is None else int(timestamp)
    mac = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={t},v1={mac}"


def verify_signature(secret: str, body: bytes, header: str, tolerance_s: int = 300, now: Optional[float] = None) -> bool:
    """What a receiver does (kept here so it is tested against the sender and documented by example)."""
    try:
        fields = dict(p.split("=", 1) for p in header.split(","))
        t = int(fields["t"])
        given = fields["v1"]
    except (KeyError, ValueError):
        return False
    if abs((time.time() if now is None else now) - t) > tolerance_s:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, given)


def _summary(result: Dict[str, Any]) -> Dict[str, Any]:
    trust = result.get("trust") or {}
    sync = result.get("syncReadiness") or {}
    return {
        "title": result.get("title"), "artist": result.get("artist"), "bpm": result.get("bpm"), "key": result.get("key"),
        "mainGenre": result.get("mainGenre"), "hasVocals": result.get("hasVocals"),
        "trustGrade": trust.get("grade"), "needsReview": trust.get("needsReview"),
        "syncReadinessScore": sync.get("score"), "sha256": result.get("sha256"),
    }


def build_event(event_type: str, job: Any, api_base: str) -> Dict[str, Any]:
    data: Dict[str, Any] = {"job_id": job.id, "file_name": job.file_name, "status": job.status}
    if event_type == "analysis.completed" and isinstance(job.result, dict):
        data["summary"] = _summary(job.result)
        data["result_url"] = f"{api_base.rstrip('/')}/analysis/job/{job.id}"
    elif event_type == "analysis.failed":
        data["error"] = (job.error or "Analysis failed")[:300]
    return {"id": "evt_" + uuid.uuid4().hex, "type": event_type, "created": int(time.time()), "data": data}


async def attempt_delivery(url: str, secret: str, event: Dict[str, Any], *, resolver: Optional[Resolver] = None,
                           transport: Optional[httpx.AsyncBaseTransport] = None) -> Tuple[Optional[int], Optional[str]]:
    """One POST. Returns (http status or None, error text or None); 2xx counts as delivered."""
    try:
        host, port, ips = check_url(url, resolver)
    except ValueError as e:
        return None, str(e)
    body = json.dumps(event, separators=(",", ":"), ensure_ascii=False).encode()
    parts = urlsplit(url)
    ip = ips[0]
    netloc = f"[{ip}]" if ":" in ip else ip
    if port != 443:
        netloc += f":{port}"
    pinned = f"https://{netloc}{parts.path or '/'}" + (f"?{parts.query}" if parts.query else "")
    headers = {
        "Content-Type": "application/json", "User-Agent": "HRL-Metadata-Engine-Webhooks/1", "Host": host if port == 443 else f"{host}:{port}",
        "X-HRL-Event": event["type"], "X-HRL-Delivery": event["id"], "X-HRL-Signature": sign(secret, body),
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S, follow_redirects=False, transport=transport) as client:
            r = await client.post(pinned, content=body, headers=headers, extensions={"sni_hostname": host})
        return r.status_code, (None if 200 <= r.status_code < 300 else f"The receiver answered HTTP {r.status_code}.")
    except httpx.HTTPError as e:
        return None, f"{type(e).__name__}: {str(e)[:150]}"


def _record(endpoint_id: str, status: Optional[int], error: Optional[str]) -> None:
    from app.db import SessionLocal, WebhookEndpoint
    db = SessionLocal()
    try:
        ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == endpoint_id).first()
        if not ep:
            return
        ep.last_attempt_at = datetime.utcnow()
        ep.last_status = status
        ep.last_error = error
        if error is None:
            ep.consecutive_failures = 0
        else:
            ep.consecutive_failures = (ep.consecutive_failures or 0) + 1
            if ep.consecutive_failures >= DISABLE_AFTER:
                ep.is_active = False
                ep.last_error = f"Switched off after {DISABLE_AFTER} failed deliveries in a row. Last error: {error}"
        db.commit()
    finally:
        db.close()


async def deliver(endpoint_id: str, event: Dict[str, Any], *, retries: Tuple[float, ...] = RETRY_DELAYS,
                  transport: Optional[httpx.AsyncBaseTransport] = None, resolver: Optional[Resolver] = None) -> Tuple[Optional[int], Optional[str]]:
    """Send with retries and record the outcome on the endpoint. Returns the last (status, error)."""
    from app.db import SessionLocal, WebhookEndpoint
    status, error = None, "not attempted"
    for delay in retries:
        if delay:
            await asyncio.sleep(delay)
        db = SessionLocal()
        try:
            ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == endpoint_id).first()
            if not ep or not ep.is_active:
                return None, "endpoint missing or switched off"
            url, secret = ep.url, ep.secret
        finally:
            db.close()
        status, error = await attempt_delivery(url, secret, event, transport=transport, resolver=resolver)
        if error is None:
            break
        if status is not None and 400 <= status < 500 and status not in (408, 425, 429):
            break                                   # the receiver rejected it for good; retrying the same request will not help
    _record(endpoint_id, status, error)
    return status, error


_tasks: set = set()


async def notify_job(job_id: str, api_base: str = "https://metadata.hardbanrecordslab.online/api") -> None:
    """Fire the event for a finished job, if its owner has a webhook. Never raises."""
    try:
        from app.db import SessionLocal, Job, WebhookEndpoint
        db = SessionLocal()
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job or not job.user_id:
                return
            ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.user_id == job.user_id, WebhookEndpoint.is_active.is_(True)).first()
            if not ep:
                return
            etype = "analysis.completed" if job.status == "completed" else "analysis.failed" if job.status == "error" else None
            if not etype:
                return
            event, endpoint_id = build_event(etype, job, api_base), ep.id
        finally:
            db.close()
        await deliver(endpoint_id, event)
    except Exception as e:  # noqa: BLE001
        logger.warning("webhook notify failed for job %s: %s", job_id, e)


def fire(job_id: str) -> None:
    """Schedule notify_job without waiting for it (called from the analysis task right after the job is saved)."""
    if os.getenv("WEBHOOKS_DISABLED") == "1":
        return
    try:
        task = asyncio.get_running_loop().create_task(notify_job(job_id))
        _tasks.add(task)
        task.add_done_callback(_tasks.discard)
    except RuntimeError:
        pass
