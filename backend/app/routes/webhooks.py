from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from app.db import get_db, User
import logging
from datetime import datetime

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

@router.post("/woocommerce")
async def woocommerce_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook for WooCommerce to add credits after purchase.
    Expects JSON payload from WooCommerce 'order.updated' or 'order.completed'.
    """
    try:
        payload = await request.json()
        status = payload.get("status")
        
        # We only care about completed orders
        if status != "completed":
            return {"status": "ignored", "reason": f"Order status is {status}"}
            
        email = payload.get("billing", {}).get("email")
        if not email:
            logger.error("WooCommerce Webhook: No email found in payload")
            raise HTTPException(status_code=400, detail="No email in payload")
            
        # Find user by email
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.warning(f"WooCommerce Webhook: User with email {email} not found in MME database")
            # In production, you might want to create a shadow user or log this for manual intervention
            return {"status": "error", "reason": "User not found"}
            
        # Calculate credits based on line items
        total_credits_to_add = 0
        line_items = payload.get("line_items", [])
        
        for item in line_items:
            product_name = item.get("name", "").lower()
            quantity = item.get("quantity", 1)
            
            # Logic for mapping WooCommerce products to MME credits
            # Example: "Audio Analysis Pack" -> 10 credits, "Full Certificate Pack" -> 5 credits
            if "analysis" in product_name:
                total_credits_to_add += 10 * quantity
            elif "certificate" in product_name:
                total_credits_to_add += 5 * quantity
            else:
                # Default fallback or specific product ID check
                total_credits_to_add += 1 * quantity
                
        if total_credits_to_add > 0:
            user.credits += total_credits_to_add
            db.commit()
            logger.info(f"WooCommerce Webhook: Added {total_credits_to_add} credits to {email}")
            return {"status": "success", "added": total_credits_to_add}
            
        return {"status": "ignored", "reason": "No creditable items found"}
        
    except Exception as e:
        logger.error(f"WooCommerce Webhook Error: {e}")
        raise HTTPException(status_code=500, detail="Internal webhook processing error")
