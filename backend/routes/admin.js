import express from 'express';
import bcrypt from 'bcryptjs';
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
    const [totalUsers, buyerCount, producerCount, openAuctions, closedAuctions, deactivatedUsers, totalVisits, uniqueVisitorIps] = await Promise.all([
      db.collection('users').countDocuments({}),
      db.collection('users').countDocuments({ role: 'buyer' }),
      db.collection('users').countDocuments({ role: 'producer' }),
      db.collection('auctions').countDocuments({ status: 'open' }),
      db.collection('auctions').countDocuments({ status: 'closed' }),
      db.collection('users').countDocuments({ isActive: false }),
      db.collection('siteVisits').countDocuments({}),
      db.collection('siteVisits').distinct('ip'),
    ]);
    res.json({
      totalUsers, buyerCount, producerCount, openAuctions, closedAuctions, deactivatedUsers,
      totalVisits, uniqueVisitors: uniqueVisitorIps.filter(Boolean).length,
    });
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

// ─── GET /api/admin/users/:id ────────────────────────────────────────────────
// Full read-only profile — everything an admin might need to review, minus
// credentials/tokens (password hash and any active reset/verification tokens
// stay off the wire even for admins; they're never needed for viewing).
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const db = getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, verificationToken: 0, verificationExpires: 0, resetPasswordToken: 0, resetPasswordExpires: 0 } }
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const parcelles = user.role === 'producer'
      ? await db.collection('parcelles').find({ userId: id }).toArray()
      : [];

    // Every distinct IP this account has registered or logged in from, most
    // recently seen first — not the raw per-login log, which would just be
    // noisy repeats of the same handful of IPs.
    const loginIps = await db.collection('userLoginHistory').aggregate([
      { $match: { userId: id } },
      { $group: { _id: '$ip', count: { $sum: 1 }, firstSeen: { $min: '$createdAt' }, lastSeen: { $max: '$createdAt' } } },
      { $sort: { lastSeen: -1 } },
    ]).toArray();

    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      wilaya: user.wilaya || '',
      commune: user.commune || '',
      bio: user.bio || '',
      entity_type: user.entity_type || '',
      rc: user.rc || '',
      nif: user.nif || '',
      forme_juridique: user.forme_juridique || '',
      nom_commercial: user.nom_commercial || '',
      secteur_activite: user.secteur_activite || '',
      possede_transport: !!user.possede_transport,
      possede_chambre_froide: !!user.possede_chambre_froide,
      isVerified: !!user.isVerified,
      isActive: user.isActive !== false,
      deactivatedAt: user.deactivatedAt || null,
      two_factor_enabled: !!user.two_factor_enabled,
      profilePhoto: user.profilePhoto || null,
      rcDocument: user.rcDocument || null,
      ficheSignaletiqueDocument: user.ficheSignaletiqueDocument || null,
      carteAgriculteurDocument: user.carteAgriculteurDocument || null,
      averageRating: user.averageRating ?? null,
      ratingCount: user.ratingCount || 0,
      createdAt: user.createdAt,
      parcelles: parcelles.map(p => ({
        id: p._id.toString(),
        intitule: p.intitule || '',
        wilayaName: p.wilayaName || '',
        superficie: p.superficie ?? null,
        acquisitionDate: p.acquisitionDate || null,
        cultures: p.cultures || [],
        irrigationMethod: p.irrigationMethod || '',
        soilType: p.soilType || '',
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
      })),
      loginIps: loginIps.map(h => ({ ip: h._id, count: h.count, firstSeen: h.firstSeen, lastSeen: h.lastSeen })),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN GET USER ERROR');
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

// ─── POST /api/admin/users/:id/set-password ─────────────────────────────────
router.post('/users/:id/set-password', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const { password } = req.body;
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au minimum 8 caractères.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await getDb().collection('users').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { password: hashedPassword },
        // A pending self-service reset link for this user, if any, must not
        // survive an admin-set password — it would otherwise let the old link
        // silently overwrite the password the admin just set.
        $unset: { resetPasswordToken: '', resetPasswordExpires: '' },
      }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ message: 'Mot de passe modifié.' });
  } catch (err) {
    logger.error({ err }, 'ADMIN SET PASSWORD ERROR');
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

// ─── GET /api/admin/auctions/:id ─────────────────────────────────────────────
// Full read-only auction record, including the real identity behind each bid
// — unlike sanitizeAuctions() (used for buyers/producers), admin oversight
// intentionally skips the anonymization so disputes can actually be investigated.
router.get('/auctions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const auction = await db.collection('auctions').findOne({ id });
    if (!auction) return res.status(404).json({ error: 'Enchère introuvable.' });

    const producerIds = [...new Set((auction.bids || []).map(b => b.producerId).filter(pid => ObjectId.isValid(pid)))];
    const producers = producerIds.length
      ? await db.collection('users').find(
          { _id: { $in: producerIds.map(pid => new ObjectId(pid)) } },
          { projection: { name: 1, email: 1 } }
        ).toArray()
      : [];
    const producerMap = new Map(producers.map(p => [p._id.toString(), p]));

    const { _id, ...auctionFields } = auction;
    res.json({
      ...auctionFields,
      bids: (auction.bids || []).map(bid => ({
        ...bid,
        producerName: producerMap.get(bid.producerId)?.name || 'Producteur introuvable',
        producerEmail: producerMap.get(bid.producerId)?.email || '',
      })),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN GET AUCTION ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
