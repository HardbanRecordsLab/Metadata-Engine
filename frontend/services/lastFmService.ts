import { LastFmArtist } from '../types';
import { getFullUrl } from '../apiConfig';

export const getLastFmArtistInfo = async (artist: string): Promise<LastFmArtist | null> => {
    if (!artist) return null;

    try {
        // Refactored to use backend proxy for Zero-Knowledge frontend
        const response = await fetch(getFullUrl(`/proxy/lastfm/artist?artist=${encodeURIComponent(artist)}`));

        if (!response.ok) {
            console.error(`Last.fm Proxy Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (data.error) {
            console.error("Last.fm API Error:", data.message);
            return null;
        }

        return data.artist;
    } catch (error) {
        console.error("Last.fm service error:", error);
        return null;
    }
};

export const extractTagsFromLastFm = (artistData: any): string[] => {
    if (!artistData?.tags?.tag) return [];
    return artistData.tags.tag.map((t: any) => t.name);
};
