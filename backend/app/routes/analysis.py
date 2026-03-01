"""
Analysis Routes - Full metadata pipeline with synchronized field schema
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import os
import uuid
import logging
import asyncio
import json
import shutil
import time
from app.utils.websocket_manager import manager as ws_manager
from fastapi import WebSocket, WebSocketDisconnect
from app.db import SessionLocal, Job, AnalysisHistory
from app.dependencies import get_user_and_check_quota
from app.types import User
from app.services.metadata_enricher import MetadataEnricher
from app.config import settings

router = APIRouter(prefix="/analysis", tags=["analysis"])
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── SCHEMA ────────────────────────────────────────────────────────────────────
# Single source of truth for all allowed metadata keys.
# Any field sent from frontend OR produced by backend must be listed here.

ALLOWED_METADATA_KEYS = {
    # Core identity
    "title", "artist", "album", "albumArtist",
    "year", "track",
    "duration",
    "coverArt",
    # Sonic / technical
    "mainInstrument", "bpm", "key", "mode",
    "mainGenre", "additionalGenres",
    "moods", "instrumentation", "keywords",
    "trackDescription",
    "language",
    "vocalStyle",
    # Credits & legal
    "copyright", "pLine", "publisher",
    "composer", "lyricist", "producer",
    "catalogNumber", "isrc", "iswc", "upc",
    "sha256", "license",
    # Use & classification
    "useCases", "structure",
    # Extended AI-generated fields
    "energy_level", "energyLevel",
    "mood_vibe",
    "musicalEra",
    "productionQuality",
    "dynamics",
    "targetAudience",
    "tempoCharacter",
    # DSP-derived fields
    "dynamicRange",
    "spectralCentroid",
    "spectralRolloff",
    "acousticScore",
    "hasVocals",
    # Misc
    "analysisReasoning",
    "similar_artists",
    "validation_report",
    # Confidence score from LLM ensemble
    "confidence",
}


def deduplicate_array(arr: list) -> list:
    if not isinstance(arr, list):
        return []
    seen = set()
    result = []
    for item in arr:
        if not item or not isinstance(item, str):
            continue
        cleaned = item.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result


def sanitize_metadata(metadata: dict) -> dict:
    if not isinstance(metadata, dict):
        raise HTTPException(status_code=500, detail="SCHEMA_VIOLATION: metadata must be object")

    # Forward-compatible: merge trackNumber → track
    if "trackNumber" in metadata and "track" not in metadata:
        metadata["track"] = metadata.get("trackNumber")

    # Keep only allowed keys
    cleaned = {k: metadata[k] for k in ALLOWED_METADATA_KEYS if k in metadata}

    # ── Defaults ──────────────────────────────────────────────────────────────
    cleaned.setdefault("title", "")
    cleaned.setdefault("artist", "")
    cleaned.setdefault("album", "")
    cleaned.setdefault("albumArtist", cleaned.get("artist", ""))
    cleaned.setdefault("year", "")
    cleaned.setdefault("track", 1)
    cleaned.setdefault("mainInstrument", "")
    cleaned.setdefault("bpm", 0)
    cleaned.setdefault("key", "C")
    cleaned.setdefault("mode", "Major")
    cleaned.setdefault("mainGenre", "Unknown")
    cleaned.setdefault("additionalGenres", [])
    cleaned.setdefault("moods", [])
    cleaned.setdefault("energy_level", "Medium")
    cleaned.setdefault("energyLevel", cleaned.get("energy_level", "Medium"))
    cleaned.setdefault("mood_vibe", "")
    cleaned.setdefault("instrumentation", [])
    cleaned.setdefault("keywords", [])
    cleaned.setdefault("trackDescription", "")
    cleaned.setdefault("musicalEra", "")
    cleaned.setdefault("productionQuality", "")
    cleaned.setdefault("dynamics", "")
    cleaned.setdefault("targetAudience", "")
    cleaned.setdefault("tempoCharacter", "")
    cleaned.setdefault("useCases", [])
    cleaned.setdefault("language", "Instrumental")
    cleaned.setdefault("catalogNumber", "")
    cleaned.setdefault("isrc", "")
    cleaned.setdefault("iswc", "")
    cleaned.setdefault("upc", "")
    cleaned.setdefault("copyright", "")
    cleaned.setdefault("publisher", "")
    cleaned.setdefault("composer", "")
    cleaned.setdefault("lyricist", "")
    cleaned.setdefault("producer", "")
    cleaned.setdefault("pLine", "")
    cleaned.setdefault("sha256", "")
    cleaned.setdefault("license", "")
    cleaned.setdefault("duration", 0)
    cleaned.setdefault("structure", [])
    cleaned.setdefault("validation_report", {})
    cleaned.setdefault("analysisReasoning", "")
    cleaned.setdefault("similar_artists", [])

    # Keep energyLevel and energy_level in sync
    if cleaned.get("energyLevel") and not cleaned.get("energy_level"):
        cleaned["energy_level"] = cleaned["energyLevel"]
    if cleaned.get("energy_level") and not cleaned.get("energyLevel"):
        cleaned["energyLevel"] = cleaned["energy_level"]

    # ── Array deduplication ────────────────────────────────────────────────────
    for arr_key in ("additionalGenres", "moods", "instrumentation", "keywords", "useCases"):
        cleaned[arr_key] = deduplicate_array(cleaned.get(arr_key, []))

    # ── VocalStyle normalization ───────────────────────────────────────────────
    vs = cleaned.get("vocalStyle")
    if not isinstance(vs, dict):
        cleaned["vocalStyle"] = {"gender": "none", "timbre": "none", "delivery": "none", "emotionalTone": "none"}
    else:
        gender = str(vs.get("gender") or "").strip().lower()
        if not gender or gender in ("none", "instrumental"):
            cleaned["vocalStyle"] = {"gender": "none", "timbre": "none", "delivery": "none", "emotionalTone": "none"}
        else:
            cleaned["vocalStyle"] = {
                "gender": str(vs.get("gender") or "").strip(),
                "timbre": str(vs.get("timbre") or "").strip(),
                "delivery": str(vs.get("delivery") or "").strip(),
                "emotionalTone": str(vs.get("emotionalTone") or "").strip(),
            }

    # ── Non-empty array fallbacks ─────────────────────────────────────────────
    if not cleaned["additionalGenres"]:  cleaned["additionalGenres"] = ["Unknown Subgenre"]
    if not cleaned["moods"]:             cleaned["moods"] = ["Unspecified"]
    if not cleaned["instrumentation"]:   cleaned["instrumentation"] = ["Unspecified"]
    if not cleaned["keywords"]:          cleaned["keywords"] = ["Unspecified"]
    if not cleaned["useCases"]:          cleaned["useCases"] = ["General"]

    if not cleaned.get("trackDescription"):
        cleaned["trackDescription"] = "Track description pending."

    return cleaned


# ── ANALYSIS JOB ──────────────────────────────────────────────────────────────

async def process_analysis(
    job_id: str,
    file_path: str,
    is_pro_mode: bool,
    transcribe: bool,
    is_fresh: bool = False,
    model_preference: str = "flash",
    time_budget_sec: int | None = None,
):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Background Job {job_id} not found in database.")
            return

        if time_budget_sec is None:
            time_budget_sec = getattr(settings, "ANALYSIS_MAX_SECONDS", 20)
        deadline = time.monotonic() + float(time_budget_sec)

        def remaining() -> float:
            return max(0.0, deadline - time.monotonic())

        job.status = "processing"
        job.message = "Calculating digital fingerprint (SHA-256)..."
        db.commit()
        await ws_manager.send_progress(job_id, job.message, progress=5)

        # SHA-256 fingerprint for caching
        from app.utils.hash_generator import generate_file_hash
        file_hash = generate_file_hash(file_path)

        # Cache check
        from app.utils.caching import cache
        cached_result = cache.get(file_hash)
        if cached_result:
            logger.info(f"Cache HIT for Job {job_id} (Hash: {file_hash[:16]}...)")
            job.result = sanitize_metadata(cached_result)
            job.status = "completed"
            job.message = "Analysis complete (Restored from cache)."
            db.commit()
            await ws_manager.send_progress(job_id, job.message, progress=100, status="completed")
            return

        transcribe = False  # Disabled for performance

        logger.info(f"Job {job_id}: Fast Local Pipeline (budget {time_budget_sec}s)...")
        job.message = f"Fast analysis mode (<= {time_budget_sec}s)..."
        db.commit()
        await ws_manager.send_progress(job_id, job.message, progress=20)

        from app.services.fresh_track_analyzer import FreshTrackAnalyzer
        analyzer = FreshTrackAnalyzer()
        analyzer_budget = max(15, int(remaining() - 2.0))

        logger.info(f"Job {job_id}: Delegating to FreshTrackAnalyzer (budget {analyzer_budget}s)...")

        metadata = await analyzer.analyze_fresh_track(
            file_path=file_path,
            include_lyrics=transcribe,
            model_preference=model_preference,
            time_budget=analyzer_budget,
            job_id=job_id,
        )

        # Extract _tech_meta before sanitize (not a metadata field)
        tech_meta = metadata.pop("_tech_meta", {})

        # Attach confidence from _tech_meta and SHA-256 fingerprint
        try:
            if isinstance(tech_meta, dict) and "confidence" in tech_meta:
                metadata["confidence"] = float(tech_meta.get("confidence"))
        except Exception:
            pass
        # Attach SHA-256 fingerprint
        metadata["sha256"] = file_hash

        # Read existing file tags and merge (file tags win for identity fields only)
        try:
            from app.services.audio_analyzer import AdvancedAudioAnalyzer
            existing = AdvancedAudioAnalyzer.read_metadata(file_path) or {}
            for field in ("title", "artist", "album", "year", "isrc", "upc", "catalogNumber", "copyright", "publisher"):
                if existing.get(field) and not metadata.get(field):
                    metadata[field] = existing[field]
        except Exception as e:
            logger.warning(f"Could not read existing file tags: {e}")

        job.message = "Sanitizing and validating metadata..."
        db.commit()
        await ws_manager.send_progress(job_id, job.message, progress=85)

        final_metadata = sanitize_metadata(metadata)

        # Store result and cache
        cache.set(file_hash, final_metadata)
        job.result = final_metadata
        job.status = "completed"
        job.message = f"Analysis complete ({tech_meta.get('analysis_time', 0):.1f}s, {len([v for v in tech_meta.get('llm_sources', []) if v])} LLMs)."
        db.commit()
        await ws_manager.send_progress(job_id, job.message, progress=100, status="completed")

        # Save to history
        try:
            history = AnalysisHistory(
                file_name=job.file_name,
                file_hash=file_hash,
                metadata=json.dumps(final_metadata),
                created_at=datetime.utcnow(),
            )
            db.add(history)
            db.commit()
        except Exception as e:
            logger.warning(f"History save failed: {e}")

    except Exception as e:
        logger.error(f"Background analysis failed for Job {job_id}: {e}")
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "error"
                job.error = str(e)
                job.message = f"Analysis failed: {str(e)[:200]}"
                db.commit()
            await ws_manager.send_progress(job_id, f"Error: {str(e)[:100]}", progress=0, status="error")
        except Exception:
            pass
    finally:
        db.close()


# ── ROUTES ────────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_analysis(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    is_pro_mode: str = Form("false"),
    transcribe: str = Form("true"),
    is_fresh: str = Form("false"),
    model_preference: str = Form("flash"),
    user_and_quota: tuple = Depends(get_user_and_check_quota),
    db: Session = Depends(get_db),
):
    user, _ = user_and_quota

    # Validate file type
    allowed_exts = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    job_id = str(uuid.uuid4())
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{job_id}_{file.filename}")

    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    job = Job(
        id=job_id,
        file_name=file.filename,
        status="pending",
        message="Job queued for analysis...",
        created_at=datetime.utcnow(),
    )
    db.add(job)
    db.commit()

    time_budget = getattr(settings, "ANALYSIS_MAX_SECONDS", 20)

    background_tasks.add_task(
        process_analysis,
        job_id=job_id,
        file_path=file_path,
        is_pro_mode=is_pro_mode.lower() == "true",
        transcribe=transcribe.lower() == "true",
        is_fresh=is_fresh.lower() == "true",
        model_preference=model_preference,
        time_budget_sec=time_budget,
    )

    return {"job_id": job_id, "status": "pending"}


@router.get("/job/{job_id}")
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "id": job.id,
        "status": job.status,
        "message": job.message,
        "file_name": job.file_name,
    }

    if job.status == "completed" and job.result:
        response["result"] = job.result
    elif job.status == "error":
        response["error"] = job.error

    return response


@router.websocket("/ws/{job_id}")
async def analysis_websocket(websocket: WebSocket, job_id: str):
    await ws_manager.connect(websocket, job_id)
    try:
        while True:
            await asyncio.sleep(30)  # Keep-alive ping
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, job_id)
    except Exception:
        ws_manager.disconnect(websocket, job_id)
