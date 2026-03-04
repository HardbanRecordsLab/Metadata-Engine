import os
import sys
import json

here = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(here, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

def default_audio_path():
    candidate = os.path.abspath(os.path.join(here, "..", "..", "EUPHORIC MAIN.wav"))
    return candidate if os.path.isfile(candidate) else None

def main():
    positional = [a for a in sys.argv[1:] if not a.startswith("-")]
    if positional:
        path = positional[0]
    else:
        path = default_audio_path()
    if not path or not os.path.isfile(path):
        print(json.dumps({"error": "Audio file not found"}))
        sys.exit(1)
    try:
        from tinytag import TinyTag
        tag = TinyTag.get(path)
        data = {
            "file": os.path.basename(path),
            "duration": tag.duration,
            "title": tag.title,
            "artist": tag.artist,
            "album": tag.album,
            "year": tag.year,
            "track": tag.track,
            "genre": tag.genre,
            "bitrate": tag.bitrate,
            "samplerate": tag.samplerate,
            "channels": tag.channels,
        }
        print(json.dumps(data, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)

if __name__ == "__main__":
    main()

