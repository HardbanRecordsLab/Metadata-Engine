import os
import sys
import json

def default_audio_path():
    here = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.abspath(os.path.join(here, "..", "..", "EUPHORIC MAIN.wav"))
    return candidate if os.path.isfile(candidate) else None

def main():
    positional = [a for a in sys.argv[1:] if not a.startswith("-")]
    path = positional[0] if positional else default_audio_path()
    if not path or not os.path.isfile(path):
        print(json.dumps({"error": "Audio file not found"}))
        sys.exit(1)
    try:
        from mutagen.wave import WAVE
        from mutagen.id3 import ID3
        audio = WAVE(path)
        tags = {}
        if audio.tags and isinstance(audio.tags, ID3):
            for key in audio.tags.keys():
                frames = audio.tags.getall(key)
                values = []
                for fr in frames:
                    val = getattr(fr, "text", None)
                    if val is None:
                        val = str(fr)
                    else:
                        if isinstance(val, list):
                            conv = []
                            for item in val:
                                try:
                                    json.dumps(item)
                                    conv.append(item)
                                except Exception:
                                    conv.append(str(item))
                            val = conv if len(conv) != 1 else conv[0]
                        else:
                            try:
                                json.dumps(val)
                            except Exception:
                                val = str(val)
                    values.append(val)
                tags[key] = values if len(values) != 1 else values[0]
        print(json.dumps({"file": os.path.basename(path), "tags": tags}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)

if __name__ == "__main__":
    main()
