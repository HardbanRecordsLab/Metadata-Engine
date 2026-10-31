"""Client of HRL Wallet: one account and one credits balance shared with the other HRL apps (MasteringPro, ...).

Server-to-server with this app's bearer token. With WALLET_ENABLED off (the default) nothing here is used and credits stay in the local `users` table.
Every call is synchronous and short (a few ms on the shared docker network); async routes run it through asyncio.to_thread.
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class WalletError(Exception):
    def __init__(self, status: int, code: str, message: str = "", payload: dict | None = None):
        super().__init__(message or code)
        self.status, self.code, self.message, self.payload = status, code, message, payload or {}


class WalletUnavailable(WalletError):
    """The wallet did not answer (down, timeout, 5xx). Callers refuse the action instead of guessing a balance."""


def enabled() -> bool:
    return bool(settings.WALLET_ENABLED and settings.WALLET_URL and settings.WALLET_TOKEN)


def _call(method: str, path: str, *, json: dict | None = None, params: dict | None = None) -> dict:
    try:
        r = httpx.request(
            method, settings.WALLET_URL.rstrip("/") + path, json=json, params=params,
            headers={"Authorization": "Bearer " + settings.WALLET_TOKEN}, timeout=httpx.Timeout(8.0, connect=3.0),
        )
    except httpx.HTTPError as exc:
        logger.error("wallet unreachable: %s", exc)
        raise WalletUnavailable(503, "wallet_unavailable", "HRL Wallet is not reachable") from exc
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code >= 500:
        logger.error("wallet answered %s on %s %s", r.status_code, method, path)
        raise WalletUnavailable(503, "wallet_unavailable", f"HRL Wallet answered {r.status_code}", data)
    if r.status_code >= 400:
        raise WalletError(r.status_code, str(data.get("error") or "error"), str(data.get("message") or data.get("detail") or ""), data)
    return data


def register(email: str, password: str) -> dict:
    return _call("POST", "/v1/accounts/register", json={"email": email, "password": password})


def login(email: str, password: str) -> dict:
    return _call("POST", "/v1/accounts/login", json={"email": email, "password": password})


def change_password(account_id: str, old: str, new: str) -> dict:
    return _call("POST", "/v1/accounts/password", json={"account_id": account_id, "old_password": old, "new_password": new})


def set_password(account_id: str, new: str) -> dict:
    return _call("POST", "/v1/accounts/set-password", json={"account_id": account_id, "new_password": new})


def unlink(account_id: str, password: str) -> dict:
    return _call("POST", "/v1/accounts/unlink", json={"account_id": account_id, "password": password})


def balance(account_id: str) -> dict:
    return _call("GET", f"/v1/wallet/{account_id}/balance")


def charge(account_id: str, key: str, units: int = 1) -> dict:
    """One analysis = one credit. `key` makes a retried call charge once."""
    return _call("POST", "/v1/wallet/charge", json={"account_id": account_id, "product": "analysis", "idempotency_key": key, "units": units})


def redeem(account_id: str, code: str) -> dict:
    return _call("POST", "/v1/wallet/redeem", json={"account_id": account_id, "code": code})


def purchases(account_id: str) -> list[dict]:
    return _call("GET", f"/v1/wallet/{account_id}/purchases").get("purchases", [])


def checkout(account_id: str, pack_id: str, success_url: str, cancel_url: str, lang: str) -> dict:
    return _call("POST", "/v1/checkout", json={"account_id": account_id, "pack_id": pack_id, "success_url": success_url, "cancel_url": cancel_url, "lang": lang})
