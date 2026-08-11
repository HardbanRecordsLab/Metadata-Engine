import { backendService } from './backendService';
import { getFullUrl } from '../apiConfig';

/**
 * Calculates SHA-256 hash of a file.
 * Prioritizes backend calculation if available, falls back to local.
 */
export const calculateFileHash = async (file: File): Promise<string> => {
    try {
        // Attempt backend hashing first (it's consistent and server-verified)
        return await backendService.generateHash(file);
    } catch (e) {
        console.warn("Backend hashing failed, falling back to local:", e);

        if (!window.crypto || !window.crypto.subtle) {
            throw new Error("Cryptography API not available. Use HTTPS or localhost.");
        }

        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

const getAuthHeaders = () => {
    const token = localStorage.getItem('hrl_sso_token_v3') || localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Pins an already-saved certificate's PDF to IPFS via the backend (Pinata)
 * and returns the resulting content-addressed hash/url.
 */
export const pinCertificateToIPFS = async (certificateId: string): Promise<{ ipfs_hash: string; ipfs_url: string }> => {
    const res = await fetch(getFullUrl(`/certificate/${certificateId}/pin-ipfs`), {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        credentials: 'include',
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(`Failed to parse IPFS pin response: ${text.substring(0, 100)}`);
    }
    if (!res.ok) throw new Error(data.detail || 'Failed to pin certificate to IPFS');
    return { ipfs_hash: data.ipfs_hash, ipfs_url: data.ipfs_url };
};
