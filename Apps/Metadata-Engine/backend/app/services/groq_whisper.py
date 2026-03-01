"""
Groq + Whisper AI Service
Zero-cost AI for metadata generation using Groq LLM + Groq Cloud Whisper.
"""

import json
import logging
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


def get_groq_client():
    from groq import Groq
    return Groq(api_key=settings.GROQ_API_KEY)


class GroqWhisperService:
    """
    AI service combining:
    - Groq Cloud Whisper for audio transcription
    - Groq LLM (Llama 3.3 70B) for metadata generation
    """

    VOCAB_MAIN_GENRES = (
        "Classical, Jazz, Blues, Rock, Metal, Pop, Hip-Hop, R&B, Soul, Funk, "
        "Electronic, House, Techno, Trance, Drum and Bass, Dubstep, Ambient, "
        "Country, Folk, Reggae, Latin, World Music, Soundtrack, Gospel, Experimental"
    )

    VOCAB_MOODS = (
        "Joyful, Euphoric, Melancholic, Sad, Reflective, Nostalgic, Hopeful, "
        "Inspiring, Powerful, Angry, Aggressive, Triumphant, Mysterious, Ethereal, "
        "Dreamy, Serene, Peaceful, Passionate, Romantic, Dramatic, Epic, Heroic, "
        "Somber, Haunting, Dark, Intense, Energetic, Upbeat, Relaxed, Chill"
    )

    @staticmethod
    def is_available() -> bool:
        return bool(settings.GROQ_API_KEY)

    @staticmethod
    def transcribe_audio(file_path: str) -> Dict[str, Any]:
        try:
            import os
            client = get_groq_client()
            file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
            if file_size_mb > 24:
                logger.warning(f"File too large for Groq Whisper ({file_size_mb:.1f}MB)")
                return {"text": "[File too large for transcription]", "language": "unknown"}

            with open(file_path, "rb") as af:
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(file_path), af.read()),
                    model="whisper-large-v3",
                    response_format="json",
                )
            return {
                "text": transcription.text,
                "language": getattr(transcription, "language", "unknown"),
            }
        except Exception as e:
            logger.error(f"Groq Cloud transcription failed: {e}")
            return {"error": str(e), "text": ""}

    @staticmethod
    async def generate_metadata(
        audio_analysis: Dict[str, Any],
        transcription: Optional[str] = None,
        existing_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not GroqWhisperService.is_available():
            raise RuntimeError("GROQ_API_KEY not configured")

        client = get_groq_client()

        # ── Build audio context ───────────────────────────────────────────────
        core = audio_analysis.get("core", {})
        loudness = audio_analysis.get("loudness", {})
        pitch = audio_analysis.get("pitch", {})
        spectral = core.get("spectral", {})
        energy = core.get("energy", {})
        rhythm = core.get("rhythm", {})

        # Derived fields from backend analysis
        bpm_val = core.get("bpm", 0)
        key_val = core.get("key", "C")
        mode_val = core.get("mode", "Major")
        energy_mean = energy.get("mean", core.get("energy_level", 0))
        dynamic_range_str = energy.get("dynamic_range", "medium")
        lufs_val = loudness.get("lufs", "N/A")
        centroid_val = spectral.get("centroid", "N/A")
        rolloff_val = spectral.get("rolloff", "N/A")
        flatness_val = spectral.get("flatness", "N/A")
        contrast_val = spectral.get("contrast", "N/A")
        zcr_val = spectral.get("zero_crossing_rate", "N/A")
        vocal_prob = pitch.get("vocal_presence", 0) * 100
        era_hint = core.get("era", "")
        quality_hint = core.get("quality", "")
        audience_hint = core.get("audience", "")
        dynamics_hint = core.get("dynamics", "")

        # Classify energy_level string
        try:
            e_f = float(energy_mean)
            if e_f > 0.2:    energy_level_str = "Very High"
            elif e_f > 0.13: energy_level_str = "High"
            elif e_f > 0.08: energy_level_str = "Medium"
            elif e_f > 0.04: energy_level_str = "Low"
            else:            energy_level_str = "Very Low"
        except Exception:
            energy_level_str = "Medium"

        # BPM → tempo character
        try:
            bpm_f = float(bpm_val)
            if bpm_f < 60:    tempo_char = "Very Slow (Larghissimo)"
            elif bpm_f < 76:  tempo_char = "Slow (Largo)"
            elif bpm_f < 108: tempo_char = "Moderate (Andante/Moderato)"
            elif bpm_f < 132: tempo_char = "Fast (Allegro)"
            elif bpm_f < 168: tempo_char = "Very Fast (Vivace/Presto)"
            else:             tempo_char = "Extremely Fast (Prestissimo)"
        except Exception:
            tempo_char = ""

        def safe_s(v):
            if v is None: return ""
            try: return str(v).encode("ascii", "ignore").decode("ascii")
            except: return ""

        analysis_context = f"""
AUDIO FORENSICS:
- BPM: {bpm_val}  ({tempo_char})
- Key / Mode: {key_val} {mode_val}
- Energy Level: {energy_level_str}  (RMS={energy_mean})
- Integrated Loudness: {lufs_val} LUFS
- True Peak: {loudness.get('true_peak_db', 'N/A')} dBTP
- Dynamic Range: {dynamic_range_str}
- Spectral Centroid: {centroid_val} Hz  (brightness proxy)
- Spectral Rolloff: {rolloff_val} Hz
- Spectral Flatness: {flatness_val}  (0=tonal, 1=noise)
- Spectral Contrast: {contrast_val}
- Zero Crossing Rate: {zcr_val}
- Vocal Presence Probability: {vocal_prob:.1f}%
- Era hint from DSP: {era_hint}
- Production quality hint: {quality_hint}
- Target audience hint: {audience_hint}
- Dynamics hint: {dynamics_hint}
"""

        transcription_context = ""
        if transcription:
            transcription_context = f"\nLYRIC TRANSCRIPTION (context only):\n{safe_s(transcription)[:2000]}\n"

        existing_context = ""
        if existing_metadata:
            existing_context = f"""
EXISTING FILE TAGS (prefer these for identity fields):
- Title: {safe_s(existing_metadata.get('title'))}
- Artist: {safe_s(existing_metadata.get('artist'))}
- Album: {safe_s(existing_metadata.get('album'))}
- Genre: {safe_s(existing_metadata.get('genre'))}
"""

        prompt = f"""You are a Senior Music Supervisor and A&R Metadata Specialist.
Analyze the audio forensics and produce COMPLETE, ACCURATE metadata for music catalog use.

{analysis_context}
{transcription_context}
{existing_context}

CLASSIFICATION GUIDELINES:
1. Use forensic data as your scientific anchor for genre/mood decisions.
2. Spectral Flatness > 0.1 + high ZCR → percussive/aggressive (Hip-Hop, Rock, Techno).
3. Spectral Contrast high → clear instrumentation, distinct parts.
4. Vocal Presence < 25% → very likely Instrumental.
5. Never leave arrays empty. Use vocabulary: GENRES: {GroqWhisperService.VOCAB_MAIN_GENRES}
6. MOODS: {GroqWhisperService.VOCAB_MOODS}

Return ONLY valid JSON with ALL these fields:

{{
  "title": "infer from context or generate fitting title",
  "artist": "infer or Unknown Artist",
  "album": "infer or Single",
  "albumArtist": "same as artist if unknown",
  "year": "4-digit year",
  "track": 1,
  "mainGenre": "specific subgenre e.g. Deep House not Electronic",
  "additionalGenres": ["2-3 subgenres"],
  "moods": ["3-5 specific moods"],
  "mainInstrument": "single dominant instrument",
  "instrumentation": ["3-6 instruments"],
  "vocalStyle": {{
    "gender": "male|female|mixed|none",
    "timbre": "description or none",
    "delivery": "style or none",
    "emotionalTone": "tone or none"
  }},
  "trackDescription": "2-3 sentence professional sync-library description",
  "keywords": ["10-15 SEO/discovery keywords"],
  "useCases": ["4-7 sync use cases e.g. Film Score, TV Drama, Workout Playlist"],
  "language": "Instrumental or ISO 639-1 code",
  "energy_level": "{energy_level_str}",
  "energyLevel": "{energy_level_str}",
  "mood_vibe": "1-2 sentence poetic mood description",
  "musicalEra": "e.g. 2020s Modern, 90s Retro, Classic 70s",
  "productionQuality": "e.g. Studio Polished, Lo-Fi, Mastered for Streaming",
  "dynamics": "e.g. High Dynamic Range, Heavily Compressed, Punchy",
  "targetAudience": "e.g. Electronic music fans 18-34",
  "tempoCharacter": "{tempo_char}",
  "analysisReasoning": "brief explanation of genre/mood decisions based on audio data",
  "copyright": "© {{}}, Independent",
  "pLine": "℗ {{}}, Independent",
  "publisher": "Independent",
  "composer": "",
  "lyricist": "",
  "producer": "",
  "catalogNumber": "",
  "isrc": "",
  "iswc": "",
  "upc": ""
}}
"""

        logger.info("Sending metadata prompt to Groq (length: %d)", len(prompt))

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a professional music metadata API. Always respond with valid JSON only. Never include markdown or explanations outside the JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.25,
            max_tokens=2500,
            response_format={"type": "json_object"},
        )

        result_text = response.choices[0].message.content

        try:
            metadata = json.loads(result_text)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", result_text, re.DOTALL)
            if m:
                metadata = json.loads(m.group())
            else:
                raise ValueError("Could not parse AI response as JSON")

        # Backend DSP values override LLM for technical fields
        if audio_analysis and "core" in audio_analysis:
            c = audio_analysis["core"]
            metadata["bpm"] = c.get("bpm", metadata.get("bpm", 0))
            metadata["key"] = c.get("key", metadata.get("key", "C"))
            metadata["mode"] = c.get("mode", metadata.get("mode", "Major"))
            metadata["tempoCharacter"] = tempo_char

        # Sync energy_level / energyLevel
        metadata["energy_level"] = energy_level_str
        metadata["energyLevel"] = energy_level_str

        return metadata

    @staticmethod
    async def full_pipeline(file_path: str, transcribe: bool = True) -> Dict[str, Any]:
        import asyncio
        from app.services.audio_analyzer import AdvancedAudioAnalyzer

        logger.info("Starting Parallel Meta-Analysis Pipeline...")

        tasks = [asyncio.to_thread(AdvancedAudioAnalyzer.full_analysis, file_path)]
        if transcribe:
            tasks.append(asyncio.to_thread(GroqWhisperService.transcribe_audio, file_path))

        results = await asyncio.gather(*tasks)
        audio_analysis = results[0]
        transcription = results[1].get("text", "") if (transcribe and len(results) > 1) else None

        logger.info("Step 2: Groq Cloud LLM (Llama 3.3 70B)...")
        metadata = await GroqWhisperService.generate_metadata(
            audio_analysis=audio_analysis,
            transcription=transcription,
            existing_metadata=audio_analysis.get("existing_metadata"),
        )

        # Final merge of DSP values
        if audio_analysis and "core" in audio_analysis:
            core = audio_analysis["core"]
            metadata["bpm"] = core.get("bpm", metadata.get("bpm"))
            metadata["key"] = core.get("key", metadata.get("key"))
            metadata["mode"] = core.get("mode", metadata.get("mode"))
            metadata["duration"] = core.get("duration_seconds", metadata.get("duration"))
            metadata["structure"] = core.get("structure", metadata.get("structure", []))

        return {"metadata": metadata, "analysis": audio_analysis, "transcription": transcription}
