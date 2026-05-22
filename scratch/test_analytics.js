import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import { connectDB } from '../src/utils/db.js';
import Lab from '../src/modules/staff/lab.model.js';
import User from '../src/modules/staff/user.model.js';
import Patient from '../src/modules/patients/patient.model.js';
import Visit from '../src/modules/visits/visit.model.js';
import Invoice from '../src/modules/billing/invoice.model.js';
import Notification from '../src/modules/notifications/notification.model.js';
import Doctor from '../src/modules/doctors/doctor.model.js';
import InventoryItem from '../src/modules/inventory/inventoryItem.model.js';
import InventoryLog from '../src/modules/inventory/inventoryLog.model.js';
import HomeCollection from '../src/modules/homeCollections/homeCollection.model.js';
import PlatformAlert from '../src/modules/analytics/alert.model.js';
import AnalyticsService from '../src/modules/analytics/analytics.service.js';
import QStashService from '../src/utils/qstash.js';
import WhatsAppService from '../src/utils/whatsapp.js';
import Result from '../src/modules/results/result.model.js';
import Report from '../src/modules/reports/report.model.js';
import Sample from '../src/modules/samples/sample.model.js';
import { AuditLog } from '../src/middleware/audit.middleware.js';
import app from '../src/app.js';

dotenv.config();

// Ensure local testing port and secret are isolated
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:5005';
process.env.PORT = '5005';
process.env.CRON_SECRET = 'test_cron_secret_key_123';

// Globals to verify mock invocations
let whatsappSentCount = 0;
let whatsappSentDetails = [];
let qstashEnqueuedCount = 0;
let qstashEnqueuedDetails = [];

// Mock QStash Service
QStashService.enqueueNotification = async (templateName, variables, phone) => {
  qstashEnqueuedCount++;
  qstashEnqueuedDetails.push({ templateName, variables, phone });
  console.log(`[Mock QStash] Enqueued notification: ${templateName} to ${phone}`);
  return 'mock-qstash-id';
};

QStashService.enqueue = async (endpoint, payload, delaySeconds = 0) => {
  console.log(`[Mock QStash] Enqueued job: ${endpoint}`);
  return 'mock-qstash-job-id';
};

// Mock WhatsAppService
WhatsAppService.send = async (phone, templateName, variables = {}) => {
  whatsappSentCount++;
  whatsappSentDetails.push({ phone, templateName, variables });
  console.log(`[Mock WhatsApp] Sent template message "${templateName}" to ${phone}`);
  
  // Create a notification record in the DB to mimic reality and prevent double reminders
  const labId = variables.labId || new mongoose.Types.ObjectId();
  await Notification.create({
    labId,
    recipientPhone: phone,
    recipientType: 'patient',
    channel: 'whatsapp',
    templateName,
    variables,
    status: 'sent',
    sentAt: new Date()
  });

  return { success: true, messageId: 'mock-whatsapp-id' };
};

