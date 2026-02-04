/**
 * External Services Card
 * Shows metadata from Spotify, Last.fm, and MusicBrainz
 */

import React, { useState } from 'react';
import { Metadata } from '../../types';
import { searchSpotifyTrack, getSpotifyAudioFeatures } from '../../services/spotifyService';
import { getLastFmTrackInfo } from '../../services/lastFmService';
import { searchMusicBrainz } from '../../services/musicBrainzService';
import { Music, Users, Database, Loader } from '../icons';

interface ExternalServicesCardProps {
    metadata: Metadata;
    onEnrichMetadata: (enrichedData: Partial<Metadata>) => void;
}

const ExternalServicesCard: React.FC<ExternalServicesCardProps> = ({ metadata, onEnrichMetadata }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [spotifyData, setSpotifyData] = useState<any>(null);
    const [lastFmData, setLastFmData] = useState<any>(null);
    const [musicBrainzData, setMusicBrainzData] = useState<any>(null);

    const fetchExternalData = async () => {
        if (!metadata.title || !metadata.artist) return;

        setIsLoading(true);
        try {
            // Fetch from all services in parallel
            const [spotify, lastFm, musicBrainz] = await Promise.all([
                searchSpotifyTrack(`${metadata.title} ${metadata.artist}`),
                getLastFmTrackInfo(metadata.artist, metadata.title),
                searchMusicBrainz(metadata.title, metadata.artist)
            ]);

            setSpotifyData(spotify);
            setLastFmData(lastFm);
            setMusicBrainzData(musicBrainz);

            // Get Spotify audio features if we have a track
            if (spotify?.id) {
                const features = await getSpotifyAudioFeatures(spotify.id);
                if (features) {
                    setSpotifyData({ ...spotify, features });
                }
            }
        } catch (error) {
            console.error('Error fetching external data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const enrichFromSpotify = () => {
        if (!spotifyData) return;

        const enriched: Partial<Metadata> = {};

        if (spotifyData.features) {
            if (spotifyData.features.tempo) enriched.bpm = Math.round(spotifyData.features.tempo);
            if (spotifyData.features.key !== undefined) {
                const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                enriched.key = keys[spotifyData.features.key];
                enriched.mode = spotifyData.features.mode === 1 ? 'Major' : 'Minor';
            }
        }

        if (spotifyData.album?.name) enriched.album = spotifyData.album.name;
        if (spotifyData.album?.release_date) enriched.year = spotifyData.album.release_date.substring(0, 4);

        onEnrichMetadata(enriched);
    };

    const enrichFromLastFm = () => {
        if (!lastFmData?.track) return;

        const enriched: Partial<Metadata> = {};

        if (lastFmData.track.album?.title) enriched.album = lastFmData.track.album.title;

        // Get top tags as genres
        if (lastFmData.track.toptags?.tag) {
            const tags = lastFmData.track.toptags.tag.slice(0, 3).map((t: any) => t.name);
            if (tags.length > 0) {
                enriched.mainGenre = tags[0];
                enriched.additionalGenres = tags.slice(1);
            }
        }

        onEnrichMetadata(enriched);
    };

    const enrichFromMusicBrainz = () => {
        if (!musicBrainzData?.recordings?.[0]) return;

        const recording = musicBrainzData.recordings[0];
        const enriched: Partial<Metadata> = {};

        if (recording.releases?.[0]) {
            const release = recording.releases[0];
            if (release.title) enriched.album = release.title;
            if (release.date) enriched.year = release.date.substring(0, 4);
        }

        if (recording.isrcs?.[0]) enriched.isrc = recording.isrcs[0];

        onEnrichMetadata(enriched);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    External Services
                </h3>
                <button
                    onClick={fetchExternalData}
                    disabled={isLoading || !metadata.title || !metadata.artist}
                    className="px-4 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Fetching...
                        </>
                    ) : (
                        <>
                            <Database className="w-4 h-4" />
                            Fetch Metadata
                        </>
                    )}
                </button>
            </div>

            {!metadata.title || !metadata.artist ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Enter title and artist first to fetch external metadata
                </p>
            ) : null}

            {/* Spotify */}
            {spotifyData && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Music className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-900 dark:text-green-100">Spotify</span>
                        </div>
                        <button
                            onClick={enrichFromSpotify}
                            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                            Use This Data
                        </button>
                    </div>
                    <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                        {spotifyData.features?.tempo && <p>BPM: {Math.round(spotifyData.features.tempo)}</p>}
                        {spotifyData.features?.key !== undefined && (
                            <p>Key: {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][spotifyData.features.key]} {spotifyData.features.mode === 1 ? 'Major' : 'Minor'}</p>
                        )}
                        {spotifyData.album?.name && <p>Album: {spotifyData.album.name}</p>}
                        {spotifyData.album?.release_date && <p>Year: {spotifyData.album.release_date.substring(0, 4)}</p>}
                    </div>
                </div>
            )}

            {/* Last.fm */}
            {lastFmData?.track && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-red-600" />
                            <span className="font-medium text-red-900 dark:text-red-100">Last.fm</span>
                        </div>
                        <button
                            onClick={enrichFromLastFm}
                            className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                            Use This Data
                        </button>
                    </div>
                    <div className="text-sm text-red-800 dark:text-red-200 space-y-1">
                        {lastFmData.track.album?.title && <p>Album: {lastFmData.track.album.title}</p>}
                        {lastFmData.track.toptags?.tag && (
                            <p>Tags: {lastFmData.track.toptags.tag.slice(0, 3).map((t: any) => t.name).join(', ')}</p>
                        )}
                        {lastFmData.track.playcount && <p>Plays: {Number(lastFmData.track.playcount).toLocaleString()}</p>}
                    </div>
                </div>
            )}

            {/* MusicBrainz */}
            {musicBrainzData?.recordings?.[0] && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-orange-600" />
                            <span className="font-medium text-orange-900 dark:text-orange-100">MusicBrainz</span>
                        </div>
                        <button
                            onClick={enrichFromMusicBrainz}
                            className="text-xs px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                        >
                            Use This Data
                        </button>
                    </div>
                    <div className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                        {musicBrainzData.recordings[0].releases?.[0]?.title && (
                            <p>Album: {musicBrainzData.recordings[0].releases[0].title}</p>
                        )}
                        {musicBrainzData.recordings[0].releases?.[0]?.date && (
                            <p>Year: {musicBrainzData.recordings[0].releases[0].date.substring(0, 4)}</p>
                        )}
                        {musicBrainzData.recordings[0].isrcs?.[0] && (
                            <p>ISRC: {musicBrainzData.recordings[0].isrcs[0]}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExternalServicesCard;
