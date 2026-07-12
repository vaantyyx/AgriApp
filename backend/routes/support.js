import express from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/authMiddleware.js';
import { sendSupportMessage } from '../services/emailService.js';
import { resolveLocale } from '../utils/locale.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
router.use(authMiddleware);

// Support inbox abuse guard — separate from (and stricter than) the general /api limiter.
const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages envoyés. Réessayez plus tard.' },
});

// ─── POST /api/support/contact ─────────────────────────────────────────────
router.post('/contact', supportLimiter, async (req, res) => {
  try {
    const { name, subject, message, locale } = req.body;

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ error: 'Sujet requis.' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message requis.' });
    }
    if (message.trim().length > 5000) {
      return res.status(400).json({ error: 'Message trop long (5000 caractères maximum).' });
    }

    const safeName = String(name || '').trim().slice(0, 100) || 'Utilisateur Sougra';
    const safeSubject = subject.trim().slice(0, 200);
    const safeMessage = message.trim().slice(0, 5000);

    // req.user.email comes from the verified JWT, not the request body — it cannot be spoofed.
    await sendSupportMessage(safeName, req.user.email, safeSubject, safeMessage, resolveLocale(locale));

    res.json({ message: 'Votre message a été envoyé avec succès.' });
  } catch (err) {
    logger.error({ err }, 'SUPPORT CONTACT ERROR');
    res.status(502).json({ error: "Échec de l'envoi du message. Veuillez réessayer plus tard." });
  }
});

export default router;
