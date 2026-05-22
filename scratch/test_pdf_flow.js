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
import Sample from '../src/modules/samples/sample.model.js';
import Result from '../src/modules/results/result.model.js';
import Report from '../src/modules/reports/report.model.js';
import { Invoice } from '../src/modules/billing/invoice.model.js';
import { pdfWebhookController } from '../src/modules/webhooks/pdf.webhook.js';

// Import generator directly from the pdf microservice repository
import { generateReportPdf } from '../../pehlix-pdf-service/src/generator.js';

dotenv.config();
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001';

async function runPdfVerification() {
  console.log('\n====== STARTING E2E PDF GENERATION & DELIVERY FLOW VERIFICATION ======\n');

  // 1. Start a temporary main application backend server on port 3001 to capture the callback webhook
  const app = express();
  app.use(express.json());
  
  // Register the real callback hook
  app.post('/api/internal/pdf/generated', pdfWebhookController.onPdfGenerated);

  const server = app.listen(3001, () => {
    console.log('✔ Temp Main App server listening on port 3001 to handle callbacks.');
  });

  // 2. Connect to Database
  await connectDB();
  console.log('✔ Connected to MongoDB successfully.');

  const suffix = Date.now().toString().slice(-6);

  // 3. Clean up any leftover test data
  console.log('Cleaning up old test documents...');
  await Lab.deleteMany({ slug: /^test-lab-/ });
  await User.deleteMany({ email: /^test-user-/ });
  await Patient.deleteMany({ firstName: 'TestPatient' });
  await Doctor.deleteMany({ name: 'TestDoctor' });
  await TestMaster.deleteMany({ code: /^TESTMASTER-/ });
  await LabTest.deleteMany({ name: /^TestLabTest-/ });
  await Visit.deleteMany({ visitCode: /^VIS-TEST-/ });
  await Sample.deleteMany({ barcodeId: /^BARCODE-TEST-/ });
  await Result.deleteMany({ labId: { $in: await Lab.find({ slug: /^test-lab-/ }).select('_id') } });
  await Report.deleteMany({ qrVerificationId: /^qr-test-/ });
  await Invoice.deleteMany({});

  // 4. Create fixtures
  console.log('Creating test fixtures...');
  
  const testLab = await Lab.create({
    name: `Test Diagnostic Labs ${suffix}`,
    slug: `test-lab-${suffix}`,
    phone: '9999999999',
    email: `test-lab-${suffix}@pehlix.in`,
    plan: 'starter',
    isActive: true,
    isSuspended: false,
    nablNumber: 'MC-9999',
    logo: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=200',
    address: {
      street: '123 Health Care Street',
      city: 'Ranchi',
      state: 'Jharkhand',
      pincode: '834001'
    }
  });
  console.log(`✔ Created Lab: ${testLab.name}`);

  const pathologist = await User.create({
    name: 'Dr. Sarah Carter',
    email: `test-user-path-${suffix}@pehlix.in`,
    role: 'pathologist',
    labId: testLab._id,
    phone: '7777777777',
    isActive: true,
    signature: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=150'
  });
  console.log(`✔ Created Pathologist: ${pathologist.name}`);

  const testDoctor = await Doctor.create({
    labId: testLab._id,
    name: 'Dr. Rajesh Sharma',
    phone: '9876543210',
    email: `test-doctor-${suffix}@pehlix.in`,
    qualification: 'MD Medicine (AIIMS)',
    isActive: true
  });
  console.log(`✔ Created Referring Doctor: ${testDoctor.name}`);

  const testPatient = await Patient.create({
    labId: testLab._id,
    patientCode: `P-${suffix}`,
    firstName: 'TestPatient',
    lastName: 'Kumar',
    phone: '9000000000',
    age: 38,
    ageUnit: 'years',
    gender: 'male',
    consentGiven: true
  });
  console.log(`✔ Created Patient: ${testPatient.firstName} ${testPatient.lastName}`);

  const testMaster = await TestMaster.create({
    code: `TESTMASTER-${suffix}`,
    name: 'Thyroid Stimulating Hormone (TSH)',
    department: 'Biochemistry',
    sampleType: 'Serum',
    container: 'SST Tube (Yellow)',
    basePrice: 400,
    parameters: [
      { name: 'TSH', unit: 'uIU/mL', normalLow: 0.45, normalHigh: 4.5, criticalLow: 0.1, criticalHigh: 10.0 }
    ],
    isActive: true
  });
  console.log(`✔ Created TestMaster Catalog entry: ${testMaster.name}`);

  const labTest = await LabTest.create({
    labId: testLab._id,
    testId: testMaster._id,
    name: `TSH Test`,
    code: `TSH-${suffix}`,
    price: 450,
    isActive: true
  });
  console.log(`✔ Created LabTest Mapping: ${labTest.name}`);

  // Create Visit 1: Historical Visit (10 days ago) for Trend Chart
  const date10DaysAgo = new Date();
  date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);

  const visit1 = await Visit.create({
    labId: testLab._id,
    visitCode: `VIS-TEST-HIST-${suffix}`,
    patientId: testPatient._id,
    referredBy: testDoctor._id,
    tests: [labTest._id],
    status: 'reported',
    createdAt: date10DaysAgo
  });

  const result1 = await Result.create({
    labId: testLab._id,
    visitId: visit1._id,
    testId: testMaster._id,
    parameters: [
      { parameterName: 'TSH', value: 5.2, unit: 'uIU/mL', status: 'high' } // previous value high
    ],
    isApproved: true,
    approvedBy: pathologist._id,
    approvedAt: date10DaysAgo,
    createdAt: date10DaysAgo
  });
  console.log(`✔ Created Historical Visit & Result (TSH: 5.2)`);

  // Create Visit 2: Current Visit
  const visit2 = await Visit.create({
    labId: testLab._id,
    visitCode: `VIS-TEST-CURR-${suffix}`,
    patientId: testPatient._id,
    referredBy: testDoctor._id,
    tests: [labTest._id],
    status: 'approved'
  });

  const result2 = await Result.create({
    labId: testLab._id,
    visitId: visit2._id,
    testId: testMaster._id,
    parameters: [
      { parameterName: 'TSH', value: 3.1, unit: 'uIU/mL', status: 'normal' } // current value normal (improving!)
    ],
    isApproved: true,
    approvedBy: pathologist._id,
    approvedAt: new Date()
  });
  console.log(`✔ Created Current Visit & Result (TSH: 3.1)`);

  const invoice = await Invoice.create({
    labId: testLab._id,
    visitId: visit2._id,
    patientId: testPatient._id,
    invoiceCode: `INV-${suffix}`,
    subtotal: 450,
    totalAmount: 450,
    amountPaid: 450,
    balanceAmount: 0,
    paymentStatus: 'paid'
  });
  console.log(`✔ Created Paid Invoice for Current Visit`);

  // Create Report record (starts as pending)
  const report = await Report.create({
    labId: testLab._id,
    visitId: visit2._id,
    patientId: testPatient._id,
    reportCode: `RP-${suffix}`,
    qrVerificationId: `qr-test-${suffix}`,
    status: 'pending'
  });
  console.log(`✔ Created Pending Report Record: ${report.reportCode}`);

  // 5. Trigger PDF Generator directly
  console.log('\n--- EXECUTING PDF GENERATION MICROSERVICE ENGINE ---');
  try {
    const genResult = await generateReportPdf(visit2._id, testLab._id, report._id);
    console.log('✔ PDF Service execution finished. Result:', genResult);
    
    // 6. Verify changes in DB
    console.log('\n--- VERIFYING DATABASE TRANSITIONS ---');
    const finalReport = await Report.findById(report._id);
    console.log(`Report Status in DB: ${finalReport.status} (Expected: generated or delivered)`);
    console.log(`Report PDF URL in DB: ${finalReport.pdfUrl}`);
    console.log(`Report generatedAt in DB: ${finalReport.generatedAt}`);

    if (finalReport.status === 'generated' || finalReport.status === 'delivered') {
      console.log('✔ PASS: Database report record updated successfully.');
    } else {
      console.log('❌ FAIL: Report record is not in generated/delivered state.');
    }

    const finalVisit = await Visit.findById(visit2._id);
    console.log(`Visit Status in DB: ${finalVisit.status} (Expected: reported or delivered)`);
    if (finalVisit.status === 'reported' || finalVisit.status === 'delivered') {
      console.log('✔ PASS: Visit record updated successfully.');
    } else {
      console.log('❌ FAIL: Visit record status mismatch.');
    }

  } catch (err) {
    console.error('❌ E2E Execution failed:', err);
  } finally {
    // Shutdown temp server
    server.close(() => {
      console.log('\n✔ Mock Main App server shut down.');
      console.log('====== PDF FLOW VERIFICATION END ======\n');
      process.exit(0);
    });
  }
}

runPdfVerification().catch(err => {
  console.error('❌ Fatal error in script:', err);
  process.exit(1);
});
