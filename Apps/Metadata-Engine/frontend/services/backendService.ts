
import { Metadata } from '../types';
import { getFullUrl } from '../apiConfig';

export const backendService = {
    async checkHealth(): Promise<boolean> {
        try {
            const res = await fetch(getFullUrl('/'));
            const data = await res.json();
            return data.status === 'MME Worker Online';
        } catch (e) {
            console.error('Backend health check failed', e);
            return false;
        }
    },

    async tagFlac(file: File, metadata: Partial<Metadata>): Promise<Blob> {
        const formData = new FormData();
        formData.append('file', file);
        if (metadata.title) formData.append('title', metadata.title);
        if (metadata.artist) formData.append('artist', metadata.artist);
        if (metadata.album) formData.append('album', metadata.album);
        if (metadata.mainGenre) formData.append('genre', metadata.mainGenre);
        if (metadata.year) formData.append('date', metadata.year);
        if (metadata.bpm) formData.append('bpm', metadata.bpm.toString());
        if (metadata.key) formData.append('key', metadata.key);

        const res = await fetch(getFullUrl('/tag/flac'), {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            throw new Error(`Failed to tag FLAC: ${res.statusText}`);
        }

        return await res.blob();
    },

    async tagWav(file: File, metadata: Partial<Metadata>): Promise<Blob> {
        const formData = new FormData();
        formData.append('file', file);
        if (metadata.title) formData.append('title', metadata.title);
        if (metadata.artist) formData.append('artist', metadata.artist);
        if (metadata.album) formData.append('album', metadata.album);

        const res = await fetch(getFullUrl('/tag/wav'), {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            throw new Error(`Failed to tag WAV: ${res.statusText}`);
        }

        return await res.blob();
    },

    async generateHash(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(getFullUrl('/generate/hash'), {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('Failed to generate hash');
        const data = await res.json();
        return data.sha256;
    },

    async generateCertificate(metadata: Metadata, sha256: string, filename: string, jobId?: string): Promise<{ ipfs_hash: string; ipfs_url: string; timestamp: string }> {
        const res = await fetch(getFullUrl('/generate/certificate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metadata, sha256, filename, job_id: jobId }),
        });
        if (!res.ok) throw new Error('Failed to generate certificate');
        return await res.json();
    },

    getExportCsvUrl(jobId: string): string {
        return getFullUrl(`/export/csv/${jobId}`);
    },

    getExportJsonUrl(jobId: string): string {
        return getFullUrl(`/export/json/${jobId}`);
    },

    getExportDdexUrl(jobId: string): string {
        return getFullUrl(`/export/ddex/${jobId}`);
    },

    getExportCwrUrl(jobId: string): string {
        return getFullUrl(`/export/cwr/${jobId}`);
    }
};
