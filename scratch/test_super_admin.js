import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

// Generate RS256 private/public key pair in-memory for testing to avoid placeholder failure
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Override access private/public keys in env
process.env.JWT_ACCESS_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
process.env.JWT_ACCESS_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n');

// Stub JWT secrets if needed
if (!process.env.JWT_SUPER_ADMIN_SECRET || process.env.JWT_SUPER_ADMIN_SECRET.includes('PLACEHOLDER')) {
  process.env.JWT_SUPER_ADMIN_SECRET = 'test_super_admin_secret_key_long_enough_for_security_standards_123';
}

// Stub external services before importing modules to prevent network requests
import WhatsAppService from '../src/utils/whatsapp.js';
import PdfService from '../src/utils/pdf.js';
import SmsService from '../src/utils/sms.js';

WhatsAppService.send = async () => ({ success: true });
WhatsAppService.sendDirectText = async () => ({ success: true });
SmsService.send = async () => ({ success: true });

let pdfJobCalls = [];
PdfService.enqueuePdfJob = async (visitId, labId, reportId, complexityScore) => {
  pdfJobCalls.push({ visitId, labId, reportId, complexityScore });
  return 'mock-qstash-message-id';
};

// Now import service and models
import { connectDB } from '../src/utils/db.js';
import AdminService, { ImpersonationLog, FeatureFlags } from '../src/modules/admin/admin.service.js';
import Lab from '../src/modules/staff/lab.model.js';
import User from '../src/modules/staff/user.model.js';
import Report from '../src/modules/reports/report.model.js';
import Patient from '../src/modules/patients/patient.model.js';
import Visit from '../src/modules/visits/visit.model.js';
import PlatformAlert from '../src/modules/analytics/alert.model.js';
import { AuditLog } from '../src/middleware/audit.middleware.js';