WhatsAppService.sendDirectText = async (phone, text, labId) => {
  whatsappSentCount++;
  whatsappSentDetails.push({ phone, text, labId });
  console.log(`[Mock WhatsApp] Sent direct message: "${text}" to ${phone}`);
  return { success: true, messageId: 'mock-whatsapp-direct-id' };
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('\n====== STARTING E2E ANALYTICS AND CRON VERIFICATION ======\n');

  // Connect to DB
  await connectDB();
  console.log('✔ Connected to MongoDB.');

  // Start E2E Express Server on port 5005
  const server = app.listen(5005, () => {
    console.log('✔ Test Express server listening on port 5005');
  });

  const suffix = Date.now().toString().slice(-6);

  // Database Clean Up
  console.log('Cleaning up old test documents...');
  await Lab.deleteMany({ slug: /^test-analytics-lab-/ });
  await User.deleteMany({ email: /^test-analytics-user-/ });
  await Patient.deleteMany({ firstName: /^TestAnalyticsPatient/ });
  await Doctor.deleteMany({ name: /^TestAnalyticsDoctor/ });
  await Visit.deleteMany({ visitCode: /^VIS-ANALYTICS-/ });
  await Invoice.deleteMany({ invoiceCode: /^INV-ANALYTICS-/ });
  await Notification.deleteMany({ templateName: /^payment_reminder_d/ });
  await Notification.deleteMany({ templateName: 'owner_daily_summary' });
  await Notification.deleteMany({ templateName: 'direct_text_message' });
  await AuditLog.deleteMany({});
  await InventoryItem.deleteMany({ name: /^TestItem/ });
  await InventoryLog.deleteMany({});
  await HomeCollection.deleteMany({});
  await PlatformAlert.deleteMany({});

  // 1. Create a Test Lab and Owner
  console.log('\n--- SETUP: Creating Lab and Owner user ---');
  const lab = await Lab.create({
    name: `Test Analytics Laboratory ${suffix}`,
    slug: `test-analytics-lab-${suffix}`,
    phone: '9999999999',
    email: `test-analytics-lab-${suffix}@pehlix.in`,
    plan: 'starter',
    isActive: true,
    isSuspended: false,
    planConfig: {
      limits: {
        monthlyPatients: 10
      }
    },
    billing: {
      status: 'active'
    }
  });
  console.log(`✔ Lab created: ${lab.name}`);

  const owner = await User.create({
    name: `Test Owner ${suffix}`,
    email: `owner-${suffix}@pehlix.in`,
    password: 'Password123!',
    role: 'owner',
    phone: '9888888888',
    labId: lab._id
  });
  lab.owner = owner._id;
  await lab.save();
  console.log(`✔ Owner User created: ${owner.name} with phone ${owner.phone}`);

  // Create a doctor referred link
  const doctor = await Doctor.create({
    labId: lab._id,
    name: `TestAnalyticsDoctor ${suffix}`,
    phone: '9000000010',
    email: `doctor-${suffix}@pehlix.in`,
    qualification: 'MD',
    commissionType: 'percentage',
    commissionValue: 15,
    portalAccess: true
  });
  console.log(`✔ Doctor created: ${doctor.name}`);

  // 2. Seed Test Data (5 patients, 5 visits, 3 paid invoices, 2 pending invoices)
  console.log('\n--- SETUP: Seeding Test Data (5 patients, 5 visits, 3 paid, 2 pending) ---');
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);
  const oneDayAgo = new Date(today.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago (1 day old)

  // Seed 5 Patients
  const patients = [];
  for (let i = 1; i <= 5; i++) {
    const isToday = i <= 3;
    const patDate = isToday ? today : yesterday;
    const patient = await Patient.create({
      labId: lab._id,
      patientCode: `PAT-ANALYTICS-${suffix}-${i}`,
      firstName: `TestAnalyticsPatient${i}`,
      lastName: `Surname`,
      phone: `911111111${i}`,
      age: 30 + i,
      ageUnit: 'years',
      gender: 'male',
      consentGiven: true,
      createdAt: patDate
    });
    patients.push(patient);
  }
  console.log(`✔ Seeded 5 Patient records.`);

  // Seed 5 Visits
  const visits = [];
  // Visit 1: Today, referred by Doctor, paid
  const visit1 = await Visit.create({
    labId: lab._id,
    visitCode: `VIS-ANALYTICS-${suffix}-1`,
    patientId: patients[0]._id,
    referredBy: doctor._id,
    status: 'registered',
    createdAt: today
  });
  visits.push(visit1);

  // Visit 2: Today, referred by Doctor, paid
  const visit2 = await Visit.create({
    labId: lab._id,
    visitCode: `VIS-ANALYTICS-${suffix}-2`,
    patientId: patients[1]._id,
    referredBy: doctor._id,
    status: 'registered',
    createdAt: today
  });
  visits.push(visit2);

  // Visit 3: Today, pending payment
  const visit3 = await Visit.create({
    labId: lab._id,
    visitCode: `VIS-ANALYTICS-${suffix}-3`,
    patientId: patients[2]._id,
    status: 'registered',
    createdAt: today
  });
  visits.push(visit3);

  // Visit 4: Yesterday, pending payment (25 hours ago, exactly 1 day pending)
  const visit4 = await Visit.create({
    labId: lab._id,
    visitCode: `VIS-ANALYTICS-${suffix}-4`,
    patientId: patients[3]._id,
    status: 'registered',
    createdAt: oneDayAgo
  });
  visits.push(visit4);

  // Visit 5: 7 Days ago, paid (last week comparison)
  const visit5 = await Visit.create({
    labId: lab._id,
    visitCode: `VIS-ANALYTICS-${suffix}-5`,
    patientId: patients[4]._id,
    status: 'registered',
    createdAt: lastWeek
  });
  visits.push(visit5);
  console.log(`✔ Seeded 5 Visit records.`);

  // Seed Invoices: 3 paid, 2 pending
  // Invoice 1: Visit 1, Today, paid, 1000 INR
  const inv1 = await Invoice.create({
    labId: lab._id,
    visitId: visit1._id,
    patientId: patients[0]._id,
    invoiceCode: `INV-ANALYTICS-${suffix}-1`,
    subtotal: 1000,
    totalAmount: 1000,
    amountPaid: 1000,
    balanceAmount: 0,
    paymentStatus: 'paid',
    createdAt: today,
    lineItems: [
      { testId: new mongoose.Types.ObjectId(), testName: 'CBC Test', price: 1000, discount: 0, finalPrice: 1000 }
    ]
  });

  // Invoice 2: Visit 2, Today, paid, 500 INR
  const inv2 = await Invoice.create({
    labId: lab._id,
    visitId: visit2._id,
    patientId: patients[1]._id,
    invoiceCode: `INV-ANALYTICS-${suffix}-2`,
    subtotal: 500,
    totalAmount: 500,
    amountPaid: 500,
    balanceAmount: 0,
    paymentStatus: 'paid',
    createdAt: today,
    lineItems: [
      { testId: new mongoose.Types.ObjectId(), testName: 'Thyroid Profile', price: 500, discount: 0, finalPrice: 500 }
    ]
  });

  // Invoice 3: Visit 3, Today, pending, 800 INR
  const inv3 = await Invoice.create({
    labId: lab._id,
    visitId: visit3._id,
    patientId: patients[2]._id,
    invoiceCode: `INV-ANALYTICS-${suffix}-3`,
    subtotal: 800,
    totalAmount: 800,
    amountPaid: 0,
    balanceAmount: 800,
    paymentStatus: 'pending',
    createdAt: today,
    lineItems: [
      { testId: new mongoose.Types.ObjectId(), testName: 'Lipid Profile', price: 800, discount: 0, finalPrice: 800 }
    ]
  });

  // Invoice 4: Visit 4, Yesterday (25 hours ago), pending, 200 INR
  const inv4 = await Invoice.create({
    labId: lab._id,
    visitId: visit4._id,
    patientId: patients[3]._id,
    invoiceCode: `INV-ANALYTICS-${suffix}-4`,
    subtotal: 200,
    totalAmount: 200,
    amountPaid: 0,
    balanceAmount: 200,
    paymentStatus: 'pending',
    createdAt: oneDayAgo,
    razorpayPaymentLinkUrl: 'https://rzp.io/i/testpaylink',
    lineItems: [
      { testId: new mongoose.Types.ObjectId(), testName: 'Glucose Fasting', price: 200, discount: 0, finalPrice: 200 }
    ]
  });

  // Invoice 5: Visit 5, 7 Days ago, paid, 1000 INR
  const inv5 = await Invoice.create({
    labId: lab._id,
    visitId: visit5._id,
    patientId: patients[4]._id,
    invoiceCode: `INV-ANALYTICS-${suffix}-5`,
    subtotal: 1000,
    totalAmount: 1000,
    amountPaid: 1000,
    balanceAmount: 0,
    paymentStatus: 'paid',
    createdAt: lastWeek,
    lineItems: [
      { testId: new mongoose.Types.ObjectId(), testName: 'CBC Test', price: 1000, discount: 0, finalPrice: 1000 }
    ]
  });
  console.log(`✔ Seeded 5 Invoice records.`);

  // 3. E2E Audit Logs for Health Score (Need logs for today and 4 other days in last 7 days + 2 distinct users)
  console.log('\n--- SETUP: Seeding AuditLogs for Health Score verification ---');
  const staff1 = new mongoose.Types.ObjectId();
  const staff2 = new mongoose.Types.ObjectId();
  
  const datesToSeed = [
    new Date(), // today
    new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000)  // 4 days ago (total 5 distinct days)
  ];

  for (let idx = 0; idx < datesToSeed.length; idx++) {
    const userSeed = idx % 2 === 0 ? staff1 : staff2;
    await AuditLog.create({
      labId: lab._id,
      userId: userSeed,
      role: 'staff',
      action: 'GET /api/patients',
      statusCode: 200,
      timestamp: datesToSeed[idx]
    });
  }
  console.log(`✔ Seeded 5 AuditLog entries across 5 distinct days for 2 distinct users.`);

  // 4. Seed other activity logs to maximize health score points
  console.log('\n--- SETUP: Seeding notifications, inventory, home collections ---');
  // WhatsApp Notification Status Delivered
  await Notification.create({
    labId: lab._id,
    recipientPhone: '9999999999',
    recipientType: 'patient',
    channel: 'whatsapp',
    templateName: 'booking_confirmation',
    status: 'delivered',
    createdAt: new Date()
  });

  // Inventory Item and Log
  const item = await InventoryItem.create({
    labId: lab._id,
    name: 'TestItem CBC Reagent',
    category: 'reagent',
    unit: 'vials',
    currentStock: 3,
    minimumStock: 5, // low stock alert!
    isDeleted: false
  });
  await InventoryLog.create({
    labId: lab._id,
    itemId: item._id,
    type: 'adjustment',
    quantityChange: -2,
    quantityBefore: 5,
    quantityAfter: 3,
    performedBy: owner._id,
    notes: 'Stock check'
  });

  // Home Collection
  await HomeCollection.create({
    labId: lab._id,
    visitId: visits[0]._id,
    patientId: patients[0]._id,
    assignedPhlebotomist: owner._id,
    timeSlot: '9-11am',
    address: { street: '123 Test Street' },
    status: 'scheduled',
    scheduledDate: new Date()
  });
  console.log(`✔ Seeded WhatsApp notification, Inventory low stock item + log, and Home collection.`);

  // 5. Test getDashboardSummary
  console.log('\n--- CHECK 1: Verifying getDashboardSummary ---');
  const summary = await AnalyticsService.getDashboardSummary(lab._id);
  console.log('Dashboard summary results:', JSON.stringify(summary, null, 2));

  // Assertions
  if (!summary.todayRevenue || typeof summary.todayRevenue.amount !== 'number') throw new Error('❌ FAIL: todayRevenue incorrect format');
  if (summary.todayRevenue.amount !== 1500) throw new Error(`❌ FAIL: Expected todayRevenue amount 1500, got ${summary.todayRevenue.amount}`);
  // Today = 1500, Last Week = 1000, vsLastWeek should be 50%
  if (summary.todayRevenue.vsLastWeek !== 50) throw new Error(`❌ FAIL: Expected vsLastWeek to be 50, got ${summary.todayRevenue.vsLastWeek}`);
  
  if (summary.todayPatients.count !== 3) throw new Error(`❌ FAIL: Expected todayPatients count 3, got ${summary.todayPatients.count}`);
  if (summary.pendingPayments.totalPending !== 1000) throw new Error(`❌ FAIL: Expected totalPending 1000, got ${summary.pendingPayments.totalPending}`);
  if (summary.pendingPayments.invoiceCount !== 2) throw new Error(`❌ FAIL: Expected pending invoiceCount 2, got ${summary.pendingPayments.invoiceCount}`);
  if (summary.lowStockAlerts.count !== 1) throw new Error(`❌ FAIL: Expected low stock alerts 1, got ${summary.lowStockAlerts.count}`);
  
  console.log('✔ PASS: getDashboardSummary aggregations and comparison calculations are 100% correct.');

  // 6. Test getRevenueAnalytics
  console.log('\n--- CHECK 2: Verifying getRevenueAnalytics ---');
  const revAnalytics = await AnalyticsService.getRevenueAnalytics(lab._id, '7days');
  console.log('Revenue analytics results:', JSON.stringify(revAnalytics, null, 2));

  if (!Array.isArray(revAnalytics.revenueData)) throw new Error('❌ FAIL: revenueData should be an array');
  if (revAnalytics.totalRevenue !== 2500) throw new Error(`❌ FAIL: Expected totalRevenue 2500, got ${revAnalytics.totalRevenue}`);
  if (typeof revAnalytics.averagePerDay !== 'number') throw new Error('❌ FAIL: averagePerDay should be a number');
  if (!revAnalytics.bestDay) throw new Error('❌ FAIL: bestDay should be present');
  console.log('✔ PASS: getRevenueAnalytics returns correct data format and metrics.');

  // 7. Test calculateHealthScore
  console.log('\n--- CHECK 3: Verifying calculateHealthScore ---');
  const healthData = await AnalyticsService.calculateHealthScore(lab._id);
  console.log('Health score calculation results:', JSON.stringify(healthData, null, 2));

  // Assertions
  if (typeof healthData.score !== 'number' || healthData.score < 0 || healthData.score > 100) throw new Error('❌ FAIL: Health score must be a number between 0 and 100');
  const expectedBreakdownKeys = [
    'loginFrequency', 'patientVolume', 'whatsappConnected', 'doctorPortalActive',
    'inventoryActive', 'homeCollectionActive', 'staffUsage', 'paymentHealth', 'supportHealth'
  ];
  for (const key of expectedBreakdownKeys) {
    if (!healthData.breakdown[key] || typeof healthData.breakdown[key].earned !== 'number') {
      throw new Error(`❌ FAIL: Breakdown missing or invalid category "${key}"`);
    }
  }
  if (healthData.churnRisk !== false) throw new Error('❌ FAIL: Expected churnRisk to be false');
  console.log('✔ PASS: calculateHealthScore works properly with the exact mathematical formulation.');

  // Test updating the health score
  console.log('\n--- CHECK 4: Verifying updateLabHealthScore low/urgent alerts ---');
  // First test with score >= 50
  await AnalyticsService.updateLabHealthScore(lab._id, 85);
  let updatedLab = await Lab.findById(lab._id);
  if (updatedLab.healthScore !== 85 || !updatedLab.healthScoreUpdatedAt) throw new Error('❌ FAIL: Lab health score not updated');
  let alertCount = await PlatformAlert.countDocuments({ labId: lab._id });
  if (alertCount !== 0) throw new Error('❌ FAIL: Low health alert should not be created for score 85');

  // Then test with score < 50
  await AnalyticsService.updateLabHealthScore(lab._id, 45);
  alertCount = await PlatformAlert.countDocuments({ labId: lab._id, type: 'health_score_low' });
  if (alertCount !== 1) throw new Error('❌ FAIL: Low health alert was not created for score 45');
  console.log('✔ PASS: PlatformAlert low health alert successfully generated.');

  // 8. Test getDailyWhatsAppSummary
  console.log('\n--- CHECK 5: Verifying getDailyWhatsAppSummary variables ---');
  const dailySummary = await AnalyticsService.getDailyWhatsAppSummary(lab._id);
  console.log('Daily summary variables:', JSON.stringify(dailySummary, null, 2));

  const expectedSummaryVariables = [
    'ownerName', 'labName', 'date', 'patientCount', 'revenue', 'pendingAmount', 'reportCount', 'alerts'
  ];
  for (const varName of expectedSummaryVariables) {
    if (dailySummary[varName] === undefined) throw new Error(`❌ FAIL: Daily summary missing variable "${varName}"`);
  }
  if (!dailySummary.revenue.startsWith('₹')) throw new Error(`❌ FAIL: Revenue must start with ₹, got ${dailySummary.revenue}`);
  if (!dailySummary.pendingAmount.startsWith('₹')) throw new Error(`❌ FAIL: Pending amount must start with ₹, got ${dailySummary.pendingAmount}`);
  if (dailySummary.alerts !== '1 low stock') throw new Error(`❌ FAIL: Expected alerts '1 low stock', got "${dailySummary.alerts}"`);
  console.log('✔ PASS: getDailyWhatsAppSummary template variables format matches Meta API requirements perfectly.');

  // 9. Test getPendingPaymentsBreakdown
  console.log('\n--- CHECK 6: Verifying getPendingPaymentsBreakdown ---');
  const paymentsBreakdown = await AnalyticsService.getPendingPaymentsBreakdown(lab._id);
  console.log('Pending payments breakdown:', JSON.stringify(paymentsBreakdown, null, 2));

  const expectedBuckets = ['0-1 days', '2-3 days', '4-7 days', '8-30 days', '30+ days'];
  for (const bucket of expectedBuckets) {
    if (!paymentsBreakdown.buckets[bucket]) throw new Error(`❌ FAIL: Missing aging bucket "${bucket}"`);
  }
  
  // Verify that oldestPending includes the 1-day old invoice (inv4)
  const oldestPendingList = paymentsBreakdown.oldestPending;
  if (!oldestPendingList || oldestPendingList.length === 0) throw new Error('❌ FAIL: oldestPending is empty');
  const foundInvoice = oldestPendingList.find(i => i.invoiceId.toString() === inv4._id.toString());
  if (!foundInvoice) throw new Error('❌ FAIL: Could not find E2E invoice in oldest pending list');
  if (foundInvoice.daysPending !== 1) throw new Error(`❌ FAIL: Expected daysPending 1, got ${foundInvoice.daysPending}`);
  if (foundInvoice.phone !== '9111111114') throw new Error(`❌ FAIL: Expected patient phone '9111111114', got ${foundInvoice.phone}`);
  console.log('✔ PASS: getPendingPaymentsBreakdown returns correct bucket distributions and oldest invoice metadata.');

  // 10. E2E trigger payment-reminders cron endpoint
  console.log('\n--- CHECK 7: Testing payment reminder cron logic via local HTTP request ---');
  
  // Clear mock trackers
  whatsappSentCount = 0;
  whatsappSentDetails = [];

  const response = await axios.post(
    'http://localhost:5005/api/cron/payment-reminders',
    {},
    {
      headers: {
        Authorization: 'Bearer test_cron_secret_key_123'
      }
    }
  );

  console.log('Cron response:', response.status, response.data);
  if (response.status !== 200 || response.data.status !== 'success') {
    throw new Error('❌ FAIL: Cron webhook did not respond with 200 success');
  }

  // Wait a small amount for the async background cron task to run
  await sleep(3000);

  const reminder = whatsappSentDetails.find(d => d.phone === '9111111114');
  if (!reminder) {
    throw new Error(`❌ FAIL: Expected payment reminder WhatsApp message to '9111111114', but none found.`);
  }
  if (reminder.templateName !== 'payment_reminder_d1') {
    throw new Error(`❌ FAIL: Expected reminder template 'payment_reminder_d1', got '${reminder.templateName}'`);
  }
  if (!reminder.variables.pendingAmount.startsWith('₹')) {
    throw new Error(`❌ FAIL: Expected variables.pendingAmount to be formatted with ₹`);
  }
  console.log('✔ PASS: Payment reminder d1 correctly selected, formatted, and triggered.');

  // 11. Verify duplicate reminder prevention
  console.log('\n--- CHECK 8: Testing E2E duplicate reminder prevention ---');
  whatsappSentCount = 0;
  whatsappSentDetails = [];

  // Fire E2E endpoint again
  const response2 = await axios.post(
    'http://localhost:5005/api/cron/payment-reminders',
    {},
    {
      headers: {
        Authorization: 'Bearer test_cron_secret_key_123'
      }
    }
  );

  await sleep(3000);

  const duplicateReminder = whatsappSentDetails.find(d => d.phone === '9111111114');
  if (duplicateReminder) {
    throw new Error(`❌ FAIL: Duplicate reminder sent to patient '9111111114'!`);
  }
  console.log('✔ PASS: Duplicate reminders correctly prevented by checking existing notifications.');

  // 12. E2E trigger daily summary cron endpoint
  console.log('\n--- CHECK 9: Testing daily summary cron endpoint ---');
  qstashEnqueuedCount = 0;
  qstashEnqueuedDetails = [];

  const responseSummary = await axios.post(
    'http://localhost:5005/api/cron/daily-summary',
    {},
    {
      headers: {
        Authorization: 'Bearer test_cron_secret_key_123'
      }
    }
  );
  if (responseSummary.status !== 200 || responseSummary.data.status !== 'success') {
    throw new Error('❌ FAIL: Daily summary cron webhook did not respond with 200 success');
  }

  await sleep(3000);

  const summaryEnqueued = qstashEnqueuedDetails.find(d => d.phone === owner.phone);
  if (!summaryEnqueued) {
    throw new Error(`❌ FAIL: Expected E2E daily summary notification enqueued to QStash for owner, but none found.`);
  }
  if (summaryEnqueued.templateName !== 'owner_daily_summary') {
    throw new Error(`❌ FAIL: Expected template 'owner_daily_summary', got '${summaryEnqueued.templateName}'`);
  }
  if (summaryEnqueued.variables.revenue !== '₹1,500') {
    throw new Error(`❌ FAIL: Expected summary revenue '₹1,500', got '${summaryEnqueued.variables.revenue}'`);
  }
  console.log('✔ PASS: Daily summary cron correctly aggregated, formatted with ₹ symbol, and enqueued via QStash.');

  // 13. E2E trigger health score update cron endpoint
  console.log('\n--- CHECK 10: Testing health score update cron endpoint ---');
  const responseHealth = await axios.post(
    'http://localhost:5005/api/cron/health-score-update',
    {},
    {
      headers: {
        Authorization: 'Bearer test_cron_secret_key_123'
      }
    }
  );
  if (responseHealth.status !== 200 || responseHealth.data.status !== 'success') {
    throw new Error('❌ FAIL: Health score cron webhook did not respond with 200 success');
  }
  await sleep(3000);
  console.log('✔ PASS: Health score update cron processed successfully in background.');

  // 14. E2E trigger low stock alerts cron endpoint
  console.log('\n--- CHECK 11: Testing low stock alerts cron endpoint ---');
  whatsappSentCount = 0;
  whatsappSentDetails = [];

  const responseStock = await axios.post(
    'http://localhost:5005/api/cron/low-stock-alerts',
    {},
    {
      headers: {
        Authorization: 'Bearer test_cron_secret_key_123'
      }
    }
  );
  if (responseStock.status !== 200 || responseStock.data.status !== 'success') {
    throw new Error('❌ FAIL: Low stock alerts cron webhook did not respond with 200 success');
  }
  await sleep(3000);

  const stockAlert = whatsappSentDetails.find(d => d.phone === owner.phone);
  if (!stockAlert) {
    throw new Error(`❌ FAIL: Expected stock alert direct message to be sent to owner, but none found.`);
  }
  if (!stockAlert.text.includes('TestItem CBC Reagent') || !stockAlert.text.includes('Stock: 3')) {
    throw new Error(`❌ FAIL: Stock alert message does not contain item name or stock quantity correctly, message: "${stockAlert.text}"`);
  }
  console.log('✔ PASS: Low stock alerts direct text message successfully dispatched to lab owner.');

  // Clean Up Database and close server
  console.log('\nCleaning up E2E E2E documents...');
  await Lab.deleteMany({ slug: /^test-analytics-lab-/ });
  await User.deleteMany({ email: /^test-analytics-user-/ });
  await Patient.deleteMany({ firstName: /^TestAnalyticsPatient/ });
  await Doctor.deleteMany({ name: /^TestAnalyticsDoctor/ });
  await Visit.deleteMany({ visitCode: /^VIS-ANALYTICS-/ });
  await Invoice.deleteMany({ invoiceCode: /^INV-ANALYTICS-/ });
  await Notification.deleteMany({ templateName: /^payment_reminder_d/ });
  await Notification.deleteMany({ templateName: 'owner_daily_summary' });
  await Notification.deleteMany({ templateName: 'direct_text_message' });
  await AuditLog.deleteMany({});
  await InventoryItem.deleteMany({ name: /^TestItem/ });
  await InventoryLog.deleteMany({});
  await HomeCollection.deleteMany({});
  await PlatformAlert.deleteMany({});
  
  server.close();
  mongoose.connection.close();
  console.log('\n====== E2E VERIFICATION COMPLETED SUCCESSFULLY: ALL CHECKS PASS! ======\n');
}

runTests().catch(err => {
  console.error('\n❌ E2E VERIFICATION FAILED WITH ERROR:\n', err);
  process.exit(1);
});
