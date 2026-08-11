
import { ACRResponse, Metadata } from '../../types';
import { getFullUrl } from '../../apiConfig';

/**
 * Identifies a track via the backend's ACRCloud proxy. Signing used to
 * happen in the browser with VITE_ACR_ACCESS_SECRET, which Vite bakes
 * into the public JS bundle at build time — anyone could read it via
 * view-source. The backend now holds the ACR credentials and does the
 * signing server-side, matching every other third-party integration.
 */
export const identifyTrack = async (file: File): Promise<Partial<Metadata> | null> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(getFullUrl('/acr/identify'), {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ACRCloud identification failed (${response.status}): ${errText}`);
    }

    const rawData: ACRResponse = await response.json();
    return mapACRToMetadata(rawData);
};

export const mapACRToMetadata = (acrData: ACRResponse): Partial<Metadata> | null => {
    const music = acrData.metadata?.music?.[0];
    if (!music) return null;

    return {
        title: music.title,
        artist: music.artists?.map(a => a.name).join(', '),
        album: music.album?.name,
        year: music.date ? music.date.substring(0, 4) : undefined,
        publisher: music.label,
        isrc: music.external_ids?.isrc,
        // ACRCloud genres often need mapping, usually provides array
        mainGenre: music.genres?.[0]?.name,
        // Limit additional genres to 5
        additionalGenres: music.genres?.slice(1, 6).map(g => g.name) || [],
    };
};