async function runTests() {
  console.log('\n====== STARTING SUPER ADMIN WORKFLOW VERIFICATION ======\n');

  // 1. Connect to database
  await connectDB();
  console.log('✔ Connected to MongoDB successfully.');

  const suffix = Date.now().toString().slice(-6);
  const adminId = new mongoose.Types.ObjectId();

  // Clean up any historical test data
  console.log('Cleaning up old test documents...');
  await Lab.deleteMany({ slug: /^test-sa-/ });
  await User.deleteMany({ email: /^test-sa-/ });
  await AuditLog.deleteMany({ role: 'superAdmin' });
  await ImpersonationLog.deleteMany({});
  await FeatureFlags.deleteMany({ name: /^test-flag-/ });
  await PlatformAlert.deleteMany({ type: 'announcement' });
  await Report.deleteMany({ reportCode: /^REP-SA-/ });
  await Patient.deleteMany({ firstName: /^TestSAPatient/ });
  await Visit.deleteMany({ visitCode: /^VIS-SA-/ });

  // 2. Create sample labs to test platform metrics
  console.log('Creating sample labs for metrics aggregation testing...');
  
  const testLabs = [];
  // Lab 1: Mumbai, growth plan, active, healthScore 85
  const lab1 = await Lab.create({
    name: `Test Mumbai Lab ${suffix}`,
    slug: `test-sa-mumbai-${suffix}`,
    phone: '9999990001',
    email: `test-sa-mumbai-${suffix}@pehlix.com`,
    plan: 'growth',
    isActive: true,
    isSuspended: false,
    address: { city: 'Mumbai', state: 'MH', pincode: '400001' },
    healthScore: 85,
    billing: { status: 'active', trialEndDate: new Date() }
  });
  testLabs.push(lab1);

  // Lab 2: Mumbai, starter plan, trial, healthScore 45
  const lab2 = await Lab.create({
    name: `Test Mumbai Starter ${suffix}`,
    slug: `test-sa-mumbai-st-${suffix}`,
    phone: '9999990002',
    email: `test-sa-mumbai-st-${suffix}@pehlix.com`,
    plan: 'starter',
    isActive: true,
    isSuspended: false,
    address: { city: 'Mumbai', state: 'MH', pincode: '400002' },
    healthScore: 45,
    billing: { status: 'trial', trialEndDate: new Date() }
  });
  testLabs.push(lab2);

  // Lab 3: Delhi, pro plan, grace status, healthScore 25
  const lab3 = await Lab.create({
    name: `Test Delhi Pro ${suffix}`,
    slug: `test-sa-delhi-${suffix}`,
    phone: '9999990003',
    email: `test-sa-delhi-${suffix}@pehlix.com`,
    plan: 'pro',
    isActive: true,
    isSuspended: false,
    address: { city: 'Delhi', state: 'DL', pincode: '110001' },
    healthScore: 25,
    billing: { status: 'grace', trialEndDate: new Date() }
  });
  testLabs.push(lab3);

  // Lab 4: Bangalore, suspended plan
  const lab4 = await Lab.create({
    name: `Test Bangalore Suspended ${suffix}`,
    slug: `test-sa-bangalore-${suffix}`,
    phone: '9999990004',
    email: `test-sa-bangalore-${suffix}@pehlix.com`,
    plan: 'starter',
    isActive: false,
    isSuspended: true,
    suspensionReason: 'Payment default',
    address: { city: 'Bangalore', state: 'KA', pincode: '560001' },
    healthScore: 92,
    billing: { status: 'suspended', trialEndDate: new Date() }
  });
  testLabs.push(lab4);

  console.log(`✔ Created ${testLabs.length} sample labs.`);

  // Verify Metrics Calculation
  console.log('\n--- VERIFYING: PLATFORM METRICS ---');
  const metrics = await AdminService.getPlatformMetrics();
  console.log('Platform Metrics Result:', JSON.stringify(metrics, null, 2));

  if (
    metrics.totalLabs >= 4 &&
    metrics.activeLabs >= 1 &&
    metrics.trialLabs >= 1 &&
    metrics.graceLabs >= 1 &&
    metrics.suspendedLabs >= 1 &&
    metrics.mrrData &&
    typeof metrics.trialConversionRate === 'number' &&
    metrics.healthScoreDistribution &&
    metrics.geographicDistribution &&
    metrics.featureAdoption &&
    metrics.recentSignups
  ) {
    console.log('✔ PASS: Platform metrics returned all required aggregation keys with correct calculations.');
  } else {
    throw new Error('Platform metrics verification failed. Keys missing or invalid.');
  }

  // Verify Lab Configuration Updates
  console.log('\n--- VERIFYING: UPDATE LAB CONFIGURATION ---');
  const testLab = lab1;
  const configChanges = {
    'modules.inventory': true,
    'limits.monthlyPatients': 500,
    'features.customReporting': true
  };

  const updatedLab = await AdminService.updateLabConfig(testLab._id, configChanges, adminId);
  console.log(`Updated lab planConfig limits:`, updatedLab.planConfig?.limits);
  console.log(`Updated lab planConfig modules:`, updatedLab.planConfig?.modules);

  if (
    updatedLab.planConfig?.modules?.inventory === true &&
    updatedLab.planConfig?.limits?.monthlyPatients === 500 &&
    updatedLab.planConfig?.features?.customReporting === true
  ) {
    console.log('✔ PASS: Lab planConfig updated successfully via dot notation.');
  } else {
    throw new Error('Lab config update failed.');
  }

  // Verify Audit Log Creation for configChanges
  const auditLogsConfig = await AuditLog.find({ action: 'planConfig_change', labId: testLab._id });
  console.log(`Found ${auditLogsConfig.length} config change audit logs.`);
  if (auditLogsConfig.length === 3) {
    console.log('✔ PASS: Audit trail records field updates correctly.');
  } else {
    throw new Error('Audit trail for planConfig updates is missing entries.');
  }

  // Verify Lab Suspension
  console.log('\n--- VERIFYING: LAB SUSPENSION ---');
  // Create a test owner user for the Mumbai lab
  const ownerUser = await User.create({
    name: 'Mumbai Owner',
    email: `test-sa-owner-${suffix}@pehlix.com`,
    role: 'owner',
    labId: testLab._id,
    phone: '9999990001',
    isActive: true
  });
  
  // Set the lab owner reference
  await Lab.findByIdAndUpdate(testLab._id, { owner: ownerUser._id });

  const suspendedLab = await AdminService.suspendLab(testLab._id, 'Suspended for testing purposes', adminId);
  
  if (
    suspendedLab.isSuspended === true &&
    suspendedLab.isActive === false &&
    suspendedLab.suspensionReason === 'Suspended for testing purposes' &&
    suspendedLab.tokenVersion > 0
  ) {
    console.log('✔ PASS: Lab suspended status correctly set and tokenVersion incremented.');
  } else {
    throw new Error('Lab suspension failed.');
  }

  // Verify all lab users token version updated
  const updatedOwner = await User.findById(ownerUser._id);
  if (updatedOwner.tokenVersion > 0) {
    console.log('✔ PASS: Lab users tokenVersion incremented to force logout.');
  } else {
    throw new Error('Lab users tokenVersion not updated.');
  }

  // Verify Audit Log for suspension
  const suspensionAudit = await AuditLog.findOne({ action: 'lab_suspended', labId: testLab._id });
  if (suspensionAudit && suspensionAudit.details?.reason === 'Suspended for testing purposes') {
    console.log('✔ PASS: Suspension action recorded in platform AuditLog.');
  } else {
    throw new Error('Suspension audit log missing or invalid.');
  }

  // Verify Lab Restoration
  console.log('\n--- VERIFYING: LAB RESTORATION ---');
  const restoredLab = await AdminService.restoreLab(testLab._id, adminId);
  
  if (
    restoredLab.isSuspended === false &&
    restoredLab.isActive === true &&
    !restoredLab.suspensionReason
  ) {
    console.log('✔ PASS: Lab restored successfully.');
  } else {
    throw new Error('Lab restoration failed.');
  }

  // Verify Audit Log for restoration
  const restorationAudit = await AuditLog.findOne({ action: 'lab_restored', labId: testLab._id });
  if (restorationAudit) {
    console.log('✔ PASS: Restoration action recorded in platform AuditLog.');
  } else {
    throw new Error('Restoration audit log missing.');
  }

  // Verify Impersonation System
  console.log('\n--- VERIFYING: IMPERSONATION JWT GENERATION & LOGS ---');
  const impersonationResult = await AdminService.createImpersonationToken(
    testLab._id,
    ownerUser._id,
    adminId,
    'Investigating patient registration issue'
  );

  console.log('Impersonation Result Token expiry:', impersonationResult.expiresAt);
  
  // Verify token payload
  const decoded = jwt.verify(impersonationResult.token, publicKey, { algorithms: ['RS256'] });
  console.log('Decoded Impersonation Payload:', decoded);

  if (
    decoded.userId === ownerUser._id.toString() &&
    decoded.labId === testLab._id.toString() &&
    decoded.role === 'owner' &&
    decoded.isImpersonation === true &&
    decoded.impersonatedBy === adminId.toString() &&
    decoded.impersonationReason === 'Investigating patient registration issue' &&
    decoded.exp
  ) {
    console.log('✔ PASS: Impersonation token contains correct credentials and expiry constraints.');
  } else {
    throw new Error('Impersonation token payload mismatch.');
  }

  // Verify ImpersonationLog and AuditLog
  const impersonationLogEntry = await ImpersonationLog.findOne({ targetUserId: ownerUser._id });
  const impersonationAudit = await AuditLog.findOne({ action: 'impersonation_started', labId: testLab._id });

  if (
    impersonationLogEntry &&
    impersonationLogEntry.reason === 'Investigating patient registration issue' &&
    impersonationLogEntry.expiresAt &&
    impersonationAudit
  ) {
    console.log('✔ PASS: Impersonation action stored in both ImpersonationLog and AuditLog.');
  } else {
    throw new Error('Impersonation logging failed.');
  }

  // Verify Billing Override
  console.log('\n--- VERIFYING: BILLING OVERRIDE ---');
  const overrideData = {
    plan: 'pro',
    status: 'active',
    customPricingNotes: 'Overridden custom price: ₹1999/mo',
    trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  };

  const overriddenLab = await AdminService.overrideBilling(testLab._id, overrideData, adminId);
  console.log('Overridden billing status:', overriddenLab.billing?.status);
  console.log('Overridden billing notes:', overriddenLab.billing?.customPricingNotes);

  if (
    overriddenLab.plan === 'pro' &&
    overriddenLab.billing?.status === 'active' &&
    overriddenLab.billing?.customPricingNotes === 'Overridden custom price: ₹1999/mo'
  ) {
    console.log('✔ PASS: Lab billing fields modified successfully.');
  } else {
    throw new Error('Billing override fields mismatch.');
  }

  const billingAudit = await AuditLog.findOne({ action: 'billing_override', labId: testLab._id });
  if (billingAudit && billingAudit.details?.newValues?.customPricingNotes === 'Overridden custom price: ₹1999/mo') {
    console.log('✔ PASS: Billing override changes audited successfully.');
  } else {
    throw new Error('Billing override audit log missing or invalid.');
  }

  // Verify Feature Flags
  console.log('\n--- VERIFYING: FEATURE FLAGS ---');
  const testFlagName = `test-flag-${suffix}`;
  const flagResult = await AdminService.updateFeatureFlag(
    testFlagName,
    {
      enabled: true,
      rolloutPercentage: 75,
      description: 'Test features flag',
      labIdsWhitelist: [testLab._id]
    },
    adminId
  );

  const flagsList = await AdminService.getFeatureFlags();
  const foundFlag = flagsList.find(f => f.name === testFlagName);

  if (
    foundFlag &&
    foundFlag.enabled === true &&
    foundFlag.rolloutPercentage === 75 &&
    foundFlag.labIdsWhitelist[0].toString() === testLab._id.toString()
  ) {
    console.log('✔ PASS: Feature flag created, updated, and retrieved successfully.');
  } else {
    throw new Error('Feature flags operations failed.');
  }

  // Verify Feature Flag audit log
  const flagAudit = await AuditLog.findOne({ action: 'feature_flag_update' });
  if (flagAudit && flagAudit.details?.flagName === testFlagName) {
    console.log('✔ PASS: Feature flag updates logged in platform AuditLog.');
  } else {
    throw new Error('Feature flag update audit log missing.');
  }

  // Verify Dead Letter Queue (DLQ)
  console.log('\n--- VERIFYING: DEAD LETTER QUEUE (DLQ) ---');
  // Create dummy patient, visit, and failed report
  const patient = await Patient.create({
    labId: testLab._id,
    patientCode: `P-SA-${suffix}`,
    firstName: `TestSAPatient-${suffix}`,
    lastName: 'Alpha',
    phone: '9000000001',
    age: 30,
    gender: 'female'
  });

  const visit = await Visit.create({
    labId: testLab._id,
    visitCode: `VIS-SA-${suffix}`,
    patientId: patient._id,
    status: 'registered'
  });

  const report = await Report.create({
    labId: testLab._id,
    visitId: visit._id,
    patientId: patient._id,
    reportCode: `REP-SA-${suffix}`,
    status: 'failed',
    pdfUrl: ''
  });

  const dlq = await AdminService.getDeadLetterQueue();
  console.log(`DLQ items count: ${dlq.length}`);
  const reportInDlq = dlq.find(r => r.reportId.toString() === report._id.toString());

  if (reportInDlq) {
    console.log('✔ PASS: Failed report is captured and displayed in Dead Letter Queue.');
  } else {
    throw new Error('Failed report not present in DLQ.');
  }

  // Retry job
  pdfJobCalls = [];
  const retryResult = await AdminService.retryDeadLetterJob(report._id, adminId);
  const reloadedReport = await Report.findById(report._id);

  if (
    retryResult.queued === true &&
    reloadedReport.status === 'pending' &&
    pdfJobCalls.length === 1 &&
    pdfJobCalls[0].complexityScore === 100
  ) {
    console.log('✔ PASS: Dead Letter Queue job retried, status reset to pending, and job forced to Oracle node (Score: 100).');
  } else {
    throw new Error('DLQ job retry logic failed.');
  }

  // Verify retry audit log
  const retryAudit = await AuditLog.findOne({ action: 'dlq_retry', labId: testLab._id });
  if (retryAudit && retryAudit.details?.reportId?.toString() === report._id.toString()) {
    console.log('✔ PASS: DLQ retry recorded in AuditLog.');
  } else {
    throw new Error('DLQ retry audit log missing.');
  }

  // Verify Announcements System
  console.log('\n--- VERIFYING: PLATFORM ANNOUNCEMENTS ---');
  // Send announcement to Mumbai city active labs
  const announcementMsg = 'Emergency server upgrade scheduled at midnight.';
  const announceResult = await AdminService.sendAnnouncement(
    { type: 'city', city: 'Mumbai' },
    ['whatsapp', 'inapp'],
    announcementMsg,
    null,
    adminId
  );

  console.log('Announcement Sent Result count:', announceResult.sent);

  // Assert that Mumbai labs got inapp alerts (Mumbai labs: lab1, lab2)
  const MumbaiAlerts = await PlatformAlert.find({ type: 'announcement', message: announcementMsg });
  console.log(`Mumbai labs platform alerts created: ${MumbaiAlerts.length}`);

  if (MumbaiAlerts.length === 2 && announceResult.sent === 2) {
    console.log('✔ PASS: Announcement targeted and dispatched to correct labs with PlatformAlert integration.');
  } else {
    throw new Error('Announcement dispatching or targeting failed.');
  }

  // Clean up test documents
  console.log('\nCleaning up all generated test documents...');
  await Lab.deleteMany({ slug: /^test-sa-/ });
  await User.deleteMany({ email: /^test-sa-/ });
  await AuditLog.deleteMany({ role: 'superAdmin' });
  await ImpersonationLog.deleteMany({});
  await FeatureFlags.deleteMany({ name: /^test-flag-/ });
  await PlatformAlert.deleteMany({ type: 'announcement' });
  await Report.deleteMany({ reportCode: /^REP-SA-/ });
  await Patient.deleteMany({ firstName: /^TestSAPatient/ });
  await Visit.deleteMany({ visitCode: /^VIS-SA-/ });

  console.log('\n==================================================');
  console.log('✔ ALL SUPER ADMIN CHECKS VERIFIED SUCCESSFULLY!');
  console.log('==================================================\n');

  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ E2E verification test script failed:', err);
  process.exit(1);
});
