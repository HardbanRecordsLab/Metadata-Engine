import os
try:
    import numpy as np
except ImportError:
    np = None
import logging

try:
    import librosa
    import numpy as np
except ImportError:
    # Local analysis disabled
    librosa = None
    # numpy might be missing too if librosa is missing, handled by earlier lazy loading logic usually
    # but here we imported it at top level. Wait, top level import is at line 2.
    # If numpy is missing, line 2 crashes.
    # But I removed numpy from requirements. So line 2 WILL crash.
    pass

try:
    from mutagen.easyid3 import EasyID3
    from mutagen.id3 import (
        ID3,
        TIT2,
        TPE1,
        TALB,
        TCON,
        TDRC,
        COMM,
        USLT,
        TPUB,
        TCOP,
        TCOM,
        TEXT,
    )
    from mutagen.wave import WAVE
    from mutagen.mp3 import MP3
    from mutagen.flac import FLAC
except ImportError:
    # Should not happen as mutagen is in requirements
    ID3 = None
    MP3 = None
    FLAC = None
    WAVE = None

logger = logging.getLogger(__name__)


class MIRService:
    @staticmethod
    def is_available():
        return librosa is not None

    @staticmethod
    async def analyze_audio(file_path: str):
        """
        Uses Librosa to extract technical features from the audio file.
        Returns a dictionary of features.
        """
        if not MIRService.is_available():
            raise RuntimeError("Librosa/Mutagen libraries not installed on backend.")

        try:
            # Load audio (only first 60 seconds for performance, unless deep analysis requested)
            # Duration analysis requires full load or stream info.
            y, sr = librosa.load(file_path, duration=120)

            # 1. BPM & Beat Tracking
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo)

            # 2. Spectral Features (Timbre/Brightness)
            spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
            spectral_rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))

            # 3. Key / Tonality (Simple estimate)
            # Chromecast -> shift to major/minor
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)
            key_idx = np.argmax(np.mean(chroma, axis=1))
            keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
            path_key = keys[key_idx]

            # 4. Danceability (Rough estimate based on rhythm stability)
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            pulse = librosa.beat.plp(onset_envelope=onset_env, sr=sr)
            danceability = float(
                np.mean(pulse)
            )  # Normalize logic would be needed for 0-1

            return {
                "bpm": round(bpm, 1),
                "key": path_key,
                "duration": librosa.get_duration(y=y, sr=sr),
                "technical": {
                    "spectral_centroid": float(spectral_centroid),
                    "spectral_rolloff": float(spectral_rolloff),
                    "danceability_score": round(danceability, 2),
                },
            }
        except Exception as e:
            logger.error(f"MIR Analysis Failed: {e}")
            raise e

    @staticmethod
    def write_metadata(file_path: str, metadata: dict):
        """
        Writes standard ID3/Vorbis tags using Mutagen.
        Supports MP3, WAV, FLAC.
        """
        if not MIRService.is_available():
            raise RuntimeError("Mutagen library not installed.")

        ext = os.path.splitext(file_path)[1].lower()

        try:
            audio = None
            if ext == ".mp3":
                audio = MP3(file_path, ID3=ID3)
                try:
                    audio.add_tags()
                except Exception:
                    pass  # Tags might exist
            elif ext == ".wav":
                try:
                    audio = WAVE(file_path)
                    try:
                        audio.add_tags()
                    except Exception:
                        pass
                except Exception:
                    # Some WAVs are weird, standard open might fail
                    return False
            elif ext == ".flac":
                audio = FLAC(file_path)

            if audio is None:
                return False

            # --- MP3 / WAV (ID3) Mapping ---
            if ext in [".mp3", ".wav"]:
                # Basic
                if "title" in metadata:
                    audio.tags.add(TIT2(encoding=3, text=metadata["title"]))
                if "artist" in metadata:
                    audio.tags.add(TPE1(encoding=3, text=metadata["artist"]))
                if "album" in metadata:
                    audio.tags.add(TALB(encoding=3, text=metadata["album"]))
                if "genre" in metadata:
                    audio.tags.add(TCON(encoding=3, text=metadata["genre"]))
                if "year" in metadata:
                    audio.tags.add(TDRC(encoding=3, text=str(metadata["year"])))

                # Technical (BPM & Key) - Local Analysis Results
                from mutagen.id3 import TBPM, TKEY

                if "bpm" in metadata and metadata["bpm"]:
                    audio.tags.add(TBPM(encoding=3, text=str(metadata["bpm"])))
                if "key" in metadata and metadata["key"]:
                    audio.tags.add(TKEY(encoding=3, text=str(metadata["key"])))

                # Extended (Requested by user)
                if "publisher" in metadata:
                    audio.tags.add(TPUB(encoding=3, text=metadata["publisher"]))
                if "label" in metadata:
                    audio.tags.add(
                        TPUB(encoding=3, text=metadata["label"])
                    )  # Fallback if same
                if "copyright" in metadata:
                    audio.tags.add(TCOP(encoding=3, text=metadata["copyright"]))
                if "composer" in metadata:
                    audio.tags.add(TCOM(encoding=3, text=metadata["composer"]))
                if "lyricist" in metadata:
                    audio.tags.add(TEXT(encoding=3, text=metadata["lyricist"]))

                # Lyrics
                if "lyrics" in metadata:
                    audio.tags.add(
                        USLT(
                            encoding=3,
                            lang="eng",
                            desc="Lyrics",
                            text=metadata["lyrics"],
                        )
                    )

                audio.save(v2_version=3)  # Force ID3v2.3 for max compatibility
                return True

            # --- FLAC (Vorbis) Mapping ---
            if ext == ".flac":
                if "title" in metadata:
                    audio["title"] = metadata["title"]
                if "artist" in metadata:
                    audio["artist"] = metadata["artist"]
                if "album" in metadata:
                    audio["album"] = metadata["album"]
                if "year" in metadata:
                    audio["date"] = str(metadata["year"])
                if "genre" in metadata:
                    audio["genre"] = metadata["genre"]
                if "copyright" in metadata:
                    audio["copyright"] = metadata["copyright"]
                if "publisher" in metadata:
                    audio["publisher"] = metadata["publisher"] or metadata.get("label")
                if "lyrics" in metadata:
                    audio["lyrics"] = metadata["lyrics"]

                # Technical
                if "bpm" in metadata:
                    audio["bpm"] = str(metadata["bpm"])
                if "key" in metadata:
                    audio["initialkey"] = str(
                        metadata["key"]
                    )  # 'initialkey' is common Vorbis field

                audio.save()
                return True

        except Exception as e:
            logger.error(f"Tagging Failed: {e}")
            raise e
