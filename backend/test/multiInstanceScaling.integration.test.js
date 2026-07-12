// Proves horizontal scaling actually works: spawns TWO separate server.js
// processes (simulating two app servers behind a load balancer) sharing the
// same MongoDB and the same Redis instance, then verifies that an event
// handled by instance A (create_auction, place_bid) is correctly broadcast
// to a socket connected to instance B. Without a working Socket.IO Redis
// adapter, instance B would never see it — each instance's in-memory
// broadcast is invisible to the other.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');

const PORT_A = 3095;
const PORT_B = 3096;
const URL_A = `http://127.0.0.1:${PORT_A}`;
const URL_B = `http://127.0.0.1:${PORT_B}`;
const JWT_SECRET = 'multi-instance-test-secret-do-not-use-in-production';
const MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/agriapp_test';
const REDIS_URL = process.env.REDIS_URL_TEST || 'redis://127.0.0.1:6379';
const TEST_WILAYA = 'alger';

let serverA, serverB;
let mongoClient, db;
let buyerId, producerId;

function waitForHealth(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(`${url}/health`)
        .then(res => { if (res.ok) resolve(); else retry(); })
        .catch(retry);
      function retry() {
        if (Date.now() > deadline) reject(new Error(`${url} did not become healthy in time`));
        else setTimeout(poll, 300);
      }
    })();
  });
}

function connectSocket(url, token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { auth: { token }, transports: ['websocket'] });
    // Buffer the very first auctions_list emission immediately (synchronously,
    // before the WebSocket handshake even completes) — the server can emit it
    // right after connecting, before a caller gets a chance to attach its own
    // listener via waitForEvent, which would otherwise miss it entirely.
    socket._auctionsListPromise = new Promise((res) => socket.once('auctions_list', (...args) => res(args)));
    const timer = setTimeout(() => reject(new Error(`Socket connect to ${url} timed out`)), 10000);
    socket.on('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for "${eventName}"`));
    }, timeoutMs);
    function handler(...args) {
      if (predicate(...args)) {
        clearTimeout(timer);
        socket.off(eventName, handler);
        resolve(args);
      }
    }
    socket.on(eventName, handler);
  });
}

function spawnServer(port) {
  const proc = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      MONGODB_URI,
      REDIS_URL,
      JWT_SECRET,
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
    },
    stdio: 'pipe',
  });
  proc.stderr.on('data', (chunk) => process.stderr.write(`[server.js:${port}] ${chunk}`));
  return proc;
}

before(async () => {
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db();

  const marker = { integrationTest: true, createdAt: new Date() };
  const buyerResult = await db.collection('users').insertOne({
    name: 'Multi-Instance Test Buyer',
    email: `multiinstance.buyer.${Date.now()}@test.local`,
    password: 'unused-password-hash',
    role: 'buyer',
    isVerified: true,
    isActive: true,
    wilaya: TEST_WILAYA,
    commune: TEST_WILAYA,
    entity_type: 'particulier',
    ...marker,
  });
  buyerId = buyerResult.insertedId;

  const producerResult = await db.collection('users').insertOne({
    name: 'Multi-Instance Test Producer',
    email: `multiinstance.producer.${Date.now()}@test.local`,
    password: 'unused-password-hash',
    role: 'producer',
    isVerified: true,
    isActive: true,
    wilaya: TEST_WILAYA,
    commune: TEST_WILAYA,
    ...marker,
  });
  producerId = producerResult.insertedId;

  serverA = spawnServer(PORT_A);
  serverB = spawnServer(PORT_B);
  await Promise.all([waitForHealth(URL_A), waitForHealth(URL_B)]);
});

after(async () => {
  if (serverA) serverA.kill();
  if (serverB) serverB.kill();
  if (db) {
    await db.collection('users').deleteMany({ integrationTest: true });
    await db.collection('auctions').deleteMany({ integrationTest: true });
  }
  if (mongoClient) await mongoClient.close();
});

test('an event handled by instance A is broadcast to a socket connected to instance B (via Redis)', async () => {
  const buyerToken = jwt.sign({ userId: String(buyerId), email: 'multiinstance.buyer@test.local', role: 'buyer' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const producerToken = jwt.sign({ userId: String(producerId), email: 'multiinstance.producer@test.local', role: 'producer' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

  // Buyer connects to instance A, producer connects to instance B —
  // deliberately on different processes to prove they're not just sharing
  // in-memory state.
  const buyerSocket = await connectSocket(URL_A, buyerToken);
  const producerSocket = await connectSocket(URL_B, producerToken);

  try {
    await buyerSocket._auctionsListPromise;
    await producerSocket._auctionsListPromise;

    const auctionTitle = `Multi-instance test auction ${Date.now()}`;
    const producerSeesCreated = waitForEvent(
      producerSocket, 'auction_created',
      (auction) => auction.title === auctionTitle,
    );

    // Emitted against instance A's socket — server.js on port A handles it,
    // persists to the shared Mongo, and must publish the broadcast through
    // Redis for instance B to relay to its own connected sockets.
    buyerSocket.emit('create_auction', {
      title: auctionTitle,
      auctionType: 'open',
      deliveryLocation: TEST_WILAYA,
      description: 'Multi-instance scaling test',
      lots: [{ designation: 'Test cross-instance', quantity: 10, unit: 'tonnes' }],
      radius: 100,
    });

    const [createdAuction] = await producerSeesCreated;
    assert.equal(createdAuction.status, 'open');
    assert.equal(createdAuction.title, auctionTitle);

    await db.collection('auctions').updateOne({ id: createdAuction.id }, { $set: { integrationTest: true } });
  } finally {
    buyerSocket.disconnect();
    producerSocket.disconnect();
  }
});
