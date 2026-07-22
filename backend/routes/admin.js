import express from 'express';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import { logger } from '../utils/logger.js';
import { markStatementPaid } from '../services/commissionEngine.js';

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

    // Bloc B — lets the team review rejected tenders (audit trail + tuning
    // the fairness gate) without touching the default "all statuses" view.
    const allowedStatuses = ['pending', 'open', 'closed', 'rejected'];
    const status = allowedStatuses.includes(req.query.status) ? req.query.status : null;
    const filter = status ? { status } : {};

    // Bloc C — ?flagged=1 surfaces only auctions the anti-collusion heuristic flagged.
    if (req.query.flagged === '1') filter['collusionFlag.flagged'] = true;

    const [auctions, total] = await Promise.all([
      db.collection('auctions')
        .find(filter, { projection: { id: 1, title: 1, product: 1, status: 1, buyerName: 1, createdAt: 1, bids: 1, validation: 1, collusionFlag: 1 } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('auctions').countDocuments(filter),
    ]);

    res.json({
      auctions: auctions.map(a => ({
        id: a.id,
        title: a.title || a.product,
        status: a.status,
        buyerName: a.buyerName,
        bidsCount: (a.bids || []).length,
        createdAt: a.createdAt,
        rejectionReason: a.status === 'rejected' ? (a.validation?.reason || null) : null,
        collusionFlag: a.collusionFlag?.flagged ? a.collusionFlag : null,
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN LIST AUCTIONS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/reference-prices ────────────────────────────────────────
// Bloc A — read-only visibility into the reference engine (services/referenceEngine.js).
// There is no write endpoint on purpose: prices are only ever computed from
// settled deals, never entered by hand (see decision to drop manual entry).
router.get('/reference-prices', async (req, res) => {
  try {
    const db = getDb();
    const { page, limit } = parsePagination(req.query);

    const [prices, total] = await Promise.all([
      db.collection('referencePrices')
        .find({})
        .sort({ computedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('referencePrices').countDocuments({}),
    ]);

    res.json({
      prices: prices.map(p => ({
        productId: p.productId,
        crop: p.crop,
        wilaya: p.wilaya,
        unit: p.unit,
        price: p.price,
        previousPrice: p.previousPrice,
        rawMedian: p.rawMedian,
        seasonalModifier: p.seasonalModifier,
        sampleSize: p.sampleSize,
        computedAt: p.computedAt,
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN LIST REFERENCE PRICES ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/buyer-accounts ──────────────────────────────────────────
// Bloc D — read-only view of every buyer's commission ledger balance.
router.get('/buyer-accounts', async (req, res) => {
  try {
    const db = getDb();
    const { page, limit } = parsePagination(req.query);

    const [accounts, total] = await Promise.all([
      db.collection('buyerAccounts')
        .find({})
        .sort({ outstandingBalance: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('buyerAccounts').countDocuments({}),
    ]);

    const buyerIds = accounts.map(a => a.buyerId).filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const buyers = buyerIds.length
      ? await db.collection('users').find({ _id: { $in: buyerIds } }, { projection: { name: 1, email: 1 } }).toArray()
      : [];
    const buyerById = new Map(buyers.map(b => [b._id.toString(), b]));

    res.json({
      accounts: accounts.map(a => ({
        buyerId: a.buyerId,
        buyerName: buyerById.get(a.buyerId)?.name || null,
        buyerEmail: buyerById.get(a.buyerId)?.email || null,
        outstandingBalance: a.outstandingBalance,
        totalSettled: a.totalSettled,
        updatedAt: a.updatedAt,
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN LIST BUYER ACCOUNTS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/weekly-statements ───────────────────────────────────────
// Bloc D — relevés hebdomadaires; ?status=pending|paid to filter for reconciliation.
router.get('/weekly-statements', async (req, res) => {
  try {
    const db = getDb();
    const { page, limit } = parsePagination(req.query);
    const allowedStatuses = ['pending', 'paid'];
    const status = allowedStatuses.includes(req.query.status) ? req.query.status : null;
    const filter = status ? { status } : {};

    const [statements, total] = await Promise.all([
      db.collection('weeklyStatements')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('weeklyStatements').countDocuments(filter),
    ]);

    const buyerIds = statements.map(s => s.buyerId).filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const buyers = buyerIds.length
      ? await db.collection('users').find({ _id: { $in: buyerIds } }, { projection: { name: 1, email: 1 } }).toArray()
      : [];
    const buyerById = new Map(buyers.map(b => [b._id.toString(), b]));

    res.json({
      statements: statements.map(s => ({
        id: s.id,
        buyerId: s.buyerId,
        buyerName: buyerById.get(s.buyerId)?.name || null,
        buyerEmail: buyerById.get(s.buyerId)?.email || null,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        entryCount: s.entryCount,
        totalAmount: s.totalAmount,
        status: s.status,
        createdAt: s.createdAt,
        paidAt: s.paidAt,
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN LIST WEEKLY STATEMENTS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/admin/weekly-statements/:id/mark-paid ────────────────────────
// Bloc D — manual reconciliation: admin confirms the bank transfer was
// received outside the app (decision: no real bank integration).
router.post('/weekly-statements/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = await markStatementPaid(db, id, req.user.userId);
    if (!result) return res.status(404).json({ error: 'Relevé introuvable.' });
    res.json({ message: 'Relevé marqué comme payé.', statement: result });
  } catch (err) {
    logger.error({ err }, 'ADMIN MARK STATEMENT PAID ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
