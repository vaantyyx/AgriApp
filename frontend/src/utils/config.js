// @ts-check
// Backend base URL — override via VITE_BACKEND_URL for non-local deployments.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001';

if (import.meta.env.PROD && !import.meta.env.VITE_BACKEND_URL) {
  console.warn('[Config] VITE_BACKEND_URL is not set — falling back to http://127.0.0.1:3001, which will not work in production.');
}
