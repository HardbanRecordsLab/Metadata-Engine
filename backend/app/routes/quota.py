from fastapi import APIRouter, Depends
from app.routes.auth import get_current_user
from app.types import User

router = APIRouter(prefix="/quota", tags=["quota"])


@router.get("/status")
async def get_quota_status(current_user: User = Depends(get_current_user)):
    """
    Returns the analysis count and limit for the currently authenticated user.
    """
    user_metadata = current_user.user_metadata or {}
    analysis_count = user_metadata.get("analysis_count", 0)
    analysis_limit = user_metadata.get("analysis_limit", 10)

    return {
        "analysis_count": analysis_count,
        "analysis_limit": analysis_limit,
    }
