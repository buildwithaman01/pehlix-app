import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/utils/db.js';
import AdminService from '../src/modules/admin/admin.service.js';
import Lab from '../src/modules/staff/lab.model.js';
import User from '../src/modules/staff/user.model.js';
import { AuditLog } from '../src/middleware/audit.middleware.js';

dotenv.config();

async function runOnboardingTests() {
  console.log('\n====== STARTING LABORATORY ONBOARDING BACKEND VERIFICATION ======\n');

  // 1. Connect to DB
  await connectDB();
  console.log('✔ Connected to MongoDB.');

  const suffix = Date.now().toString().slice(-6);
  const adminId = new mongoose.Types.ObjectId();

  // Cleanup past test data
  console.log('Cleaning up old test data...');
  await Lab.deleteMany({ slug: /^test-onboard-/ });
  await User.deleteMany({ email: /^test-onboard-/ });
  await AuditLog.deleteMany({ action: 'lab_onboarded' });

  // 2. Test 1: Successful Lab Onboarding (Starter Plan)
  console.log('\n--- TEST 1: Starter Plan Lab Onboarding ---');
  const starterLabData = {
    labName: `Test Onboard Starter ${suffix}`,
    city: 'Mumbai',
    phone: '9876543210',
    email: `test-onboard-starter-${suffix}@pehlix.com`,
    plan: 'starter',
    ownerName: `Owner Starter ${suffix}`,
    ownerPhone: `90000${suffix}`,
    ownerEmail: `test-onboard-owner-${suffix}@pehlix.com`
  };

  const result1 = await AdminService.createLab(starterLabData, adminId);
  console.log('Created Lab:', result1.lab.name, `(Slug: ${result1.lab.slug})`);
  console.log('Provisioned Owner:', result1.owner.name, `(ID: ${result1.owner._id})`);

  // Assertions for Lab
  if (result1.lab.plan !== 'starter') throw new Error('Lab plan is not starter');
  if (result1.lab.address.city !== 'Mumbai') throw new Error('Lab city is incorrect');
  if (result1.lab.planConfig.limits.staffCount !== 3) throw new Error('Starter plan staffCount limit should be 3');
  if (result1.lab.planConfig.modules.inventory !== false) throw new Error('Starter plan should not have inventory module enabled');
  if (result1.lab.registrationState !== 'sandbox') throw new Error('Unverified lab without GST/NABL must start in sandbox state');
  if (!result1.lab.tempTrialExpiry) throw new Error('Unverified lab without GST/NABL must have tempTrialExpiry set');

  // Assertions for User
  if (result1.owner.role !== 'owner') throw new Error('Provisioned user is not owner role');
  if (result1.owner.isOtpOnly !== true) throw new Error('Provisioned owner must be isOtpOnly: true');
  if (result1.owner.labId.toString() !== result1.lab._id.toString()) throw new Error('Owner labId is not set to the created lab');

  console.log('✔ PASS: Starter Lab created and Owner provisioned successfully.');

  // 3. Test 2: Successful Lab Onboarding (Pro Plan)
  console.log('\n--- TEST 2: Pro Plan Lab Onboarding ---');
  const proLabData = {
    labName: `Test Onboard Pro ${suffix}`,
    city: 'Delhi',
    phone: '9876543211',
    email: `test-onboard-pro-${suffix}@pehlix.com`,
    plan: 'pro',
    ownerName: `Owner Pro ${suffix}`,
    ownerPhone: `91000${suffix}`,
    ownerEmail: `test-onboard-owner-pro-${suffix}@pehlix.com`,
    gstNumber: '27AAACG0000A1Z5',
    nablNumber: 'MC-1234'
  };

  const result2 = await AdminService.createLab(proLabData, adminId);
  console.log('Created Lab:', result2.lab.name, `(Slug: ${result2.lab.slug})`);

  // Assertions for Pro Lab limits and modules
  if (result2.lab.planConfig.limits.staffCount !== 999) throw new Error('Pro plan staffCount limit should be 999');
  if (result2.lab.planConfig.modules.inventory !== true) throw new Error('Pro plan should have inventory module enabled');
  if (result2.lab.planConfig.modules.webhooks !== true) throw new Error('Pro plan should have webhooks module enabled');
  if (result2.lab.registrationState !== 'production') throw new Error('Trusted lab with NABL/GST must start in production state');
  if (result2.lab.tempTrialExpiry) throw new Error('Trusted lab with NABL/GST should not have tempTrialExpiry');

  console.log('✔ PASS: Pro Lab created with correct tier configuration.');

  // 4. Test 3: Duplicate Owner Phone number check
  console.log('\n--- TEST 3: Duplicate Owner Phone Prevention ---');
  const duplicateLabData = {
    labName: `Test Onboard Dup ${suffix}`,
    city: 'Bangalore',
    phone: '9876543212',
    email: `test-onboard-dup-${suffix}@pehlix.com`,
    plan: 'starter',
    ownerName: `Owner Dup ${suffix}`,
    ownerPhone: starterLabData.ownerPhone, // duplicate phone
    ownerEmail: `test-onboard-owner-dup-${suffix}@pehlix.com`
  };

  try {
    await AdminService.createLab(duplicateLabData, adminId);
    throw new Error('Onboarding should have failed with duplicate owner phone number');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✔ PASS: Successfully blocked duplicate owner phone number registration:', error.message);
    } else {
      throw error;
    }
  }

  // 5. Test 4: Audit Logs Verification
  console.log('\n--- TEST 4: Audit Logs Verification ---');
  const auditLogs = await AuditLog.find({ action: 'lab_onboarded' });
  console.log(`Found ${auditLogs.length} lab creation audit log records.`);
  if (auditLogs.length !== 2) {
    throw new Error(`Expected exactly 2 audit logs, found ${auditLogs.length}`);
  }
  
  const sampleAudit = auditLogs[0];
  if (sampleAudit.role !== 'superAdmin' || sampleAudit.userId.toString() !== adminId.toString()) {
    throw new Error('Audit log superAdmin identity or creator metadata is incorrect');
  }
  console.log('✔ PASS: Audit logs successfully verify superAdmin operations.');

  // 6. Test 5: Billing Override & Trial Extension Check
  console.log('\n--- TEST 5: Billing Override & Trial Extension ---');
  const extensionDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days extension
  const updatedResult = await AdminService.overrideBilling(
    result1.lab._id,
    {
      trialEndDate: extensionDate
    },
    adminId
  );
  
  if (updatedResult.isTrialExtended !== true) throw new Error('isTrialExtended should be set to true on trialEndDate override');
  if (new Date(updatedResult.tempTrialExpiry).toDateString() !== extensionDate.toDateString()) {
    throw new Error('tempTrialExpiry should match the overridden trialEndDate');
  }
  console.log('✔ PASS: Successfully verified trial extension and sandbox unlock via billing override.');

  // Cleanup test data
  console.log('\nCleaning up generated test documents...');
  await Lab.deleteMany({ slug: /^test-onboard-/ });
  await User.deleteMany({ email: /^test-onboard-/ });
  await AuditLog.deleteMany({ action: 'lab_onboarded' });
  await AuditLog.deleteMany({ action: 'billing_override' });

  console.log('\n=============================================================');
  console.log('✔ ALL LAB ONBOARDING BACKEND TESTS COMPLETED SUCCESSFULLY!');
  console.log('=============================================================\n');

  process.exit(0);
}

runOnboardingTests().catch(err => {
  console.error('❌ Onboarding tests encountered an error:', err);
  process.exit(1);
});
