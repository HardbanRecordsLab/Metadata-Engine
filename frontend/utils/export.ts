
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

const CSV_HEADERS = [
    '_filename',
    'title',
    'artist',
    'album',
    'year',
    'track',
    'MAIN_INSTRUMENT',
    'TKEY',
    'MODE',
    'bpm',
    'genre',
    'SUBGENRE',
    'comment',
    'KEYWORDS',
    'copyright',
    'publisher',
    'composer',
    'lyricist',
    'albumartist',
    'CATALOGNUMBER',
    'isrc',
    'MOOD',
    'INSTRUMENTATION',
    'VOCAL_STYLE_GENDER',
    'VOCAL_STYLE_TIMBRE',
    'VOCAL_STYLE_DELIVERY',
    'VOCAL_STYLE_EMOTIONALTONE',
    'USAGE',
    'LANGUAGE',
];

const hasAnyDeprecatedField = (data: any) => {
    const keys = [
        'STRUCTURE',
        'EXPLICIT_CONTENT',
        'MUSICAL_ERA',
        'PRODUCTION_QUALITY',
        'DYNAMICS',
        'TARGET_AUDIENCE',
        'TEMPO_CHARACTER',
        'ENERGY_LEVEL',
        'duration',
        'structure',
        'explicitContent',
        'musicalEra',
        'productionQuality',
        'dynamics',
        'targetAudience',
        'tempoCharacter',
        'energyLevel',
    ];
    return keys.some(k => Object.prototype.hasOwnProperty.call(data, k) && data[k] !== undefined && data[k] !== null && data[k] !== '');
};

const sanitizeScalar = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    return String(value).replace(/\r?\n/g, ' ').trim();
};

const serializeArray = (arr: unknown): string => {
    if (!Array.isArray(arr)) return '';
    const cleaned = arr
        .map(v => sanitizeScalar(v))
        .map(v => v.trim())
        .filter(Boolean);
    const uniqueSorted = Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
    return uniqueSorted.join(', ');
};

const formatCsvValue = (value: unknown) => {
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
        gender: sanitizeScalar(vs?.gender),
        timbre: sanitizeScalar(vs?.timbre),
        delivery: sanitizeScalar(vs?.delivery),
        emotionalTone: sanitizeScalar(vs?.emotionalTone),
    };
};

const metadataToCsvRow = (fileName: string, data: Metadata) => {
    if (!fileName) throw new Error('EXPORT_ABORT: missing _filename');
    if (hasAnyDeprecatedField(data)) throw new Error('SCHEMA_VIOLATION: deprecated field referenced');

    const vocal = resolveVocalStyle(data);

    return [
        formatCsvValue(fileName),
        formatCsvValue(data.title),
        formatCsvValue(data.artist),
        formatCsvValue(data.album),
        formatCsvValue(data.year),
        formatCsvValue(data.track ?? 1),
        formatCsvValue(data.mainInstrument),
        formatCsvValue(data.key),
        formatCsvValue(data.mode),
        formatCsvValue(data.bpm),
        formatCsvValue(data.mainGenre),
        formatCsvValue(serializeArray(data.additionalGenres)),
        formatCsvValue(data.trackDescription),
        formatCsvValue(serializeArray(data.keywords)),
        formatCsvValue(data.copyright),
        formatCsvValue(data.publisher),
        formatCsvValue(data.composer),
        formatCsvValue(data.lyricist),
        formatCsvValue(data.albumArtist),
        formatCsvValue(data.catalogNumber),
        formatCsvValue(data.isrc),
        formatCsvValue(serializeArray(data.moods)),
        formatCsvValue(serializeArray(data.instrumentation)),
        formatCsvValue(vocal.gender),
        formatCsvValue(vocal.timbre),
        formatCsvValue(vocal.delivery),
        formatCsvValue(vocal.emotionalTone),
        formatCsvValue(serializeArray(data.useCases)),
        formatCsvValue(data.language),
    ].join(',');
};


export const exportToCsv = (data: Metadata, fileName: string) => {
    const row = metadataToCsvRow('single_file', data);
    const csvContent = [CSV_HEADERS.join(','), row].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, fileName);
};


export const exportBatchToCsv = async (batch: BatchItem[]) => {
    const completedItems = batch.filter(item => item.status === 'completed' && item.metadata);
    if (completedItems.length === 0) return;

    // Check if we can use the backend for a "perfect" export
    const jobIds = completedItems.map(item => item.jobId).filter(Boolean) as string[];

    if (jobIds.length > 0 && jobIds.length === completedItems.length) {
        try {
            const response = await fetch('http://localhost:8888/export/batch/csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobIds)
            });
            if (response.ok) {
                const blob = await response.blob();
                downloadFile(blob, `batch_metadata_${new Date().getTime()}.csv`);
                return;
            }
        } catch (e) {
            console.warn("Backend batch export failed, falling back to local logic:", e);
        }
    }

    // Local Fallback Logic
    const seen = new Set<string>();
    for (const item of completedItems) {
        if (seen.has(item.file.name)) {
            // Log warning but don't strictly throw if we're in fallback mode
            console.warn('EXPORT: duplicate _filename detected in batch');
        }
        seen.add(item.file.name);
    }

    const csvRows = completedItems.map(item => metadataToCsvRow(item.file.name, item.metadata!));
    const csvContent = [CSV_HEADERS.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(blob, `metadata_batch_${timestamp}.csv`);
};
