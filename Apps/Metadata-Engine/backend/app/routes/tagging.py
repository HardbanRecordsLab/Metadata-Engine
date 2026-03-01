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
from mutagen.id3 import (
    ID3, TIT2, TPE1, TALB, TCON, TDRC, TYER, COMM, TXXX, TBPM,
    TPUB, TCOP, TKEY, TRCK, TLAN, TPE2, TCOM, TEXT, TSRC, APIC, WCOP
)
from mutagen.flac import FLAC, Picture
from app.utils.audio_metadata import is_valid_isrc
import base64

logger = logging.getLogger(__name__)
router = APIRouter()

# ── ALLOWED TXXX FRAMES ───────────────────────────────────────────────────────
# Complete list of allowed TXXX extended tags written to files
ALLOWED_TXXX = {
    # Core classification
    "MAIN_INSTRUMENT",
    "SUBGENRE",
    "MOOD",
    "MOODS",
    "INSTRUMENTATION",
    "KEYWORDS",
    "USAGE",
    # Credits
    "PRODUCER",
    "P_LINE",
    # Rights
    "ISWC",
    "UPC",
    "CATALOGNUMBER",
    "SHA256",
    "LICENSE",
    # Vocal
    "VOCAL_STYLE",
    "VOCAL_STYLE_GENDER",
    "VOCAL_STYLE_TIMBRE",
    "VOCAL_STYLE_DELIVERY",
    "VOCAL_STYLE_EMOTIONALTONE",
    # Extended metadata (was DEPRECATED — now restored)
    "ENERGY",
    "ENERGY_LEVEL",
    "INITIALKEY",
    "MUSICAL_ERA",
    "PRODUCTION_QUALITY",
    "DYNAMICS",
    "TARGET_AUDIENCE",
    "TEMPO_CHARACTER",
    "ACOUSTIC_SCORE",
    "HAS_VOCALS",
    "SPECTRAL_CENTROID",
    "DYNAMIC_RANGE",
    "MOOD_VIBE",
    "ANALYSIS_REASONING",
    # Misc
    "OTHER",
}


def validate_and_normalize_metadata(meta: dict) -> dict:
    if not meta.get("title") or not isinstance(meta.get("title"), str):
        raise HTTPException(status_code=400, detail="Missing or invalid 'title' — must be a string")
    if not meta.get("artist") or not isinstance(meta.get("artist"), str):
        raise HTTPException(status_code=400, detail="Missing or invalid 'artist' — must be a string")
    for key in ["title", "artist", "album"]:
        if key in meta:
            meta[key] = str(meta[key]).replace("\n", " ").replace("\r", " ").strip()
    meta.setdefault("album", "Single")
    return meta


def parse_title_artist(filename: str) -> tuple[str, str]:
    name = filename.rsplit(".", 1)[0]
    for sep in (" - ", " – "):
        if sep in name:
            parts = name.split(sep, 1)
            return parts[0].strip(), parts[1].strip()
    return "Unknown Artist", name.strip()


def cleanup_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        logger.error(f"Error cleaning up file {path}: {e}")


def _safe_str(v):
    if v is None:
        return ""
    return str(v).replace("\r", " ").replace("\n", " ").strip()


def _join_list(v):
    if not isinstance(v, list):
        return ""
    parts = [_safe_str(x) for x in v if x]
    parts = [p for p in parts if p]
    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for p in parts:
        pl = p.lower()
        if pl not in seen:
            seen.add(pl)
            deduped.append(p)
    return ", ".join(deduped)


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


# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

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
        raise HTTPException(status_code=400, detail="Metadata must be a JSON object")

    if not meta.get("title") or not meta.get("artist"):
        parsed_artist, parsed_title = parse_title_artist(file.filename)
        meta.setdefault("title", parsed_title)
        meta.setdefault("artist", parsed_artist)

    meta = validate_and_normalize_metadata(meta)

    suffix = os.path.splitext(file.filename)[1].lower()
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)

    try:
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        if suffix == ".mp3":
            tag_mp3(path, meta)
        elif suffix == ".flac":
            tag_flac(path, meta)
        elif suffix == ".wav":
            tag_wav(path, meta)
        else:
            logger.warning(f"Unsupported format for tagging: {suffix}")

        return FileResponse(
            path,
            media_type="application/octet-stream",
            filename=f"tagged_{file.filename}",
            background=BackgroundTask(cleanup_file, path),
        )
    except Exception as e:
        cleanup_file(path)
        logger.error(f"Tagging error: {e}")
        raise HTTPException(status_code=500, detail=f"Tagging failed: {str(e)}")


