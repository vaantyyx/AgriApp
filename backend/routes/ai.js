import express from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
router.use(authMiddleware);

// Chat abuse guard — separate from (and stricter than) the general /api limiter.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages envoyés. Réessayez dans une minute.' },
});

const SYSTEM_PROMPT = "Tu es l'assistant IA de Sougra, une plateforme algérienne de vente directe de produits agricoles entre producteurs et acheteurs (enchères inversées, parcelles, météo, calendrier cultural). Réponds de façon claire, concise et utile, dans la langue du message de l'utilisateur.";

// ─── POST /api/ai/chat ──────────────────────────────────────────────────────
// Uses Groq (free tier, OpenAI-compatible chat completions API) — the
// request/response shape exposed to the frontend stays the same regardless
// of provider, so swapping again later only touches this file.
router.post('/chat', aiLimiter, async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Assistant IA non configuré sur le serveur." });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages requis.' });
  }
  if (messages.length > 20) {
    return res.status(400).json({ error: 'Conversation trop longue.' });
  }

  // Only role/content from user & assistant turns are forwarded, each capped in
  // length — the client-supplied array is never trusted beyond that (no system
  // role, no arbitrary fields reach the Groq request).
  const safeMessages = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));

  if (safeMessages.length === 0) {
    return res.status(400).json({ error: 'Messages requis.' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logger.error({ status: response.status, body: errBody }, 'Groq API error');
      return res.status(502).json({ error: "Erreur de l'assistant IA. Veuillez réessayer." });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: "Réponse invalide de l'assistant IA." });
    }

    res.json({ reply });
  } catch (err) {
    logger.error({ err }, 'AI CHAT ERROR');
    res.status(502).json({ error: "Échec de la connexion à l'assistant IA." });
  }
});

export default router;
