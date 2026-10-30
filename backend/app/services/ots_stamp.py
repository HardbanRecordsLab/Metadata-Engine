"""Public timestamps for passports, with OpenTimestamps (free, anchored in Bitcoin).

The passport already says WHAT the engine concluded and is signed by us; `issuedAt` inside it is only our own claim. A timestamp proves
from the outside that exactly this passport existed no later than a given moment, without trusting us: the SHA-256 of the signed
passport is sent to public calendar servers, which aggregate many digests into a Bitcoin transaction. Only a hash leaves the server.

We hand back `.ots` files in the standard format. They start out PENDING (a calendar has promised to include the digest); after a few
hours the owner runs `ots upgrade file.ots` (official client, https://opentimestamps.org) and the file then carries the Bitcoin block
attestation and can be checked with `ots verify` without us. Several calendars are asked and each answer is its own file, so one dead
calendar does not lose the proof.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
from typing import Any, Dict, List, Optional

import httpx

from app.services import passport as passport_mod

HEADER_MAGIC = b"\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
MAJOR_VERSION = 1
OP_SHA256 = 0x08
CALENDARS = (
    "https://alice.btc.calendar.opentimestamps.org",
    "https://bob.btc.calendar.opentimestamps.org",
    "https://finney.calendar.eternitywall.com",
)
TIMEOUT_S = 15.0
MAX_RESPONSE = 10_000


def passport_digest(passport: Dict[str, Any]) -> bytes:
    """SHA-256 of the whole signed passport (payload and signature) in the same canonical form the signature uses."""
    return hashlib.sha256(passport_mod.canonical(passport)).digest()


def build_ots(digest: bytes, calendar_response: bytes) -> bytes:
    """A detached timestamp file: magic, version, the hash operation, the file digest, then the calendar's timestamp tree."""
    if len(digest) != 32:
        raise ValueError("a SHA-256 digest is 32 bytes")
    return HEADER_MAGIC + bytes([MAJOR_VERSION, OP_SHA256]) + digest + calendar_response


def ots_digest(ots: bytes) -> Optional[bytes]:
    """The digest a `.ots` file was made for, or None when it is not an OpenTimestamps file."""
    n = len(HEADER_MAGIC)
    if not ots.startswith(HEADER_MAGIC) or len(ots) < n + 2 + 32 + 1:
        return None
    if ots[n] != MAJOR_VERSION or ots[n + 1] != OP_SHA256:
        return None
    return bytes(ots[n + 2:n + 2 + 32])


async def _ask(client: httpx.AsyncClient, calendar: str, digest: bytes) -> Optional[Dict[str, str]]:
    try:
        r = await client.post(f"{calendar}/digest", content=digest,
                              headers={"Accept": "application/vnd.opentimestamps.v1", "Content-Type": "application/x-www-form-urlencoded",
                                       "User-Agent": "HRL-Metadata-Engine/3.0"})
    except httpx.HTTPError:
        return None
    if r.status_code != 200 or not r.content or len(r.content) > MAX_RESPONSE:
        return None
    return {"calendar": calendar, "file": "passport.ots", "ots_b64": base64.b64encode(build_ots(digest, r.content)).decode()}


async def submit(passport: Dict[str, Any], calendars: tuple = CALENDARS, transport: Optional[httpx.AsyncBaseTransport] = None) -> Dict[str, Any]:
    digest = passport_digest(passport)
    async with httpx.AsyncClient(timeout=TIMEOUT_S, follow_redirects=False, transport=transport) as client:
        answers = await asyncio.gather(*[_ask(client, c, digest) for c in calendars])
    stamps = [a for a in answers if a]
    return {
        "digest": digest.hex(), "algorithm": "sha256", "of": "the whole signed passport as canonical JSON (sorted keys, no spaces, UTF-8)",
        "status": "pending" if stamps else "unavailable",
        "stamps": stamps,
        "next": ("Save every .ots file next to the passport. After a few hours run `ots upgrade <file>` (official OpenTimestamps client) "
                 "to add the Bitcoin attestation, then `ots verify <file>` checks it without trusting us.") if stamps else
                "No calendar answered; try again later.",
    }
