import hmac
import hashlib
import json
from fastapi import APIRouter, Request, HTTPException, status
from app.config import settings
from app.supabase_client import supabase_admin
import logging

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = logging.getLogger(__name__)

# Plan to Credit Mapping
PLAN_CREDITS = {
    "Hobby": 50,
    "Basic": 150,
    "Pro": 500,
    "Studio": 2000
}

@router.post("/lemonsqueezy")
async def lemonsqueezy_webhook(request: Request):
    """
    Handles Lemon Squeezy webhooks for payment success.
    Updates user quota in Supabase.
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

        # 5. Update Supabase
        if not supabase_admin:
            logger.error("Supabase Admin client missing. Cannot update quota.")
            raise HTTPException(status_code=500, detail="Database configuration error")

        # Get current user metadata
        user_resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        current_meta = user_resp.user.user_metadata or {}
        
        # Update limit (set new limit) and reset count (optional, or keep count)
        # Decision: Buying a plan sets the LIMIT for the period.
        # Assuming monthly subscription model where limit is "per month" or "total credits"?
        # For now: We SET the analysis_limit to the plan amount.
        
        updated_meta = {
            **current_meta,
            "analysis_limit": credits_to_add,
            "plan_tier": plan_name,
            "last_payment_date": attributes.get("created_at")
        }
        
        supabase_admin.auth.admin.update_user_by_id(
            user_id, 
            {"user_metadata": updated_meta}
        )
        
        logger.info(f"Successfully updated quota for User {user_id}")
        return {"status": "success", "user_id": user_id, "plan": plan_name, "credits": credits_to_add}

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))
