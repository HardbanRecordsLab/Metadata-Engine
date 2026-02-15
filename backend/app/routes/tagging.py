from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db import SessionLocal, Job, get_db
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
import tempfile
import os
import shutil
import json
import logging
from mutagen.wave import WAVE
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TCON, TDRC, COMM, TXXX, TBPM, TPUB, TCOP, TKEY, WCOP, TRCK, TLAN, TPE2, TCOM, TEXT, TSRC, APIC
from mutagen.flac import FLAC, Picture
from app.utils.audio_metadata import is_valid_isrc
import base64

logger = logging.getLogger(__name__)
router = APIRouter()

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
    "musicalEra",
    "productionQuality",
    "dynamics",
    "targetAudience",
    "tempoCharacter",
    "energyLevel",
}

ALLOWED_TXXX = {
    "MAIN_INSTRUMENT",
    "SUBGENRE",
    "KEYWORDS",
    "CATALOGNUMBER",
    "MOOD",
    "INSTRUMENTATION",
    "USAGE",
    "VOCAL_STYLE",
    "ISWC",
    "UPC",
    "OTHER",
    "P_LINE",
    "PRODUCER",
}


def validate_and_normalize_metadata(meta: dict) -> dict:
    if not meta.get("title") or not isinstance(meta.get("title"), str):
        raise HTTPException(
            status_code=400,
            detail="Missing or invalid 'title' - must be a string",
        )

    if not meta.get("artist") or not isinstance(meta.get("artist"), str):
        raise HTTPException(
            status_code=400,
            detail="Missing or invalid 'artist' - must be a string",
        )

    meta["title"] = str(meta["title"]).strip()
    meta["artist"] = str(meta["artist"]).strip()
    meta["album"] = str(meta.get("album", "Single")).strip()

    for key in ["title", "artist", "album"]:
        meta[key] = meta[key].replace("\n", " ").replace("\r", " ").strip()

    return meta


def parse_title_artist(filename: str) -> tuple[str, str]:
    name = filename.rsplit(".", 1)[0]

    if " - " in name:
        parts = name.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    if " – " in name:
        parts = name.split(" – ", 1)
        return parts[0].strip(), parts[1].strip()

    return "Unknown Artist", name.strip()

def cleanup_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        logger.error(f"Error cleaning up file {path}: {e}")

def _sanitize_meta(meta: dict):
    for k in meta.keys():
        if k in DEPRECATED_KEYS and meta.get(k) not in (None, "", [], {}):
            raise HTTPException(status_code=400, detail="SCHEMA_VIOLATION: deprecated field referenced")

def _safe_str(v):
    if v is None:
        return ""
    return str(v).replace("\r", " ").replace("\n", " ").strip()

def _join_list(v):
    if not isinstance(v, list):
        return ""
    parts = [_safe_str(x) for x in v]
    parts = [p for p in parts if p]
    parts = sorted(set(parts), key=lambda s: s.lower())
    return ", ".join(parts)

def _build_tkey(meta: dict) -> str:
    key = _safe_str(meta.get("key"))
    mode = _safe_str(meta.get("mode"))
    if not key:
        return ""
    key_l = key.lower()
    if "major" in key_l or "minor" in key_l or "modal" in key_l:
        return key
    if mode:
        return f"{key} {mode}"
    return key

def _serialize_vocal_style(vs) -> str:
    if not isinstance(vs, dict):
        payload = {"gender": "none", "timbre": "none", "delivery": "none", "emotionalTone": "none"}
    else:
        gender = _safe_str(vs.get("gender")).lower()
        is_none = (not gender) or gender in ("none", "instrumental")
        if is_none:
            payload = {"gender": "none", "timbre": "none", "delivery": "none", "emotionalTone": "none"}
        else:
            payload = {
                "gender": _safe_str(vs.get("gender")),
                "timbre": _safe_str(vs.get("timbre")),
                "delivery": _safe_str(vs.get("delivery")),
                "emotionalTone": _safe_str(vs.get("emotionalTone")),
            }
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)

