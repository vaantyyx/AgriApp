import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { connectToDatabase, getDb } from './db.js';
import { getRedis, getRedisPubSub } from './redisClient.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import notificationsRoutes from './routes/notifications.js';
import parcellesRoutes from './routes/parcelles.js';
import captchaRoutes from './routes/captcha.js';
import { CAPTCHA_CATEGORIES } from './services/captchaCategories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── JWT Secret bootstrap ──────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  const ephemeral = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = ephemeral;
  console.warn('[SECURITY WARNING] JWT_SECRET not set in .env — using ephemeral secret. All sessions will be invalidated on restart!');
}

// Login is hard-gated behind the CAPTCHA, so an empty/broken category
// catalog would lock everyone out — warn loudly rather than fail silently.
if (Object.keys(CAPTCHA_CATEGORIES).length < 4) {
  console.warn('[CAPTCHA WARNING] Fewer than 4 categories in captchaCategories.js — CAPTCHA grids may fail to generate, blocking all logins.');
}

// ─── App Setup ────────────────────────────────────────────────────────────
const app = express();

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
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────
// Backed by Redis instead of the default in-memory store: with multiple
// backend instances behind a load balancer, an in-memory counter only sees
// the requests that happen to land on that one instance, so an attacker can
// trivially bypass the limit by spreading requests across instances. Redis
// is already connected by the time this line runs — see redisClient.js's
// top-level await.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans une minute.' },
  store: new RedisStore({
    sendCommand: (...args) => getRedis().call(...args),
    prefix: 'rl:auth:',
  }),
});
app.use('/api/auth', authLimiter);

