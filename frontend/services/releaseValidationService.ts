import { Metadata } from '../types';
import { AudioFeatures } from './audioAnalysisService';

export interface ValidationIssue {
    severity: 'error' | 'warning' | 'info';
    category: 'audio' | 'metadata' | 'file' | 'legal' | 'artwork';
    field?: string;
    message: string;
    recommendation?: string;
}

export interface ValidationReport {
    passed: boolean;
    score: number; // 0-100
    issues: ValidationIssue[];
    summary: {
        errors: number;
        warnings: number;
        infos: number;
    };
    readyForDistribution: boolean;
    platformCompatibility: {
        spotify: boolean;
        appleMusic: boolean;
        beatport: boolean;
        soundcloud: boolean;
        youtube: boolean;
    };
}

// Industry standards
const STANDARDS = {
    // Audio Quality Standards
    LOUDNESS_TARGET: -14, // LUFS (Spotify/Apple Music standard)
    LOUDNESS_MIN: -20,
    LOUDNESS_MAX: -8,
    TRUE_PEAK_MAX: -1.0, // dBTP
    SAMPLE_RATE_MIN: 44100,
    BIT_DEPTH_MIN: 16,

    // File Standards
    FILE_SIZE_MAX: 50 * 1024 * 1024, // 50MB
    DURATION_MIN: 30, // seconds
    DURATION_MAX: 600, // 10 minutes (extended mixes can be longer)

    // Metadata Standards
    TITLE_MAX_LENGTH: 100,
    ARTIST_MAX_LENGTH: 100,
    ALBUM_MAX_LENGTH: 100,
    DESCRIPTION_MIN_LENGTH: 50,
    DESCRIPTION_MAX_LENGTH: 500,
    KEYWORDS_MIN: 5,
    KEYWORDS_MAX: 20,

    // Platform Presets
    PRESETS: {
        BEATPORT: {
            requiredFields: ['title', 'artist', 'mainGenre', 'bpm', 'key', 'catalogNumber', 'publisher'],
            audioMinBitrate: '320kbps',
            audioMinSampleRate: 44100
        },
        SPOTIFY: {
            requiredFields: ['title', 'artist', 'trackDescription', 'isrc', 'copyright'],
            maxTruePeak: -1.0,
            targetLoudness: -14
        },
        APPLE_MUSIC: {
            requiredFields: ['title', 'artist', 'isrc', 'copyright'],
            maxTruePeak: -1.0,
            targetLoudness: -16
        },
        SYNC_LICENSING: {
            requiredFields: ['title', 'artist', 'moods', 'instrumentation', 'trackDescription', 'keywords', 'composer', 'publisher'],
            vocalStyleRequired: true
        }
    }
};

