import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { randomInt } from 'crypto';

/**
 * Generates and stores a new OTP code in MongoDB.
 * @param {string} userId - User identifier
 * @param {string} type - 'login' or 'password_change'
 * @returns {Promise<string>} Plaintext 6-digit OTP
 */
export async function createOtp(userId, type) {
  const db = getDb();
  
  // Generate 6-digit OTP
  const otp = String(randomInt(100000, 999999));
  const hashed = await bcrypt.hash(otp, 10);
  
  // Expiration time: 5 mins for login, 10 mins for password change
  const durationMins = type === 'login' ? 5 : 10;
  const expiresAt = new Date(Date.now() + durationMins * 60 * 1000);

  // Invalidate any existing active OTPs for this user and type
  await db.collection('user_otps').deleteMany({ userId, type });

  // Insert new OTP record
  await db.collection('user_otps').insertOne({
    userId,
    codeHash: hashed,
    type,
    attempts: 0,
    maxAttempts: 3,
    expiresAt,
    createdAt: new Date(),
    usedAt: null
  });

  return otp;
}

/**
 * Verifies an OTP code.
 * @param {string} userId - User identifier
 * @param {string} type - 'login' or 'password_change'
 * @param {string} code - The 6-digit code to check
 * @returns {Promise<{ valid: boolean, message?: string }>} Verification result
 */
export async function verifyOtp(userId, type, code) {
  const db = getDb();
  
  const otpRecord = await db.collection('user_otps').findOne({
    userId,
    type,
    expiresAt: { $gt: new Date() },
    usedAt: null
  });

  if (!otpRecord) {
    return { valid: false, message: 'Code OTP inexistant, déjà utilisé ou expiré.' };
  }

  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    return { valid: false, message: 'Nombre maximal de tentatives dépassé.' };
  }

  const matches = await bcrypt.compare(code, otpRecord.codeHash);
  if (!matches) {
    // Increment attempts
    await db.collection('user_otps').updateOne(
      { _id: otpRecord._id },
      { $inc: { attempts: 1 } }
    );
    const remaining = otpRecord.maxAttempts - (otpRecord.attempts + 1);
    return { 
      valid: false, 
      message: `Code incorrect. ${remaining > 0 ? `Il vous reste ${remaining} tentative(s).` : 'Nombre maximal de tentatives dépassé.'}` 
    };
  }

  // OTP is valid, mark it as used and delete it
  await db.collection('user_otps').deleteOne({ _id: otpRecord._id });

  return { valid: true };
}
