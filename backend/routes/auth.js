import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { sendVerificationEmail, sendWelcomeEmail, sendOtpEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { createOtp, verifyOtp } from '../services/otpService.js';
import { consumeVerifiedChallenge } from '../services/captchaService.js';
import { resolveLocale } from '../utils/locale.js';
import { logger } from '../utils/logger.js';


const router = express.Router();

// Records the IP an account was created from or logged in from, for admin
// oversight (see GET /api/admin/users/:id). Never blocks the auth flow it's
// called from — a logging failure here must not fail a real login/register.
async function recordUserIp(db, userId, req, type) {
  try {
    await db.collection('userLoginHistory').insertOne({
      userId,
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      type,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.error({ err, userId, type }, 'Failed to record login IP');
  }
}

// ─── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, wilaya, commune, entity_type, acceptedTerms, locale } = req.body;
    const userLocale = resolveLocale(locale);

    // Input validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Les champs Nom, Email, Mot de passe et Rôle sont obligatoires.' });
    }
    if (!acceptedTerms) {
      return res.status(400).json({ error: "Vous devez accepter les Conditions Générales d'Utilisation." });
    }
    if (!['buyer', 'producer'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide.' });
    }
    if (role === 'buyer' && entity_type && !['particulier', 'entreprise'].includes(entity_type)) {
      return res.status(400).json({ error: "Type d'entité invalide." });
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
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Le nom ne doit pas dépasser 100 caractères.' });
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
      roles: [role],
      isVerified: false,
      verificationToken,
      verificationExpires,
      profilePhoto: null,
      phone: phone ? phone.replace(/\s/g, '') : '',
      wilaya: wilaya || '',
      commune: commune || '',
      entity_type: role === 'buyer' ? (entity_type || 'particulier') : 'particulier',
      bio: '',
      preferredLocale: userLocale,
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
    };

    const insertResult = await db.collection('users').insertOne(newUser);
    await recordUserIp(db, insertResult.insertedId.toString(), req, 'register');

    // Send verification email (do not log credentials)
    try {
      await sendVerificationEmail(newUser.email, newUser.name, verificationToken, userLocale);
    } catch (emailErr) {
      logger.error({ err: emailErr }, 'EMAIL: Failed to send verification email');
      // Continue - user created, email failed is non-fatal
    }

    res.status(201).json({
      message: 'Compte créé avec succès. Un e-mail de confirmation vous a été envoyé.',
    });
  } catch (err) {
    logger.error({ err }, 'REGISTER ERROR');
    res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
  }
});

