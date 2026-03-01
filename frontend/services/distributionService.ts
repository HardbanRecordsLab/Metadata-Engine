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

/**
 * Handles CWR Export
 */
export const exportCWR = async (metadata: Metadata) => {
    const response = await fetch(getFullUrl('/cwr/export'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
    });

    if (!response.ok) throw new Error("Failed to generate CWR record");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Registration_${metadata.isrc || 'work'}.cwr`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
