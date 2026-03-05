import { ID3Writer } from 'browser-id3-writer';

/**
 * Professional Browser-Side Tagging Service
 * Writes a comprehensive set of ID3v2.3 frames for MP3 and WAV files.
 */

export const tagInBrowser = async (file: File, metadata: any, coverArtUrl?: string | null): Promise<void> => {
    console.log('🚀 Browser-side tagging started for:', file.name);
    const fileBuffer = await file.arrayBuffer();
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    try {
        if (fileExt === 'mp3') {
            await tagMp3(file, fileBuffer, metadata, coverArtUrl);
        } else if (fileExt === 'wav') {
            await tagWav(file, fileBuffer, metadata, coverArtUrl);
        } else if (fileExt === 'flac') {
            // FLAC: no browser-side library — send to server; fallback: clean download
            console.warn('FLAC browser-side tagging not supported. Downloading untagged.');
            forceDownload(new Blob([fileBuffer], { type: 'audio/flac' }), file.name);
        } else {
            console.warn('Unsupported format for browser tagging.');
            forceDownload(new Blob([fileBuffer]), file.name);
        }
    } catch (error) {
        console.error('❌ Tagging failed:', error);
        forceDownload(new Blob([fileBuffer]), file.name);
    }
};

// ── SHARED WRITER SETUP ───────────────────────────────────────

async function setupWriter(writer: any, metadata: any, coverArtUrl?: string | null) {
    const toStr = (val: any): string => {
        if (val === null || val === undefined) return '';
        if (Array.isArray(val)) return val.join(', ');
        return String(val).trim();
    };

    const toStrArr = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String);
        return [String(val)];
    };

    // ── 1. Core Identity ─────────────────────────────────────
    if (metadata.title)      writer.setFrame('TIT2', toStr(metadata.title));
    if (metadata.artist)     writer.setFrame('TPE1', toStrArr(metadata.artist));
    if (metadata.albumArtist)writer.setFrame('TPE2', [toStr(metadata.albumArtist)]);
    if (metadata.album)      writer.setFrame('TALB', toStr(metadata.album));

    const year = toStr(metadata.year).substring(0, 4);
    if (year) {
        writer.setFrame('TYER', year);  // ID3v2.3
        writer.setFrame('TDRC', year);  // ID3v2.4 compat
    }

    if (metadata.track) writer.setFrame('TRCK', String(metadata.track));

    // ── 2. Technical ─────────────────────────────────────────
    if (metadata.bpm) writer.setFrame('TBPM', String(Math.round(Number(metadata.bpm))));
    if (metadata.language) writer.setFrame('TLAN', toStr(metadata.language).substring(0, 3).toLowerCase());

    // Initial Key (standard frame TKEY)
    if (metadata.key) {
        const keyStr = [metadata.key, metadata.mode].filter(Boolean).join(' ');
        writer.setFrame('TKEY', keyStr);
        writer.setFrame('TXXX', { description: 'INITIALKEY', value: keyStr });
    }

    // ── 3. Genre & Mood ───────────────────────────────────────
    if (metadata.mainGenre) writer.setFrame('TCON', toStrArr(metadata.mainGenre));

    // Mood (TMOO is ID3v2.4; also write as TXXX for compatibility)
    const moodStr = toStr(metadata.moods);
    if (moodStr) {
        writer.setFrame('TXXX', { description: 'MOOD', value: moodStr });
        writer.setFrame('TXXX', { description: 'MOODS', value: moodStr });
    }

    if (metadata.energyLevel || metadata.energy_level) {
        writer.setFrame('TXXX', { description: 'ENERGY', value: toStr(metadata.energyLevel || metadata.energy_level) });
    }

    // ── 4. Credits ────────────────────────────────────────────
    if (metadata.composer)    writer.setFrame('TCOM', toStrArr(metadata.composer));
    if (metadata.lyricist)    writer.setFrame('TEXT', toStrArr(metadata.lyricist));
    if (metadata.publisher)   writer.setFrame('TPUB', toStr(metadata.publisher));
    if (metadata.producer)    writer.setFrame('TXXX', { description: 'PRODUCER', value: toStr(metadata.producer) });

    // ── 5. Legal & Rights ────────────────────────────────────
    if (metadata.copyright)   writer.setFrame('TCOP', toStr(metadata.copyright));
    if (metadata.pLine)       writer.setFrame('TXXX', { description: 'P_LINE', value: toStr(metadata.pLine) });
    if (metadata.isrc)        writer.setFrame('TSRC', toStr(metadata.isrc));
    if (metadata.iswc)        writer.setFrame('TXXX', { description: 'ISWC', value: toStr(metadata.iswc) });
    if (metadata.upc)         writer.setFrame('TXXX', { description: 'UPC', value: toStr(metadata.upc) });
    if (metadata.catalogNumber)writer.setFrame('TXXX', { description: 'CATALOGNUMBER', value: toStr(metadata.catalogNumber) });
    if (metadata.license)     writer.setFrame('TXXX', { description: 'LICENSE', value: toStr(metadata.license) });

    // ── 6. Extended Metadata ──────────────────────────────────
    if (metadata.additionalGenres?.length) writer.setFrame('TXXX', { description: 'SUBGENRE', value: toStr(metadata.additionalGenres) });
    if (metadata.instrumentation?.length)  writer.setFrame('TXXX', { description: 'INSTRUMENTATION', value: toStr(metadata.instrumentation) });
    if (metadata.mainInstrument)           writer.setFrame('TXXX', { description: 'MAIN_INSTRUMENT', value: toStr(metadata.mainInstrument) });
    if (metadata.useCases?.length)         writer.setFrame('TXXX', { description: 'USAGE', value: toStr(metadata.useCases) });
    if (metadata.keywords?.length)         writer.setFrame('TXXX', { description: 'KEYWORDS', value: toStr(metadata.keywords) });
    if (metadata.musicalEra)               writer.setFrame('TXXX', { description: 'MUSICAL_ERA', value: toStr(metadata.musicalEra) });
    if (metadata.productionQuality)        writer.setFrame('TXXX', { description: 'PRODUCTION_QUALITY', value: toStr(metadata.productionQuality) });
    if (metadata.targetAudience)           writer.setFrame('TXXX', { description: 'TARGET_AUDIENCE', value: toStr(metadata.targetAudience) });
    if (metadata.tempoCharacter)           writer.setFrame('TXXX', { description: 'TEMPO_CHARACTER', value: toStr(metadata.tempoCharacter) });
    if (metadata.dynamics)                 writer.setFrame('TXXX', { description: 'DYNAMICS', value: toStr(metadata.dynamics) });
    if (metadata.sha256)                   writer.setFrame('TXXX', { description: 'SHA256', value: toStr(metadata.sha256) });
    if (metadata.explicitContent)          writer.setFrame('TXXX', { description: 'EXPLICIT_CONTENT', value: toStr(metadata.explicitContent) });
    if (metadata.fileOwner)                writer.setFrame('TXXX', { description: 'FILE_OWNER', value: toStr(metadata.fileOwner) });
    if (metadata.acousticScore != null)    writer.setFrame('TXXX', { description: 'ACOUSTIC_SCORE', value: toStr(metadata.acousticScore) });
    if (metadata.dynamicRange != null)     writer.setFrame('TXXX', { description: 'DYNAMIC_RANGE', value: toStr(metadata.dynamicRange) });
    if (metadata.spectralCentroid != null) writer.setFrame('TXXX', { description: 'SPECTRAL_CENTROID', value: toStr(metadata.spectralCentroid) });
    if (metadata.spectralRolloff != null)  writer.setFrame('TXXX', { description: 'SPECTRAL_ROLLOFF', value: toStr(metadata.spectralRolloff) });
    if (metadata.hasVocals != null)        writer.setFrame('TXXX', { description: 'HAS_VOCALS', value: toStr(metadata.hasVocals) });

    // ── 7. Description / Comment ─────────────────────────────
    if (metadata.trackDescription) {
        writer.setFrame('COMM', {
            description: 'Description',
            text: toStr(metadata.trackDescription),
            language: 'eng',
        });
    }

    // ── 8. Cover Art ─────────────────────────────────────────
    if (coverArtUrl) {
        try {
            // Support both remote URLs and data URIs
            let imgBuffer: ArrayBuffer;
            if (coverArtUrl.startsWith('data:')) {
                const base64 = coverArtUrl.split(',')[1];
                const binary = atob(base64);
                imgBuffer = new ArrayBuffer(binary.length);
                const view = new Uint8Array(imgBuffer);
                for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
            } else {
                const resp = await fetch(coverArtUrl);
                imgBuffer = await resp.arrayBuffer();
            }
            writer.setFrame('APIC', { type: 3, data: imgBuffer, description: 'Cover' });
        } catch (e) {
            console.warn('Artwork integration failed, proceeding without cover.');
        }
    }
}

