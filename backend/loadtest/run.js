// Socket.IO load test: connects N simulated producers concurrently, waits
// for the initial auctions_list snapshot, then has each of them place one
// bid at roughly the same time — mirroring "des enchères en même temps".
// Tokens are minted directly with the real JWT_SECRET (skipping the
// login/CAPTCHA flow, which exists specifically to stop scripted logins —
// not something we want to fight here for an internal capacity test).
//
// Usage: LOADTEST_MONGODB_URI=... JWT_SECRET=... node loadtest/run.js <concurrency> [serverUrl]
//   LOADTEST_MONGODB_URI=mongodb://127.0.0.1:27017/agriapp_loadtest JWT_SECRET=xxx node loadtest/run.js 100 http://localhost:3099
//
// Requires: seed.js already run against the SAME database the target
// server instance is using, with at least <concurrency> producers seeded.
// JWT_SECRET must be passed explicitly (not read from backend/.env) and
// must match whatever the target server instance was started with.
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
import { resolveLoadTestUri } from './safe-db.js';

const CONCURRENCY = parseInt(process.argv[2] || '100', 10);
const SERVER_URL = process.argv[3] || 'http://localhost:3099';
const MONGODB_URI = resolveLoadTestUri();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET env var required (must match the target server instance), passed explicitly — not read from backend/.env.');
  process.exit(1);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(p / 100 * sorted.length));
  return sorted[idx];
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const producers = await db.collection('users')
    .find({ loadTest: true, role: 'producer' })
    .limit(CONCURRENCY)
    .toArray();
  await client.close();

  if (producers.length < CONCURRENCY) {
    console.error(`Only ${producers.length} seeded producers found, need ${CONCURRENCY}. Run seed.js with a higher count first.`);
    process.exit(1);
  }

  console.log(`Load test: ${CONCURRENCY} concurrent producers against ${SERVER_URL}`);

  const connectTimes = [];
  const snapshotTimes = [];
  const bidRoundTrips = [];
  let connectErrors = 0;
  let bidErrors = 0;
  let bidTimeouts = 0;

  const runOne = (producer) => new Promise((resolve) => {
    const token = jwt.sign(
      { userId: String(producer._id), email: producer.email, role: producer.role },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

    const tConnectStart = Date.now();
    const socket = ioClient(SERVER_URL, { auth: { token }, transports: ['websocket'], reconnection: false });

    let gotSnapshot = false;
    let auctionIdToBidOn = null;

    socket.on('connect', () => {
      connectTimes.push(Date.now() - tConnectStart);
    });

    socket.on('connect_error', (err) => {
      connectErrors++;
      resolve();
    });

    socket.on('auctions_list', (auctions) => {
      if (gotSnapshot) return;
      gotSnapshot = true;
      snapshotTimes.push(Date.now() - tConnectStart);
      const openOne = auctions.find(a => a.status === 'open');
      auctionIdToBidOn = openOne ? openOne.id : null;

      if (!auctionIdToBidOn) {
        socket.disconnect();
        resolve();
        return;
      }

      const tBidStart = Date.now();
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; bidTimeouts++; socket.disconnect(); resolve(); }
      }, 20000);

      socket.on('error', (payload) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        bidErrors++;
        bidRoundTrips.push(Date.now() - tBidStart);
        socket.disconnect();
        resolve();
      });

      socket.on('auction_updated', (updated) => {
        if (settled) return;
        if (updated.id !== auctionIdToBidOn) return;
        const myBid = (updated.bids || []).find(() => true); // any bid confirms broadcast round-trip landed
        if (!myBid) return;
        settled = true;
        clearTimeout(timeout);
        bidRoundTrips.push(Date.now() - tBidStart);
        socket.disconnect();
        resolve();
      });

      socket.emit('place_bid', {
        auctionId: auctionIdToBidOn,
        lines: [{ price: 100 + Math.floor(Math.random() * 50), quantity: 5, optionName: '', unit: 'tonnes', comments: 'loadtest' }],
      });
    });
  });

  const tStart = Date.now();
  await Promise.all(producers.map(runOne));
  const totalDuration = Date.now() - tStart;

  connectTimes.sort((a, b) => a - b);
  snapshotTimes.sort((a, b) => a - b);
  bidRoundTrips.sort((a, b) => a - b);

  console.log('\n=== Results ===');
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Total wall time: ${totalDuration} ms`);
  console.log(`Connect errors: ${connectErrors}`);
  console.log(`Bid errors (server rejected): ${bidErrors}`);
  console.log(`Bid timeouts (no response in 20s): ${bidTimeouts}`);
  console.log(`Successful bid round-trips: ${bidRoundTrips.length}`);
  console.log('\nConnect time (ms):  p50=%s p90=%s p99=%s max=%s',
    percentile(connectTimes, 50), percentile(connectTimes, 90), percentile(connectTimes, 99), connectTimes.at(-1));
  console.log('Snapshot time (ms): p50=%s p90=%s p99=%s max=%s',
    percentile(snapshotTimes, 50), percentile(snapshotTimes, 90), percentile(snapshotTimes, 99), snapshotTimes.at(-1));
  console.log('Bid round-trip (ms): p50=%s p90=%s p99=%s max=%s',
    percentile(bidRoundTrips, 50), percentile(bidRoundTrips, 90), percentile(bidRoundTrips, 99), bidRoundTrips.at(-1));

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
