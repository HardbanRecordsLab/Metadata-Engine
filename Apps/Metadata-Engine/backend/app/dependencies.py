from fastapi import Depends, HTTPException, status
from app.routes.auth import get_current_user
from app.db import get_db, User
from app.security import SECRET_KEY, ALGORITHM
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from fastapi import Header
from typing import Optional

async def get_current_user_optional(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
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
            
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
            
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except JWTError:
        return None
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
        
    # Check credits directly from User model
    # If credits is None, assume default 5 (starter)
    credits = current_user.credits if current_user.credits is not None else 5
    
    # Check if we should enforce quota based on credits
    # Simple logic: 1 analysis = 1 credit? 
    # Or just check if they have credits > 0?
    # Based on original code, it checked "analysis_count" vs "analysis_limit".
    # We are moving to a credit system (User.credits).
    
    if credits <= 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Quota exceeded. You have {credits} credits left.",
        )

    return current_user


async def increment_user_quota(user_id: str):
    """
    Decrements the credit count for a given user.
    """
    # Note: This function needs a DB session, but dependencies are usually injected.
    # Since this is a helper function, we might need to pass db explicitly or create a new session.
    # For now, let's create a new session to be safe.
    from app.db import SessionLocal
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            # Decrement credits
            if user.credits is not None and user.credits > 0:
                user.credits -= 1
                db.commit()
    except Exception as e:
        print(f"CRITICAL: Failed to update quota for user {user_id}. Error: {e}")
    finally:
        db.close()
