import { BACKEND_URL } from './config.js';

// Anonymous site-visit counter (admin dashboard stats) — only ever called once
// cookie consent is 'accepted' (CookieConsent.jsx), and once per tab session.
export function trackVisit() {
  if (sessionStorage.getItem('sougra_visit_tracked')) return;
  if (localStorage.getItem('sougra_cookie_consent') !== 'accepted') return;
  sessionStorage.setItem('sougra_visit_tracked', '1');
  fetch(`${BACKEND_URL}/api/track-visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: window.location.pathname }),
  }).catch(() => { /* best-effort — never blocks the app */ });
}
