# Type aliases for backward compatibility with deprecated gotrue
# The User type is now part of the supabase client
from typing import Any, Dict

# Simple type alias for User - represents authenticated user data
User = Dict[str, Any]
