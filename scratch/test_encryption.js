import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/utils/db.js';
import { encryptField, decryptField, rotateMasterKey, calculateBlindIndex } from '../src/utils/crypto.js';
import User from '../src/modules/staff/user.model.js';
import Patient from '../src/modules/patients/patient.model.js';

dotenv.config();

async function runEncryptionTests() {
  console.log('\n====== STARTING ENVELOPE ENCRYPTION TESTS ======\n');

  // 1. Basic Crypto Tests
  console.log('--- TEST 1: Basic Crypto Unit Tests ---');
  const testPhone = '9876543210';
  const testEmail = 'Patient.Test@example.com';

  const encryptedPhone = encryptField(testPhone);
  console.log('✔ Plaintext Phone:', testPhone);
  console.log('✔ Encrypted Phone Payload:', encryptedPhone);
  
  if (encryptedPhone.startsWith('__enc__:')) {
    console.log('✔ PASS: Encrypted string contains standard "__enc__:" prefix');
  } else {
    throw new Error('FAIL: Missing prefix in encrypted payload');
  }

  const decryptedPhone = decryptField(encryptedPhone);
  console.log('✔ Decrypted Phone:', decryptedPhone);
  if (decryptedPhone === testPhone) {
    console.log('✔ PASS: Decrypted value matches original value');
  } else {
    throw new Error('FAIL: Decryption mismatch');
  }

  // 2. Master Key Rotation Unit Test
  console.log('\n--- TEST 2: Master Key Rotation Unit Test ---');
  const oldMasterKeyHex = process.env.DATABASE_ENCRYPTION_KEY || '8f4a2d8e9c0b1a3f5e7d6c8b9a0f2e1d4c3b5a7e9f0d1c2b3a4f5e6d7c8b9a0f';
  // Generate a random 32-byte key for rotation (64 hex characters)
  const newMasterKeyHex = 'a1b2c3d4e5f6011223344556677889900aabbccddeeff0011223344556677889';

  const rotatedPayload = rotateMasterKey(encryptedPhone, oldMasterKeyHex, newMasterKeyHex);
  console.log('✔ Rotated Payload:', rotatedPayload);

  // Decrypt with new master key. Since our getMasterKey() reads from process.env, let's temporarily swap env keys
  const originalKeyEnv = process.env.DATABASE_ENCRYPTION_KEY;
  process.env.DATABASE_ENCRYPTION_KEY = newMasterKeyHex;
  
  const decryptedRotated = decryptField(rotatedPayload);
  console.log('✔ Decrypted Rotated Phone (using new key):', decryptedRotated);
  
  // Restore original key env properly
  if (originalKeyEnv === undefined) {
    delete process.env.DATABASE_ENCRYPTION_KEY;
  } else {
    process.env.DATABASE_ENCRYPTION_KEY = originalKeyEnv;
  }

  if (decryptedRotated === testPhone) {
    console.log('✔ PASS: Decrypted value after key rotation matches original');
  } else {
    throw new Error('FAIL: Decryption after key rotation failed');
  }

  // 3. Database Layer E2E Verification
  console.log('\n--- TEST 3: Database Encryption & Blind Index E2E Verification ---');
  await connectDB();
  console.log('✔ Connected to MongoDB.');

  const suffix = Date.now().toString().slice(-6);
  const testPatientPhone = '8888' + suffix;
  const testPatientEmail = `test_${suffix}@pehlix.in`;

  // Cleanup potential leftover tests
  await Patient.deleteMany({ phoneBlindIndex: calculateBlindIndex(testPatientPhone, 'phone') });

  // Create Patient
  const patient = await Patient.create({
    labId: new mongoose.Types.ObjectId(),
    patientCode: 'PAT' + suffix,
    firstName: 'Crypto',
    lastName: 'Patient',
    phone: testPatientPhone,
    email: testPatientEmail,
    age: 28,
    ageUnit: 'years',
    gender: 'female',
    consentGiven: true
  });

  console.log(`✔ Patient created. ID: ${patient._id}`);

  // Raw Query directly to Mongo (bypass Mongoose getters) to inspect DB representation
  const rawDoc = await mongoose.connection.db.collection('patients').findOne({ _id: patient._id });
  
  console.log('✔ Raw stored database values:');
  console.log('  - phone in DB:', rawDoc.phone);
  console.log('  - email in DB:', rawDoc.email);
  console.log('  - phoneBlindIndex in DB:', rawDoc.phoneBlindIndex);
  console.log('  - emailBlindIndex in DB:', rawDoc.emailBlindIndex);

  if (rawDoc.phone.startsWith('__enc__:') && rawDoc.email.startsWith('__enc__:')) {
    console.log('✔ PASS: Data is encrypted in the raw MongoDB collection');
  } else {
    throw new Error('FAIL: Data not encrypted in raw MongoDB collection');
  }

  if (rawDoc.phoneBlindIndex && rawDoc.emailBlindIndex) {
    console.log('✔ PASS: Blind indexes are generated and stored correctly');
  } else {
    throw new Error('FAIL: Blind indexes missing from MongoDB document');
  }

  // Find document via regular mongoose query using normalized search
  console.log('\n--- TEST 4: Query Interception & Match ---');
  
  // Test query translation
  const foundByPhone = await Patient.findOne({ phone: testPatientPhone });
  if (foundByPhone) {
    console.log('✔ Found Patient by phone:', foundByPhone.firstName, foundByPhone.lastName);
    console.log('✔ Decrypted phone getter value:', foundByPhone.phone);
    console.log('✔ Decrypted email getter value:', foundByPhone.email);
    
    if (foundByPhone.phone === testPatientPhone && foundByPhone.email === testPatientEmail) {
      console.log('✔ PASS: Mongoose pre-query and getters working flawlessly for phone search');
    } else {
      throw new Error('FAIL: Getter decryption returns incorrect values');
    }
  } else {
    throw new Error('FAIL: Mongoose pre-query plugin did not translate phone lookup to use blind index');
  }

  // Cleanup E2E test data
  await Patient.deleteOne({ _id: patient._id });
  console.log('✔ Cleaned up E2E patient record.');

  console.log('\n====== ALL ENVELOPE ENCRYPTION TESTS PASSED SUCCESSFULLY! ======\n');
  mongoose.connection.close();
}

runEncryptionTests().catch(err => {
  console.error('❌ Encryption test failed:', err);
  mongoose.connection.close();
  process.exit(1);
});
