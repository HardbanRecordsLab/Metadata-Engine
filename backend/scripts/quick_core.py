import os
import sys
import json
import numpy as np

here = os.path.dirname(os.path.abspath(__file__))
def default_audio_path():
    candidate = os.path.abspath(os.path.join(here, "..", "..", "EUPHORIC MAIN.wav"))
    return candidate if os.path.isfile(candidate) else None

def main():
    positional = [a for a in sys.argv[1:] if not a.startswith("-")]
    path = positional[0] if positional else default_audio_path()
    if not path or not os.path.isfile(path):
        print(json.dumps({"error": "Audio file not found"}))
        sys.exit(1)
    try:
        import librosa
    except Exception as e:
        print(json.dumps({"error": f"librosa import failed: {str(e)}"}))
        sys.exit(2)
    try:
        y, sr = librosa.load(path, duration=60)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        key_idx = int(np.argmax(np.mean(chroma, axis=1)))
        keys = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
        key = keys[key_idx]
        sc = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        dr = np.std(librosa.feature.rms(y=y))
        res = {
            "bpm": float(tempo),
            "key": key,
            "spectral_centroid": float(sc),
            "energy_std": float(dr),
            "duration_seconds": float(librosa.get_duration(y=y, sr=sr)),
        }
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(3)

if __name__ == "__main__":
    main()

