
/**
 * Utility for fetching with exponential backoff retry logic.
 * `timeoutMs` bounds each individual attempt (not the whole retry sequence) —
 * without it, a stalled connection would hang indefinitely since fetch()
 * has no built-in timeout.
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3,
    initialDelay: number = 1000,
    timeoutMs: number = 120000
): Promise<Response> {
    let lastError: any;

    // Automatic Authorization Header Injection
    const token = localStorage.getItem('hrl_sso_token_v3') || localStorage.getItem('access_token');
    const headers = (options.headers || {}) as Record<string, string>;

    if (token && !headers['Authorization']) {
        options.headers = {
            ...headers,
            'Authorization': `Bearer ${token}`
        };
    }

    for (let i = 0; i <= maxRetries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: options.signal ?? controller.signal });
            clearTimeout(timeoutId);

            // If response is a 5xx error or 429 (Too Many Requests), retry
            if (response.status >= 500 || response.status === 429) {
                if (i < maxRetries) {
                    const delay = initialDelay * Math.pow(2, i);
                    console.warn(`Fetch failed with status ${response.status}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }

            return response;
        } catch (err) {
            clearTimeout(timeoutId);
            lastError = err instanceof Error && err.name === 'AbortError'
                ? new Error(`Request timed out after ${timeoutMs}ms: ${url}`)
                : err;
            if (i < maxRetries) {
                const delay = initialDelay * Math.pow(2, i);
                console.warn(`Fetch error: ${lastError}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }

    throw lastError || new Error(`Failed to fetch after ${maxRetries} retries.`);
}
