import os
import sys
import json
import time
import hashlib
import shutil
import numpy as np

here = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(here, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Write certificates into workspace for local preview
os.environ.setdefault("CERT_DIR", os.path.abspath(os.path.join(backend_dir, "local_output", "certificates")))

def default_audio_path():
    candidate = os.path.abspath(os.path.join(here, "..", "..", "EUPHORIC MAIN.wav"))
    return candidate if os.path.isfile(candidate) else None

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def main():
    positional = [a for a in sys.argv[1:] if not a.startswith("-")]
    path = positional[0] if positional else default_audio_path()
    if not path or not os.path.isfile(path):
        print(json.dumps({"error": "Audio file not found"}))
        sys.exit(1)
    title = os.path.splitext(os.path.basename(path))[0]
    artist = album = genre = None
    duration = None
    try:
        from tinytag import TinyTag
        tag = TinyTag.get(path)
        title = tag.title or title
        artist = tag.artist or artist
        album = tag.album or album
        genre = tag.genre or genre
        duration = tag.duration or duration
    except Exception:
        pass
    id3 = {}
    try:
        from mutagen.wave import WAVE
        from mutagen.id3 import ID3
        wav = WAVE(path)
        if wav.tags and isinstance(wav.tags, ID3):
            for k in wav.tags.keys():
                frames = wav.tags.getall(k)
                vals = []
                for fr in frames:
                    v = getattr(fr, "text", None)
                    if v is None:
                        v = str(fr)
                    else:
                        if isinstance(v, list):
                            vv = []
                            for it in v:
                                try:
                                    json.dumps(it)
                                    vv.append(it)
                                except Exception:
                                    vv.append(str(it))
                            v = vv if len(vv) != 1 else vv[0]
                        else:
                            try:
                                json.dumps(v)
                            except Exception:
                                v = str(v)
                    vals.append(v)
                id3[k] = vals if len(vals) != 1 else vals[0]
    except Exception:
        pass
    album_artist = id3.get("TPE2")
    isrc = id3.get("TSRC")
    lang = id3.get("TLAN")
    tbpm = id3.get("TBPM")
    tkey = id3.get("TKEY")
    def get_txxx(desc):
        for key, val in id3.items():
            if key.startswith("TXXX:") and key[5:].upper() == desc.upper():
                return val
        return None
    additional = get_txxx("SUBGENRE") or get_txxx("GENRE2")
    instrumentation = get_txxx("INSTRUMENTATION") or get_txxx("INSTRUMENTS")
    main_instr = get_txxx("MAIN_INSTRUMENT")
    use_cases = get_txxx("USAGE") or get_txxx("USE_CASES")
    keywords = get_txxx("KEYWORDS")
    musical_era = get_txxx("MUSICAL_ERA")
    prod_quality = get_txxx("PRODUCTION_QUALITY")
    target_aud = get_txxx("TARGET_AUDIENCE")
    tempo_char = get_txxx("TEMPO_CHARACTER")
    dyn = get_txxx("DYNAMICS")
    p_line = id3.get("TPRO")
    copyr = id3.get("TCOP")
    publ = id3.get("TPUB") or id3.get("TPublisher")
    comp = id3.get("TCOM")
    lyr = id3.get("TEXT")
    prod = get_txxx("PRODUCER")
    iswc = get_txxx("ISWC")
    upc = get_txxx("UPC")
    catalog = get_txxx("CATALOGNUMBER")
    lic = get_txxx("LICENSE")
    sha_tag = get_txxx("SHA256")
    comm = id3.get("COMM")
    track_desc = None
    if comm:
        try:
            if isinstance(comm, list) and comm:
                c = comm[0]
                track_desc = getattr(c, "text", None) or None
                if isinstance(track_desc, list):
                    track_desc = track_desc[0]
            else:
                track_desc = comm
        except Exception:
            pass
    bpm_val = None
    if isinstance(tbpm, (list, tuple)):
        try:
            bpm_val = float(tbpm[0])
        except Exception:
            pass
    elif tbpm:
        try:
            bpm_val = float(tbpm)
        except Exception:
            pass
    key_val = None
    mode_val = None
    if tkey:
        kv = tkey if isinstance(tkey, str) else (tkey[0] if isinstance(tkey, list) else None)
        if kv:
            parts = str(kv).split()
            if len(parts) == 2:
                key_val, mode_val = parts
            else:
                key_val = kv
    # Skip heavy DSP in this local generator to avoid long runtimes
    sha = sha256_file(path)
    metadata = {
        "title": title,
        "artist": artist,
        "album": album,
        "albumArtist": album_artist,
        "year": None,
        "track": None,
        "duration": int(duration) if duration else None,
        "coverArt": None,
        "mainInstrument": main_instr or None,
        "key": key_val or None,
        "mode": mode_val or None,
        "bpm": bpm_val or None,
        "mainGenre": genre,
        "additionalGenres": additional if isinstance(additional, list) else ([additional] if additional else []),
        "trackDescription": track_desc or None,
        "keywords": keywords if isinstance(keywords, list) else ([keywords] if keywords else []),
        "language": lang or None,
        "copyright": copyr or None,
        "pLine": p_line or None,
        "publisher": publ or None,
        "composer": comp or None,
        "lyricist": lyr or None,
        "producer": prod or None,
        "catalogNumber": catalog or None,
        "isrc": isrc or None,
        "iswc": iswc or None,
        "upc": upc or None,
        "sha256": sha_tag or sha,
        "license": lic or None,
        "similar_artists": None,
        "moods": [],
        "mood_vibe": None,
        "energy_level": None,
        "energyLevel": None,
        "instrumentation": instrumentation if isinstance(instrumentation, list) else ([instrumentation] if instrumentation else []),
        "vocalStyle": None,
        "useCases": use_cases if isinstance(use_cases, list) else ([use_cases] if use_cases else []),
        "structure": [],
        "explicitContent": None,
        "tempoCharacter": tempo_char or None,
        "musicalEra": musical_era or None,
        "productionQuality": prod_quality or None,
        "dynamics": dyn or None,
        "targetAudience": target_aud or None,
        "fileOwner": None,
        "analysisReasoning": None,
        "dynamicRange": None,
        "spectralCentroid": None,
        "spectralRolloff": None,
        "acousticScore": None,
        "hasVocals": None,
        "percussionDetected": None,
        "validation_report": {},
        "confidence": None,
    }
    try:
        from app.services.certificate_pdf import generate_certificate_pdf
        cert_id = f"LOCAL-{int(time.time())}"
        verify_url = f"https://metadata.hardbanrecordslab.online/api/certificate/verify/{cert_id}"
        pdf_path = generate_certificate_pdf(cert_id, os.path.basename(path), sha, metadata, verify_url)
        # Also copy into workspace for easy access in IDE
        ws_dir = os.path.abspath(os.path.join(backend_dir, "local_output", "certificates"))
        os.makedirs(ws_dir, exist_ok=True)
        ws_pdf_path = os.path.join(ws_dir, f"{cert_id}.pdf")
        try:
            shutil.copyfile(pdf_path, ws_pdf_path)
        except Exception:
            ws_pdf_path = None
        print(json.dumps({
            "status": "ok",
            "certificate_id": cert_id,
            "pdf_path": pdf_path,
            "workspace_pdf": ws_pdf_path
        }, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)

if __name__ == "__main__":
    main()
