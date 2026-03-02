import asyncio
import os
import shutil
import time
from datetime import datetime, timedelta
import starlette.formparsers
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# === ULTIMATE INFRASTRUCTURE PATCH ===
LIMIT_MB = 100
starlette.formparsers.MultiPartParser.max_part_size = LIMIT_MB * 1024 * 1024
starlette.formparsers.MultiPartParser.max_fields_size = LIMIT_MB * 1024 * 1024

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.main")

TEMP_DIR = "temp_uploads"
CLEANUP_INTERVAL = 3600  # 1 hour
TEMP_FILE_MAX_AGE = 86400  # 24 hours

async def cleanup_temp_files():
    """Periodic cleanup of temporary files"""
    while True:
        try:
            await asyncio.sleep(CLEANUP_INTERVAL)
            
            if not os.path.exists(TEMP_DIR):
                continue
            
            now = time.time()
            removed_count = 0
            
            for filename in os.listdir(TEMP_DIR):
                filepath = os.path.join(TEMP_DIR, filename)
                
                if os.path.isfile(filepath):
                    file_age = now - os.path.getmtime(filepath)
                    
                    if file_age > TEMP_FILE_MAX_AGE:
                        try:
                            os.remove(filepath)
                            removed_count += 1
                            logger.info(f"Cleaned up temp file: {filename}")
                        except Exception as e:
                            logger.error(f"Failed to remove {filename}: {e}")
            
            if removed_count > 0:
                logger.info(f"Cleanup: removed {removed_count} files")
        
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


def setup_app():
    """Initialize FastAPI app"""
    from app.routes import (
        proxy_router, spotify_router, lastfm_router, discogs_router,
        audd_router, auth_router, history_router, quota_router,
        tagging_router, ddex_router, analysis_router, generative_router,
        health_router, mir_router, ai_proxy_router, cwr_router,
        batch_router, system_router, webhook_router, certificate_router
    )
    from app.routes.fresh_analysis import router as fresh_router
    from app.routes.export import router as export_router
    from app.routes.tools import router as tools_router
    from app.startup import ensure_admin_user
    
    app = FastAPI(
        title="Music Metadata Engine",
        description="AI-Powered Audio Analysis",
        version="2.1.0"
    )
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:8080",
            "http://localhost:3000",
            "http://localhost:5173",
            "https://app-metadata.hardbanrecordslab.online",
            "https://metadata.hardbanrecordslab.online",
        ],
        allow_origin_regex='^https://.*\\.hardbanrecordslab\\.online$',
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
        allow_headers=["*"],
    )
    
    # Create temp directory
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    # Initialize database
    # init_db() # This is handled by Base.metadata.create_all(bind=engine) in db.py
    
    # Include routers
    app.include_router(proxy_router, prefix="/api")
    app.include_router(health_router, prefix="/api")
    app.include_router(mir_router, prefix="/api")
    app.include_router(spotify_router, prefix="/api")
    app.include_router(lastfm_router, prefix="/api")
    app.include_router(discogs_router, prefix="/api")
    app.include_router(audd_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.include_router(history_router, prefix="/api")
    app.include_router(quota_router, prefix="/api")
    app.include_router(batch_router, prefix="/api")
    app.include_router(tagging_router, prefix="/api")
    app.include_router(analysis_router, prefix="/api")
    app.include_router(generative_router, prefix="/api")
    app.include_router(system_router, prefix="/api")
    app.include_router(webhook_router, prefix="/api")
    app.include_router(certificate_router, prefix="/api")

    # AUTH Routes
    app.include_router(analysis_router, prefix="/auth")
    app.include_router(ddex_router, prefix="/auth")
    app.include_router(cwr_router, prefix="/auth")
    app.include_router(ai_proxy_router, prefix="/auth")
    app.include_router(fresh_router, prefix="/auth")
    app.include_router(export_router, prefix="/auth")
    app.include_router(tools_router, prefix="/auth")
    
    # Startup event
    @app.on_event("startup")
    async def startup_event_handler():
        logger.info("🚀 Starting application...")
        ensure_admin_user()
        
        # Start cleanup task
        asyncio.create_task(cleanup_temp_files())
        
        # Clean old files on startup
        cleanup_old_files()
        
        logger.info("✅ Application ready!")
    
    # Shutdown event
    @app.on_event("shutdown")
    async def shutdown_event_handler():
        logger.info("🛑 Shutting down...")
        
        # Final cleanup
        if os.path.exists(TEMP_DIR):
            try:
                shutil.rmtree(TEMP_DIR)
                logger.info("✅ Temp directory cleaned")
            except Exception as e:
                logger.error(f"Failed to remove temp directory: {e}")
    
    return app


def cleanup_old_files():
    """Clean old files on startup"""
    if not os.path.exists(TEMP_DIR):
        return
    
    now = time.time()
    removed = 0
    
    for filename in os.listdir(TEMP_DIR):
        filepath = os.path.join(TEMP_DIR, filename)
        if os.path.isfile(filepath):
            age = now - os.path.getmtime(filepath)
            if age > TEMP_FILE_MAX_AGE:
                try:
                    os.remove(filepath)
                    removed += 1
                except:
                    pass
    
    if removed > 0:
        logger.info(f"Startup cleanup: removed {removed} files")


app = setup_app()

@app.get("/api/worker_status")
def get_worker_status():
    return {"status": "online", "deployment": "VPS API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8888,
        reload=False
    )
