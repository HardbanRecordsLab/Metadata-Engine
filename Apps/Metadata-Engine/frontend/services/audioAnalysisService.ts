// @ts-nocheck
import type { StructureSegment } from '../types';

export interface AudioFeatures {
    bpm: number;
    key: string;
    mode: string;
    duration: number;
    method: 'Essentia (Advanced)' | 'Native DSP (Engineering)' | 'AI Estimate';
    loudnessDb?: number;       // LUFS-approx
    energy?: number | string;  // Classified energy level string
    brightness?: string;
    truePeak?: number;
    dynamicRange?: number;     // NEW: LRA-like dynamic range in dB
    spectralCentroid?: number; // NEW: Hz
    spectralRolloff?: number;  // NEW: Hz
    tempoCharacter?: string;   // NEW: Descriptive tempo
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

export const decodeAudio = async (file: File): Promise<AudioBuffer> => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    try {
        const arrayBuffer = await file.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    } catch (e: any) {
        if (e.name === 'NotReadableError' || e.message?.includes('NotReadableError')) {
            throw new Error('NotReadableError: The requested file could not be read.');
        }
        throw e;
    } finally {
        if (audioContext.state !== 'closed') await audioContext.close();
    }
};

const runWorkerAnalysis = (audioBuffer: AudioBuffer): Promise<any> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./dsp.worker.ts', import.meta.url), { type: 'module' });
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

        worker.postMessage({ leftChannel, rightChannel, sampleRate: audioBuffer.sampleRate });

        worker.onmessage = (e) => {
            if (e.data.type === 'success') resolve(e.data.result);
            else reject(new Error(e.data.error));
            worker.terminate();
        };
        worker.onerror = (e) => { reject(e); worker.terminate(); };
    });
};

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
        console.warn('Essentia WASM failed to load', e);
        return null;
    }
};

export const analyzeAudioFeatures = async (file: File): Promise<AudioFeatures | null> => {
    let audioBuffer: AudioBuffer;
    try {
        audioBuffer = await decodeAudio(file);
    } catch (e: any) {
        console.error('Audio decoding failed', e);
        if (e.message?.includes('NotReadableError')) throw e;
        return null;
    }

    // Run Worker DSP
    let nativeData: any = {};
    try {
        nativeData = await runWorkerAnalysis(audioBuffer);
    } catch (e) {
        console.warn('Worker DSP failed:', e);
        nativeData = {
            bpm: 0, loudnessDb: -20, brightness: 'Unknown', truePeak: 0,
            dynamicRange: 0, spectralCentroid: 1000, spectralRolloff: 4000,
            stereo: { width: 0, correlation: 0 },
            balance: { low: 33, mid: 33, high: 33, character: 'Flat' },
            energy: 'Unknown', tempoCharacter: 'Unknown',
        };
    }

    // Attempt Essentia for key + BPM refinement
    try {
        const essentia = await initEssentia();
        if (essentia) {
            const channelData = audioBuffer.getChannelData(0);
            const MAX_DURATION = 60;
            const maxSamples = MAX_DURATION * audioBuffer.sampleRate;
            let dataToProcess = channelData;

            if (audioBuffer.duration > 120) {
                const startSample = Math.floor(audioBuffer.length / 2 - maxSamples / 2);
                dataToProcess = channelData.slice(startSample, startSample + maxSamples);
            } else if (channelData.length > maxSamples) {
                dataToProcess = channelData.slice(0, maxSamples);
            }

            const audioVector = essentia.arrayToVector(dataToProcess);
            const keyData = essentia.KeyExtractor(audioVector);
            const rhythm = essentia.RhythmExtractor2013(audioVector);
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
                dynamicRange: nativeData.dynamicRange,
                spectralCentroid: nativeData.spectralCentroid,
                spectralRolloff: nativeData.spectralRolloff,
                stereo: nativeData.stereo,
                balance: nativeData.balance,
                energy: nativeData.energy,
                tempoCharacter: nativeData.tempoCharacter,
            };
        }
    } catch (e) {
        console.warn('Essentia analysis failed:', e);
    }

    // Fallback: Native DSP only
    return {
        bpm: nativeData.bpm,
        key: undefined,
        mode: '',
        duration: Math.round(audioBuffer.duration * 100) / 100,
        method: 'Native DSP (Engineering)',
        loudnessDb: nativeData.loudnessDb,
        brightness: nativeData.brightness,
        truePeak: nativeData.truePeak,
        dynamicRange: nativeData.dynamicRange,
        spectralCentroid: nativeData.spectralCentroid,
        spectralRolloff: nativeData.spectralRolloff,
        stereo: nativeData.stereo,
        balance: nativeData.balance,
        energy: nativeData.energy,
        tempoCharacter: nativeData.tempoCharacter,
    };
};
