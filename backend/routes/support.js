import express from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/authMiddleware.js';
import { sendSupportMessage } from '../services/emailService.js';
import { resolveLocale } from '../utils/locale.js';
import { logger } from '../utils/logger.js';
import { getRateLimitStore } from '../utils/rateLimitStore.js';
import { getDb } from '../db.js';

const router = express.Router();
router.use(authMiddleware);

// Support inbox abuse guard — separate from (and stricter than) the general /api limiter.
const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages envoyés. Réessayez plus tard.' },
  store: getRateLimitStore('rl:support:'),
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
    const safeLocale = resolveLocale(locale);

    // Persisted first so the message is never lost even if the email below
    // fails — it's now the source of truth (visible in the admin dashboard),
    // the email is just a best-effort heads-up.
    // req.user.email comes from the verified JWT, not the request body — it cannot be spoofed.
    await getDb().collection('supportMessages').insertOne({
      userId: req.user.userId,
      name: safeName,
      email: req.user.email,
      subject: safeSubject,
      message: safeMessage,
      locale: safeLocale,
      status: 'open',
      createdAt: new Date(),
    });

    try {
      await sendSupportMessage(safeName, req.user.email, safeSubject, safeMessage, safeLocale);
    } catch (emailErr) {
      logger.error({ err: emailErr }, 'SUPPORT EMAIL NOTIFY FAILED (message was still saved)');
    }

    res.json({ message: 'Votre message a été envoyé avec succès.' });
  } catch (err) {
    logger.error({ err }, 'SUPPORT CONTACT ERROR');
    res.status(500).json({ error: "Échec de l'envoi du message. Veuillez réessayer plus tard." });
  }
});

export default router;
