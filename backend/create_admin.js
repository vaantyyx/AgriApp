// One-off CLI script to bootstrap an admin account — there is no self-serve
// admin registration (the public /register endpoint only allows buyer/producer).
// Usage: node create_admin.js <email> <password> [name]
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agriapp';

async function createAdmin() {
  const [, , email, password, name] = process.argv;

  if (!email || !password) {
    console.error('Usage: node create_admin.js <email> <password> [name]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();

    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      console.error(`A user with email ${email} already exists (role: ${existing.role}).`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      name: name || 'Admin',
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      isActive: true,
      profilePhoto: null,
      phone: '',
      wilaya: '',
      commune: '',
      bio: '',
      createdAt: new Date(),
    });

    console.log(`Admin account created for ${email}.`);
  } catch (error) {
    console.error('Error creating admin account:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createAdmin();
