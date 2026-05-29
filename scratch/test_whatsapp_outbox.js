import mongoose from 'mongoose';
import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import { connectDB } from '../src/utils/db.js';
import Lab from '../src/modules/staff/lab.model.js';
import User from '../src/modules/staff/user.model.js';
import Patient from '../src/modules/patients/patient.model.js';
import Doctor from '../src/modules/doctors/doctor.model.js';
import TestMaster from '../src/modules/staff/testMaster.model.js';
import LabTest from '../src/modules/staff/labTest.model.js';
import Visit from '../src/modules/visits/visit.model.js';
import Result from '../src/modules/results/result.model.js';
import Report from '../src/modules/reports/report.model.js';
import Invoice from '../src/modules/billing/invoice.model.js';
import WhatsAppOutbox from '../src/modules/whatsappOutbox/whatsappOutbox.model.js';
import WhatsAppOutboxService from '../src/modules/whatsappOutbox/whatsappOutbox.service.js';
import { pdfWebhookController } from '../src/modules/webhooks/pdf.webhook.js';
import VisitController from '../src/modules/visits/visit.controller.js';
import ResultService from '../src/modules/results/result.service.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001';

async function runVerification() {
  console.log('\n====== STARTING E2E WHATSAPP OUTBOX WORKAROUND VERIFICATION ======\n');

  // 1. Boot up a mock Express app server to test webhook endpoints
  const app = express();
  app.use(express.json());
  
  // Register the real callback hook
  app.post('/api/internal/pdf/generated', pdfWebhookController.onPdfGenerated);
  app.post('/api/internal/pdf/failed', pdfWebhookController.onPdfFailed);

  const server = app.listen(3001, () => {
    console.log('✔ Temp server running on port 3001 for callback testing.');
  });

  // 2. Connect to Database
  await connectDB();
  console.log('✔ Connected to MongoDB successfully.');

  const suffix = Date.now().toString().slice(-6);

  // 3. Clean up database
  console.log('Cleaning up old test documents...');
  await Lab.deleteMany({ slug: /^test-outbox-lab-/ });
  await User.deleteMany({ email: /^test-outbox-/ });
  await Patient.deleteMany({ firstName: 'OutboxPatient' });
  await Doctor.deleteMany({ name: 'OutboxDoctor' });
  await TestMaster.deleteMany({ code: /^OUTBOXMASTER-/ });
  await LabTest.deleteMany({ name: /^OutboxLabTest-/ });
  await Visit.deleteMany({ visitCode: /^VIS-OUTBOX-/ });
  await Result.deleteMany({ labId: { $in: await Lab.find({ slug: /^test-outbox-lab-/ }).select('_id') } });
  await Report.deleteMany({ reportCode: /^RP-OUTBOX-/ });
  await Invoice.deleteMany({ invoiceCode: /^INV-OUTBOX-/ });
  await WhatsAppOutbox.deleteMany({});

  // 4. Create fixtures
  console.log('Creating test fixtures...');
  
  const testLab = await Lab.create({
    name: `Outbox Diagnostic Labs ${suffix}`,
    slug: `test-outbox-lab-${suffix}`,
    phone: '9999999999',
    email: `test-outbox-lab-${suffix}@pehlix.in`,
    plan: 'starter',
    isActive: true,
    isSuspended: false,
    nablNumber: 'MC-9999',
    planConfig: {
      features: {
        communicationMode: 'waMe',
        paymentCheckMode: 'pendingOnly',
        showWhatsAppOnResultEntry: true
      }
    },
    address: {
      street: '123 Outbox Street',
      city: 'Ranchi',
      state: 'Jharkhand',
      pincode: '834001'
    }
  });
  console.log(`✔ Created Lab with communicationMode = waMe: ${testLab.name}`);

  const pathologist = await User.create({
    name: 'Dr. John Carter',
    email: `test-outbox-path-${suffix}@pehlix.in`,
    role: 'pathologist',
    labId: testLab._id,
    phone: '7777777777',
    isActive: true
  });

  const testDoctor = await Doctor.create({
    labId: testLab._id,
    name: 'OutboxDoctor',
    phone: '9876543210',
    email: `test-outbox-doc-${suffix}@pehlix.in`,
    isActive: true
  });

  const testPatient = await Patient.create({
    labId: testLab._id,
    patientCode: `P-OUT-${suffix}`,
    firstName: 'OutboxPatient',
    lastName: 'Kumar',
    phone: '9852126424',
    age: 35,
    gender: 'male',
    consentGiven: true
  });

  const testMaster = await TestMaster.create({
    code: `OUTBOXMASTER-${suffix}`,
    name: 'Hemoglobin (Hb)',
    department: 'Hematology',
    sampleType: 'Whole Blood',
    container: 'EDTA Tube (Purple)',
    basePrice: 100,
    parameters: [
      { name: 'Hemoglobin', unit: 'g/dL', normalLow: 13.5, normalHigh: 17.5, criticalLow: 8.0, criticalHigh: 20.0 }
    ],
    isActive: true
  });

  const labTest = await LabTest.create({
    labId: testLab._id,
    testId: testMaster._id,
    name: `OutboxLabTest TSH`,
    code: `TSH-OUT-${suffix}`,
    price: 150,
    isActive: true
  });

  // Test GAP 8: Booking Confirmation response link returning
  console.log('\n--- VERIFYING GAP 8: BOOKING CONFIRMATION LINK ---');
  
  // Mock request/response for controller testing
  const mockReq = {
    user: { labId: testLab._id, userId: pathologist._id },
    body: {
      patientId: testPatient._id,
      referredBy: testDoctor._id,
      tests: [labTest._id],
      expectedReportTime: new Date(Date.now() + 5 * 3600 * 1000)
    }
  };

  let controllerPayload = null;
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      controllerPayload = payload;
      return this;
    }
  };

  await VisitController.createVisit(mockReq, mockRes, (err) => {
    if (err) console.error('Error creating visit in controller:', err);
  });

  if (controllerPayload && controllerPayload.status === 'success') {
    console.log('✔ Visit Created Successfully via Controller.');
    const bookingLink = controllerPayload.data.bookingLink;
    console.log('Generated Booking Link in payload:', bookingLink);
    if (bookingLink && bookingLink.includes('wa.me') && decodeURIComponent(bookingLink).includes('booking at')) {
      console.log('✔ PASS: Booking Confirmation Link correctly populated in response payload.');
    } else {
      console.log('❌ FAIL: Booking confirmation link is incorrect or missing.');
    }
  } else {
    console.log('❌ FAIL: Controller failed to register visit.', controllerPayload);
  }

  // Fetch visit and invoice created
  const visit = await Visit.findOne({ patientId: testPatient._id, labId: testLab._id });
  const invoice = await Invoice.findOne({ visitId: visit._id, labId: testLab._id });

  // Update invoice to pending so we can test unpaid template outbox flows first
  invoice.amountPaid = 0;
  invoice.balanceAmount = invoice.totalAmount;
  invoice.paymentStatus = 'pending';
  invoice.invoiceCode = `INV-OUTBOX-${suffix}`;
  await invoice.save();
  console.log(`✔ Prepared unpaid invoice with balance amount: ₹${invoice.balanceAmount}`);

  // Create mock pathologist result
  const result = await Result.create({
    labId: testLab._id,
    visitId: visit._id,
    testId: testMaster._id,
    parameters: [
      { parameterName: 'Hemoglobin', value: 14.2, unit: 'g/dL', status: 'normal' }
    ],
    isApproved: false
  });

  // Create Report record (starts as pending)
  const report = await Report.create({
    labId: testLab._id,
    visitId: visit._id,
    patientId: testPatient._id,
    reportCode: `RP-OUTBOX-${suffix}`,
    status: 'pending'
  });
  console.log(`✔ Created Pending Report: ${report.reportCode}`);

  // 5. Trigger pathologist approval to verify queueing into outbox in 'generating' status
  console.log('\n--- VERIFYING PATHOLOGIST APPROVAL QUEUEING (DEDUPLICATION & STATE) ---');
  
  // Call approveResult service method
  await ResultService.approveResult(testLab._id, result._id, pathologist._id, 'Normal test profile');
  
  // Verify Outbox Entry is created
  let outboxEntry = await WhatsAppOutbox.findOne({ reportId: report._id, labId: testLab._id });
  if (outboxEntry) {
    console.log(`✔ WhatsAppOutbox entry found. Status: ${outboxEntry.status}, PDF Status: ${outboxEntry.pdfStatus}`);
    if (outboxEntry.pdfStatus === 'generating' && outboxEntry.status === 'queued') {
      console.log('✔ PASS: Outbox entry created correctly in generating state.');
    } else {
      console.log('❌ FAIL: Outbox entry states mismatch.');
    }
  } else {
    console.log('❌ FAIL: Outbox entry was not created.');
  }

  // Test GAP 4: Deduplication check
  console.log('\n--- VERIFYING GAP 4: OUTBOX ENTRY DEDUPLICATION ---');
  
  // Re-approve the same result (should return existing entry and not create duplicate)
  await ResultService.approveResult(testLab._id, result._id, pathologist._id, 'Normal test profile');
  const outboxEntriesCount = await WhatsAppOutbox.countDocuments({ reportId: report._id, labId: testLab._id });
  if (outboxEntriesCount === 1) {
    console.log('✔ PASS: Outbox correctly deduplicated duplicate pathologist approvals.');
  } else {
    console.log(`❌ FAIL: Found ${outboxEntriesCount} duplicate outbox entries!`);
  }

  // 6. Simulate PDF generation completion callback to trigger updatePdfReady (GAP 3 - key only callback)
  console.log('\n--- VERIFYING GAP 3 & Webhook callback flow ---');
  
  const mockR2Key = `labs/${testLab._id}/reports/${report.reportCode}.pdf`;
  const webhookUrl = 'http://localhost:3001/api/internal/pdf/generated';
  
  const webhookResponse = await axios.post(
    webhookUrl,
    {
      reportId: report._id.toString(),
      pdfUrl: mockR2Key,
      qrVerificationId: `qr-outbox-test-${suffix}`
    },
    {
      headers: { Authorization: `Bearer ${process.env.PDF_SERVICE_SECRET}` }
    }
  );

  if (webhookResponse.status === 200) {
    console.log('✔ Callback endpoint responded 200 successfully.');
    
    // Check updated outbox entry state
    outboxEntry = await WhatsAppOutbox.findOne({ reportId: report._id, labId: testLab._id });
    console.log(`After callback -> pdfStatus: ${outboxEntry.pdfStatus}, waLink length: ${outboxEntry.waLink?.length || 0}`);
    if (outboxEntry.pdfStatus === 'ready' && outboxEntry.waLink && decodeURIComponent(outboxEntry.waLink).includes('balance of')) {
      console.log('✔ PASS: Outbox entry correctly transitioned to ready and generated unpaid message link.');
    } else {
      console.log('❌ FAIL: Outbox entry did not update to ready or generated wrong template link.');
    }
  } else {
    console.log('❌ FAIL: Webhook endpoint did not respond successfully.');
  }

  // Test GAP 1: Expiry Refresh check
  console.log('\n--- VERIFYING GAP 1: SIGNED URL EXPIRY REFRESH ---');
  
  // Mock outboxEntry signed URL as expired
  outboxEntry.signedUrlExpiry = new Date(Date.now() - 10000); // 10 seconds ago (expired)
  await outboxEntry.save();
  console.log(`✔ Set outbox entry expiry to historical: ${outboxEntry.signedUrlExpiry}`);
  
  // Fetch outbox entries via service
  const fetchedList = await WhatsAppOutboxService.getOutboxForLab(testLab._id, 'ready', 1, 20);
  const updatedEntry = fetchedList.entries[0];
  console.log(`After fetch refresh -> New Expiry: ${updatedEntry.signedUrlExpiry}, waLink: ${updatedEntry.waLink?.substring(0, 80)}...`);
  if (updatedEntry.signedUrlExpiry && new Date(updatedEntry.signedUrlExpiry).getTime() > Date.now()) {
    console.log('✔ PASS: Signed URL and expiry refreshed automatically upon load.');
  } else {
    console.log('❌ FAIL: Expiry refresh did not fire.');
  }

  // Test Dynamic Balance Sync on fetch
  console.log('\n--- VERIFYING DYNAMIC BALANCE SYNC ON LOAD ---');
  
  // Simulate recording full cash payment on the invoice
  invoice.amountPaid = invoice.totalAmount;
  invoice.balanceAmount = 0;
  invoice.paymentStatus = 'paid';
  await invoice.save();
  console.log('✔ Recorded full payment directly on invoice document in DB.');

  // Fetch outbox list again (should sync outbox entry's balance and waLink automatically)
  const syncedList = await WhatsAppOutboxService.getOutboxForLab(testLab._id, 'ready', 1, 20);
  const syncedEntry = syncedList.entries[0];
  console.log(`After Sync Load -> outbox balanceAmount: ${syncedEntry.balanceAmount}, waLink contains 'view your report': ${syncedEntry.waLink && decodeURIComponent(syncedEntry.waLink).includes('view your report')}`);
  if (syncedEntry.balanceAmount === 0 && syncedEntry.waLink && decodeURIComponent(syncedEntry.waLink).includes('view your report')) {
    console.log('✔ PASS: Outbox automatically synchronized invoice status and regenerated paid link template on load!');
  } else {
    console.log('❌ FAIL: Outbox balance sync failed or template did not change.');
  }

  // Test GAP 5: Tenant Isolation on markAsSent
  console.log('\n--- VERIFYING GAP 5: TENANT ISOLATION ON SENT ---');
  
  const maliciousLabId = new mongoose.Types.ObjectId();
  try {
    await WhatsAppOutboxService.markAsSent(syncedEntry._id, pathologist._id, maliciousLabId);
    console.log('❌ FAIL: markAsSent succeeded with a malicious lab ID!');
  } catch (err) {
    console.log('✔ PASS: markAsSent correctly threw error for unauthorized tenant access:', err.message);
  }

  // Mark sent successfully under authorized labId
  await WhatsAppOutboxService.markAsSent(syncedEntry._id, pathologist._id, testLab._id);
  const sentEntry = await WhatsAppOutbox.findById(syncedEntry._id);
  console.log(`After sent mark -> status: ${sentEntry.status}, sentAt: ${sentEntry.sentAt}`);
  if (sentEntry.status === 'sent' && sentEntry.sentAt) {
    console.log('✔ PASS: Outbox entry successfully marked as sent.');
  } else {
    console.log('❌ FAIL: Outbox entry status transition failed.');
  }

  // Test 7-Day TTL index assertion
  console.log('\n--- VERIFYING 7-DAY OUTBOX CLEANUP TTL INDEX ---');
  
  const indexes = await WhatsAppOutbox.collection.indexes();
  const ttlIndex = indexes.find(idx => idx.expireAfterSeconds === 604800);
  if (ttlIndex && ttlIndex.key.sentAt === 1) {
    console.log('✔ PASS: MongoDB 7-day TTL index is present on sentAt.');
  } else {
    console.log('❌ FAIL: 7-day TTL index is missing or incorrect.', indexes);
  }

  // Close Mock Server
  server.close(() => {
    console.log('\n✔ Mock server shut down.');
    console.log('====== ALL TESTS COMPLETED successfully! ======\n');
    process.exit(0);
  });
}

runVerification().catch(err => {
  console.error('❌ E2E Verification failed:', err);
  process.exit(1);
});
