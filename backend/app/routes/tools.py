from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
import tempfile
import os
import shutil
import subprocess
import logging
from mutagen.id3 import ID3
from mutagen.flac import FLAC
from mutagen.wave import WAVE
from app.utils.validator import MetadataValidator
from app.db import SessionLocal, Job
import json
import zipfile
import io

logger = logging.getLogger(__name__)
router = APIRouter()

def cleanup_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        logger.error(f"Error cleaning up file {path}: {e}")

@router.post("/tools/strip-metadata")
async def strip_metadata(file: UploadFile = File(...)):
    """
    Removes all metadata/tags from an audio file using FFmpeg.
    """
    suffix = os.path.splitext(file.filename)[1].lower()
    fd, input_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    
    fd_out, output_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd_out)

    try:
        with open(input_path, 'wb') as f:
            shutil.copyfileobj(file.file, f)

        # Use FFmpeg to strip metadata: -map_metadata -1
        cmd = [
            'ffmpeg', '-y', '-i', input_path, 
            '-map_metadata', '-1', 
            '-c:a', 'copy', # Copy audio stream without re-encoding
            output_path
        ]
        
        process = subprocess.run(cmd, capture_output=True, text=True)
        
        if process.returncode != 0:
            logger.error(f"FFmpeg strip error: {process.stderr}")
            raise HTTPException(status_code=500, detail="Failed to strip metadata.")

        return FileResponse(
            output_path,
            media_type='application/octet-stream',
            filename=f"clean_{file.filename}",
            background=BackgroundTask(lambda: (cleanup_file(input_path), cleanup_file(output_path)))
        )
    except Exception as e:
        cleanup_file(input_path)
        cleanup_file(output_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tools/validate")
async def validate_music(file: UploadFile = File(None), metadata: str = Form(None)):
    """
    Runs a professional health check on the music file.
    If metadata is provided as JSON string, it validates consistency.
    """
    # This is a bit of a mockup since full validation needs the file to be analyzed first
    # But we can at least return a report based on provided/extracted-so-far tags
    try:
        meta_dict = json.loads(metadata) if metadata else {}
        report = MetadataValidator.validate(meta_dict)
        return JSONResponse(content=report)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")

@router.post("/tools/convert")
async def convert_format(
    file: UploadFile = File(...), 
    target_format: str = Form(...) # 'mp3', 'wav', 'flac'
):
    """
    Converts audio between formats.
    """
    valid_formats = ['mp3', 'wav', 'flac', 'aiff']
    target_format = target_format.lower().replace('.', '')
    
    if target_format not in valid_formats:
        raise HTTPException(status_code=400, detail="Unsupported target format.")

    suffix_in = os.path.splitext(file.filename)[1].lower()
    suffix_out = f".{target_format}"
    
    fd_in, input_path = tempfile.mkstemp(suffix=suffix_in)
    os.close(fd_in)
    
    fd_out, output_path = tempfile.mkstemp(suffix=suffix_out)
    os.close(fd_out)

    try:
        with open(input_path, 'wb') as f:
            shutil.copyfileobj(file.file, f)

        # Convert using FFmpeg
        cmd = ['ffmpeg', '-y', '-i', input_path]
        
        if target_format == 'mp3':
            cmd.extend(['-b:a', '320k']) # High quality mp3
        
        cmd.append(output_path)
        
        process = subprocess.run(cmd, capture_output=True, text=True)
        
        if process.returncode != 0:
            logger.error(f"FFmpeg conversion error: {process.stderr}")
            raise HTTPException(status_code=500, detail="Conversion failed.")

        return FileResponse(
            output_path,
            media_type='application/octet-stream',
            filename=f"converted_{os.path.splitext(file.filename)[0]}.{target_format}",
            background=BackgroundTask(lambda: (cleanup_file(input_path), cleanup_file(output_path)))
        )
    except Exception as e:
        cleanup_file(input_path)
        cleanup_file(output_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tools/fingerprint")
async def get_fingerprint(file: UploadFile = File(...)):
    """
    Generates a Chromaprint/AcoustID hash for fingerprinting.
    """
    suffix = os.path.splitext(file.filename)[1].lower()
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)

    try:
        with open(path, 'wb') as f:
            shutil.copyfileobj(file.file, f)

        # Use fpcalc if available, or ffmpeg chromaprint
        # Since we saw chromaprint in ffmpeg -version, we use ffmpeg to get it
        cmd = [
            'ffmpeg', '-i', path, 
            '-f', 'chromaprint', 
            '-'
        ]
        
        process = subprocess.run(cmd, capture_output=True)
        
        # Result is binary data, converting to hex for JSON
        fingerprint = process.stdout.hex() if process.stdout else "unknown"
        
        cleanup_file(path)
        return {
            "filename": file.filename,
            "fingerprint_short": fingerprint[:64],
            "status": "generated",
            "provider": "ffmpeg-chromaprint"
        }
    except Exception as e:
        cleanup_file(path)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tools/bulk-export")
async def bulk_export(job_ids: str = Form(...)):
    """
    Combines metadata for multiple jobs into a single CSV.
    """
    ids = [id.strip() for id in job_ids.split(',')]
    db = SessionLocal()
    try:
        jobs = db.query(Job).filter(Job.id.in_(ids)).all()
        if not jobs:
            raise HTTPException(status_code=404, detail="No jobs found for these IDs.")
        
        output = io.StringIO()
        output.write("job_id,filename,bpm,key,genre,status\n")
        for job in jobs:
            try:
                meta = json.loads(job.metadata_json or '{}')
                output.write(f"{job.id},{job.file_name},{meta.get('bpm',0)},{meta.get('key','')},{meta.get('mainGenre','')},{job.status}\n")
            except:
                continue
        
        output.seek(0)
        return JSONResponse(content={"csv": output.getvalue(), "count": len(jobs)})
    finally:
        db.close()
