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
            "ACOUSTID_API_KEY": "Present" if settings.ACOUSTID_API_KEY else "Missing",
            "ACOUSTID_API_TOKEN": "Present" if settings.ACOUSTID_API_TOKEN else "Missing",
            "SECRET_KEY": "Present" if settings.SECRET_KEY else "Missing",
            "GEMINI_API_KEY": (
                "Present" if settings.GEMINI_API_KEY else "Missing"
            ),
            "SPOTIFY_CLIENT_ID": "Present" if settings.SPOTIFY_CLIENT_ID else "Missing",
        },
        "system": {"os": os.name, "cwd": os.getcwd()},
    }
    return checks

@router.get("/")
def health_check():
    return {"status": "ok"}
