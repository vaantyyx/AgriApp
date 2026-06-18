import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agriapp';

async function verifyAllUsers() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const result = await db.collection('users').updateMany(
      { isVerified: false },
      { $set: { isVerified: true } }
    );
    console.log(`Updated ${result.modifiedCount} user(s) to isVerified: true.`);
  } catch (error) {
    console.error('Error during verification update:', error);
  } finally {
    await client.close();
  }
}

verifyAllUsers();