@router.post("/tag/job/{job_id}")
async def tag_existing_job(
    job_id: str,
    metadata: str = Form(...),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    upload_dir = "uploads"
    file_path = os.path.join(upload_dir, f"{job_id}_{job.file_name}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=410, detail="Source file has been cleaned up. Please re-upload.")

    try:
        meta = json.loads(metadata)
        if not isinstance(meta, dict):
            raise ValueError("Not a dict")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid metadata JSON")

    if not meta.get("title") or not meta.get("artist"):
        parsed_artist, parsed_title = parse_title_artist(job.file_name)
        meta.setdefault("title", parsed_title)
        meta.setdefault("artist", parsed_artist)

    meta = validate_and_normalize_metadata(meta)

    # Try to load server-side cover if not provided
    if not meta.get("coverArt"):
        cover_path = os.path.join(upload_dir, f"{job_id}_cover.jpg")
        if os.path.exists(cover_path):
            try:
                with open(cover_path, "rb") as cf:
                    b64 = base64.b64encode(cf.read()).decode("utf-8")
                    meta["coverArt"] = f"data:image/jpeg;base64,{b64}"
            except Exception as e:
                logger.error(f"Could not load server-side cover for job {job_id}: {e}")

    suffix = os.path.splitext(job.file_name)[1].lower()
    fd, tagged_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)

    try:
        shutil.copy2(file_path, tagged_path)

        if suffix == ".mp3":
            tag_mp3(tagged_path, meta)
        elif suffix == ".flac":
            tag_flac(tagged_path, meta)
        elif suffix == ".wav":
            tag_wav(tagged_path, meta)

        return FileResponse(
            tagged_path,
            media_type="application/octet-stream",
            filename=f"tagged_{job.file_name}",
            background=BackgroundTask(cleanup_file, tagged_path),
        )
    except Exception as e:
        cleanup_file(tagged_path)
        logger.error(f"Server-side tagging error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── SHARED ID3 WRITER ─────────────────────────────────────────────────────────

def tag_id3_common(audio, meta: dict):
    """Write all metadata fields to an ID3 tag object (MP3 or WAV)."""

    # Clear existing extended tags to avoid duplication
    audio.delall("TXXX")
    audio.delall("COMM")
    audio.delall("USLT")
    audio.delall("APIC")

    # ── 1. Core Identity ──────────────────────────────────────────────────────
    if meta.get("title"):
        audio.add(TIT2(encoding=3, text=_safe_str(meta["title"])))
    if meta.get("artist"):
        audio.add(TPE1(encoding=3, text=_safe_str(meta["artist"])))
    if meta.get("albumArtist"):
        audio.add(TPE2(encoding=3, text=_safe_str(meta["albumArtist"])))
    if meta.get("album"):
        audio.add(TALB(encoding=3, text=_safe_str(meta["album"])))

    year_val = _safe_str(meta.get("year", ""))[:4]
    if year_val:
        audio.add(TDRC(encoding=3, text=year_val))  # ID3v2.4
        audio.add(TYER(encoding=3, text=year_val))  # ID3v2.3 compat

    track = meta.get("track") or meta.get("trackNumber")
    if track:
        audio.add(TRCK(encoding=3, text=_safe_str(track)))

    # ── 2. Technical ──────────────────────────────────────────────────────────
    if meta.get("bpm"):
        bpm_val = meta["bpm"]
        try:
            bpm_val = str(round(float(bpm_val)))
        except Exception:
            bpm_val = _safe_str(bpm_val)
        audio.add(TBPM(encoding=3, text=bpm_val))

    tkey = _build_tkey(meta)
    if tkey:
        audio.add(TKEY(encoding=3, text=tkey))
        audio.add(TXXX(encoding=3, desc="INITIALKEY", text=tkey))

    if meta.get("language"):
        lang = _safe_str(meta["language"])[:3].lower()
        audio.add(TLAN(encoding=3, text=lang))

    # ── 3. Genre ──────────────────────────────────────────────────────────────
    if meta.get("mainGenre"):
        audio.add(TCON(encoding=3, text=_safe_str(meta["mainGenre"])))

    # ── 4. Credits ────────────────────────────────────────────────────────────
    if meta.get("composer"):
        audio.add(TCOM(encoding=3, text=_safe_str(meta["composer"])))
    if meta.get("lyricist"):
        audio.add(TEXT(encoding=3, text=_safe_str(meta["lyricist"])))
    if meta.get("publisher"):
        audio.add(TPUB(encoding=3, text=_safe_str(meta["publisher"])))

    # ── 5. Legal ──────────────────────────────────────────────────────────────
    if meta.get("copyright"):
        audio.add(TCOP(encoding=3, text=_safe_str(meta["copyright"])))

    if meta.get("isrc"):
        isrc = _safe_str(meta["isrc"]).upper().replace("-", "")
        if is_valid_isrc(isrc):
            audio.add(TSRC(encoding=3, text=isrc))

    # ── 6. Description / Comment ──────────────────────────────────────────────
    if meta.get("trackDescription"):
        audio.add(COMM(encoding=3, lang="eng", desc="", text=_safe_str(meta["trackDescription"])))

    # ── 7. TXXX Extended Tags ─────────────────────────────────────────────────
    vs = meta.get("vocalStyle") or {}
    mood_str = _join_list(meta.get("moods"))
    energy_val = _safe_str(meta.get("energyLevel") or meta.get("energy_level"))

    txxx_map = {
        # Classification
        "MAIN_INSTRUMENT":      _safe_str(meta.get("mainInstrument")),
        "SUBGENRE":             _join_list(meta.get("additionalGenres")),
        "MOOD":                 mood_str,
        "MOODS":                mood_str,
        "INSTRUMENTATION":      _join_list(meta.get("instrumentation")),
        "KEYWORDS":             _join_list(meta.get("keywords")),
        "USAGE":                _join_list(meta.get("useCases")),
        # Credits
        "PRODUCER":             _safe_str(meta.get("producer")),
        "P_LINE":               _safe_str(meta.get("pLine")),
        # Rights
        "ISWC":                 _safe_str(meta.get("iswc")),
        "UPC":                  _safe_str(meta.get("upc")),
        "CATALOGNUMBER":        _safe_str(meta.get("catalogNumber")),
        "SHA256":               _safe_str(meta.get("sha256")),
        "LICENSE":              _safe_str(meta.get("license")),
        # Vocal
        "VOCAL_STYLE":              _serialize_vocal_style(vs),
        "VOCAL_STYLE_GENDER":       _safe_str(vs.get("gender")),
        "VOCAL_STYLE_TIMBRE":       _safe_str(vs.get("timbre")),
        "VOCAL_STYLE_DELIVERY":     _safe_str(vs.get("delivery")),
        "VOCAL_STYLE_EMOTIONALTONE":_safe_str(vs.get("emotionalTone")),
        # Extended analysis metadata
        "ENERGY":               energy_val,
        "ENERGY_LEVEL":         energy_val,
        "MUSICAL_ERA":          _safe_str(meta.get("musicalEra")),
        "PRODUCTION_QUALITY":   _safe_str(meta.get("productionQuality")),
        "DYNAMICS":             _safe_str(meta.get("dynamics")),
        "TARGET_AUDIENCE":      _safe_str(meta.get("targetAudience")),
        "TEMPO_CHARACTER":      _safe_str(meta.get("tempoCharacter")),
        "MOOD_VIBE":            _safe_str(meta.get("mood_vibe")),
        "ANALYSIS_REASONING":   _safe_str(meta.get("analysisReasoning")),
        # DSP metrics
        "ACOUSTIC_SCORE":   str(meta.get("acousticScore", "")),
        "HAS_VOCALS":       str(meta.get("hasVocals", "")),
        "SPECTRAL_CENTROID":str(meta.get("spectralCentroid", "")),
        "DYNAMIC_RANGE":    str(meta.get("dynamicRange", "")),
        # Misc
        "OTHER":            _safe_str(meta.get("other")),
    }

    for desc, value in txxx_map.items():
        if desc not in ALLOWED_TXXX:
            continue
        if value and value not in ("", "None", "null"):
            audio.add(TXXX(encoding=3, desc=desc, text=value))

    # ── 8. Cover Art ──────────────────────────────────────────────────────────
    cover_art = meta.get("coverArt")
    if cover_art and cover_art.startswith("data:image"):
        try:
            header, encoded = cover_art.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
            image_data = base64.b64decode(encoded)
            audio.add(APIC(
                encoding=3,
                mime=mime_type,
                type=3,  # Front Cover
                desc="Cover",
                data=image_data,
            ))
        except Exception as e:
            logger.error(f"Failed to embed ID3 cover art: {e}")


# ── FORMAT WRITERS ────────────────────────────────────────────────────────────

def tag_mp3(path: str, meta: dict):
    try:
        audio = MP3(path, ID3=ID3)
    except Exception:
        audio = MP3(path)
        audio.add_tags()

    if audio.tags is None:
        audio.add_tags()

    tag_id3_common(audio.tags, meta)
    audio.save(v2_version=3)  # Save as ID3v2.3 for maximum compatibility


def tag_wav(path: str, meta: dict):
    try:
        audio = WAVE(path)
    except Exception:
        logger.error(f"Could not open WAV: {path}")
        return

    if audio.tags is None:
        audio.add_tags()

    tag_id3_common(audio.tags, meta)
    audio.save()


def tag_flac(path: str, meta: dict):
    try:
        audio = FLAC(path)
    except Exception:
        logger.error(f"Could not open FLAC: {path}")
        return

    # ── Core Identity ────────────────────────────────────────────────────────
    if meta.get("title"):        audio["TITLE"]       = _safe_str(meta["title"])
    if meta.get("artist"):       audio["ARTIST"]      = _safe_str(meta["artist"])
    if meta.get("albumArtist"):  audio["ALBUMARTIST"] = _safe_str(meta["albumArtist"])
    if meta.get("album"):        audio["ALBUM"]       = _safe_str(meta["album"])
    if meta.get("year"):         audio["DATE"]        = _safe_str(meta["year"])[:4]
    if meta.get("mainGenre"):    audio["GENRE"]       = _safe_str(meta["mainGenre"])
    if meta.get("composer"):     audio["COMPOSER"]    = _safe_str(meta["composer"])
    if meta.get("lyricist"):     audio["LYRICIST"]    = _safe_str(meta["lyricist"])
    if meta.get("publisher"):    audio["PUBLISHER"]   = _safe_str(meta["publisher"])
    if meta.get("copyright"):    audio["COPYRIGHT"]   = _safe_str(meta["copyright"])
    if meta.get("language"):     audio["LANGUAGE"]    = _safe_str(meta["language"])
    if meta.get("isrc"):         audio["ISRC"]        = _safe_str(meta["isrc"]).upper().replace("-","")
    if meta.get("iswc"):         audio["ISWC"]        = _safe_str(meta["iswc"])
    if meta.get("upc"):          audio["UPC"]         = _safe_str(meta["upc"])
    if meta.get("trackDescription"): audio["COMMENT"] = _safe_str(meta["trackDescription"])

    track = meta.get("track") or meta.get("trackNumber")
    if track:
        audio["TRACKNUMBER"] = _safe_str(track)

    if meta.get("bpm"):
        try:
            audio["BPM"] = str(round(float(meta["bpm"])))
        except Exception:
            audio["BPM"] = _safe_str(meta["bpm"])

    tkey = _build_tkey(meta)
    if tkey:
        audio["INITIALKEY"] = tkey

    # ── Classification ────────────────────────────────────────────────────────
    if meta.get("mainInstrument"):    audio["MAIN_INSTRUMENT"]  = _safe_str(meta["mainInstrument"])
    if meta.get("catalogNumber"):     audio["CATALOGNUMBER"]    = _safe_str(meta["catalogNumber"])
    if meta.get("producer"):          audio["PRODUCER"]         = _safe_str(meta["producer"])
    if meta.get("pLine"):             audio["P_LINE"]           = _safe_str(meta["pLine"])
    if meta.get("sha256"):            audio["SHA256"]           = _safe_str(meta["sha256"])
    if meta.get("license"):           audio["LICENSE"]          = _safe_str(meta["license"])

    if meta.get("moods"):             audio["MOOD"]             = _join_list(meta["moods"])
    if meta.get("keywords"):          audio["KEYWORDS"]         = _join_list(meta["keywords"])
    if meta.get("additionalGenres"):  audio["SUBGENRE"]         = _join_list(meta["additionalGenres"])
    if meta.get("instrumentation"):   audio["INSTRUMENTATION"]  = _join_list(meta["instrumentation"])
    if meta.get("useCases"):          audio["USAGE"]            = _join_list(meta["useCases"])

    # ── Extended metadata ─────────────────────────────────────────────────────
    energy_val = _safe_str(meta.get("energyLevel") or meta.get("energy_level"))
    if energy_val:                    audio["ENERGY"]            = energy_val
    if meta.get("musicalEra"):        audio["MUSICAL_ERA"]       = _safe_str(meta["musicalEra"])
    if meta.get("productionQuality"): audio["PRODUCTION_QUALITY"]= _safe_str(meta["productionQuality"])
    if meta.get("dynamics"):          audio["DYNAMICS"]          = _safe_str(meta["dynamics"])
    if meta.get("targetAudience"):    audio["TARGET_AUDIENCE"]   = _safe_str(meta["targetAudience"])
    if meta.get("tempoCharacter"):    audio["TEMPO_CHARACTER"]   = _safe_str(meta["tempoCharacter"])
    if meta.get("mood_vibe"):         audio["MOOD_VIBE"]         = _safe_str(meta["mood_vibe"])
    if meta.get("analysisReasoning"): audio["ANALYSIS_REASONING"]= _safe_str(meta["analysisReasoning"])
    if meta.get("acousticScore") is not None: audio["ACOUSTIC_SCORE"] = str(meta["acousticScore"])
    if meta.get("hasVocals") is not None:     audio["HAS_VOCALS"]     = str(meta["hasVocals"])
    if meta.get("spectralCentroid") is not None: audio["SPECTRAL_CENTROID"] = str(meta["spectralCentroid"])
    if meta.get("dynamicRange") is not None: audio["DYNAMIC_RANGE"] = str(meta["dynamicRange"])

    # ── Vocal Style ───────────────────────────────────────────────────────────
    vs = meta.get("vocalStyle") or {}
    audio["VOCAL_STYLE"]            = _serialize_vocal_style(vs)
    audio["VOCAL_STYLE_GENDER"]     = _safe_str(vs.get("gender"))
    audio["VOCAL_STYLE_TIMBRE"]     = _safe_str(vs.get("timbre"))
    audio["VOCAL_STYLE_DELIVERY"]   = _safe_str(vs.get("delivery"))
    audio["VOCAL_STYLE_EMOTIONALTONE"] = _safe_str(vs.get("emotionalTone"))

    # ── Cover Art ─────────────────────────────────────────────────────────────
    cover_art = meta.get("coverArt")
    if cover_art and cover_art.startswith("data:image"):
        try:
            header, encoded = cover_art.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
            image_data = base64.b64decode(encoded)
            picture = Picture()
            picture.data = image_data
            picture.type = 3  # Front Cover
            picture.mime = mime_type
            picture.desc = "Cover"
            audio.clear_pictures()
            audio.add_picture(picture)
        except Exception as e:
            logger.error(f"Failed to embed FLAC cover art: {e}")

    audio.save()
