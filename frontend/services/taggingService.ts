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

export const readMetadataFromFile = (file: File): Promise<{ metadata: Partial<Metadata>, coverUrl: string | null }> => {
    return new Promise((resolve) => {
        if (typeof jsmediatags === 'undefined' || !file) {
            resolve({ metadata: {}, coverUrl: null });
            return;
        }

        try {
            new jsmediatags.Reader(file)
                .read({
                    onSuccess: (tag: any) => {
                        console.log("[TaggingService] Read success:", tag.type, tag.tags);
                        const t = tag.tags;
                        const metadata: Partial<Metadata> = {};
                        let coverUrl: string | null = null;

                        metadata.title = getTagValue(t, ['title', 'TIT2']);
                        metadata.artist = getTagValue(t, ['artist', 'TPE1']);
                        metadata.album = getTagValue(t, ['album', 'TALB']);
                        metadata.albumArtist = getTagValue(t, ['TPE2']);
                        metadata.mainGenre = getTagValue(t, ['genre', 'TCON']);
                        metadata.composer = getTagValue(t, ['TCOM']);
                        metadata.lyricist = getTagValue(t, ['TEXT']);
                        metadata.publisher = getTagValue(t, ['TPUB']);
                        metadata.copyright = getTagValue(t, ['TCOP']);
                        metadata.pLine = getTagValue(t, ['TXXX:P_LINE', 'TXXX:PLINE']);
                        metadata.language = getTagValue(t, ['TLAN']);
                        metadata.isrc = getTagValue(t, ['TSRC']);
                        metadata.iswc = getTagValue(t, ['TXXX:ISWC']);
                        metadata.upc = getTagValue(t, ['TXXX:UPC']);
                        metadata.catalogNumber = getTagValue(t, ['TXXX:CATALOGNUMBER']);
                        metadata.producer = getTagValue(t, ['TXXX:PRODUCER']);
                        metadata.mainInstrument = getTagValue(t, ['TXXX:MAIN_INSTRUMENT']);

                        // Handle Arrays/Lists from TXXX
                        const parseList = (val?: string) => val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
                        metadata.keywords = parseList(getTagValue(t, ['TXXX:KEYWORDS']));
                        metadata.moods = parseList(getTagValue(t, ['TXXX:MOOD']));
                        metadata.additionalGenres = parseList(getTagValue(t, ['TXXX:SUBGENRE']));
                        metadata.instrumentation = parseList(getTagValue(t, ['TXXX:INSTRUMENTATION']));
                        metadata.useCases = parseList(getTagValue(t, ['TXXX:USAGE']));

                        const yearRaw = getTagValue(t, ['year', 'TYER', 'TDRC']);
                        if (yearRaw) metadata.year = yearRaw.substring(0, 4);

                        const bpmRaw = getTagValue(t, ['TBPM']);
                        if (bpmRaw) {
                            const parsedBpm = Number.parseFloat(bpmRaw);
                            if (!Number.isNaN(parsedBpm)) metadata.bpm = parsedBpm;
                        }

                        if (t.picture) {
                            const { data, format } = t.picture;
                            const base64 = btoa(String.fromCodePoint(...new Uint8Array(data)));
                            coverUrl = `data:${format};base64,${base64}`;
                        }
                        resolve({ metadata, coverUrl });
                    },
                    onError: (error: any) => {
                        // Silent fallback for formats like WAV or corrupted tags
                        console.log("[TaggingService] No local tags found in file (format not supported). Falling back to AI.");
                        resolve({ metadata: {}, coverUrl: null });
                    }
                });
        } catch (e) {
            resolve({ metadata: {}, coverUrl: null });
        }
    });
};

export const embedMetadata = async (file: File | null, metadata: Metadata, jobId?: string): Promise<void> => {
    try {
        console.log("Starting tagging via Backend API...");

        // Optimize payload: if we have a jobId, the server already has the generated cover art.
        // We only send coverArt if it was manually changed (not a data:image URL from our server).
        const optimizedMetadata = { ...metadata };
        if (jobId && optimizedMetadata.coverArt?.startsWith('data:image')) {
            console.log("[TaggingService] Stripping redundant coverArt from payload for job tagging.");
            delete optimizedMetadata.coverArt;
        }

        const formData = new FormData();
        formData.append('metadata', JSON.stringify(optimizedMetadata));

        let response;
        if (jobId) {
            console.log(`[TaggingService] Attempting server-side tagging for Job: ${jobId}`);
            response = await fetch(getFullUrl(`/tag/job/${jobId}`), {
                method: 'POST',
                body: formData,
            });

            if (!response.ok && response.status === 410 && file) {
                console.warn("[TaggingService] Server-side file gone, falling back to local upload.");
                formData.set('metadata', JSON.stringify(metadata)); // Restore full metadata for local tagging
                formData.append('file', file);
                response = await fetch(getFullUrl('/tag/file'), {
                    method: 'POST',
                    body: formData,
                });
            }
        } else if (file) {
            formData.append('file', file);
            response = await fetch(getFullUrl('/tag/file'), {
                method: 'POST',
                body: formData,
            });
        }
        else {
            throw new Error("Source file or Job ID missing.");
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(err.detail || `Server error: ${response.status}`);
        }

        const blob = await response.blob();

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // Preserve extension and add prefix
        const ext = file.name.split('.').pop();
        const name = file.name.substring(0, file.name.lastIndexOf('.'));
        a.download = `[Tagged] ${name}.${ext}`;

        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
            URL.revokeObjectURL(url);
        }, 1000);

    } catch (e: any) {
        console.error("Embedding error:", e);
        let msg = e.message;
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            msg = "Połączenie z serwerem przerwane lub plik został zmieniony/usunięty na dysku. Spróbuj odświeżyć stronę.";
        } else if (e.name === 'NotReadableError') {
            msg = "Błąd uprawnień: przeglądarka straciła dostęp do pliku. Wybierz plik ponownie.";
        }
        throw new Error("Błąd podczas zapisywania pliku: " + msg);
    }
};
