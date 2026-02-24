import { Metadata } from '../types';
import { analyzeAudioFeatures, AudioFeatures } from './audioAnalysisService';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getFullUrl, getWsUrl } from '../apiConfig';

const UPLOAD_SIZE_LIMIT = 3.5 * 1024 * 1024;

const wait = (ms: number) => {
    if ((import.meta as any).env?.MODE === 'test') return Promise.resolve();
    return new Promise<void>(resolve => setTimeout(resolve, ms));
};

/**
 * Merge AI-returned data with DSP audio features.
 * Priority: explicit AI value > DSP value > default.
 */
const mergeWithDSP = (data: any, dspFeatures: AudioFeatures | null, fileName: string, hash?: string): Metadata => {
    const dspEnergy = typeof dspFeatures?.energy === 'string' ? dspFeatures.energy : '';
    const energyLevel = data.energyLevel || data.energy_level || dspEnergy || 'Medium';

    return {
        // ── Identity ─────────────────────────────────────────────────────────
        sha256:       hash,
        title:        data.title || fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        artist:       data.artist || 'Unknown Artist',
        album:        data.album || 'Single',
        albumArtist:  data.albumArtist || data.artist || 'Unknown Artist',
        year:         data.year || new Date().getFullYear().toString(),
        track:        data.track || 1,
        duration:     data.duration || dspFeatures?.duration || 0,
        coverArt:     data.coverArt || undefined,

        // ── Sonic / Technical ─────────────────────────────────────────────────
        mainInstrument: data.mainInstrument || 'Various',
        bpm:  data.bpm  || dspFeatures?.bpm  || 0,
        key:  data.key  || dspFeatures?.key  || 'C',
        mode: data.mode || dspFeatures?.mode || 'Major',

        // ── Classification ────────────────────────────────────────────────────
        mainGenre:        data.mainGenre || 'Electronic',
        additionalGenres: Array.isArray(data.additionalGenres) ? data.additionalGenres : [],
        moods:            Array.isArray(data.moods) ? data.moods : ['Sonic'],
        instrumentation:  Array.isArray(data.instrumentation) ? data.instrumentation : [],
        keywords:         Array.isArray(data.keywords) ? data.keywords : [],
        useCases:         Array.isArray(data.useCases) ? data.useCases : [],
        trackDescription: data.trackDescription || '',
        language:         data.language || 'Instrumental',
        vocalStyle:       (typeof data.vocalStyle === 'object' && data.vocalStyle !== null)
                              ? data.vocalStyle
                              : { gender: 'none', timbre: 'none', delivery: 'none', emotionalTone: 'none' },
        structure:        (data.structure && data.structure.length > 0)
                              ? data.structure
                              : (dspFeatures?.structure || []),

        // ── Credits & Legal ───────────────────────────────────────────────────
        copyright:     data.copyright || `© ${new Date().getFullYear()}`,
        pLine:         data.pLine || '',
        publisher:     data.publisher || 'Independent',
        composer:      data.composer || '',
        lyricist:      data.lyricist || '',
        producer:      data.producer || '',
        catalogNumber: data.catalogNumber || '',
        isrc:          data.isrc || '',
        iswc:          data.iswc || '',
        upc:           data.upc || '',
        license:       data.license || '',

        // ── Extended AI-generated fields (all synced with backend schema) ─────
        energy_level:      energyLevel,
        energyLevel:       energyLevel,
        mood_vibe:         data.mood_vibe || '',
        musicalEra:        data.musicalEra || '',
        productionQuality: data.productionQuality || '',
        dynamics:          data.dynamics || '',
        targetAudience:    data.targetAudience || '',
        tempoCharacter:    data.tempoCharacter || dspFeatures?.tempoCharacter || '',
        analysisReasoning: data.analysisReasoning || '',
        similar_artists:   Array.isArray(data.similar_artists) ? data.similar_artists : [],

        // ── DSP-derived fields (from frontend audioAnalysisService) ───────────
        dynamicRange:     dspFeatures?.dynamicRange,
        spectralCentroid: dspFeatures?.spectralCentroid,
        spectralRolloff:  dspFeatures?.spectralRolloff,

        // ── Validation ────────────────────────────────────────────────────────
        validation_report: data.validation_report || {},
    };
};

