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
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

    # Music APIs
    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
    LASTFM_API_KEY = os.getenv("LASTFM_API_KEY")
    DISCOGS_CONSUMER_KEY = os.getenv("DISCOGS_API_KEY") or os.getenv("DISCOGS_CONSUMER_KEY")
    DISCOGS_CONSUMER_SECRET = os.getenv("DISCOGS_SECRETS") or os.getenv("DISCOGS_CONSUMER_SECRET")
    ACOUSTID_API_KEY = os.getenv("ACOUSTID_API") or os.getenv("ACOUSTID_API_KEY")
    ACOUSTID_API_TOKEN = os.getenv("ACOUSTID_API_TOKEN")  # For submitting fingerprints
    AUDD_API_TOKEN = os.getenv("AUDD_API_TOKEN")
    ACR_HOST = os.getenv("ACR_HOST")
    ACR_ACCESS_KEY = os.getenv("ACR_ACCESS_KEY")
    ACR_ACCESS_SECRET = os.getenv("ACR_ACCESS_SECRET")

    # Database / Security
    DATABASE_URL = os.getenv("DATABASE_URL")
    SECRET_KEY = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")

    # Public base URL of the frontend app (for links in transactional emails)
    APP_BASE_URL = os.getenv("APP_BASE_URL", "https://app-metadata.hardbanrecordslab.online")

    # Transactional email (SMTP). If unset, emails are logged instead of sent.
    SMTP_HOST = os.getenv("SMTP_HOST")
    try:
        SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    except Exception:
        SMTP_PORT = 587
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASS = os.getenv("SMTP_PASS")
    SMTP_FROM = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or "no-reply@hardbanrecordslab.online"
    SMTP_STARTTLS = os.getenv("SMTP_STARTTLS", "true").strip().lower() not in ("0", "false", "no")

    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

    # Error monitoring (Sentry). No-op if SENTRY_DSN is unset.
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    SENTRY_ENV = os.getenv("SENTRY_ENV") or os.getenv("ENV", "production")
    try:
        SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0"))
    except Exception:
        SENTRY_TRACES_SAMPLE_RATE = 0.0

    # IPFS / Pinata
    PINATA_JWT = os.getenv("PINATA_JWT")
    PINATA_GATEWAY = os.getenv("PINATA_GATEWAY", "gateway.pinata.cloud")

    # Analysis
    try:
        ANALYSIS_MAX_SECONDS = int(os.getenv("ANALYSIS_MAX_SECONDS", "180"))
    except Exception:
        ANALYSIS_MAX_SECONDS = 180

    # Stripe (credit packs — one-time payments)
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
    STRIPE_SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL")
    STRIPE_CANCEL_URL = os.getenv("STRIPE_CANCEL_URL")


settings = Settings()
