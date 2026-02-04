import { ID3Writer } from 'browser-id3-writer';

/**
 * Professional Browser-Side Tagging Service
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
        } else {
            console.warn('Format unsupported for tagging, falling back to clean download.');
            forceDownload(new Blob([fileBuffer]), file.name);
        }
    } catch (error) {
        console.error('❌ Tagging failed:', error);
        forceDownload(new Blob([fileBuffer]), file.name);
    }
};

async function setupWriter(writer: any, metadata: any, coverArtUrl?: string | null) {
    const toStr = (val: any) => {
        if (Array.isArray(val)) return val.join(', ');
        return val ? String(val) : '';
    };

    // 1. Core Identity
    if (metadata.title) writer.setFrame('TIT2', toStr(metadata.title));
    if (metadata.artist) writer.setFrame('TPE1', [toStr(metadata.artist)]);
    if (metadata.album) writer.setFrame('TALB', toStr(metadata.album));
    if (metadata.year) writer.setFrame('TYER', toStr(metadata.year).substring(0, 4));
    if (metadata.trackNumber) writer.setFrame('TRCK', toStr(metadata.trackNumber));
    if (metadata.bpm) writer.setFrame('TBPM', toStr(Math.round(metadata.bpm)));

    // 2. Tonality & Mood
    if (metadata.key) writer.setFrame('TXXX', { description: 'INITIALKEY', value: toStr(metadata.key) });
    if (metadata.mainGenre) writer.setFrame('TCON', [toStr(metadata.mainGenre)]);
    if (metadata.moods) writer.setFrame('TXXX', { description: 'Mood', value: toStr(metadata.moods) });
    if (metadata.energyLevel) writer.setFrame('TXXX', { description: 'Energy Level', value: toStr(metadata.energyLevel) });

    // 3. Credits & Legal
    if (metadata.isrc) writer.setFrame('TSRC', toStr(metadata.isrc));
    if (metadata.publisher) writer.setFrame('TPUB', toStr(metadata.publisher));
    if (metadata.copyright) writer.setFrame('TCOP', toStr(metadata.copyright));
    if (metadata.composer) writer.setFrame('TCOM', [toStr(metadata.composer)]);
    if (metadata.trackDescription) {
        writer.setFrame('COMM', { description: 'Track Description', text: toStr(metadata.trackDescription), language: 'eng' });
    }

    // 4. Artwork
    if (coverArtUrl) {
        try {
            const resp = await fetch(coverArtUrl);
            const imgBuffer = await resp.arrayBuffer();
            writer.setFrame('APIC', { type: 3, data: imgBuffer, description: 'Cover' });
        } catch (e) {
            console.warn('Artwork integration failed, proceeding without cover.');
        }
    }
}

async function tagMp3(file: File, buffer: ArrayBuffer, metadata: any, coverArtUrl?: string | null) {
    const writer = new ID3Writer(buffer);
    await setupWriter(writer, metadata, coverArtUrl);
    writer.addTag();
    const taggedBuffer = writer.arrayBuffer;
    forceDownload(new Blob([taggedBuffer], { type: 'audio/mpeg' }), `[STAMPED] ${file.name}`);
}

async function tagWav(file: File, buffer: ArrayBuffer, metadata: any, coverArtUrl?: string | null) {
    const emptyBuff = new ArrayBuffer(0);
    const writer = new ID3Writer(emptyBuff);
    await setupWriter(writer, metadata, coverArtUrl);
    writer.addTag();
    const id3Tag = writer.getUint8Array();

    const original = new Uint8Array(buffer);
    const id3Header = new Uint8Array(8);
    id3Header[0] = 0x69; id3Header[1] = 0x64; id3Header[2] = 0x33; id3Header[3] = 0x20; // "id3 "

    const dv = new DataView(id3Header.buffer);
    dv.setUint32(4, id3Tag.length, true);

    const padding = id3Tag.length % 2 === 0 ? 0 : 1;
    const finalBuffer = new Uint8Array(original.length + 8 + id3Tag.length + padding);

    finalBuffer.set(original, 0);
    finalBuffer.set(id3Header, original.length);
    finalBuffer.set(id3Tag, original.length + 8);

    const riffView = new DataView(finalBuffer.buffer);
    riffView.setUint32(4, finalBuffer.length - 8, true);

    forceDownload(new Blob([finalBuffer], { type: 'audio/wav' }), `[STAMPED] ${file.name}`);
}

function forceDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);

    // Use a small timeout to ensure the browser registers the click
    setTimeout(() => {
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }, 100);
}
