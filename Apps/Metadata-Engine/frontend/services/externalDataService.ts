
import { Metadata, RadioStation, LiveEvent } from '../types';

// --- ITUNES SEARCH API (Free, No Key) ---
export const fetchItunesCover = async (query: string): Promise<string | null> => {
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`;
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results[0].artworkUrl100.replace('100x100bb', '1000x1000bb');
        }
        return null;
    } catch (e) {
        console.error("iTunes API Error:", e);
        return null;
    }
};

// --- ODESLI / SONGLINK API (Free endpoints) ---
export interface SmartLinkResult {
    pageUrl: string;
    platforms: string[];
}

export const generateSmartLink = async (query: string): Promise<SmartLinkResult | null> => {
    try {
        // 1. First find the track on iTunes to get a valid source URL (Odesli works best with URLs)
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`;
        const itunesRes = await fetch(itunesUrl);
        const itunesData = await itunesRes.json();
        
        if (!itunesData.results?.length) return null;
        
        const trackUrl = itunesData.results[0].trackViewUrl;

        // 2. Call Odesli API with the iTunes URL
        const odesliUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(trackUrl)}`;
        const response = await fetch(odesliUrl);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        // Extract available platforms keys
        const platforms = Object.keys(data.linksByPlatform || {});
        
        return {
            pageUrl: data.pageUrl,
            platforms: platforms
        };
    } catch (e) {
        console.error("Odesli API Error:", e);
        return null;
    }
};

// --- DATAMUSE API (Rhymes) ---
export const fetchRhymes = async (word: string): Promise<string[]> => {
    try {
        const response = await fetch(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(word)}&max=20`);
        const data = await response.json();
        return data.map((item: any) => item.word);
    } catch (e) {
        return [];
    }
};

// --- RADIO BROWSER API (Free) ---
export const fetchRadioStations = async (genre: string): Promise<RadioStation[]> => {
    if (!genre) return [];
    try {
        const cleanGenre = genre.split('/')[0].trim().toLowerCase();
        // Use a random server from the pool to load balance (best practice for this API)
        const response = await fetch(`https://de1.api.radio-browser.info/json/stations/bytag/${encodeURIComponent(cleanGenre)}?limit=10&order=votes&reverse=true`);
        
        if (!response.ok) return [];
        
        const data = await response.json();
        return data.map((station: any) => ({
            name: station.name,
            url: station.url,
            homepage: station.homepage,
            country: station.country,
            tags: station.tags,
            favicon: station.favicon,
            votes: station.votes
        }));
    } catch (e) {
        console.error("Radio Browser API Error:", e);
        return [];
    }
};

// --- BANDSINTOWN API (Free for non-commercial/display use with generic app_id) ---
export const fetchArtistEvents = async (artist: string): Promise<LiveEvent[]> => {
    if (!artist || artist === 'Unknown') return [];
    try {
        // 'music_metadata_engine' is a generic app_id for testing/dev
        const response = await fetch(`https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events?app_id=music_metadata_engine&date=upcoming`);
        
        if (!response.ok) return [];
        
        const data = await response.json();
        if (!Array.isArray(data)) return [];

        return data.slice(0, 5).map((event: any) => ({
            id: event.id,
            datetime: event.datetime,
            venue: {
                name: event.venue.name,
                city: event.venue.city,
                country: event.venue.country
            },
            url: event.url
        }));
    } catch (e) {
        console.error("Bandsintown API Error:", e);
        return [];
    }
};
