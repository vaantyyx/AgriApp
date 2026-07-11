import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { sendOtpEmail } from '../services/emailService.js';
import { createOtp, verifyOtp } from '../services/otpService.js';

const router = express.Router();

// OTP codes must never be persisted to logs/console outside of local development.
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

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

// Separate multer config for document uploads (images + PDF)
const DOC_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const DOC_ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const uploadDoc = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!DOC_ALLOWED_MIME.includes(file.mimetype) || !DOC_ALLOWED_EXT.includes(ext)) {
      return cb(new Error('Format non autorisé. Utilisez JPEG, PNG, WebP ou PDF.'));
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
      auctionsCount = await db.collection('auctions').countDocuments({ buyerId: req.user.userId });
    } else {
      const allAuctions = await db.collection('auctions').find({ 'bids.producerId': req.user.userId }).toArray();
      bidsCount = allAuctions.reduce((acc, a) => {
        return acc + a.bids.filter(b => b.producerId === req.user.userId).length;
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
    const {
      name, phone, wilaya, commune, bio,
      // Buyer-specific fields
      rc, nif, forme_juridique, nom_commercial, secteur_activite,
      possede_transport, possede_chambre_froide,
    } = req.body;

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
    // Buyer professional fields
    if (rc !== undefined) updates.rc = String(rc).slice(0, 100);
    if (nif !== undefined) updates.nif = String(nif).slice(0, 100);
    if (forme_juridique !== undefined) updates.forme_juridique = String(forme_juridique).slice(0, 100);
    if (nom_commercial !== undefined) updates.nom_commercial = String(nom_commercial).slice(0, 200);
    if (secteur_activite !== undefined) updates.secteur_activite = String(secteur_activite).slice(0, 100);
    if (possede_transport !== undefined) updates.possede_transport = !!possede_transport;
    if (possede_chambre_froide !== undefined) updates.possede_chambre_froide = !!possede_chambre_froide;

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

// ─── POST /api/profile/rc-document ─────────────────────────────────────────
router.post('/rc-document', uploadDoc.single('rcDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni.' });
    }

    const documentFilename = req.file.filename;
    const isPdf = req.file.mimetype === 'application/pdf';

    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: { rcDocument: documentFilename } }
    );

    res.json({
      message: 'Registre de commerce mis à jour.',
      documentUrl: `/uploads/${documentFilename}`,
      isPdf,
    });
  } catch (err) {
    if (err.message && err.message.includes('Format non autorisé')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (maximum 20 Mo).' });
    }
    console.error('[RC DOCUMENT UPLOAD ERROR]', err.message);
    res.status(500).json({ error: "Erreur serveur lors de l'upload du document." });
  }
});

// ─── POST /api/profile/upload-fiche-signaletique ───────────────────────────
router.post('/upload-fiche-signaletique', uploadDoc.single('ficheSignaletique'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni.' });
    }

    const documentFilename = req.file.filename;

    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: { ficheSignaletiqueDocument: documentFilename } }
    );

    res.json({
      message: 'Fiche Signalétique mise à jour.',
      documentUrl: `/uploads/${documentFilename}`,
    });
  } catch (err) {
    if (err.message && err.message.includes('Format non autorisé')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (maximum 20 Mo).' });
    }
    console.error('[FICHE SIGNALETIQUE UPLOAD ERROR]', err.message);
    res.status(500).json({ error: "Erreur serveur lors de l'upload du document." });
  }
});

// ─── POST /api/profile/upload-carte-agriculteur ────────────────────────────
router.post('/upload-carte-agriculteur', uploadDoc.single('carteAgriculteur'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni.' });
    }

    const documentFilename = req.file.filename;

    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: { carteAgriculteurDocument: documentFilename } }
    );

    res.json({
      message: "Carte d'Agriculteur mise à jour.",
      documentUrl: `/uploads/${documentFilename}`,
    });
  } catch (err) {
    if (err.message && err.message.includes('Format non autorisé')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (maximum 20 Mo).' });
    }
    console.error('[CARTE AGRICULTEUR UPLOAD ERROR]', err.message);
    res.status(500).json({ error: "Erreur serveur lors de l'upload du document." });
  }
});

