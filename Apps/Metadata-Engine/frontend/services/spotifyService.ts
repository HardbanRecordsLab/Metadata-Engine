
import { SpotifyAudioFeatures, SpotifyTrack } from '../types';

// Use backend proxy for Spotify instead of direct frontend calls to protect secrets
const callSpotifyProxy = async (payload: any): Promise<any> => {
    const { callAIProxy } = await import('./aiProxyService');
    return await callAIProxy('spotify', payload);
};

/**
 * Searches for a track on Spotify via proxy.
 */
export const searchSpotifyTrack = async (query: string): Promise<SpotifyTrack | null> => {
    try {
        const data = await callSpotifyProxy({ type: 'search', query });
        return data.tracks?.items?.[0] || null;
    } catch (error) {
        console.error("Spotify Proxy Search Error", error);
        return null;
    }
};

/**
 * Fetches Audio Features via proxy.
 */
export const getSpotifyAudioFeatures = async (trackId: string): Promise<SpotifyAudioFeatures | null> => {
    try {
        return await callSpotifyProxy({ type: 'features', trackId });
    } catch (error) {
        console.error("Spotify Proxy Features Error", error);
        return null;
    }
};

/**
 * Helper to map Spotify Key integer to Pitch Class notation
 */
export const mapSpotifyKey = (key: number, mode: number): string => {
    const pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    if (key < 0 || key > 11) return 'Unknown';
    const pitch = pitches[key];
    const scale = mode === 1 ? 'Major' : 'Minor';
    return `${pitch} ${scale}`;
};
