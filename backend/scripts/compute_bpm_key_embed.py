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
    bpm = None
    tkey = None
    try:
        import numpy as np
        import librosa
        y, sr = librosa.load(path, duration=15.0, mono=True, res_type="kaiser_fast")
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo)
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        ki = int(np.argmax(np.mean(chroma, axis=1)))
        keys = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
        tkey = keys[ki]
    except Exception as e:
        print(json.dumps({"error": f"DSP failed: {str(e)}"}))
    try:
        from mutagen.wave import WAVE
        from mutagen.id3 import TBPM, TKEY
        audio = WAVE(path)
        if audio.tags is None:
            audio.add_tags()
        if bpm is not None:
            audio.tags.add(TBPM(encoding=3, text=str(round(bpm, 2))))
        if tkey is not None:
            audio.tags.add(TKEY(encoding=3, text=str(tkey)))
        audio.save()
        print(json.dumps({"status": "ok", "bpm": bpm, "key": tkey}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": f"Tagging failed: {str(e)}"}))
        sys.exit(2)

if __name__ == "__main__":
    main()

