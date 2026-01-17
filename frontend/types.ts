export interface VocalStyle {
    gender: string; // e.g., Male, Female, Androgynous, None
    timbre: string; // e.g., Breathy, Raspy, Clear, Warm
    delivery: string; // e.g., Melismatic, Staccato, Rhythmic, Spoken Word
    emotionalTone: string; // e.g., Melancholic, Joyful, Aggressive, Yearning
}

// Updated Tiers based on volume
export type UserTier = 'starter' | 'hobby' | 'basic' | 'pro' | 'studio';

export interface User {
    id: string;
    email: string;
    name: string;
    tier: UserTier;
    avatarUrl?: string;
    createdAt: number;
    credits: number; // New: Number of remaining analyses
}

export interface UserProfile { // Legacy compatibility
    name: string;
    tier: UserTier;
    credits: number; // New: Number of remaining analyses
}

export interface Metadata {
    // Identity
    title?: string;
    artist?: string;
    album?: string;
    albumArtist?: string;
    year?: string;
    track?: number;
    duration?: number; // Seconds
    coverArt?: string; // URL to generated cover art

    // Sonic & Technical
    mainInstrument: string;
    key: string;
    mode: string;
    bpm: number;
    mainGenre: string;
    additionalGenres: string[];
    trackDescription: string; // Maps to COMMENT
    keywords: string[];

    language?: string;

    // Credits & Legal
    copyright?: string;
    pLine?: string; // Production line (p)
    publisher?: string;
    composer?: string;
    lyricist?: string;
    producer?: string;
    catalogNumber?: string;
    isrc?: string;
    iswc?: string;
    upc?: string;
    sha256?: string; // Digital Fingerprint

    // Pro fields
    moods?: string[]; // Maps to Style/Mood
    mood_vibe?: string; // e.g. "Peaceful but mysterious"
    energy_level?: string; // e.g. "Medium-High"
    instrumentation?: string[];
    vocalStyle?: VocalStyle;
    useCases?: string[];
    structure?: StructureSegment[];
}

export interface AnalysisRecord {
    id: string;
    metadata: Metadata;
    inputType: 'file' | 'idea';
    input: {
        fileName?: string;
        link?: string;
        description?: string;
    };
    jobId?: string;
}

export interface BatchItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'completed' | 'error';
    metadata?: Metadata;
    error?: string;
    jobId?: string; // Persistent Backend Job ID
    message?: string; // Real-time status message
}

// MusicBrainz Types
export interface MBRecording {
    id: string;
    score: number;
    title: string;
    length: number;
    'artist-credit': Array<{
        name: string;
        artist: { id: string; name: string };
    }>;
    releases?: Array<{
        id: string;
        title: string;
        date?: string;
        country?: string;
        'label-info'?: Array<{
            label: { name: string };
            'catalog-number'?: string;
        }>;
    }>;
    isrcs?: Array<{ id: string }>;
}

export interface MBSearchResult {
    created: string;
    count: number;
    offset: number;
    recordings: MBRecording[];
}

// Hugging Face Types
export interface HFClassificationResult {
    label: string;
    score: number;
}

// ACRCloud Types
export interface ACRCloudConfig {
    host: string;
    accessKey: string;
    accessSecret: string;
}

export interface ACRMusicItem {
    title: string;
    artists?: Array<{ name: string }>;
    album?: { name: string };
    date?: string; // YYYY-MM-DD
    label?: string;
    external_ids?: {
        isrc?: string;
        upc?: string;
    };
    genres?: Array<{ name: string }>;
    score: number; // Confidence
    play_offset_ms: number;
}

export interface ACRResponse {
    status: {
        msg: string;
        code: number;
        version: string;
    };
    metadata?: {
        music?: ACRMusicItem[];
    };
}

// AcoustID Types
export interface AcoustIDArtist {
    name: string;
}

export interface AcoustIDRelease {
    title: string;
    country: string;
    date: string;
    id: string;
}

export interface AcoustIDRecording {
    id: string;
    title: string;
    artists?: AcoustIDArtist[];
    releases?: AcoustIDRelease[];
}

export interface AcoustIDResult {
    score: number;
    id: string;
    recordings?: AcoustIDRecording[];
}

export interface AcoustIDResponse {
    status: string;
    results: AcoustIDResult[];
}

