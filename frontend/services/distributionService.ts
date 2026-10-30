import { Metadata } from '../types';
import { getFullUrl } from '../apiConfig';

/**
 * Handles DDEX ERN Export
 */
export const exportDDEX = async (metadata: Metadata, fileName: string) => {
    const response = await fetch(getFullUrl('/ddex/export'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
    });

    if (!response.ok) throw new Error("Failed to generate DDEX XML");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DDEX_${metadata.isrc || 'release'}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export interface CwrDownload { filename: string; submittable: boolean; missing: string }

/** Save a CWR response as a file; throws the server's own explanation (422: shares that do not add up, several writers without shares...). */
export async function saveCwr(response: Response, fallbackName: string): Promise<CwrDownload> {
    if (!response.ok) {
        let message = 'Failed to generate CWR record';
        try {
            const body = await response.json();
            const detail = body?.detail;
            message = Array.isArray(detail) ? detail.join(' ') : typeof detail === 'string' ? detail : message;
        } catch { /* not JSON: keep the generic message */ }
        throw new Error(message);
    }
    const disposition = response.headers.get('content-disposition') || '';
    const filename = (disposition.match(/filename="?([^";]+)"?/) || [])[1] || fallbackName;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { filename, submittable: response.headers.get('x-cwr-submittable') === 'true', missing: response.headers.get('x-cwr-missing') || '' };
}

/** The message to show after a CWR download: a draft says what a society still needs before it can accept the file. */
export const cwrNotice = (r: CwrDownload): { text: string; type: 'success' | 'info' } =>
    r.submittable
        ? { text: `CWR file ready: ${r.filename}`, type: 'success' }
        : { text: `Draft CWR file (${r.filename}). Not ready to send, a society still needs: ${r.missing}`, type: 'info' };

/**
 * Handles CWR Export
 */
export const exportCWR = async (metadata: Metadata) => {
    const response = await fetch(getFullUrl('/cwr/export'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
    });
    return saveCwr(response, `Registration_${metadata.isrc || 'work'}.cwr`);
};

/** CWR export of a finished analysis job. */
export const exportCWRForJob = async (url: string) => saveCwr(await fetch(url), 'registration.cwr');
