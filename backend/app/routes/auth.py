from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import bcrypt
from jose import jwt
import uuid
import logging
from app.db import User, get_db
from app.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_purpose_token,
    verify_purpose_token,
)
from app.rate_limit import limiter
from app.utils.email import send_email

from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()
logger = logging.getLogger(__name__)

# Config
ALGORITHM = "HS256"
SECRET_KEY = settings.SECRET_KEY


# Schemas
class UserRegister(BaseModel):
    email: EmailStr
    username: str | None = None
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class TokenOnlyRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 604800


# Utilities
def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to get current user from token"""
    token = credentials.credentials
    user_id = verify_token(token)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    return user


EMAIL_VERIFY_PURPOSE = "email_verify"

# Email verification is only enforced when the server can actually send email.
VERIFICATION_ENABLED = bool(settings.SMTP_HOST)


async def _send_verification_email(user: User) -> None:
    token = create_purpose_token(user.id, EMAIL_VERIFY_PURPOSE, expires_minutes=60 * 24)
    link = f"{settings.APP_BASE_URL.rstrip('/')}/?verify_token={token}"
    html = (
        f"<p>Welcome to Metadata Engine!</p>"
        f"<p>Confirm your email address to activate your account (link valid for 24 hours):</p>"
        f'<p><a href="{link}">Verify my email</a></p>'
        f"<p>If you didn't sign up, you can ignore this email.</p>"
    )
    await send_email(user.email, "Verify your Metadata Engine email", html)


# Routes
@router.post("/register")
@limiter.limit("10/minute")
async def register(request: Request, payload: UserRegister, db: Session = Depends(get_db)):
    """Register a new user. Sends a verification email when SMTP is configured."""

    username = payload.username or payload.email.split("@")[0]

    existing = db.query(User).filter(
        (User.email == payload.email) | (User.username == username)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email or username already exists")

    user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        username=username,
        password_hash=get_password_hash(payload.password),
        api_key=str(uuid.uuid4()),
        credits=3,
        is_verified=not VERIFICATION_ENABLED,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if VERIFICATION_ENABLED:
        await _send_verification_email(user)
        return {
            "requires_verification": True,
            "detail": "Account created. Check your email to verify your address before signing in.",
        }

    return TokenResponse(
        access_token=create_access_token(user.id),
        token_type="Bearer",
        expires_in=604800,
    )


@router.post("/verify-email", response_model=TokenResponse)
@limiter.limit("20/hour")
async def verify_email(request: Request, payload: TokenOnlyRequest, db: Session = Depends(get_db)):
    """Confirm an email address from the token in the verification link."""
    user_id = verify_purpose_token(payload.token, EMAIL_VERIFY_PURPOSE)
    if not user_id:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired.")

    user.is_verified = True
    user.last_login = datetime.utcnow()
    db.commit()
    logger.info("Email verified for %s", user.email)
    return TokenResponse(access_token=create_access_token(user.id), token_type="Bearer", expires_in=604800)


@router.post("/resend-verification")
@limiter.limit("4/hour")
async def resend_verification(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Resend the verification email. Always returns 200."""
    user = db.query(User).filter(User.email == payload.email).first()
    if user and not user.is_verified and VERIFICATION_ENABLED:
        await _send_verification_email(user)
    return {"detail": "If that account exists and is unverified, a new link has been sent."}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    
    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")

    if VERIFICATION_ENABLED and not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email first — check your inbox for the confirmation link.",
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    # One-time welcome credits for new accounts (do not override purchases)
    try:
        current = user.credits if user.credits is not None else 0
        if current < 3:
            user.credits = 3
    except Exception as e:
        # Fallback safe default
        logger.error(f"Error checking user credits: {e}")
        user.credits = 3
    
    try:
        db.commit()
    except Exception as e:
        logger.error(f"Database error during login: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database commit failed during login. Please try again."
        )
    
    token = create_access_token(user.id)
    
    return TokenResponse(
        access_token=token,
        token_type="Bearer",
        expires_in=604800
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "is_premium": current_user.is_premium,
        "is_verified": current_user.is_verified,
        "is_superuser": current_user.is_superuser,
        "tier": current_user.tier,
        "credits": current_user.credits,
        "created_at": current_user.created_at,
    }


PWD_RESET_PURPOSE = "pwd_reset"


@router.post("/forgot-password")
@limiter.limit("4/hour")
async def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send a password-reset link. Always returns 200 (no account enumeration)."""
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        token = create_purpose_token(user.id, PWD_RESET_PURPOSE, expires_minutes=30)
        link = f"{settings.APP_BASE_URL.rstrip('/')}/?reset_token={token}"
        html = (
            f"<p>Hi,</p>"
            f"<p>Someone requested a password reset for your Metadata Engine account. "
            f"If it was you, set a new password using the link below (valid for 30 minutes):</p>"
            f'<p><a href="{link}">Reset your password</a></p>'
            f"<p>If it wasn't you, you can ignore this email — your password stays the same.</p>"
            f"<p>— Metadata Engine</p>"
        )
        await send_email(user.email, "Reset your Metadata Engine password", html)
        logger.info("Password reset requested for %s", user.email)
    return {"detail": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password", response_model=TokenResponse)
@limiter.limit("10/hour")
async def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Complete a password reset and return a fresh session token."""
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user_id = verify_purpose_token(payload.token, PWD_RESET_PURPOSE)
    if not user_id:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user.password_hash = get_password_hash(payload.new_password)
    user.last_login = datetime.utcnow()
    db.commit()
    logger.info("Password reset completed for %s", user.email)

    return TokenResponse(access_token=create_access_token(user.id), token_type="Bearer", expires_in=604800)