export const generateMetadata = async (
    inputType: 'file' | 'idea',
    isProMode: boolean,
    file: File | null,
    link: string,
    description: string,
    existingMetadata?: Partial<Metadata>,
    modelPreference: 'flash' | 'pro' = 'flash',
    jobId?: string,
    onJobCreated?: (jobId: string) => void,
    onProgressUpdate?: (message: string) => void,
    isFresh: boolean = false
): Promise<{ metadata: Metadata; audioFeatures: AudioFeatures | null }> => {
    let dspFeatures: AudioFeatures | null = null;
    let fileHash: string | undefined = undefined;

    if (inputType === 'file' && file) {
        // Pre-calculate hash before browser loses file access
        try {
            const { calculateFileHash } = await import('./copyrightService');
            fileHash = await calculateFileHash(file);
            console.log('[geminiService] Pre-calculated file hash:', fileHash);
        } catch (e) {
            console.warn('[geminiService] Pre-hashing failed:', e);
        }

        // Run DSP analysis client-side (for immediate UI feedback and enriched prompts)
        try {
            dspFeatures = await analyzeAudioFeatures(file);
            console.log('[geminiService] DSP features:', dspFeatures);
        } catch (e) {
            console.warn('[geminiService] DSP failed:', e);
        }

        // Submit backend analysis job
        try {
            let activeJobId = jobId;

            if (!activeJobId) {
                console.log('[geminiService] Submitting analysis job to backend...');
                const formData = new FormData();
                formData.append('file', file);
                formData.append('is_pro_mode', String(isProMode));
                formData.append('transcribe', 'true');
                formData.append('is_fresh', String(isFresh));
                formData.append('model_preference', modelPreference);

                const response = await fetchWithRetry(getFullUrl('/analysis/generate'), {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Job submission failed: ${errorText}`);
                }

                const data = await response.json();
                activeJobId = data.job_id;
                console.log(`[geminiService] Job created: ${activeJobId}`);
                if (onJobCreated) onJobCreated(activeJobId);
            } else {
                console.log(`[geminiService] Re-attaching to Job: ${activeJobId}`);
            }

            // WebSocket for real-time progress
            const ws = new WebSocket(getWsUrl(`/analysis/ws/${activeJobId}`));
            ws.onmessage = (event) => {
                try {
                    const d = JSON.parse(event.data);
                    if (d.message && onProgressUpdate) onProgressUpdate(d.message);
                } catch (e) {
                    console.error('[geminiService] WS message error', e);
                }
            };
            ws.onerror = (err) => console.warn('[geminiService] WS failed, falling back to polling:', err);

            // Polling fallback
            let pollCount = 0;
            const maxPolls = 120; // 10 minutes
            let finalMetadata: Metadata | null = null;

            try {
                while (pollCount < maxPolls) {
                    await wait(5000);
                    pollCount++;

                    const pollResponse = await fetchWithRetry(getFullUrl(`/analysis/job/${activeJobId}`));
                    if (!pollResponse.ok) continue;

                    const job = await pollResponse.json();
                    console.log(`[geminiService] Job ${activeJobId} status: ${job.status}`);

                    if (job.message && onProgressUpdate) onProgressUpdate(job.message);

                    if (job.status === 'completed' && job.result) {
                        const aiData = job.result;

                        // Merge backend DSP values into dspFeatures for consistency
                        if (aiData.bpm || aiData.key) {
                            dspFeatures = {
                                ...dspFeatures,
                                bpm:  aiData.bpm  ?? dspFeatures?.bpm,
                                key:  aiData.key  ?? dspFeatures?.key,
                                mode: aiData.mode ?? dspFeatures?.mode,
                            } as AudioFeatures;
                        }

                        finalMetadata = mergeWithDSP(aiData, dspFeatures, file.name, aiData.sha256 || fileHash);
                        break;
                    }

                    if (job.status === 'error') {
                        throw new Error(`Backend analysis error: ${job.error}`);
                    }
                }

                if (!finalMetadata) {
                    throw new Error('Analysis timed out — no result received from backend.');
                }

                return { metadata: finalMetadata, audioFeatures: dspFeatures };

            } finally {
                if (ws.readyState === WebSocket.OPEN) ws.close();
            }

        } catch (e) {
            console.error('[geminiService] Backend connection error:', e);
            throw e;
        }
    }

    throw new Error('Only file input is supported in this mode.');
};


export const refineMetadataField = async (
    currentMetadata: Metadata,
    field: keyof Metadata,
    instruction: string
): Promise<Partial<Metadata>> => {
    try {
        const { callAIProxy } = await import('./aiProxyService');
        return await callAIProxy('groq_refine', {
            current_metadata: currentMetadata,
            field_to_refine: field,
            refinement_instruction: instruction,
        });
    } catch (e) {
        console.error('[geminiService] Refine field error:', e);
        return {};
    }
};
