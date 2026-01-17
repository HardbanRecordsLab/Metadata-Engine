from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from app.supabase_client import supabase
# Note: gotrue is deprecated, using generic exception handling instead

router = APIRouter(prefix="/auth", tags=["auth"])

# This scheme will be used to extract the JWT from the Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/signin")


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup")
async def signup(request: SignUpRequest):
    """
    Handles user registration and sets a default quota.
    """
    try:
        # Create a new user in Supabase Auth with default quota
        user = supabase.auth.sign_up(
            {
                "email": request.email,
                "password": request.password,
                "options": {"data": {"analysis_limit": 10, "analysis_count": 0}},
            }
        )
        return {
            "message": "User created successfully. Please check your email for verification.",
            "user": user,
        }
    except Exception as e:
        # Handle auth errors (e.g., email already exists)
        error_msg = str(e) if hasattr(e, '__str__') else "Authentication error"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post("/signin")
async def signin(request: SignInRequest):
    """
    Authenticates a user and returns a session object (including JWT).
    """
    try:
        # Authenticate the user with email and password
        session = supabase.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
        return session
    except Exception as e:
        # Handle auth errors (e.g., invalid credentials)
        error_msg = str(e) if hasattr(e, '__str__') else "Authentication failed"
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.get("/me")
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Gets the current user's profile from the provided JWT.
    """
    try:
        # Verify the token and get the user
        user_response = supabase.auth.get_user(token)
        # Supabase Python client returns a response object with a 'user' attribute
        return user_response.user
    except Exception as e:
        # Handle auth errors (e.g., invalid token)
        error_msg = str(e) if hasattr(e, '__str__') else "Invalid token"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {error_msg}",
        )
