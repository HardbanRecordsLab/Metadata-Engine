from fastapi import Depends, HTTPException, status
from app.routes.auth import get_current_user
from app.supabase_client import supabase
from app.types import User



from fastapi import Header
from typing import Optional

async def get_current_user_optional(authorization: Optional[str] = Header(None)):
    """
    Permissive dependency that tries to get the user but returns None if no token or invalid token.
    Doesn't raise 401.
    """
    if not authorization:
        return None
        
    try:
        # Extract token from "Bearer <token>"
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
            
        user_response = supabase.auth.get_user(token)
        return user_response.user
    except Exception:
        return None

def get_user_and_check_quota(current_user: Optional[User] = Depends(get_current_user_optional)):
    """
    A dependency that gets the current user and checks if they have
    sufficient analysis quota.
    Admins bypass all quota checks.
    """
    if not current_user:
        return None
        
    # Check if user is admin
    from app.admin_config import is_admin
    user_email = getattr(current_user, 'email', None)
    
    if user_email and is_admin(user_email):
        # Admin users bypass all quota checks
        return current_user
        
    user_metadata = current_user.user_metadata or {}
    analysis_count = user_metadata.get("analysis_count", 0)
    analysis_limit = user_metadata.get("analysis_limit", 10)

    if analysis_count >= analysis_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Quota exceeded. Limit: {analysis_limit}, Used: {analysis_count}",
        )

    return current_user


async def increment_user_quota(user_id: str):
    """
    Increments the analysis count for a given user.
    """
    if not supabase_admin:
        print("CRITICAL: Cannot increment quota - Supabase Admin client not initialized.")
        return

    try:
        # First, get the current count using admin client
        response = supabase_admin.auth.admin.get_user_by_id(user_id)
        current_metadata = response.user.user_metadata or {}
        current_count = current_metadata.get("analysis_count", 0)

        # Then, update with the incremented count
        updated_metadata = {**current_metadata, "analysis_count": current_count + 1}
        supabase_admin.auth.admin.update_user_by_id(
            user_id, {"user_metadata": updated_metadata}
        )
    except Exception as e:
        # Log this error, but don't block the user's request from completing
        print(f"CRITICAL: Failed to increment quota for user {user_id}. Error: {e}")
