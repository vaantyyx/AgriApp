import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
router.use(authMiddleware);

// ─── GET /api/notifications ───────────────────────────────────────────────
// Returns the last 50 notifications for the authenticated user (producers only)
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const notifications = await db
      .collection('notifications')
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    res.json(notifications);
  } catch (err) {
    logger.error({ err }, 'GET NOTIFICATIONS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── PUT /api/notifications/read ─────────────────────────────────────────
// Marks all unread notifications as read for the authenticated user
router.put('/read', async (req, res) => {
  try {
    const db = getDb();
    await db.collection('notifications').updateMany(
      { userId: req.user.userId, read: false },
      { $set: { read: true } }
    );
    res.json({ message: 'Notifications marquées comme lues.' });
  } catch (err) {
    logger.error({ err }, 'MARK READ ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── PUT /api/notifications/:id/read ─────────────────────────────────────
// Marks a single notification as read (ownership enforced)
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID de notification invalide.' });
    }

    const db = getDb();
    const result = await db.collection('notifications').updateOne(
      { id, userId: req.user.userId }, // ownership check
      { $set: { read: true } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Notification introuvable.' });
    }

    res.json({ message: 'Notification marquée comme lue.' });
  } catch (err) {
    logger.error({ err }, 'MARK SINGLE READ ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
