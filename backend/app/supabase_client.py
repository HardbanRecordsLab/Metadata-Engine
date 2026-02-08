"""
Supabase Client Configuration (DEPRECATED)
This file is kept to avoid import errors during migration.
Supabase has been replaced by local PostgreSQL + JWT auth.
"""
import logging

logger = logging.getLogger(__name__)

supabase = None
supabase_admin = None

logger.info("Supabase client is deprecated and disabled.")
