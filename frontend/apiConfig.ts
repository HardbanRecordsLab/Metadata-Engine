/**
 * Central API configuration for Music Metadata Engine.
 * Handles environment-specific routing for both local development and Hugging Face deployment.
 */

// Allow overriding API URL via environment variable
const ENV_API_URL = import.meta.env.VITE_API_URL;

// In production (HF), we serve the API from the /api prefix on the same host
// In development, Vite proxes /api to http://localhost:8888/api
export const API_BASE_URL = ENV_API_URL || '/api';

// For WebSocket connections, we need the absolute URL or a relative path that works
export const getWsUrl = (path: string) => {
  const isAbsolute = ENV_API_URL && (ENV_API_URL.startsWith('http://') || ENV_API_URL.startsWith('https://'));

  if (isAbsolute) {
    const protocol = ENV_API_URL!.startsWith('https') ? 'wss:' : 'ws:';
    const host = ENV_API_URL!.replace(/^https?:\/\//, '');
    return `${protocol}//${host}${path}`;
  }

  // Handle relative ENV_API_URL or fallback to relative window location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const apiBase = ENV_API_URL || '/api';

  // If we are on a real host
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${protocol}//${window.location.host}${apiBase}${path}`;
  }

  // Local development fallback
  return `${protocol}//localhost:8888${apiBase}${path}`;
};

export const getFullUrl = (path: string) => {
  if (path.startsWith('http')) return path;

  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Use explicit API URL if configured (bypasses Vercel proxy)
  if (ENV_API_URL) {
    // Remove trailing slash from base if present
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    return `${base}${cleanPath}`;
  }

  // If we are on Hugging Face (or any host that is not localhost)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Use the same host
    return `${API_BASE_URL}${cleanPath}`;
  }

  // Local development fallback for when Fetch is used without proxy
  // (though proxy in vite.config.ts is better)
  return `http://localhost:8888/api${cleanPath}`;
};
