import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit };
}

// ─── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    const [totalUsers, buyerCount, producerCount, openAuctions, closedAuctions, deactivatedUsers] = await Promise.all([
      db.collection('users').countDocuments({}),
      db.collection('users').countDocuments({ role: 'buyer' }),
      db.collection('users').countDocuments({ role: 'producer' }),
      db.collection('auctions').countDocuments({ status: 'open' }),
      db.collection('auctions').countDocuments({ status: 'closed' }),
      db.collection('users').countDocuments({ isActive: false }),
    ]);
    res.json({ totalUsers, buyerCount, producerCount, openAuctions, closedAuctions, deactivatedUsers });
  } catch (err) {
    logger.error({ err }, 'ADMIN STATS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/users ────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const db = getDb();
    const { page, limit } = parsePagination(req.query);
    const search = String(req.query.search || '').trim().slice(0, 100);

    const filter = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      db.collection('users')
        .find(filter, { projection: { password: 0, verificationToken: 0, resetPasswordToken: 0 } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('users').countDocuments(filter),
    ]);

    res.json({
      users: users.map(u => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        isVerified: !!u.isVerified,
        isActive: u.isActive !== false,
        wilaya: u.wilaya || '',
        createdAt: u.createdAt,
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN LIST USERS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/admin/users/:id/deactivate ───────────────────────────────────
router.post('/users/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });
    if (id === req.user.userId) return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });

    const result = await getDb().collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isActive: false, deactivatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ message: 'Compte désactivé.' });
  } catch (err) {
    logger.error({ err }, 'ADMIN DEACTIVATE USER ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/admin/users/:id/reactivate ───────────────────────────────────
router.post('/users/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const result = await getDb().collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isActive: true }, $unset: { deactivatedAt: '' } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ message: 'Compte réactivé.' });
  } catch (err) {
    logger.error({ err }, 'ADMIN REACTIVATE USER ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/auctions ─────────────────────────────────────────────────
router.get('/auctions', async (req, res) => {
  try {
    const db = getDb();
    const { page, limit } = parsePagination(req.query);

    const [auctions, total] = await Promise.all([
      db.collection('auctions')
        .find({}, { projection: { id: 1, title: 1, product: 1, status: 1, buyerName: 1, createdAt: 1, bids: 1 } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('auctions').countDocuments({}),
    ]);

    res.json({
      auctions: auctions.map(a => ({
        id: a.id,
        title: a.title || a.product,
        status: a.status,
        buyerName: a.buyerName,
        bidsCount: (a.bids || []).length,
        createdAt: a.createdAt,
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN LIST AUCTIONS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
