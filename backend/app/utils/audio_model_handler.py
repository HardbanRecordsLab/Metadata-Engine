import os
import io
from typing import List, Dict, Any

# Lazy imports for optional ML dependencies
try:
    import numpy as np
except ImportError:
    np = None

try:
    import librosa
except ImportError:
    librosa = None

try:
    import tensorflow as tf
except ImportError:
    tf = None

# --- Configuration ---
# ... (constants unchanged) ...
MODEL_PATH = os.getenv("MOOD_MODEL_PATH", "models/mood_model_v2_finetuned.h5")
AUDIO_PARAMS = {"sample_rate": 22050, "duration_secs": 30, "n_mels": 128}
CLASS_LABELS = [
    "Angry", "Anxious", "Calm", "Celebratory", "Dark", "Dreamy", "Energetic",
    "Euphoric", "Heartbreaking", "Intense", "Melancholic", "Mysterious",
    "Nostalgic", "Passionate", "Peaceful", "Reflective", "Romantic", "Sad",
    "Sensual", "Somber", "Triumphant", "Upbeat",
]


class AudioModelHandler:
    """
    Class for handling audio mood classification model.
    Loads model, processes audio files and returns predictions.
    """

    model: Any = None

    def load_model(self):
        """Loads Keras model into memory."""
        if tf is None:
            # Silent fallback
            self.model = None
            return

        if not os.path.exists(MODEL_PATH):
            self.model = None
            return

        try:
            self.model = tf.keras.models.load_model(MODEL_PATH)
        except Exception as e:
            logger.error(f"Error loading model from '{MODEL_PATH}': {e}")
            self.model = None

    def _preprocess_audio(self, audio_bytes: bytes) -> Any:
        """Processes raw audio bytes into Mel spectrogram, ready for prediction."""
        if librosa is None or np is None:
            print("Warning: librosa or numpy not installed. Audio preprocessing disabled.")
            return None
            
        try:
            signal, sr = librosa.load(
                io.BytesIO(audio_bytes),
                sr=AUDIO_PARAMS["sample_rate"],
                duration=AUDIO_PARAMS["duration_secs"],
            )

            # Align signal length
            expected_length = (
                AUDIO_PARAMS["sample_rate"] * AUDIO_PARAMS["duration_secs"]
            )
            if len(signal) < expected_length:
                signal = np.pad(signal, (0, expected_length - len(signal)), "constant")
            else:
                signal = signal[:expected_length]

            # Ekstrakcja cech (spektrogram Mel)
            mel_spectrogram = librosa.feature.melspectrogram(
                y=signal, sr=sr, n_mels=AUDIO_PARAMS["n_mels"]
            )
            log_mel_spectrogram = librosa.power_to_db(mel_spectrogram, ref=np.max)

            # Normalizacja
            min_val, max_val = np.min(log_mel_spectrogram), np.max(log_mel_spectrogram)
            if max_val - min_val > 0:
                normalized_spectrogram = (log_mel_spectrogram - min_val) / (
                    max_val - min_val
                )
            else:
                normalized_spectrogram = log_mel_spectrogram

            # Add batch and channel dimensions
            return normalized_spectrogram[np.newaxis, ..., np.newaxis]

        except Exception as e:
            print(f"Error during audio processing: {e}")
            return None

    def predict_moods(self, audio_bytes: bytes, top_n: int = 5) -> List[Dict[str, Any]]:
        """
        Makes mood predictions based on provided audio bytes.
        """
        if self.model is None:
            return []

        spectrogram = self._preprocess_audio(audio_bytes)
        if spectrogram is None:
            return []

        try:
            predictions = self.model.predict(spectrogram)[0]

            # Associate predictions with labels and sort
            results = [
                {"mood": label, "score": float(score)}
                for label, score in zip(CLASS_LABELS, predictions)
            ]
            sorted_results = sorted(results, key=lambda x: x["score"], reverse=True)

            return sorted_results[:top_n]
        except Exception as e:
            print(f"Error during model prediction: {e}")
            return []


# Create a single instance that will be used throughout the application
mood_model_handler = AudioModelHandler()
