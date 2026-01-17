"""
Supabase Client Configuration
Initializes the Supabase client using environment variables.
"""
from supabase import create_client, Client
from app.config import settings
import logging

logger = logging.getLogger(__name__)

supabase: Client = None

try:
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    else:
        logger.warning("Supabase credentials missing. Auth features will fail.")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
