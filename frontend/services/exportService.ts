import { Metadata, VocalStyle } from '../types';

/**
 * Flattens a Metadata object to a CSV-friendly plain object.
 */
function flattenMetadata(metadata: Metadata): Record<string, string> {
    const flat: Record<string, string> = {};

    const str = (v: unknown): string => {
        if (v === null || v === undefined) return '';
        if (Array.isArray(v)) return v.join('; ');
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    };

    const fields: Array<keyof Metadata> = [
        'title', 'artist', 'album', 'albumArtist', 'year', 'track',
        'duration', 'bpm', 'key', 'mode',
        'mainGenre', 'additionalGenres',
        'moods', 'mood_vibe', 'energy_level', 'energyLevel',
        'mainInstrument', 'instrumentation', 'keywords',
        'trackDescription', 'analysisReasoning',
        'targetAudience', 'useCases', 'similar_artists',
        'musicalEra', 'productionQuality', 'dynamics', 'tempoCharacter',
        'language', 'explicitContent', 'fileOwner',
        'copyright', 'pLine', 'publisher', 'composer', 'lyricist', 'producer',
        'catalogNumber', 'isrc', 'iswc', 'upc', 'sha256', 'license',
        'acousticScore', 'hasVocals', 'spectralCentroid', 'spectralRolloff',
    ];

    for (const field of fields) {
        flat[field] = str(metadata[field]);
    }

    // Flatten vocalStyle if present
    if (metadata.vocalStyle) {
        const vs = metadata.vocalStyle as VocalStyle;
        flat['vocalStyle_gender'] = vs.gender || 'none';
        flat['vocalStyle_timbre'] = vs.timbre || '';
        flat['vocalStyle_delivery'] = vs.delivery || '';
        flat['vocalStyle_emotionalTone'] = vs.emotionalTone || '';
    }

    return flat;
}

/**
 * Converts an array of flat records to a CSV string.
 */
function toCSV(records: Record<string, string>[]): string {
    if (records.length === 0) return '';
    const headers = Object.keys(records[0]);
    const escape = (v: string) => {
        const text = String(v);
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    };
    const rows = records.map(r => headers.map(h => escape(r[h] ?? '')).join(','));
    return [headers.join(','), ...rows].join('\n');
}

/**
 * Triggers a browser download of the metadata as a CSV file.
 */
export function exportMetadataToCSV(
    metadata: Metadata | Metadata[],
    filename = 'metadata_export.csv'
): void {
    const items = Array.isArray(metadata) ? metadata : [metadata];
    const records = items.map(flattenMetadata);
    const csvContent = toCSV(records);

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
