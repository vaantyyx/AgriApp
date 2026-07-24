import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectToDatabase, getDb, closeConnection } from './db.js';
import { readFile } from './services/storage.js';
import { getRateLimitStore } from './utils/rateLimitStore.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import notificationsRoutes from './routes/notifications.js';
import parcellesRoutes from './routes/parcelles.js';
import captchaRoutes from './routes/captcha.js';
import supportRoutes from './routes/support.js';
import adminRoutes from './routes/admin.js';
import aiRoutes from './routes/ai.js';
import { CAPTCHA_CATEGORIES } from './services/captchaCategories.js';
import { logger } from './utils/logger.js';
import authMiddleware from './middleware/authMiddleware.js';
import {
  PRODUCTS_MAP,
  haversineKm,
  getWilayaCoords,
  getCommuneCoords,
  hasProducerProduct,
  canProducerParticipate,
  sanitizeAuctions,
  wilayaRoomName,
  getEligibleWilayaRooms,
  normalizeRoundConfig,
  computeRoundPriceBounds,
  getWilayaNameById,
} from './services/auctionMatching.js';
import { validateTender } from './services/tenderValidation.js';
import { recomputeReferencePrices, getReferencePrice } from './services/referenceEngine.js';
import { recordCommission, generateWeeklyStatements } from './services/commissionEngine.js';
import { checkForCollusion } from './services/collusionDetection.js';
import { setScoreWeights } from './services/compositeScoring.js';
import { setIo, userRoom } from './services/socketRegistry.js';

// ─── JWT Secret bootstrap ──────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  const ephemeral = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = ephemeral;
  logger.warn('JWT_SECRET not set in .env — using ephemeral secret. All sessions will be invalidated on restart!');
}

// Login is hard-gated behind the CAPTCHA, so an empty/broken category
// catalog would lock everyone out — warn loudly rather than fail silently.
if (Object.keys(CAPTCHA_CATEGORIES).length < 4) {
  logger.warn('Fewer than 4 categories in captchaCategories.js — CAPTCHA grids may fail to generate, blocking all logins.');
}

// ─── App Setup ────────────────────────────────────────────────────────────
const app = express();
// Behind a reverse proxy (Nginx, a cloud load balancer), Express otherwise
// sees the proxy's own IP for every request — express-rate-limit would key
// every visitor's rate limit off that single shared IP instead of their
// real one, and req.ip (used for the site-visit/login-IP tracking) would
// record the proxy's IP instead of the visitor's. TRUST_PROXY opts into
// trusting X-Forwarded-* headers; leave it unset for direct/local (no proxy
// in front) deployments.
// `true` (not a hop count like `1`) because PaaS hosts (Render, Heroku,
// Railway...) route through more than one internal proxy hop before
// reaching the app — a fixed hop count of 1 only strips the closest one and
// leaves an internal 10.x/172.x address as req.ip instead of the real client
// IP. Trusting the whole chain is safe here because the platform's own edge
// is the only party that can set X-Forwarded-For from outside; it always
// overwrites (never appends to) whatever a client sends.
if (process.env.TRUST_PROXY) app.set('trust proxy', true);
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
// Gzip/brotli response compression — cuts bandwidth for JSON payloads (auction
// lists, notifications) and static uploads, which matters most once traffic
// grows beyond a handful of concurrent users.
app.use(compression());

// CORS — restrict to frontend origin only (comma-separated ALLOWED_ORIGINS env var, falls back to local dev origins)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.use(express.json({ limit: '10mb' }));

// ─── Security Headers ─────────────────────────────────────────────────────
// helmet() adds the headers the manual block below doesn't already cover
// (CSP, Cross-Origin-Opener-Policy, X-DNS-Prefetch-Control, etc.) — it runs
// first so the manual setHeader calls after it keep the final say on every
// header they already tune by hand, with zero behavior change there.
// crossOriginResourcePolicy is relaxed to 'cross-origin': the frontend
// (Netlify) and this API live on different origins by design, and captcha
// tile images / uploaded profile photos are loaded cross-origin via <img> —
// helmet's 'same-origin' default would silently block those loads.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // TODO(security): geolocation is used client-side for map; if removed, re-enable this restriction
  res.setHeader('Permissions-Policy', 'camera=(), microphone=()');
  // Ignored by browsers over plain HTTP, so safe to always send even in local dev.
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────
// Baseline limiter for all API routes — the stricter authLimiter below layers
// on top of this for the auth endpoints specifically.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Veuillez réessayer plus tard.' },
  store: getRateLimitStore('rl:general:'),
});
app.use('/api', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans une minute.' },
  store: getRateLimitStore('rl:auth:'),
});
app.use('/api/auth', authLimiter);

// ─── Uploaded File Serving ─────────────────────────────────────────────────
// Profile photos and identity/legal documents (RC, fiche signalétique, carte
// agriculteur) live here — UUID filenames alone aren't access control, so require
// a valid session. <img>/<a> tags can't set an Authorization header, so a token
// query param is accepted as a fallback. Bytes are fetched through storage.js
// (Cloudinary when configured, local disk otherwise) rather than served
// directly off disk, so this route's behavior is identical either way.
app.get('/uploads/:key', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = headerToken || req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Token invalide.' });
  }

  // Only the "<uuid><ext>" shape storeFile() produces is ever valid — rejects
  // path traversal and any other unexpected input before it reaches storage.js.
  const { key } = req.params;
  if (!/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf)$/i.test(key)) {
    return res.status(404).end();
  }

  try {
    const { buffer, contentType } = await readFile(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) {
    logger.error({ err }, 'UPLOADS READ ERROR');
    res.status(404).end();
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/parcelles', parcellesRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    const db = getDb();
    const count = await db.collection('auctions').countDocuments();
    res.json({ status: 'ok', auctionsCount: count });
  } catch (error) {
    res.status(500).json({ status: 'error', error: 'Erreur serveur.' });
  }
});

// Public site-visit tracker — intentionally unauthenticated (anonymous
// visitors, including everyone who never signs up, are exactly who this
// counts). Already covered by the generalLimiter mounted on '/api' above.
app.post('/api/track-visit', async (req, res) => {
  try {
    const db = getDb();
    await db.collection('siteVisits').insertOne({
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      path: String(req.body?.path || '').slice(0, 300),
      createdAt: new Date(),
    });
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, 'Error recording site visit');
    res.status(204).end(); // Never surface a tracking failure to the visitor.
  }
});

