// @ts-check
import jwt from 'jsonwebtoken';

// TODO(security): In production, always set JWT_SECRET in environment variables.

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export default function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant.' });
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'Erreur de configuration serveur.' });
  }

  try {
    // Hardcode algorithm to prevent 'none' algorithm attack
    const decoded = /** @type {{ userId: string, email: string, role: string }} */ (
      jwt.verify(token, secret, { algorithms: ['HS256'] })
    );
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
    }
    return res.status(401).json({ error: 'Token invalide.' });
  }
}
