import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { sendVerificationEmail, sendWelcomeEmail } from '../services/emailService.js';

const router = express.Router();

// ─── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, wilaya, commune } = req.body;

    // Input validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Les champs Nom, Email, Mot de passe et Rôle sont obligatoires.' });
    }
    if (!['buyer', 'producer'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide.' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Format e-mail invalide.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au minimum 8 caractères.' });
    }
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Le nom doit contenir au minimum 2 caractères.' });
    }
    // Validate phone format if provided
    if (phone && typeof phone === 'string') {
      if (!/^\+213[0-9]{8,10}$/.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Format de numéro de téléphone invalide.' });
      }
    }

    const db = getDb();
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Cette adresse e-mail est déjà utilisée.' });
    }

    // Hash password with bcrypt (10 rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const newUser = {
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      isVerified: false,
      verificationToken,
      verificationExpires,
      profilePhoto: null,
      phone: phone ? phone.replace(/\s/g, '') : '',
      wilaya: wilaya || '',
      commune: commune || '',
      bio: '',
      createdAt: new Date(),
    };

    await db.collection('users').insertOne(newUser);

    // Send verification email (do not log credentials)
    try {
      await sendVerificationEmail(newUser.email, newUser.name, verificationToken);
    } catch (emailErr) {
      console.error('[EMAIL] Failed to send verification email:', emailErr.message);
      // Continue - user created, email failed is non-fatal
    }

    res.status(201).json({
      message: 'Compte créé avec succès. Un e-mail de confirmation vous a été envoyé.',
    });
  } catch (err) {
    console.error('[REGISTER ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
  }
});

// ─── GET /api/auth/verify-email ────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token de vérification manquant.' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({
      verificationToken: token,
      isVerified: false,
    });

    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou compte déjà activé.' });
    }

    if (new Date() > user.verificationExpires) {
      return res.status(400).json({ error: 'Le lien de vérification a expiré. Veuillez vous réinscrire.' });
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: { isVerified: true },
        $unset: { verificationToken: '', verificationExpires: '' },
      }
    );

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name, user.role);
    } catch (e) {
      // Non-fatal
    }

    res.json({ message: 'Email confirmé ! Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    console.error('[VERIFY EMAIL ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Données invalides.' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });

    // Use constant-time comparison to prevent timing attacks
    const dummyHash = '$2a$10$abcdefghijklmnopqrstuuVGQxrGe1C3h.RSEe5GKFzFCRuJ.byNm';
    const passwordToCheck = user ? user.password : dummyHash;
    const isMatch = await bcrypt.compare(password, passwordToCheck);

    if (!user || !isMatch) {
      // Generic error — do not reveal which field was wrong
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Compte non activé. Vérifiez votre email pour confirmer votre inscription.',
        needsVerification: true,
      });
    }

    const secret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      secret,
      { algorithm: 'HS256', expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto || null,
      },
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
