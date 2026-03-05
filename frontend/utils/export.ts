import { Metadata, BatchItem } from '../types';

const downloadFile = (blob: Blob, fileName: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

// ── CSV COLUMN DEFINITIONS ────────────────────────────────────────────────────
// Single source of truth for export schema — stays in sync with backend ALLOWED_METADATA_KEYS

const CSV_HEADERS = [
    // Identity
    '_filename',
    'title',
    'artist',
    'album',
    'albumartist',
    'year',
    'track',
    // Sonic / Technical
    'MAIN_INSTRUMENT',
    'TKEY',
    'MODE',
    'bpm',
    'LANGUAGE',
    // Genre & Classification
    'genre',
    'SUBGENRE',
    'MOOD',
    'INSTRUMENTATION',
    'USAGE',
    'KEYWORDS',
    // Description
    'comment',
    // Vocal Style
    'VOCAL_STYLE_GENDER',
    'VOCAL_STYLE_TIMBRE',
    'VOCAL_STYLE_DELIVERY',
    'VOCAL_STYLE_EMOTIONALTONE',
    // Credits & Legal
    'copyright',
    'publisher',
    'composer',
    'lyricist',
    'producer',
    'CATALOGNUMBER',
    'isrc',
    'iswc',
    'upc',
    'P_LINE',
    'SHA256',
    'LICENSE',
    'EXPLICIT_CONTENT',
    'FILE_OWNER',
    // Extended AI fields
    'ENERGY_LEVEL',
    'MOOD_VIBE',
    'MUSICAL_ERA',
    'PRODUCTION_QUALITY',
    'DYNAMICS',
    'TARGET_AUDIENCE',
    'TEMPO_CHARACTER',
    'ANALYSIS_REASONING',
    // DSP metrics
    'DYNAMIC_RANGE_DB',
    'SPECTRAL_CENTROID_HZ',
    'SPECTRAL_ROLLOFF_HZ',
    'ACOUSTIC_SCORE',
    'HAS_VOCALS',
];

const sanitizeScalar = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    return String(value).replace(/\r?\n/g, ' ').trim();
};

const serializeArray = (arr: unknown): string => {
    if (!Array.isArray(arr)) return '';
    const cleaned = arr
        .map(v => sanitizeScalar(v))
        .filter(Boolean);
    const unique = Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
    return unique.join(', ');
};

const formatCsvValue = (value: unknown): string => {
    const v = sanitizeScalar(value);
    return `"${v.replace(/"/g, '""')}"`;
};

const resolveVocalStyle = (data: Metadata) => {
    const vs = data.vocalStyle;
    const gender = sanitizeScalar(vs?.gender).toLowerCase();
    const isNone = !gender || gender === 'none' || gender === 'instrumental';
    if (isNone) {
        return { gender: 'none', timbre: 'none', delivery: 'none', emotionalTone: 'none' };
    }
    return {
        gender:       sanitizeScalar(vs?.gender),
        timbre:       sanitizeScalar(vs?.timbre),
        delivery:     sanitizeScalar(vs?.delivery),
        emotionalTone: sanitizeScalar(vs?.emotionalTone),
    };
};

const metadataToCsvRow = (fileName: string, data: Metadata): string => {
    if (!fileName) throw new Error('EXPORT_ABORT: missing _filename');

    const vocal = resolveVocalStyle(data);
    const energyLevel = data.energyLevel || data.energy_level || '';

    const values = [
        // Identity
        fileName,
        data.title,
        data.artist,
        data.album,
        data.albumArtist,
        data.year,
        data.track ?? 1,
        // Sonic / Technical
        data.mainInstrument,
        data.key,
        data.mode,
        data.bpm,
        data.language,
        // Genre & Classification
        data.mainGenre,
        serializeArray(data.additionalGenres),
        serializeArray(data.moods),
        serializeArray(data.instrumentation),
        serializeArray(data.useCases),
        serializeArray(data.keywords),
        // Description
        data.trackDescription,
        // Vocal Style
        vocal.gender,
        vocal.timbre,
        vocal.delivery,
        vocal.emotionalTone,
        // Credits & Legal
        data.copyright,
        data.publisher,
        data.composer,
        data.lyricist,
        data.producer,
        data.catalogNumber,
        data.isrc,
        data.iswc,
        data.upc,
        data.pLine,
        data.sha256,
        data.license,
        data.explicitContent,
        data.fileOwner,
        // Extended AI fields
        energyLevel,
        data.mood_vibe,
        data.musicalEra,
        data.productionQuality,
        data.dynamics,
        data.targetAudience,
        data.tempoCharacter,
        data.analysisReasoning,
        // DSP metrics
        data.dynamicRange,
        data.spectralCentroid,
        data.spectralRolloff,
        data.acousticScore,
        data.hasVocals,
    ];

    return values.map(formatCsvValue).join(',');
};


// ── EXPORTS ───────────────────────────────────────────────────────────────────

export const exportToCsv = (data: Metadata, fileName: string) => {
    const row = metadataToCsvRow(fileName || 'track', data);
    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const csvContent = bom + [CSV_HEADERS.join(','), row].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, fileName.replace(/\.[^/.]+$/, '') + '_metadata.csv');
};


export const exportBatchToCsv = async (batch: BatchItem[]) => {
    const completedItems = batch.filter(item => item.status === 'completed' && item.metadata);
    if (completedItems.length === 0) return;

    // Try backend batch export first (most accurate for server-processed files)
    const jobIds = completedItems.map(item => item.jobId).filter(Boolean) as string[];
    if (jobIds.length > 0 && jobIds.length === completedItems.length) {
        try {
            const { getFullUrl } = await import('../apiConfig');
            const response = await fetch(getFullUrl('/export/batch/csv'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobIds),
            });
            if (response.ok) {
                const blob = await response.blob();
                downloadFile(blob, `batch_metadata_${Date.now()}.csv`);
                return;
            }
        } catch (e) {
            console.warn('[export] Backend batch export failed, using local fallback:', e);
        }
    }

    // Local fallback
    const csvRows = completedItems.map(item => metadataToCsvRow(item.file.name, item.metadata!));
    const bom = '\uFEFF';
    const csvContent = bom + [CSV_HEADERS.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(blob, `metadata_batch_${timestamp}.csv`);
};
