import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agriapp';

const users = [
  {
    name: 'Acheteur Adrar',
    email: 'buyer.adrar@test.com',
    role: 'buyer',
    phone: '+213550111111',
    wilaya: 'Adrar',
    commune: 'Adrar',
    entity_type: 'particulier',
  },
  {
    name: 'Acheteur Chlef',
    email: 'buyer.chlef@test.com',
    role: 'buyer',
    phone: '+213550222222',
    wilaya: 'Chlef',
    commune: 'Chlef',
    entity_type: 'entreprise',
    nom_commercial: 'DistriChlef SARL',
    forme_juridique: 'SARL',
    rc: 'RC-12345-CHLEF',
    nif: 'NIF-67890-CHLEF',
    secteur_activite: 'distribution',
    possede_transport: true,
    possede_chambre_froide: true,
  },
  {
    name: 'Producteur Adrar',
    email: 'prod.adrar@test.com',
    role: 'producer',
    phone: '+213550333333',
    wilaya: 'Adrar',
    commune: 'Bouda',
  },
  {
    name: 'Producteur Chlef',
    email: 'prod.chlef@test.com',
    role: 'producer',
    phone: '+213550444444',
    wilaya: 'Chlef',
    commune: 'Zeboudja',
  },
  {
    name: 'Producteur Laghouat',
    email: 'prod.laghouat@test.com',
    role: 'producer',
    phone: '+213550555555',
    wilaya: 'Laghouat',
    commune: 'Laghouat',
  },
];

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();

    // 1. Clear existing database collections
    console.log('Clearing existing collections (users, auctions, notifications, ratings)...');
    await db.collection('users').deleteMany({});
    await db.collection('auctions').deleteMany({});
    await db.collection('notifications').deleteMany({});
    await db.collection('ratings').deleteMany({});
    console.log('Successfully cleared all collections.');

    // 2. Insert new seed users
    const hashedPassword = await bcrypt.hash('password123', 10);

    for (const u of users) {
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
      console.log(`Created user: ${u.name} (${u.email}) - Commune: ${u.commune}, Wilaya: ${u.wilaya}`);
    }
    console.log('Database successfully seeded with 5 users.');
  } catch (err) {
    console.error('Error during database reset and seeding:', err);
  } finally {
    await client.close();
  }
}

seed();
