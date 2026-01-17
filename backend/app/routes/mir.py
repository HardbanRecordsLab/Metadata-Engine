from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from app.services.mir import MIRService
import shutil
import os
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/mir", tags=["mir"])

TEMP_DIR = "temp_uploads"
os.makedirs(TEMP_DIR, exist_ok=True)


class TaggingRequest(BaseModel):
    # For when we tag a file that's already on the server (advanced flow)
    # or passing metadata to be embedded in a temporary file
    metadata: dict


@router.post("/analyze")
async def analyze_audio_track(file: UploadFile = File(...)):
    """
    Receives an audio file, saves it temporarily, and runs Librosa analysis.
    Returns calculated BPM, Key, and technical details.
    """

    print(f"DEBUG: Received analysis request for {file.filename}")
    if not MIRService.is_available():
        print("DEBUG: MIR Service unavailable")
        return JSONResponse(
            status_code=503,
            content={
                "error": "MIR libraries (Librosa) not active on server. Check installation."
            },
        )

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    temp_path = os.path.join(TEMP_DIR, f"{file_id}{ext}")

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Run Analysis
        print(f"DEBUG: Starting MIRService.analyze_audio for {temp_path}")
        analysis_result = await MIRService.analyze_audio(temp_path)
        print("DEBUG: Analysis complete")

        # Clean up? Or keep for tagging?
        # For now, clean up.
        os.remove(temp_path)

        return JSONResponse(content=analysis_result)

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/tag_and_download")
async def tag_and_download_track(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    metadata_json: str = "{}",
):
    """
    Upload a file + Metadata JSON.
    Backend repairs tags using Mutagen.
    Returns the tagged file.
    """
    import json

    if not MIRService.is_available():
        return JSONResponse(status_code=503, content={"error": "Mutagen not active."})

    try:
        metadata = json.loads(metadata_json)
    except:
        return JSONResponse(status_code=400, content={"error": "Invalid metadata JSON"})

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    temp_path = os.path.join(TEMP_DIR, f"tagging_{file_id}{ext}")

    try:
        # Save
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Tag
        MIRService.write_metadata(temp_path, metadata)

        # Return file
        # Use BackgroundTasks to delete file after sending
        background_tasks.add_task(os.remove, temp_path)

        return FileResponse(
            temp_path, media_type="audio/mpeg", filename=f"tagged_{file.filename}"
        )

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/batch_analyze")
async def batch_analyze_tracks(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...)
):
    """
    Batch analyze multiple audio files with optimized processing.
    Files are processed concurrently using the BatchProcessor service.
    
    Returns job IDs that can be used to track progress.
    """
    from app.services.batch_processor import batch_processor
    from app.db import SessionLocal, Job
    from datetime import datetime
    
    if not MIRService.is_available():
        return JSONResponse(
            status_code=503,
            content={"error": "MIR libraries not available"}
        )
    
    db = SessionLocal()
    job_file_pairs = []
    
    try:
        # Save all files and create job records
        for file in files:
            file_id = str(uuid.uuid4())
            ext = os.path.splitext(file.filename)[1]
            temp_path = os.path.join(TEMP_DIR, f"batch_{file_id}{ext}")
            
            # Save file
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Create job record
            job = Job(
                id=file_id,
                file_name=file.filename,
                status="queued",
                timestamp=datetime.now()
            )
            db.add(job)
            job_file_pairs.append((file_id, temp_path))
        
        db.commit()
        
        # Process batch in background
        async def process_and_cleanup():
            await batch_processor.process_batch(job_file_pairs)
            # Cleanup files after processing
            for _, file_path in job_file_pairs:
                if os.path.exists(file_path):
                    os.remove(file_path)
        
        background_tasks.add_task(process_and_cleanup)
        
        return JSONResponse(content={
            "message": f"Batch of {len(files)} files queued for processing",
            "job_ids": [job_id for job_id, _ in job_file_pairs],
            "queue_status": batch_processor.get_queue_status()
        })
        
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        db.close()
