
import librosa
import os

file_path = "f:/VPS HardbanRecordsLab/Apps/Metadata-Engine/EUPHORIC MAIN.wav"
print(f"Testing librosa load for {file_path}...")
try:
    y, sr = librosa.load(file_path, duration=5)
    print(f"Load successful! Samples: {len(y)}, SR: {sr}")
except Exception as e:
    print(f"Load failed: {e}")