export const validateRelease = async (
    file: File | null,
    metadata: Metadata,
    dspFeatures: AudioFeatures | null
): Promise<ValidationReport> => {
    const issues: ValidationIssue[] = [];

    // ===== AUDIO QUALITY VALIDATION =====
    if (dspFeatures) {
        // Loudness check
        if (dspFeatures.loudnessDb !== undefined) {
            if (dspFeatures.loudnessDb < STANDARDS.LOUDNESS_MIN) {
                issues.push({
                    severity: 'warning',
                    category: 'audio',
                    field: 'loudness',
                    message: `Track is too quiet (${dspFeatures.loudnessDb.toFixed(1)} LUFS)`,
                    recommendation: `Increase loudness to at least ${STANDARDS.LOUDNESS_MIN} LUFS. Target: ${STANDARDS.LOUDNESS_TARGET} LUFS for streaming platforms.`
                });
            } else if (dspFeatures.loudnessDb > STANDARDS.LOUDNESS_MAX) {
                issues.push({
                    severity: 'error',
                    category: 'audio',
                    field: 'loudness',
                    message: `Track is too loud (${dspFeatures.loudnessDb.toFixed(1)} LUFS) - risk of distortion`,
                    recommendation: `Reduce loudness to ${STANDARDS.LOUDNESS_TARGET} LUFS. Platforms will normalize anyway, so excessive loudness only reduces dynamic range.`
                });
            } else if (Math.abs(dspFeatures.loudnessDb - STANDARDS.LOUDNESS_TARGET) > 2) {
                issues.push({
                    severity: 'info',
                    category: 'audio',
                    field: 'loudness',
                    message: `Loudness is ${dspFeatures.loudnessDb.toFixed(1)} LUFS (target: ${STANDARDS.LOUDNESS_TARGET} LUFS)`,
                    recommendation: 'Consider adjusting to match streaming platform standards for optimal playback.'
                });
            }
        }

        // True Peak check
        if (dspFeatures.truePeak !== undefined) {
            if (dspFeatures.truePeak > STANDARDS.TRUE_PEAK_MAX) {
                issues.push({
                    severity: 'error',
                    category: 'audio',
                    field: 'truePeak',
                    message: `True peak exceeds ${STANDARDS.TRUE_PEAK_MAX} dBTP (current: ${dspFeatures.truePeak.toFixed(2)} dBTP)`,
                    recommendation: 'Use a true peak limiter to prevent clipping during codec conversion. This will cause distortion on streaming platforms.'
                });
            }
        }

        // Duration check
        if (dspFeatures.duration && dspFeatures.duration < STANDARDS.DURATION_MIN) {
            issues.push({
                severity: 'warning',
                category: 'audio',
                field: 'duration',
                message: `Track is very short (${Math.floor(dspFeatures.duration)}s)`,
                recommendation: 'Most platforms prefer tracks longer than 30 seconds.'
            });
        }

        // Stereo check
        if (dspFeatures.stereo && dspFeatures.stereo.width < 0.2) {
            issues.push({
                severity: 'warning',
                category: 'audio',
                field: 'stereo',
                message: 'Track appears to be mono or very narrow stereo',
                recommendation: 'Consider widening the stereo image for better spatial presence, unless mono is intentional.'
            });
        }

        // Frequency balance check
        if (dspFeatures.balance) {
            const { low, mid, high } = dspFeatures.balance;
            if (low > 50) {
                issues.push({
                    severity: 'warning',
                    category: 'audio',
                    field: 'frequency',
                    message: `Bass-heavy mix (${low.toFixed(1)}% low frequencies)`,
                    recommendation: 'May sound muddy on some playback systems. Consider high-pass filtering or reducing low-end.'
                });
            }
            if (high > 40) {
                issues.push({
                    severity: 'warning',
                    category: 'audio',
                    field: 'frequency',
                    message: `Bright mix (${high.toFixed(1)}% high frequencies)`,
                    recommendation: 'May sound harsh on some playback systems. Consider de-essing or reducing high-end.'
                });
            }
        }
    }

    // ===== FILE VALIDATION =====
    if (file) {
        if (file.size > STANDARDS.FILE_SIZE_MAX) {
            issues.push({
                severity: 'warning',
                category: 'file',
                message: `Large file size (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
                recommendation: 'Consider using a more efficient codec or reducing bit rate.'
            });
        }

        // File type check
        const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac'];
        if (file.type && !validAudioTypes.some(type => file.type.includes(type.split('/')[1]))) {
            issues.push({
                severity: 'error',
                category: 'file',
                message: `Unsupported file format: ${file.type}`,
                recommendation: 'Use WAV (lossless) or high-quality MP3 (320kbps) for distribution.'
            });
        }
    }

    // ===== METADATA VALIDATION =====

    // Essential fields
    if (!metadata.title || metadata.title.trim().length === 0) {
        issues.push({
            severity: 'error',
            category: 'metadata',
            field: 'title',
            message: 'Track title is missing',
            recommendation: 'Title is required by all distribution platforms.'
        });
    } else if (metadata.title.length > STANDARDS.TITLE_MAX_LENGTH) {
        issues.push({
            severity: 'warning',
            category: 'metadata',
            field: 'title',
            message: `Title is too long (${metadata.title.length} characters)`,
            recommendation: `Keep title under ${STANDARDS.TITLE_MAX_LENGTH} characters for better display.`
        });
    }

    if (!metadata.artist || metadata.artist === 'Unknown Artist') {
        issues.push({
            severity: 'error',
            category: 'metadata',
            field: 'artist',
            message: 'Artist name is missing',
            recommendation: 'Artist name is required by all distribution platforms.'
        });
    }

    if (!metadata.album || metadata.album === 'Single') {
        issues.push({
            severity: 'info',
            category: 'metadata',
            field: 'album',
            message: 'Album/Release title not specified',
            recommendation: 'Consider adding a proper release title instead of "Single".'
        });
    }

    // Genre validation
    if (!metadata.mainGenre || metadata.mainGenre === 'Electronic' || metadata.mainGenre === 'Unknown') {
        issues.push({
            severity: 'warning',
            category: 'metadata',
            field: 'genre',
            message: 'Generic or unknown genre classification',
            recommendation: 'Use more specific genre (e.g., "Melodic Techno" instead of "Electronic") for better discoverability.'
        });
    }

    // Track description
    if (!metadata.trackDescription || metadata.trackDescription.length < STANDARDS.DESCRIPTION_MIN_LENGTH) {
        issues.push({
            severity: 'warning',
            category: 'metadata',
            field: 'trackDescription',
            message: 'Track description is missing or too short',
            recommendation: 'Add a compelling 3-5 sentence description for better marketing and sync licensing opportunities.'
        });
    }

    // Keywords
    if (!metadata.keywords || metadata.keywords.length < STANDARDS.KEYWORDS_MIN) {
        issues.push({
            severity: 'warning',
            category: 'metadata',
            field: 'keywords',
            message: `Insufficient keywords (${metadata.keywords?.length || 0})`,
            recommendation: `Add at least ${STANDARDS.KEYWORDS_MIN} relevant keywords for better searchability.`
        });
    }

    // Moods
    if (!metadata.moods || metadata.moods.length === 0) {
        issues.push({
            severity: 'warning',
            category: 'metadata',
            field: 'moods',
            message: 'No mood tags specified',
            recommendation: 'Add mood tags for playlist curation and sync licensing.'
        });
    }

    // ===== LEGAL/COPYRIGHT VALIDATION =====

    if (!metadata.copyright || !metadata.copyright.includes('©')) {
        issues.push({
            severity: 'info',
            category: 'legal',
            field: 'copyright',
            message: 'Copyright information should be reviewed',
            recommendation: 'Ensure copyright year and owner are correct (e.g., "© 2024 Artist Name").'
        });
    }

    if (!metadata.isrc) {
        issues.push({
            severity: 'warning',
            category: 'legal',
            field: 'isrc',
            message: 'ISRC code is missing',
            recommendation: 'ISRC codes are required for royalty tracking and distribution to major platforms.'
        });
    }

    // ===== CALCULATE SCORE & SUMMARY =====

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const infos = issues.filter(i => i.severity === 'info').length;

    // Score calculation (100 - penalties)
    let score = 100;
    score -= errors * 20; // Each error: -20 points
    score -= warnings * 5; // Each warning: -5 points
    score -= infos * 1; // Each info: -1 point
    score = Math.max(0, score);

    const readyForDistribution = errors === 0 && warnings <= 2;

    // Platform compatibility
    const platformCompatibility = {
        spotify: errors === 0 && (dspFeatures?.truePeak || 0) <= -1.0,
        appleMusic: errors === 0 && (dspFeatures?.truePeak || 0) <= -1.0,
        beatport: errors === 0 && (metadata.mainGenre !== 'Unknown') && !!metadata.bpm,
        soundcloud: errors === 0,
        youtube: errors === 0 && !!metadata.trackDescription
    };

    return {
        passed: errors === 0,
        score,
        issues,
        summary: {
            errors,
            warnings,
            infos
        },
        readyForDistribution,
        platformCompatibility
    };
};
