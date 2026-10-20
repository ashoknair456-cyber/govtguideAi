// Single source of truth for the backend API base URL.
// - Development: defaults to the relative "/api" path, proxied to the backend by Vite
//   (see frontend/vite.config.js). No hardcoded host/port needed.
// - Production: set VITE_API_URL at build time (e.g. "https://api.example.com/api")
//   or leave it as "/api" when the frontend and backend share an origin behind a
//   reverse proxy. Never ship a "localhost" URL to production.
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export const apiUrl = (endpoint = '') => `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('govguide_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(apiUrl(endpoint), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};
