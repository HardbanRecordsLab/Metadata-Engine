from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import bcrypt
from jose import jwt
import uuid
from app.db import User, get_db

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

# Config
ALGORITHM = "HS256"
SECRET_KEY = "your-secret-key-change-in-production"


# Schemas
class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 604800


# Utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user_id: str, expires_in: int = 604800) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(seconds=expires_in)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
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


# Routes
@router.post("/register", response_model=TokenResponse)
async def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Register new user"""
    
    # Check if user exists
    existing = db.query(User).filter(
        (User.email == payload.email) | (User.username == payload.username)
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="Email or username already exists")
    
    # Create user
    user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        api_key=str(uuid.uuid4())
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token(user.id)
    
    return TokenResponse(
        access_token=token,
        token_type="Bearer",
        expires_in=604800
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    
    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
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
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "is_premium": current_user.is_premium,
        "quota_limit": current_user.quota_limit,
        "quota_used": current_user.quota_used,
        "created_at": current_user.created_at
    }
