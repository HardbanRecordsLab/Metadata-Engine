import os
import sys
import json
import hashlib

def default_audio_path():
    here = os.path.dirname(os.path.abspath(__file__))
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
    artist = os.getenv("TAG_ARTIST", "Skomrakus")
    album = os.getenv("TAG_ALBUM", "Instrumental Techno Vibe")
    genre = os.getenv("TAG_GENRE", "Techno-Industrial")
    try:
        from mutagen.wave import WAVE
        from mutagen.id3 import ID3, TIT2, TPE1, TALB, TCON, TXXX
        audio = WAVE(path)
        if audio.tags is None:
            audio.add_tags()
        audio.tags.add(TIT2(encoding=3, text=title))
        audio.tags.add(TPE1(encoding=3, text=artist))
        audio.tags.add(TALB(encoding=3, text=album))
        audio.tags.add(TCON(encoding=3, text=genre))
        sha = sha256_file(path)
        audio.tags.add(TXXX(encoding=3, desc="SHA256", text=sha))
        audio.save()
        print(json.dumps({"status": "ok", "file": os.path.basename(path), "sha256": sha, "applied": {"title": title, "artist": artist, "album": album, "genre": genre}}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)

if __name__ == "__main__":
    main()

