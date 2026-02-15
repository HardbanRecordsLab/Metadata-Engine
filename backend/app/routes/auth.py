from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db import get_db, User
from app.security import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from jose import jwt, JWTError
import hashlib
import secrets

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/signin")

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str

class SignInRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    is_active: bool
    
    class Config:
        from_attributes = True

@router.post("/signup", response_model=UserResponse)
async def signup(request: SignUpRequest, db: Session = Depends(get_db)):
    """
    Handles user registration.
    """
    # Check if user exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@router.post("/signin")
async def signin(request: SignInRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user and returns a session object (including JWT).
    """
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": "authenticated"
        }
    }

@router.get("/me")
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Gets the current user's profile from the provided JWT.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
        
    # Return structure compatible with existing app logic (mocking Supabase user object structure)
    class SupabaseUserLike:
        def __init__(self, user_obj):
            self.id = user_obj.id
            self.email = user_obj.email
            self.app_metadata = {}
            self.user_metadata = {
                "tier": user_obj.tier or "starter",
                "credits": user_obj.credits if user_obj.credits is not None else 5,
                "analysis_limit": 100, # Legacy
                "analysis_count": 0    # Legacy
            }
            self.aud = "authenticated"
            self.created_at = user_obj.created_at.isoformat() if user_obj.created_at else None

    return SupabaseUserLike(user)

@router.post("/analysis/generate")
async def generate_analysis_token():
    token = secrets.token_urlsafe(32)
    return {
        "status": "success", 
        "token": token,
        "message": "Analysis authorized"
    }

@router.post("/generate/hash")
async def generate_hash_endpoint(file: UploadFile = File(None), content: str = Form(None)):
    if file is not None:
        data = await file.read()
    elif content is not None:
        data = content.encode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="No file or content provided")
    sha256 = hashlib.sha256(data).hexdigest()
    return {
        "hash": sha256,
        "sha256": sha256,
        "status": "success"
    }
