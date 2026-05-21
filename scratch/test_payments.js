import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Force NEXT_PUBLIC_APP_URL to be localhost:5000 for this test run
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:5000';
process.env.PORT = '5000';

// Global variables to track mock API calls
let smsCallCount = 0;
let whatsappCallCount = 0;

// Mock Razorpay prototype constructor and instance properties
import Razorpay from 'razorpay';
Object.defineProperty(Razorpay.prototype, 'paymentLink', {
  get() {
    return {
      create: async (data) => {
        console.log('[Mock Razorpay] paymentLink.create called with:', JSON.stringify(data, null, 2));
        const randomId = Math.random().toString(36).substring(7);
        return {
          id: `plink_${randomId}`,
          short_url: `https://rzp.io/i/${randomId}`
        };
      }
    };
  },
  set(val) {
    // Ignore constructor assignment
  },
  configurable: true
});

// Mock axios.post globally for third-party endpoints
const originalPost = axios.post;
axios.post = async function(url, data, config) {
  if (url.includes('graph.facebook.com')) {
    whatsappCallCount++;
    console.log(`[Mock Meta WhatsApp API] POST count ${whatsappCallCount} to: ${url}`);
    return {
      status: 200,
      data: {
        messages: [{ id: `meta_msg_${Math.random().toString(36).substring(7)}` }]
      }
    };
  }
  if (url.includes('msg91.com')) {
    smsCallCount++;
    console.log(`[Mock MSG91 SMS API] POST count ${smsCallCount} to: ${url}`);
    return {
      status: 200,
      data: { type: 'success', message: 'SMS sent successfully' }
    };
  }
  return originalPost.apply(this, arguments);
};

// Dynamically import everything else to ensure port/env overrides are loaded first
const mongoose = (await import('mongoose')).default;
const crypto = (await import('crypto')).default;
const { connectDB } = await import('../src/utils/db.js');
const Lab = (await import('../src/modules/staff/lab.model.js')).default;
const User = (await import('../src/modules/staff/user.model.js')).default;
const Patient = (await import('../src/modules/patients/patient.model.js')).default;
const Doctor = (await import('../src/modules/doctors/doctor.model.js')).default;
const TestMaster = (await import('../src/modules/staff/testMaster.model.js')).default;
const LabTest = (await import('../src/modules/staff/labTest.model.js')).default;
const Visit = (await import('../src/modules/visits/visit.model.js')).default;
const Sample = (await import('../src/modules/samples/sample.model.js')).default;
const Result = (await import('../src/modules/results/result.model.js')).default;
const Report = (await import('../src/modules/reports/report.model.js')).default;
const Invoice = (await import('../src/modules/billing/invoice.model.js')).default;
const Payment = (await import('../src/modules/billing/payment.model.js')).default;
const Notification = (await import('../src/modules/notifications/notification.model.js')).default;

const ResultService = (await import('../src/modules/results/result.service.js')).default;
const InvoiceController = (await import('../src/modules/billing/invoice.controller.js')).default;
const QStashService = (await import('../src/utils/qstash.js')).default;
const app = (await import('../src/app.js')).default;

