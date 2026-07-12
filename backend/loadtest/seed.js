// One-off script: seeds producer/buyer accounts and open auctions for the
// Socket.IO load test in run.js. Every document gets `loadTest: true` so
// cleanup.js can remove exactly this data and nothing else.
//
// Producers are spread across every wilaya (national distribution) and
// buyers/auctions are all anchored in one wilaya with a realistic radius —
// this mirrors real usage (most connected producers are nowhere near any
// given local auction) and is what actually exercises the wilaya-room
// broadcast filter in server.js, unlike a huge radius that puts everyone
// in zone regardless.
//
// Usage: LOADTEST_MONGODB_URI=mongodb://127.0.0.1:27017/agriapp_loadtest node loadtest/seed.js [producers] [buyers] [auctionsPerBuyer] [radiusKm]
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { resolveLoadTestUri } from './safe-db.js';
import { WILAYA_NAME_TO_ID, getWilayaCoords } from '../services/auctionMatching.js';

const MONGODB_URI = resolveLoadTestUri();

const NUM_PRODUCERS = parseInt(process.argv[2] || '200', 10);
const NUM_BUYERS = parseInt(process.argv[3] || '20', 10);
const AUCTIONS_PER_BUYER = parseInt(process.argv[4] || '5', 10);
const RADIUS_KM = parseInt(process.argv[5] || '100', 10);

const ALL_WILAYAS = Object.keys(WILAYA_NAME_TO_ID); // lowercase names, spans the whole country
const BUYER_WILAYA = 'alger'; // every buyer/auction anchored here
const PRODUCTS = ['Blé Dur', 'Tomate', 'Pomme de terre', 'Orge', 'Oignon', 'Datte', 'Agrumes'];

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log(`Seeding into ${MONGODB_URI}`);
  console.log(`Producers: ${NUM_PRODUCERS} (spread nationally), Buyers: ${NUM_BUYERS} (all in ${BUYER_WILAYA}), Auctions/buyer: ${AUCTIONS_PER_BUYER}, radiusKm: ${RADIUS_KM}`);

  const passwordHash = await bcrypt.hash('loadtest123', 10);

  const producers = Array.from({ length: NUM_PRODUCERS }, (_, i) => {
    const wilaya = ALL_WILAYAS[i % ALL_WILAYAS.length];
    return {
      name: `LoadTest Producer ${i}`,
      email: `loadtest.producer.${i}@test.local`,
      password: passwordHash,
      role: 'producer',
      isVerified: true,
      isActive: true,
      wilaya,
      commune: wilaya,
      phone: '',
      profilePhoto: null,
      bio: '',
      loadTest: true,
      createdAt: new Date(),
    };
  });

  const buyerCoords = getWilayaCoords(BUYER_WILAYA);
  const buyers = Array.from({ length: NUM_BUYERS }, (_, i) => ({
    name: `LoadTest Buyer ${i}`,
    email: `loadtest.buyer.${i}@test.local`,
    password: passwordHash,
    role: 'buyer',
    isVerified: true,
    isActive: true,
    wilaya: BUYER_WILAYA,
    commune: BUYER_WILAYA,
    phone: '',
    profilePhoto: null,
    bio: '',
    entity_type: 'particulier',
    loadTest: true,
    createdAt: new Date(),
  }));

  await db.collection('users').deleteMany({ loadTest: true });
  const producerResult = producers.length ? await db.collection('users').insertMany(producers) : { insertedIds: {} };
  const buyerResult = buyers.length ? await db.collection('users').insertMany(buyers) : { insertedIds: {} };
  const buyerDocs = buyers.map((b, i) => ({ ...b, _id: Object.values(buyerResult.insertedIds)[i] }));

  await db.collection('auctions').deleteMany({ loadTest: true });

  const now = new Date();
  const auctions = [];
  buyerDocs.forEach((buyer) => {
    for (let j = 0; j < AUCTIONS_PER_BUYER; j++) {
      const product = PRODUCTS[(auctions.length) % PRODUCTS.length];
      auctions.push({
        id: `loadtest_auc_${buyer._id}_${j}`,
        buyerId: String(buyer._id),
        buyerName: buyer.name,
        buyerWilaya: buyer.wilaya,
        buyerCommune: buyer.commune,
        buyerLat: buyerCoords?.lat ?? null,
        buyerLng: buyerCoords?.lng ?? null,
        radiusKm: RADIUS_KM,
        isSearchZoneChanged: false,
        title: `${product} — lot ${j}`,
        auctionType: 'open', // avoid the 'smart' parcelles product-matching path for this test
        deliveryLocation: buyer.commune,
        description: 'Auction générée pour le test de charge.',
        lots: [],
        startAt: null,
        endAt: null,
        autoProlongate: false,
        prolongationMinutes: null,
        maxProlongations: null,
        product,
        quantity: 10,
        unit: 'tonnes',
        targetPrice: null,
        status: 'open',
        createdAt: now.toISOString(),
        bids: [],
        acceptedBidId: null,
        acceptedLineId: null,
        alreadyRated: false,
        loadTest: true,
      });
    }
  });
  if (auctions.length) await db.collection('auctions').insertMany(auctions);

  console.log(`Seeded ${producers.length} producers, ${buyers.length} buyers, ${auctions.length} open auctions.`);
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
