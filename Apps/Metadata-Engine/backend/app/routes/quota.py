from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.routes.auth import get_current_user
from app.db import get_db, User, RedeemCode

router = APIRouter(prefix="/quota", tags=["quota"])

class RedeemRequest(BaseModel):
    code: str

@router.get("/status")
async def get_quota_status(current_user = Depends(get_current_user)):
    """
    Returns the credits and limit for the currently authenticated user.
    """
    user_metadata = getattr(current_user, 'user_metadata', {})
    credits = user_metadata.get("credits", 0)
    tier = user_metadata.get("tier", "starter")
    
    return {
        "credits": credits,
        "tier": tier,
        "analysis_count": 0, # Legacy
        "analysis_limit": 100 # Legacy
    }

@router.post("/redeem")
async def redeem_code(request: RedeemRequest, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Redeems a code for credits.
    """
    code_str = request.code.strip().upper()
    
    # Check if code exists
    redeem_code = db.query(RedeemCode).filter(RedeemCode.code == code_str, RedeemCode.is_active == True).first()
    
    if not redeem_code:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
        
    if redeem_code.used_count >= redeem_code.max_uses:
        raise HTTPException(status_code=400, detail="Code has been fully redeemed")
        
    # Get actual user model from DB (current_user might be a wrapper)
    user_id = current_user.id
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Apply credits
    if user.credits is None:
        user.credits = 0
    user.credits += redeem_code.credits
    
    # Update code usage
    redeem_code.used_count += 1
    
    db.commit()
    
    return {
        "message": f"Successfully redeemed {redeem_code.credits} credits!",
        "new_credits": user.credits
    }
