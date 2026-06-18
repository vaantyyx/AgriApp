import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agriapp';

async function resetDb() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    await db.collection('users').deleteMany({});
    await db.collection('auctions').deleteMany({});
    await db.collection('notifications').deleteMany({});
    await db.collection('ratings').deleteMany({});
    
    console.log('Successfully cleared users, auctions, notifications, and ratings collections.');
  } catch (error) {
    console.error('Error during database reset:', error);
  } finally {
    await client.close();
  }
}

resetDb();
