import express from 'express';
import rateLimit from 'express-rate-limit';
import { generateChallenge, getTile, renderTileSvg, verifySelection } from '../services/captchaService.js';

const router = express.Router();

const SUPPORTED_LOCALES = ['fr', 'en', 'ar'];
function resolveLocale(raw) {
  return SUPPORTED_LOCALES.includes(raw) ? raw : 'fr';
}

// Challenge issuance + answer verification: the security-relevant surface,
// rate-limited independently from the tile images (see below).
const challengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans une minute.' },
});

// A single grid render fires 9 of these (one per tile), so this needs a much
// more generous budget than the challenge/verify limiter above — these
// requests carry no information about the correct answer either way.
const imageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes.' },
});

// ─── GET /api/captcha/challenge ─────────────────────────────────────────────
router.get('/challenge', challengeLimiter, async (req, res) => {
  try {
    const locale = resolveLocale(req.query.locale);
    const challenge = await generateChallenge(locale);
    res.json(challenge);
  } catch (err) {
    console.error('[CAPTCHA CHALLENGE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/captcha/image/:challengeId/:index ─────────────────────────────
router.get('/image/:challengeId/:index', imageLimiter, async (req, res) => {
  try {
    const { challengeId, index } = req.params;
    const tile = await getTile(challengeId, index);
    if (!tile) {
      return res.status(404).end();
    }
    const svg = renderTileSvg(tile.emoji, tile.color);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=180');
    res.send(svg);
  } catch (err) {
    console.error('[CAPTCHA IMAGE ERROR]', err.message);
    res.status(500).end();
  }
});

// ─── POST /api/captcha/verify ───────────────────────────────────────────────
router.post('/verify', challengeLimiter, async (req, res) => {
  try {
    const { challengeId, selected } = req.body;
    if (typeof challengeId !== 'string' || !Array.isArray(selected)) {
      return res.status(400).json({ success: false, error: 'Données invalides.', reason: 'invalid' });
    }

    const result = await verifySelection(challengeId, selected);
    if (!result.success) {
      const error = result.reason === 'expired'
        ? 'Le CAPTCHA a expiré ou a déjà été utilisé. Un nouveau a été généré.'
        : 'Sélection incorrecte. Un nouveau CAPTCHA a été généré.';
      return res.json({ success: false, error, reason: result.reason });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[CAPTCHA VERIFY ERROR]', err.message);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

export default router;
