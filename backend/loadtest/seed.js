// One-off script: seeds producer/buyer accounts and open auctions for the
// Socket.IO load test in run.js. Every document gets `loadTest: true` so
// cleanup.js can remove exactly this data and nothing else.
// Usage: LOADTEST_MONGODB_URI=mongodb://127.0.0.1:27017/agriapp_loadtest node loadtest/seed.js [producers] [buyers] [auctionsPerBuyer]
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { resolveLoadTestUri } from './safe-db.js';

const MONGODB_URI = resolveLoadTestUri();

const NUM_PRODUCERS = parseInt(process.argv[2] || '200', 10);
const NUM_BUYERS = parseInt(process.argv[3] || '20', 10);
const AUCTIONS_PER_BUYER = parseInt(process.argv[4] || '5', 10);

const WILAYAS = ['Adrar', 'Chlef', 'Alger', 'Oran', 'Constantine', 'Setif', 'Blida', 'Batna'];
const PRODUCTS = ['Blé Dur', 'Tomate', 'Pomme de terre', 'Orge', 'Oignon', 'Datte', 'Agrumes'];

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log(`Seeding into ${MONGODB_URI}`);
  console.log(`Producers: ${NUM_PRODUCERS}, Buyers: ${NUM_BUYERS}, Auctions/buyer: ${AUCTIONS_PER_BUYER}`);

  const passwordHash = await bcrypt.hash('loadtest123', 10);

  const producers = Array.from({ length: NUM_PRODUCERS }, (_, i) => ({
    name: `LoadTest Producer ${i}`,
    email: `loadtest.producer.${i}@test.local`,
    password: passwordHash,
    role: 'producer',
    isVerified: true,
    isActive: true,
    wilaya: WILAYAS[i % WILAYAS.length],
    commune: WILAYAS[i % WILAYAS.length],
    phone: '',
    profilePhoto: null,
    bio: '',
    loadTest: true,
    createdAt: new Date(),
  }));

  const buyers = Array.from({ length: NUM_BUYERS }, (_, i) => ({
    name: `LoadTest Buyer ${i}`,
    email: `loadtest.buyer.${i}@test.local`,
    password: passwordHash,
    role: 'buyer',
    isVerified: true,
    isActive: true,
    wilaya: WILAYAS[i % WILAYAS.length],
    commune: WILAYAS[i % WILAYAS.length],
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
  const buyerIds = Object.values(buyerResult.insertedIds).map(String);
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
        buyerLat: null,
        buyerLng: null,
        radiusKm: 2000, // huge radius so every seeded producer is in zone regardless of wilaya
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
  console.log('Producer ids:', producerResult.insertedIds ? Object.keys(producerResult.insertedIds).length : 0);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
