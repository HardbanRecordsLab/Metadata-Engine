"""Stripe Checkout for credit packs."""
from __future__ import annotations

import logging
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db import CreditPurchase, User, get_db
from app.routes.auth import get_current_user
from app.services.stripe_billing import (
    CREDIT_PACKS,
    init_stripe,
    pack_to_public_dict,
    stripe_configured,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])

PackId = Literal["starter", "producer", "label", "studio"]


class CheckoutRequest(BaseModel):
    pack_id: PackId


@router.get("/packs")
async def list_credit_packs():
    """Public catalog of credit packs (Stripe Price IDs configured via env)."""
    return {
        "packs": [pack_to_public_dict(p) for p in CREDIT_PACKS.values()],
        "stripe_enabled": stripe_configured(),
        "currency": "usd",
    }


@router.get("/history")
async def credit_purchase_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The current user's own real Stripe credit-pack purchases."""
    purchases = (
        db.query(CreditPurchase)
        .filter(CreditPurchase.user_id == str(current_user.id))
        .order_by(CreditPurchase.created_at.desc())
        .all()
    )
    return {
        "purchases": [
            {
                "id": p.stripe_session_id,
                "pack_id": p.pack_id,
                "credits_added": p.credits_added,
                "amount_total": p.amount_total,
                "currency": p.currency,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in purchases
        ]
    }


@router.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
):
    """Create Stripe Checkout Session (one-time payment)."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Payments are not configured. Add STRIPE_SECRET_KEY and pack Price IDs on the server.",
        )

    pack = CREDIT_PACKS.get(body.pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail="Unknown credit pack")

    price_id = pack.stripe_price_id
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe price not configured for pack '{pack.id}'. Set {pack.env_price_key} in .env",
        )

    success_url = settings.STRIPE_SUCCESS_URL or (
        "https://app-metadata.hardbanrecordslab.online/?billing=success&session_id={CHECKOUT_SESSION_ID}"
    )
    cancel_url = settings.STRIPE_CANCEL_URL or (
        "https://app-metadata.hardbanrecordslab.online/?billing=cancelled"
    )

    try:
        init_stripe()
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=current_user.email,
            client_reference_id=str(current_user.id),
            metadata={
                "user_id": str(current_user.id),
                "pack_id": pack.id,
                "credits": str(pack.credits),
            },
        )
    except stripe.StripeError as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(status_code=502, detail="Could not create checkout session") from e

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe webhook: add credits after successful checkout."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload") from e
    except stripe.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature") from e

    if event["type"] != "checkout.session.completed":
        return {"status": "ignored", "type": event["type"]}

    session = event["data"]["object"]
    if session.get("payment_status") != "paid":
        return {"status": "ignored", "reason": "not paid"}

    session_id = session.get("id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session id")

    existing = (
        db.query(CreditPurchase)
        .filter(CreditPurchase.stripe_session_id == session_id)
        .first()
    )
    if existing:
        return {"status": "already_processed", "session_id": session_id}

    metadata = session.get("metadata") or {}
    user_id = metadata.get("user_id") or session.get("client_reference_id")
    pack_id = metadata.get("pack_id", "starter")

    try:
        credits_to_add = int(metadata.get("credits") or 0)
    except (TypeError, ValueError):
        credits_to_add = 0

    if credits_to_add <= 0:
        pack = CREDIT_PACKS.get(pack_id)
        credits_to_add = pack.credits if pack else 0

    if not user_id or credits_to_add <= 0:
        logger.error("Webhook missing user_id or credits: %s", metadata)
        raise HTTPException(status_code=400, detail="Invalid session metadata")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning("Stripe webhook: user %s not found", user_id)
        raise HTTPException(status_code=404, detail="User not found")

    user.credits = (user.credits or 0) + credits_to_add
    if pack_id in CREDIT_PACKS:
        user.tier = pack_id
    if pack_id in ("label", "studio"):
        user.is_premium = True

    purchase = CreditPurchase(
        stripe_session_id=session_id,
        user_id=str(user_id),
        pack_id=pack_id,
        credits_added=credits_to_add,
        amount_total=session.get("amount_total"),
        currency=session.get("currency"),
    )
    db.add(purchase)
    db.commit()

    logger.info(
        "Stripe: added %s credits to user %s (pack=%s, session=%s)",
        credits_to_add,
        user_id,
        pack_id,
        session_id,
    )
    return {"status": "success", "credits_added": credits_to_add, "user_id": user_id}
