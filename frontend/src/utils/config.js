// @ts-check
// Backend base URL — override via VITE_BACKEND_URL if the API lives on a
// different origin than the site itself (e.g. frontend on Vercel, backend
// elsewhere). Unset in production defaults to the page's own origin, which
// is correct when Nginx serves both the static site and proxies /api and
// /socket.io to the backend — the standard setup in this repo's docker-compose.yml.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
  || (import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3001');