@router.post("/tag/file")
async def tag_file(
    file: UploadFile = File(...),
    metadata: str = Form(...)
):
    try:
        meta = json.loads(metadata)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid metadata JSON")
    if not isinstance(meta, dict):
        raise HTTPException(status_code=400, detail="Invalid metadata JSON")
    _sanitize_meta(meta)

    if not meta.get("title") or not meta.get("artist"):
        parsed_artist, parsed_title = parse_title_artist(file.filename)
        meta.setdefault("title", parsed_title)
        meta.setdefault("artist", parsed_artist)

    meta = validate_and_normalize_metadata(meta)

    # Create temp file
    suffix = os.path.splitext(file.filename)[1].lower()
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)

    try:
        # Write uploaded content to temp file
        with open(path, 'wb') as f:
            shutil.copyfileobj(file.file, f)

        # Apply Tags
        if suffix == '.mp3':
            tag_mp3(path, meta)
        elif suffix == '.flac':
            tag_flac(path, meta)
        elif suffix == '.wav':
            tag_wav(path, meta)
        else:
            # If unknown format, just return original (or error)
            pass 

        # Return file
        return FileResponse(
            path, 
            media_type='application/octet-stream', 
            filename=f"tagged_{file.filename}",
            background=BackgroundTask(cleanup_file, path)
        )

    except Exception as e:
        cleanup_file(path)
        logger.error(f"Tagging error: {e}")
        raise HTTPException(status_code=500, detail=f"Tagging failed: {str(e)}")

