// End-to-end integration test for the core Socket.IO auction/bidding flow —
// the app's central business logic, which previously had zero automated
// coverage (only isolated helper functions in auctionMatching.js etc. were
// unit-tested). This spawns a real server.js instance against a real test
// MongoDB (same pattern as loadtest/run.js), connects as a real buyer and
// producer via socket.io-client, and drives the actual
// create_auction -> place_bid -> accept_bid flow end to end.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');

const TEST_PORT = 3097;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const JWT_SECRET = 'integration-test-secret-do-not-use-in-production';
const MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/agriapp_test';
const TEST_WILAYA = 'alger';

let serverProcess;
let mongoClient;
let db;
let buyerId;
let producerId;

function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(`${SERVER_URL}/health`)
        .then(res => { if (res.ok) resolve(); else retry(); })
        .catch(retry);
      function retry() {
        if (Date.now() > deadline) reject(new Error('Server did not become healthy in time'));
        else setTimeout(poll, 300);
      }
    })();
  });
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(SERVER_URL, { auth: { token }, transports: ['websocket'] });
    // Buffer the very first auctions_list emission immediately (synchronously,
    // before the WebSocket handshake even completes) — the server can emit it
    // right after connecting, before a caller gets a chance to attach its own
    // listener via waitForEvent, which would otherwise miss it entirely.
    socket._auctionsListPromise = new Promise((res) => socket.once('auctions_list', (...args) => res(args)));
    const timer = setTimeout(() => reject(new Error('Socket connect timed out')), 10000);
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

before(async () => {
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db();

  const marker = { integrationTest: true, createdAt: new Date() };
  const buyerResult = await db.collection('users').insertOne({
    name: 'Integration Test Buyer',
    email: `integration.buyer.${Date.now()}@test.local`,
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
    name: 'Integration Test Producer',
    email: `integration.producer.${Date.now()}@test.local`,
    password: 'unused-password-hash',
    role: 'producer',
    isVerified: true,
    isActive: true,
    wilaya: TEST_WILAYA,
    commune: TEST_WILAYA,
    ...marker,
  });
  producerId = producerResult.insertedId;

  serverProcess = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      MONGODB_URI,
      JWT_SECRET,
      PORT: String(TEST_PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
    },
    stdio: 'pipe',
  });
  // Surface server-side crashes/errors directly in the test output instead of
  // just a mysterious health-check timeout.
  serverProcess.stderr.on('data', (chunk) => process.stderr.write(`[server.js] ${chunk}`));

  await waitForHealth();
});

after(async () => {
  if (serverProcess) serverProcess.kill();
  if (db) {
    await db.collection('users').deleteMany({ integrationTest: true });
    await db.collection('auctions').deleteMany({ integrationTest: true });
    await db.collection('notifications').deleteMany({ userId: { $in: [String(buyerId), String(producerId)] } });
  }
  if (mongoClient) await mongoClient.close();
});

