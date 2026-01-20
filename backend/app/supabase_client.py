"""
Supabase Client Configuration
Initializes the Supabase client using environment variables.
"""
from app.config import settings
import logging

logger = logging.getLogger(__name__)

supabase = None

try:
    from supabase import create_client

    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    else:
        logger.warning("Supabase credentials missing. Auth features will fail.")
except ImportError:
    logger.warning("Supabase package not installed. Auth features will fail.")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
