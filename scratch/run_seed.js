/**
 * Production Atlas seeding script.
 * Run with: node --experimental-vm-modules scratch/run_seed.js
 * Or simply: node scratch/run_seed.js (if package.json has "type":"module")
 *
 * Uses the MONGODB_URI from .env to connect to production Atlas.
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the app .env file (contains production MONGODB_URI)
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

// Inline minimal TestMaster model (avoids importing full app stack)
const parameterSchema = new mongoose.Schema({
  name: String,
  unit: String,
  normalLow: Number,
  normalHigh: Number,
  criticalLow: Number,
  criticalHigh: Number,
}, { _id: false });

const testMasterSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, trim: true },
  name:       { type: String, required: true, trim: true },
  department: { type: String, trim: true },
  sampleType: { type: String, trim: true },
  container:  { type: String, trim: true },
  basePrice:  { type: Number, default: 0 },
  parameters: [parameterSchema],
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

const TestMaster = mongoose.models.TestMaster || mongoose.model('TestMaster', testMasterSchema);

// Import the seeder
const { seedGlobalCatalog } = await import('../src/utils/seedCatalog.js');

async function run() {
  console.log('🔗 Connecting to MongoDB Atlas (production)...');
  await mongoose.connect(MONGODB_URI, { dbName: 'pehlix' });
  console.log('✅ Connected to:', mongoose.connection.host);

  // Check current count BEFORE seeding
  const before = await TestMaster.countDocuments();
  console.log(`📊 TestMaster records before seeding: ${before}`);

  if (before >= 500) {
    console.log(`✅ Catalog is already fully seeded (${before} tests). Nothing to do.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('\n🌱 Starting catalog seed...');
  await seedGlobalCatalog();

  const after = await TestMaster.countDocuments();
  console.log(`\n✅ Done! TestMaster records after seeding: ${after}`);
  console.log(`📈 Added: ${after - before} new tests`);

  await mongoose.disconnect();
  console.log('👋 Disconnected from Atlas.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
