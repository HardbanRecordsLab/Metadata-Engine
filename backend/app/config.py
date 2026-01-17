import os
from dotenv import load_dotenv

load_dotenv(override=True)


class Settings:
    # AI APIs
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # Legacy, kept for fallback

    # Music APIs
    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
    LASTFM_API_KEY = os.getenv("LASTFM_API_KEY")
    DISCOGS_CONSUMER_KEY = os.getenv("DISCOGS_CONSUMER_KEY")
    DISCOGS_CONSUMER_SECRET = os.getenv("DISCOGS_CONSUMER_SECRET")
    AUDD_API_TOKEN = os.getenv("AUDD_API_TOKEN")

    # Database
    SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
    DATABASE_URL = os.getenv("DATABASE_URL")

    # IPFS / Pinata
    PINATA_JWT = os.getenv("PINATA_JWT")
    PINATA_GATEWAY = os.getenv("PINATA_GATEWAY", "gateway.pinata.cloud")


settings = Settings()
