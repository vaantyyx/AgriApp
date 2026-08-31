import express from 'express';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
router.use(authMiddleware);

// Device push tokens, one document per (userId, token). The unique index on
// `token` is created lazily on first write so a token that moves to another
// account just re-points instead of duplicating.
let indexReady = false;
async function pushTokens() {
  const col = getDb().collection('pushTokens');
  if (!indexReady) {
    await col.createIndex({ token: 1 }, { unique: true }).catch(() => {});
    await col.createIndex({ userId: 1 }).catch(() => {});
    indexReady = true;
  }
  return col;
}

// ─── POST /api/push/register ─────────────────────────────────────────────
// Body: { token: string, platform?: 'android' | 'ios' }
router.post('/register', async (req, res) => {
  const { token, platform } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token requis.' });
  }
  try {
    const col = await pushTokens();
    await col.updateOne(
      { token },
      {
        $set: {
          userId: req.user.userId,
          platform: platform || 'android',
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'PUSH REGISTER ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/push/unregister ──────────────────────────────────────────
// Call on logout so a shared device stops receiving the previous user's pushes.
router.post('/unregister', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token requis.' });
  try {
    const col = await pushTokens();
    await col.deleteOne({ token, userId: req.user.userId });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'PUSH UNREGISTER ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
