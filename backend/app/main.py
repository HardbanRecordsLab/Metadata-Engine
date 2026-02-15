import starlette.formparsers
import logging
import os
import hashlib
import secrets
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from app.config import settings

# === ULTIMATE INFRASTRUCTURE PATCH ===
LIMIT_MB = 100
starlette.formparsers.MultiPartParser.max_part_size = LIMIT_MB * 1024 * 1024
starlette.formparsers.MultiPartParser.max_fields_size = LIMIT_MB * 1024 * 1024

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.main")

from app.routes import (
    proxy_router, spotify_router, lastfm_router, discogs_router,
    audd_router, auth_router, history_router, quota_router,
    tagging_router, ddex_router, analysis_router, generative_router,
    health_router, mir_router, ai_proxy_router, cwr_router,
    batch_router, system_router, webhook
)
from app.routes.pinata import router as pinata_router
from app.routes.fresh_analysis import router as fresh_router
from app.routes.export import router as export_router
from app.routes.tools import router as tools_router
from app.routes.v2.ipfs import router as ipfs_v2_router
from app.routes.generative import CertificateRequest, generate_certificate as generate_certificate_handler

app = FastAPI()

# Startup Event
from app.startup import ensure_admin_user

@app.on_event("startup")
async def startup_event():
    ensure_admin_user()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:3000",
        "https://app-metadata.hardbanrecordslab.online",
        "https://metadata.hardbanrecordslab.online",
        "*"  # Fallback for development
    ],
    allow_origin_regex='https://.*\.hardbanrecordslab\.online', # Allow all subdomains
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

@app.api_route("/auth/generate/hash", methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"])
@app.api_route("/auth/generate/hash/", methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"])
async def generate_hash_legacy_direct(file: UploadFile = File(None), content: str = Form(None)):
    if file is not None:
        data = await file.read()
    elif content is not None:
        data = content.encode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="No file or content provided")
    sha256 = hashlib.sha256(data).hexdigest()
    return {
        "hash": sha256,
        "sha256": sha256,
        "status": "success"
    }

@app.options("/auth/generate/hash")
@app.options("/auth/generate/hash/")
async def options_generate_hash_direct():
    return {}


@app.post("/auth/generate/certificate")
async def generate_certificate_legacy_direct(request: CertificateRequest):
    return await generate_certificate_handler(request)

# API Routes
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

# AUTH Routes
app.include_router(analysis_router, prefix="/auth")
app.include_router(ddex_router, prefix="/auth")
app.include_router(cwr_router, prefix="/auth")
app.include_router(ai_proxy_router, prefix="/auth")
app.include_router(pinata_router, prefix="/auth")
app.include_router(fresh_router, prefix="/auth")
app.include_router(export_router, prefix="/auth")
app.include_router(tools_router, prefix="/auth")

# Public V2 Routes
app.include_router(ipfs_v2_router, prefix="/api/v2")

@app.get("/api/debug/files")
def debug_files():
    """List files in frontend dist to verify build"""
    import os
    frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
    assets_dir = os.path.join(frontend_dist, "assets")
    
    result = {
        "dist_path": frontend_dist,
        "exists": os.path.exists(frontend_dist),
        "files_root": [],
        "assets_path": assets_dir,
        "assets_exists": os.path.exists(assets_dir),
        "files_assets": []
    }
    
    if os.path.exists(frontend_dist):
        result["files_root"] = os.listdir(frontend_dist)
        
    if os.path.exists(assets_dir):
        result["files_assets"] = os.listdir(assets_dir)
        
    return result

@app.get("/api/worker_status")
def get_worker_status():
    return {"status": "online", "deployment": "Hugging Face"}

# Serve static frontend with DYNAMIC INJECTION
frontend_dist_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

# Mount assets (CSS, JS, Images)
if os.path.exists(frontend_dist_path):
    # Mount assets folder explicitly
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

def get_injected_index():
    path = os.path.join(frontend_dist_path, "index.html")
    if not os.path.exists(path):
        return "<h1>Frontend build not found.</h1>"
        
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    import json
    s_url = settings.SUPABASE_URL or ""
    s_key = settings.SUPABASE_KEY or ""
    acr_host = settings.ACR_HOST or ""
    acr_key = settings.ACR_ACCESS_KEY or ""
    acr_secret = settings.ACR_ACCESS_SECRET or ""
    gemini_key = settings.GEMINI_API_KEY or ""
    
    logger.info(f"Injecting Config: Supabase={'set' if s_url else 'MISSING'}, ACR={'set' if acr_key else 'MISSING'}")
    
    env_script = f"""<script>
        window.VITE_SUPABASE_URL = {json.dumps(s_url)};
        window.VITE_SUPABASE_ANON_KEY = {json.dumps(s_key)};
        window.VITE_ACR_HOST = {json.dumps(acr_host)};
        window.VITE_ACR_ACCESS_KEY = {json.dumps(acr_key)};
        window.VITE_ACR_ACCESS_SECRET = {json.dumps(acr_secret)};
        window.VITE_GEMINI_API_KEY = {json.dumps(gemini_key)};
        console.log("MME: Runtime Config Injected");
    </script>"""
    return content.replace("<head>", f"<head>{env_script}")

@app.get("/")
async def serve_root():
    return HTMLResponse(get_injected_index())

# Support for SPA routing - capture everything else that's not a static file or API
@app.get("/{path:path}")
async def catch_all(path: str):
    # 1. Security Check: Prevent Path Traversal
    safe_base = os.path.abspath(frontend_dist_path)
    full_path = os.path.abspath(os.path.join(frontend_dist_path, path))
    
    if not full_path.startswith(safe_base):
        return HTMLResponse(content="Access Denied", status_code=403)

    # 2. Check if file exists in frontend/dist (e.g. favicon.ico, robots.txt)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return FileResponse(full_path)

    # 3. If it looks like a file (has extension) but doesn't exist locally -> 404
    if "." in path.split("/")[-1]:
        return HTMLResponse(content=f"Asset not found: {path}", status_code=404)
        
    # 4. Otherwise, it's a React route -> serve index.html
    return HTMLResponse(get_injected_index())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
