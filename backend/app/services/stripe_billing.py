"""Stripe credit packs (one-time payments, no subscriptions)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import stripe

from app.config import settings


@dataclass(frozen=True)
class CreditPack:
    id: str
    name: str
    credits: int
    price_usd: int
    description: str
    popular: bool = False
    env_price_key: str = ""

    @property
    def stripe_price_id(self) -> Optional[str]:
        return os.getenv(self.env_price_key) if self.env_price_key else None


CREDIT_PACKS: dict[str, CreditPack] = {
    "starter": CreditPack(
        id="starter",
        name="Starter Pack",
        credits=10,
        price_usd=9,
        description="Try the engine on a small batch.",
        env_price_key="STRIPE_PRICE_PACK_STARTER",
    ),
    "producer": CreditPack(
        id="producer",
        name="Producer Pack",
        credits=50,
        price_usd=35,
        description="For active producers releasing regularly.",
        popular=True,
        env_price_key="STRIPE_PRICE_PACK_PRODUCER",
    ),
    "label": CreditPack(
        id="label",
        name="Label Pack",
        credits=150,
        price_usd=89,
        description="EPs, albums, and catalog work.",
        env_price_key="STRIPE_PRICE_PACK_LABEL",
    ),
    "studio": CreditPack(
        id="studio",
        name="Studio Pack",
        credits=400,
        price_usd=199,
        description="High volume for labels and agencies.",
        env_price_key="STRIPE_PRICE_PACK_STUDIO",
    ),
}


def stripe_configured() -> bool:
    return bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_WEBHOOK_SECRET)


def init_stripe() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY


def pack_to_public_dict(pack: CreditPack) -> dict:
    return {
        "id": pack.id,
        "name": pack.name,
        "credits": pack.credits,
        "price_usd": pack.price_usd,
        "description": pack.description,
        "popular": pack.popular,
        "available": bool(pack.stripe_price_id),
    }
