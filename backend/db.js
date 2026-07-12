// @ts-check
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agriapp';

/** @type {import('mongodb').Db | null} */
let db = null;
/** @type {MongoClient | null} */
let client = null;

/** @returns {Promise<import('mongodb').Db>} */
export async function connectToDatabase() {
  if (db) return db;

  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
    // Configurable so ops can raise it under real concurrent load without a
    // code change; the driver default (100) is a reasonable ceiling for a
    // single small instance but too low once this scales to multiple app
    // server processes sharing the same MongoDB deployment.
    const maxPoolSize = parseInt(process.env.MONGODB_MAX_POOL_SIZE || '', 10) || 100;
    client = new MongoClient(MONGODB_URI, { maxPoolSize });
    await client.connect();
    db = client.db();
    console.log('Successfully connected to MongoDB.');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

/** @returns {import('mongodb').Db} */
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
