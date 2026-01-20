"""
GitNexus v3.0.0 - Routers

FastAPI routers for all API endpoints.
"""

from routers.discovery import router as discovery_router
from routers.envvars import router as envvars_router
from routers.replay import router as replay_router
from routers.settings import router as settings_router
from routers.watchlist import router as watchlist_router

__all__ = [
    "discovery_router",
    "envvars_router",
    "replay_router",
    "settings_router",
    "watchlist_router",
]


