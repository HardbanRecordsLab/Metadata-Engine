import { Metadata } from '../types';
import { analyzeAudioFeatures, AudioFeatures } from './audioAnalysisService';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getFullUrl, getWsUrl } from '../apiConfig';

const UPLOAD_SIZE_LIMIT = 3.5 * 1024 * 1024;

const wait = (ms: number) => {
    if ((import.meta as any).env?.MODE === 'test') return Promise.resolve();
    return new Promise<void>(resolve => setTimeout(resolve, ms));
};

const mergeWithDSP = (data: any, dspFeatures: AudioFeatures | null, fileName: string, hash?: string): Metadata => {
    return {
        sha256: hash,
        title: data.title || fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        artist: data.artist || "Unknown Artist",
        album: data.album || "Single",
        albumArtist: data.albumArtist || data.artist || "Unknown Artist",
        year: data.year || new Date().getFullYear().toString(),
        track: 1,
        mainGenre: data.mainGenre || "Electronic",
        additionalGenres: data.additionalGenres?.length ? data.additionalGenres : [],
        moods: data.moods?.length ? data.moods : ["Sonic"],
        instrumentation: data.instrumentation?.length ? data.instrumentation : [],
        mainInstrument: data.mainInstrument || "Various",
        trackDescription: data.trackDescription || "",
        keywords: data.keywords?.length ? data.keywords : [],
        bpm: dspFeatures?.bpm || data.bpm || 0,
        key: dspFeatures?.key || data.key || "C",
        mode: dspFeatures?.mode || data.mode || "Major",
        copyright: data.copyright || `© ${new Date().getFullYear()}`,
        publisher: data.publisher || "Independent",
        composer: data.composer || "",
        lyricist: data.lyricist || "",
        catalogNumber: data.catalogNumber || "",
        isrc: data.isrc || "",
        useCases: data.useCases?.length ? data.useCases : [],
        language: data.language || "Instrumental",
        vocalStyle: (typeof data.vocalStyle === 'object' && data.vocalStyle !== null) ? data.vocalStyle : { gender: 'none', timbre: 'none', delivery: 'none', emotionalTone: 'none' },
        structure: data.structure || dspFeatures?.structure || [],
        duration: data.duration || dspFeatures?.duration || 0,
        coverArt: data.coverArt || undefined
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
): Promise<Metadata> => {
    let dspFeatures: AudioFeatures | null = null;
    let fileHash: string | undefined = undefined;

    if (inputType === 'file' && file) {
        // PERMANENT FIX: Calculate hash immediately before browser loses access
        try {
            const { calculateFileHash } = await import('./copyrightService');
            fileHash = await calculateFileHash(file);
            console.log("Pre-calculated file hash:", fileHash);
        } catch (e) {
            console.warn("Pre-hashing failed:", e);
        }

        try { dspFeatures = await analyzeAudioFeatures(file); } catch (e) { console.warn("DSP failed", e); }

        // SUBMIT JOB or RE-ATTACH: Backend Groq Pipeline
        try {
            let activeJobId = jobId;

            if (!activeJobId) {
                console.log("Submitting analysis job to Backend...");
                const formData = new FormData();
                formData.append('file', file);
                formData.append('is_pro_mode', String(isProMode));
                formData.append('transcribe', 'true');
                formData.append('is_fresh', String(isFresh));
                formData.append('model_preference', modelPreference);

                const response = await fetchWithRetry(getFullUrl('/analysis/generate'), {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Job submission failed: ${errorText}`);
                }

                const data = await response.json();
                activeJobId = data.job_id;
                console.log(`Job created: ${activeJobId}. Starting poll...`);
                if (onJobCreated) onJobCreated(activeJobId);
            } else {
                console.log(`Re-attaching to Job: ${activeJobId}`);
            }

            // REAL-TIME PROGRESS VIA WEBSOCKET
            const ws = new WebSocket(getWsUrl(`/analysis/ws/${activeJobId}`));

            let isCompleted = false;
            let finalMetadata: Metadata | null = null;

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.message && onProgressUpdate) {
                        onProgressUpdate(data.message);
                    }
                    if (data.status === 'completed' || data.status === 'error') {
                        isCompleted = true; // Signal the loop to exit or check results
                    }
                } catch (e) {
                    console.error("WS Message error", e);
                }
            };

            ws.onerror = (err) => console.warn("WebSocket progress failed, fallback to polling:", err);

            // POLL FOR RESULTS (Now as a fallback/sync mechanism)
            let pollCount = 0;
            const maxPolls = 120; // 10 minutes with 5s interval

            try {
                while (pollCount < maxPolls) {
                    await wait(5000);
                    pollCount++;

                    const pollResponse = await fetchWithRetry(getFullUrl(`/analysis/job/${activeJobId}`));
                    if (!pollResponse.ok) continue;

                    const job = await pollResponse.json();
                    console.log(`Job ${activeJobId} status: ${job.status}`);

                    if (job.message && !isCompleted && onProgressUpdate) {
                        onProgressUpdate(job.message);
                    }

                    if (job.status === 'completed') {
                        const aiData = job.result;
                        if (aiData.bpm) {
                            // @ts-ignore
                            dspFeatures = { ...dspFeatures, bpm: aiData.bpm, key: aiData.key, mode: aiData.mode };
                        }
                        finalMetadata = mergeWithDSP(aiData, dspFeatures, file.name, fileHash);
                        break;
                    }

                    if (job.status === 'error') {
                        throw new Error(`Analysis background error: ${job.error}`);
                    }
                }

                if (!finalMetadata) {
                    throw new Error("Analysis timed out. Try again or check server logs.");
                }

                return finalMetadata;

            } finally {
                if (ws.readyState === WebSocket.OPEN) ws.close();
            }

        } catch (e) {
            console.error("Backend connection error:", e);
            throw e;
        }
    }

    throw new Error("Only file input is supported in this mode.");
};


export const refineMetadataField = async (currentMetadata: Metadata, field: keyof Metadata, instruction: string) => {
    try {
        const { callAIProxy } = await import('./aiProxyService');
        return await callAIProxy('groq_refine', {
            current_metadata: currentMetadata,
            field_to_refine: field,
            refinement_instruction: instruction
        });
    } catch (e) {
        console.error("Refine field error:", e);
        return {};
    }
};