router.post('/password/otp', async (req, res) => {
  try {
    const { current_password } = req.body;
    if (!current_password) {
      return res.status(400).json({ error: 'Mot de passe actuel requis.' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(403).json({ error: 'Mot de passe actuel incorrect.' });
    }

    // Generate OTP code
    const otp = await createOtp(user._id.toString(), 'password_change');
    const method = user.two_factor_method || 'email';

    if (isDev && method === 'phone' && user.phone) {
      console.log(`\n==================================================`);
      console.log(`[SMS DEV] SMS sent to ${user.phone}:`);
      console.log(`👉 SOUGRA Code de changement de mot de passe: ${otp}. Valide 10 min.`);
      console.log(`==================================================\n`);
    }

    // Send OTP email
    await sendOtpEmail(
      user.email,
      user.name,
      otp,
      10,
      'Changement de mot de passe',
      'Code de confirmation - Changement de mot de passe',
      'Utilisez le code ci-dessous pour confirmer votre demande de changement de mot de passe.'
    );

    res.json({ message: 'Code de vérification envoyé avec succès.' });
  } catch (err) {
    console.error('[PASSWORD OTP ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/profile/password/change ──────────────────────────────────────
router.post('/password/change', async (req, res) => {
  try {
    const { current_password, otp, password } = req.body;
    if (!current_password || !otp || !password) {
      return res.status(400).json({ error: 'Tous les champs (actuel, OTP, nouveau) sont obligatoires.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Double check current password
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(403).json({ error: 'Mot de passe actuel incorrect.' });
    }

    // Verify OTP
    const result = await verifyOtp(user._id.toString(), 'password_change', otp);
    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    console.error('[PASSWORD CHANGE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── PUT /api/profile/security ──────────────────────────────────────────────
router.put('/security', async (req, res) => {
  try {
    const { two_factor_enabled, two_factor_method } = req.body;
    
    if (two_factor_enabled === undefined) {
      return res.status(400).json({ error: 'two_factor_enabled requis.' });
    }
    
    const updates = {
      two_factor_enabled: !!two_factor_enabled
    };
    
    if (two_factor_method !== undefined) {
      if (!['email', 'phone'].includes(two_factor_method)) {
        return res.status(400).json({ error: 'two_factor_method doit être email ou phone.' });
      }
      updates.two_factor_method = two_factor_method;
    }

    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: updates }
    );

    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { password: 0, verificationToken: 0, verificationExpires: 0 } }
    );

    res.json({
      message: 'Paramètres de sécurité mis à jour avec succès.',
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profilePhoto: updatedUser.profilePhoto || null,
        wilaya: updatedUser.wilaya || '',
        commune: updatedUser.commune || '',
        two_factor_enabled: !!updatedUser.two_factor_enabled,
        two_factor_method: updatedUser.two_factor_method || 'email',
        phone: updatedUser.phone || '',
        entity_type: updatedUser.entity_type || 'particulier',
        bio: updatedUser.bio || '',
        rc: updatedUser.rc || '',
        nif: updatedUser.nif || '',
        forme_juridique: updatedUser.forme_juridique || '',
        nom_commercial: updatedUser.nom_commercial || '',
        secteur_activite: updatedUser.secteur_activite || '',
        possede_transport: !!updatedUser.possede_transport,
        possede_chambre_froide: !!updatedUser.possede_chambre_froide,
        rcDocument: updatedUser.rcDocument || null,
      }
    });
  } catch (err) {
    console.error('[SECURITY UPDATE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/profile/deactivate ──────────────────────────────────────────
router.post('/deactivate', async (req, res) => {
  try {
    const userId = req.user.userId;
    const db = getDb();

    const updatedUser = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { isActive: false, deactivatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    res.json({ message: 'Compte désactivé avec succès.' });

    // Send deactivation confirmation email (fire & forget)
    import('../services/emailService.js').then(({ sendAccountDeactivationEmail }) => {
      sendAccountDeactivationEmail(updatedUser.email, updatedUser.name).catch(err => {
        console.error('[DEACTIVATE] Failed to send deactivation email:', err.message);
      });
    }).catch(() => {});
  } catch (err) {
    console.error('[DEACTIVATE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la désactivation du compte.' });
  }
});

export default router;
