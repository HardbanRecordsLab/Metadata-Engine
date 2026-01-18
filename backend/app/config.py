import os
from dotenv import load_dotenv

load_dotenv(override=True)


class Settings:
    # AI APIs
    GROQ_API_KEY = (os.getenv("GROQ_API_KEY") or "").strip() or None
    GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or "").strip() or None  # Legacy, kept for fallback

    # Music APIs
    SPOTIFY_CLIENT_ID = (os.getenv("SPOTIFY_CLIENT_ID") or "").strip() or None
    SPOTIFY_CLIENT_SECRET = (os.getenv("SPOTIFY_CLIENT_SECRET") or "").strip() or None
    LASTFM_API_KEY = (os.getenv("LASTFM_API_KEY") or "").strip() or None
    DISCOGS_CONSUMER_KEY = (os.getenv("DISCOGS_CONSUMER_KEY") or "").strip() or None
    DISCOGS_CONSUMER_SECRET = (os.getenv("DISCOGS_CONSUMER_SECRET") or "").strip() or None
    AUDD_API_TOKEN = (os.getenv("AUDD_API_TOKEN") or "").strip() or None

    # Database
    SUPABASE_URL = ((os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL") or "")).strip() or None
    SUPABASE_KEY = (
        (os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY") or "")
    ).strip() or None
    DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip() or None

    # IPFS / Pinata
    PINATA_JWT = (os.getenv("PINATA_JWT") or "").strip() or None
    PINATA_GATEWAY = (os.getenv("PINATA_GATEWAY") or "gateway.pinata.cloud").strip()


settings = Settings()