// Spotify Types
export interface SpotifyAudioFeatures {
    danceability: number;
    energy: number;
    key: number;
    loudness: number;
    mode: number;
    speechiness: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    valence: number;
    tempo: number;
    id: string;
    duration_ms: number;
    time_signature: number;
}

export interface SpotifyTrack {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    external_urls: { spotify: string };
    album: {
        name: string;
        images: Array<{ url: string }>;
    };
}

// --- MARKET PULSE 2.0 TYPES ---

export interface RadioStation {
    name: string;
    url: string;
    homepage: string;
    country: string;
    tags: string;
    favicon: string;
    votes: number;
}

export interface LiveEvent {
    id: string;
    datetime: string;
    venue: {
        name: string;
        city: string;
        country: string;
    };
    url: string;
}

export interface MarketPersona {
    name: string; // e.g. "The Sad Late-Night Driver"
    ageRange: string;
    platforms: string[]; // e.g. TikTok, SoundCloud
    interests: string[];
    listeningHabits: string;
}

export interface MarketSWOT {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[]; // e.g. "Good for Sync Licensing in Indie Games"
    threats: string[]; // e.g. "Oversaturated Lo-Fi market"
}

export interface ViralPotential {
    score: number; // 0-100
    hookTimeStamp?: string;
    reason: string;
    platformFit: 'High' | 'Medium' | 'Low';
    suggestedChallenge: string; // e.g. "Slow motion transition video"
}

export interface MarketIntelligence {
    lastUpdated: number;
    similarArtists: Array<{ name: string; affinity: number; reason: string }>;
    targetPlaylists: Array<{ name: string; type: 'Editorial' | 'User' | 'Algorithmic'; followerEstimate: string }>;
    persona: MarketPersona;
    swot: MarketSWOT;
    viralPotential: ViralPotential;
    syncSuitability: string[]; // e.g. ["Car Commercial", "Action Movie"]
    releaseStrategy: string; // e.g. "Release on Friday, focus on YouTube Shorts first"
}

// Market Pulse Types (Legacy/Basic)
export interface GroundingSource {
    web: {
        uri: string;
        title: string;
    }
}

export interface TrackSuggestion {
    artist: string;
    title: string;
    reason: string;
}

export interface ArtistSuggestion {
    name: string;
    reason: string;
    image_url?: string;
}

export interface PlaylistSuggestion {
    name: string;
    platform: string;
    reason: string;
}

export interface MarketPulseData {
    tracks: TrackSuggestion[];
    artists: ArtistSuggestion[];
    playlists: PlaylistSuggestion[];
}

// Lyrical & Structure Types
export interface LyricsAnalysis {
    lyrics: string;
    theme: string;
    mood: string;
    summary: string;
}

export interface LyricalIdeas {
    verse: string;
    chorus: string;
    explanation: string;
}

export interface StructureSegment {
    section: string;
    startTime: number;
    endTime: number;
    description: string;
    label?: string; // For flexibility
    chords?: string;
    keyChange?: string;
}

// Cloud Types
export interface CloudFile {
    id: string;
    name: string;
    size: string;
    type: string;
    modified: string;
}

// AudD Types
export interface AudDResponse {
    status: string;
    result: {
        artist: string;
        title: string;
        album: string;
        release_date: string;
        label: string;
        timecode: string;
        song_link: string;
        spotify?: {
            picture: string;
        };
        apple_music?: {
            url: string;
        };
    } | null;
    error?: {
        error_code: number;
        error_message: string;
    };
}

// Last.fm Types
export interface LastFmTag {
    name: string;
    url: string;
}

export interface LastFmArtist {
    name: string;
    url: string;
    listeners?: string;
}

export interface LastFmTrackInfo {
    track?: {
        name: string;
        artist: { name: string };
        toptags: { tag: LastFmTag[] };
        listeners: string;
        playcount: string;
    }
}

export interface LastFmSimilarArtists {
    similarartists?: {
        artist: LastFmArtist[];
    }
}

// Discogs Types
export interface DiscogsResult {
    id: number;
    title: string;
    year?: string;
    label?: string[];
    catno?: string;
    genre?: string[];
    style?: string[];
    thumb?: string;
}

export interface DiscogsSearchResponse {
    results: DiscogsResult[];
}
// Job & Queue Types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface JobResponse {
    id: string;
    status: JobStatus;
    message?: string;
    result?: Metadata;
    error?: string;
    timestamp: string;
}