@router.post("/tag/job/{job_id}")
async def tag_existing_job(
    job_id: str,
    metadata: str = Form(...),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Find file in uploads
    # In analysis.py, path is uploads/{job_id}_{filename}
    upload_dir = "uploads"
    file_path = os.path.join(upload_dir, f"{job_id}_{job.file_name}")
    
    if not os.path.exists(file_path):
        # Check if it's maybe just {job_id} or something else?
        # Based on analysis.py: file_path = os.path.join(upload_dir, f"{job_id}_{file.filename}")
        raise HTTPException(status_code=410, detail="Source file has been cleaned up from server. Please re-upload.")

    try:
        meta = json.loads(metadata)
        _sanitize_meta(meta)

        if not meta.get("title") or not meta.get("artist"):
            parsed_artist, parsed_title = parse_title_artist(job.file_name)
            meta.setdefault("title", parsed_title)
            meta.setdefault("artist", parsed_artist)

        meta = validate_and_normalize_metadata(meta)
        
        # If no coverArt in metadata but jobId exists, try to find local cover
        if not meta.get("coverArt") and job_id:
            cover_path = os.path.join(upload_dir, f"{job_id}_cover.jpg")
            if os.path.exists(cover_path):
                try:
                    with open(cover_path, "rb") as cf:
                        img_data = cf.read()
                        b64 = base64.b64encode(img_data).decode("utf-8")
                        meta["coverArt"] = f"data:image/jpeg;base64,{b64}"
                except Exception as ice:
                    logger.error(f"Could not load server-side cover for job {job_id}: {ice}")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid metadata: {str(e)}")

    # Create temp copy for tagging (to avoid corrupting original during concurrent requests)
    suffix = os.path.splitext(job.file_name)[1].lower()
    fd, tagged_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    
    try:
        shutil.copy2(file_path, tagged_path)
        
        if suffix == '.mp3':
            tag_mp3(tagged_path, meta)
        elif suffix == '.flac':
            tag_flac(tagged_path, meta)
        elif suffix == '.wav':
            tag_wav(tagged_path, meta)
            
        return FileResponse(
            tagged_path,
            media_type='application/octet-stream',
            filename=f"tagged_{job.file_name}",
            background=BackgroundTask(cleanup_file, tagged_path)
        )
    except Exception as e:
        cleanup_file(tagged_path)
        logger.error(f"Server-side tagging error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def safe_get(d, key, default=""):
    return str(d.get(key, default) or "").strip()

def tag_id3_common(audio, meta):
    audio.delall("TXXX")
    audio.delall("USLT")
    audio.delall("COMM")

    if meta.get("title"):
        audio.add(TIT2(encoding=3, text=_safe_str(meta["title"])))
    if meta.get("artist"):
        audio.add(TPE1(encoding=3, text=_safe_str(meta["artist"])))
    if meta.get("album"):
        audio.add(TALB(encoding=3, text=_safe_str(meta["album"])))
    if meta.get("year"):
        audio.add(TDRC(encoding=3, text=_safe_str(meta["year"])))

    track = meta.get("track", meta.get("trackNumber"))
    if track:
        audio.add(TRCK(encoding=3, text=_safe_str(track)))

    if meta.get("bpm"):
        audio.add(TBPM(encoding=3, text=_safe_str(meta["bpm"])))

    tkey = _build_tkey(meta)
    if tkey:
        audio.add(TKEY(encoding=3, text=tkey))

    if meta.get("mainGenre"):
        audio.add(TCON(encoding=3, text=_safe_str(meta["mainGenre"])))

    if meta.get("trackDescription"):
        audio.add(COMM(encoding=3, lang="eng", desc="", text=_safe_str(meta["trackDescription"])))

    if meta.get("copyright"):
        audio.add(TCOP(encoding=3, text=_safe_str(meta["copyright"])))
    if meta.get("publisher"):
        audio.add(TPUB(encoding=3, text=_safe_str(meta["publisher"])))
    if meta.get("composer"):
        audio.add(TCOM(encoding=3, text=_safe_str(meta["composer"])))
    if meta.get("lyricist"):
        audio.add(TEXT(encoding=3, text=_safe_str(meta["lyricist"])))
    if meta.get("albumArtist"):
        audio.add(TPE2(encoding=3, text=_safe_str(meta["albumArtist"])))

    if meta.get("isrc"):
        isrc = _safe_str(meta["isrc"]).upper().replace("-", "")
        if is_valid_isrc(isrc):
            audio.add(TSRC(encoding=3, text=isrc))

    if meta.get("language"):
        audio.add(TLAN(encoding=3, text=_safe_str(meta["language"])))

    vs = meta.get("vocalStyle") or {}
    txxx_values = {
        "MAIN_INSTRUMENT": _safe_str(meta.get("mainInstrument")),
        "SUBGENRE": _join_list(meta.get("additionalGenres")),
        "KEYWORDS": _join_list(meta.get("keywords")),
        "CATALOGNUMBER": _safe_str(meta.get("catalogNumber")),
        "MOOD": _join_list(meta.get("moods")),
        "INSTRUMENTATION": _join_list(meta.get("instrumentation")),
        "USAGE": _join_list(meta.get("useCases")),
        "VOCAL_STYLE": _serialize_vocal_style(vs),
        "VOCAL_STYLE_GENDER": _safe_str(vs.get("gender")),
        "VOCAL_STYLE_TIMBRE": _safe_str(vs.get("timbre")),
        "VOCAL_STYLE_DELIVERY": _safe_str(vs.get("delivery")),
        "VOCAL_STYLE_EMOTIONALTONE": _safe_str(vs.get("emotionalTone")),
        "ISWC": _safe_str(meta.get("iswc")),
        "UPC": _safe_str(meta.get("upc")),
        "OTHER": _safe_str(meta.get("other")),
        "P_LINE": _safe_str(meta.get("pLine")),
        "PRODUCER": _safe_str(meta.get("producer")),
    }

    for desc, value in txxx_values.items():
        if desc not in ALLOWED_TXXX:
            continue
        if value:
            audio.add(TXXX(encoding=3, desc=desc, text=value))
            
    # Handle Cover Art (APIC)
    cover_art = meta.get("coverArt")
    if cover_art and cover_art.startswith("data:image"):
        try:
            header, encoded = cover_art.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
            image_data = base64.b64decode(encoded)
            
            # Remove existing APIC
            audio.delall("APIC")
            audio.add(APIC(
                encoding=3,
                mime=mime_type,
                type=3, # Front Cover
                desc='Cover',
                data=image_data
            ))
        except Exception as e:
            logger.error(f"Failed to embed ID3 cover art: {e}")

def tag_mp3(path, meta):
    try:
        audio = MP3(path, ID3=ID3)
    except Exception:
        audio = MP3(path)
        audio.add_tags()
    
    if audio.tags is None:
        audio.add_tags()
    
    tag_id3_common(audio.tags, meta)
    audio.save()

def tag_wav(path, meta):
    try:
        audio = WAVE(path)
    except Exception:
        # If headers are weird, mutagen might fail, but WAVE usually works on valid WAVs
        return 
    
    if audio.tags is None:
        audio.add_tags()
    
    tag_id3_common(audio.tags, meta)
    audio.save()

def tag_flac(path, meta):
    try:
        audio = FLAC(path)
    except Exception:
        return

    if meta.get("title"):
        audio["TITLE"] = safe_get(meta, "title")
    if meta.get("artist"):
        audio["ARTIST"] = safe_get(meta, "artist")
    if meta.get("album"):
        audio["ALBUM"] = safe_get(meta, "album")
    if meta.get("mainGenre"):
        audio["GENRE"] = safe_get(meta, "mainGenre")
    if meta.get("year"):
        audio["DATE"] = safe_get(meta, "year")
    track = meta.get("track", meta.get("trackNumber"))
    if track:
        audio["TRACKNUMBER"] = safe_get({"v": track}, "v")
    if meta.get("bpm"):
        audio["BPM"] = safe_get(meta, "bpm")

    tkey = _build_tkey(meta)
    if tkey:
        audio["TKEY"] = tkey

    if meta.get("trackDescription"):
        audio["COMMENT"] = safe_get(meta, "trackDescription")
    if meta.get("copyright"):
        audio["COPYRIGHT"] = safe_get(meta, "copyright")
    if meta.get("publisher"):
        audio["PUBLISHER"] = safe_get(meta, "publisher")
    if meta.get("isrc"):
        audio["ISRC"] = safe_get(meta, "isrc")
    if meta.get("language"):
        audio["LANGUAGE"] = safe_get(meta, "language")
    if meta.get("albumArtist"):
        audio["ALBUMARTIST"] = safe_get(meta, "albumArtist")
    if meta.get("composer"):
        audio["COMPOSER"] = safe_get(meta, "composer")
    if meta.get("lyricist"):
        audio["LYRICIST"] = safe_get(meta, "lyricist")

    if meta.get("mainInstrument"):
        audio["MAIN_INSTRUMENT"] = safe_get(meta, "mainInstrument")
    if meta.get("catalogNumber"):
        audio["CATALOGNUMBER"] = safe_get(meta, "catalogNumber")

    if meta.get("moods"):
        audio["MOOD"] = _join_list(meta.get("moods"))
    if meta.get("keywords"):
        audio["KEYWORDS"] = _join_list(meta.get("keywords"))
    if meta.get("additionalGenres"):
        audio["SUBGENRE"] = _join_list(meta.get("additionalGenres"))
    if meta.get("instrumentation"):
        audio["INSTRUMENTATION"] = _join_list(meta.get("instrumentation"))
    if meta.get("useCases"):
        audio["USAGE"] = _join_list(meta.get("useCases"))

    vs = meta.get("vocalStyle") or {}
    audio["VOCAL_STYLE"] = _serialize_vocal_style(vs)
    audio["VOCAL_STYLE_GENDER"] = _safe_str(vs.get("gender"))
    audio["VOCAL_STYLE_TIMBRE"] = _safe_str(vs.get("timbre"))
    audio["VOCAL_STYLE_DELIVERY"] = _safe_str(vs.get("delivery"))
    audio["VOCAL_STYLE_EMOTIONALTONE"] = _safe_str(vs.get("emotionalTone"))
    
    if meta.get("iswc"):
        audio["ISWC"] = safe_get(meta, "iswc")
    if meta.get("upc"):
        audio["UPC"] = safe_get(meta, "upc")
    if meta.get("pLine"):
        audio["P_LINE"] = safe_get(meta, "pLine")
    if meta.get("producer"):
        audio["PRODUCER"] = safe_get(meta, "producer")
    if meta.get("other"):
        audio["OTHER"] = safe_get(meta, "other")
    
    # Handle Cover Art (FLAC Picture)
    cover_art = meta.get("coverArt")
    if cover_art and cover_art.startswith("data:image"):
        try:
            header, encoded = cover_art.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
            image_data = base64.b64decode(encoded)
            
            picture = Picture()
            picture.data = image_data
            picture.type = 3 # Front Cover
            picture.mime = mime_type
            picture.desc = "Cover"
            
            audio.clear_pictures()
            audio.add_picture(picture)
        except Exception as e:
            logger.error(f"Failed to embed FLAC cover art: {e}")

    audio.save()
