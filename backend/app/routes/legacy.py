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
    """
    Legacy endpoint: GET /history
    """
    history_records = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.user_id == current_user.id)
        .order_by(AnalysisHistory.created_at.desc())
        .all()
    )
    return history_records

# ==================== AUTH MOCKS ====================
@router.post("/auth/generate/hash")
@router.post("/auth/generate/hash/")
async def generate_hash_legacy(data: dict = {}):
    """
    Legacy endpoint: POST /auth/generate/hash
    """
    return {
        "hash": "mock_hash_12345",
        "status": "success"
    }

@router.post("/auth/analysis/generate")
@router.post("/auth/analysis/generate")
async def generate_analysis_token_legacy():
    """
    Legacy endpoint: POST /auth/analysis/generate
    """
    return {
        "status": "success", 
        "token": "mock_analysis_token",
        "message": "Analysis authorized"
    }

# Explicit OPTIONS handlers for pre-flight requests if middleware fails
@router.options("/auth/generate/hash")
async def options_generate_hash():
    return {}

@router.options("/auth/analysis/generate")
async def options_analysis_generate():
    return {}

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
