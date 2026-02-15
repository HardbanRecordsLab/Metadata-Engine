import { LastFmArtist } from '../types';
import { getFullUrl } from '../apiConfig';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isJsonResponse = (res: Response) => {
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json');
};

export const getLastFmArtistInfo = async (artist: string, retries = 3): Promise<LastFmArtist | null> => {
    if (!artist) return null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(getFullUrl(`/proxy/lastfm/artist?artist=${encodeURIComponent(artist)}`));
            if (!response.ok || !isJsonResponse(response)) {
                if (attempt < retries - 1) {
                    await delay(1000 * (attempt + 1));
                    continue;
                }
                return null;
            }
            const data = await response.json();
            if (data?.error) return null;
            return data.artist ?? null;
        } catch {
            if (attempt < retries - 1) {
                await delay(1000 * (attempt + 1));
                continue;
            }
            return null;
        }
    }
    return null;
};

export const extractTagsFromLastFm = (artistData: any): string[] => {
    if (!artistData?.tags?.tag) return [];
    return artistData.tags.tag.map((t: any) => t.name);
};

export const getLastFmTrackInfo = async (artist: string, title: string, retries = 3): Promise<any | null> => {
    if (!artist || !title) return null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(getFullUrl(`/proxy/lastfm/track?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}`));
            if (!response.ok || !isJsonResponse(response)) {
                if (attempt < retries - 1) {
                    await delay(1000 * (attempt + 1));
                    continue;
                }
                return null;
            }
            return await response.json();
        } catch {
            if (attempt < retries - 1) {
                await delay(1000 * (attempt + 1));
                continue;
            }
            return null;
        }
    }
    return null;
};

export const getLastFmSimilarArtists = async (artist: string, retries = 3): Promise<any | null> => {
    if (!artist) return null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(getFullUrl(`/proxy/lastfm/similar?artist=${encodeURIComponent(artist)}`));
            if (!response.ok || !isJsonResponse(response)) {
                if (attempt < retries - 1) {
                    await delay(1000 * (attempt + 1));
                    continue;
                }
                return null;
            }
            return await response.json();
        } catch {
            if (attempt < retries - 1) {
                await delay(1000 * (attempt + 1));
                continue;
            }
            return null;
        }
    }
    return null;
};
