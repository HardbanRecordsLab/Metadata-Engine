# backend/app/services/fresh_track_analyzer.py
"""
Fresh Track Analyzer - Główny orchestrator
E:\\Music-Metadata-Engine\\backend\\app\\services\\fresh_track_analyzer.py

Dla NOWYCH utworów (nie w bazach)
Accuracy: 90-95%
Time: 35-40s
Docker: LEKKI (~150MB total libs)
"""

import asyncio
import time
from typing import Dict, Any
import logging

from .deep_audio_analyzer import DeepAudioAnalyzer
from .llm_ensemble import LLMEnsemble

logger = logging.getLogger(__name__)


class FreshTrackAnalyzer:
    """
    Analiza utworów NIEZNANYCH w bazach
    
    Architektura:
    1. Deep Audio Features (12-15s, librosa)
    2. LLM Consensus (10-12s, API calls = 0 MB)
    3. Optional Lyrics (8-10s, whisper-tiny = 40MB)
    
    Total Docker footprint: ~150MB
    Total Time: 35-40s
    Accuracy: 90-95%
    """
    
    def __init__(self):
        self.audio_analyzer = DeepAudioAnalyzer()
        self.llm_ensemble = LLMEnsemble()
        
        logger.info("Fresh Track Analyzer initialized (lean Docker mode)")
    
    async def analyze_fresh_track(
        self,
        file_path: str,
        include_lyrics: bool = False,
        model_preference: str = "pro",
        time_budget: int = 120,
        job_id: str = None
    ) -> Dict[str, Any]:

        """
        Główna funkcja analizy
        
        Args:
            file_path: Ścieżka do pliku MP3/WAV
            include_lyrics: Czy transkrybować lyrics (dodatkowe 8-10s + 40MB)
            time_budget: Max czas w sekundach (domyślnie 45s, ale może być 20s)
        
        Returns:
            Pełna analiza z 90-95% accuracy
        """
        
        start_time = time.time()
        
        logger.info(f"Analyzing fresh track: {file_path} (Budget: {time_budget}s)")
        
        try:
            # === LAYER 0: Identity & Integrity ===
            from ..utils.hash_generator import generate_file_hash
            file_hash = generate_file_hash(file_path)
            
            # === LAYER 1: Deep Audio Features (12-15s) ===
            logger.info("Layer 1: Extracting audio features...")
            audio_features = await self.audio_analyzer.extract_all_features(file_path)
            
            # Add hash to features for downstream use
            audio_features['meta']['sha256'] = file_hash
            
            layer1_time = time.time() - start_time

            logger.info(f"Layer 1 completed in {layer1_time:.1f}s")
            
            # Check remaining budget
            remaining = time_budget - (time.time() - start_time)
            
            # RELAXED LIMIT: Only skip if less than 3 seconds (was 5)
            # This gives LLM a chance even in tight scenarios
            if remaining < 3:
                logger.warning(f"Time budget low ({remaining:.1f}s). Skipping LLM & Lyrics.")
                llm_consensus = self.llm_ensemble._fallback_classification(audio_features)
                lyrics_analysis = {}
            else:
                # === LAYER 2: LLM Consensus (10-12s, 0 MB) ===
                logger.info("Layer 2: LLM consensus classification...")
                
                # Dodaj szybkie heurystyki jako hint dla LLM
                ml_hints = self._quick_heuristics(audio_features)
                
                # Dynamiczny timeout dla LLM
                llm_timeout = max(5, remaining - 1) # Zostaw 1s na merge
                
                # ── Streaming opisu w czasie rzeczywistym (równolegle z konsensusem) ──
                stream_task = None
                streamed_description = ""
                if job_id:
                    stream_task = asyncio.create_task(
                        self.llm_ensemble.stream_description(
                            audio_features,
                            ml_hints,
                            job_id=job_id,
                            model_preference=model_preference,
                        )
                    )
                    logger.info(f"Description streaming started for job {job_id}")
                
                try:
                    llm_consensus = await asyncio.wait_for(
                        self.llm_ensemble.consensus_classification(
                            audio_features,
                            ml_hints,
                            model_preference=model_preference,
                            job_id=job_id or "fresh_analysis"
                        ),
                        timeout=llm_timeout
                    )

                except asyncio.TimeoutError:
                    logger.warning("LLM Ensemble timed out. Using fallback.")
                    llm_consensus = self.llm_ensemble._fallback_classification(audio_features)
                
                # Zbierz strumieniowany opis i użyj, jeśli jest bogatszy
                if stream_task:
                    try:
                        streamed_description = await asyncio.wait_for(stream_task, timeout=5.0)
                    except (asyncio.TimeoutError, Exception) as e:
                        logger.warning(f"Stream task collection failed: {e}")
                        if not stream_task.done():
                            stream_task.cancel()
                
                if streamed_description and len(streamed_description) > len(
                    llm_consensus.get("trackDescription", "")
                ):
                    llm_consensus["trackDescription"] = streamed_description
                    logger.info("Used streamed description (higher quality)")
                
                # ── Automatyczny re-run w trybie Pro przy niskiej pewności ──
                CONFIDENCE_THRESHOLD = 0.70
                consensus_confidence = float(llm_consensus.get("confidence", 0.75))
                remaining_after_l2 = time_budget - (time.time() - start_time)
                if (
                    consensus_confidence < CONFIDENCE_THRESHOLD
                    and model_preference == "flash"
                    and remaining_after_l2 > 12
                ):
                    logger.info(
                        f"Confidence {consensus_confidence:.2f} < {CONFIDENCE_THRESHOLD} — running Pro re-analysis pass"
                    )
                    pro_timeout = min(remaining_after_l2 - 2.0, 25.0)
                    try:
                        pro_consensus = await asyncio.wait_for(
                            self.llm_ensemble.consensus_classification(
                                audio_features,
                                ml_hints,
                                model_preference="pro",
                            ),
                            timeout=pro_timeout,
                        )
                        pro_confidence = float(pro_consensus.get("confidence", 0.0))
                        if pro_confidence > consensus_confidence:
                            if streamed_description and len(streamed_description) > len(
                                pro_consensus.get("trackDescription", "")
                            ):
                                pro_consensus["trackDescription"] = streamed_description
                            llm_consensus = pro_consensus
                    except asyncio.TimeoutError:
                        logger.warning("Pro re-analysis pass timed out — keeping Flash result")
                    except Exception as e:
                        logger.warning(f"Pro re-analysis pass failed: {e} — keeping Flash result")
                
                layer2_time = time.time() - start_time - layer1_time
                logger.info(f"Layer 2 completed in {layer2_time:.1f}s")
                
                # === LAYER 3: Optional Lyrics (8-10s, adds 40MB to Docker) ===
                lyrics_analysis = {}
                
                remaining = time_budget - (time.time() - start_time)
                
                # Only run lyrics if we have at least 10s left AND requested
                if include_lyrics and remaining > 10:
                    logger.info(f"Layer 3: Extracting lyrics (Budget remaining: {remaining:.1f}s)...")
                    try:
                        # Give it strict timeout
                        lyrics_analysis = await asyncio.wait_for(
                            self._extract_lyrics(file_path, audio_features),
                            timeout=remaining - 1
                        )
                        layer3_time = time.time() - start_time - layer1_time - layer2_time
                        logger.info(f"Layer 3 completed in {layer3_time:.1f}s")
                    except asyncio.TimeoutError:
                        logger.warning("Lyrics extraction timed out. Skipping.")
                else:
                    if include_lyrics:
                        logger.info(f"Skipping lyrics due to low time budget ({remaining:.1f}s < 10s)")
            
            # === ENSEMBLE: Merge Results ===
            final_result = self._merge_results(
                audio_features,
                llm_consensus,
                lyrics_analysis
            )
            
            total_time = time.time() - start_time
            
            # Use _tech_meta instead of meta to avoid conflicts with Metadata schema
            final_result['_tech_meta']['analysis_time'] = round(total_time, 2)
            final_result['_tech_meta']['target_met'] = total_time <= time_budget
            try:
                from datetime import datetime
                ts = datetime.utcnow().isoformat() + "Z"
            except Exception:
                ts = ""
            final_result["analysisVersion"] = "2.1.0"
            final_result["analysisTimestamp"] = ts
            final_result["pipelineParams"] = {
                "includeLyrics": bool(include_lyrics),
                "modelPreference": str(model_preference),
                "timeBudgetSec": int(time_budget),
                "featureCount": int(audio_features.get("meta", {}).get("total_features", 0)),
                "sampleRate": int(audio_features.get("meta", {}).get("sample_rate", 0)),
            }
            
            logger.info(f"Analysis completed in {total_time:.1f}s")
            
            return final_result
            
        except Exception as e:
            logger.error(f"Fresh track analysis failed: {e}")
            raise
    
    def _quick_heuristics(self, audio_features: Dict) -> Dict:
        """
        Richer DSP-based heuristics as pre-classification hints for the LLM.
        These guide the LLM without constraining it, improving accuracy.
        """
        
        rhythm = audio_features.get('rhythm', {})
        energy = audio_features.get('energy', {})
        harmonic = audio_features.get('harmonic', {})
        spectral = audio_features.get('spectral', {})
        
        tempo = float(rhythm.get('tempo', 120))
        rms = float(energy.get('rms_mean', 0.1))
        hp_ratio = float(harmonic.get('harmonic_percussive_ratio', 1.0))
        centroid = float(spectral.get('centroid_mean', 2000))
        flatness = float(spectral.get('flatness_mean', 0.5))
        dynamic_range = float(energy.get('dynamic_range', 0.2))
        zcr = float(energy.get('zcr_mean', 0.05))
        
        # ── Genre Hints ────────────────────────────────────────────────────────
        genre_hints = []
        
        # Electronic broad signal
        if tempo > 140 and rms > 0.18:
            genre_hints.append('electronic/bass music')
        # Drum & Bass
        if 155 <= tempo <= 185 and flatness > 0.4:
            genre_hints.append('drum and bass')
        # Trance / Progressive
        if 128 <= tempo <= 145 and flatness > 0.5 and hp_ratio > 1.5:
            genre_hints.append('trance/progressive')
        # Techno / Industrial
        if 128 <= tempo <= 145 and flatness < 0.4 and hp_ratio < 1.5:
            genre_hints.append('techno')
        # Deep House / Tech House
        if 118 <= tempo <= 130 and rms < 0.15 and centroid < 3000:
            genre_hints.append('deep house')
        elif 118 <= tempo <= 132 and rms >= 0.15:
            genre_hints.append('tech house/electro house')
        # Dubstep / Bass
        if 130 <= tempo <= 150 and rms > 0.18 and hp_ratio < 1.3:
            genre_hints.append('dubstep/bass music')
        # Trap / Dark Hip-Hop
        if 120 <= tempo <= 145 and hp_ratio < 1.2 and rms > 0.12 and centroid < 2500:
            genre_hints.append('trap')
        # Hip-Hop / Boom Bap
        if 80 <= tempo <= 100 and hp_ratio < 2 and rms > 0.10:
            genre_hints.append('hip-hop')
        # Lo-Fi / Chillhop
        if 70 <= tempo <= 100 and flatness < 0.3 and rms < 0.12:
            genre_hints.append('lo-fi/chillhop')
        # R&B / Neo-Soul
        if 70 <= tempo <= 110 and hp_ratio > 1.5 and centroid < 2500 and rms > 0.08:
            genre_hints.append('r&b/soul')
        # Jazz
        if tempo < 180 and hp_ratio > 2.5 and flatness < 0.35:
            genre_hints.append('jazz/neo-soul')
        # Classical / Orchestral
        if hp_ratio > 3.5 and centroid < 2000 and flatness < 0.25:
            genre_hints.append('classical/orchestral')
        # Ambient / Drone
        if tempo < 80 and rms < 0.08 and flatness < 0.3:
            genre_hints.append('ambient/atmospheric')
        # Afrobeats / World (mid-tempo, complex rhythm)
        if 95 <= tempo <= 115 and rhythm.get('rhythm_complexity', 'medium') == 'complex' and centroid > 2000:
            genre_hints.append('afrobeats/world')
        # Pop / Commercial
        if centroid > 3200 and 100 <= tempo <= 135 and rms > 0.12:
            genre_hints.append('pop/commercial')
        # Rock / Alternative
        if 110 <= tempo <= 145 and zcr > 0.12 and hp_ratio > 1.0:
            genre_hints.append('rock/alternative')
        
        # Phonk / Drift Phonk
        if 85 <= tempo <= 105 and rms > 0.18 and centroid > 3500:
            genre_hints.append('phonk')
        # Drill / UK Drill
        if 135 <= tempo <= 150 and 'complex' in str(rhythm.get('rhythm_complexity', '')).lower() and hp_ratio < 1.1:
            genre_hints.append('drill')
        # Melodic Techno / Afterlife style
        if 122 <= tempo <= 126 and hp_ratio > 1.8 and dynamic_range > 0.22:
            genre_hints.append('melodic techno')
        # Hard Techno / Industrial
        if tempo > 140 and rms > 0.22:
            genre_hints.append('hard techno/industrial')

        # ── Mood Hints ─────────────────────────────────────────────────────────
        mood_hints = []
        
        if rms > 0.22 and tempo > 135:
            mood_hints.append('frenetic/overwhelming')
        if rms > 0.18 and tempo > 130:
            mood_hints.append('energetic/powerful')
        if rms > 0.20 and dynamic_range < 0.12:
            mood_hints.append('aggressive/intense')
        if rms < 0.07 and tempo < 90:
            mood_hints.append('calm/meditative')
        if rms < 0.10 and flatness < 0.25:
            mood_hints.append('melancholic/introspective')
        if centroid > 3500 and rms > 0.12 and 'major' in str(harmonic.get('mode', '')).lower():
            mood_hints.append('happy/euphoric')
        if 'minor' in str(harmonic.get('mode', '')).lower() and rms > 0.15:
            mood_hints.append('dark/intense')
        if 'minor' in str(harmonic.get('mode', '')).lower() and rms < 0.12:
            mood_hints.append('melancholic/atmospheric')
        if 105 <= tempo <= 128 and rms > 0.10 and flatness < 0.45:
            mood_hints.append('groovy/danceable')
        if tempo > 128 and dynamic_range > 0.25:
            mood_hints.append('hypnotic/driving')
        if dynamic_range > 0.35 and hp_ratio > 2.0:
            mood_hints.append('cinematic/dramatic')
        if centroid > 4000 and flatness > 0.6:
            mood_hints.append('shimmering/ethereal')

        
        return {
            'genre': {
                'primary_genre': genre_hints[0] if genre_hints else 'unknown',
                'hints': genre_hints[:5],
                'confidence': 0.65
            },
            'mood': {
                'primary_mood': mood_hints[0] if mood_hints else 'neutral',
                'hints': mood_hints[:5]
            },
            'method': 'enhanced_heuristic_hints'
        }

    
    async def _extract_lyrics(self, file_path: str, audio_features: Dict) -> Dict:
        """
        Opcjonalna ekstrakcja lyrics
        
        Docker impact: +40MB (whisper-tiny)
        Time: +8-10s
        Accuracy boost: +5-8% dla vocal tracks
        """
        
        try:
            # Check if vocal (z audio features)
            energy = audio_features.get('energy', {})
            vocal_presence = energy.get('vocal_presence', 0)
            is_likely_vocal = vocal_presence > 0.04
            
            if not is_likely_vocal:
                return {'has_lyrics': False, 'reason': 'instrumental_detected'}
            
            # Whisper-tiny transcription
            import whisper
            
            model = whisper.load_model("tiny")  # 39MB
            
            result = await asyncio.to_thread(
                model.transcribe,
                file_path,
                language='en',
                task='transcribe',
                fp16=False  # CPU mode
            )
            
            lyrics = result['text']
            
            if not lyrics or len(lyrics) < 20:
                return {'has_lyrics': False, 'reason': 'no_text_detected'}
            
            # Analyze lyrics with LLM (już mamy w ensemble)
            lyrics_insights = await self._analyze_lyrics_with_llm(lyrics)
            
            return {
                'has_lyrics': True,
                'lyrics': lyrics,
                'insights': lyrics_insights
            }
            
        except Exception as e:
            logger.warning(f"Lyrics extraction failed: {e}")
            return {'has_lyrics': False, 'error': str(e)}
    
    async def _analyze_lyrics_with_llm(self, lyrics: str) -> Dict:
        """Use Groq to analyze lyrics content"""
        
        try:
            from groq import Groq
            import os
            
            client = Groq(api_key=os.getenv('GROQ_API_KEY'))
            
            prompt = f"""Analyze these lyrics:

{lyrics[:1000]}

Return JSON:
{{
  "themes": ["theme1", "theme2"],
  "language": "en",
  "explicit": true/false,
  "mood_from_lyrics": ["mood1", "mood2"],
  "genre_hints": ["genre based on lyrical style"]
}}"""
            
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=300
            )
            
            import json
            return json.loads(response.choices[0].message.content)
            
        except:
            return {}
    
    def _merge_results(
        self,
        audio_features: Dict,
        llm_consensus: Dict,
        lyrics_analysis: Dict
    ) -> Dict:
        """
        Merge results into a flat Metadata object.
        """
        
        # ── DSP-derived technical values (authoritative) ──────────────────────
        bpm_val = audio_features.get('rhythm', {}).get('tempo', 0)
        key_val = audio_features.get('harmonic', {}).get('key', 'C')
        mode_val = audio_features.get('harmonic', {}).get('mode', 'Major')

        # Build tempoCharacter from BPM
        try:
            bpm_f = float(bpm_val)
            if bpm_f < 60:    tempo_char = "Very Slow (Larghissimo)"
            elif bpm_f < 76:  tempo_char = "Slow (Largo)"
            elif bpm_f < 108: tempo_char = "Moderate (Andante/Moderato)"
            elif bpm_f < 132: tempo_char = "Fast (Allegro)"
            elif bpm_f < 168: tempo_char = "Very Fast (Vivace/Presto)"
            else:             tempo_char = "Extremely Fast (Prestissimo)"
        except Exception:
            tempo_char = llm_consensus.get('tempoCharacter', '')

        # Energy level from LLM (already computed with audio context)
        energy_str = llm_consensus.get('energy_level') or llm_consensus.get('energyLevel', 'Medium')

        # Base metadata from LLM
        metadata = {
            # ── Sonic classification (LLM) ──────────────────────────────────
            "mainGenre":      llm_consensus.get('mainGenre', 'Unknown'),
            "additionalGenres": llm_consensus.get('additionalGenres', []),
            "moods":          llm_consensus.get('moods', []),
            "mainInstrument": llm_consensus.get('mainInstrument', 'Various'),
            "instrumentation": llm_consensus.get('instrumentation', []),
            "keywords":       llm_consensus.get('keywords', []),
            "useCases":       llm_consensus.get('useCases', []),
            "trackDescription": llm_consensus.get('trackDescription', ''),
            "vocalStyle":     llm_consensus.get('vocalStyle', {}),
            # ── Extended AI fields ──────────────────────────────────────────
            "energy_level":      energy_str,
            "energyLevel":       energy_str,
            "mood_vibe":         llm_consensus.get('mood_vibe', ''),
            "musicalEra":        llm_consensus.get('musicalEra', ''),
            "productionQuality": llm_consensus.get('productionQuality', ''),
            "dynamics":          llm_consensus.get('dynamics', ''),
            "targetAudience":    llm_consensus.get('targetAudience', ''),
            "tempoCharacter":    tempo_char or llm_consensus.get('tempoCharacter', ''),
            "hasVocals":         audio_features.get('pitch', {}).get('is_vocal', audio_features.get('energy', {}).get('vocal_presence', 0) > 0.04),
            "language":          llm_consensus.get('language') or lyrics_analysis.get('insights', {}).get('language', 'Instrumental'),

            "analysisReasoning": llm_consensus.get('analysisReasoning') or llm_consensus.get('reasoning', ''),
            "similar_artists":   llm_consensus.get('similar_artists', []),
            # ── Technical (DSP authoritative) ──────────────────────────────
            "bpm":      bpm_val,
            "key":      key_val,
            "mode":     mode_val,
            "sha256":   audio_features.get('meta', {}).get('sha256', ''),
            "HardBand Records Authenticity DNA": audio_features.get('meta', {}).get('sha256', ''),
            "structure": audio_features.get('structure', []),
            "duration":  audio_features.get('meta', {}).get('duration', 0),
        }


        if not metadata.get("analysisReasoning"):
            r = audio_features.get("rhythm", {})
            h = audio_features.get("harmonic", {})
            s = audio_features.get("spectral", {})
            e = audio_features.get("energy", {})
            st = audio_features.get("structure", {})
            tempo = r.get("tempo")
            rhythm_complexity = st.get("rhythm_complexity") or r.get("rhythm_complexity")
            segs = st.get("segment_count") or st.get("segments") or 0
            centroid = s.get("centroid_mean") or s.get("centroid")
            rolloff = s.get("rolloff_mean") or s.get("rolloff")
            flatness = s.get("flatness_mean") or s.get("flatness")
            hp = h.get("harmonic_percussive_ratio")
            dr = e.get("dynamic_range")
            rms = e.get("rms_mean") or e.get("rms")
            parts = []
            if tempo:
                parts.append(f"Tempo {round(float(tempo),2)} BPM ({metadata.get('tempoCharacter','')}).")
            if metadata.get("key") and metadata.get("mode"):
                parts.append(f"Tonacja {metadata['key']} {metadata['mode']}.")
            if centroid:
                parts.append(f"Spektralnie centroid ~{int(centroid)} Hz.")
            if rolloff:
                parts.append(f"Rolloff ~{int(rolloff)} Hz.")
            if flatness is not None:
                parts.append(f"Spłaszczenie {round(float(flatness),3)}.")
            if hp is not None:
                parts.append(f"Stosunek harmoniczno-perkusyjny {round(float(hp),2)}.")
            if dr is not None:
                parts.append(f"Zakres dynamiczny {round(float(dr),3)}.")
            if rms is not None:
                parts.append(f"Średni RMS {round(float(rms),3)}.")
            if segs:
                parts.append(f"Segmentacja {int(segs)} części.")
            if rhythm_complexity:
                parts.append(f"Złożoność rytmiczna {str(rhythm_complexity)}.")
            desc = " ".join([p for p in parts if p])
            metadata["analysisReasoning"] = desc.strip()

        # Merge lyrics if present
        if lyrics_analysis.get('has_lyrics'):
            # Enhance moods from lyrics
            lyric_moods = lyrics_analysis.get('insights', {}).get('mood_from_lyrics', [])
            if lyric_moods:
                metadata["moods"] = sorted(list(set(metadata["moods"] + lyric_moods)))[:6]
            
            # Enhance keywords/themes
            themes = lyrics_analysis.get('insights', {}).get('themes', [])
            if themes:
                metadata["keywords"] = sorted(list(set(metadata["keywords"] + themes)))[:15]

        # Add tech meta for logs
        metadata["_tech_meta"] = {
            "confidence": llm_consensus.get('confidence', 0.75),
            "similar_artists": llm_consensus.get('similar_artists', []),
            "analysis_layers": 3 if lyrics_analysis.get('has_lyrics') else 2,
            "llm_sources": llm_consensus.get('meta', {}).get('sources', [])
        }
        
        return metadata
