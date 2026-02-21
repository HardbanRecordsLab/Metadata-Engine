"""
Analysis Routes - Zero-Cost Local + Groq Pipeline
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

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

DEPRECATED_KEYS = {
    "STRUCTURE",
    "EXPLICIT_CONTENT",
    "MUSICAL_ERA",
    "PRODUCTION_QUALITY",
    "DYNAMICS",
    "TARGET_AUDIENCE",
    "TEMPO_CHARACTER",
    "ENERGY_LEVEL",
    "explicitContent",
    "tempoCharacter",
    "energyLevel",
}

ALLOWED_METADATA_KEYS = {
    "title",
    "artist",
    "album",
    "year",
    "track",
    "albumArtist",
    "mainInstrument",
    "bpm",
    "key",
    "mode",
    "mainGenre",
    "additionalGenres",
    "moods",
    "instrumentation",
    "keywords",
    "trackDescription",
    "copyright",
    "publisher",
    "composer",
    "lyricist",
    "catalogNumber",
    "isrc",
    "iswc",
    "upc",
    "useCases",
    "language",
    "vocalStyle",
    "producer",
    "pLine",
    "duration",
    "structure",
    "coverArt",
    "sha256",  # Digital fingerprint
    "energy_level",
    "mood_vibe",
    "musicalEra",
    "productionQuality",
    "dynamics",
    "targetAudience",
    "validation_report", # Logic cross-check result
}


def deduplicate_array(arr: list) -> list:
    if not isinstance(arr, list):
        return []
    cleaned = [item.strip() for item in arr if item and isinstance(item, str)]
    cleaned = [c for c in cleaned if c]
    return sorted(set(cleaned), key=lambda s: s.lower())


def sanitize_metadata(metadata: dict) -> dict:
    if not isinstance(metadata, dict):
        raise HTTPException(status_code=500, detail="SCHEMA_VIOLATION: metadata must be object")

    for k in list(metadata.keys()):
        if k in DEPRECATED_KEYS and metadata.get(k) not in (None, "", [], {}):
            raise HTTPException(status_code=500, detail="SCHEMA_VIOLATION: deprecated field referenced")

    if "trackNumber" in metadata and "track" not in metadata:
        metadata["track"] = metadata.get("trackNumber")

    cleaned = {k: metadata.get(k) for k in ALLOWED_METADATA_KEYS if k in metadata}

    if "title" not in cleaned:
        cleaned["title"] = ""
    if "artist" not in cleaned:
        cleaned["artist"] = ""
    if "album" not in cleaned:
        cleaned["album"] = ""
    if "year" not in cleaned:
        cleaned["year"] = ""
    if "track" not in cleaned:
        cleaned["track"] = 1
    if "albumArtist" not in cleaned:
        cleaned["albumArtist"] = ""
    if "mainInstrument" not in cleaned:
        cleaned["mainInstrument"] = ""
    if "bpm" not in cleaned or cleaned.get("bpm") is None:
        cleaned["bpm"] = 0
    if "key" not in cleaned:
        cleaned["key"] = "C"
    if "mode" not in cleaned:
        cleaned["mode"] = "Major"
    if "mainGenre" not in cleaned:
        cleaned["mainGenre"] = "Unknown"
    if "additionalGenres" not in cleaned or not isinstance(cleaned.get("additionalGenres"), list):
        cleaned["additionalGenres"] = []
    if "moods" not in cleaned or not isinstance(cleaned.get("moods"), list):
        cleaned["moods"] = []
    if "energy_level" not in cleaned:
        cleaned["energy_level"] = "Medium"
    if "mood_vibe" not in cleaned:
        cleaned["mood_vibe"] = ""
    if "instrumentation" not in cleaned or not isinstance(cleaned.get("instrumentation"), list):
        cleaned["instrumentation"] = []
    if "keywords" not in cleaned or not isinstance(cleaned.get("keywords"), list):
        cleaned["keywords"] = []
    if "trackDescription" not in cleaned:
        cleaned["trackDescription"] = ""
    if "musicalEra" not in cleaned:
        cleaned["musicalEra"] = "Modern"
    if "productionQuality" not in cleaned:
        cleaned["productionQuality"] = "Studio Polished"
    if "dynamics" not in cleaned:
        cleaned["dynamics"] = "Medium"
    if "targetAudience" not in cleaned:
        cleaned["targetAudience"] = "General"
    if "useCases" not in cleaned or not isinstance(cleaned.get("useCases"), list):
        cleaned["useCases"] = []
    if "language" not in cleaned:
        cleaned["language"] = "Instrumental"
    if "catalogNumber" not in cleaned:
        cleaned["catalogNumber"] = ""
    if "isrc" not in cleaned:
        cleaned["isrc"] = ""
    if "copyright" not in cleaned:
        cleaned["copyright"] = ""
    if "publisher" not in cleaned:
        cleaned["publisher"] = ""
    if "composer" not in cleaned:
        cleaned["composer"] = ""
    if "lyricist" not in cleaned:
        cleaned["lyricist"] = ""
    if "iswc" not in cleaned:
        cleaned["iswc"] = ""
    if "upc" not in cleaned:
        cleaned["upc"] = ""
    if "producer" not in cleaned:
        cleaned["producer"] = ""
    if "pLine" not in cleaned:
        cleaned["pLine"] = ""
    if "duration" not in cleaned:
        cleaned["duration"] = 0
    if "structure" not in cleaned:
        cleaned["structure"] = []
    if "validation_report" not in cleaned:
        cleaned["validation_report"] = {}

    cleaned["additionalGenres"] = deduplicate_array(cleaned.get("additionalGenres", []))
    cleaned["moods"] = deduplicate_array(cleaned.get("moods", []))
    cleaned["instrumentation"] = deduplicate_array(cleaned.get("instrumentation", []))
    cleaned["keywords"] = deduplicate_array(cleaned.get("keywords", []))
    cleaned["useCases"] = deduplicate_array(cleaned.get("useCases", []))

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

    non_empty_arrays = ("additionalGenres", "moods", "instrumentation", "keywords", "useCases")
    for key in non_empty_arrays:
        value = cleaned.get(key)
        if isinstance(value, list) and not value:
            if key == "additionalGenres":
                cleaned[key] = ["Unknown Subgenre"]
            elif key == "moods":
                cleaned[key] = ["Unspecified"]
            elif key == "instrumentation":
                cleaned[key] = ["Unspecified"]
            elif key == "keywords":
                cleaned[key] = ["Unspecified"]
            elif key == "useCases":
                cleaned[key] = ["General"]

    if not cleaned.get("trackDescription"):
        cleaned["trackDescription"] = "Track description pending. Auto-filled to keep record complete."

    return cleaned


async def process_analysis(
    job_id: str,
    file_path: str,
    is_pro_mode: bool,
    transcribe: bool,
    is_fresh: bool = False,
    model_preference: str = 'flash',
    time_budget_sec: int | None = None,
):
    """
    Background task to process audio analysis and update job status.
    """
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

        # Step 0: SHA-256 Fingerprint (Required for Caching)
        from app.utils.hash_generator import generate_file_hash
        file_hash = generate_file_hash(file_path)

        # Step 1: Cache Check
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

        if is_fresh:
            is_fresh = False

        transcribe = False

        logger.info(f"Job {job_id}: Using Fast Local Pipeline (budget {time_budget_sec}s)...")
        job.message = f"Fast analysis mode (<= {time_budget_sec}s)..."
        db.commit()
        await ws_manager.send_progress(job_id, job.message, progress=20)

        from app.services.fresh_track_analyzer import FreshTrackAnalyzer
        
        analyzer = FreshTrackAnalyzer()
        
        # Calculate time budget for analyzer
        # Leave 2 seconds for validation and saving
        analyzer_budget = max(15, int(remaining() - 2.0))
        
        logger.info(f"Job {job_id}: Delegating to FreshTrackAnalyzer (budget {analyzer_budget}s)...")
        
        # Use FreshTrackAnalyzer to get full metadata including AI tags
        metadata = await analyzer.analyze_fresh_track(
            file_path=file_path, 
            include_lyrics=transcribe, 
            model_preference=model_preference,
            time_budget=analyzer_budget
        )
        
        # Ensure basic fields exist if analyzer didn't find them in existing metadata
        if not metadata.get("title"):
             metadata["title"] = job.file_name
        if not metadata.get("artist"):
             metadata["artist"] = "Unknown Artist"

        metadata["sha256"] = file_hash
        await ws_manager.send_progress(job_id, "Syncing metadata...", progress=80)
        
        # Step 4: Metadata Validation & Cross-check
        from app.utils.validator import MetadataValidator
        logger.info(f"Job {job_id}: Running Metadata Validation...")
        job.message = "Validating metadata consistency..."
        db.commit()
        await ws_manager.send_progress(job_id, job.message, progress=90)
        validation_timeout = max(0.1, remaining())
        if validation_timeout <= 0.1:
            raise asyncio.TimeoutError()
        metadata = await asyncio.wait_for(
            asyncio.to_thread(MetadataValidator.validate, metadata),
            timeout=validation_timeout,
        )

        # Step 5: Sanitize and Save
        job.result = sanitize_metadata(metadata)
        
        # Update Cache
        cache.set(file_hash, job.result)

        logger.info(f"Analysis successfully completed for Job {job_id}")
        
        # Cover art generation intentionally not performed automatically.
        # It is available on-demand via a dedicated endpoint.
        
        job.status = "completed"
        job.message = "Analysis complete."
        db.commit()
        await ws_manager.send_progress(job_id, job.message, progress=100, status="completed")

        # Auto-Archive to history if user_id is present
        if job.user_id:
            try:
                history_entry = AnalysisHistory(
                    user_id=str(job.user_id),
                    file_name=job.file_name,
                    result=job.result,
                    created_at=datetime.utcnow()
                )
                db.add(history_entry)
                logger.info(f"Archived Job {job_id} to history for user {job.user_id}")
                db.commit()
            except Exception as archive_err:
                logger.error(f"Failed to auto-archive Job {job_id}: {archive_err}")
                db.rollback()

    except asyncio.TimeoutError:
        logger.error(f"Background Job {job_id} timed out after {time_budget_sec}s")
        if job:
            job.status = "error"
            job.error = f"TIMEOUT_{time_budget_sec}s"
            job.message = "Analysis timed out."
            await ws_manager.send_progress(job_id, job.message, progress=100, status="error")
    except Exception as e:
        logger.error(f"Background Job {job_id} failed: {e}")
        if job:
            job.status = "error"
            job.error = str(e)
    finally:
        db.commit()
        db.close()
        # Clean up file - COMPROMISE: keep file for server-side tagging fallback
        # if os.path.exists(file_path):
        #     try:
        #         os.remove(file_path)
        #     except:
        #         pass

@router.post("/cover/generate/{job_id}")
async def generate_cover_for_job(job_id: str, db: Session = Depends(get_db)):
    """
    On-demand cover generation for a job. Uses analyzed metadata (title/artist/genre/mood).
    Saves the generated cover to uploads/{job_id}_cover.jpg and records the path in job.result["coverArt"].
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in ("completed", "processing", "pending"):
        raise HTTPException(status_code=400, detail="Invalid job status")

    from app.routes.generative import generate_cover, CoverRequest
    import base64

    cover_req = CoverRequest(
        title=job.result.get("title", job.file_name),
        artist=job.result.get("artist", "Unknown Artist"),
        genre=job.result.get("mainGenre", "Electronic"),
        mood=job.result.get("moods", ["Neutral"])[0]
        if isinstance(job.result.get("moods"), list) and job.result.get("moods")
        else job.result.get("mood_vibe", "Neutral"),
    )

    await ws_manager.send_progress(
        job_id,
        "Generating album cover art...",
        progress=85,
        status="processing",
    )

    try:
        cover_result = await asyncio.wait_for(
            generate_cover(cover_req),
            timeout=45.0,
        )
    except asyncio.TimeoutError:
        await ws_manager.send_progress(job_id, "Cover generation timeout", progress=85, status="processing")
        raise HTTPException(status_code=504, detail="Cover generation timeout")

    if not cover_result or "image" not in cover_result:
        raise HTTPException(status_code=500, detail="Cover generation failed")

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    cover_filename = f"{job_id}_cover.jpg"
    cover_path = os.path.join(upload_dir, cover_filename)

    img_data = (
        cover_result["image"].split(",", 1)[1]
        if "," in cover_result["image"]
        else cover_result["image"]
    )

    with open(cover_path, "wb") as f:
        f.write(base64.b64decode(img_data))

    job.result["coverArt"] = cover_path
    db.commit()

    await ws_manager.send_progress(
        job_id,
        "Cover art generated successfully",
        progress=90,
        status="processing",
    )

    return {"coverPath": cover_path, "status": "success"}
