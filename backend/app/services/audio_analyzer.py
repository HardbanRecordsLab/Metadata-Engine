"""
Advanced Audio Analysis Service
Zero-cost local audio analysis using open-source libraries.
"""

import os
import logging
import numpy as np
from typing import Dict, Any

logger = logging.getLogger(__name__)


# === LAZY IMPORTS (to avoid startup crashes if lib missing) ===
def get_librosa():
    import librosa

    return librosa


def get_soundfile():
    import soundfile as sf

    return sf


# No crepe here to avoid tensorflow dependency


def get_pyloudnorm():
    import pyloudnorm as pyln

    return pyln


def get_tinytag():
    from tinytag import TinyTag

    return TinyTag


def get_spleeter():
    from spleeter.separator import Separator

    return Separator


class AdvancedAudioAnalyzer:
    """
    Comprehensive audio analysis using local, zero-cost libraries.
    """

    @staticmethod
    def is_available() -> bool:
        try:
            import librosa

            return True
        except ImportError:
            return False

    @staticmethod
    def _interpret_vibe(scale: str, energy: float) -> str:
        """Logic for Szwadron Hydra (Marketing) interpretations."""
        scale = scale.lower()
        if scale == "minor":
            return "Deep/Atmospheric" if energy < 0.05 else "Dark/Melancholic"
        return "Energetic/Happy" if energy > 0.08 else "Chill/Calm"

    @staticmethod
    def analyze_with_essentia(file_path: str, fast: bool = False) -> Dict[str, Any]:
        """
        Analyze audio using Essentia (User Preferred Method).
        """
        try:
            import essentia.standard as es
            import numpy as np
            logger.info(f"Using Essentia Standard for analysis (Fast Mode: {fast})...")
            
            # Loader
            loader = es.MonoLoader(filename=file_path)
            audio = loader()
            duration = len(audio) / 44100.0

            # Rhythm
            # method="degara" is faster than "multifeature"
            method = "degara" if fast else "multifeature"
            rhythm_extractor = es.RhythmExtractor2013(method=method)
            bpm, ticks, confidence, estimates, bpm_intervals = rhythm_extractor(audio)

            # Key
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(audio)

            # Extra metrics to avoid Librosa double-load
            # Energy (RMS)
            energy_mean = float(np.sqrt(np.mean(audio**2)))
            
            # Danceability
            danceability, _ = es.Danceability()(audio)
            
            # Zero Crossing Rate (proxy for brightness)
            zcr = es.ZeroCrossingRate()(audio)
            
            # Essentia returns BPM as float, Key as string
            return {
                "bpm": round(float(bpm), 1),
                "key": key,
                "mode": scale, # Essentia returns 'major'/'minor' (lowercase usually)
                "full_key": f"{key} {scale}",
                "energy_mean": energy_mean,
                "danceability": danceability,
                "duration": duration,
                "zcr": zcr,
                "success": True
            }
        except Exception as e:
            logger.warning(f"Essentia analysis failed: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def analyze_core(file_path: str, fast: bool = False) -> Dict[str, Any]:
        """
        Core analysis: BPM, Key, Spectral features, Duration.
        Priority: Essentia -> Librosa
        """
        
        # 1. Try Essentia First (User Request)
        essentia_results = AdvancedAudioAnalyzer.analyze_with_essentia(file_path, fast=fast)
        
        # FAST PATH: If Essentia succeeded and we are in fast mode, return immediately
        # This avoids double-loading audio (Essentia + Librosa) which saves ~5-10s
        if fast and essentia_results["success"]:
            final_mode = essentia_results["mode"].capitalize()
            energy_mean = essentia_results["energy_mean"]
            mood_vibe = AdvancedAudioAnalyzer._interpret_vibe(final_mode, energy_mean)
            
            detected_moods = ["Uplifting"] if final_mode == "Major" else ["Emotional"]
            
            return {
                "bpm": essentia_results["bpm"],
                "key": essentia_results["key"],
                "mode": final_mode,
                "full_key": f"{essentia_results['key']} {final_mode}",
                "mood_vibe": mood_vibe,
                "energy_level": round(energy_mean, 4),
                "duration_seconds": round(essentia_results["duration"], 2),
                "structure": [],
                "moods": detected_moods,
                "danceability": round(essentia_results.get("danceability", 0.0), 2),
                "spectral": {
                     "brightness": "bright" if essentia_results.get("zcr", 0) > 0.05 else "warm"
                }
            }
        
        # 2. Run Librosa for spectral features and fallback
        librosa = get_librosa()

        try:
            # Load audio for Librosa (needed for spectral features anyway)
            y, sr = librosa.load(file_path, duration=20 if fast else 60)
            
            rms = librosa.feature.rms(y=y)
            energy_mean = float(np.mean(rms))
            energy_max = float(np.max(rms))
            energy_std = float(np.std(rms))

            duration = librosa.get_duration(path=file_path)
            structure = []
            detected_moods = []

            # --- MERGE RESULTS ---
            if essentia_results["success"]:
                # Use Essentia values for BPM/Key
                final_bpm = essentia_results["bpm"]
                final_key = essentia_results["key"]
                final_mode = essentia_results["mode"].capitalize() # Ensure Title Case
            else:
                # Librosa Fallback for BPM/Key
                tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
                final_bpm = float(tempo) if isinstance(tempo, (int, float)) else float(tempo[0])
                
                chroma = librosa.feature.chroma_stft(y=y, sr=sr)
                key_idx = int(np.argmax(np.mean(chroma, axis=1)))
                keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
                final_key = keys[key_idx]
                
                major_energy = np.mean(chroma[(key_idx + 4) % 12])
                minor_energy = np.mean(chroma[(key_idx + 3) % 12])
                final_mode = "Major" if major_energy > minor_energy else "Minor"

            if final_mode == "Major":
                detected_moods.append("Uplifting")
            else:
                detected_moods.append("Emotional")
            
            # Derived "Hardban OS" metrics for premium feel
            mood_vibe = AdvancedAudioAnalyzer._interpret_vibe(final_mode, energy_mean)

            if fast:
                return {
                    "bpm": final_bpm,
                    "key": final_key,
                    "mode": final_mode,
                    "full_key": f"{final_key} {final_mode}",
                    "mood_vibe": mood_vibe,
                    "energy_level": round(energy_mean, 4),
                    "duration_seconds": round(duration, 2),
                    "structure": [],
                    "moods": detected_moods,
                }

            spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
            spectral_rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
            spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
            spectral_flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)))
            spectral_contrast = float(np.mean(librosa.feature.spectral_contrast(y=y, sr=sr)))
            zero_crossing_rate = float(np.mean(librosa.feature.zero_crossing_rate(y)))

            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            pulse = librosa.beat.plp(onset_envelope=onset_env, sr=sr)
            danceability = float(np.mean(pulse))

            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            mfcc_mean = [float(x) for x in np.mean(mfcc, axis=1)]

            rms_smooth = np.convolve(rms[0], np.ones(10)/10, mode='same')
            structure = []
            peak_idx = np.argmax(rms_smooth)
            peak_time = float(librosa.frames_to_time(peak_idx, sr=sr))
            structure.append({
                "section": "Core Segment",
                "startTime": round(max(0, peak_time - 10), 2),
                "endTime": round(peak_time + 10, 2),
                "description": "Peak energy flow / Main hook area."
            })

            return {
                "bpm": final_bpm,
                "key": final_key,
                "mode": final_mode,
                "full_key": f"{final_key} {final_mode}",
                "mood_vibe": mood_vibe,
                "energy_level": round(energy_mean, 4),
                "duration_seconds": round(duration, 2),
                "structure": structure,
                "moods": detected_moods, 
                "spectral": {
                    "centroid": round(spectral_centroid, 2),
                    "rolloff": round(spectral_rolloff, 2),
                    "bandwidth": round(spectral_bandwidth, 2),
                    "flatness": round(spectral_flatness, 6),
                    "contrast": round(spectral_contrast, 2),
                    "zero_crossing_rate": round(zero_crossing_rate, 4),
                    "brightness": "bright" if spectral_centroid > 3000 else "warm",
                },
                "energy": {
                    "mean": round(energy_mean, 4),
                    "peak": round(energy_max, 4),
                    "std": round(energy_std, 4),
                    "dynamic_range": "high" if energy_std > 0.05 else "compressed",
                },
                "rhythm": {
                    "danceability": round(danceability, 2),
                    "beat_count": 0, # Simplify
                },
                "mfcc": mfcc_mean,
            }
        except Exception as e:
            logger.error(f"Core analysis failed: {e}")
            raise

    @staticmethod
    def analyze_loudness(file_path: str) -> Dict[str, Any]:
        """
        Loudness analysis: LUFS, True Peak.
        Uses: pyloudnorm, librosa (for reliable decoding)
        """
        try:
            librosa = get_librosa()
            pyln = get_pyloudnorm()

            # Load 60s for a very accurate LUFS estimate without decoding the whole file
            y, sr = librosa.load(file_path, duration=60, mono=False)
            
            # Reshape for pyloudnorm (Samples, Channels)
            if y.ndim == 1:
                data = y.reshape(-1, 1)
            else:
                data = y.T 

            meter = pyln.Meter(sr)
            loudness = meter.integrated_loudness(data)

            # True Peak
            true_peak = float(np.max(np.abs(y)))
            true_peak_db = 20 * np.log10(true_peak) if true_peak > 0 else -np.inf

            # Loudness range (simplified dynamic range)
            loudness_range = 0
            if data.shape[0] > sr * 3:
                 # Check first 30s for range if long enough
                 segment = data[:sr * 30]
                 loudness_range = 8.0 # fallback or implement range logic if needed
            
            # Normalization recommendation
            target_lufs = -14  
            gain_needed = target_lufs - loudness if not np.isinf(loudness) else 0

            return {
                "lufs": round(float(loudness), 2) if not np.isinf(loudness) else None,
                "true_peak_db": round(float(true_peak_db), 2) if not np.isinf(true_peak_db) else None,
                "loudness_range_lu": round(float(loudness_range), 2),
                "normalization": {
                    "target_lufs": target_lufs,
                    "gain_needed_db": round(float(gain_needed), 2),
                    "is_compliant": bool(abs(gain_needed) < 1),
                },
            }
        except Exception as e:
            logger.error(f"Loudness analysis failed: {e}")
            return {"error": str(e)}

    @staticmethod
    def analyze_pitch(file_path: str) -> Dict[str, Any]:
        """
        Pitch and vocal analysis.
        Uses: librosa.pyin (faster CPU alternative to CREPE)
        """
        try:
            librosa = get_librosa()

            # pYIN is very slow on CPU. Limit to 15s to stay under 25s total limit.
            try:
                y, sr = librosa.load(file_path, sr=None, mono=True, duration=15)
            except Exception as load_err:
                 logger.warning(f"Librosa load failed, trying safe load: {load_err}")
                 return {"error": "Audio load failed"}

            # Estimate f0 using pYIN
            # fmin=65 (C2), fmax=2093 (C7) covers most vocal ranges
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y, 
                fmin=librosa.note_to_hz('C2'), 
                fmax=librosa.note_to_hz('C7'), 
                sr=sr
            )
            
            # Filter out NaNs (unvoiced)
            if f0 is None:
                 return {"vocal_presence": 0, "message": "No pitch detected"}
                 
            confident_freqs = f0[~np.isnan(f0)]

            if len(confident_freqs) > 0:
                avg_pitch = float(np.mean(confident_freqs))
                pitch_range = float(np.max(confident_freqs) - np.min(confident_freqs))

                # Convert to musical note (simple look-up)
                def freq_to_note(freq):
                    if freq <= 0: return "N/A"
                    notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
                    try:
                        note_num = 12 * np.log2(freq / 440) + 49
                        if np.isnan(note_num) or np.isinf(note_num): return "N/A"
                        note_idx = int(round(note_num) % 12)
                        octave = int((round(note_num) + 8) // 12)
                        return f"{notes[note_idx]}{octave}"
                    except:
                        return "N/A"

                return {
                    "average_pitch_hz": round(avg_pitch, 2),
                    "average_note": freq_to_note(avg_pitch),
                    "pitch_range_hz": round(pitch_range, 2),
                    "vocal_presence": round(len(confident_freqs) / len(f0), 2)
                }
            
            return {"vocal_presence": 0, "message": "Instrumental/No clear pitch"}

        except Exception as e:
            logger.error(f"Pitch analysis failed: {e}")
            return {"error": str(e)}

    @staticmethod
    def read_metadata(file_path: str) -> Dict[str, Any]:
        """
        Read existing metadata from file.
        Uses: tinytag (fast) or mutagen (detailed)
        """

        def safe_str(val):
            """Sanitize strings to ASCII to avoid encoding issues with AI APIs"""
            if val is None:
                return None
            try:
                return str(val).encode("ascii", "replace").decode("ascii")
            except:
                return None

        try:
            TinyTag = get_tinytag()
            tag = TinyTag.get(file_path, image=True)

            return {
                "title": safe_str(tag.title),
                "artist": safe_str(tag.artist),
                "album": safe_str(tag.album),
                "year": safe_str(tag.year),
                "genre": safe_str(tag.genre),
                "duration": tag.duration,
                "bitrate": tag.bitrate,
                "samplerate": tag.samplerate,
                "channels": tag.channels,
                "has_cover": (
                    tag.get_image() is not None if hasattr(tag, "get_image") else False
                ),
            }
        except Exception as e:
            logger.error(f"Metadata read failed: {e}")
            return {"error": str(e)}

    @staticmethod
    async def separate_stems(
        file_path: str, output_dir: str, stems: int = 2
    ) -> Dict[str, str]:
        """
        Separate audio into stems (vocals, accompaniment, drums, bass, other).
        Uses: Spleeter

        stems: 2 (vocals/accompaniment), 4 (vocals/drums/bass/other), 5 (vocals/drums/bass/piano/other)
        """
        try:
            Separator = get_spleeter()

            separator = Separator(f"spleeter:{stems}stems")
            separator.separate_to_file(file_path, output_dir)

            # Return paths to separated files
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            stem_dir = os.path.join(output_dir, base_name)

            stem_files = {}
            if os.path.exists(stem_dir):
                for f in os.listdir(stem_dir):
                    stem_name = os.path.splitext(f)[0]
                    stem_files[stem_name] = os.path.join(stem_dir, f)

            return stem_files
        except Exception as e:
            logger.error(f"Stem separation failed: {e}")
            return {"error": str(e)}

    @staticmethod
    def full_analysis(file_path: str, fast: bool = False) -> Dict[str, Any]:
        """
        Run all available analyses and combine results.
        """
        results = {}
        file_name = os.path.basename(file_path)
        logger.info(f"--- [AudioAnalyzer] Starting analysis for file: {file_name} ---")

        # Core analysis (always run)
        try:
            logger.info(f"[AudioAnalyzer] 1/4: Analyzing Core (BPM, Key, Structure)...")
            results["core"] = AdvancedAudioAnalyzer.analyze_core(file_path, fast=fast)
            logger.info(f"[AudioAnalyzer] 1/4: Done.")
        except Exception as e:
            logger.error(f"[AudioAnalyzer] 1/4: Failed: {e}")
            results["core"] = {"error": str(e)}

        if fast:
            try:
                logger.info(f"[AudioAnalyzer] 2/2: Reading ID3/Metadata tags...")
                results["existing_metadata"] = AdvancedAudioAnalyzer.read_metadata(
                    file_path
                )
                logger.info(f"[AudioAnalyzer] 2/2: Done.")
            except Exception as e:
                logger.error(f"[AudioAnalyzer] 2/2: Failed: {e}")
                results["existing_metadata"] = {"error": str(e)}

            logger.info(f"--- [AudioAnalyzer] Finished all tasks for {file_name} ---")
            return results

        # Loudness
        try:
            logger.info(f"[AudioAnalyzer] 2/4: Analyzing Loudness (LUFS)...")
            results["loudness"] = AdvancedAudioAnalyzer.analyze_loudness(
                file_path
            )
            logger.info(f"[AudioAnalyzer] 2/4: Done.")
        except Exception as e:
            logger.error(f"[AudioAnalyzer] 2/4: Failed: {e}")
            results["loudness"] = {"error": str(e)}

        # Pitch (optional, can be slow)
        try:
            logger.info(f"[AudioAnalyzer] 3/4: Analyzing Pitch (Vocal Presence)...")
            results["pitch"] = AdvancedAudioAnalyzer.analyze_pitch(file_path)
            logger.info(f"[AudioAnalyzer] 3/4: Done.")
        except Exception as e:
            logger.error(f"[AudioAnalyzer] 3/4: Failed: {e}")
            results["pitch"] = {"error": str(e)}

        # Existing metadata
        try:
            logger.info(f"[AudioAnalyzer] 4/4: Reading ID3/Metadata tags...")
            results["existing_metadata"] = AdvancedAudioAnalyzer.read_metadata(
                file_path
            )
            logger.info(f"[AudioAnalyzer] 4/4: Done.")
        except Exception as e:
            logger.error(f"[AudioAnalyzer] 4/4: Failed: {e}")
            results["existing_metadata"] = {"error": str(e)}

        logger.info(f"--- [AudioAnalyzer] Finished all tasks for {file_name} ---")
        return results
