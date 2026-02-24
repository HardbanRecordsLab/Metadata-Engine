import { backendService } from './backendService';
import { Metadata } from '../types';

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

/**
 * Generates and downloads the premium HTML certificate via backend.
 */
/**
 * Generates the certificate on the backend, which uploads to IPFS (Pinata) 
 * and returns the secure hash/url.
 */
export const pinCertificateToIPFS = async (metadata: Metadata, hash: string, fileName: string, jobId?: string): Promise<{ ipfs_hash: string; ipfs_url: string }> => {
    try {
        const result = await backendService.generateCertificate(metadata, hash, fileName, jobId);
        return { ipfs_hash: result.ipfs_hash, ipfs_url: result.ipfs_url };
    } catch (e) {
        console.error("IPFS pinning failed", e);
        throw e;
    }
};

/**
 * For preview/download, we now use the frontend viewer. 
 * This function can return the data or allow client-side handling.
 */
export const generateCertificate = async (metadata: Metadata, hash: string, fileName: string) => {
    // Legacy support: The new flow uses the Viewer component. 
    // We can trigger the backend generation (IPFS upload) here too if desired,
    // or just return success.
    return await pinCertificateToIPFS(metadata, hash, fileName);
};

export const getCertificateContent = async (metadata: Metadata, hash: string, fileName: string): Promise<any> => {
    // Preview is now client-side, this is just a stub or could fetch existing IPFS data if needed
    return "";
};
