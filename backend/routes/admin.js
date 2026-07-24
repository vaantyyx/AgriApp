import express from 'express';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import { logger } from '../utils/logger.js';
import { markStatementPaid } from '../services/commissionEngine.js';
import { SCORE_WEIGHTS, setScoreWeights } from '../services/compositeScoring.js';
import { sendAdminMessage } from '../services/emailService.js';

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
    const [totalUsers, buyerCount, producerCount, openAuctions, closedAuctions, deactivatedUsers, totalVisits, uniqueVisitorIps, openSupportCount] = await Promise.all([
      db.collection('users').countDocuments({}),
      db.collection('users').countDocuments({ role: 'buyer' }),
      db.collection('users').countDocuments({ role: 'producer' }),
      db.collection('auctions').countDocuments({ status: 'open' }),
      db.collection('auctions').countDocuments({ status: 'closed' }),
      db.collection('users').countDocuments({ isActive: false }),
      db.collection('siteVisits').countDocuments({}),
      db.collection('siteVisits').distinct('ip'),
      db.collection('supportMessages').countDocuments({ status: 'open' }),
    ]);
    res.json({
      totalUsers, buyerCount, producerCount, openAuctions, closedAuctions, deactivatedUsers,
      totalVisits, uniqueVisitors: uniqueVisitorIps.filter(Boolean).length, openSupportCount,
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

    // One query for the whole page rather than one per row — which of these
    // users has at least one aiChatLogs entry (backed by the userId index).
    const pageUserIds = users.map(u => u._id.toString());
    const usedAiIds = pageUserIds.length
      ? new Set(await db.collection('aiChatLogs').distinct('userId', { userId: { $in: pageUserIds } }))
      : new Set();

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
        usedAi: usedAiIds.has(u._id.toString()),
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

    // Just the count here — the full history is its own paginated endpoint
    // (GET /users/:id/ai-chats) so this detail view stays fast and short;
    // the count alone is enough to show "Conversations IA (12)" as a link into it.
    const aiChatCount = await db.collection('aiChatLogs').countDocuments({ userId: id });

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
      aiChatCount,
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN GET USER ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/users/:id/ai-chats ───────────────────────────────────────
// Paginated, fetched on demand from its own sub-view — kept out of GET
// /users/:id so viewing a profile never pays for a chat-history query it
// didn't ask for.
router.get('/users/:id/ai-chats', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const db = getDb();
    const { page, limit } = parsePagination(req.query);

    const [chats, total] = await Promise.all([
      db.collection('aiChatLogs')
        .find({ userId: id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('aiChatLogs').countDocuments({ userId: id }),
    ]);

    res.json({
      chats: chats.map(c => ({ userMessage: c.userMessage, assistantReply: c.assistantReply, createdAt: c.createdAt })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN GET USER AI CHATS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
// Permanent, unlike /deactivate — removes the account itself plus data that's
// exclusively theirs (parcelles, IP/AI-chat logs, notifications). Deliberately
// does NOT touch auctions or bids: those are the OTHER party's transaction
// history too (a buyer's auction is a producer's bid record, and vice versa),
// so they're left in place — the admin auction detail view already renders a
// "Producteur introuvable" fallback for a bid whose producer no longer exists.
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });
    if (id === req.user.userId) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });

    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Impossible de supprimer un compte administrateur.' });

    await Promise.all([
      db.collection('users').deleteOne({ _id: new ObjectId(id) }),
      db.collection('parcelles').deleteMany({ userId: id }),
      db.collection('userLoginHistory').deleteMany({ userId: id }),
      db.collection('aiChatLogs').deleteMany({ userId: id }),
      db.collection('notifications').deleteMany({ userId: id }),
    ]);

    res.json({ message: 'Utilisateur supprimé définitivement.' });
  } catch (err) {
    logger.error({ err }, 'ADMIN DELETE USER ERROR');
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

// ─── POST /api/admin/users/:id/verify ────────────────────────────────────────
// Marks the account verified without the owner clicking the emailed link —
// for test accounts created with throwaway/unreachable addresses. Real users
// keep going through the normal email-verification (and, on login, OTP) flow
// untouched; this only ever short-circuits the one-time email-link step.
router.post('/users/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const result = await getDb().collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isVerified: true }, $unset: { verificationToken: '', verificationExpires: '' } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ message: 'Compte vérifié.' });
  } catch (err) {
    logger.error({ err }, 'ADMIN VERIFY USER ERROR');
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

// ─── GET /api/admin/support-messages ─────────────────────────────────────────
// Contact-form submissions (backend/routes/support.js) — previously only ever
// reached an email inbox with no record anywhere else; now persisted so they
// show up here even if the notification email failed to send.
router.get('/support-messages', async (req, res) => {
  try {
    const db = getDb();
    const { page, limit } = parsePagination(req.query);
    const allowedStatuses = ['open', 'resolved'];
    const status = allowedStatuses.includes(req.query.status) ? req.query.status : null;
    const filter = status ? { status } : {};

    const [messages, total] = await Promise.all([
      db.collection('supportMessages')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('supportMessages').countDocuments(filter),
    ]);

    res.json({
      messages: messages.map(m => ({
        id: m._id.toString(),
        name: m.name,
        email: m.email,
        subject: m.subject,
        message: m.message,
        status: m.status,
        createdAt: m.createdAt,
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN LIST SUPPORT MESSAGES ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/admin/support-messages/:id/resolve ────────────────────────────
// Toggles open <-> resolved — a ticket reopened by mistake is a much smaller
// problem than a one-way status with no way back.
router.post('/support-messages/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const db = getDb();
    const existing = await db.collection('supportMessages').findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ error: 'Message introuvable.' });

    const newStatus = existing.status === 'resolved' ? 'open' : 'resolved';
    await db.collection('supportMessages').updateOne({ _id: new ObjectId(id) }, { $set: { status: newStatus } });
    res.json({ message: 'Statut mis à jour.', status: newStatus });
  } catch (err) {
    logger.error({ err }, 'ADMIN RESOLVE SUPPORT MESSAGE ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/score-weights ────────────────────────────────────────────
// Bloc C — the composite bid-scoring weights (Prix/Qualité/Souk/Logistique).
// SCORE_WEIGHTS is a live module binding, so this always reflects whatever
// was last saved (or the built-in default, before any admin ever changes it).
router.get('/score-weights', async (req, res) => {
  res.json({ weights: SCORE_WEIGHTS });
});

// ─── PUT /api/admin/score-weights ────────────────────────────────────────────
router.put('/score-weights', async (req, res) => {
  try {
    const { price, quality, souk, logistics } = req.body;
    const weights = { price: Number(price), quality: Number(quality), souk: Number(souk), logistics: Number(logistics) };

    if (Object.values(weights).some(w => !Number.isFinite(w) || w < 0 || w > 1)) {
      return res.status(400).json({ error: 'Chaque pondération doit être un nombre entre 0 et 1.' });
    }
    const total = weights.price + weights.quality + weights.souk + weights.logistics;
    if (Math.abs(total - 1) > 0.01) {
      return res.status(400).json({ error: 'La somme des pondérations doit être égale à 100%.' });
    }

    const db = getDb();
    await db.collection('settings').updateOne(
      { _id: 'scoreWeights' },
      { $set: { ...weights, updatedAt: new Date(), updatedBy: req.user.userId } },
      { upsert: true }
    );
    // Takes effect immediately for every auction scored from now on — no restart needed.
    setScoreWeights(weights);

    res.json({ message: 'Pondérations mises à jour.', weights });
  } catch (err) {
    logger.error({ err }, 'ADMIN UPDATE SCORE WEIGHTS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/admin/send-email ──────────────────────────────────────────────
// Lets the admin send a one-off, free-form email to any address, on Sougra's
// behalf, using the same branded template as the automated OTP/verification
// emails (see emailService.js's getBaseTemplate).
router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      return res.status(400).json({ error: 'Adresse email destinataire invalide.' });
    }
    if (typeof subject !== 'string' || subject.trim().length < 2 || subject.trim().length > 200) {
      return res.status(400).json({ error: "L'objet doit contenir entre 2 et 200 caractères." });
    }
    if (typeof message !== 'string' || message.trim().length < 2 || message.trim().length > 5000) {
      return res.status(400).json({ error: 'Le message doit contenir entre 2 et 5000 caractères.' });
    }

    await sendAdminMessage(to.trim(), subject.trim(), message.trim());

    const db = getDb();
    await db.collection('sentEmails').insertOne({
      to: to.trim(),
      subject: subject.trim(),
      message: message.trim(),
      sentAt: new Date(),
      sentBy: req.user.userId,
    });

    res.json({ message: 'Email envoyé.' });
  } catch (err) {
    logger.error({ err }, 'ADMIN SEND EMAIL ERROR');
    res.status(500).json({ error: "Échec de l'envoi de l'email." });
  }
});

// ─── GET /api/admin/sent-emails ──────────────────────────────────────────────
// History of emails sent by an admin via POST /send-email, newest first.
router.get('/sent-emails', async (req, res) => {
  try {
    const db = getDb();
    const { page, limit } = parsePagination(req.query);

    const [emails, total] = await Promise.all([
      db.collection('sentEmails')
        .find({})
        .sort({ sentAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('sentEmails').countDocuments({}),
    ]);

    res.json({
      emails: emails.map(e => ({
        id: e._id.toString(),
        to: e.to,
        subject: e.subject,
        message: e.message,
        sentAt: e.sentAt,
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    logger.error({ err }, 'ADMIN LIST SENT EMAILS ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── PUT /api/admin/users/:id/name ───────────────────────────────────────────
router.put('/users/:id/name', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const { name } = req.body;
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Le nom doit contenir au minimum 2 caractères.' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Le nom ne doit pas dépasser 100 caractères.' });
    }

    const db = getDb();
    const result = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { name: name.trim() } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    res.json({ message: 'Nom mis à jour.', name: result.name });
  } catch (err) {
    logger.error({ err }, 'ADMIN UPDATE USER NAME ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
