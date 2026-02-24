
import { Metadata } from '../types';
import { AudioFeatures } from './audioAnalysisService';

// --- TYPES ---

export interface TrainingExample {
    id: string;
    timestamp: number;
    features: {
        bpm: number;
        loudness: number; // dB
        energyScore: number; // 0-1 mapped from energyLevel
        duration: number;
    };
    labels: {
        mainGenre: string;
        moods: string[];
        keywords: string[];
    };
}

const STORAGE_KEY = 'mme_user_model_v1';

// --- HELPERS ---

const mapEnergyToScore = (level?: string): number => {
    const normalized = (level || '').toLowerCase();
    if (!normalized) return 0.5;
    if (normalized.includes('very') && normalized.includes('high')) return 1.0;
    if (normalized.includes('high')) return 0.8;
    if (normalized.includes('low')) return 0.2;
    if (normalized.includes('medium')) return 0.5;
    return 0.5;
};

const calculateDistance = (a: TrainingExample['features'], b: TrainingExample['features']): number => {
    // Weighted Euclidean Distance
    // BPM is critical (weight 2.0), Loudness matters (1.0), Duration less (0.5)
    
    const dBPM = (a.bpm - b.bpm) / 150; // Normalize approx
    const dLoud = (a.loudness - b.loudness) / 60; // Normalize dB range
    const dEnergy = a.energyScore - b.energyScore;
    
    return Math.sqrt(
        (dBPM * 2.0) ** 2 +
        (dLoud * 1.0) ** 2 +
        (dEnergy * 1.5) ** 2
    );
};

// --- PUBLIC API ---

export const getTrainingData = (): TrainingExample[] => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
};

export const trainModel = (metadata: Metadata, dspFeatures: AudioFeatures | null) => {
    if (!metadata.mainGenre || !dspFeatures) return; // Need minimal data

    const example: TrainingExample = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        features: {
            bpm: dspFeatures.bpm,
            loudness: dspFeatures.loudnessDb ?? 0,
            energyScore: mapEnergyToScore(metadata.energy_level || metadata.energyLevel),
            duration: dspFeatures.duration
        },
        labels: {
            mainGenre: metadata.mainGenre,
            moods: metadata.moods || [],
            keywords: metadata.keywords || []
        }
    };

    const currentData = getTrainingData();
    // Limit dataset to last 100 tracks to keep it fast and relevant (Sliding Window)
    const updatedData = [example, ...currentData].slice(0, 100);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    console.log("Neural Engine: Learned new track pattern", example);
};

export const predictFromModel = (dspFeatures: AudioFeatures): string | null => {
    const dataset = getTrainingData();
    if (dataset.length < 3) return null; // Need at least 3 examples to start predicting

    const targetFeatures = {
        bpm: dspFeatures.bpm,
        loudness: dspFeatures.loudnessDb ?? 0,
        energyScore: 0.5, // We might not have this yet, assume mid
        duration: dspFeatures.duration
    };

    // Find 3 Nearest Neighbors (k=3)
    const neighbors = dataset
        .map(ex => ({ ...ex, distance: calculateDistance(targetFeatures, ex.features) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

    if (neighbors.length === 0) return null;

    // Simple Voting for Genre
    const votes: Record<string, number> = {};
    neighbors.forEach(n => {
        votes[n.labels.mainGenre] = (votes[n.labels.mainGenre] || 0) + (1 / (n.distance + 0.1)); // Weight by proximity
    });

    const predictedGenre = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
    
    return `Based on your previous tracks, this sounds like **${predictedGenre}**. Similar patterns found in your library.`;
};
