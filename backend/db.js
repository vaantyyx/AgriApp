import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agriapp';

let db = null;
let client = null;

export async function connectToDatabase() {
  if (db) return db;

  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('Successfully connected to MongoDB.');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database has not been initialized. Call connectToDatabase first.');
  }
  return db;
}

export async function closeConnection() {
  if (client) {
    await client.close();
    db = null;
    client = null;
    console.log('MongoDB connection closed.');
  }
}
