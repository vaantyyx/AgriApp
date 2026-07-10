// Backend base URL — override via VITE_BACKEND_URL for non-local deployments.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001';
