import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default async function globalSetup() {
  console.log('--- Playwright Global Setup ---');
  
  // WARNING: Ensure we are NOT connecting to the production database
  // We append '_e2e' to the database name to ensure strict isolation
  let mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn('MONGODB_URI not found. Skipping global DB setup.');
    return;
  }

  // Force the connection string to use the e2e database
  if (!mongoUri.includes('pehlix_e2e')) {
    mongoUri = mongoUri.replace(/\/\?/, '/pehlix_e2e?');
    if (!mongoUri.includes('pehlix_e2e')) {
       mongoUri += '/pehlix_e2e';
    }
  }

  console.log('Connecting to E2E isolated database...');
  await mongoose.connect(mongoUri);

  console.log('Clearing old E2E data...');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }

  console.log('E2E Database ready.');
  await mongoose.connection.close();
}
