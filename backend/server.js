import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { connectToDatabase, getDb } from './db.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── JWT Secret bootstrap ──────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  const ephemeral = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = ephemeral;
  console.warn('[SECURITY WARNING] JWT_SECRET not set in .env — using ephemeral secret. All sessions will be invalidated on restart!');
}

// ─── App Setup ────────────────────────────────────────────────────────────
const app = express();

// CORS — restrict to frontend origin only
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
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

app.use(express.json({ limit: '2mb' }));

// ─── Security Headers ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans une minute.' },
});
app.use('/api/auth', authLimiter);

// ─── Static File Serving (uploads) ────────────────────────────────────────
app.use('/uploads', (req, res, next) => {
  // Secure headers for file serving
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    const db = getDb();
    const count = await db.collection('auctions').countDocuments();
    res.json({ status: 'ok', auctionsCount: count });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Auctions REST (debug)
app.get('/api/auctions', async (req, res) => {
  try {
    const db = getDb();
    const auctions = await db.collection('auctions').find({}).sort({ createdAt: -1 }).toArray();
    res.json(auctions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset endpoint
app.post('/api/reset', async (req, res) => {
  try {
    const db = getDb();
    await db.collection('auctions').deleteMany({});
    io.emit('data_reset');
    res.json({ message: 'Data reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Socket.IO Server ─────────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 1e7,
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Socket.IO auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.user.email} (${socket.id})`);

  try {
    const db = getDb();
    const auctions = await db.collection('auctions').find({}).sort({ createdAt: -1 }).toArray();
    socket.emit('auctions_list', auctions);
  } catch (err) {
    console.error('Error fetching auctions for connected user:', err);
  }

  socket.on('create_auction', async (data) => {
    const { buyerName, product, quantity, unit, description, targetPrice, images } = data;
    if (!buyerName || !product || !quantity || !unit) {
      socket.emit('error', { message: 'Champs obligatoires manquants.' });
      return;
    }
    const newAuction = {
      id: `auc_${Date.now()}_${randomBytes(4).toString('hex')}`,
      buyerName,
      product,
      quantity: parseFloat(quantity),
      unit,
      description: description || '',
      targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      images: images || [],
      status: 'open',
      createdAt: new Date().toISOString(),
      bids: [],
      acceptedBidId: null,
    };
    try {
      const db = getDb();
      await db.collection('auctions').insertOne(newAuction);
      io.emit('auction_created', newAuction);
    } catch (err) {
      console.error('Error creating auction:', err);
      socket.emit('error', { message: 'Échec de la création de l\'enchère.' });
    }
  });

  socket.on('place_bid', async (data) => {
    const { auctionId, producerName, price, comments } = data;
    if (!auctionId || !producerName || price === undefined) {
      socket.emit('error', { message: 'Champs obligatoires manquants.' });
      return;
    }
    const newBid = {
      id: `bid_${Date.now()}_${randomBytes(4).toString('hex')}`,
      producerName,
      price: parseFloat(price),
      comments: comments || '',
      timestamp: new Date().toISOString(),
    };
    try {
      const db = getDb();
      const result = await db.collection('auctions').updateOne(
        { id: auctionId, status: 'open' },
        { $push: { bids: newBid } }
      );
      if (result.matchedCount === 0) {
        const auction = await db.collection('auctions').findOne({ id: auctionId });
        socket.emit('error', { message: !auction ? 'Enchère introuvable.' : 'Enchère déjà clôturée.' });
        return;
      }
      const updatedAuction = await db.collection('auctions').findOne({ id: auctionId });
      io.emit('auction_updated', updatedAuction);
    } catch (err) {
      console.error('Error placing bid:', err);
      socket.emit('error', { message: 'Échec du dépôt d\'offre.' });
    }
  });

  socket.on('accept_bid', async (data) => {
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
      const bid = auction.bids.find(b => b.id === bidId);
      if (!bid) { socket.emit('error', { message: 'Offre introuvable.' }); return; }

      await db.collection('auctions').updateOne(
        { id: auctionId },
        { $set: { status: 'closed', acceptedBidId: bidId } }
      );
      auction.status = 'closed';
      auction.acceptedBidId = bidId;
      io.emit('auction_updated', auction);
    } catch (err) {
      console.error('Error accepting bid:', err);
      socket.emit('error', { message: 'Échec de la validation.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.email} (${socket.id})`);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectToDatabase();

    // Ensure indexes for performance and data integrity
    const db = getDb();
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ verificationToken: 1 }, { sparse: true });

    httpServer.listen(PORT, '127.0.0.1', () => {
      console.log(`✅ Server running on http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
