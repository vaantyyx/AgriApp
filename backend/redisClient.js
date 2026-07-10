import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function createConnection(name) {
  const conn = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  conn.on('error', (err) => console.error(`[Redis:${name}] ${err.message}`));
  return conn;
}

function waitUntilReady(conn) {
  if (conn.status === 'ready') return Promise.resolve();
  return new Promise((resolve, reject) => {
    conn.once('ready', resolve);
    conn.once('error', reject);
  });
}

// Connected eagerly via top-level await rather than an explicit
// connect-then-import step: express-rate-limit's RedisStore calls
// sendCommand once during its own construction (to load a Lua script),
// which happens at *module evaluation time* in server.js / routes/captcha.js
// — before either file's own code gets a chance to await a connect() call.
// A top-level await here makes ESM itself block evaluation of every module
// that imports from this one (directly or transitively) until the
// connection is ready, which is the only way to guarantee that ordering
// without restructuring those imports into dynamic import() calls. Requires
// `dotenv/config` to already have run — guaranteed here since server.js
// imports it first, and ESM evaluates each module's dependencies (including
// this one, however deep) before the importing module's own body runs.
const client = createConnection('client');
const pubClient = createConnection('pub');
const subClient = pubClient.duplicate();
subClient.on('error', (err) => console.error('[Redis:sub]', err.message));

await Promise.all([waitUntilReady(client), waitUntilReady(pubClient), waitUntilReady(subClient)]);
console.log(`Successfully connected to Redis at ${REDIS_URL}`);

/** General-purpose Redis client (rate limiting, CAPTCHA storage, caching). */
export function getRedis() {
  return client;
}

/** The pub/sub pair backing the Socket.IO Redis adapter. */
export function getRedisPubSub() {
  return { pubClient, subClient };
}

export async function closeRedisConnection() {
  await Promise.allSettled([client.quit(), pubClient.quit(), subClient.quit()]);
}
