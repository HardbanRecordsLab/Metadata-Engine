from fastapi import APIRouter
from app.config import settings
from app.services.groq_models import groq_model
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
            "GROQ_API_KEY": "Present" if os.getenv("GROQ_API_KEY") else "Missing",
            "OPENROUTER_API_KEY": "Present" if os.getenv("OPENROUTER_API_KEY") else "Missing",
        },
        "llm": {
            "openrouter_paid_allowed": os.getenv("OPENROUTER_ALLOW_PAID", "").strip().lower() not in ("0", "false", "no", "off"),
            "vote_models": (os.getenv("OPENROUTER_VOTE_MODELS", "").strip() or "default (gemini-2.5-flash-lite, mistral-small-24b-instruct-2501, gemma-4-31b-it)"),
            "vote_timeout_sec": os.getenv("OPENROUTER_VOTE_TIMEOUT_SEC", "").strip() or "default (75)",
            "groq_models": {"pro": groq_model("pro"), "flash": groq_model("flash")},
        },
        "system": {"os": os.name, "cwd": os.getcwd()},
    }
    return checks

@router.get("/")
def health_check():
    return {"status": "ok"}
