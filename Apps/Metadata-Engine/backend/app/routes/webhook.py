import hmac
import hashlib
import json
from fastapi import APIRouter, Request, HTTPException, status
from app.config import settings
from app.db import SessionLocal, User
import logging

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = logging.getLogger(__name__)

# Plan to Credit Mapping
PLAN_CREDITS = {
    "Hobby": 50,
    "Basic": 120,
    "Pro": 260,
    "Studio": 2000
}

@router.post("/lemonsqueezy")
async def lemonsqueezy_webhook(request: Request):
    """
    Handles Lemon Squeezy webhooks for payment success.
    Updates user quota in local DB.
    """
    if not settings.LEMONSQUEEZY_WEBHOOK_SECRET:
        logger.error("Lemon Squeezy Webhook Secret not configured.")
        raise HTTPException(status_code=500, detail="Webhook configuration error")

    # 1. Verify Signature
    try:
        payload = await request.body()
        signature = request.headers.get("X-Signature")
        
        if not signature:
            raise HTTPException(status_code=401, detail="No signature provided")

        digest = hmac.new(
            settings.LEMONSQUEEZY_WEBHOOK_SECRET.encode("utf-8"),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            logger.warning("Invalid webhook signature")
            raise HTTPException(status_code=401, detail="Invalid signature")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying signature: {e}")
        raise HTTPException(status_code=400, detail="Signature verification failed")

    # 2. Process Payload
    try:
        data = json.loads(payload)
        event_name = data.get("meta", {}).get("event_name")
        
        if event_name != "order_created":
            # We currently only care about new orders. 
            # Subscriptions (subscription_created, subscription_updated) would be next step.
            return {"status": "ignored", "reason": f"Event {event_name} not handled"}

        # 3. Extract User Info
        custom_data = data.get("meta", {}).get("custom_data", {})
        user_id = custom_data.get("user_id")
        
        if not user_id:
            logger.warning("Webhook received without user_id in custom_data")
            return {"status": "error", "reason": "No user_id provided"}

        # 4. Determine Plan and Credits
        attributes = data.get("data", {}).get("attributes", {})
        first_item = attributes.get("first_order_item", {})
        variant_name = first_item.get("variant_name", "Basic") # Fallback
        
        # Match variant name to plan credits (fuzzy match or exact)
        credits_to_add = 10 # Default fallback
        plan_name = "Unknown"
        
        for plan, credits in PLAN_CREDITS.items():
            if plan.lower() in variant_name.lower():
                credits_to_add = credits
                plan_name = plan
                break
        
        logger.info(f"Processing order for User {user_id}: Plan {plan_name} ({credits_to_add} credits)")

        # 5. Update Local DB
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found in database.")
                # We return 200 to acknowledge webhook, but log error
                return {"status": "error", "reason": "User not found"}
            
            # Update tier and credits
            user.tier = plan_name.lower()
            # If user has existing credits, add to them? Or reset?
            # Usually add.
            current_credits = user.credits if user.credits is not None else 0
            user.credits = current_credits + credits_to_add
            
            db.commit()
            logger.info(f"Updated user {user_id}: +{credits_to_add} credits, tier {plan_name}")
            
        except Exception as e:
            logger.error(f"Database error updating quota: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail="Database error")
        finally:
            db.close()
            
        return {"status": "success", "credits_added": credits_to_add, "new_tier": plan_name}

    except Exception as e:
        logger.error(f"Error processing webhook payload: {e}")
        raise HTTPException(status_code=500, detail="Processing error")
