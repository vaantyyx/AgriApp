// @ts-check
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { logger } from './logger.js';

// Shared across every rate limiter in the app (server.js, routes/captcha.js,
// routes/ai.js) so counts are consistent across instances — without this,
// express-rate-limit's default in-memory store counts per-process, and in
// the docker-compose 3-replica setup (or any multi-instance Render deploy)
// a client spread across instances gets N× the intended limit.
//
// Undefined REDIS_URL is the common case (single-instance deploys) and
// falls back to express-rate-limit's own in-memory store by returning
// `undefined` here — every call site treats that as "use the default".
let redisStoreFactory;
if (process.env.REDIS_URL) {
  // reconnectStrategy: false — same choice as the Socket.IO adapter in
  // server.js: fail once and stop, rather than retrying forever. Without
  // this, a Redis that's unreachable for the app's whole lifetime (e.g. a
  // stale REDIS_URL left over in a local .env with no Redis actually
  // running) makes every single rate-limited request re-attempt a command,
  // time out, and log a fresh stack trace — spamming the console forever
  // instead of degrading once and staying quiet.
  const client = createClient({ url: process.env.REDIS_URL, RESP: 2, socket: { reconnectStrategy: false } });
  let loggedError = false;
  client.on('error', (err) => {
    if (loggedError) return;
    loggedError = true;
    logger.error({ err }, 'Rate-limit Redis client error — falling back to per-instance in-memory limits.');
  });
  client.connect()
    .then(() => logger.info('Rate limiting backed by Redis — shared across instances.'))
    .catch(() => {}); // already logged via the 'error' listener above

  redisStoreFactory = (prefix) => new RedisStore({
    prefix,
    // Once the client has given up (see reconnectStrategy above), skip
    // straight to a rejection instead of letting express-rate-limit try —
    // and fail — a real command against a socket that will never connect.
    sendCommand: (...args) => client.isReady
      ? client.sendCommand(args)
      : Promise.reject(new Error('Rate-limit Redis client not connected')),
  });
} else {
  redisStoreFactory = () => undefined;
}

/** @param {string} prefix Unique per limiter, so different limiters' counters don't collide in the shared Redis keyspace. */
export function getRateLimitStore(prefix) {
  return redisStoreFactory(prefix);
}
