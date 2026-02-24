import { Metadata, DiscogsResult, DiscogsSearchResponse } from '../types';
import { getFullUrl } from '../apiConfig';

export const searchDiscogs = async (artist: string, title: string): Promise<DiscogsResult | null> => {
    if (!artist || !title) return null;

    try {
        const query = `${artist} - ${title}`;
        // Refactored to use backend proxy for Zero-Knowledge frontend
        const response = await fetch(getFullUrl(`/proxy/discogs/search?q=${encodeURIComponent(query)}`));

        if (!response.ok) {
            console.error(`Discogs Proxy Error: ${response.status}`);
            return null;
        }

        const data: DiscogsSearchResponse = await response.json();

        if (data.results && data.results.length > 0) {
            return data.results[0];
        }
        return null;
    } catch (error) {
        console.error("Discogs search error:", error);
        return null;
    }
};

export const getDiscogsRelease = async (releaseId: string): Promise<any | null> => {
    try {
        const response = await fetch(getFullUrl(`/proxy/discogs/release?release_id=${releaseId}`));
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Discogs release error:", error);
        return null;
    }
};

export const mapDiscogsToMetadata = (discogs: DiscogsResult): Partial<Metadata> => {
    return {
        album: discogs.title.split(' - ')[1] || discogs.title,
        year: discogs.year,
        publisher: discogs.label?.[0],
        catalogNumber: discogs.catno,
        mainGenre: discogs.genre?.[0],
        additionalGenres: discogs.style || []
    };
};
