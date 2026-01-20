"""
Groq + Local Whisper AI Service
Zero-cost AI for metadata generation using Groq LLM + local Whisper transcription.
"""

import json
import logging
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


# === LAZY IMPORTS ===
def get_groq_client():
    from groq import Groq

    return Groq(api_key=settings.GROQ_API_KEY)


def get_whisper():
    import whisper

    return whisper


class GroqWhisperService:
    """
    AI service combining:
    - Local Whisper for audio transcription (lyrics extraction)
    - Groq LLM for metadata generation (fast, free, no rate limits)
    """

    VOCAB_MAIN_GENRES = "Classical, Jazz, Blues, Rock, Metal, Pop, Hip-Hop, R&B, Soul, Funk, Electronic, House, Techno, Trance, Drum and Bass, Dubstep, Ambient, Country, Folk, Reggae, Latin, World Music, Soundtrack, Gospel, Experimental"

    VOCAB_MOODS = "Joyful, Euphoric, Melancholic, Sad, Reflective, Nostalgic, Hopeful, Inspiring, Powerful, Angry, Aggressive, Triumphant, Mysterious, Ethereal, Dreamy, Serene, Peaceful, Passionate, Romantic, Dramatic, Epic, Heroic, Somber, Haunting, Dark, Intense, Energetic, Upbeat, Relaxed, Chill"

    VOCAB_INSTRUMENTS = "Vocals, Acoustic Guitar, Electric Guitar, Bass Guitar, Piano, Synthesizer, Drums, Percussion, Strings, Brass, Woodwinds, Organ, Harmonica, Saxophone, Trumpet, Violin, Cello, Harp"

    @staticmethod
    def is_available() -> bool:
        return settings.GROQ_API_KEY is not None and len(settings.GROQ_API_KEY) > 0

    @staticmethod
    def transcribe_audio(
        file_path: str
    ) -> Dict[str, Any]:
        """
        Transcribe audio using Groq Cloud Whisper API (Extremely Fast).
        """
        try:
            import os
            client = get_groq_client()

            # Groq Whisper supports files up to 25MB
            file_size = os.path.getsize(file_path) / (1024 * 1024)
            if file_size > 24:
                logger.warning(f"File too large for Groq Whisper ({file_size:.1f}MB), skipping transcription.")
                return {"text": "[File too large for AI transcription]", "language": "unknown"}

            with open(file_path, "rb") as audio_file:
                # model options: whisper-large-v3, whisper-large-v3-turbo
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(file_path), audio_file.read()),
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
        """
        Generate rich metadata using Groq LLM based on audio analysis results.
        """
        if not GroqWhisperService.is_available():
            raise RuntimeError("GROQ_API_KEY not configured")

        try:
            client = get_groq_client()

            logger.info("DEBUG: Starting context build")

            # Build context from analysis
            analysis_context = ""
            if audio_analysis:
                core = audio_analysis.get("core", {})
                loudness = audio_analysis.get("loudness", {})
                pitch = audio_analysis.get("pitch", {})
                spectral = core.get("spectral", {})
                energy = core.get("energy", {})
                rhythm = core.get("rhythm", {})

                analysis_context = f"""
AUDIO FORENSICS DATA:
- BPM: {core.get('bpm', 'unknown')}
- Key/Mode: {core.get('full_key', 'unknown')}
- Spectral Centroid: {spectral.get('centroid', 'unknown')} Hz (Brightness/Timbre)
- Spectral Rolloff: {spectral.get('rolloff', 'unknown')} Hz (High-freq energy cut-off)
- Spectral Bandwidth: {spectral.get('bandwidth', 'unknown')} (Signal width)
- Spectral Flatness: {spectral.get('flatness', 'unknown')} (Noisiness: 1=Noise, 0=Pure Tone)
- Spectral Contrast: {spectral.get('contrast', 'unknown')} (Texture: High=Clear instrumentation, Low=Dense/Muddy)
- Zero Crossing Rate: {spectral.get('zero_crossing_rate', 'unknown')} (Percussive vs Harmonious)
- Danceability/Rhythmic PLP: {rhythm.get('danceability', 'unknown')} (Quantization/Stability)
- Energy Level: {energy.get('mean', 'unknown')} (RMS)
- Energy Peak: {energy.get('peak', 'unknown')} (Crest factor analysis)
- Dynamic Range: {energy.get('dynamic_range', 'unknown')}
- Integrated Loudness: {loudness.get('lufs', 'unknown')} LUFS
- Pitch Confidence: {pitch.get('vocal_presence', 0) * 100:.1f}% (Vocal probability)
- Track Structure: {core.get('structure', [])} 
- MFCC Signature (first 5): {core.get('mfcc', [])[:5]}
"""

            # Helper to safely sanitize strings for LOGGING/PROMPT (force ASCII to prevent crashes)
            def safe_str(val):
                if val is None:
                    return ""
                try:
                    s = str(val)
                    # Force ASCII to prevent UnicodeEncodeError on Windows envs or libraries
                    return s.encode("ascii", "ignore").decode("ascii")
                except:
                    return "unknown"

            logger.info("DEBUG: Building transcription context")
            transcription_context = ""
            if transcription:
                transcription_context = f"""
VOCAL TRANSCRIPTION (FOR CONTEXT ONLY):
{safe_str(transcription)[:3000]}
"""

            logger.info("DEBUG: Building existing metadata context")
            logger.info("DEBUG: Building existing metadata context")
            existing_context = ""
            if existing_metadata:
                titles = safe_str(existing_metadata.get('title'))
                artists = safe_str(existing_metadata.get('artist'))
                albums = safe_str(existing_metadata.get('album'))
                genres = safe_str(existing_metadata.get('genre'))
                
                existing_context = f"""
LEGACY FILE TAGS (IF ANY):
- Title: {titles}
- Artist: {artists}
- Album: {albums}
- Genre/Style: {genres}
"""

            logger.info("DEBUG: Constructing Prompt string")
            try:
                prompt = f"""You are a Senior Music Supervisor and A&R Metadata Specialist. Your goal is to provide 100% COMPLETE and 95%+ ACCURATE metadata for music catalogs.
             
Analyze the following technical audio forensics and context to deliver a professional-grade classification.

{analysis_context}
{transcription_context}
{existing_context}

EXPERT REASONING GUIDELINES:
1. **Informed Classification**: Use the Forensic Data (BPM, Spectral Flatness, Contrast) as your scientific anchor. 
   - If Spectral Flatness is high (>0.1) and Zero Crossing Rate is high -> It's a percussive or aggressive track (Hip-Hop, Rock, Techno).
   - If Spectral Contrast is high -> The instrumentation is clear and distinct.
   - If Pitch Confidence is low (<25%) -> It is likely an Instrumental track.
2. **Never Leave Gaps**: Even if some forensic values are "unknown", use the Artist/Title/Transcription context to provide a definitive Genre, Mood, and Instrument list. Use your vast knowledge of music history and styles.
3. **Instruments & Vocals**: 
   - If it's a song, identify the delivery (Rap, Sung, etc.). 
   - Always identify at least 3 instruments based on the genre and timbre signals.
4. **Professional Bio**: Create a rich, evocative 3-4 sentence description. 
   - Reference the technical character (e.g., "A driving 124 BPM House track with bright spectral energy...") but focus on the emotional impact and sync potential.

STRICT OUTPUT RULES:
1. Classification & Style:
   - Main Genre: Pick ONE from: {GroqWhisperService.VOCAB_MAIN_GENRES}
   - Sub-Genres (additionalGenres): 2 distinct sub-genres in an array.
   - Moods: 1 or 2 distinct moods. Pick from: {GroqWhisperService.VOCAB_MOODS}
   - Main Instrument: Identify ONE dominant instrument.
   - Instrumentation: Identify 1-3 instruments total (array).
   - Vocal Style: Object with gender, timbre, delivery, emotionalTone. 
     * Use "none" only if the track is strictly instrumental.
   - Keywords: EXACTLY 3-4 high-value sync/search keywords.
   - Track Description (Bio): A professional, high-quality description.
   - Use Cases (useCases): 2 distinct professional sync use cases (array).

2. Identity & Credits:
   - Year: 4-digit release year (estimate if unknown).
   - Album Artist: Fallback to Artist.
   - Language: Detected language or "Instrumental".

Return ONLY valid JSON:
{{
    "title": "...",
    "artist": "...",
    "album": "...",
    "year": "...",
    "track": 1,
    "albumArtist": "...",
    "mainGenre": "...",
    "additionalGenres": ["...", "..."],
    "moods": ["...", "..."],
    "mainInstrument": "...",
    "instrumentation": ["...", "..."],
    "vocalStyle": {{
        "gender": "...",
        "timbre": "...",
        "delivery": "...",
        "emotionalTone": "..."
    }},
    "bpm": {core.get('bpm', 120)},
    "key": "{core.get('key', 'C')}",
    "mode": "{core.get('mode', 'Major')}",
    "trackDescription": "...",
    "keywords": ["...", "...", "..."],
    "useCases": ["...", "..."],
    "catalogNumber": "",
    "isrc": "",
    "iswc": "",
    "upc": "",
    "copyright": "© 2024 Independent",
    "pLine": "℗ 2024 Independent",
    "publisher": "Independent",
    "composer": "",
    "lyricist": "",
    "producer": "",
    "language": "..."
}}
"""
            except Exception as e:
                logger.error(f"DEBUG: Prompt construction failed: {e}")
                raise
            # For Groq API, we can send UTF-8. No need to force ASCII.
            # But we must be careful if we verify it.
            prompt_safe = prompt 

            logger.info("DEBUG: Sending prompt to Groq (length: %d)", len(prompt_safe))

            # Call Groq API
            logger.info("DEBUG: Calling Groq API")
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",  # Updated to latest Llama 3.3
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional music metadata analyst. Always respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt_safe},
                ],
                temperature=0.3,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )

            logger.info("DEBUG: Got response from Groq")
            result_text = response.choices[0].message.content

            # Parse JSON
            try:
                metadata = json.loads(result_text)
            except json.JSONDecodeError:
                # Try to extract JSON from response
                import re

                json_match = re.search(r"\{.*\}", result_text, re.DOTALL)
                if json_match:
                    metadata = json.loads(json_match.group())
                else:
                    raise ValueError("Could not parse AI response as JSON")

            # Ensure BPM and Key from local analysis take priority
            if audio_analysis and "core" in audio_analysis:
                core = audio_analysis["core"]
                metadata["bpm"] = core.get("bpm", metadata.get("bpm"))
                metadata["key"] = core.get("key", metadata.get("key"))
                metadata["mode"] = core.get("mode", metadata.get("mode"))

            return metadata

        except Exception as e:
            logger.error(f"Groq metadata generation failed: {e}")
            raise
    @staticmethod
    async def full_pipeline(file_path: str, transcribe: bool = True) -> Dict[str, Any]:
        """
        Run full analysis + AI pipeline:
        1. Local audio analysis + Cloud transcription (Parallel)
        2. AI metadata generation (Groq)
        """
        import asyncio
        from app.services.audio_analyzer import AdvancedAudioAnalyzer
        
        logger.info("Starting Parallel Meta-Analysis Pipeline...")
        
        # OFF-LOAD HEAVY SYNC TASKS TO THREADS
        tasks = []
        tasks.append(asyncio.to_thread(AdvancedAudioAnalyzer.full_analysis, file_path))
        if transcribe:
             tasks.append(asyncio.to_thread(GroqWhisperService.transcribe_audio, file_path))
             
        # Execute concurrently - THIS NOW REALLY WORKS IN PARALLEL
        results = await asyncio.gather(*tasks)
        
        audio_analysis = results[0]
        transcription = results[1].get("text", "") if (transcribe and len(results) > 1) else None

        # Step 2: AI Metadata
        logger.info("Step 2: Sending to Groq Cloud LLM (Llama 3.3 70B)...")
        try:
            metadata = await GroqWhisperService.generate_metadata(
                audio_analysis=audio_analysis,
                transcription=transcription,
                existing_metadata=audio_analysis.get("existing_metadata"),
            )
            
            # Final Merge
            if audio_analysis and "core" in audio_analysis:
                core = audio_analysis["core"]
                metadata["bpm"] = core.get("bpm", metadata.get("bpm"))
                metadata["key"] = core.get("key", metadata.get("key"))
                metadata["mode"] = core.get("mode", metadata.get("mode"))
                metadata["duration"] = core.get("duration_seconds", metadata.get("duration"))
                metadata["structure"] = core.get("structure", metadata.get("structure"))

            return {
                "metadata": metadata,
                "analysis": audio_analysis,
                "transcription": transcription,
            }

        except Exception as e:
            logger.error(f"Groq pipeline failed: {e}")
            raise
