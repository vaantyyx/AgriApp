// Removes everything seed.js created (matched by the loadTest:true marker)
// and nothing else.
import { MongoClient } from 'mongodb';
import { resolveLoadTestUri } from './safe-db.js';

const MONGODB_URI = resolveLoadTestUri();

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  const u = await db.collection('users').deleteMany({ loadTest: true });
  const a = await db.collection('auctions').deleteMany({ loadTest: true });
  // Notifications don't carry a loadTest marker directly, but every one generated
  // by this test references one of our loadtest_auc_* auction ids — safe, precise filter.
  const n = await db.collection('notifications').deleteMany({ auctionId: { $regex: '^loadtest_auc_' } });

  console.log(`Removed ${u.deletedCount} users, ${a.deletedCount} auctions, ${n.deletedCount} notifications.`);
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
