import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import jwt from 'jsonwebtoken';
import pinoHttp from 'pino-http';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectToDatabase, getDb } from './db.js';
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
} from './services/auctionMatching.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
// real one. TRUST_PROXY=1 opts into trusting the first hop's X-Forwarded-*
// headers; leave it unset for direct/local (no proxy in front) deployments.
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
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
});
app.use('/api', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans une minute.' },
});
app.use('/api/auth', authLimiter);

// ─── Static File Serving (uploads) ────────────────────────────────────────
// Profile photos and identity/legal documents (RC, fiche signalétique, carte
// agriculteur) live here — UUID filenames alone aren't access control, so require
// a valid session. <img>/<a> tags can't set an Authorization header, so a token
// query param is accepted as a fallback.
app.use('/uploads', (req, res, next) => {
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
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  next();
}, express.static(path.join(__dirname, 'uploads')));

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

// Producers count within a radius
app.get('/api/producers/count', async (req, res) => {
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
    const producers = await db.collection('users').find({ role: 'producer', isVerified: true }).toArray();

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

    let auctions = await db.collection('auctions')
      .find({ createdAt: { $lt: before.toISOString() } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    if (role === 'producer') {
      const { ObjectId } = await import('mongodb');
      const producerUser = await db.collection('users').findOne(
        { _id: new ObjectId(uid) },
        { projection: { wilaya: 1, commune: 1 } }
      );
      const producerCoords = producerUser?.commune
        ? getCommuneCoords(producerUser.wilaya || '', producerUser.commune)
        : getWilayaCoords(producerUser?.wilaya || '');

      const checks = await Promise.all(auctions.map(async a =>
        (a.status !== 'pending' && await canProducerParticipate(a, uid, producerCoords, db)) ? a : null
      ));
      auctions = checks.filter(Boolean);
    }

    const sanitized = sanitizeAuctions(auctions, uid, role);
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

// Per-user Socket.IO room, used for targeted delivery. Room-based (rather than
// tracking raw socket IDs ourselves) so `io.to(userRoom(id)).emit(...)` fans out
// correctly across instances once the Redis adapter below is active.
const userRoom = (userId) => `user:${userId}`;

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
  const producers = await db.collection('users').find({ role: 'producer', isVerified: true }).toArray();

  // Each producer's zone/product eligibility is independent of the others —
  // run them concurrently instead of one-at-a-time.
  const results = await Promise.all(producers.map(async producer => {
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

/** Broadcasts a sanitized version of the auction to every connected socket (zone/product filtered for producers). */
async function broadcastAuction(auction, db, eventName = 'auction_updated') {
  // Fetch buyers (always eligible) and only the producers whose wilaya room
  // could plausibly be in range, instead of every connected socket — the
  // exact per-producer check below still runs, just over a far smaller set.
  const buyerSockets = await io.in('role:buyer').fetchSockets();
  const producerSockets = auction.status === 'pending'
    ? []
    : await io.in(getEligibleWilayaRooms(auction.buyerLat, auction.buyerLng, auction.radiusKm)).fetchSockets();
  const candidateSockets = [...buyerSockets, ...producerSockets];

  // Each socket's eligibility check + emit is independent — run them
  // concurrently. Sequentially awaiting one socket at a time made every
  // broadcast's cost scale with the size of the candidate set.
  await Promise.all(candidateSockets.map(async s => {
    if (s.data.user.role === 'producer') {
      const allowed = await canProducerParticipate(auction, s.data.user.userId, s.data.producerCoords, db);
      if (!allowed) return;
    }
    const [sanitized] = sanitizeAuctions([auction], s.data.user.userId, s.data.user.role);
    s.emit(eventName, sanitized);
  }));
}

function clearAuctionTimers(auctionId) {
  const timers = auctionTimers.get(auctionId);
  if (timers) {
    if (timers.fiveMin) clearTimeout(timers.fiveMin);
    if (timers.start) clearTimeout(timers.start);
    auctionTimers.delete(auctionId);
  }
}

/** Flips a pending auction to open, notifies matching producers, and broadcasts — called exactly at startAt. */
async function openAuction(auctionId) {
  try {
    const db = getDb();
    const auction = await db.collection('auctions').findOne({ id: auctionId });
    if (!auction || auction.status !== 'pending') return;

    await db.collection('auctions').updateOne({ id: auctionId }, { $set: { status: 'open' } });
    auction.status = 'open';

    clearAuctionTimers(auctionId);
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
  const role = socket.data.user.role;

  // Room-based presence — works for targeted delivery across instances once
  // the Redis adapter is active, and Socket.IO cleans it up on disconnect.
  socket.join(userRoom(uid));

  logger.info({ email: socket.data.user.email, role, socketId: socket.id }, 'User connected');

  // Resolve producer geographic coordinates for zone-based filtering
  socket.data.producerCoords = null;

  try {
    const db = getDb();
    const { ObjectId } = await import('mongodb');

    if (role === 'producer') {
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
    } else if (role === 'buyer') {
      socket.join('role:buyer');
    }

    // Send initial auctions list — producers only see demands matching their zone & product if smart.
    // Capped to the most recent page; older auctions are fetched on demand via GET /api/auctions/older.
    const totalAuctionsCount = await db.collection('auctions').countDocuments({});
    let auctions = await db.collection('auctions').find({}).sort({ createdAt: -1 }).limit(INITIAL_AUCTIONS_LIMIT).toArray();
    if (role === 'producer') {
      const checks = await Promise.all(auctions.map(async a =>
        (a.status !== 'pending' && await canProducerParticipate(a, uid, socket.data.producerCoords, db)) ? a : null
      ));
      auctions = checks.filter(Boolean);
    }

    const sanitized = sanitizeAuctions(auctions, uid, role);
    socket.emit('auctions_list', sanitized, { hasMore: totalAuctionsCount > INITIAL_AUCTIONS_LIMIT });
  } catch (err) {
    logger.error({ err }, 'Error fetching initial auctions');
  }

  // ── Create Auction (Buyer only) ──────────────────────────────────────
  socket.on('create_auction', async (data) => {
    if (role !== 'buyer') {
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
      maxProlongations
    } = data;

    const firstLot = Array.isArray(lots) && lots.length > 0 ? lots[0] : null;
    const lotProduct = firstLot ? firstLot.productId : null;
    const lotQuantity = firstLot ? firstLot.quantity : null;
    const lotUnit = firstLot ? firstLot.unit : 'tonnes';

    if (!title || (!lotProduct && !firstLot?.designation) || !lotQuantity || !lotUnit) {
      socket.emit('error', { message: 'Champs obligatoires manquants (Titre, Produit, Quantité, Unité).' });
      return;
    }

    try {
      const db = getDb();

      // Fetch buyer's profile to get wilaya/commune
      const { ObjectId } = await import('mongodb');
      const buyer = await db.collection('users').findOne(
        { _id: new ObjectId(uid) },
        { projection: { name: 1, wilaya: 1, commune: 1 } }
      );

      // Resolve buyer's approximate coordinates
      const buyerCoords = buyer?.commune
        ? getCommuneCoords(buyer.wilaya || '', buyer.commune)
        : getWilayaCoords(buyer?.wilaya || '');

      const radiusKm = Math.min(Math.max(parseFloat(radius) || 100, 10), 2000);
      const now = new Date();
      const isFuture = startAt && new Date(startAt) > now;
      const initialStatus = isFuture ? 'pending' : 'open';

      const newAuction = {
        id: `auc_${Date.now()}_${randomBytes(4).toString('hex')}`,
        buyerId: uid,
        buyerName: buyer?.name || 'Acheteur',
        buyerWilaya: buyer?.wilaya || '',
        buyerCommune: buyer?.commune || '',
        buyerLat: buyerCoords?.lat ?? null,
        buyerLng: buyerCoords?.lng ?? null,
        radiusKm,
        isSearchZoneChanged: !!isSearchZoneChanged,
        
        title: String(title).slice(0, 200),
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
        createdAt: new Date().toISOString(),
        bids: [],
        acceptedBidId: null,
        acceptedLineId: null,
        alreadyRated: false,
      };

      await db.collection('auctions').insertOne(newAuction);

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
    if (role !== 'buyer') {
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
      maxProlongations
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

      const updates = {
        radiusKm,
        isSearchZoneChanged: !!isSearchZoneChanged,
        title: String(title).slice(0, 200),
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
      };

      await db.collection('auctions').updateOne({ id: auctionId }, { $set: updates });
      const updatedAuction = await db.collection('auctions').findOne({ id: auctionId });

      clearAuctionTimers(auctionId);
      if (updatedAuction.status === 'open') {
        await notifyMatchingProducers(updatedAuction, db, 'new_auction');
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
    if (role !== 'buyer') {
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
    if (role !== 'producer') {
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

      // Fetch producer's current rating averages and coordinates
      const { ObjectId } = await import('mongodb');
      const producerUser = await db.collection('users').findOne(
        { _id: new ObjectId(uid) },
        { projection: { wilaya: 1, commune: 1, averageRating: 1, ratingCount: 1 } }
      );

      const pCoords = producerUser?.commune
        ? getCommuneCoords(producerUser.wilaya || '', producerUser.commune)
        : getWilayaCoords(producerUser?.wilaya || '');

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

      const newBid = {
        id: `bid_${Date.now()}_${randomBytes(4).toString('hex')}`,
        producerId: uid,
        lines: validatedLines,
        producerRating: producerUser?.averageRating ?? null,
        producerRatingCount: producerUser?.ratingCount ?? 0,
        timestamp: new Date().toISOString(),
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
      // Fetch buyers (always eligible) plus only the producers in wilaya
      // rooms that could plausibly be in range — see broadcastAuction() above.
      const buyerSockets = await io.in('role:buyer').fetchSockets();
      const producerSockets = await io.in(getEligibleWilayaRooms(updatedAuction.buyerLat, updatedAuction.buyerLng, updatedAuction.radiusKm)).fetchSockets();
      const candidateSockets = [...buyerSockets, ...producerSockets];
      await Promise.all(candidateSockets.map(async s => {
        if (s.data.user.role === 'producer') {
          const allowed = await canProducerParticipate(updatedAuction, s.data.user.userId, s.data.producerCoords, db);
          if (!allowed) return;
        }
        const [sanitized] = sanitizeAuctions([updatedAuction], s.data.user.userId, s.data.user.role);
        s.emit('auction_updated', sanitized);
      }));
    } catch (err) {
      logger.error({ err }, 'Error placing bid');
      socket.emit('error', { message: "Échec du dépôt d'offre." });
    }
  });

  // ── Accept Bid (Buyer only) — accepts the whole bid package ─────────
  socket.on('accept_bid', async (data) => {
    if (role !== 'buyer') {
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

      // Accept the whole bid (all quality lines as a package)
      await db.collection('auctions').updateOne(
        { id: auctionId },
        { $set: { status: 'closed', acceptedBidId: bidId, acceptedLineId: null } }
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

      // Fetch buyers (always eligible) plus only the producers in wilaya
      // rooms that could plausibly be in range — see broadcastAuction() above.
      const buyerSockets = await io.in('role:buyer').fetchSockets();
      const producerSockets = await io.in(getEligibleWilayaRooms(updatedAuction.buyerLat, updatedAuction.buyerLng, updatedAuction.radiusKm)).fetchSockets();
      const candidateSockets = [...buyerSockets, ...producerSockets];
      await Promise.all(candidateSockets.map(async s => {
        if (s.data.user.role === 'producer') {
          const allowed = await canProducerParticipate(updatedAuction, s.data.user.userId, s.data.producerCoords, db);
          if (!allowed) return;
        }
        const [sanitized] = sanitizeAuctions([updatedAuction], s.data.user.userId, s.data.user.role);
        s.emit('auction_updated', sanitized);
      }));
    } catch (err) {
      logger.error({ err }, 'Error accepting bid');
      socket.emit('error', { message: 'Échec de la validation.' });
    }
  });

  // ── Rate Producer (Buyer, after accepting bid) ──────────────────────
  socket.on('rate_producer', async (data) => {
    if (role !== 'buyer') {
      socket.emit('error', { message: 'Seuls les acheteurs peuvent noter les producteurs.' });
      return;
    }

    const { auctionId, rating } = data;
    const ratingNum = parseFloat(rating);
    if (!auctionId || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      socket.emit('error', { message: 'Données de notation invalides.' });
      return;
    }

    try {
      const db = getDb();
      const { ObjectId } = await import('mongodb');

      const auction = await db.collection('auctions').findOne({ id: auctionId });
      if (!auction) { socket.emit('error', { message: 'Enchère introuvable.' }); return; }
      if (auction.buyerId !== uid) { socket.emit('error', { message: 'Non autorisé.' }); return; }
      if (auction.status !== 'closed' || !auction.acceptedBidId) {
        socket.emit('error', { message: 'L\'enchère doit être clôturée pour noter.' });
        return;
      }
      if (auction.alreadyRated) {
        socket.emit('error', { message: 'Vous avez déjà noté ce producteur pour cette enchère.' });
        return;
      }

      // Find accepted bid to identify the producer
      const acceptedBid = auction.bids.find(b => b.id === auction.acceptedBidId);
      if (!acceptedBid) { socket.emit('error', { message: 'Offre acceptée introuvable.' }); return; }

      const producerId = acceptedBid.producerId;

      // Update producer's average rating using $inc for atomic update
      await db.collection('users').updateOne(
        { _id: new ObjectId(producerId) },
        [
          {
            $set: {
              ratingSum: { $add: [{ $ifNull: ['$ratingSum', 0] }, ratingNum] },
              ratingCount: { $add: [{ $ifNull: ['$ratingCount', 0] }, 1] },
            },
          },
          {
            $set: {
              averageRating: { $divide: ['$ratingSum', '$ratingCount'] },
            },
          },
        ]
      );

      // Mark auction as rated so buyer cannot rate twice
      await db.collection('auctions').updateOne(
        { id: auctionId },
        { $set: { alreadyRated: true } }
      );

      // Store individual rating in ratings collection for audit
      await db.collection('ratings').insertOne({
        auctionId,
        buyerId: uid,
        producerId,
        rating: ratingNum,
        createdAt: new Date().toISOString(),
      });

      // Fetch updated producer rating
      const updatedProducer = await db.collection('users').findOne(
        { _id: new ObjectId(producerId) },
        { projection: { averageRating: 1, ratingCount: 1 } }
      );

      socket.emit('rating_submitted', {
        auctionId,
        averageRating: updatedProducer?.averageRating ?? ratingNum,
        ratingCount: updatedProducer?.ratingCount ?? 1,
      });

      // Update auction's alreadyRated flag across all connections
      const updatedAuction = await db.collection('auctions').findOne({ id: auctionId });
      // Fetch buyers (always eligible) plus only the producers in wilaya
      // rooms that could plausibly be in range — see broadcastAuction() above.
      const buyerSockets = await io.in('role:buyer').fetchSockets();
      const producerSockets = await io.in(getEligibleWilayaRooms(updatedAuction.buyerLat, updatedAuction.buyerLng, updatedAuction.radiusKm)).fetchSockets();
      const candidateSockets = [...buyerSockets, ...producerSockets];
      await Promise.all(candidateSockets.map(async s => {
        if (s.data.user.role === 'producer') {
          const allowed = await canProducerParticipate(updatedAuction, s.data.user.userId, s.data.producerCoords, db);
          if (!allowed) return;
        }
        const [sanitized] = sanitizeAuctions([updatedAuction], s.data.user.userId, s.data.user.role);
        s.emit('auction_updated', sanitized);
      }));
    } catch (err) {
      logger.error({ err }, 'Error rating producer');
      socket.emit('error', { message: 'Échec de la notation.' });
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
    await db.collection('auctions').createIndex({ id: 1 }, { unique: true });
    // Every auction listing query (initial Socket.IO snapshot, GET /api/auctions/older
    // pagination) sorts by createdAt — without this, each one is a full collection
    // scan + in-memory sort that gets slower as the auctions collection grows.
    await db.collection('auctions').createIndex({ createdAt: -1 });
    // Backs the checkPendingAuctions scheduler, which runs every 30s against the
    // whole collection filtered by status+startAt for as long as the server is up.
    await db.collection('auctions').createIndex({ status: 1, startAt: 1 });
    await db.collection('notifications').createIndex({ userId: 1, read: 1 });
    await db.collection('ratings').createIndex({ auctionId: 1, buyerId: 1 }, { unique: true });
    // Looked up on every producer connection/auction broadcast for smart-auction
    // product matching (canProducerParticipate -> hasProducerProduct) — one of the
    // hottest queries in the app under real traffic.
    await db.collection('parcelles').createIndex({ userId: 1 });
    // TTL index: auto-reaps abandoned/never-submitted CAPTCHA challenges.
    // Not relied on for security — every read already filters expiresAt itself.
    await db.collection('captcha_challenges').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // Recover precise timers for auctions still pending from before a restart
    const pendingAuctions = await db.collection('auctions').find({ status: 'pending' }).toArray();
    for (const auction of pendingAuctions) {
      scheduleAuctionNotifications(auction);
    }

    // Setup periodic scheduler (every 30 seconds) — fallback safety net only
    setInterval(checkPendingAuctions, 30000);
    // Run once immediately on startup
    checkPendingAuctions().catch(err => logger.error({ err }, 'Scheduler start error'));

    httpServer.listen(PORT, HOST, () => {
      logger.info({ host: HOST, port: PORT }, 'Server running');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
