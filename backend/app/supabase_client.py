"""
Supabase Client Configuration
Initializes the Supabase client using environment variables.
"""
from app.config import settings
import logging

logger = logging.getLogger(__name__)

supabase = None
supabase_admin = None

try:
    from supabase import create_client

    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    else:
        logger.warning("Supabase credentials missing. Auth features will fail.")

    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        supabase_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    else:
        logger.warning("Supabase Service Role Key missing. Admin features (webhooks, quota updates) will fail.")

except ImportError:
    logger.warning("Supabase package not installed. Auth features will fail.")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
