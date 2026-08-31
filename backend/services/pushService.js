import { getDb } from '../db.js';
import { logger } from '../utils/logger.js';

// Firebase Admin is initialised lazily and only if credentials are present.
// Without them, sendPushToUser() is a silent no-op so the rest of the app
// (and local dev) runs unchanged. To enable, set ONE of:
//   FIREBASE_SERVICE_ACCOUNT       - the service-account JSON, inline
//   GOOGLE_APPLICATION_CREDENTIALS - path to that JSON file
// See MOBILE.md for how to obtain it.
let messagingPromise = null;

async function getMessaging() {
  if (messagingPromise) return messagingPromise;

  messagingPromise = (async () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw && !process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;

    let admin;
    try {
      admin = (await import('firebase-admin')).default;
    } catch {
      logger.warn('firebase-admin not installed — push disabled. Run: npm i firebase-admin');
      return null;
    }

    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: raw
            ? admin.credential.cert(JSON.parse(raw))
            : admin.credential.applicationDefault(),
        });
      }
      return admin.messaging();
    } catch (err) {
      logger.error({ err }, 'Firebase Admin init failed — push disabled');
      return null;
    }
  })();

  return messagingPromise;
}

/**
 * Best-effort push to every device registered to `userId`. Never throws;
 * a delivery failure must not break the notification flow that triggered it.
 * Stale tokens (unregistered / invalid) are pruned automatically.
 *
 * @param {string} userId
 * @param {{ title: string, body: string, data?: Record<string,string> }} payload
 */
export async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    const messaging = await getMessaging();
    if (!messaging) return;

    const db = getDb();
    const rows = await db.collection('pushTokens').find({ userId }).toArray();
    if (!rows.length) return;

    const tokens = rows.map((r) => r.token);
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      // FCM data values must be strings.
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      ),
      android: { priority: 'high', notification: { channelId: 'default' } },
    });

    const stale = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-argument'
      ) {
        stale.push(tokens[i]);
      }
    });
    if (stale.length) {
      await db.collection('pushTokens').deleteMany({ token: { $in: stale } });
    }
  } catch (err) {
    logger.error({ err, userId }, 'sendPushToUser failed');
  }
}
