
import { ACRCloudConfig, ACRResponse, Metadata } from '../../types';

const ACR_CONFIG_KEY = 'acr_config';

export const getSavedACRConfig = (): ACRCloudConfig | null => {
    const stored = localStorage.getItem(ACR_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
};

export const saveACRConfig = (config: ACRCloudConfig) => {
    localStorage.setItem(ACR_CONFIG_KEY, JSON.stringify(config));
};

// Helper to generate HMAC-SHA1 signature using Web Crypto API
async function hmacSha1(key: string, message: string): Promise<string> {
    const enc = new TextEncoder();
    const algorithm = { name: "HMAC", hash: "SHA-1" };
    const keyBuffer = await crypto.subtle.importKey("raw", enc.encode(key), algorithm, false, ["sign"]);
    const signature = await crypto.subtle.sign(algorithm.name, keyBuffer, enc.encode(message));

    // Convert ArrayBuffer to Base64 string
    const signatureArray = new Uint8Array(signature);
    let binary = '';
    for (let i = 0; i < signatureArray.length; i++) {
        binary += String.fromCharCode(signatureArray[i]);
    }
    return btoa(binary);
}

export const identifyTrack = async (file: File, config?: ACRCloudConfig): Promise<Metadata | null> => {
    // 1. Resolve Config: Passed > Saved > Window (Runtime) > Env (Build)
    const acr_win = (window as any);
    const activeConfig = config || getSavedACRConfig() || {
        host: acr_win.VITE_ACR_HOST || (import.meta as any).env.VITE_ACR_HOST || '',
        accessKey: acr_win.VITE_ACR_ACCESS_KEY || (import.meta as any).env.VITE_ACR_ACCESS_KEY || '',
        accessSecret: acr_win.VITE_ACR_ACCESS_SECRET || (import.meta as any).env.VITE_ACR_ACCESS_SECRET || ''
    };

    if (!activeConfig.accessKey || !activeConfig.accessSecret) {
        throw new Error("ACRCloud Configuration Missing. Please set VITE_ACR_ACCESS_KEY and VITE_ACR_ACCESS_SECRET.");
    }

    const { host, accessKey, accessSecret } = activeConfig;
    const method = 'POST';
    const uri = '/v1/identify';
    const data_type = 'audio';
    const signature_version = '1';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Generate Signature
    const stringToSign = [method, uri, accessKey, signature_version, timestamp].join('\n');
    const signature = await hmacSha1(accessSecret, stringToSign);

    // Slice Audio: Take first 1MB (approx 10-15s of standard quality audio is enough for identification)
    // ACRCloud supports raw file upload.
    const fileSize = file.size;
    const sliceSize = Math.min(1 * 1024 * 1024, fileSize); // 1MB limit to save bandwidth
    const fileSlice = file.slice(0, sliceSize);

    const formData = new FormData();
    formData.append('sample', fileSlice);
    formData.append('access_key', accessKey);
    formData.append('data_type', data_type);
    formData.append('signature_version', signature_version);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);

    try {
        // Note: ACRCloud Host must include protocol, e.g. https://identify-eu-west-1.acrcloud.com
        const protocolHost = host.startsWith('http') ? host : `https://${host}`;
        const response = await fetch(`${protocolHost}${uri}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`ACRCloud API Error (${response.status}): ${errText}`);
        }

        const rawData = await response.json();
        return mapACRToMetadata(rawData);
    } catch (error) {
        console.error("ACRCloud Identification Error:", error);
        throw error;
    }
};


export const mapACRToMetadata = (acrData: ACRResponse): Partial<Metadata> | null => {
    const music = acrData.metadata?.music?.[0];
    if (!music) return null;

    return {
        title: music.title,
        artist: music.artists?.map(a => a.name).join(', '),
        album: music.album?.name,
        year: music.date ? music.date.substring(0, 4) : undefined,
        publisher: music.label,
        isrc: music.external_ids?.isrc,
        // ACRCloud genres often need mapping, usually provides array
        mainGenre: music.genres?.[0]?.name,
        // Limit additional genres to 5
        additionalGenres: music.genres?.slice(1, 6).map(g => g.name) || [],
    };
};