// Producers count within a radius
app.get('/api/producers/count', authMiddleware, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 100;
    const auctionType = req.query.auctionType;
    const productIdsStr = req.query.productIds;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Coordonnées lat/lng invalides.' });
    }

    // Resolve requested product names if smart auction
    let requestedProductNames = [];
    if (auctionType === 'smart' && productIdsStr) {
      const productIds = productIdsStr.split(',').filter(Boolean);
      requestedProductNames = productIds.map(pid => PRODUCTS_MAP[pid]).filter(Boolean);
    }

    const db = getDb();
    const { ObjectId } = await import('mongodb');
    const producers = await db.collection('users')
      .find({ roles: 'producer', isVerified: true, _id: { $ne: new ObjectId(req.user.userId) } })
      .toArray();

    // Each producer's eligibility check is independent — run them concurrently
    // instead of one-at-a-time, so this scales with how long the slowest single
    // check takes rather than with the total number of producers.
    const eligible = await Promise.all(producers.map(async producer => {
      const pCoords = producer.commune
        ? getCommuneCoords(producer.wilaya || '', producer.commune)
        : getWilayaCoords(producer.wilaya || '');

      if (!pCoords) return false;

      const dist = haversineKm(lat, lng, pCoords.lat, pCoords.lng);
      if (dist > radius) return false;

      if (auctionType === 'smart' && requestedProductNames.length > 0) {
        return await hasProducerProduct(producer._id.toString(), requestedProductNames, db);
      }
      return true;
    }));
    const count = eligible.filter(Boolean).length;

    res.json({ count });
  } catch (error) {
    logger.error({ err: error }, 'Error counting producers');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Bloc A — live reference-price lookup, for both the buyer's create/edit form
// (a hint while choosing a price ceiling, before the tender even exists) and
// the producer's bid view (the *current* reference, unlike the snapshot on
// auction.validation.referenceUsed which is frozen at tender-creation time).
app.get('/api/reference-prices/lookup', authMiddleware, async (req, res) => {
  try {
    const { productId, wilayaId, unit } = req.query;
    const wilayaName = getWilayaNameById(wilayaId);
    if (!productId || !wilayaName) {
      return res.status(400).json({ error: 'productId et wilayaId (valide) sont requis.' });
    }

    const db = getDb();
    const reference = await getReferencePrice(String(productId), wilayaName, unit ? String(unit) : 'tonnes', db);
    res.json({
      reference: reference
        ? { price: reference.price, sampleSize: reference.sampleSize, computedAt: reference.computedAt }
        : null,
    });
  } catch (err) {
    logger.error({ err }, 'Error looking up reference price');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Older auctions, paginated — the initial Socket.IO snapshot only sends the
// most recent INITIAL_AUCTIONS_LIMIT; the frontend calls this to "load more".
app.get('/api/auctions/older', authMiddleware, async (req, res) => {
  try {
    const before = req.query.before ? new Date(req.query.before) : null;
    if (!before || isNaN(before.getTime())) {
      return res.status(400).json({ error: 'Paramètre "before" invalide.' });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const db = getDb();
    const { userId: uid, role } = req.user;
    const roles = req.user.roles || [role];
    const activeView = roles.includes(req.query.activeView) ? req.query.activeView : roles[0];

    // Bloc B — a 'rejected' tender is only ever visible to the buyer who
    // created it (audit trail) and to admins; everyone else must never see it.
    let auctions = await db.collection('auctions')
      .find({ createdAt: { $lt: before.toISOString() }, $or: [{ status: { $ne: 'rejected' } }, { buyerId: uid }] })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    if (roles.includes('producer')) {
      const { ObjectId } = await import('mongodb');
      const producerUser = await db.collection('users').findOne(
        { _id: new ObjectId(uid) },
        { projection: { wilaya: 1, commune: 1 } }
      );
      const producerCoords = producerUser?.commune
        ? getCommuneCoords(producerUser.wilaya || '', producerUser.commune)
        : getWilayaCoords(producerUser?.wilaya || '');

      const checks = await Promise.all(auctions.map(async a => {
        if (a.buyerId === uid) return a;
        return (a.status !== 'pending' && await canProducerParticipate(a, uid, producerCoords, db)) ? a : null;
      }));
      auctions = checks.filter(Boolean);
    }

    const sanitized = sanitizeAuctions(auctions, uid, activeView);
    res.json({ auctions: sanitized, hasMore: auctions.length === limit });
  } catch (err) {
    logger.error({ err }, 'Error fetching older auctions');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Geographic + product matching + anonymization helpers now live in
// services/auctionMatching.js (unit tested there).
// ─── Socket.IO Server ─────────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 5e7, // 50MB to accommodate images in bids
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});
// Lets route modules (e.g. routes/admin.js, for online-presence checks) reach
// this `io` instance without a circular import — see socketRegistry.js.
setIo(io);

// Capability check for a decoded JWT payload (`{ role, roles }`) — falls back
// to the legacy single `role` for tokens issued before dual-role accounts
// existed, so old still-valid sessions keep working unchanged.
const hasRole = (userPayload, roleName) => (userPayload.roles || [userPayload.role]).includes(roleName);

// Real-time delivery (new/updated auctions) is unaffected by this cap — it only
// bounds the initial snapshot sent on connect; older auctions load on demand.
const INITIAL_AUCTIONS_LIMIT = 100;

// Attaches the Redis adapter so Socket.IO state (rooms, broadcasts) is shared
// across multiple server instances. Falls back to the default in-memory
// adapter (single-instance only) if REDIS_URL is unset or unreachable —
// the app remains fully functional either way.
async function setupSocketAdapter(io) {
  if (!process.env.REDIS_URL) {
    logger.info('REDIS_URL not set — Socket.IO running in single-instance (in-memory) mode.');
    return;
  }
  try {
    // reconnectStrategy: false — fail fast on the initial attempt instead of
    // retrying forever in the background, so a missing/down Redis can never
    // hang server startup; it just falls back to in-memory mode below.
    // RESP: 2 — the client defaults to negotiating RESP3 via HELLO, which
    // only exists on Redis 6+; forcing RESP2 keeps this working against
    // older Redis deployments too (HELLO is otherwise rejected outright).
    const pubClient = createClient({ url: process.env.REDIS_URL, RESP: 2, socket: { reconnectStrategy: false } });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => logger.error({ err }, 'Redis pub client error'));
    subClient.on('error', (err) => logger.error({ err }, 'Redis sub client error'));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter connected — ready for multi-instance scaling.');
  } catch (err) {
    logger.error({ err }, 'Failed to connect Socket.IO Redis adapter — falling back to single-instance mode.');
  }
}

// Map of auctionId → { fiveMin: Timeout|null, start: Timeout|null } for precise scheduling
const auctionTimers = new Map();
const MAX_TIMEOUT_MS = 2147483647; // ~24.8 days — Node's setTimeout overflow ceiling

/** Returns producers eligible to be notified about this auction (zone + product match). */
async function getMatchingProducers(auction, db) {
  const buyerCoords = (auction.buyerLat != null && auction.buyerLng != null)
    ? { lat: auction.buyerLat, lng: auction.buyerLng }
    : null;
  const radiusKm = auction.radiusKm || 100;
  const producers = await db.collection('users').find({ roles: 'producer', isVerified: true }).toArray();

  // Each producer's zone/product eligibility is independent of the others —
  // run them concurrently instead of one-at-a-time.
  const results = await Promise.all(producers.map(async producer => {
    // A dual-role account never gets notified about its own auction.
    if (producer._id.toString() === auction.buyerId) return null;

    let shouldNotify = false;
    let distKm = 0;

    const pCoords = producer.commune
      ? getCommuneCoords(producer.wilaya || '', producer.commune)
      : getWilayaCoords(producer.wilaya || '');
    if (buyerCoords && pCoords) {
      distKm = haversineKm(buyerCoords.lat, buyerCoords.lng, pCoords.lat, pCoords.lng);
    }

    if (!auction.isSearchZoneChanged) {
      if (
        producer.wilaya &&
        producer.commune &&
        auction.buyerWilaya &&
        auction.buyerCommune &&
        producer.wilaya.toLowerCase().trim() === auction.buyerWilaya.toLowerCase().trim() &&
        producer.commune.toLowerCase().trim() === auction.buyerCommune.toLowerCase().trim()
      ) {
        shouldNotify = true;
      }
    } else if (buyerCoords) {
      if (distKm <= radiusKm) shouldNotify = true;
    }

    if (shouldNotify && auction.auctionType === 'smart') {
      const requestedProductNames = (auction.lots || []).map(l => PRODUCTS_MAP[l.productId]).filter(Boolean);
      if (requestedProductNames.length === 0 && auction.product) {
        const fallback = PRODUCTS_MAP[auction.product] || auction.product;
        requestedProductNames.push(fallback);
      }
      shouldNotify = await hasProducerProduct(producer._id.toString(), requestedProductNames, db);
    }

    return shouldNotify ? { producer, distKm } : null;
  }));

  return results.filter(Boolean);
}

/** Persists + pushes (if connected) a notification of `type` to every producer matching this auction. */
async function notifyMatchingProducers(auction, db, type) {
  const matches = await getMatchingProducers(auction, db);
  for (const { producer, distKm } of matches) {
    const notifId = `notif_${Date.now()}_${randomBytes(3).toString('hex')}`;
    const notification = {
      id: notifId,
      userId: producer._id.toString(),
      type,
      auctionId: auction.id,
      product: auction.product,
      quantity: auction.quantity,
      unit: auction.unit,
      startAt: auction.startAt,
      distanceKm: Math.round(distKm),
      read: false,
      createdAt: new Date().toISOString(),
    };
    await db.collection('notifications').insertOne(notification);

    // Room-based targeting (not raw socket IDs) so delivery works correctly
    // across instances once the Redis adapter is active — a no-op if empty.
    io.to(userRoom(producer._id.toString())).emit('new_notification', notification);
  }
}

/**
 * Sockets that could plausibly need an update about this auction: all buyers,
 * plus producers in wilaya range. A dual-role account joins both room sets
 * (see the connection handler below), so the same socket can come back from
 * both fetches — dedupe by socket id or it would receive the event twice.
 */
async function getBroadcastCandidateSockets(auction) {
  const buyerSockets = await io.in('role:buyer').fetchSockets();
  const producerSockets = auction.status === 'pending'
    ? []
    : await io.in(getEligibleWilayaRooms(auction.buyerLat, auction.buyerLng, auction.radiusKm)).fetchSockets();
  const seen = new Set();
  return [...buyerSockets, ...producerSockets].filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/**
 * Emits `auction`, sanitized for `s`'s user, after checking producer
 * eligibility — skipped for the auction's own buyer (always eligible for
 * their own auction, even if their account also has the producer role).
 */
async function emitAuctionIfEligible(s, auction, db, eventName) {
  const isOwnAuction = s.data.user.userId === auction.buyerId;
  if (!isOwnAuction && hasRole(s.data.user, 'producer')) {
    const allowed = await canProducerParticipate(auction, s.data.user.userId, s.data.producerCoords, db);
    if (!allowed) return;
  }
  const [sanitized] = sanitizeAuctions([auction], s.data.user.userId, s.data.activeView || s.data.user.role);
  s.emit(eventName, sanitized);
}

/** Broadcasts a sanitized version of the auction to every connected socket (zone/product filtered for producers). */
async function broadcastAuction(auction, db, eventName = 'auction_updated') {
  const candidateSockets = await getBroadcastCandidateSockets(auction);
  // Each socket's eligibility check + emit is independent — run them
  // concurrently. Sequentially awaiting one socket at a time made every
  // broadcast's cost scale with the size of the candidate set.
  await Promise.all(candidateSockets.map(s => emitAuctionIfEligible(s, auction, db, eventName)));
}

function clearAuctionTimers(auctionId) {
  const timers = auctionTimers.get(auctionId);
  if (timers) {
    if (timers.fiveMin) clearTimeout(timers.fiveMin);
    if (timers.start) clearTimeout(timers.start);
    auctionTimers.delete(auctionId);
  }
}

// Map of auctionId → Timeout[] for progressive-auction round transitions.
const auctionRoundTimers = new Map();

function clearAuctionRoundTimers(auctionId) {
  const timers = auctionRoundTimers.get(auctionId);
  if (timers) {
    timers.forEach(t => clearTimeout(t));
    auctionRoundTimers.delete(auctionId);
  }
}

/** Advances an open progressive auction to `roundNumber` and broadcasts the change — called exactly when that round's timer fires. */
async function advanceAuctionRound(auctionId, roundNumber) {
  try {
    const db = getDb();
    const auction = await db.collection('auctions').findOne({ id: auctionId });
    if (!auction || auction.status !== 'open' || !auction.roundConfig?.enabled) return;
    if ((auction.currentRound || 1) >= roundNumber) return; // already advanced (e.g. by the fallback poll)

    await db.collection('auctions').updateOne({ id: auctionId }, { $set: { currentRound: roundNumber } });
    const updated = await db.collection('auctions').findOne({ id: auctionId });
    await broadcastAuction(updated, db, 'auction_updated');
  } catch (err) {
    logger.error({ err, auctionId, roundNumber }, 'Error advancing auction round');
  }
}

/** Schedules precise timers for every remaining round transition of a progressive auction that is currently open. */
function scheduleRoundTransitions(auction) {
  clearAuctionRoundTimers(auction.id);
  if (!auction.roundConfig?.enabled || auction.status !== 'open' || !auction.roundStartedAt) return;

  const { totalRounds, roundDurationHours } = auction.roundConfig;
  const startMs = new Date(auction.roundStartedAt).getTime();
  const now = Date.now();
  const timers = [];

  for (let r = (auction.currentRound || 1) + 1; r <= totalRounds; r++) {
    const targetMs = startMs + (r - 1) * roundDurationHours * 3600 * 1000;
    const delay = targetMs - now;
    if (delay > 0 && delay <= MAX_TIMEOUT_MS) {
      timers.push(setTimeout(() => advanceAuctionRound(auction.id, r), delay));
    }
    // Delays beyond MAX_TIMEOUT_MS or already past are caught by checkAuctionRounds() below.
  }

  if (timers.length) auctionRoundTimers.set(auction.id, timers);
}

/** Flips a pending auction to open, notifies matching producers, and broadcasts — called exactly at startAt. */
async function openAuction(auctionId) {
  try {
    const db = getDb();
    const auction = await db.collection('auctions').findOne({ id: auctionId });
    if (!auction || auction.status !== 'pending') return;

    const roundFields = auction.roundConfig?.enabled
      ? { currentRound: 1, roundStartedAt: new Date().toISOString() }
      : {};
    await db.collection('auctions').updateOne({ id: auctionId }, { $set: { status: 'open', ...roundFields } });
    Object.assign(auction, { status: 'open', ...roundFields });

    clearAuctionTimers(auctionId);
    if (auction.roundConfig?.enabled) scheduleRoundTransitions(auction);
    await notifyMatchingProducers(auction, db, 'new_auction');
    await broadcastAuction(auction, db, 'auction_updated');
  } catch (err) {
    logger.error({ err, auctionId }, 'Error opening auction');
  }
}

/**
 * Schedules the "5 minutes left" reminder and the exact opening of a pending auction,
 * so both fire precisely at their target time instead of waiting on the periodic poll.
 */
function scheduleAuctionNotifications(auction) {
  clearAuctionTimers(auction.id);
  if (auction.status !== 'pending' || !auction.startAt) return;

  const startMs = new Date(auction.startAt).getTime();
  const now = Date.now();
  const timers = {};

  const fiveMinBeforeMs = startMs - 5 * 60 * 1000;
  const fiveMinDelay = fiveMinBeforeMs - now;
  if (fiveMinDelay > 0 && fiveMinDelay <= MAX_TIMEOUT_MS) {
    timers.fiveMin = setTimeout(async () => {
      try {
        const db = getDb();
        const current = await db.collection('auctions').findOne({ id: auction.id });
        if (current && current.status === 'pending') {
          await notifyMatchingProducers(current, db, 'auction_starting_soon');
        }
      } catch (err) {
        logger.error({ err, auctionId: auction.id }, 'Error sending 5-min reminder');
      }
    }, fiveMinDelay);
  }

  const startDelay = Math.max(startMs - now, 0);
  if (startDelay <= MAX_TIMEOUT_MS) {
    timers.start = setTimeout(() => { openAuction(auction.id); }, startDelay);
  }
  // If startDelay overflows setTimeout's range, the periodic checkPendingAuctions() poll
  // below acts as a fallback and will open it once its time comes within range.

  auctionTimers.set(auction.id, timers);
}

// Socket.IO auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    // socket.data (not a plain custom property) — it's the one namespace the
    // Redis adapter actually serializes onto the RemoteSocket objects
    // returned by fetchSockets() for sockets connected to OTHER instances.
    // A plain `socket.user = decoded` only exists in this process's memory
    // and silently reads as undefined on every other instance.
    socket.data.user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  const uid = socket.data.user.userId;
  // `roles` is the account's capabilities (JWTs issued before dual-role
  // accounts existed only carry `role`, hence the fallback). `activeView` is
  // just which view the frontend is currently showing — it only affects which
  // *perspective* sanitizeAuctions renders with, never authorization.
  const roles = socket.data.user.roles || [socket.data.user.role];
  const requestedView = socket.handshake.auth?.activeView;
  const activeView = roles.includes(requestedView) ? requestedView : roles[0];
  socket.data.activeView = activeView;

  // Room-based presence — works for targeted delivery across instances once
  // the Redis adapter is active, and Socket.IO cleans it up on disconnect.
  socket.join(userRoom(uid));

  logger.info({ email: socket.data.user.email, roles, activeView, socketId: socket.id }, 'User connected');

  // Resolve producer geographic coordinates for zone-based filtering
  socket.data.producerCoords = null;

  try {
    const db = getDb();
    const { ObjectId } = await import('mongodb');

    // Independent (not else-if): a dual-role account joins both room sets,
    // so it receives both buyer and producer broadcast categories on one
    // connection — see getBroadcastCandidateSockets()'s dedupe for why that's safe.
    if (roles.includes('producer')) {
      const producerUser = await db.collection('users').findOne(
        { _id: new ObjectId(uid) },
        { projection: { wilaya: 1, commune: 1 } }
      );
      socket.data.producerCoords = producerUser?.commune
        ? getCommuneCoords(producerUser.wilaya || '', producerUser.commune)
        : getWilayaCoords(producerUser?.wilaya || '');
      // Lets broadcasts fetch a per-auction candidate set (producers in
      // plausibly-in-range wilayas) instead of every connected socket.
      socket.join(wilayaRoomName(producerUser?.wilaya || ''));
    }
    if (roles.includes('buyer')) {
      socket.join('role:buyer');
    }

    // Send initial auctions list — producers only see demands matching their zone & product if smart.
    // Capped to the most recent page; older auctions are fetched on demand via GET /api/auctions/older.
    // Bloc B — a 'rejected' tender is only ever visible to the buyer who
    // created it (audit trail) and to admins; everyone else must never see it.
    const visibilityFilter = { $or: [{ status: { $ne: 'rejected' } }, { buyerId: uid }] };
    const totalAuctionsCount = await db.collection('auctions').countDocuments(visibilityFilter);
    let auctions = await db.collection('auctions').find(visibilityFilter).sort({ createdAt: -1 }).limit(INITIAL_AUCTIONS_LIMIT).toArray();
    if (roles.includes('producer')) {
      // A dual-role account must still see its own auctions (as their buyer)
      // in this producer-eligibility pass — only auctions belonging to
      // someone else are filtered by whether this account can bid on them.
      const checks = await Promise.all(auctions.map(async a => {
        if (a.buyerId === uid) return a;
        return (a.status !== 'pending' && await canProducerParticipate(a, uid, socket.data.producerCoords, db)) ? a : null;
      }));
      auctions = checks.filter(Boolean);
    }

    const sanitized = sanitizeAuctions(auctions, uid, activeView);
    socket.emit('auctions_list', sanitized, { hasMore: totalAuctionsCount > INITIAL_AUCTIONS_LIMIT });
  } catch (err) {
    logger.error({ err }, 'Error fetching initial auctions');
  }

  // ── Create Auction (Buyer only) ──────────────────────────────────────
  socket.on('create_auction', async (data) => {
    if (!roles.includes('buyer')) {
      socket.emit('error', { message: 'Seuls les acheteurs peuvent créer des enchères.' });
      return;
    }

    const {
      title,
      auctionType,
      deliveryLocation,
      description,
      lots,
      radius,
      isSearchZoneChanged,
      startAt,
      endAt,
      autoProlongate,
      prolongationMinutes,
      maxProlongations,
      roundConfig: rawRoundConfig,
    } = data;

    const firstLot = Array.isArray(lots) && lots.length > 0 ? lots[0] : null;
    const lotProduct = firstLot ? firstLot.productId : null;
    const lotQuantity = firstLot ? firstLot.quantity : null;
    const lotUnit = firstLot ? firstLot.unit : 'tonnes';

    if (!title || (!lotProduct && !firstLot?.designation) || !lotQuantity || !lotUnit) {
      socket.emit('error', { message: 'Champs obligatoires manquants (Titre, Produit, Quantité, Unité).' });
      return;
    }
    if (String(title).trim().length > 150) {
      socket.emit('error', { message: 'Le titre ne doit pas dépasser 150 caractères.' });
      return;
    }

    const roundConfig = normalizeRoundConfig(rawRoundConfig);
    if (roundConfig.enabled && !(firstLot?.priceCeiling > 0)) {
      socket.emit('error', { message: "Un prix plafond (prix de référence) est requis pour une enchère dégressive." });
      return;
    }

    try {
      const db = getDb();

      // Fetch buyer's profile to get wilaya/commune
      const { ObjectId } = await import('mongodb');
      const buyer = await db.collection('users').findOne(
        { _id: new ObjectId(uid) },
        { projection: { name: 1, phone: 1, wilaya: 1, commune: 1 } }
      );

      // Resolve buyer's approximate coordinates
      const buyerCoords = buyer?.commune
        ? getCommuneCoords(buyer.wilaya || '', buyer.commune)
        : getWilayaCoords(buyer?.wilaya || '');

      const radiusKm = Math.min(Math.max(parseFloat(radius) || 100, 10), 2000);
      const now = new Date();
      const isFuture = startAt && new Date(startAt) > now;
      const initialStatus = isFuture ? 'pending' : 'open';
      // Progressive rounds only start ticking once the auction is actually open —
      // a 'pending' (scheduled) auction gets its round 1 set by openAuction() instead.
      const roundFields = roundConfig.enabled && initialStatus === 'open'
        ? { currentRound: 1, roundStartedAt: now.toISOString() }
        : { currentRound: null, roundStartedAt: null };

      const newAuction = {
        id: `auc_${Date.now()}_${randomBytes(4).toString('hex')}`,
        buyerId: uid,
        buyerName: buyer?.name || 'Acheteur',
        // Bloc C anonymity lift: only ever surfaced by sanitizeAuctions to the
        // winning producer, once the auction is closed (see auctionMatching.js).
        buyerPhone: buyer?.phone || '',
        buyerWilaya: buyer?.wilaya || '',
        buyerCommune: buyer?.commune || '',
        buyerLat: buyerCoords?.lat ?? null,
        buyerLng: buyerCoords?.lng ?? null,
        radiusKm,
        isSearchZoneChanged: !!isSearchZoneChanged,
        
        title: String(title).slice(0, 150),
        auctionType: String(auctionType || 'open').slice(0, 100),
        deliveryLocation: String(deliveryLocation || '').slice(0, 300),
        description: String(description || '').slice(0, 1000),
        
        lots: Array.isArray(lots) ? lots : [],
        
        startAt: startAt || null,
        endAt: endAt || null,
        autoProlongate: !!autoProlongate,
        prolongationMinutes: prolongationMinutes ? parseInt(prolongationMinutes, 10) : null,
        maxProlongations: maxProlongations ? parseInt(maxProlongations, 10) : null,

        // top-level compatibility fields
        product: String(firstLot?.designation || title).slice(0, 200),
        quantity: parseFloat(lotQuantity),
        unit: String(lotUnit).slice(0, 50),

        targetPrice: firstLot?.priceCeiling ? parseFloat(firstLot.priceCeiling) : null,
        status: initialStatus,
        channel: 'app',
        createdAt: new Date().toISOString(),
        bids: [],
        acceptedBidId: null,
        acceptedLineId: null,
        alreadyRated: false,
        roundConfig,
        ...roundFields,
      };

      // Bloc B gate — a tender that fails never reaches producers; it's kept
      // as 'rejected' (audit trail) and only pushed back to the buyer's own
      // sessions, not broadcast like a normal auction.
      newAuction.validation = await validateTender(newAuction, db);
      if (!newAuction.validation.fair) {
        newAuction.status = 'rejected';
        newAuction.currentRound = null;
        newAuction.roundStartedAt = null;
      }

      await db.collection('auctions').insertOne(newAuction);

      if (newAuction.status === 'rejected') {
        const [sanitized] = sanitizeAuctions([newAuction], uid, activeView);
        io.to(userRoom(uid)).emit('auction_created', sanitized);
        return;
      }

      if (newAuction.status === 'open' && newAuction.roundConfig.enabled) {
        scheduleRoundTransitions(newAuction);
      }

      if (newAuction.status === 'open') {
        // Immediate auction — notify matching producers right away.
        await notifyMatchingProducers(newAuction, db, 'new_auction');
      } else {
        // Scheduled auction — notify immediately that it was created/planned,
        // then arm the precise "5 minutes left" reminder and the exact opening trigger.
        await notifyMatchingProducers(newAuction, db, 'auction_scheduled');
        scheduleAuctionNotifications(newAuction);
      }

      // Broadcast new auction — producers only receive demands within their zone and product match if smart
      await broadcastAuction(newAuction, db, 'auction_created');
    } catch (err) {
      logger.error({ err }, 'Error creating auction');
      socket.emit('error', { message: "Échec de la création de l'enchère." });
    }
  });

  // ── Update Auction (Buyer only, only while pending / not yet started) ──
  socket.on('update_auction', async (data) => {
    if (!roles.includes('buyer')) {
      socket.emit('error', { message: 'Seuls les acheteurs peuvent modifier une enchère.' });
      return;
    }

    const {
      auctionId,
      title,
      auctionType,
      deliveryLocation,
      description,
      lots,
      radius,
      isSearchZoneChanged,
      startAt,
      endAt,
      autoProlongate,
      prolongationMinutes,
      maxProlongations,
      roundConfig: rawRoundConfig,
    } = data;

    if (!auctionId) {
      socket.emit('error', { message: 'Enchère introuvable.' });
      return;
    }

    const firstLot = Array.isArray(lots) && lots.length > 0 ? lots[0] : null;
    const lotProduct = firstLot ? firstLot.productId : null;
    const lotQuantity = firstLot ? firstLot.quantity : null;
    const lotUnit = firstLot ? firstLot.unit : 'tonnes';

    if (!title || (!lotProduct && !firstLot?.designation) || !lotQuantity || !lotUnit) {
      socket.emit('error', { message: 'Champs obligatoires manquants (Titre, Produit, Quantité, Unité).' });
      return;
    }
    if (String(title).trim().length > 150) {
      socket.emit('error', { message: 'Le titre ne doit pas dépasser 150 caractères.' });
      return;
    }

    const roundConfig = normalizeRoundConfig(rawRoundConfig);
    if (roundConfig.enabled && !(firstLot?.priceCeiling > 0)) {
      socket.emit('error', { message: "Un prix plafond (prix de référence) est requis pour une enchère dégressive." });
      return;
    }

    try {
      const db = getDb();
      const auction = await db.collection('auctions').findOne({ id: auctionId });
      if (!auction) { socket.emit('error', { message: 'Enchère introuvable.' }); return; }
      if (auction.buyerId !== uid) { socket.emit('error', { message: 'Non autorisé.' }); return; }
      if (auction.status !== 'pending') {
        socket.emit('error', { message: "Seule une enchère non encore lancée peut être modifiée." });
        return;
      }

      const radiusKm = Math.min(Math.max(parseFloat(radius) || 100, 10), 2000);
      const now = new Date();
      const isFuture = startAt && new Date(startAt) > now;
      const newStatus = isFuture ? 'pending' : 'open';
      // Editing is only allowed while still 'pending' (checked above), so rounds
      // can never already be running here — either they start now, or wait for openAuction().
      const roundFields = roundConfig.enabled && newStatus === 'open'
        ? { currentRound: 1, roundStartedAt: now.toISOString() }
        : { currentRound: null, roundStartedAt: null };

      const updates = {
        radiusKm,
        isSearchZoneChanged: !!isSearchZoneChanged,
        title: String(title).slice(0, 150),
        auctionType: String(auctionType || 'open').slice(0, 100),
        deliveryLocation: String(deliveryLocation || '').slice(0, 300),
        description: String(description || '').slice(0, 1000),
        lots: Array.isArray(lots) ? lots : [],
        startAt: startAt || null,
        endAt: endAt || null,
        autoProlongate: !!autoProlongate,
        prolongationMinutes: prolongationMinutes ? parseInt(prolongationMinutes, 10) : null,
        maxProlongations: maxProlongations ? parseInt(maxProlongations, 10) : null,
        product: String(firstLot?.designation || title).slice(0, 200),
        quantity: parseFloat(lotQuantity),
        unit: String(lotUnit).slice(0, 50),
        targetPrice: firstLot?.priceCeiling ? parseFloat(firstLot.priceCeiling) : null,
        status: newStatus,
        roundConfig,
        ...roundFields,
      };

      // Bloc B gate — re-validate on every edit, since a buyer could lower
      // the price ceiling (or otherwise invalidate the tender) after creation.
      const validation = await validateTender({ ...auction, ...updates }, db);
      updates.validation = validation;
      if (!validation.fair) {
        updates.status = 'rejected';
        updates.currentRound = null;
        updates.roundStartedAt = null;
      }

      await db.collection('auctions').updateOne({ id: auctionId }, { $set: updates });
      const updatedAuction = await db.collection('auctions').findOne({ id: auctionId });

      clearAuctionTimers(auctionId);
      clearAuctionRoundTimers(auctionId);

      if (updatedAuction.status === 'rejected') {
        const [sanitized] = sanitizeAuctions([updatedAuction], uid, activeView);
        io.to(userRoom(uid)).emit('auction_updated', sanitized);
        return;
      }

      if (updatedAuction.status === 'open') {
        await notifyMatchingProducers(updatedAuction, db, 'new_auction');
        if (updatedAuction.roundConfig?.enabled) scheduleRoundTransitions(updatedAuction);
      } else {
        scheduleAuctionNotifications(updatedAuction);
      }

      await broadcastAuction(updatedAuction, db, 'auction_updated');
    } catch (err) {
      logger.error({ err }, 'Error updating auction');
      socket.emit('error', { message: "Échec de la modification de l'enchère." });
    }
  });

  // ── Delete Auction (Buyer only, only while pending / not yet started) ──
  socket.on('delete_auction', async (data) => {
    if (!roles.includes('buyer')) {
      socket.emit('error', { message: 'Seuls les acheteurs peuvent supprimer une enchère.' });
      return;
    }

    const { auctionId } = data;
    if (!auctionId) { socket.emit('error', { message: 'Enchère introuvable.' }); return; }

    try {
      const db = getDb();
      const auction = await db.collection('auctions').findOne({ id: auctionId });
      if (!auction) { socket.emit('error', { message: 'Enchère introuvable.' }); return; }
      if (auction.buyerId !== uid) { socket.emit('error', { message: 'Non autorisé.' }); return; }
      if (auction.status !== 'pending') {
        socket.emit('error', { message: "Seule une enchère non encore lancée peut être supprimée." });
        return;
      }

      clearAuctionTimers(auctionId);
      await notifyMatchingProducers(auction, db, 'auction_canceled');
      await db.collection('notifications').deleteMany({ auctionId, type: { $ne: 'auction_canceled' } });
      await db.collection('auctions').deleteOne({ id: auctionId });

      const allSockets = await io.fetchSockets();
      for (const s of allSockets) {
        s.emit('auction_deleted', { auctionId });
      }
    } catch (err) {
      logger.error({ err }, 'Error deleting auction');
      socket.emit('error', { message: "Échec de la suppression de l'enchère." });
    }
  });

  // ── Place Bid (Producer only) ────────────────────────────────────────
  socket.on('place_bid', async (data) => {
    if (!roles.includes('producer')) {
      socket.emit('error', { message: 'Seuls les producteurs peuvent faire des offres.' });
      return;
    }

    const { auctionId, lines } = data;
    if (!auctionId || !Array.isArray(lines) || lines.length === 0) {
      socket.emit('error', { message: 'Champs obligatoires manquants ou invalides.' });
      return;
    }

    try {
      const db = getDb();
      const auction = await db.collection('auctions').findOne({ id: auctionId });
      if (!auction) {
        socket.emit('error', { message: 'Enchère introuvable.' });
        return;
      }
      if (auction.status !== 'open') {
        socket.emit('error', { message: 'Enchère déjà clôturée.' });
        return;
      }

      // Fetch producer's current rating/quality averages, contact info and coordinates
      const { ObjectId } = await import('mongodb');
      const producerUser = await db.collection('users').findOne(
        { _id: new ObjectId(uid) },
        {
          projection: {
            name: 1, phone: 1, wilaya: 1, commune: 1,
            averageRating: 1, ratingCount: 1,
            averageQualityScore: 1, qualityScoreCount: 1,
            possede_chambre_froide: 1,
          },
        }
      );

      const pCoords = producerUser?.commune
        ? getCommuneCoords(producerUser.wilaya || '', producerUser.commune)
        : getWilayaCoords(producerUser?.wilaya || '');

      // Bloc C composite score's logistics criterion — null when either side's
      // coordinates can't be resolved, which normalizeLogisticsScore treats as neutral.
      const producerDistanceKm = (pCoords && auction.buyerLat != null && auction.buyerLng != null)
        ? haversineKm(auction.buyerLat, auction.buyerLng, pCoords.lat, pCoords.lng)
        : null;

      const allowed = await canProducerParticipate(auction, uid, pCoords, db);
      if (!allowed) {
        socket.emit('error', { message: "Vous n'êtes pas autorisé à soumissionner sur cette enchère." });
        return;
      }

      // Validate images and nested properties for each line
      const validatedLines = lines.slice(0, 5).map((l, i) => {
        const safeImages = Array.isArray(l.images)
          ? l.images.slice(0, 5).filter(img => typeof img === 'string' && img.startsWith('data:image/'))
          : [];
        const lineQuantity = parseFloat(l.quantity);
        return {
          id: `line_${Date.now()}_${randomBytes(2).toString('hex')}_${i}`,
          price: parseFloat(l.price),
          quantity: isNaN(lineQuantity) || lineQuantity <= 0 ? null : lineQuantity,
          optionName: String(l.optionName || '').slice(0, 100),
          unit: String(l.unit || auction.unit || 'tonnes').slice(0, 50),
          comments: String(l.comments || '').slice(0, 500),
          images: safeImages
        };
      });

      if (validatedLines.some(l => isNaN(l.price) || l.price <= 0)) {
        socket.emit('error', { message: 'Certains prix de vos options sont invalides.' });
        return;
      }

      // Consolidate: exactly one active bid document per producer on an auction
      const existingBidIndex = (auction.bids || []).findIndex(b => b.producerId === uid);
      const existingBid = existingBidIndex >= 0 ? auction.bids[existingBidIndex] : null;

      // Progressive ("enchère dégressive contrôlée") auctions track a single price
      // through rounds capped at roundConfig.maxDecreasePercent per round — multiple
      // simultaneous price options don't fit that model.
      let roundHistory;
      if (auction.roundConfig?.enabled) {
        if (validatedLines.length !== 1) {
          socket.emit('error', { message: "Cette enchère dégressive n'accepte qu'un seul prix par offre." });
          return;
        }
        const bounds = computeRoundPriceBounds(auction, existingBid);
        if (!bounds) {
          socket.emit('error', { message: "Configuration de l'enchère dégressive invalide." });
          return;
        }
        const price = validatedLines[0].price;
        const EPSILON = 0.01;
        if (price < bounds.min - EPSILON || price > bounds.max + EPSILON) {
          socket.emit('error', {
            message: `Le prix doit être compris entre ${bounds.min.toFixed(2)} et ${bounds.max.toFixed(2)} DA pour le tour ${bounds.round}.`,
          });
          return;
        }
        roundHistory = existingBid ? [...(existingBid.roundHistory || [])] : [];
        const idx = roundHistory.findIndex(h => h.round === bounds.round);
        const entry = { round: bounds.round, price, timestamp: new Date().toISOString() };
        if (idx >= 0) roundHistory[idx] = entry; else roundHistory.push(entry);
      }

      const newBid = {
        id: `bid_${Date.now()}_${randomBytes(4).toString('hex')}`,
        producerId: uid,
        lines: validatedLines,
        producerRating: producerUser?.averageRating ?? null,
        producerRatingCount: producerUser?.ratingCount ?? 0,
        // Bloc C composite score inputs (quality/logistics), denormalized at bid
        // time like producerRating above — avoids making sanitizeAuctions async.
        producerQualityScore: producerUser?.averageQualityScore ?? null,
        producerQualityScoreCount: producerUser?.qualityScoreCount ?? 0,
        producerHasColdChain: !!producerUser?.possede_chambre_froide,
        producerDistanceKm,
        // Bloc C anonymity lift: only ever surfaced by sanitizeAuctions for the
        // winning bid, and only once the auction is closed (see auctionMatching.js).
        producerName: producerUser?.name || '',
        producerPhone: producerUser?.phone || '',
        timestamp: new Date().toISOString(),
        ...(roundHistory ? { roundHistory } : {}),
      };

      if (existingBidIndex >= 0) {
        auction.bids[existingBidIndex] = newBid;
      } else {
        auction.bids.push(newBid);
      }

      await db.collection('auctions').updateOne(
        { id: auctionId },
        { $set: { bids: auction.bids } }
      );

      const updatedAuction = await db.collection('auctions').findOne({ id: auctionId });

      // Create persistent notification in DB for buyer
      const notifId = `notif_${Date.now()}_${randomBytes(3).toString('hex')}`;
      const notification = {
        id: notifId,
        userId: auction.buyerId,
        type: 'new_bid',
        auctionId: auction.id,
        product: auction.product,
        quantity: auction.quantity,
        unit: auction.unit,
        read: false,
        createdAt: new Date().toISOString(),
      };
      await db.collection('notifications').insertOne(notification);

      // Push real-time notification if buyer is connected
      io.to(userRoom(auction.buyerId)).emit('new_notification', notification);

      // Broadcast updated auction (sanitized per receiver)
      const candidateSockets = await getBroadcastCandidateSockets(updatedAuction);
      await Promise.all(candidateSockets.map(s => emitAuctionIfEligible(s, updatedAuction, db, 'auction_updated')));
    } catch (err) {
      logger.error({ err }, 'Error placing bid');
      socket.emit('error', { message: "Échec du dépôt d'offre." });
    }
  });

  // ── Accept Bid (Buyer only) — accepts the whole bid package ─────────
  socket.on('accept_bid', async (data) => {
    if (!roles.includes('buyer')) {
      socket.emit('error', { message: 'Seuls les acheteurs peuvent valider une offre.' });
      return;
    }

    const { auctionId, bidId } = data;
    if (!auctionId || !bidId) {
      socket.emit('error', { message: 'Données manquantes.' });
      return;
    }

    try {
      const db = getDb();
      const auction = await db.collection('auctions').findOne({ id: auctionId });
      if (!auction) { socket.emit('error', { message: 'Enchère introuvable.' }); return; }
      if (auction.status !== 'open') { socket.emit('error', { message: 'Enchère non ouverte.' }); return; }
      if (auction.buyerId !== uid) { socket.emit('error', { message: 'Non autorisé.' }); return; }

      const bid = auction.bids.find(b => b.id === bidId);
      if (!bid) { socket.emit('error', { message: 'Offre introuvable.' }); return; }

      // Bloc C anti-collusion — cheap heuristic, flag-only (see collusionDetection.js):
      // does this producer win an unusually large share of this buyer's recent auctions?
      const collusionFlag = await checkForCollusion(db, {
        buyerId: auction.buyerId, producerId: bid.producerId, excludeAuctionId: auctionId,
      });

      // Accept the whole bid (all quality lines as a package)
      await db.collection('auctions').updateOne(
        { id: auctionId },
        { $set: { status: 'closed', acceptedBidId: bidId, acceptedLineId: null, collusionFlag } }
      );

      const updatedAuction = await db.collection('auctions').findOne({ id: auctionId });

      // Notify the winning producer
      const acceptedLine = bid.lines?.length === 1
        ? bid.lines[0]
        : (bid.lines || []).find(l => l.id === auction.acceptedLineId) || null;
      const notifId = `notif_${Date.now()}_${randomBytes(3).toString('hex')}`;
      const notification = {
        id: notifId,
        userId: bid.producerId,
        type: 'bid_accepted',
        auctionId: auction.id,
        product: auction.product,
        price: acceptedLine?.price ?? null,
        unit: acceptedLine?.unit || auction.unit,
        optionCount: bid.lines?.length || 0,
        read: false,
        createdAt: new Date().toISOString(),
      };
      await db.collection('notifications').insertOne(notification);

      io.to(userRoom(bid.producerId)).emit('new_notification', notification);

      const candidateSockets = await getBroadcastCandidateSockets(updatedAuction);
      await Promise.all(candidateSockets.map(s => emitAuctionIfEligible(s, updatedAuction, db, 'auction_updated')));
    } catch (err) {
      logger.error({ err }, 'Error accepting bid');
      socket.emit('error', { message: 'Échec de la validation.' });
    }
  });

  // ── Submit Inspection (Buyer, after accepting bid) — Bloc D ──────────
  // Replaces the old single 1-5 "rate_producer": the buyer now confirms
  // conformity first, then gives two separate ratings — reliability (extends
  // averageRating, i.e. the Souk Score Producteur) and, only if the delivery
  // conforms, a quality rating (feeds the producer's quality score for their
  // *next* auctions, per decision #6 — never the current one). A conforming
  // inspection also books the Sougra commission to the buyer's account.
  socket.on('submit_inspection', async (data) => {
    if (!roles.includes('buyer')) {
      socket.emit('error', { message: 'Seuls les acheteurs peuvent inspecter une livraison.' });
      return;
    }

    const { auctionId, conforms, reliabilityRating, qualityRating } = data;
    const reliabilityNum = parseFloat(reliabilityRating);
    if (!auctionId || typeof conforms !== 'boolean' || isNaN(reliabilityNum) || reliabilityNum < 1 || reliabilityNum > 5) {
      socket.emit('error', { message: 'Données d\'inspection invalides.' });
      return;
    }
    let qualityNum = null;
    if (conforms) {
      qualityNum = parseFloat(qualityRating);
      if (isNaN(qualityNum) || qualityNum < 1 || qualityNum > 5) {
        socket.emit('error', { message: 'Note de qualité invalide.' });
        return;
      }
    }

    try {
      const db = getDb();
      const { ObjectId } = await import('mongodb');

      const auction = await db.collection('auctions').findOne({ id: auctionId });
      if (!auction) { socket.emit('error', { message: 'Enchère introuvable.' }); return; }
      if (auction.buyerId !== uid) { socket.emit('error', { message: 'Non autorisé.' }); return; }
      if (auction.status !== 'closed' || !auction.acceptedBidId) {
        socket.emit('error', { message: 'L\'enchère doit être clôturée pour inspecter la livraison.' });
        return;
      }
      if (auction.inspection) {
        socket.emit('error', { message: 'Cette livraison a déjà été inspectée.' });
        return;
      }

      // Find accepted bid to identify the producer and the accepted price
      const acceptedBid = auction.bids.find(b => b.id === auction.acceptedBidId);
      if (!acceptedBid) { socket.emit('error', { message: 'Offre acceptée introuvable.' }); return; }

      const producerId = acceptedBid.producerId;
      const acceptedLine = acceptedBid.lines?.length === 1
        ? acceptedBid.lines[0]
        : (acceptedBid.lines || []).find(l => l.id === auction.acceptedLineId) || acceptedBid.lines?.[0] || null;

      // Reliability always updates the producer's Souk Score (existing averageRating fields).
      await db.collection('users').updateOne(
        { _id: new ObjectId(producerId) },
        [
          {
            $set: {
              ratingSum: { $add: [{ $ifNull: ['$ratingSum', 0] }, reliabilityNum] },
              ratingCount: { $add: [{ $ifNull: ['$ratingCount', 0] }, 1] },
            },
          },
          { $set: { averageRating: { $divide: ['$ratingSum', '$ratingCount'] } } },
        ]
      );

      // Quality only counts on a conforming delivery — feeds the producer's
      // *next* auctions (Bloc C composite score), never this one.
      if (conforms) {
        await db.collection('users').updateOne(
          { _id: new ObjectId(producerId) },
          [
            {
              $set: {
                qualityScoreSum: { $add: [{ $ifNull: ['$qualityScoreSum', 0] }, qualityNum] },
                qualityScoreCount: { $add: [{ $ifNull: ['$qualityScoreCount', 0] }, 1] },
              },
            },
            { $set: { averageQualityScore: { $divide: ['$qualityScoreSum', '$qualityScoreCount'] } } },
          ]
        );
      }

      const inspection = {
        conforms,
        inspectedAt: new Date().toISOString(),
        reliabilityRating: reliabilityNum,
        qualityRating: qualityNum,
      };
      await db.collection('auctions').updateOne(
        { id: auctionId },
        { $set: { inspection, alreadyRated: true } }
      );

      // Store individual rating in ratings collection for audit
      await db.collection('ratings').insertOne({
        auctionId,
        buyerId: uid,
        producerId,
        rating: reliabilityNum,
        qualityRating: qualityNum,
        conforms,
        createdAt: new Date().toISOString(),
      });

      // A conforming delivery books the Sougra commission to the buyer's account.
      if (conforms && acceptedLine?.price > 0) {
        await recordCommission(db, {
          auctionId,
          buyerId: uid,
          producerId,
          acceptedPrice: parseFloat(acceptedLine.price),
        });
      }

      // Fetch updated producer rating
      const updatedProducer = await db.collection('users').findOne(
        { _id: new ObjectId(producerId) },
        { projection: { averageRating: 1, ratingCount: 1 } }
      );

      socket.emit('inspection_submitted', {
        auctionId,
        conforms,
        averageRating: updatedProducer?.averageRating ?? reliabilityNum,
        ratingCount: updatedProducer?.ratingCount ?? 1,
      });

      // Update auction's inspection status across all connections
      const updatedAuction = await db.collection('auctions').findOne({ id: auctionId });
      const candidateSockets = await getBroadcastCandidateSockets(updatedAuction);
      await Promise.all(candidateSockets.map(s => emitAuctionIfEligible(s, updatedAuction, db, 'auction_updated')));
    } catch (err) {
      logger.error({ err }, 'Error submitting inspection');
      socket.emit('error', { message: 'Échec de l\'inspection.' });
    }
  });

  socket.on('disconnect', () => {
    // Socket.IO removes the socket from its rooms (including userRoom(uid)) automatically.
    logger.info({ email: socket.data.user.email, socketId: socket.id }, 'User disconnected');
  });
});

// ─── Start Time Scheduler for Pending Auctions ────────────────────────────
// Safety-net fallback: the exact-time work is done by the per-auction timers set up in
// scheduleAuctionNotifications(). This poll only catches auctions whose timer could not be
// scheduled (e.g. server was down at the exact target time, or delay overflowed setTimeout's range).
async function checkPendingAuctions() {
  try {
    const db = getDb();
    const now = new Date().toISOString();

    const pendingAuctions = await db.collection('auctions').find({
      status: 'pending',
      startAt: { $ne: null, $lte: now }
    }).toArray();

    if (pendingAuctions.length === 0) return;

    logger.info({ count: pendingAuctions.length }, 'Fallback poll found pending auctions to open');
    for (const auction of pendingAuctions) {
      await openAuction(auction.id);
    }
  } catch (err) {
    logger.error({ err }, 'Error processing pending auctions');
  }
}

// Safety-net fallback for progressive-auction round transitions, mirroring checkPendingAuctions()
// above: the exact-time work is done by the per-auction timers in scheduleRoundTransitions().
async function checkAuctionRounds() {
  try {
    const db = getDb();
    const openRoundAuctions = await db.collection('auctions').find({
      status: 'open',
      'roundConfig.enabled': true,
      roundStartedAt: { $ne: null },
    }).toArray();

    const now = Date.now();
    for (const auction of openRoundAuctions) {
      const { totalRounds, roundDurationHours } = auction.roundConfig;
      const startMs = new Date(auction.roundStartedAt).getTime();
      const expectedRound = Math.min(totalRounds, Math.floor((now - startMs) / (roundDurationHours * 3600 * 1000)) + 1);
      if (expectedRound > (auction.currentRound || 1)) {
        await advanceAuctionRound(auction.id, expectedRound);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error checking auction rounds');
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
// Default to all interfaces so the app is reachable once deployed behind a reverse
// proxy or directly exposed; set HOST=127.0.0.1 to restrict to local-only access.
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    await connectToDatabase();
    await setupSocketAdapter(io);

    const db = getDb();
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ verificationToken: 1 }, { sparse: true });

    // One-time backfill for dual-role accounts: every account created before
    // this feature only ever had a single `role` string. Idempotent (only
    // touches documents missing `roles`), so it's safe to run on every startup.
    try {
      await db.collection('users').updateMany(
        { roles: { $exists: false } },
        [{ $set: { roles: ['$role'] } }]
      );
    } catch (err) {
      logger.error({ err }, 'Pipeline update for users.roles backfill failed — falling back to per-document update');
      const legacyUsers = await db.collection('users').find({ roles: { $exists: false } }, { projection: { role: 1 } }).toArray();
      for (const u of legacyUsers) {
        await db.collection('users').updateOne({ _id: u._id }, { $set: { roles: [u.role] } });
      }
    }
    await db.collection('auctions').createIndex({ id: 1 }, { unique: true });
    // Every auction listing query (initial Socket.IO snapshot, GET /api/auctions/older
    // pagination) sorts by createdAt — without this, each one is a full collection
    // scan + in-memory sort that gets slower as the auctions collection grows.
    await db.collection('auctions').createIndex({ createdAt: -1 });
    // Backs the checkPendingAuctions scheduler, which runs every 30s against the
    // whole collection filtered by status+startAt for as long as the server is up.
    await db.collection('auctions').createIndex({ status: 1, startAt: 1 });
    // Backs the checkAuctionRounds scheduler (same 30s-poll pattern, for progressive auctions).
    await db.collection('auctions').createIndex({ status: 1, 'roundConfig.enabled': 1 });
    // Backs the daily recomputeReferencePrices job (Bloc A), which scans closed/settled
    // auctions within a rolling window.
    await db.collection('auctions').createIndex({ status: 1, createdAt: -1 });
    await db.collection('referencePrices').createIndex({ productId: 1, wilaya: 1, unit: 1 }, { unique: true });
    // Bloc D — commission ledger. Backs the weekly statement job (groups
    // 'pending' entries per buyer) and the buyer-standing overdue check.
    await db.collection('commissionEntries').createIndex({ status: 1, buyerId: 1 });
    await db.collection('weeklyStatements').createIndex({ buyerId: 1, status: 1 });
    await db.collection('buyerAccounts').createIndex({ buyerId: 1 }, { unique: true });
    await db.collection('notifications').createIndex({ userId: 1, read: 1 });
    await db.collection('ratings').createIndex({ auctionId: 1, buyerId: 1 }, { unique: true });
    // Looked up on every producer connection/auction broadcast for smart-auction
    // product matching (canProducerParticipate -> hasProducerProduct) — one of the
    // hottest queries in the app under real traffic.
    await db.collection('parcelles').createIndex({ userId: 1 });
    // TTL index: auto-reaps abandoned/never-submitted CAPTCHA challenges.
    // Not relied on for security — every read already filters expiresAt itself.
    await db.collection('captcha_challenges').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    // Backs the admin stats' unique-visitor count (distinct ip) and the visits-over-time sort.
    await db.collection('siteVisits').createIndex({ createdAt: -1 });
    await db.collection('siteVisits').createIndex({ ip: 1 });
    // Backs GET /api/admin/users/:id's per-user IP history lookup.
    await db.collection('userLoginHistory').createIndex({ userId: 1, createdAt: -1 });
    // Backs GET /api/admin/users/:id's per-user AI chat history lookup.
    await db.collection('aiChatLogs').createIndex({ userId: 1, createdAt: -1 });
    // Backs the admin Support tab's status filter + open-ticket stat tile.
    await db.collection('supportMessages').createIndex({ status: 1, createdAt: -1 });
    // Backs the admin Send Email tab's sent-history list.
    await db.collection('sentEmails').createIndex({ sentAt: -1 });

    // Restores the admin-configured Bloc C score weights, if any were ever
    // saved (see PUT /api/admin/score-weights) — otherwise compositeScoring.js
    // keeps its built-in default (Price 35 / Quality 25 / Souk 25 / Logistics 15).
    const savedWeights = await db.collection('settings').findOne({ _id: 'scoreWeights' });
    if (savedWeights) {
      setScoreWeights({ price: savedWeights.price, quality: savedWeights.quality, souk: savedWeights.souk, logistics: savedWeights.logistics });
    }

    // Recover precise timers for auctions still pending from before a restart
    const pendingAuctions = await db.collection('auctions').find({ status: 'pending' }).toArray();
    for (const auction of pendingAuctions) {
      scheduleAuctionNotifications(auction);
    }
    // Recover precise round-transition timers for progressive auctions already open before a restart
    const openRoundAuctions = await db.collection('auctions').find({ status: 'open', 'roundConfig.enabled': true }).toArray();
    for (const auction of openRoundAuctions) {
      scheduleRoundTransitions(auction);
    }

    // Setup periodic schedulers (every 30 seconds) — fallback safety nets only
    const schedulerInterval = setInterval(checkPendingAuctions, 30000);
    const roundSchedulerInterval = setInterval(checkAuctionRounds, 30000);
    // Run once immediately on startup
    checkPendingAuctions().catch(err => logger.error({ err }, 'Scheduler start error'));
    checkAuctionRounds().catch(err => logger.error({ err }, 'Round scheduler start error'));

    // Bloc A — daily reference-price recompute. Unlike the two pollers above
    // (fallback safety nets for precise per-auction timers), this has no
    // real-time counterpart: it's the only thing that ever refreshes
    // referencePrices, so it must run once on startup and then every 24h.
    const REFERENCE_RECOMPUTE_INTERVAL_MS = 24 * 60 * 60 * 1000;
    const referenceRecomputeInterval = setInterval(() => {
      recomputeReferencePrices(db).catch(err => logger.error({ err }, 'Reference price recompute error'));
    }, REFERENCE_RECOMPUTE_INTERVAL_MS);
    recomputeReferencePrices(db).catch(err => logger.error({ err }, 'Reference price recompute error'));

    // Bloc D — weekly commission statements. Same pattern as the reference
    // recompute above: runs once on startup, then every 7 days. Note this
    // means a server that restarts more often than weekly (frequent redeploys)
    // will issue smaller, more-frequent statements rather than strictly
    // weekly ones — acceptable for now, same tradeoff as the Bloc A job.
    const WEEKLY_STATEMENT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
    const weeklyStatementInterval = setInterval(() => {
      generateWeeklyStatements(db).catch(err => logger.error({ err }, 'Weekly statement generation error'));
    }, WEEKLY_STATEMENT_INTERVAL_MS);
    generateWeeklyStatements(db).catch(err => logger.error({ err }, 'Weekly statement generation error'));

    httpServer.listen(PORT, HOST, () => {
      logger.info({ host: HOST, port: PORT }, 'Server running');
    });

    setupGracefulShutdown([schedulerInterval, roundSchedulerInterval, referenceRecomputeInterval, weeklyStatementInterval]);
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Render (and most PaaS hosts) send SIGTERM before killing a container on
// every redeploy/restart/scale-down — without handling it, in-flight HTTP
// requests and Socket.IO connections get dropped mid-response instead of
// finishing cleanly, and the Mongo connection is never closed.
let shuttingDown = false;
function setupGracefulShutdown(schedulerIntervals) {
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully...');
    schedulerIntervals.forEach(clearInterval);

    // Safety net: if closing sockets/connections hangs, exit anyway rather
    // than leaving the platform to hard-kill the process after its own
    // (usually longer, less clean) timeout.
    const forceExitTimer = setTimeout(() => {
      logger.warn('Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    io.close(() => {
      httpServer.close(async () => {
        clearTimeout(forceExitTimer);
        try {
          await closeConnection();
        } catch (err) {
          logger.error({ err }, 'Error closing MongoDB connection during shutdown');
        }
        logger.info('Shutdown complete.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Catches what try/catch and logger.error's Sentry hook (see utils/logger.js)
// can't: errors thrown outside any request handler (timers, event listeners).
// Per Node's own guidance, the process is in an undefined state after an
// uncaughtException — report it, then exit and let the platform restart us,
// rather than limping on. unhandledRejection is logged but not fatal, since
// unlike uncaughtException it doesn't leave the process in a known-broken state.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'UNCAUGHT EXCEPTION');
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
    Sentry.close(2000).finally(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'UNHANDLED REJECTION');
});

startServer();
