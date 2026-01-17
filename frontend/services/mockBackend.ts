
import { User, UserTier, CloudFile, AnalysisRecord } from '../types';

// --- MOCK DATABASE ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- AUTH SERVICE ---
export const mockAuth = {
    login: async (email: string, password: string): Promise<User> => {
        await delay(800);
        if (email.includes('error')) throw new Error('Invalid credentials');
        
        return {
            id: 'user_123',
            email,
            name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
            tier: 'starter',
            createdAt: Date.now(),
            avatarUrl: undefined,
            credits: 0 // Added credits to satisfy User interface
        };
    },

    register: async (email: string, name: string): Promise<User> => {
        await delay(1000);
        return {
            id: 'user_new_' + Date.now(),
            email,
            name,
            tier: 'starter',
            createdAt: Date.now(),
            credits: 0 // Added credits to satisfy User interface
        };
    },

    upgradeTier: async (userId: string, tier: UserTier): Promise<boolean> => {
        await delay(1500); // Simulate Stripe processing
        return true;
    }
};

// --- CLOUD STORAGE SERVICE ---
export const mockCloud = {
    listFiles: async (provider: 'google' | 'dropbox'): Promise<CloudFile[]> => {
        await delay(1200);
        
        if (provider === 'google') {
            return [
                { id: 'gd_1', name: 'Summer_Vibes_Demo.mp3', size: '4.2 MB', type: 'audio/mpeg', modified: '2025-07-20' },
                { id: 'gd_2', name: 'Techno_Beat_v4_FINAL.wav', size: '42.1 MB', type: 'audio/wav', modified: '2025-07-22' },
                { id: 'gd_3', name: 'Podcast_Intro.mp3', size: '1.8 MB', type: 'audio/mpeg', modified: '2025-07-10' },
            ];
        } else {
            return [
                { id: 'db_1', name: 'Vocals_Dry.wav', size: '28 MB', type: 'audio/wav', modified: '2025-07-21' },
                { id: 'db_2', name: 'Master_Track_01.flac', size: '35 MB', type: 'audio/flac', modified: '2025-06-15' },
            ];
        }
    },

    downloadFile: async (fileId: string): Promise<File> => {
        await delay(800);
        // We create a dummy file since we can't actually download from mock cloud
        return new File(["(Mock audio content)"], `Cloud_Import_${fileId}.mp3`, { type: 'audio/mpeg' });
    },

    // --- HISTORY SYNC ---
    fetchHistory: async (userId: string): Promise<AnalysisRecord[]> => {
        await delay(600);
        const stored = localStorage.getItem(`mme_history_${userId}`);
        return stored ? JSON.parse(stored) : [];
    },

    saveHistory: async (userId: string, history: AnalysisRecord[]): Promise<boolean> => {
        // In a real app, this would be a POST request
        // Here we use localStorage to persist "server-side" data per user
        localStorage.setItem(`mme_history_${userId}`, JSON.stringify(history));
        return true;
    }
};