// ─── POST /api/auth/resend-verification ────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  try {
    const { email, locale } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email requis.' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'Aucun compte associé à cet email.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Ce compte est déjà vérifié.' });
    }

    // Reuse existing token if still valid, otherwise generate a new one
    let verificationToken = user.verificationToken;
    let verificationExpires = user.verificationExpires;

    if (!verificationToken || !verificationExpires || new Date() > verificationExpires) {
      verificationToken = uuidv4();
      verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { verificationToken, verificationExpires } }
      );
    }

    try {
      await sendVerificationEmail(user.email, user.name, verificationToken, resolveLocale(locale));
    } catch (emailErr) {
      logger.error({ err: emailErr }, 'EMAIL: Failed to resend verification email');
      return res.status(500).json({ error: "Erreur lors de l'envoi de l'email. Réessayez plus tard." });
    }

    res.json({ message: 'Email de vérification renvoyé avec succès. Vérifiez votre boîte de réception.' });
  } catch (err) {
    logger.error({ err }, 'RESEND VERIFICATION ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
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
    });

    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou compte déjà activé.' });
    }

    if (user.isVerified) {
      return res.json({ message: 'Email déjà confirmé. Vous pouvez vous connecter.' });
    }

    if (new Date() > user.verificationExpires) {
      return res.status(400).json({ error: 'Le lien de vérification a expiré. Veuillez vous réinscrire.' });
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { isVerified: true } }
    );

    // Send welcome email, in the language chosen at registration
    try {
      await sendWelcomeEmail(user.email, user.name, user.role, resolveLocale(user.preferredLocale));
    } catch (e) {
      // Non-fatal
    }

    res.json({ message: 'Email confirmé ! Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    logger.error({ err }, 'VERIFY EMAIL ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, captchaChallengeId, locale } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Données invalides.' });
    }

    const db = getDb();

    const captchaOk = captchaChallengeId && await consumeVerifiedChallenge(captchaChallengeId);
    if (!captchaOk) {
      return res.status(400).json({ error: 'Captcha invalide ou expiré. Veuillez réessayer.', captchaExpired: true });
    }

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

    if (user.isActive === false) {
      return res.status(403).json({
        error: 'Ce compte a été désactivé. Contactez le support pour le réactiver.',
        needsActivation: true,
      });
    }

    // Check if user has two-factor authentication enabled (email is the only delivery method)
    if (user.two_factor_enabled) {
      const otp = await createOtp(user._id.toString(), 'login');

      await sendOtpEmail(user.email, user.name, otp, 5, 'login', resolveLocale(locale));

      return res.json({
        status: 'OTP_REQUIRED',
        message: 'Un code OTP de sécurité a été envoyé à votre adresse email.',
        identifier: user.email,
      });
    }

    const secret = process.env.JWT_SECRET;
    const roles = user.roles || [user.role];
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role, roles },
      secret,
      { algorithm: 'HS256', expiresIn: '30d' }
    );

    await recordUserIp(db, user._id.toString(), req, 'login');

    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        roles,
        profilePhoto: user.profilePhoto || null,
        wilaya: user.wilaya || '',
        commune: user.commune || '',
        phone: user.phone || '',
        entity_type: user.entity_type || 'particulier',
        bio: user.bio || '',
        rc: user.rc || '',
        nif: user.nif || '',
        forme_juridique: user.forme_juridique || '',
        nom_commercial: user.nom_commercial || '',
        secteur_activite: user.secteur_activite || '',
        possede_transport: !!user.possede_transport,
        possede_chambre_froide: !!user.possede_chambre_froide,
        rcDocument: user.rcDocument || null,
      },
    });
  } catch (err) {
    logger.error({ err }, 'LOGIN ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/auth/verify-otp ─────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Identifiant et code OTP requis.' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ email: identifier.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const result = await verifyOtp(user._id.toString(), 'login', otp);
    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    const secret = process.env.JWT_SECRET;
    const roles = user.roles || [user.role];
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role, roles },
      secret,
      { algorithm: 'HS256', expiresIn: '30d' }
    );

    await recordUserIp(db, user._id.toString(), req, 'login');

    res.json({
      status: 'AUTHENTICATED',
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        roles,
        profilePhoto: user.profilePhoto || null,
        wilaya: user.wilaya || '',
        commune: user.commune || '',
        two_factor_enabled: !!user.two_factor_enabled,
      },
    });
  } catch (err) {
    logger.error({ err }, 'VERIFY OTP ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/auth/resend-otp ─────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { identifier, locale } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Identifiant requis.' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ email: identifier.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    if (!user.two_factor_enabled) {
      return res.status(400).json({ error: "L'authentification à deux facteurs n'est pas activée pour cet utilisateur." });
    }

    const otp = await createOtp(user._id.toString(), 'login');

    await sendOtpEmail(user.email, user.name, otp, 5, 'login_resend', resolveLocale(locale));

    res.json({ message: 'Nouveau code OTP envoyé.' });
  } catch (err) {
    logger.error({ err }, 'RESEND OTP ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});
// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, locale } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis.' });

    const db = getDb();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Return a generic success message to prevent email enumeration
      return res.json({ message: 'Si cet email correspond à un compte existant, un lien de réinitialisation vous a été envoyé.' });
    }

    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires } }
    );

    await sendPasswordResetEmail(user.email, user.name, resetToken, resolveLocale(locale));

    res.json({ message: 'Si cet email correspond à un compte existant, un lien de réinitialisation vous a été envoyé.' });
  } catch (err) {
    logger.error({ err }, 'FORGOT PASSWORD ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Jeton et nouveau mot de passe requis.' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au minimum 8 caractères.' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Le lien de réinitialisation est invalide ou a expiré.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { password: hashedPassword },
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" }
      }
    );

    res.json({ message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    logger.error({ err }, 'RESET PASSWORD ERROR');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
