import hashlib
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)

# --- ZAAWANSOWANE MODELE DANYCH (PYDANTIC) ---
class TrackMetadata(BaseModel):
    title: str = Field(..., description="Tytuł utworu")
    artist: str = Field(..., description="Główny wykonawca")
    isrc: str = Field(..., description="International Standard Recording Code")
    iswc: Optional[str] = Field(None, description="International Standard Musical Work Code")
    bpm: float
    key: str
    lufs: float
    danceability: float
    mood_vibe: str
    energy_level: float
    fingerprint: str = Field(..., description="Unikalny hash audio (SHA-256)")
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

    @validator('isrc')
    def validate_isrc(cls, v):
        v = v.replace("-", "").upper()
        if len(v) != 12:
            raise ValueError('BŁĄD KRYTYCZNY: ISRC musi mieć dokładnie 12 znaków (np. PLAAA2600001).')
        return v

class SonicAnalyzer:
    """
    Module 1: Sonic Intelligence (Deep Analysis)
    Automated track categorization for Spotify/TikTok algorithms.
    """
    def __init__(self, file_path: str):
        self.file_path = file_path

    def _calculate_fingerprint(self) -> str:
        with open(self.file_path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()

    def _interpret_vibe(self, scale, dissonance, energy):
        """Logika interpretacyjna dla Szwadronu Hydra (Marketing)."""
        if scale == "minor":
            return "Dark/Melancholic" if dissonance > 0.4 else "Deep/Atmospheric"
        return "Energetic/Happy" if energy > 0.1 else "Chill/Calm"

    def run_deep_analysis(self) -> Dict[str, Any]:
        """Executes full sonic test suite."""
        try:
            import essentia.standard as es
            # Wczytujemy plik w formacie mono
            loader = es.MonoLoader(filename=self.file_path)
            audio = loader()
            
            # Optimization: Smart Slicing for long files (90s limit for analysis)
            duration = len(audio) / 44100.0
            if duration > 90:
                mid_point = duration / 2
                start_sample = int((mid_point - 45) * 44100)
                end_sample = int((mid_point + 45) * 44100)
                start_sample = max(0, start_sample)
                end_sample = min(len(audio), end_sample)
                audio = audio[start_sample:end_sample]
                logger.info(f"SonicIntelligence: Smart Slicing active ({len(audio)/44100:.1f}s)")

            # 1. Rytm i Tempo
            rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
            bpm, _, _, _, _ = rhythm_extractor(audio)

            # 2. Tonalność i Skala
            key_extractor = es.KeyExtractor()
            key, scale, _ = key_extractor(audio)

            # 3. Głośność (LUFS)
            loudness_stats = es.LoudnessEBUR128()(audio)
            lufs = loudness_stats[2]

            # 4. Charakterystyka taneczna
            dance = es.Danceability()(audio)[0]
            
            # 6. Analiza Nastroju
            # Cut to first 2048 samples for spectrum/dissonance snapshot (simplification)
            # or better pass a frame. Logic from user snippet:
            spectrum = es.Spectrum()(es.Windowing(type='hann')(audio[:2048]))
            dissonance = es.Dissonance()(spectrum)
            energy = es.RMS()(audio)
            
            vibe = self._interpret_vibe(scale, dissonance, energy)

            return {
                "bpm": round(bpm, 2),
                "key": f"{key} {scale}",
                "lufs": round(lufs, 2),
                "danceability": round(dance, 2),
                "mood_vibe": vibe,
                "energy_level": round(energy, 4),
                "fingerprint": self._calculate_fingerprint()
            }

        except ImportError as ie:
            logger.warning("Essentia not found, using Librosa fallback for Sonic Intelligence.")
            return self._run_librosa_fallback()
        except Exception as e:
            logger.error(f"Essentia analysis failed: {e}")
            return self._run_librosa_fallback()

    def _run_librosa_fallback(self) -> Dict[str, Any]:
        """Fallback implementation using Librosa to provide similar metrics."""
        import librosa
        y, sr = librosa.load(self.file_path, duration=60)
        
        # BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo) if isinstance(tempo, (float, int)) else float(tempo[0])
        
        # Key
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        key_idx = int(np.argmax(np.mean(chroma, axis=1)))
        keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        detected_key = keys[key_idx]
        major_energy = np.mean(chroma[(key_idx + 4) % 12])
        minor_energy = np.mean(chroma[(key_idx + 3) % 12])
        scale = "major" if major_energy > minor_energy else "minor"

        # Energy/RMS
        rms = librosa.feature.rms(y=y)
        energy_mean = float(np.mean(rms))
        
        # Danceability (PLP)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        pulse = librosa.beat.plp(onset_envelope=onset_env, sr=sr)
        danceability = float(np.mean(pulse))
        
        # Vibe heuristic
        dissonance_sim = 0.5 # Placeholder since librosa doesn't map 1:1 to dissonance
        vibe = self._interpret_vibe(scale, dissonance_sim, energy_mean)

        return {
            "bpm": round(bpm, 2),
            "key": f"{detected_key} {scale}",
            "lufs": -14.0, # Placeholder, needing pyloudnorm for true fallback
            "danceability": round(danceability, 2),
            "mood_vibe": vibe,
            "energy_level": round(energy_mean, 4),
            "fingerprint": self._calculate_fingerprint()
        }
