import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// All profile routes require authentication
router.use(authMiddleware);

// Multer storage — UUID filenames to prevent path traversal and enumeration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    // Never use original filename — generate a random UUID name
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

// File validation: allow-list of MIME types and extension
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.includes(file.mimetype) || !ALLOWED_EXT.includes(ext)) {
      return cb(new Error('Format de fichier non autorisé. Utilisez JPEG, PNG ou WebP.'));
    }
    cb(null, true);
  },
});

// ─── GET /api/profile ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { password: 0, verificationToken: 0, verificationExpires: 0 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Count user's auctions/bids for stats
    let auctionsCount = 0;
    let bidsCount = 0;
    if (user.role === 'buyer') {
      auctionsCount = await db.collection('auctions').countDocuments({ buyerName: user.name });
    } else {
      const allAuctions = await db.collection('auctions').find({}).toArray();
      bidsCount = allAuctions.reduce((acc, a) => {
        return acc + a.bids.filter(b => b.producerName === user.name).length;
      }, 0);
    }

    res.json({
      ...user,
      _id: user._id.toString(),
      stats: { auctionsCount, bidsCount },
    });
  } catch (err) {
    console.error('[GET PROFILE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── PUT /api/profile ─────────────────────────────────────────────────────
router.put('/', async (req, res) => {
  try {
    const { name, phone, wilaya, commune, bio } = req.body;

    // Validate and sanitize inputs
    const updates = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Le nom doit contenir au moins 2 caractères.' });
      }
      updates.name = name.trim();
    }
    if (phone !== undefined) updates.phone = String(phone).slice(0, 20);
    if (wilaya !== undefined) updates.wilaya = String(wilaya).slice(0, 100);
    if (commune !== undefined) updates.commune = String(commune).slice(0, 100);
    if (bio !== undefined) updates.bio = String(bio).slice(0, 500);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
    }

    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: updates }
    );

    res.json({ message: 'Profil mis à jour avec succès.', updates });
  } catch (err) {
    console.error('[UPDATE PROFILE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/profile/photo ──────────────────────────────────────────────
router.post('/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni.' });
    }

    // Use only the UUID filename — never the original path
    const photoFilename = req.file.filename;

    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: { profilePhoto: photoFilename } }
    );

    res.json({
      message: 'Photo de profil mise à jour.',
      photoUrl: `/uploads/${photoFilename}`,
    });
  } catch (err) {
    if (err.message.includes('Format de fichier')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (maximum 20 Mo).' });
    }
    console.error('[PHOTO UPLOAD ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de l\'upload.' });
  }
});

export default router;
