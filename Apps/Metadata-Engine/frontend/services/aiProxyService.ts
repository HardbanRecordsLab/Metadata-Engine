import { getFullUrl } from '../apiConfig';

const wait = (ms: number) => {
    // @ts-ignore
    if (import.meta.env?.MODE === 'test') return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
};

const callProxyEndpoint = async (provider: string, payload: any): Promise<any> => {
    const token = localStorage.getItem('access_token') || "";

    const response = await fetch(getFullUrl('/ai/proxy'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ provider, payload })
    });

    if (response.status === 429) throw new Error("429");
    if (response.status === 503) throw new Error("503");
    if (response.status === 404 || response.status === 500) throw new Error("PROXY_UNAVAILABLE");
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Proxy call failed");
    }
    return response.json();
};

/**
 * Robust AI API Caller using Backend Proxy (Zero-Knowledge Frontend)
 */
export const callAIProxy = async (provider: string, payload: any, retries = 2): Promise<any> => {
    // @ts-ignore
    if (import.meta.env?.MODE === 'development') {
        console.log(`[AI Proxy] ${provider} Request:`, payload);
    }

    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            return await callProxyEndpoint(provider, payload);
        } catch (error: any) {
            lastError = error;
            if (shouldRetry(error)) {
                await wait(2000 * (i + 1));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
};

const shouldRetry = (error: any): boolean => {
    return error.message === "429" || error.message === "503";
};

export const callSpotifyProxy = async (endpoint: string, method = 'GET', body?: any) => {
    // Spotify specifically uses its own router in backend/app/routes/spotify.py
    // We keep it separate for now or refactor to unified proxy later
    const response = await fetch(getFullUrl(`/spotify/${endpoint}`), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
};
