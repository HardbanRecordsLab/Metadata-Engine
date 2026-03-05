import { Metadata } from '../types';
import { getFullUrl } from '../apiConfig';

declare const jsmediatags: any;

const safeStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val).trim().replaceAll(/\0/g, '');
};

const getTagValue = (tags: any, keys: string[]): string | undefined => {
    for (const key of keys) {
        const tag = tags[key];
        if (tag) return safeStr(tag.data || tag.value || tag);
    }
    return undefined;
};

/** Try to parse TXXX frames by description */
const getTXXX = (tags: any, description: string): string | undefined => {
    // jsmediatags returns TXXX as array under 'TXXX' key or individual keys
    const txxx = tags['TXXX'];
    if (Array.isArray(txxx)) {
        const found = txxx.find((t: any) => t?.data?.description?.toUpperCase() === description.toUpperCase());
        return found ? safeStr(found.data?.value) : undefined;
    }
    return getTagValue(tags, [`TXXX:${description}`, `TXXX:${description.toUpperCase()}`]);
};

export const readMetadataFromFile = (file: File): Promise<{ metadata: Partial<Metadata>; coverUrl: string | null }> => {
    return new Promise((resolve) => {
        if (typeof jsmediatags === 'undefined' || !file) {
            resolve({ metadata: {}, coverUrl: null });
            return;
        }

        try {
            new jsmediatags.Reader(file).read({
                onSuccess: (tag: any) => {
                    const t = tag.tags;
                    const metadata: Partial<Metadata> = {};
                    let coverUrl: string | null = null;

                    // ── Core Identity ──────────────────────────────────────
                    metadata.title       = getTagValue(t, ['title', 'TIT2']);
                    metadata.artist      = getTagValue(t, ['artist', 'TPE1']);
                    metadata.album       = getTagValue(t, ['album', 'TALB']);
                    metadata.albumArtist = getTagValue(t, ['TPE2', 'album artist']);
                    metadata.composer    = getTagValue(t, ['TCOM']);
                    metadata.lyricist    = getTagValue(t, ['TEXT']);
                    metadata.publisher   = getTagValue(t, ['TPUB']);
                    metadata.copyright   = getTagValue(t, ['TCOP']);

                    // ── Genre ──────────────────────────────────────────────
                    const genreRaw = getTagValue(t, ['genre', 'TCON']);
                    if (genreRaw) {
                        // Strip ID3v1 numeric genre codes like "(17)"
                        metadata.mainGenre = genreRaw.replace(/^\(\d+\)/, '').trim();
                    }

                    // ── Year & Track ───────────────────────────────────────
                    const yearRaw = getTagValue(t, ['year', 'TYER', 'TDRC']);
                    if (yearRaw) metadata.year = yearRaw.substring(0, 4);

                    const trackRaw = getTagValue(t, ['TRCK', 'track']);
                    if (trackRaw) {
                        const n = parseInt(trackRaw.split('/')[0]);
                        if (!isNaN(n)) metadata.track = n;
                    }

                    // ── Technical ─────────────────────────────────────────
                    const bpmRaw = getTagValue(t, ['TBPM', 'BPM']);
                    if (bpmRaw) {
                        const parsedBpm = parseFloat(bpmRaw);
                        if (!isNaN(parsedBpm) && parsedBpm > 0) metadata.bpm = parsedBpm;
                    }

                    metadata.language = getTagValue(t, ['TLAN']);
                    metadata.isrc     = getTagValue(t, ['TSRC']);

                    // ── TXXX Extended Tags ────────────────────────────────
                    metadata.iswc          = getTXXX(t, 'ISWC');
                    metadata.upc           = getTXXX(t, 'UPC') || getTXXX(t, 'BARCODE');
                    metadata.catalogNumber = getTXXX(t, 'CATALOGNUMBER') || getTXXX(t, 'CATALOG NUMBER');
                    metadata.producer      = getTXXX(t, 'PRODUCER');
                    metadata.mainInstrument= getTXXX(t, 'MAIN_INSTRUMENT') || getTXXX(t, 'INSTRUMENT');
                    metadata.pLine         = getTXXX(t, 'P_LINE') || getTXXX(t, 'PLINE');

                    // Key (initial key can be in TKEY or TXXX:INITIALKEY)
                    const keyRaw = getTagValue(t, ['TKEY']) || getTXXX(t, 'INITIALKEY') || getTXXX(t, 'KEY');
                    if (keyRaw) {
                        // Normalize Camelot/musical key notation
                        const parts = keyRaw.split(' ');
                        metadata.key  = parts[0] || keyRaw;
                        metadata.mode = parts[1] || '';
                    }

                    // Parse list fields
                    const parseList = (val?: string) => val ? val.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];
                    metadata.keywords        = parseList(getTXXX(t, 'KEYWORDS') || getTXXX(t, 'COMMENT'));
                    metadata.moods           = parseList(getTXXX(t, 'MOOD') || getTXXX(t, 'MOODS') || getTagValue(t, ['TMOO']));
                    metadata.additionalGenres= parseList(getTXXX(t, 'SUBGENRE') || getTXXX(t, 'GENRE2'));
                    metadata.instrumentation = parseList(getTXXX(t, 'INSTRUMENTATION') || getTXXX(t, 'INSTRUMENTS'));
                    metadata.useCases        = parseList(getTXXX(t, 'USAGE') || getTXXX(t, 'USE_CASES'));

                    // Track description from COMM (comment) frame
                    const comm = t['COMM'];
                    if (comm) {
                        const commVal = comm?.data?.text || comm?.data || '';
                        if (commVal) metadata.trackDescription = safeStr(commVal);
                    }

                    // Energy level
                    const energyRaw = getTXXX(t, 'ENERGY') || getTXXX(t, 'ENERGY_LEVEL');
                    if (energyRaw) { metadata.energyLevel = energyRaw; metadata.energy_level = energyRaw; }

                    // Extended metadata fields
                    const musicalEraRaw = getTXXX(t, 'MUSICAL_ERA');
                    if (musicalEraRaw) metadata.musicalEra = musicalEraRaw;

                    const prodQualityRaw = getTXXX(t, 'PRODUCTION_QUALITY');
                    if (prodQualityRaw) metadata.productionQuality = prodQualityRaw;

                    const dynamicsRaw = getTXXX(t, 'DYNAMICS');
                    if (dynamicsRaw) metadata.dynamics = dynamicsRaw;

                    const targetAudienceRaw = getTXXX(t, 'TARGET_AUDIENCE');
                    if (targetAudienceRaw) metadata.targetAudience = targetAudienceRaw;

                    const tempoCharRaw = getTXXX(t, 'TEMPO_CHARACTER');
                    if (tempoCharRaw) metadata.tempoCharacter = tempoCharRaw;

                    const moodVibeRaw = getTXXX(t, 'MOOD_VIBE');
                    if (moodVibeRaw) metadata.mood_vibe = moodVibeRaw;

                    const analysisReasoningRaw = getTXXX(t, 'ANALYSIS_REASONING');
                    if (analysisReasoningRaw) metadata.analysisReasoning = analysisReasoningRaw;

                    const licenseRaw = getTXXX(t, 'LICENSE');
                    if (licenseRaw) metadata.license = licenseRaw;

                    const explicitRaw = getTXXX(t, 'EXPLICIT_CONTENT');
                    if (explicitRaw) metadata.explicitContent = explicitRaw;

                    const ownerRaw = getTXXX(t, 'FILE_OWNER');
                    if (ownerRaw) metadata.fileOwner = ownerRaw;

                    const sha256Raw = getTXXX(t, 'SHA256');
                    if (sha256Raw) metadata.sha256 = sha256Raw;

                    // DSP numeric fields
                    const acousticScoreRaw = getTXXX(t, 'ACOUSTIC_SCORE');
                    if (acousticScoreRaw) { const n = parseFloat(acousticScoreRaw); if (!isNaN(n)) metadata.acousticScore = n; }

                    const dynamicRangeRaw = getTXXX(t, 'DYNAMIC_RANGE');
                    if (dynamicRangeRaw) { const n = parseFloat(dynamicRangeRaw); if (!isNaN(n)) metadata.dynamicRange = n; }

                    const spectralCentroidRaw = getTXXX(t, 'SPECTRAL_CENTROID');
                    if (spectralCentroidRaw) { const n = parseFloat(spectralCentroidRaw); if (!isNaN(n)) metadata.spectralCentroid = n; }

                    const spectralRolloffRaw = getTXXX(t, 'SPECTRAL_ROLLOFF');
                    if (spectralRolloffRaw) { const n = parseFloat(spectralRolloffRaw); if (!isNaN(n)) metadata.spectralRolloff = n; }

                    const hasVocalsRaw = getTXXX(t, 'HAS_VOCALS');
                    if (hasVocalsRaw) metadata.hasVocals = hasVocalsRaw === 'true' || hasVocalsRaw === 'True';

                    // ── Cover Art ─────────────────────────────────────────
                    if (t.picture) {
                        const { data, format } = t.picture;
                        try {
                            const base64 = btoa(String.fromCodePoint(...new Uint8Array(data)));
                            coverUrl = `data:${format};base64,${base64}`;
                        } catch (e) {
                            console.warn('[TaggingService] Cover art decode failed:', e);
                        }
                    }

                    // Clean up undefined fields
                    Object.keys(metadata).forEach((k) => {
                        const key = k as keyof typeof metadata;
                        if (metadata[key] === undefined || metadata[key] === '') delete metadata[key];
                    });

                    console.log('[TaggingService] Read success:', tag.type, Object.keys(metadata).length, 'fields');
                    resolve({ metadata, coverUrl });
                },

                onError: (error: any) => {
                    console.log('[TaggingService] No tags found (format unsupported or no tags). Falling back to AI.');
                    resolve({ metadata: {}, coverUrl: null });
                },
            });
        } catch (e) {
            resolve({ metadata: {}, coverUrl: null });
        }
    });
};

