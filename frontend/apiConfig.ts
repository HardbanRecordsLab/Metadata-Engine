/**
 * Central API configuration for Music Metadata Engine.
 * Handles environment-specific routing for both local development and Hugging Face deployment.
 */

// In production (HF), we serve the API from the /api prefix on the same host
// In development, Vite proxes /api to http://localhost:8888/api
export const API_BASE_URL = '/api';

// For WebSocket connections, we need the absolute URL or a relative path that works
export const getWsUrl = (path: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // If we are on Hugging Face (or any host that is not localhost)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Relative to current host, adding /api prefix
    return `${protocol}//${window.location.host}${API_BASE_URL}${path}`;
  }
  
  // Local development fallback
  return `${protocol}//localhost:8888/api${path}`;
};

export const getFullUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // If we are on Hugging Face (or any host that is not localhost)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Use the same host
    return `${API_BASE_URL}${cleanPath}`;
  }
  
  // Local development fallback for when Fetch is used without proxy
  // (though proxy in vite.config.ts is better)
  return `http://localhost:8888/api${cleanPath}`;
};