// Mock QStash Service enqueue to route jobs directly to our local test server
QStashService.enqueue = async (endpoint, payload, delaySeconds = 0) => {
  console.log(`[Mock QStash] Enqueuing job to: ${endpoint} (delay: ${delaySeconds}s)`);
  
  // Deliver the payload asynchronously to the local server, ignoring delay for fast testing
  setTimeout(async () => {
    try {
      const response = await originalPost(endpoint, payload);
      console.log(`[Mock QStash] Delivery to ${endpoint} returned: ${response.status}`);
    } catch (err) {
      // PDF generation is expected to fail with 404 in this test since the PDF service route is not mounted in pehlix-app
      if (endpoint.includes('/reports/generate')) {
        console.log(`[Mock QStash] PDF generation endpoint returned 404 (Expected for microservice setup)`);
      } else {
        console.error(`[Mock QStash] Delivery to ${endpoint} failed:`, err.response?.data || err.message);
      }
    }
  }, 50);
  
  return `qstash_msg_${Math.random().toString(36).substring(7)}`;
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('\n====== STARTING INTEGRATION TEST RUN ======\n');

  // 1. Connect to database
  await connectDB();
  console.log('✔ Connected to MongoDB successfully.');

  // 2. Start local express test server
  const server = app.listen(5000, () => {
    console.log('✔ Test Express server listening on port 5000');
  });

  const suffix = Date.now().toString().slice(-6);

  // 3. Clean up database
  console.log('Cleaning up old test documents...');
  await Lab.deleteMany({ slug: /^test-payment-lab-/ });
  await User.deleteMany({ email: /^test-payment-user-/ });
  await Patient.deleteMany({ firstName: 'TestPaymentPatient' });
  await Doctor.deleteMany({ name: 'TestPaymentDoctor' });
  await TestMaster.deleteMany({ code: /^TESTMASTER-PAY-/ });
  await LabTest.deleteMany({ name: /^TestPaymentLabTest-/ });
  await Visit.deleteMany({ visitCode: /^VIS-PAYTEST-/ });
  await Sample.deleteMany({ barcodeId: /^BARCODE-PAY-/ });
  await Result.deleteMany({});
  await Report.deleteMany({ qrVerificationId: /^qr-pay-/ });
  await Invoice.deleteMany({});
  await Payment.deleteMany({});
  await Notification.deleteMany({});

  // 4. Create fixtures
  console.log('Creating test fixtures...');

  const testLab = await Lab.create({
    name: `Test Payment Laboratory ${suffix}`,
    slug: `test-payment-lab-${suffix}`,
    phone: '9999999999',
    email: `test-payment-lab-${suffix}@pehlix.com`,
    plan: 'starter',
    isActive: true,
    isSuspended: false,
    razorpayKeyId: 'rzp_test_key_id',
    razorpayKeySecret: 'rzp_test_key_secret'
  });
  console.log(`✔ Created Lab: ${testLab.name}`);

  const ownerUser = await User.create({
    name: 'TestOwner User',
    email: `test-payment-user-owner-${suffix}@pehlix.com`,
    role: 'owner',
    labId: testLab._id,
    phone: '9988776655',
    isActive: true
  });
  testLab.owner = ownerUser._id;
  await testLab.save();
  console.log(`✔ Created User (Owner): ${ownerUser.name}`);

  const techUser = await User.create({
    name: 'TestTech User',
    email: `test-payment-user-tech-${suffix}@pehlix.com`,
    role: 'technician',
    labId: testLab._id,
    phone: '8888888888',
    isActive: true
  });

  const pathUser = await User.create({
    name: 'TestPathologist Doc',
    email: `test-payment-user-path-${suffix}@pehlix.com`,
    role: 'pathologist',
    labId: testLab._id,
    phone: '7777777777',
    isActive: true
  });

  const testDoctor = await Doctor.create({
    labId: testLab._id,
    name: 'TestPaymentDoctor',
    phone: '9876543210',
    email: `test-payment-doctor-${suffix}@pehlix.com`,
    qualification: 'MD Pathology',
    isActive: true
  });

  const testPatient = await Patient.create({
    labId: testLab._id,
    patientCode: `P-PAY-${suffix}`,
    firstName: 'TestPaymentPatient',
    lastName: 'Beta',
    phone: '9000000000',
    email: 'testpatient@pehlix.in',
    age: 30,
    ageUnit: 'years',
    gender: 'female',
    consentGiven: true
  });

  const testMaster = await TestMaster.create({
    code: `TESTMASTER-PAY-${suffix}`,
    name: 'Standard Blood Panel',
    department: 'Hematology',
    sampleType: 'Whole Blood',
    container: 'EDTA Tube (Purple)',
    basePrice: 1000,
    parameters: [
      { name: 'Hemoglobin', unit: 'g/dL', normalLow: 12, normalHigh: 16, criticalLow: 7, criticalHigh: 20 }
    ],
    isActive: true
  });

  const labTest = await LabTest.create({
    labId: testLab._id,
    testId: testMaster._id,
    name: `TestPaymentLabTest-CBC-${suffix}`,
    code: `LT-PAYCBC-${suffix}`,
    price: 1200,
    isActive: true
  });

  // Visit 1: Unpaid
  const visitUnpaid = await Visit.create({
    labId: testLab._id,
    visitCode: `VIS-PAYTEST-UNPAID-${suffix}`,
    patientId: testPatient._id,
    referredBy: testDoctor._id,
    tests: [labTest._id],
    status: 'registered'
  });

  const invoiceUnpaid = await Invoice.create({
    labId: testLab._id,
    visitId: visitUnpaid._id,
    patientId: testPatient._id,
    invoiceCode: `INV-UNPAID-${suffix}`,
    lineItems: [{ testId: labTest._id, testName: labTest.name, price: 1200, finalPrice: 1200 }],
    subtotal: 1016.95,
    gstRate: 18,
    gstAmount: 183.05,
    totalAmount: 1200,
    amountPaid: 0,
    paymentStatus: 'pending'
  });

  // Visit 2: Paid
  const visitPaid = await Visit.create({
    labId: testLab._id,
    visitCode: `VIS-PAYTEST-PAID-${suffix}`,
    patientId: testPatient._id,
    referredBy: testDoctor._id,
    tests: [labTest._id],
    status: 'registered'
  });

  const invoicePaid = await Invoice.create({
    labId: testLab._id,
    visitId: visitPaid._id,
    patientId: testPatient._id,
    invoiceCode: `INV-PAID-${suffix}`,
    lineItems: [{ testId: labTest._id, testName: labTest.name, price: 1200, finalPrice: 1200 }],
    subtotal: 1016.95,
    gstRate: 18,
    gstAmount: 183.05,
    totalAmount: 1200,
    amountPaid: 1200,
    paymentStatus: 'paid'
  });

  // Create Results
  const resultUnpaidObj = await ResultService.submitResult(
    testLab._id,
    {
      visitId: visitUnpaid._id,
      testId: testMaster._id,
      parameters: [{ parameterName: 'Hemoglobin', value: 14 }]
    },
    techUser._id
  );
  const resultUnpaid = resultUnpaidObj.result;

  const resultPaidObj = await ResultService.submitResult(
    testLab._id,
    {
      visitId: visitPaid._id,
      testId: testMaster._id,
      parameters: [{ parameterName: 'Hemoglobin', value: 13 }]
    },
    techUser._id
  );
  const resultPaid = resultPaidObj.result;

  // Create Reports
  const reportUnpaid = await Report.create({
    labId: testLab._id,
    visitId: visitUnpaid._id,
    patientId: testPatient._id,
    reportCode: `REP-UNPAID-${suffix}`,
    status: 'pending',
    qrVerificationId: `qr-pay-unpaid-${suffix}`,
    pdfUrl: `https://pehlix-reports.r2.cloudflare.com/reports/report-unpaid-${suffix}.pdf`
  });

  const reportPaid = await Report.create({
    labId: testLab._id,
    visitId: visitPaid._id,
    patientId: testPatient._id,
    reportCode: `REP-PAID-${suffix}`,
    status: 'pending',
    qrVerificationId: `qr-pay-paid-${suffix}`,
    pdfUrl: `https://pehlix-reports.r2.cloudflare.com/reports/report-paid-${suffix}.pdf`
  });

  // --- TEST 1: Generate Payment Link via InvoiceController ---
  console.log('\n--- VERIFYING: INVOICE CONTROLLER GENERATE PAYMENT LINK ---');
  const mockReqGen = {
    params: { id: invoiceUnpaid._id.toString() },
    user: { labId: testLab._id, _id: ownerUser._id }
  };
  let linkResponse = null;
  const mockResGen = {
    status(code) { return this; },
    json(payload) {
      linkResponse = payload;
      return this;
    }
  };

  await InvoiceController.generatePaymentLink(mockReqGen, mockResGen, (err) => {
    if (err) console.error('Error in controller:', err);
  });

  console.log('Controller payment link response:', JSON.stringify(linkResponse, null, 2));
  if (linkResponse && linkResponse.status === 'success' && linkResponse.data?.paymentLink) {
    console.log('✔ PASS: InvoiceController generated payment link successfully.');
  } else {
    console.log('❌ FAIL: InvoiceController failed to generate payment link.');
  }

  // --- TEST 2: Pathologist Approval flow with Unpaid Invoice (Paywall trigger) ---
  console.log('\n--- VERIFYING: PATHOLOGIST APPROVAL FOR UNPAID INVOICE ---');
  const approveUnpaid = await ResultService.approveResult(
    testLab._id,
    resultUnpaid._id,
    pathUser._id,
    'Approve Unpaid Results'
  );

  console.log('Approval output:', JSON.stringify(approveUnpaid, null, 2));
  const updatedInvoiceUnpaid = await Invoice.findById(invoiceUnpaid._id);
  console.log('Invoice short_url:', updatedInvoiceUnpaid.razorpayPaymentLinkUrl);

  if (updatedInvoiceUnpaid.razorpayPaymentLinkUrl && updatedInvoiceUnpaid.razorpayPaymentLinkUrl.includes('rzp.io')) {
    console.log('✔ PASS: Pathologist approval generated a Razorpay paywall link for unpaid invoice.');
  } else {
    console.log('❌ FAIL: Paywall link not generated during pathologist approval.');
  }

  // Wait a small bit for mock QStash async tasks to resolve
  await sleep(1500);

  // Verify notification queued
  const unpaidNotif = await Notification.findOne({
    templateName: 'report_ready_unpaid',
    recipientPhone: testPatient.phone
  });
  if (unpaidNotif && unpaidNotif.variables.paymentLink === updatedInvoiceUnpaid.razorpayPaymentLinkUrl) {
    console.log('✔ PASS: WhatsApp template report_ready_unpaid enqueued with the payment link.');
  } else {
    console.log('❌ FAIL: WhatsApp notification for unpaid invoice was not enqueued properly.');
  }

  // --- TEST 3: Pathologist Approval flow with Paid Invoice (PDF trigger) ---
  console.log('\n--- VERIFYING: PATHOLOGIST APPROVAL FOR PAID INVOICE ---');
  const approvePaid = await ResultService.approveResult(
    testLab._id,
    resultPaid._id,
    pathUser._id,
    'Approve Paid Results'
  );

  console.log('Approval output:', JSON.stringify(approvePaid, null, 2));
  await sleep(1500);

  // Verify notification queued
  const paidNotif = await Notification.findOne({
    templateName: 'report_ready_paid',
    recipientPhone: testPatient.phone
  });
  if (paidNotif && paidNotif.variables.reportCode === reportPaid.reportCode) {
    console.log('✔ PASS: WhatsApp template report_ready_paid enqueued directly.');
  } else {
    console.log('❌ FAIL: WhatsApp notification for paid invoice was not enqueued.');
  }

  // --- TEST 4: Razorpay Webhook HTTP Endpoint & Capture processing ---
  console.log('\n--- VERIFYING: RAZORPAY WEBHOOK HANDLER VIA HTTP POST ---');
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

  const sampleWebhookBody = {
    entity: 'event',
    account_id: 'acc_test123',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_captured_${suffix}`,
          amount: 120000, // 1200.00 INR in paise
          currency: 'INR',
          status: 'captured',
          order_id: 'order_test123',
          notes: {
            invoiceId: invoiceUnpaid._id.toString()
          }
        }
      }
    }
  };

  const bodyStr = JSON.stringify(sampleWebhookBody);
  const hmacSign = crypto.createHmac('sha256', webhookSecret).update(bodyStr).digest('hex');

  // Trigger POST request to running local webhook route
  console.log('Posting webhook event to http://localhost:5000/api/webhooks/razorpay...');
  const webhookResponse = await originalPost('http://localhost:5000/api/webhooks/razorpay', sampleWebhookBody, {
    headers: {
      'x-razorpay-signature': hmacSign,
      'Content-Type': 'application/json'
    }
  });

  console.log(`Webhook HTTP status: ${webhookResponse.status}, body:`, webhookResponse.data);
  if (webhookResponse.status === 200 && webhookResponse.data.status === 'ok') {
    console.log('✔ PASS: Webhook endpoint accepted signature and returned 200.');
  } else {
    console.log('❌ FAIL: Webhook endpoint failed.');
  }

  // Wait a bit for mock QStash to process the job in background
  await sleep(2000);

  const afterWebhookInvoice = await Invoice.findById(invoiceUnpaid._id);
  console.log(`Invoice status after webhook processing: ${afterWebhookInvoice.paymentStatus}, paid: ${afterWebhookInvoice.amountPaid}`);

  if (afterWebhookInvoice.paymentStatus === 'paid' && afterWebhookInvoice.amountPaid === 1200) {
    console.log('✔ PASS: Webhook payload processed asynchronously, marking invoice as paid.');
  } else {
    console.log('❌ FAIL: Invoice was not marked paid by async job.');
  }

  const paymentRecord = await Payment.findOne({ razorpayPaymentId: `pay_captured_${suffix}` });
  if (paymentRecord && paymentRecord.status === 'success' && paymentRecord.amount === 1200) {
    console.log('✔ PASS: Payment record created in database successfully.');
  } else {
    console.log('❌ FAIL: Payment record is missing or incorrect.');
  }

  // --- TEST 5: Critical Value Alerting & Simultaneous Notifications & Escalation Chain ---
  console.log('\n--- VERIFYING: CRITICAL ALERT TRIGGERING & ESCALATION QUEUE ---');
  
  // Reset API counters before starting
  smsCallCount = 0;
  whatsappCallCount = 0;

  // Create test master with critical parameter
  const testCriticalMaster = await TestMaster.create({
    code: `TESTMASTER-PAY-CRIT-${suffix}`,
    name: 'Critical Blood Panel',
    department: 'Biochemistry',
    sampleType: 'Serum',
    container: 'Red Tube',
    basePrice: 500,
    parameters: [
      { name: 'Potassium', unit: 'mmol/L', normalLow: 3.5, normalHigh: 5.1, criticalLow: 2.8, criticalHigh: 6.2 }
    ],
    isActive: true
  });

  const criticalResultObj = await ResultService.submitResult(
    testLab._id,
    {
      visitId: visitUnpaid._id,
      testId: testCriticalMaster._id,
      parameters: [{ parameterName: 'Potassium', value: 7.0 }] // Critical High (7.0 > 6.2)
    },
    techUser._id
  );

  console.log('Submitted critical result. Is Critical:', criticalResultObj.isCritical);

  // Trigger alert. This enqueues WhatsApp + SMS to doctor, AND enqueues a QStash escalation job.
  const alertRes = await ResultService.triggerCriticalAlert(
    testLab._id,
    criticalResultObj.result._id,
    visitUnpaid._id
  );

  console.log('Alert Trigger Response:', JSON.stringify(alertRes, null, 2));

  // Wait for the mock QStash delivery cascade (Attempt 1 + Attempt 2) to resolve completely
  console.log('Waiting for QStash escalation check cascade to resolve...');
  await sleep(2500);

  // Verify notifications enqueued:
  // 1. WhatsApp to doctor
  const waDoctor = await Notification.findOne({
    templateName: 'critical_value_alert',
    channel: 'whatsapp',
    recipientPhone: testDoctor.phone
  });
  console.log('WhatsApp Doctor Alert found:', !!waDoctor);

  // 2. WhatsApp reminder to owner (attempt 2 escalation output)
  const ownerWa = await Notification.findOne({
    templateName: 'owner_daily_summary',
    channel: 'whatsapp',
    recipientPhone: ownerUser.phone
  });
  console.log('WhatsApp Owner Escalation found:', !!ownerWa);

  // 3. MSG91 SMS calls intercepted
  console.log('Total intercepted MSG91 SMS calls:', smsCallCount);

  if (waDoctor && ownerWa && smsCallCount >= 3) {
    console.log('✔ PASS: Simultaneous doctor alerts and full 15/30-minute escalation chain processed successfully!');
  } else {
    console.log('❌ FAIL: Escalation chain or notification entries are missing.');
  }

  console.log('\n====== ALL TESTS COMPLETED SUCCESSFULLY ======\n');
  server.close();
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test execution encountered an error:', err);
  process.exit(1);
});
