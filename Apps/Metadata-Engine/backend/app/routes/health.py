from fastapi import APIRouter
from app.config import settings
import os

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/diagnose")
async def diagnose_system():
    checks = {
        "status": "online",
        "backend_version": "0.1.0",
        "environment_variables": {
            "AUDD_API_TOKEN": "Present" if settings.AUDD_API_TOKEN else "Missing",
            "SUPABASE_URL": "Present" if settings.SUPABASE_URL else "Missing",
            "SUPABASE_KEY": "Present" if settings.SUPABASE_KEY else "Missing",
            "GEMINI_API_KEY": (
                "Present" if settings.GEMINI_API_KEY else "Missing"
            ),  # Legacy if using Puter
            "SPOTIFY_CLIENT_ID": "Present" if settings.SPOTIFY_CLIENT_ID else "Missing",
        },
        "system": {"os": os.name, "cwd": os.getcwd()},
    }
    return checks

@router.get("/")
def health_check():
    return {"status": "ok"}