@router.post("/generate")
async def generate_analysis(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    is_pro_mode: bool = Form(False),
    transcribe: bool = Form(True),
    is_fresh: bool = Form(False),
    model_preference: str = Form('flash'),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user_and_check_quota)
) :
    """
    Asynchronous audio analysis pipeline:
    1. Save file to persistent storage
    2. Create Job in database (pending)
    3. Trigger background task
    4. Return job_id
    """
    job_id = str(uuid.uuid4())
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, f"{job_id}_{file.filename}")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        new_job = Job(
            id=job_id,
            user_id=current_user.id if current_user else None,
            status="pending",
            file_name=file.filename,
            timestamp=datetime.utcnow()
        )
        db.add(new_job)
        db.commit()
        
        background_tasks.add_task(
            process_analysis,
            job_id,
            file_path,
            is_pro_mode,
            transcribe,
            is_fresh,
            model_preference,
            getattr(settings, "ANALYSIS_MAX_SECONDS", 20),
        )
        
        return {"job_id": job_id, "status": "pending"}
        
    except Exception as e:
        logger.error(f"Failed to start background job: {e}")
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/job/{job_id}")
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """
    Check the status and results of a background analysis job.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return {
        "id": job.id,
        "status": job.status,
        "message": job.message,
        "result": job.result,
        "error": job.error,
        "timestamp": job.timestamp
    }


@router.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await ws_manager.connect(websocket, job_id)
    try:
        while True:
            try:
                # Wait for any message from client, but timeout every 10s to send heartbeat
                await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                await websocket.send_json({"status": "ping", "message": "keep-alive"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, job_id)
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {e}")
        ws_manager.disconnect(websocket, job_id)


@router.post("/local-only")
async def local_analysis_only(
    file: UploadFile = File(...),
):
    """
    Run local analysis only (no AI, no internet required).
    Returns: BPM, Key, Loudness, Spectral features, existing metadata.
    """
    file_content = await file.read()
    if not file_content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    temp_file_name = f"temp_{uuid.uuid4()}_{file.filename}"

    try:
        with open(temp_file_name, "wb") as buffer:
            buffer.write(file_content)

        from app.services.audio_analyzer import AdvancedAudioAnalyzer

        analysis = await asyncio.to_thread(AdvancedAudioAnalyzer.full_analysis, temp_file_name)
        core = analysis.get("core", {})
        existing = analysis.get("existing_metadata", {})
        metadata = {
            "title": existing.get("title") or file.filename,
            "artist": existing.get("artist") or "Unknown Artist",
            "album": existing.get("album") or "Single",
            "year": existing.get("year") or "",
            "track": 1,
            "albumArtist": "",
            "bpm": core.get("bpm"),
            "key": core.get("key"),
            "mode": core.get("mode"),
            "mainGenre": existing.get("genre") or "Unknown",
            "additionalGenres": [],
            "moods": core.get("moods", []),
            "instrumentation": [],
            "trackDescription": f"Audio track at {core.get('bpm', '?')} BPM in {core.get('full_key', '?')}",
            "keywords": [],
            "mainInstrument": "",
            "vocalStyle": {"gender": "none", "timbre": "none", "delivery": "none", "emotionalTone": "none"},
            "useCases": [],
            "language": "Instrumental",
        }
        return sanitize_metadata(metadata)

    except Exception as e:
        logger.error(f"Local analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    finally:
        try:
            if os.path.exists(temp_file_name):
                os.remove(temp_file_name)
        except:
            pass


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    model_size: str = Form("base"),  # tiny, base, small, medium, large
):
    """
    Transcribe audio using local Whisper model.
    """
    file_content = await file.read()
    if not file_content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    temp_file_name = f"temp_{uuid.uuid4()}_{file.filename}"

    try:
        with open(temp_file_name, "wb") as buffer:
            buffer.write(file_content)

        from app.services.groq_whisper import GroqWhisperService

        result = await GroqWhisperService.transcribe_audio(temp_file_name, model_size)
        return result

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    finally:
        try:
            if os.path.exists(temp_file_name):
                os.remove(temp_file_name)
        except:
            pass


@router.post("/separate-stems")
async def separate_stems(
    file: UploadFile = File(...),
    stems: int = Form(2),  # 2, 4, or 5
):
    """
    Separate audio into stems using Spleeter.

    stems:
    - 2: vocals, accompaniment
    - 4: vocals, drums, bass, other
    - 5: vocals, drums, bass, piano, other
    """
    file_content = await file.read()
    if not file_content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    temp_file_name = f"temp_{uuid.uuid4()}_{file.filename}"
    output_dir = f"stems_{uuid.uuid4()}"

    try:
        with open(temp_file_name, "wb") as buffer:
            buffer.write(file_content)

        os.makedirs(output_dir, exist_ok=True)

        from app.services.audio_analyzer import AdvancedAudioAnalyzer

        result = await AdvancedAudioAnalyzer.separate_stems(
            temp_file_name, output_dir, stems
        )

        return {
            "stems": result,
            "output_directory": output_dir,
            "note": "Stem files are saved on the server. Download them before cleanup.",
        }

    except Exception as e:
        logger.error(f"Stem separation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Stem separation failed: {str(e)}")

    finally:
        try:
            if os.path.exists(temp_file_name):
                os.remove(temp_file_name)
        except:
            pass

        try:
            if os.path.exists(temp_file_name):
                os.remove(temp_file_name)
        except:
            pass
