
import { MBSearchResult, MBRecording, Metadata } from '../types';

const BASE_URL = 'https://musicbrainz.org/ws/2';
const COVER_ART_ARCHIVE = 'https://coverartarchive.org';

// MusicBrainz requires a User-Agent header with contact info
const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'MusicMetadataEngine/1.3 ( contact@musicmetadata.ai )' // Replace with your contact info in prod
};

/**
 * Searches for recordings in MusicBrainz database.
 */
export const searchMusicBrainz = async (query: string): Promise<MBRecording[]> => {
  if (!query) return [];

  try {
    // Using Lucene search syntax for better results
    const encodedQuery = encodeURIComponent(query);
    const url = `${BASE_URL}/recording?query=${encodedQuery}&fmt=json&limit=5`;
    
    const response = await fetch(url, { headers: HEADERS });
    
    if (!response.ok) {
      throw new Error(`MusicBrainz API Error: ${response.statusText}`);
    }

    const data: MBSearchResult = await response.json();
    return data.recordings || [];
  } catch (error) {
    console.error("MusicBrainz search failed:", error);
    throw new Error("Nie udało się przeszukać bazy MusicBrainz.");
  }
};

/**
 * Attempts to fetch cover art for a specific release.
 */
export const getCoverArtUrl = async (releaseId: string): Promise<string | null> => {
  try {
    const url = `${COVER_ART_ARCHIVE}/release/${releaseId}`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      // Prefer front cover, default to first image
      const front = data.images.find((img: any) => img.front) || data.images[0];
      return front ? front.image : null;
    }
    return null;
  } catch (error) {
    // Cover art might not exist, which is fine
    return null;
  }
};

/**
 * Converts a MusicBrainz recording result into our app's Metadata format.
 */
export const mapMBToMetadata = (recording: MBRecording): Partial<Metadata> => {
  const artistName = recording['artist-credit']?.[0]?.name || '';
  
  // Find the best release (prefer ones with date)
  // Logic: releases are usually array, we pick the first one that has data
  const release = recording.releases?.[0];
  const releaseDate = release?.date;
  
  // Map Full Year or Date
  const year = releaseDate ? releaseDate.substring(0, 4) : '';
  
  const label = release?.['label-info']?.[0]?.label?.name;
  const catalogNumber = release?.['label-info']?.[0]?.['catalog-number'];
  
  const isrc = recording.isrcs?.[0]?.id;

  return {
    title: recording.title,
    artist: artistName,
    album: release?.title,
    year: year,
    isrc: isrc,
    publisher: label,
    catalogNumber: catalogNumber,
    duration: recording.length ? Math.round(recording.length / 1000) : undefined,
    albumArtist: artistName, // Simple assumption
    copyright: label && year ? `© ${year} ${label}` : undefined,
  };
};
