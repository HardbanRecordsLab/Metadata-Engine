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

def get_user_and_check_quota(current_user: Optional[User] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    """
    A dependency that gets the current user and checks if they have enough credits.
    Limit for free users: 10 analyses.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Zaloguj się, aby skorzystać z aplikacji (10 darmowych analiz dla każdego)."
        )
    
    # Superusers have unlimited access
    if current_user.is_superuser:
        return current_user
        
    # Check credits
    if current_user.credits <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Wykorzystałeś limit darmowych analiz (10). Zakup pakiet w WooCommerce."
        )
        
    return current_user


async def decrement_user_credits(user_id: str, db: Session, amount: int = 1):
    """
    Subtract credits from user account after successful action.
    Default: 1 credit (analysis).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user and not user.is_superuser:
        if user.credits >= amount:
            user.credits -= amount
            db.commit()
            return True
    return False