test('create_auction -> place_bid -> accept_bid end-to-end flow', async () => {
  const buyerToken = jwt.sign({ userId: String(buyerId), email: 'integration.buyer@test.local', role: 'buyer' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const producerToken = jwt.sign({ userId: String(producerId), email: 'integration.producer@test.local', role: 'producer' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

  const buyerSocket = await connectSocket(buyerToken);
  const producerSocket = await connectSocket(producerToken);

  try {
    // Both sockets receive their initial snapshot on connect — wait for it
    // so we know the server has fully processed the connection before we
    // start emitting events.
    await buyerSocket._auctionsListPromise;
    await producerSocket._auctionsListPromise;

    const auctionTitle = `Integration test auction ${Date.now()}`;

    const producerSeesCreated = waitForEvent(
      producerSocket, 'auction_created',
      (auction) => auction.title === auctionTitle,
    );
    buyerSocket.emit('create_auction', {
      title: auctionTitle,
      auctionType: 'open',
      deliveryLocation: TEST_WILAYA,
      description: 'Integration test',
      lots: [{ designation: 'Tomate test', quantity: 10, unit: 'tonnes' }],
      radius: 100,
    });
    const [createdAuction] = await producerSeesCreated;
    const auctionId = createdAuction.id;
    assert.equal(createdAuction.status, 'open');

    const buyerSeesBid = waitForEvent(
      buyerSocket, 'auction_updated',
      (auction) => auction.id === auctionId && (auction.bids || []).length > 0,
    );
    producerSocket.emit('place_bid', {
      auctionId,
      lines: [{ price: 42.5, quantity: 10, optionName: 'Standard', unit: 'tonnes', comments: '', images: [] }],
    });
    const [auctionWithBid] = await buyerSeesBid;
    assert.equal(auctionWithBid.bids.length, 1);
    const bidId = auctionWithBid.bids[0].id;
    assert.equal(auctionWithBid.bids[0].lines[0].price, 42.5);

    const producerSeesAccepted = waitForEvent(
      producerSocket, 'auction_updated',
      (auction) => auction.id === auctionId && auction.status === 'closed',
    );
    const producerSeesNotification = waitForEvent(
      producerSocket, 'new_notification',
      (notif) => notif.auctionId === auctionId && notif.type === 'bid_accepted',
    );
    buyerSocket.emit('accept_bid', { auctionId, bidId });
    const [closedAuction] = await producerSeesAccepted;
    await producerSeesNotification;
    assert.equal(closedAuction.status, 'closed');

    // Verify the persisted state directly, independent of what got broadcast.
    const persisted = await db.collection('auctions').findOne({ id: auctionId });
    assert.equal(persisted.status, 'closed');
    assert.equal(persisted.acceptedBidId, bidId);
    assert.equal(persisted.bids.length, 1);
    assert.equal(persisted.bids[0].producerId, String(producerId));

    // Tag for cleanup in after().
    await db.collection('auctions').updateOne({ id: auctionId }, { $set: { integrationTest: true } });
  } finally {
    buyerSocket.disconnect();
    producerSocket.disconnect();
  }
});

test('progressive ("enchère dégressive contrôlée") auction caps each round\'s price drop', async () => {
  const buyerToken = jwt.sign({ userId: String(buyerId), email: 'integration.buyer@test.local', role: 'buyer' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const producerToken = jwt.sign({ userId: String(producerId), email: 'integration.producer@test.local', role: 'producer' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

  const buyerSocket = await connectSocket(buyerToken);
  const producerSocket = await connectSocket(producerToken);

  try {
    await buyerSocket._auctionsListPromise;
    await producerSocket._auctionsListPromise;

    const auctionTitle = `Progressive auction ${Date.now()}`;
    const producerSeesCreated = waitForEvent(producerSocket, 'auction_created', (a) => a.title === auctionTitle);
    buyerSocket.emit('create_auction', {
      title: auctionTitle,
      auctionType: 'open',
      deliveryLocation: TEST_WILAYA,
      description: 'Progressive auction test',
      // priceCeiling (1000 DA) becomes targetPrice, the reference price for round 1's [80%,100%] window.
      lots: [{ designation: 'Ble test', quantity: 10, unit: 'tonnes', priceCeiling: 1000 }],
      radius: 100,
      roundConfig: { enabled: true, totalRounds: 3, roundDurationHours: 8, maxDecreasePercent: 5, initialMinPercent: 80 },
    });
    const [createdAuction] = await producerSeesCreated;
    const auctionId = createdAuction.id;
    assert.equal(createdAuction.status, 'open');
    assert.equal(createdAuction.roundConfig.enabled, true);
    assert.equal(createdAuction.currentRound, 1);

    // Round 1: a price below 80% of the 1000 DA reference (i.e. < 800) must be rejected.
    const round1RejectedError = waitForEvent(producerSocket, 'error');
    producerSocket.emit('place_bid', { auctionId, lines: [{ price: 700, quantity: 10, unit: 'tonnes' }] });
    const [round1RejectedPayload] = await round1RejectedError;
    assert.match(round1RejectedPayload.message, /tour 1/i);

    // Round 1: a price within [800, 1000] is accepted.
    const buyerSeesRound1Bid = waitForEvent(buyerSocket, 'auction_updated', (a) => a.id === auctionId && (a.bids || []).length > 0);
    producerSocket.emit('place_bid', { auctionId, lines: [{ price: 900, quantity: 10, unit: 'tonnes' }] });
    const [auctionAfterRound1] = await buyerSeesRound1Bid;
    assert.equal(auctionAfterRound1.bids[0].lines[0].price, 900);

    // Round 1: submitting more than one price option is rejected outright in progressive mode.
    const multiOptionError = waitForEvent(producerSocket, 'error');
    producerSocket.emit('place_bid', {
      auctionId,
      lines: [{ price: 900, quantity: 5, unit: 'tonnes' }, { price: 850, quantity: 5, unit: 'tonnes' }],
    });
    const [multiOptionPayload] = await multiOptionError;
    assert.match(multiOptionPayload.message, /seul prix/i);

    // Advance to round 2 directly in the DB (mirrors what the server's own round timer/poll would do).
    await db.collection('auctions').updateOne({ id: auctionId }, { $set: { currentRound: 2 } });

    // Round 2: dropping more than 5% below the round-1 price of 900 (i.e. below 855) must be rejected.
    const round2RejectedError = waitForEvent(producerSocket, 'error');
    producerSocket.emit('place_bid', { auctionId, lines: [{ price: 800, quantity: 10, unit: 'tonnes' }] });
    const [round2RejectedPayload] = await round2RejectedError;
    assert.match(round2RejectedPayload.message, /tour 2/i);

    // Round 2: a price within [855, 900] is accepted, and the round-by-round trail is recorded.
    const buyerSeesRound2Bid = waitForEvent(buyerSocket, 'auction_updated', (a) => a.id === auctionId && a.bids?.[0]?.lines?.[0]?.price === 870);
    producerSocket.emit('place_bid', { auctionId, lines: [{ price: 870, quantity: 10, unit: 'tonnes' }] });
    await buyerSeesRound2Bid;

    const persisted = await db.collection('auctions').findOne({ id: auctionId });
    assert.equal(persisted.bids.length, 1);
    assert.deepEqual(
      persisted.bids[0].roundHistory.map(h => ({ round: h.round, price: h.price })),
      [{ round: 1, price: 900 }, { round: 2, price: 870 }],
    );

    await db.collection('auctions').updateOne({ id: auctionId }, { $set: { integrationTest: true } });
  } finally {
    buyerSocket.disconnect();
    producerSocket.disconnect();
  }
});

test('a producer outside the auction zone cannot bid', async () => {
  const buyerToken = jwt.sign({ userId: String(buyerId), email: 'integration.buyer@test.local', role: 'buyer' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const outsiderResult = await db.collection('users').insertOne({
    name: 'Integration Test Outsider Producer',
    email: `integration.outsider.${Date.now()}@test.local`,
    password: 'unused-password-hash',
    role: 'producer',
    isVerified: true,
    isActive: true,
    wilaya: 'tamanrasset',
    commune: 'tamanrasset',
    integrationTest: true,
  });
  const outsiderToken = jwt.sign({ userId: String(outsiderResult.insertedId), email: 'integration.outsider@test.local', role: 'producer' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

  const buyerSocket = await connectSocket(buyerToken);
  const outsiderSocket = await connectSocket(outsiderToken);

  try {
    await buyerSocket._auctionsListPromise;
    await outsiderSocket._auctionsListPromise;

    const auctionTitle = `Zone test auction ${Date.now()}`;
    // A tight 10km radius makes the ~2000km Alger<->Tamanrasset gap
    // unambiguously out of zone, regardless of the exact coordinate model.
    buyerSocket.emit('create_auction', {
      title: auctionTitle,
      auctionType: 'open',
      deliveryLocation: TEST_WILAYA,
      description: 'Zone test',
      lots: [{ designation: 'Orge test', quantity: 5, unit: 'tonnes' }],
      radius: 10,
    });
    const [createdAuction] = await waitForEvent(buyerSocket, 'auction_created', (a) => a.title === auctionTitle);

    const errorPromise = waitForEvent(outsiderSocket, 'error');
    outsiderSocket.emit('place_bid', {
      auctionId: createdAuction.id,
      lines: [{ price: 10, quantity: 5, optionName: 'Standard', unit: 'tonnes', comments: '', images: [] }],
    });
    const [errorPayload] = await errorPromise;
    assert.match(errorPayload.message, /autorisé/i);

    const persisted = await db.collection('auctions').findOne({ id: createdAuction.id });
    assert.equal(persisted.bids.length, 0);

    await db.collection('auctions').updateOne({ id: createdAuction.id }, { $set: { integrationTest: true } });
  } finally {
    buyerSocket.disconnect();
    outsiderSocket.disconnect();
  }
});
