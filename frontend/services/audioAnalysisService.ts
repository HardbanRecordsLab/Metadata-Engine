
// @ts-nocheck
// Essentia types are not available in this environment.

import type { StructureSegment } from '../types';

export interface AudioFeatures {
    bpm: number;
    key: string;
    mode: string;
    duration: number;
    method: 'Essentia (Advanced)' | 'Native DSP (Engineering)' | 'AI Estimate';
    loudnessDb?: number;
    energy?: number | string;
    brightness?: string;
    truePeak?: number;
    stereo?: {
        width: number;
        correlation: number;
    };
    balance?: {
        low: number;
        mid: number;
        high: number;
        character: string;
    };
    structure?: StructureSegment[];
}

let essentiaInstance: any = null;

// Helper to load audio context and decode file
export const decodeAudio = async (file: File): Promise<AudioBuffer> => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    try {
        const arrayBuffer = await file.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    } catch (e: any) {
        if (e.name === 'NotReadableError' || e.message?.includes('NotReadableError')) {
            throw new Error("NotReadableError: The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.");
        }
        throw e;
    } finally {
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
};

// --- WORKER HANDLER ---
const runWorkerAnalysis = (audioBuffer: AudioBuffer): Promise<any> => {
    return new Promise((resolve, reject) => {
        // Create worker
        const worker = new Worker(new URL('./dsp.worker.ts', import.meta.url), { type: 'module' });

        const leftChannel = audioBuffer.getChannelData(0);
        // We copy the data to avoid "Detached ArrayBuffer" errors if we were to use transferables incorrectly
        // without keeping a backup for Essentia.
        // For absolute safety in this hybrid architecture, we clone by default logic of postMessage
        // or just send the view. Modern browsers handle this copy very fast (<50ms for songs).
        const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

        worker.postMessage({
            leftChannel,
            rightChannel,
            sampleRate: audioBuffer.sampleRate
        });

        worker.onmessage = (e) => {
            if (e.data.type === 'success') {
                resolve(e.data.result);
            } else {
                reject(e.data.error);
            }
            worker.terminate();
        };

        worker.onerror = (e) => {
            reject(e);
            worker.terminate();
        };
    });
};

// --- ESSENTIA INITIALIZATION ---
export const initEssentia = async () => {
    if (essentiaInstance) return essentiaInstance;
    // @ts-ignore
    if (typeof EssentiaWASM === 'undefined') return null;

    try {
        // @ts-ignore
        let wasmModule = EssentiaWASM;
        if (typeof wasmModule === 'function') wasmModule = await EssentiaWASM();
        if (!wasmModule.EssentiaJS) return null;
        // @ts-ignore
        essentiaInstance = new Essentia(wasmModule);
        return essentiaInstance;
    } catch (e) {
        console.warn("Essentia WASM failed to load", e);
        return null;
    }
};

// --- MAIN ANALYSIS FUNCTION ---

export const analyzeAudioFeatures = async (file: File): Promise<AudioFeatures | null> => {
    let audioBuffer: AudioBuffer;
    try {
        audioBuffer = await decodeAudio(file);
    } catch (e) {
        console.error("Audio decoding failed", e);
        // Propagate known errors up
        if (e.message && e.message.includes("NotReadableError")) throw e;
        return null;
    }

    // 1. Offload heavy DSP math to Web Worker
    let nativeData;
    try {
        nativeData = await runWorkerAnalysis(audioBuffer);
    } catch (e) {
        console.warn("Worker DSP failed:", e);
        // Fallback or return null would happen here, but we continue to try Essentia if worker fails logic
        // But usually if worker fails, data is bad.
        // Let's create safe defaults if worker crashes so app doesn't freeze
        nativeData = { bpm: 0, loudnessDb: -20, brightness: 'Unknown', truePeak: 0, stereo: { width: 0, correlation: 0 }, balance: { low: 33, mid: 33, high: 33, character: 'Flat' } };
    }

    const { bpm: nativeBpm } = nativeData;

    // 2. Attempt Essentia for complex tasks (Key, detailed BPM) on main thread
    try {
        const essentia = await initEssentia();
        if (essentia) {
            // Safe to access getChannelData here because we didn't transfer ownership in worker call
            const channelData = audioBuffer.getChannelData(0);

            // OPTIMIZATION: Limit to 60s to prevent WASM OOM on large files
            const MAX_DURATION = 60;
            const maxSamples = MAX_DURATION * audioBuffer.sampleRate;
            let dataToProcess = channelData;

            // If track is longer than 2 mins, take the middle 60s for better representation
            if (audioBuffer.duration > 120) {
                const startSample = Math.floor((audioBuffer.length / 2) - (maxSamples / 2));
                dataToProcess = channelData.slice(startSample, startSample + maxSamples);
            } else if (channelData.length > maxSamples) {
                dataToProcess = channelData.slice(0, maxSamples);
            }

            const audioVector = essentia.arrayToVector(dataToProcess);

            const keyData = essentia.KeyExtractor(audioVector);
            const rhythm = essentia.RhythmExtractor2013(audioVector);

            // CRITICAL: Free WASM memory
            audioVector.delete();

            return {
                bpm: Math.round(rhythm.bpm * 10) / 10,
                key: keyData.key,
                mode: keyData.scale,
                duration: Math.round(audioBuffer.duration * 100) / 100,
                method: 'Essentia (Advanced)',
                loudnessDb: nativeData.loudnessDb,
                brightness: nativeData.brightness,
                truePeak: nativeData.truePeak,
                stereo: nativeData.stereo,
                balance: nativeData.balance
            };
        }
    } catch (e) {
        console.warn("Essentia analysis failed (WASM/Memory):", e);
    }

    // Fallback to Native DSP (Worker Result)
    return {
        bpm: nativeBpm,
        key: undefined,
        mode: '',
        duration: Math.round(audioBuffer.duration * 100) / 100,
        method: 'Native DSP (Engineering)',
        loudnessDb: nativeData.loudnessDb,
        brightness: nativeData.brightness,
        truePeak: nativeData.truePeak,
        stereo: nativeData.stereo,
        balance: nativeData.balance
    };
};
