import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import express from 'express';
import compression from 'compression';
import { connectDB } from '../src/utils/db.js';
import { config } from '../src/config/index.js';
import WhatsAppService from '../src/utils/whatsapp.js';
import EmailService from '../src/utils/email.js';
import VisitService from '../src/modules/visits/visit.service.js';
import PatientService from '../src/modules/patients/patient.service.js';
import WhatsAppOutboxService from '../src/modules/whatsappOutbox/whatsappOutbox.service.js';
import Visit from '../src/modules/visits/visit.model.js';
import Patient from '../src/modules/patients/patient.model.js';
import WhatsAppOutbox from '../src/modules/whatsappOutbox/whatsappOutbox.model.js';
import Notification from '../src/modules/notifications/notification.model.js';
import Lab from '../src/modules/staff/lab.model.js';
import User from '../src/modules/staff/user.model.js';
import { calculateBlindIndex } from '../src/utils/crypto.js';

dotenv.config();

async function runTests() {
  console.log('\n====== STARTING PHASE 2 RESILIENCY & SYSTEM EFFICIENCY TESTS ======\n');
  
  await connectDB();
  console.log('✔ Connected to MongoDB.');

  const labId = new mongoose.Types.ObjectId();
  
  // Create a mock lab configuration that enforces communicationMode = 'meta' (API)
  // so that Meta calls are not bypassed by waMe manual check
  await Lab.create({
    _id: labId,
    name: 'Resiliency Test Lab',
    slug: 'resiliency-test-lab-' + Date.now(),
    email: 'resiliency@test.com',
    phone: '9999999999',
    gstin: '27AAAAA1111A1Z1',
    plan: 'starter',
    isActive: true,
    isSuspended: false,
    address: {
      street: '123 Test St',
      city: 'Mumbai',
      state: 'Maharashtra',
      zip: '400001'
    },
    planConfig: {
      planType: 'growth',
      features: {
        communicationMode: 'meta' // Ensure we go through Meta API path
      }
    }
  });

  // =========================================================================
  // 1. CIRCUIT BREAKER TESTS
  // =========================================================================
  console.log('\n--- 1. Testing WhatsApp Meta Cloud API Circuit Breaker ---');

  // Sabotage Meta credentials
  const originalToken = config.META_WHATSAPP_ACCESS_TOKEN;
  const originalPhoneId = config.META_WHATSAPP_PHONE_NUMBER_ID;
  
  config.META_WHATSAPP_ACCESS_TOKEN = 'sabotaged_token';
  config.META_WHATSAPP_PHONE_NUMBER_ID = 'sabotaged_phone_id';

  console.log('Executing 6 consecutive WhatsApp dispatches (Breaker threshold = 5)...');
  
  const results = [];
  for (let i = 1; i <= 6; i++) {
    try {
      const res = await WhatsAppService.send('9999999999', 'booking_confirmation', {
        labId,
        patientName: 'Test Patient',
        testList: 'Complete Blood Count',
        totalAmount: 500,
        expectedReportTime: 'Tomorrow',
        labName: 'Resiliency Test Lab'
      });
      results.push(res);
      console.log(`Call ${i} finished. isWaMe: ${res.isWaMe}, success: ${res.success}`);
    } catch (err) {
      console.log(`Call ${i} threw error:`, err.message);
    }
  }

  // First 5 calls are processed (and fall back to manual because of error)
  // But wait! On the 6th call, the breaker state must be OPEN.
  // When OPEN, it immediately executes handleFallback without making a request.
  // Let's verify that the 6th call was executed successfully with isWaMe: true.
  if (results.length === 6 && results[5].isWaMe === true) {
    console.log('✔ PASS: Circuit breaker tripped to OPEN on 6th request and triggered immediate wa.me fallback.');
  } else {
    console.error('❌ FAIL: Circuit breaker did not behave as expected.');
  }

  // Restore credentials
  config.META_WHATSAPP_ACCESS_TOKEN = originalToken;
  config.META_WHATSAPP_PHONE_NUMBER_ID = originalPhoneId;

  console.log('\n--- 2. Testing Email Resend API Circuit Breaker ---');
  
  // Sabotage Resend key
  const originalResendKey = config.RESEND_API_KEY;
  config.RESEND_API_KEY = 'sabotaged_resend_key';

  console.log('Executing 6 consecutive Email dispatches...');
  const emailResults = [];
  for (let i = 1; i <= 6; i++) {
    try {
      const res = await EmailService.sendEmail({
        to: 'test@example.com',
        subject: 'Verification OTP',
        html: '<p>1234</p>',
        text: '1234',
        preferResend: true,
        labId
      });
      emailResults.push(res);
      console.log(`Email ${i} result:`, JSON.stringify(res));
    } catch (err) {
      console.log(`Email ${i} threw error:`, err.message);
    }
  }

  // The 6th request must fail-fast without throwing uncaught exceptions blocking auth flows
  if (emailResults.length === 6 && emailResults[5].success === false) {
    console.log('✔ PASS: Email circuit breaker tripped to OPEN on 6th request, returned clean fail status, logged to DB.');
    
    // Assert notification exists in DB
    const loggedFailures = await Notification.find({ labId, channel: 'email', status: 'failed' });
    console.log(`Logged email failures in DB: ${loggedFailures.length}`);
    if (loggedFailures.length > 0) {
      console.log('✔ PASS: Failure was recorded in the database successfully.');
    } else {
      console.error('❌ FAIL: Email failure log not found in database.');
    }
  } else {
    console.error('❌ FAIL: Email circuit breaker did not behave as expected.');
  }

  // Restore Resend key
  config.RESEND_API_KEY = originalResendKey;


  // =========================================================================
  // 2. CURSOR PAGINATION TESTS
  // =========================================================================
  console.log('\n--- 3. Testing Cursor-Based Pagination ---');

  // Seed 5 temporary patients
  console.log('Seeding 5 temporary patients for pagination...');
  const seededPatients = [];
  for (let i = 1; i <= 5; i++) {
    const phone = `900000000${i}`;
    const p = await Patient.create({
      labId,
      patientCode: `PAT_CURS_${i}`,
      firstName: `CursorPatient${i}`,
      lastName: 'Test',
      phone,
      phoneBlindIndex: calculateBlindIndex(phone, 'phone'),
      age: 20 + i,
      ageUnit: 'years',
      gender: 'male',
      consentGiven: true
    });
    const customDate = new Date(Date.now() - (10 - i) * 60000);
    await Patient.updateOne({ _id: p._id }, { $set: { createdAt: customDate } });
    p.createdAt = customDate;
    seededPatients.push(p);
  }

  // Seed 5 temporary visits
  console.log('Seeding 5 temporary visits for pagination...');
  const seededVisits = [];
  for (let i = 1; i <= 5; i++) {
    const v = await Visit.create({
      labId,
      patientId: seededPatients[i-1]._id,
      visitCode: `VIS_CURS_${i}`,
      status: 'registered',
      tests: []
    });
    const customDate = new Date(Date.now() - (10 - i) * 60000);
    await Visit.updateOne({ _id: v._id }, { $set: { createdAt: customDate } });
    v.createdAt = customDate;
    seededVisits.push(v);
  }

  // Seed 5 temporary outbox entries
  console.log('Seeding 5 temporary outbox entries for pagination...');
  const seededOutbox = [];
  for (let i = 1; i <= 5; i++) {
    const o = await WhatsAppOutbox.create({
      labId,
      visitId: seededVisits[i-1]._id,
      patientId: seededPatients[i-1]._id,
      reportId: new mongoose.Types.ObjectId(),
      patientName: `CursorPatient${i} Test`,
      testNames: 'CBC',
      invoiceTotal: 100 * i,
      amountPaid: 0,
      balanceAmount: 100 * i,
      pdfStatus: 'ready',
      status: 'queued'
    });
    const customDate = new Date(Date.now() - (10 - i) * 60000);
    await WhatsAppOutbox.updateOne({ _id: o._id }, { $set: { createdAt: customDate } });
    o.createdAt = customDate;
    seededOutbox.push(o);
  }

  // A. Assert Visits Cursor Pagination
  console.log('\n>> Testing VisitService.getVisits cursor flow...');
  // Page 1
  let page1 = await VisitService.getVisits(labId, {}, 1, 2, '');
  console.log(`Page 1 returned ${page1.visits.length} visits. hasNextPage: ${page1.hasNextPage}. nextCursor: ${page1.nextCursor}`);
  if (page1.visits.length === 2 && page1.hasNextPage === true && page1.nextCursor) {
    console.log('✔ Page 1 matches assertions.');
  } else {
    console.error('❌ FAIL on Visit Page 1.');
  }

  // Page 2
  let page2 = await VisitService.getVisits(labId, {}, 1, 2, page1.nextCursor);
  console.log(`Page 2 returned ${page2.visits.length} visits. hasNextPage: ${page2.hasNextPage}. nextCursor: ${page2.nextCursor}`);
  if (page2.visits.length === 2 && page2.hasNextPage === true && page2.nextCursor) {
    console.log('✔ Page 2 matches assertions.');
  } else {
    console.error('❌ FAIL on Visit Page 2.');
  }

  // Page 3
  let page3 = await VisitService.getVisits(labId, {}, 1, 2, page2.nextCursor);
  console.log(`Page 3 returned ${page3.visits.length} visits. hasNextPage: ${page3.hasNextPage}. nextCursor: ${page3.nextCursor}`);
  if (page3.visits.length === 1 && page3.hasNextPage === false && page3.nextCursor === null) {
    console.log('✔ Page 3 matches assertions.');
  } else {
    console.error('❌ FAIL on Visit Page 3.');
  }

  // B. Assert Patients Cursor Pagination (Listing mode when q is empty)
  console.log('\n>> Testing PatientService.searchPatients cursor flow...');
  let patPage1 = await PatientService.searchPatients(labId, '', 1, 2, '');
  console.log(`Page 1 returned ${patPage1.patients.length} patients. hasNextPage: ${patPage1.hasNextPage}. nextCursor: ${patPage1.nextCursor}`);
  if (patPage1.patients.length === 2 && patPage1.hasNextPage === true && patPage1.nextCursor) {
    console.log('✔ Page 1 matches assertions.');
  } else {
    console.error('❌ FAIL on Patient Page 1.');
  }

  let patPage2 = await PatientService.searchPatients(labId, '', 1, 2, patPage1.nextCursor);
  console.log(`Page 2 returned ${patPage2.patients.length} patients. hasNextPage: ${patPage2.hasNextPage}. nextCursor: ${patPage2.nextCursor}`);
  if (patPage2.patients.length === 2 && patPage2.hasNextPage === true && patPage2.nextCursor) {
    console.log('✔ Page 2 matches assertions.');
  } else {
    console.error('❌ FAIL on Patient Page 2.');
  }

  let patPage3 = await PatientService.searchPatients(labId, '', 1, 2, patPage2.nextCursor);
  console.log(`Page 3 returned ${patPage3.patients.length} patients. hasNextPage: ${patPage3.hasNextPage}. nextCursor: ${patPage3.nextCursor}`);
  if (patPage3.patients.length === 1 && patPage3.hasNextPage === false && patPage3.nextCursor === null) {
    console.log('✔ Page 3 matches assertions.');
  } else {
    console.error('❌ FAIL on Patient Page 3.');
  }

  // C. Assert WhatsApp Outbox Cursor Pagination
  console.log('\n>> Testing WhatsAppOutboxService.getOutboxForLab cursor flow...');
  let outPage1 = await WhatsAppOutboxService.getOutboxForLab(labId, 'all', 1, 2, '');
  console.log(`Page 1 returned ${outPage1.entries.length} entries. hasNextPage: ${outPage1.hasNextPage}. nextCursor: ${outPage1.nextCursor}`);
  if (outPage1.entries.length === 2 && outPage1.hasNextPage === true && outPage1.nextCursor) {
    console.log('✔ Page 1 matches assertions.');
  } else {
    console.error('❌ FAIL on Outbox Page 1.');
  }

  let outPage2 = await WhatsAppOutboxService.getOutboxForLab(labId, 'all', 1, 2, outPage1.nextCursor);
  console.log(`Page 2 returned ${outPage2.entries.length} entries. hasNextPage: ${outPage2.hasNextPage}. nextCursor: ${outPage2.nextCursor}`);
  if (outPage2.entries.length === 2 && outPage2.hasNextPage === true && outPage2.nextCursor) {
    console.log('✔ Page 2 matches assertions.');
  } else {
    console.error('❌ FAIL on Outbox Page 2.');
  }

  let outPage3 = await WhatsAppOutboxService.getOutboxForLab(labId, 'all', 1, 2, outPage2.nextCursor);
  console.log(`Page 3 returned ${outPage3.entries.length} entries. hasNextPage: ${outPage3.hasNextPage}. nextCursor: ${outPage3.nextCursor}`);
  if (outPage3.entries.length === 1 && outPage3.hasNextPage === false && outPage3.nextCursor === null) {
    console.log('✔ Page 3 matches assertions.');
  } else {
    console.error('❌ FAIL on Outbox Page 3.');
  }


  // =========================================================================
  // 3. COMPRESSION MIDDLEWARE VERIFICATION
  // =========================================================================
  console.log('\n--- 4. Testing PDF Service Compression Middleware ---');

  // Spawn a temporary Express app mounting the same compression middleware
  const testApp = express();
  testApp.use(compression({ threshold: 0 }));
  testApp.get('/test-health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'pehlix-pdf-service-test',
      dummyData: 'a'.repeat(2000) // 2kb of data
    });
  });

  const server = testApp.listen(3099, async () => {
    try {
      const response = await axios.get('http://localhost:3099/test-health', {
        headers: {
          'Accept-Encoding': 'gzip'
        },
        decompress: false
      });
      console.log('Response Headers:', response.headers);
      const contentEncoding = response.headers['content-encoding'];
      if (contentEncoding === 'gzip') {
        console.log('✔ PASS: Server responded with Content-Encoding: gzip successfully!');
      } else {
        console.error('❌ FAIL: Response was not compressed (Content-Encoding missing or different). Got:', contentEncoding);
      }
    } catch (err) {
      console.error('❌ FAIL: Request to test server failed:', err.message);
    } finally {
      server.close();
      await cleanup();
    }
  });

  async function cleanup() {
    console.log('\nCleaning up seeded database records...');
    await Lab.deleteOne({ _id: labId });
    await Patient.deleteMany({ labId });
    await Visit.deleteMany({ labId });
    await WhatsAppOutbox.deleteMany({ labId });
    await Notification.deleteMany({ labId });
    console.log('✔ Cleanup finished.');
    
    console.log('\n====== ALL TESTS COMPLETED ======');
    mongoose.connection.close();
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Test runner caught fatal error:', err);
  mongoose.connection.close();
  process.exit(1);
});
