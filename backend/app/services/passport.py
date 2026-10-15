"""Metadata Passport: an Ed25519-signed, machine-verifiable statement of what the engine concluded about a track.

The passport binds the audio's SHA-256 to the key metadata claims, the trust grade and the engine version. Anyone holding
the public key (``GET /api/passport/public-key``) can verify it offline; editing a single claim breaks the signature.
It complements the existing certificate / IPFS pin: the certificate proves *when*, the passport proves *what and how sure*.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

logger = logging.getLogger(__name__)

ENGINE_NAME = "HardbanRecords Metadata Engine"
ENGINE_VERSION = "3.0"
KEY_FILE = os.getenv("PASSPORT_KEY_FILE", "/data/passport_ed25519.key")
_lock = threading.Lock()
_key: Optional[Ed25519PrivateKey] = None

CLAIM_FIELDS = ("title", "artist", "album", "albumArtist", "mainGenre", "additionalGenres", "bpm", "key", "mode",
                "energyLevel", "hasVocals", "moods", "publisher", "isrc", "duration", "language")


def _raw_private(key: Ed25519PrivateKey) -> bytes:
    return key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())


def _raw_public(pub: Ed25519PublicKey) -> bytes:
    return pub.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def _get_key() -> Ed25519PrivateKey:
    """Env PASSPORT_PRIVATE_KEY (base64, 32 bytes) wins; else a key file on the persistent volume; else generate once."""
    global _key
    if _key is not None:
        return _key
    with _lock:
        if _key is not None:
            return _key
        env = os.getenv("PASSPORT_PRIVATE_KEY", "").strip()
        if env:
            _key = Ed25519PrivateKey.from_private_bytes(base64.b64decode(env))
        elif os.path.exists(KEY_FILE):
            _key = Ed25519PrivateKey.from_private_bytes(base64.b64decode(open(KEY_FILE).read().strip()))
        else:
            _key = Ed25519PrivateKey.generate()
            try:
                os.makedirs(os.path.dirname(KEY_FILE), exist_ok=True)
                fd = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w") as f:
                    f.write(base64.b64encode(_raw_private(_key)).decode())
                logger.info("Passport signing key created at %s", KEY_FILE)
            except OSError as e:  # unwritable volume: keep an in-memory key, passports are still valid until restart
                logger.warning("Passport key not persisted (%s) - signatures will not survive a restart", e)
        return _key


def use_key_for_tests(key: Optional[Ed25519PrivateKey]) -> None:
    global _key
    _key = key


def public_key_b64() -> str:
    return base64.b64encode(_raw_public(_get_key().public_key())).decode()


def key_id(pub_b64: Optional[str] = None) -> str:
    return hashlib.sha256(base64.b64decode(pub_b64 or public_key_b64())).hexdigest()[:16]


def canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _claims(result: Dict[str, Any]) -> Dict[str, Any]:
    claims: Dict[str, Any] = {}
    for f in CLAIM_FIELDS:
        v = result.get(f)
        if v in (None, "", [], {}):
            continue
        if isinstance(v, float):
            v = round(v, 2)
        if f in ("moods", "additionalGenres") and isinstance(v, list):
            v = sorted(str(x) for x in v)
        claims[f] = v
    return claims


def build_passport(result: Dict[str, Any], trust: Optional[Dict[str, Any]] = None, hearing_model: Optional[str] = None,
                   issued_at: Optional[str] = None) -> Dict[str, Any]:
    payload = {
        "v": 1,
        "sha256": result.get("sha256"),
        "claims": _claims(result),
        "trust": {k: trust.get(k) for k in ("score", "grade", "needsReview", "flags")} if trust else None,
        "engine": {"name": ENGINE_NAME, "version": ENGINE_VERSION, "analysis": result.get("analysisVersion"),
                   "hearingModel": hearing_model},
        "issuedAt": issued_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    sig = _get_key().sign(canonical(payload))
    return {"alg": "Ed25519", "keyId": key_id(), "payload": payload, "signature": base64.b64encode(sig).decode()}


def verify_passport(passport: Dict[str, Any], public_key: Optional[str] = None) -> Dict[str, Any]:
    """Offline-style verification. Uses the supplied public key (base64) or this engine's own."""
    try:
        pub_b64 = public_key or public_key_b64()
        pub = Ed25519PublicKey.from_public_bytes(base64.b64decode(pub_b64))
        if passport.get("alg") != "Ed25519":
            return {"valid": False, "reason": "unsupported algorithm"}
        if passport.get("keyId") and passport["keyId"] != key_id(pub_b64):
            return {"valid": False, "reason": "signed with a different key"}
        pub.verify(base64.b64decode(passport["signature"]), canonical(passport["payload"]))
        p = passport["payload"]
        return {"valid": True, "sha256": p.get("sha256"), "issuedAt": p.get("issuedAt"), "engine": p.get("engine"),
                "trust": p.get("trust"), "keyId": key_id(pub_b64)}
    except (InvalidSignature, KeyError, ValueError, TypeError):
        return {"valid": False, "reason": "signature does not match the payload"}