// ── EMBED METADATA (server-side with file fallback) ───────────

export const embedMetadata = async (file: File | null, metadata: Metadata, jobId?: string): Promise<void> => {
    try {
        console.log('Starting tagging via Backend API...');

        const formData = new FormData();
        formData.append('metadata', JSON.stringify(metadata));

        let response: Response | undefined;

        if (jobId) {
            console.log(`[TaggingService] Server-side tagging for Job: ${jobId}`);
            response = await fetch(getFullUrl(`/tag/job/${jobId}`), { method: 'POST', body: formData });

            // Job expired: re-upload the file
            if (!response.ok && response.status === 410 && file) {
                console.warn('[TaggingService] Job expired — falling back to file upload.');
                const fd2 = new FormData();
                fd2.append('metadata', JSON.stringify(metadata));
                fd2.append('file', file);
                response = await fetch(getFullUrl('/tag/file'), { method: 'POST', body: fd2 });
            }
        } else if (file) {
            formData.append('file', file);
            response = await fetch(getFullUrl('/tag/file'), { method: 'POST', body: formData });
        } else {
            throw new Error('Source file or Job ID missing.');
        }

        if (!response || !response.ok) {
            const err = await response?.json().catch(() => ({ detail: response?.statusText }));
            throw new Error(err?.detail || `Server error: ${response?.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // Preserve original extension
        const lastDot = file ? file.name.lastIndexOf('.') : -1;
        const ext = lastDot >= 0 ? file!.name.substring(lastDot + 1) : 'mp3';
        const baseName = lastDot >= 0 ? file!.name.substring(0, lastDot) : (file?.name ?? 'audio');
        a.download = `[Tagged] ${baseName}.${ext}`;

        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);

    } catch (e: any) {
        console.error('Embedding error:', e);
        let msg = e.message;
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            msg = 'Połączenie z serwerem przerwane lub plik został zmieniony/usunięty. Spróbuj odświeżyć stronę.';
        } else if (e.name === 'NotReadableError') {
            msg = 'Błąd uprawnień: przeglądarka straciła dostęp do pliku. Wybierz plik ponownie.';
        }
        throw new Error('Błąd podczas zapisywania pliku: ' + msg);
    }
};
