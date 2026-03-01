from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db import get_db, AnalysisHistory, User
from app.routes.auth import get_current_user, SupabaseUserLike
from datetime import datetime

# Router without any prefix to handle root-level legacy calls
router = APIRouter(tags=["legacy"])

# ==================== HISTORY (GET /history) ====================
@router.get("/history", response_model=List[Dict[str, Any]])
@router.get("/history/", response_model=List[Dict[str, Any]])
async def get_history_legacy(
    db: Session = Depends(get_db), current_user: Any = Depends(get_current_user)
):
    history_records = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.user_id == str(current_user.id))
        .order_by(AnalysisHistory.created_at.desc())
        .all()
    )
    return [
        {
            "id": h.id,
            "user_id": h.user_id,
            "file_name": h.file_name,
            "result": h.result,
            "created_at": h.created_at.isoformat() if getattr(h, "created_at", None) else None,
        }
        for h in history_records
    ]

# ==================== REAL AUTH PROXIES ====================
# The legacy frontend might also call /auth/signin and /auth/me directly
# We need to expose them here if the prefixed router include failed

@router.post("/auth/signin")
async def signin_legacy(request: dict, db: Session = Depends(get_db)):
    """
    Proxy to real auth logic if needed, or rely on main auth router if it works.
    But let's be safe and define it if we see errors.
    For now, let's assume the main auth router handles this if mounted correctly.
    If not, we will add it.
    """
    # Import locally to avoid circular imports if any
    from app.routes.auth import signin, SignInRequest
    try:
        req = SignInRequest(**request)
        return await signin(req, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/auth/me")
async def get_me_legacy(token: str = Depends(get_current_user)):
    # get_current_user already returns the user object
    return token
