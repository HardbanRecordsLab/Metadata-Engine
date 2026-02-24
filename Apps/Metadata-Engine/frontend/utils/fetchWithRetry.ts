
/**
 * Utility for fetching with exponential backoff retry logic.
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<Response> {
    let lastError: any;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            const response = await fetch(url, options);

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
            lastError = err;
            if (i < maxRetries) {
                const delay = initialDelay * Math.pow(2, i);
                console.warn(`Fetch error: ${err}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }

    throw lastError || new Error(`Failed to fetch after ${maxRetries} retries.`);
}
