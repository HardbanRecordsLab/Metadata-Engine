"""
Export Routes - CSV, JSON, and other format exports
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime
import csv
import json
import io
import logging

from app.db import SessionLocal, Job

router = APIRouter(prefix="/export", tags=["export"])
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def metadata_to_csv_row(metadata: Dict[str, Any], filename: str, ipfs_hash: str = None, ipfs_url: str = None) -> Dict[str, str]:
    """
    Convert metadata dictionary to CSV row compatible with MP3Tag.
    
    Format matches mp3tag_mapping.txt specification.
    """
    # Extract vocal style components
    vocal_style = metadata.get('vocalStyle', {})
    
    return {
        'filename': filename,
        'title': metadata.get('title', ''),
        'artist': metadata.get('artist', ''),
        'album': metadata.get('album', ''),
        'year': str(metadata.get('year', '')),
        'track': str(metadata.get('track', '')),
        'MAIN_INSTRUMENT': metadata.get('mainInstrument', ''),
        'TKEY': metadata.get('key', ''),
        'KEY_EXT': metadata.get('key', ''),
        'MODE': metadata.get('mode', ''),
        'bpm': str(metadata.get('bpm', '')),
        'BPM_EXT': str(metadata.get('bpm', '')),
        'genre': metadata.get('mainGenre', ''),
        'SUBGENRE': ', '.join(metadata.get('additionalGenres', [])),
        'comment': metadata.get('trackDescription', ''),
        'KEYWORDS': ', '.join(metadata.get('keywords', [])),
        'copyright': metadata.get('copyright', ''),
        'publisher': metadata.get('publisher', ''),
        'composer': metadata.get('composer', ''),
        'lyricist': metadata.get('lyricist', ''),
        'albumartist': metadata.get('albumArtist', ''),
        'CATALOGNUMBER': metadata.get('catalogNumber', ''),
        'isrc': metadata.get('isrc', ''),
        'MOOD': ', '.join(metadata.get('moods', [])),
        'MOOD_VIBE': metadata.get('mood_vibe', ''),
        'ENERGY': metadata.get('energy_level', ''),
        'INSTRUMENTATION': ', '.join(metadata.get('instrumentation', [])),
        'VOCAL_STYLE_GENDER': vocal_style.get('gender', ''),
        'VOCAL_STYLE_TIMBRE': vocal_style.get('timbre', ''),
        'VOCAL_STYLE_DELIVERY': vocal_style.get('delivery', ''),
        'VOCAL_STYLE_EMOTIONALTONE': vocal_style.get('emotionalTone', ''),
        'USAGE': ', '.join(metadata.get('useCases', [])),
        'LANGUAGE': metadata.get('language', ''),
        'SHA256': metadata.get('sha256', ''),
        'ipfs_hash': ipfs_hash or '',
        'ipfs_url': ipfs_url or '',
    }


@router.get("/csv/{job_id}")
async def export_csv(job_id: str, db: Session = Depends(get_db)):
    """
    Export analysis results to CSV format (MP3Tag compatible).
    
    Returns CSV file for download.
    """
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Job not completed yet")
        
        if not job.result:
            raise HTTPException(status_code=400, detail="No results available")
        
        # Convert metadata to CSV row
        csv_row = metadata_to_csv_row(
            job.result, 
            job.file_name,
            getattr(job, "ipfs_hash", None),
            getattr(job, "ipfs_url", None)
        )
        
        # Create CSV in memory
        output = io.StringIO()
        fieldnames = [
            'filename', 'title', 'artist', 'album', 'year', 'track',
            'MAIN_INSTRUMENT', 'TKEY', 'KEY_EXT', 'MODE', 'bpm', 'BPM_EXT', 
            'genre', 'SUBGENRE', 'comment', 'KEYWORDS', 'copyright', 
            'publisher', 'composer', 'lyricist', 'albumartist', 'CATALOGNUMBER', 
            'isrc', 'MOOD', 'MOOD_VIBE', 'ENERGY', 'INSTRUMENTATION', 
            'VOCAL_STYLE_GENDER', 'VOCAL_STYLE_TIMBRE', 'VOCAL_STYLE_DELIVERY', 
            'VOCAL_STYLE_EMOTIONALTONE', 'USAGE', 'LANGUAGE', 'SHA256',
            'ipfs_hash', 'ipfs_url'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(csv_row)
        
        # Prepare response
        output.seek(0)
        filename = f"metadata_{job.file_name.rsplit('.', 1)[0]}.csv"
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CSV export failed for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/json/{job_id}")
async def export_json(job_id: str, pretty: bool = True, db: Session = Depends(get_db)):
    """
    Export analysis results to JSON format.
    
    Args:
        job_id: Job ID
        pretty: Pretty-print JSON (default: True)
    
    Returns JSON file for download.
    """
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Job not completed yet")
        
        if not job.result:
            raise HTTPException(status_code=400, detail="No results available")
        
        # Create JSON structure
        export_data = {
            "metadata": job.result,
            "file_info": {
                "original_filename": job.file_name,
                "analysis_timestamp": job.timestamp.isoformat() if job.timestamp else None,
                "job_id": job.id
            }
        }
        
        # Serialize to JSON
        if pretty:
            json_str = json.dumps(export_data, indent=2, ensure_ascii=False)
        else:
            json_str = json.dumps(export_data, ensure_ascii=False)
        
        # Prepare response
        filename = f"metadata_{job.file_name.rsplit('.', 1)[0]}.json"
        
        return Response(
            content=json_str,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"JSON export failed for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/csv")
async def export_batch_csv(job_ids: List[str], db: Session = Depends(get_db)):
    """
    Export multiple analysis results to a single CSV file.
    
    Args:
        job_ids: List of job IDs to export
    
    Returns CSV file with all results.
    """
    try:
        # Fetch all jobs
        jobs = db.query(Job).filter(Job.id.in_(job_ids)).all()
        
        if not jobs:
            raise HTTPException(status_code=404, detail="No jobs found")
        
        # Create CSV in memory
        output = io.StringIO()
        fieldnames = [
            'filename', 'title', 'artist', 'album', 'year', 'track',
            'MAIN_INSTRUMENT', 'TKEY', 'KEY_EXT', 'MODE', 'bpm', 'BPM_EXT', 
            'genre', 'SUBGENRE', 'comment', 'KEYWORDS', 'copyright', 
            'publisher', 'composer', 'lyricist', 'albumartist', 'CATALOGNUMBER', 
            'isrc', 'MOOD', 'MOOD_VIBE', 'ENERGY', 'INSTRUMENTATION', 
            'VOCAL_STYLE_GENDER', 'VOCAL_STYLE_TIMBRE', 'VOCAL_STYLE_DELIVERY', 
            'VOCAL_STYLE_EMOTIONALTONE', 'USAGE', 'LANGUAGE', 'SHA256'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        # Write each job's metadata
        for job in jobs:
            if job.status == "completed" and job.result:
                csv_row = metadata_to_csv_row(job.result, job.file_name)
                writer.writerow(csv_row)
        
        # Prepare response
        output.seek(0)
        filename = f"batch_metadata_{len(jobs)}_tracks.csv"
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch CSV export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/json")
async def export_batch_json(job_ids: List[str], pretty: bool = True, db: Session = Depends(get_db)):
    """
    Export multiple analysis results to a single JSON file.
    
    Args:
        job_ids: List of job IDs to export
        pretty: Pretty-print JSON (default: True)
    
    Returns JSON file with all results.
    """
    try:
        # Fetch all jobs
        jobs = db.query(Job).filter(Job.id.in_(job_ids)).all()
        
        if not jobs:
            raise HTTPException(status_code=404, detail="No jobs found")
        
        # Create JSON structure
        export_data = {
            "tracks": [],
            "summary": {
                "total_tracks": len(jobs),
                "completed": sum(1 for j in jobs if j.status == "completed"),
                "export_timestamp": datetime.utcnow().isoformat() + "Z"
            }
        }
        
        # Add each job's metadata
        for job in jobs:
            if job.status == "completed" and job.result:
                export_data["tracks"].append({
                    "filename": job.file_name,
                    "metadata": job.result,
                    "analysis_timestamp": job.timestamp.isoformat() if job.timestamp else None
                })
        
        # Serialize to JSON
        if pretty:
            json_str = json.dumps(export_data, indent=2, ensure_ascii=False)
        else:
            json_str = json.dumps(export_data, ensure_ascii=False)
        
        # Prepare response
        filename = f"batch_metadata_{len(jobs)}_tracks.json"
        
        return Response(
            content=json_str,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch JSON export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/ddex/{job_id}")
async def export_ddex(job_id: str, db: Session = Depends(get_db)):
    """
    Export analysis results to DDEX ERN 4.3 XML format.
    """
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Job not completed yet")
        
        if not job.result:
            raise HTTPException(status_code=400, detail="No results available")
        
        from app.services.ddex_orchestrator import DDEXOrchestrator
        from app.services.sonic_intelligence import TrackMetadata
        
        # Prepare metadata for orchestrator
        # We need to map the stored result to TrackMetadata schema
        metadata = job.result
        vocal_style = metadata.get('vocalStyle', {})
        
        track_data = TrackMetadata(
            title=metadata.get('title') or "Unknown Title",
            artist=metadata.get('artist') or "Unknown Artist",
            isrc=metadata.get('isrc') or "US-XXX-YY-00001",
            bpm=float(metadata.get('bpm') or 0),
            key=f"{metadata.get('key', '')} {metadata.get('mode', '')}".strip(),
            lufs=-14.0, # Result might not have LUFS yet
            danceability=0.5,
            mood_vibe=metadata.get('mood_vibe') or "Neutral",
            energy_level=0.5,
            fingerprint=metadata.get('sha256') or "0"*64
        )
        # Note: TrackMetadata Pydantic model might validate fields strictness. 
        # Duration handling logic is inside Orchestrator template currently as default. 
        
        xml_content = DDEXOrchestrator.generate_xml(track_data)
        
        filename = f"ddex_{job.file_name.rsplit('.', 1)[0]}_{job_id[:8]}.xml"
        
        return Response(
            content=xml_content,
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DDEX export failed for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cwr/{job_id}")
async def export_cwr(job_id: str, db: Session = Depends(get_db)):
    """
    Export analysis results to CWR (Common Works Registration) V2.1 format.
    """
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Job not completed yet")
        
        if not job.result:
            raise HTTPException(status_code=400, detail="No results available")
        
        from app.services.cwr_gen import CWRGenerator
        
        # Generate CWR content
        cwr_content = CWRGenerator.generate_cwr(job.result)
        
        filename = f"CW_{job.file_name.rsplit('.', 1)[0]}_{job_id[:8]}.V21"
        
        return Response(
            content=cwr_content,
            # Validation: CWR is often treated as text/plain or application/octet-stream
            media_type="text/plain", 
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CWR export failed for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