// ── FORMAT-SPECIFIC WRITERS ───────────────────────────────────

async function tagMp3(file: File, buffer: ArrayBuffer, metadata: any, coverArtUrl?: string | null) {
    const writer = new ID3Writer(buffer);
    await setupWriter(writer, metadata, coverArtUrl);
    writer.addTag();
    forceDownload(new Blob([writer.arrayBuffer], { type: 'audio/mpeg' }), `[STAMPED] ${file.name}`);
}

async function tagWav(file: File, buffer: ArrayBuffer, metadata: any, coverArtUrl?: string | null) {
    // Build ID3 tag into empty buffer then append as ID3 chunk in WAV
    const emptyBuff = new ArrayBuffer(0);
    const writer = new ID3Writer(emptyBuff);
    await setupWriter(writer, metadata, coverArtUrl);
    writer.addTag();
    const id3Tag = writer.getUint8Array();

    const original = new Uint8Array(buffer);
    // WAV id3 chunk header: "id3 " + 4-byte little-endian size
    const id3Header = new Uint8Array(8);
    id3Header[0] = 0x69; id3Header[1] = 0x64; id3Header[2] = 0x33; id3Header[3] = 0x20; // "id3 "
    const dv = new DataView(id3Header.buffer);
    dv.setUint32(4, id3Tag.length, true);

    const padding = id3Tag.length % 2 === 0 ? 0 : 1;
    const finalBuffer = new Uint8Array(original.length + 8 + id3Tag.length + padding);
    finalBuffer.set(original, 0);
    finalBuffer.set(id3Header, original.length);
    finalBuffer.set(id3Tag, original.length + 8);

    // Update RIFF chunk size
    const riffView = new DataView(finalBuffer.buffer);
    riffView.setUint32(4, finalBuffer.length - 8, true);

    forceDownload(new Blob([finalBuffer], { type: 'audio/wav' }), `[STAMPED] ${file.name}`);
}

// ── HELPER ────────────────────────────────────────────────────

function forceDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    setTimeout(() => {
        a.click();
        setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }, 100);
}
