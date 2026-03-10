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
    A dependency that gets the current user.
    QUOTA CHECKS DISABLED: User requested open app for everyone without limits.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Zaloguj się, aby skorzystać z aplikacji."
        )
        
    # All authenticated users are now treated as unlimited
    return current_user


async def increment_user_quota(user_id: str):
    """
    QUOTA UPDATES DISABLED: User requested no limits.
    """
    pass

