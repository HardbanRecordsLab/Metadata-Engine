# routes package init

from .proxy import router as proxy_router
from .spotify import router as spotify_router
from .lastfm import router as lastfm_router
from .discogs import router as discogs_router
from .audd import router as audd_router
from .auth import router as auth_router
from .history import router as history_router
from .quota import router as quota_router
from .batch import router as batch_router
from .tagging import router as tagging_router
from .ddex import router as ddex_router
from .analysis import router as analysis_router
from .health import router as health_router
from .mir import router as mir_router
from .generative import router as generative_router
from .ai_proxy import router as ai_proxy_router
from .cwr import router as cwr_router
from .system import router as system_router
