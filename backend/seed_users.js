import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agriapp';

const users = [
  {
    name: 'Acheteur Alger',
    email: 'buyer.alger@test.com',
    role: 'buyer',
    phone: '+213550123456',
    wilaya: 'Alger',
    commune: 'Alger Centre',
  },
  {
    name: 'Producteur Bab Ezzouar',
    email: 'prod.be@test.com',
    role: 'producer',
    phone: '+213550123457',
    wilaya: 'Alger',
    commune: 'Bab Ezzouar',
  },
  {
    name: 'Producteur Oran',
    email: 'prod.oran@test.com',
    role: 'producer',
    phone: '+213550123458',
    wilaya: 'Oran',
    commune: 'Oran',
  },
];

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const hashedPassword = await bcrypt.hash('password123', 10);

    for (const u of users) {
      const existing = await db.collection('users').findOne({ email: u.email });
      if (existing) {
        console.log(`User ${u.email} already exists, skipping.`);
        continue;
      }
      await db.collection('users').insertOne({
        ...u,
        password: hashedPassword,
        isVerified: true,
        profilePhoto: null,
        bio: '',
        averageRating: null,
        ratingCount: 0,
        createdAt: new Date(),
      });
      console.log(`Created user: ${u.name} (${u.email})`);
    }
  } catch (err) {
    console.error('Error seeding users:', err);
  } finally {
    await client.close();
  }
}

seed();