// ─── Static File Serving (uploads) ────────────────────────────────────────
app.use('/uploads', (req, res, next) => {
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/parcelles', parcellesRoutes);
app.use('/api/captcha', captchaRoutes);

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

    let count = 0;
    for (const producer of producers) {
      const pCoords = producer.commune
        ? getCommuneCoords(producer.wilaya || '', producer.commune)
        : getWilayaCoords(producer.wilaya || '');

      if (!pCoords) continue;

      const dist = haversineKm(lat, lng, pCoords.lat, pCoords.lng);
      if (dist <= radius) {
        if (auctionType === 'smart' && requestedProductNames.length > 0) {
          const hasProduct = await hasProducerProduct(producer._id.toString(), requestedProductNames, db);
          if (hasProduct) {
            count++;
          }
        } else {
          count++;
        }
      }
    }

    res.json({ count });
  } catch (error) {
    console.error('[API] Error counting producers:', error.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── Geographic Helpers (Haversine) ───────────────────────────────────────
// Approximate centers of Algeria's 69 wilayas
const WILAYA_COORDS = {
  1:{lat:27.87,lng:-0.29},2:{lat:36.17,lng:1.33},3:{lat:33.80,lng:2.88},
  4:{lat:35.93,lng:7.11},5:{lat:35.56,lng:6.17},6:{lat:36.75,lng:5.08},
  7:{lat:34.85,lng:5.73},8:{lat:31.61,lng:-2.21},9:{lat:36.47,lng:2.83},
  10:{lat:36.37,lng:3.90},11:{lat:22.79,lng:5.52},12:{lat:35.40,lng:8.12},
  13:{lat:34.88,lng:-1.32},14:{lat:35.37,lng:1.32},15:{lat:36.71,lng:4.05},
  16:{lat:36.73,lng:3.09},17:{lat:34.67,lng:3.25},18:{lat:36.82,lng:5.77},
  19:{lat:36.19,lng:5.41},20:{lat:34.83,lng:0.15},21:{lat:36.90,lng:6.91},
  22:{lat:35.19,lng:-0.63},23:{lat:36.90,lng:7.77},24:{lat:36.46,lng:7.43},
  25:{lat:36.37,lng:6.61},26:{lat:36.27,lng:2.75},27:{lat:35.93,lng:0.09},
  28:{lat:35.70,lng:4.54},29:{lat:35.40,lng:0.14},30:{lat:31.95,lng:5.33},
  31:{lat:35.70,lng:-0.63},32:{lat:33.68,lng:1.02},33:{lat:26.50,lng:8.47},
  34:{lat:36.07,lng:4.76},35:{lat:36.77,lng:3.48},36:{lat:36.77,lng:8.31},
  37:{lat:27.67,lng:-8.14},38:{lat:35.59,lng:1.81},39:{lat:33.37,lng:6.86},
  40:{lat:35.43,lng:7.14},41:{lat:36.29,lng:7.94},42:{lat:36.58,lng:2.46},
  43:{lat:36.45,lng:6.27},44:{lat:36.26,lng:1.97},45:{lat:33.27,lng:-0.31},
  46:{lat:35.30,lng:-1.14},47:{lat:32.49,lng:3.67},48:{lat:35.73,lng:0.56},
  49:{lat:29.26,lng:0.23},50:{lat:21.33,lng:0.95},51:{lat:34.42,lng:5.07},
  52:{lat:30.13,lng:-2.16},53:{lat:27.22,lng:2.47},54:{lat:19.57,lng:5.77},
  55:{lat:33.09,lng:6.06},56:{lat:24.56,lng:9.48},57:{lat:33.93,lng:6.13},
  58:{lat:30.58,lng:2.88},59:{lat:33.81,lng:2.01},60:{lat:32.89,lng:0.53},
  61:{lat:34.22,lng:-1.26},62:{lat:35.02,lng:5.73},63:{lat:35.38,lng:5.37},
  64:{lat:35.21,lng:4.18},65:{lat:35.01,lng:7.94},66:{lat:35.88,lng:2.75},
  67:{lat:35.18,lng:2.32},68:{lat:35.45,lng:2.64},69:{lat:34.15,lng:3.55},
};

const WILAYA_NAME_TO_ID = {
  'adrar':1,'chlef':2,'laghouat':3,'oum el bouaghi':4,'batna':5,'bejaia':6,
  'biskra':7,'bechar':8,'blida':9,'bouira':10,'tamanrasset':11,'tebessa':12,
  'tlemcen':13,'tiaret':14,'tizi ouzou':15,'alger':16,'djelfa':17,'jijel':18,
  'setif':19,'saida':20,'skikda':21,'sidi bel abbes':22,'annaba':23,'guelma':24,
  'constantine':25,'medea':26,'mostaganem':27,"m'sila":28,'mascara':29,
  'ouargla':30,'oran':31,'el bayadh':32,'illizi':33,'bordj bou arreridj':34,
  'boumerdes':35,'el tarf':36,'tindouf':37,'tissemsilt':38,'el oued':39,
  'khenchela':40,'souk ahras':41,'tipaza':42,'mila':43,'ain defla':44,
  'naama':45,'ain temouchent':46,'ghardaia':47,'relizane':48,'timimoun':49,
  'bordj badji mokhtar':50,'ouled djellal':51,'beni abbes':52,'in salah':53,
  'in guezzam':54,'touggourt':55,'djanet':56,"el m'ghair":57,'el meniaa':58,
  'aflou':59,'el abiodh sidi cheikh':60,'el aricha':61,'el kantara':62,
  'barika':63,'bou saada':64,'bir el ater':65,'ksar el boukhari':66,
  'ksar chellala':67,'ain oussara':68,'messaad':69,
};

function toRad(d) { return d * Math.PI / 180; }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns approximate coordinates for a wilaya by name. */
function getWilayaCoords(wilayaName) {
  if (!wilayaName) return null;
  const id = WILAYA_NAME_TO_ID[wilayaName.toLowerCase().trim()];
  return id ? WILAYA_COORDS[id] : null;
}

/** Deterministic commune offset so each commune has a unique stable position. */
function getCommuneCoords(wilayaName, communeName) {
  const base = getWilayaCoords(wilayaName);
  if (!base) return null;
  // Derive a numeric seed from communeName characters
  let seed = 0;
  for (let i = 0; i < communeName.length; i++) {
    seed = (seed * 31 + communeName.charCodeAt(i)) >>> 0;
  }
  const u1 = ((seed & 0xFFFF) / 0xFFFF) - 0.5;
  const u2 = (((seed >>> 16) & 0xFFFF) / 0xFFFF) - 0.5;
  return { lat: base.lat + u1 * 0.45, lng: base.lng + u2 * 0.45 };
}

/**
 * Returns true if the producer (at pCoords) is within the buyer's search zone.
 * Falls back to true when coordinates are unknown (show auction by default).
 */
function isProducerInZone(auction, pCoords) {
  if (!pCoords) return true;
  if (!auction.buyerLat || !auction.buyerLng) return true;
  const dist = haversineKm(auction.buyerLat, auction.buyerLng, pCoords.lat, pCoords.lng);
  return dist <= (auction.radiusKm || 100);
}

// ─── Products Map for Smart Auctions ─────────────────────────────────────
const PRODUCTS_MAP = {
  '1': 'Blé Dur',
  '2': 'Blé Tendre',
  '3': 'Orge',
  '4': 'Maïs',
  '5': 'Avoine',
  '6': 'Légumineuses',
  '7': 'Olivier',
  '8': 'Pommier',
  '9': 'Agrumes',
  '10': 'Datte',
  '11': 'Amandier',
  '12': 'Cerisier',
  '13': 'Figuier',
  '14': 'Abricotier',
  '15': 'Tomate',
  '16': 'Pomme de terre',
  '17': 'Oignon',
  '18': 'Piment',
  '19': 'Laitue',
  '20': 'Carotte',
  '21': 'Melon',
  '22': 'Pastèque',
  '23': 'Luzerne',
  '24': 'Sorgho',
  '25': 'Bersim',
  '26': 'Maïs fourrager',
  '27': 'Raisin de table',
  '28': 'Raisin de cuve',
};

async function hasProducerProduct(producerId, requestedProductNames, db) {
  if (!requestedProductNames || requestedProductNames.length === 0) return true;
  const parcelles = await db.collection('parcelles').find({ userId: producerId }).toArray();
  for (const p of parcelles) {
    if (!p.cultures) continue;
    for (const c of p.cultures) {
      if (!c.sous_type_culture) continue;
      const match = c.sous_type_culture.some(prodName => 
        requestedProductNames.some(reqName => reqName.toLowerCase().trim() === prodName.toLowerCase().trim())
      );
      if (match) return true;
    }
  }
  return false;
}

async function canProducerParticipate(auction, producerId, pCoords, db) {
  if (!isProducerInZone(auction, pCoords)) return false;
  
  if (auction.auctionType === 'smart') {
    const requestedProductNames = (auction.lots || []).map(l => PRODUCTS_MAP[l.productId]).filter(Boolean);
    if (requestedProductNames.length === 0 && auction.product) {
      const fallback = PRODUCTS_MAP[auction.product] || auction.product;
      requestedProductNames.push(fallback);
    }
    return await hasProducerProduct(producerId, requestedProductNames, db);
  }
  
  return true;
}

// ─── Anonymization helper ─────────────────────────────────────────────────
/**
 * Strips real names from auction/bid data for a given requesting user.
 * - Buyer requesting: sees their own name, all producers are anonymized.
 * - Producer requesting: sees anonymous buyer, own bids labelled "(Vous)", competitors anonymized.
 * Also injects per-producer average rating from bids metadata.
 */
function sanitizeAuctions(auctions, requestingUserId, requestingRole) {
  return auctions.map(auction => {
    // Sanitize buyer name
    const buyerDisplay = requestingUserId === auction.buyerId
      ? auction.buyerName
      : 'Acheteur Anonyme';

    // Build a stable anonymous alias per producer within this auction
    const producerAliasMap = {};
    let aliasCounter = 1;
    (auction.bids || []).forEach(bid => {
      if (!producerAliasMap[bid.producerId]) {
        if (bid.producerId === requestingUserId) {
          producerAliasMap[bid.producerId] = 'Vous';
        } else {
          producerAliasMap[bid.producerId] = `Producteur #${aliasCounter++}`;
        }
      }
    });

    // Calculate rankings for all bids on this auction (based on average price of lines)
    const bidComparisonPrices = (auction.bids || []).map(bid => {
      const sum = (bid.lines || []).reduce((acc, line) => acc + (parseFloat(line.price) || 0), 0);
      const avgPrice = (bid.lines || []).length > 0 ? (sum / bid.lines.length) : 0;
      return {
        producerId: bid.producerId,
        avgPrice,
      };
    });

    // Sort bids by average price ascending (lowest price first)
    bidComparisonPrices.sort((a, b) => a.avgPrice - b.avgPrice);

    // Create a map of producerId -> rank (1-based index)
    const rankMap = {};
    bidComparisonPrices.forEach((item, index) => {
      rankMap[item.producerId] = index + 1;
    });

    const myBid = (auction.bids || []).find(b => b.producerId === requestingUserId);
    const myRank = myBid ? rankMap[requestingUserId] : null;
    const totalBidders = (auction.bids || []).length;

    const sanitizedBids = (auction.bids || []).map(bid => ({
      id: bid.id,
      producerAlias: producerAliasMap[bid.producerId] || 'Producteur Anonyme',
      // Rating info is safe to expose (anonymous average)
      producerRating: bid.producerRating ?? null,
      producerRatingCount: bid.producerRatingCount ?? 0,
      timestamp: bid.timestamp,
      lines: (bid.lines || []).map(line => ({
        id: line.id,
        price: (requestingRole === 'producer' && bid.producerId !== requestingUserId) ? null : line.price,
        quantity: line.quantity || null,
        optionName: line.optionName || '',
        unit: line.unit || auction.unit,
        comments: line.comments || '',
        images: line.images || [],
      }))
    }));

    return {
      id: auction.id,
      buyerDisplay,
      // Only buyer sees their own real demand location context, except producers who need it to bid
      deliveryLocation: (requestingUserId === auction.buyerId || requestingRole === 'producer') ? auction.deliveryLocation : 'Zone de livraison',
      title: auction.title || auction.product,
      auctionType: auction.auctionType || 'open',
      product: auction.product,
      quantity: auction.quantity,
      unit: auction.unit,
      description: auction.description,
      lots: auction.lots || [],
      radiusKm: auction.radiusKm,
      startAt: auction.startAt,
      endAt: auction.endAt,
      autoProlongate: auction.autoProlongate || false,
      prolongationMinutes: auction.prolongationMinutes || null,
      maxProlongations: auction.maxProlongations || null,
      targetPrice: auction.targetPrice,
      status: auction.status,
      createdAt: auction.createdAt,
      bids: sanitizedBids,
      acceptedBidId: auction.acceptedBidId,
      acceptedLineId: auction.acceptedLineId || null,
      // Indicates if current user is the buyer of this auction
      isOwner: auction.buyerId === requestingUserId,
      // Producer's own bid reference
      myBidId: requestingRole === 'producer'
        ? ((auction.bids || []).find(b => b.producerId === requestingUserId)?.id ?? null)
        : null,
      // Buyer: already rated flag
      alreadyRated: auction.alreadyRated || false,
      myRank: requestingRole === 'producer' ? myRank : null,
      totalBidders: requestingRole === 'producer' ? totalBidders : null,
    };
  });
}

// ─── Socket.IO Server ─────────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 5e7, // 50MB to accommodate images in bids
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

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
  const matches = [];

  for (const producer of producers) {
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

    if (shouldNotify) matches.push({ producer, distKm });
  }

  return matches;
}

// Every socket joins a room named after its user id on connection (see
// io.on('connection') below). Targeting `io.to(userRoom(id))` — rather than
// tracking socket ids in a local Map — is what makes delivery work across
// multiple backend instances: the Redis adapter keeps room membership in
// sync cluster-wide, so this reaches the user no matter which instance
// they're actually connected to. Emitting to a room nobody is in is a safe
// no-op, so no "is this user online" check is needed first.
const userRoom = (userId) => `user:${userId}`;

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

    io.to(userRoom(producer._id.toString())).emit('new_notification', notification);
  }
}

