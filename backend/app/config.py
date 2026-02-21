import os
from dotenv import load_dotenv

load_dotenv(override=True)


class Settings:
    # AI APIs (5-Model Ensemble)
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
    XAI_API_KEY = os.getenv("XAI_API_KEY")

    # Music APIs
    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
    LASTFM_API_KEY = os.getenv("LASTFM_API_KEY")
    DISCOGS_CONSUMER_KEY = os.getenv("DISCOGS_API_KEY") or os.getenv("DISCOGS_CONSUMER_KEY")
    DISCOGS_CONSUMER_SECRET = os.getenv("DISCOGS_SECRETS") or os.getenv("DISCOGS_CONSUMER_SECRET")
    ACOUSTID_API_KEY = os.getenv("ACOUSTID_API") or os.getenv("ACOUSTID_API_KEY")
    ACOUSTID_API_TOKEN = os.getenv("ACOUSTID_API_TOKEN")  # For submitting fingerprints
    ACR_HOST = os.getenv("ACR_HOST")
    ACR_ACCESS_KEY = os.getenv("ACR_ACCESS_KEY")
    ACR_ACCESS_SECRET = os.getenv("ACR_ACCESS_SECRET")

    # Database / Security
    DATABASE_URL = os.getenv("DATABASE_URL")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    SECRET_KEY = os.getenv("SECRET_KEY")
    
    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

    # Payment
    LEMONSQUEEZY_WEBHOOK_SECRET = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET") or os.getenv("VITE_LEMONSQUEEZY_WEBHOOK_SECRET")

    # IPFS / Pinata
    PINATA_JWT = os.getenv("PINATA_JWT")
    PINATA_GATEWAY = os.getenv("PINATA_GATEWAY", "gateway.pinata.cloud")

    # Analysis
    try:
        ANALYSIS_MAX_SECONDS = int(os.getenv("ANALYSIS_MAX_SECONDS", "180"))
    except Exception:
        ANALYSIS_MAX_SECONDS = 180


settings = Settings()