/** Broadcasts a sanitized version of the auction to every connected socket (zone/product filtered for producers). */
async function broadcastAuction(auction, db, eventName = 'auction_updated') {
  const allSockets = await io.fetchSockets();
  for (const s of allSockets) {
    if (s.data.user.role === 'producer') {
      if (auction.status === 'pending') continue;
      const allowed = await canProducerParticipate(auction, s.data.user.userId, s.data.producerCoords, db);
      if (!allowed) continue;
    }
    const [sanitized] = sanitizeAuctions([auction], s.data.user.userId, s.data.user.role);
    s.emit(eventName, sanitized);
  }
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
    console.error('[Scheduler] Error opening auction:', err.message);
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
        console.error('[Scheduler] Error sending 5-min reminder:', err.message);
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
    socket.data.user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  const uid = socket.data.user.userId;
  const role = socket.data.user.role;

  // Join this user's room so io.to(userRoom(uid)) reaches them regardless
  // of which backend instance they're connected to (see userRoom above).
  socket.join(userRoom(uid));

  console.log(`User connected: ${socket.data.user.email} [${role}] (${socket.id})`);

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
    }

    // Send initial auctions list — producers only see demands matching their zone & product if smart
    let auctions = await db.collection('auctions').find({}).sort({ createdAt: -1 }).toArray();
    if (role === 'producer') {
      const allowed = [];
      for (const a of auctions) {
        if (a.status !== 'pending' && await canProducerParticipate(a, uid, socket.data.producerCoords, db)) {
          allowed.push(a);
        }
      }
      auctions = allowed;
    }

    const sanitized = sanitizeAuctions(auctions, uid, role);
    socket.emit('auctions_list', sanitized);
  } catch (err) {
    console.error('[WS] Error fetching initial auctions:', err.message);
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
      console.error('[WS] Error creating auction:', err.message);
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
      console.error('[WS] Error updating auction:', err.message);
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
      console.error('[WS] Error deleting auction:', err.message);
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
      const allSockets = await io.fetchSockets();
      for (const s of allSockets) {
        if (s.data.user.role === 'producer') {
          const allowed = await canProducerParticipate(updatedAuction, s.data.user.userId, s.data.producerCoords, db);
          if (!allowed) continue;
        }
        const [sanitized] = sanitizeAuctions([updatedAuction], s.data.user.userId, s.data.user.role);
        s.emit('auction_updated', sanitized);
      }
    } catch (err) {
      console.error('[WS] Error placing bid:', err.message);
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

      const allSockets = await io.fetchSockets();
      for (const s of allSockets) {
        if (s.data.user.role === 'producer') {
          const allowed = await canProducerParticipate(updatedAuction, s.data.user.userId, s.data.producerCoords, db);
          if (!allowed) continue;
        }
        const [sanitized] = sanitizeAuctions([updatedAuction], s.data.user.userId, s.data.user.role);
        s.emit('auction_updated', sanitized);
      }
    } catch (err) {
      console.error('[WS] Error accepting bid:', err.message);
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
      const allSockets = await io.fetchSockets();
      for (const s of allSockets) {
        if (s.data.user.role === 'producer') {
          const allowed = await canProducerParticipate(updatedAuction, s.data.user.userId, s.data.producerCoords, db);
          if (!allowed) continue;
        }
        const [sanitized] = sanitizeAuctions([updatedAuction], s.data.user.userId, s.data.user.role);
        s.emit('auction_updated', sanitized);
      }
    } catch (err) {
      console.error('[WS] Error rating producer:', err.message);
      socket.emit('error', { message: 'Échec de la notation.' });
    }
  });

  socket.on('disconnect', () => {
    // No manual bookkeeping needed — socket.io removes the socket from all
    // its rooms (including userRoom(uid)) automatically on disconnect.
    console.log(`User disconnected: ${socket.data.user.email} (${socket.id})`);
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

    console.log(`[Scheduler] Found ${pendingAuctions.length} pending auctions to open (fallback poll).`);
    for (const auction of pendingAuctions) {
      await openAuction(auction.id);
    }
  } catch (err) {
    console.error('[Scheduler] Error processing pending auctions:', err.message);
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectToDatabase();

    // Cluster-aware Socket.IO: without this, io.to()/io.fetchSockets() only
    // ever see sockets connected to this one process. Must be set before
    // httpServer.listen() so no client can connect before it's in place.
    const { pubClient, subClient } = getRedisPubSub();
    io.adapter(createAdapter(pubClient, subClient));

    const db = getDb();
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ verificationToken: 1 }, { sparse: true });
    await db.collection('auctions').createIndex({ id: 1 }, { unique: true });
    await db.collection('notifications').createIndex({ userId: 1, read: 1 });
    await db.collection('ratings').createIndex({ auctionId: 1, buyerId: 1 }, { unique: true });

    // Recover precise timers for auctions still pending from before a restart
    const pendingAuctions = await db.collection('auctions').find({ status: 'pending' }).toArray();
    for (const auction of pendingAuctions) {
      scheduleAuctionNotifications(auction);
    }

    // Setup periodic scheduler (every 30 seconds) — fallback safety net only
    setInterval(checkPendingAuctions, 30000);
    // Run once immediately on startup
    checkPendingAuctions().catch(err => console.error('[Scheduler Start Error]', err));

    httpServer.listen(PORT, '127.0.0.1', () => {
      console.log(`✅ Server running on http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
