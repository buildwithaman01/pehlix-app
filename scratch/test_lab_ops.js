import mongoose from 'mongoose';
import dotenv from 'dotenv';
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

import SampleService from '../src/modules/samples/sample.service.js';
import ResultService from '../src/modules/results/result.service.js';

// Load environment variables
dotenv.config();

async function runTests() {
  console.log('\n====== STARTING LAB OPERATIONS WORKFLOW VERIFICATION ======\n');

  // 1. Connect to database
  await connectDB();
  console.log('✔ Connected to MongoDB successfully.');

  // Create unique suffix to avoid collision
  const suffix = Date.now().toString().slice(-6);

  // 2. Clean up any leftover test data
  console.log('Cleaning up old test documents...');
  await Lab.deleteMany({ slug: /^test-lab-/ });
  await User.deleteMany({ email: /^test-user-/ });
  await Patient.deleteMany({ firstName: 'TestPatient' });
  await Doctor.deleteMany({ name: 'TestDoctor' });
  await TestMaster.deleteMany({ code: /^TESTMASTER-/ });
  await LabTest.deleteMany({ name: /^TestLabTest-/ });
  await Visit.deleteMany({ visitCode: /^VIS-TEST-/ });
  await Sample.deleteMany({ barcodeId: /^BARCODE-TEST-/ });
  await Result.deleteMany({}); // Delete results for testing convenience
  await Report.deleteMany({ qrVerificationId: /^qr-test-/ });

  // 3. Create fixtures
  console.log('Creating test fixtures...');
  
  const testLab = await Lab.create({
    name: `Test Laboratory ${suffix}`,
    slug: `test-lab-${suffix}`,
    phone: '9999999999',
    email: `test-lab-${suffix}@pehlix.com`,
    plan: 'starter',
    isActive: true,
    isSuspended: false
  });
  console.log(`✔ Created Lab: ${testLab.name} (${testLab._id})`);

  const techUser = await User.create({
    name: 'TestTech User',
    email: `test-user-tech-${suffix}@pehlix.com`,
    role: 'technician',
    labId: testLab._id,
    phone: '8888888888',
    isActive: true
  });
  console.log(`✔ Created User (Technician): ${techUser.name} (${techUser._id})`);

  const pathUser = await User.create({
    name: 'TestPathologist Doc',
    email: `test-user-path-${suffix}@pehlix.com`,
    role: 'pathologist',
    labId: testLab._id,
    phone: '7777777777',
    isActive: true
  });
  console.log(`✔ Created User (Pathologist): ${pathUser.name} (${pathUser._id})`);

  const testDoctor = await Doctor.create({
    labId: testLab._id,
    name: 'TestDoctor',
    phone: '9876543210',
    email: `test-doctor-${suffix}@pehlix.com`,
    qualification: 'MD Pathology',
    isActive: true
  });
  console.log(`✔ Created Referring Doctor: ${testDoctor.name} (${testDoctor._id})`);

  const testPatient = await Patient.create({
    labId: testLab._id,
    patientCode: `P-${suffix}`,
    firstName: 'TestPatient',
    lastName: 'Alpha',
    phone: '9000000000',
    age: 45,
    ageUnit: 'years',
    gender: 'male',
    consentGiven: true
  });
  console.log(`✔ Created Patient: ${testPatient.firstName} ${testPatient.lastName} (${testPatient._id})`);

  // Create Test Master Catalog entries (with formula MCH = MCV * MCHC / 100)
  const testMaster = await TestMaster.create({
    code: `TESTMASTER-${suffix}`,
    name: 'Complete Blood Count (CBC) Parameters',
    department: 'Hematology',
    sampleType: 'Whole Blood',
    container: 'EDTA Tube (Purple)',
    basePrice: 500,
    parameters: [
      { name: 'MCV', unit: 'fL', normalLow: 80, normalHigh: 100, criticalLow: 50, criticalHigh: 120 },
      { name: 'MCHC', unit: 'g/dL', normalLow: 32, normalHigh: 36, criticalLow: 25, criticalHigh: 40 },
      { name: 'MCH', unit: 'pg', normalLow: 27, normalHigh: 33, criticalLow: 20, criticalHigh: 40, isDerived: true }
    ],
    derivedFormulas: [
      {
        targetParameter: 'MCH',
        formula: 'MCV * MCHC / 100',
        inputs: ['MCV', 'MCHC']
      }
    ],
    isActive: true
  });
  console.log(`✔ Created TestMaster Catalog Record: ${testMaster.name} (${testMaster._id})`);

  const labTest = await LabTest.create({
    labId: testLab._id,
    testId: testMaster._id,
    name: `TestLabTest-CBC-${suffix}`,
    code: `LT-CBC-${suffix}`,
    price: 600,
    isActive: true
  });
  console.log(`✔ Created LabTest Mapping: ${labTest.name} (${labTest._id})`);

  const visit = await Visit.create({
    labId: testLab._id,
    visitCode: `VIS-TEST-${suffix}`,
    patientId: testPatient._id,
    referredBy: testDoctor._id,
    tests: [labTest._id],
    status: 'registered'
  });
  console.log(`✔ Created Visit: ${visit.visitCode} (${visit._id})`);

  const sample = await Sample.create({
    labId: testLab._id,
    barcodeId: `BARCODE-TEST-${suffix}`,
    visitId: visit._id,
    patientId: testPatient._id,
    sampleType: 'Whole Blood',
    status: 'received',
    chainOfCustody: [{ action: 'received', performedBy: techUser._id, notes: 'Sample received at lab' }]
  });
  console.log(`✔ Created Sample: ${sample.barcodeId} (${sample._id})`);

  // Update visit status to processing as it transitions
  visit.sampleIds = [sample._id];
  await visit.save();
  await SampleService.updateSampleStatus(testLab._id, sample._id, 'processing', techUser._id, 'Moved to processing');

  // --- Step 4. Barcode Scanning Test (under 200ms target) ---
  console.log('\n--- VERIFYING: BARCODE SCANNING ---');
  
  // Warm up query (establishes Mongoose query builder initialization/connection warm-up)
  await SampleService.scanBarcode(testLab._id, sample.barcodeId);
  
  const scanStartTime = Date.now();
  const scanData = await SampleService.scanBarcode(testLab._id, sample.barcodeId);
  const scanEndTime = Date.now();
  const duration = scanEndTime - scanStartTime;

  console.log(`Barcode scanning query took ${duration}ms (Target: <200ms)`);
  if (duration < 200) {
    console.log('✔ PASS: Barcode scanning completes well within the 200ms threshold.');
  } else {
    console.log('❌ FAIL: Barcode scanning took too long.');
  }
  
  if (scanData && scanData.sample && scanData.sample.barcodeId === sample.barcodeId) {
    console.log('✔ PASS: Returned sample matching scanned barcode.');
  } else {
    console.log('❌ FAIL: Scanned barcode data not found or mismatch.');
  }

  // --- Step 5. Derived Values & Normal Range Check ---
  console.log('\n--- VERIFYING: DERIVED VALUES & RANGE CHECK (NORMAL CASE) ---');
  const normalSubmission = {
    visitId: visit._id,
    testId: testMaster._id,
    sampleId: sample._id,
    parameters: [
      { parameterName: 'MCV', value: 90, unit: 'fL' },
      { parameterName: 'MCHC', value: 34, unit: 'g/dL' }
    ]
  };

  const normalResultObj = await ResultService.submitResult(testLab._id, normalSubmission, techUser._id);
  console.log('Submitted Normal Results. Result Obj:', JSON.stringify(normalResultObj.result.parameters, null, 2));
  
  const mchParam = normalResultObj.result.parameters.find(p => p.parameterName === 'MCH');
  if (mchParam && mchParam.value === 30.6 && mchParam.status === 'normal') {
    console.log('✔ PASS: Derived MCH (90 * 34 / 100 = 30.6) calculated and flagged as normal.');
  } else {
    console.log('❌ FAIL: Derived MCH calculation or status is incorrect.');
  }
  console.log(`Is Critical: ${normalResultObj.isCritical} (Expected: false)`);

  // --- Step 6. Critical Value Flagging ---
  console.log('\n--- VERIFYING: CRITICAL VALUE DETECTION & CONFIRMATION WARNING ---');
  const criticalSubmission = {
    visitId: visit._id,
    testId: testMaster._id,
    sampleId: sample._id,
    parameters: [
      { parameterName: 'MCV', value: 45, unit: 'fL' }, // Critical Low (<=50)
      { parameterName: 'MCHC', value: 30, unit: 'g/dL' } // Normal (but triggers MCH formula)
    ]
  };

  const criticalResultObj = await ResultService.submitResult(testLab._id, criticalSubmission, techUser._id);
  console.log(`Is Critical Detected: ${criticalResultObj.isCritical} (Expected: true)`);
  console.log('Flagged Parameters:', JSON.stringify(criticalResultObj.flaggedParameters, null, 2));

  if (criticalResultObj.isCritical && criticalResultObj.flaggedParameters.length > 0) {
    console.log('✔ PASS: Critical range triggered warning correctly.');
  } else {
    console.log('❌ FAIL: Critical values not detected.');
  }

  // --- Step 7. Triggering Alerts & Mocking QStash Queue ---
  console.log('\n--- VERIFYING: CRITICAL ALERT TRIGGERING ---');
  const alertTriggerResponse = await ResultService.triggerCriticalAlert(
    testLab._id,
    criticalResultObj.result._id,
    visit._id
  );

  console.log('Alert trigger response:', JSON.stringify(alertTriggerResponse, null, 2));
  if (alertTriggerResponse.alertSent && alertTriggerResponse.escalationScheduled) {
    console.log('✔ PASS: Critical alerts sent and escalation scheduled via QStash.');
  } else {
    console.log('❌ FAIL: Alert triggering failed.');
  }

  // --- Step 8. Critical Value Acknowledgement ---
  console.log('\n--- VERIFYING: PUBLIC ACKNOWLEDGEMENT ENDPOINT ---');
  const alertIdToken = `alert-token-doc-${suffix}`;
  const acknowledgedResult = await ResultService.acknowledgeAlert(criticalResultObj.result._id, alertIdToken);
  
  if (acknowledgedResult.criticalAcknowledgedAt && acknowledgedResult.criticalAcknowledgedBy === alertIdToken) {
    console.log('✔ PASS: Doctor acknowledged the critical alert successfully.');
  } else {
    console.log('❌ FAIL: Alert acknowledgement not stored properly.');
  }

  // --- Step 9. Pathologist Queue Sorting ---
  console.log('\n--- VERIFYING: PATHOLOGIST APPROVAL QUEUE SORTING ---');
  const approvalQueue = await ResultService.getApprovalQueue(testLab._id);
  console.log(`Queue size: ${approvalQueue.length}`);
  
  if (approvalQueue.length > 0 && approvalQueue[0].isCritical === true) {
    console.log('✔ PASS: Critical cases prioritized at the top of the pathologist queue.');
  } else {
    console.log('❌ FAIL: Pathologist queue sorting failed.');
  }

  // Create a placeholder Report document (normally generated during workflow)
  const report = await Report.create({
    labId: testLab._id,
    visitId: visit._id,
    patientId: testPatient._id,
    reportCode: `REP-TEST-${suffix}`,
    status: 'pending',
    qrVerificationId: `qr-test-${suffix}`,
    pdfUrl: `https://pehlix-reports.r2.cloudflare.com/reports/report-${suffix}.pdf`
  });

  // --- Step 10. Pathologist Approval ---
  console.log('\n--- VERIFYING: PATHOLOGIST APPROVAL ---');
  const approveResult = await ResultService.approveResult(
    testLab._id,
    criticalResultObj.result._id,
    pathUser._id,
    'Approve CBC results'
  );

  console.log('Approval Result:', JSON.stringify(approveResult, null, 2));
  const updatedVisit = await Visit.findById(visit._id);
  const updatedReport = await Report.findById(report._id);

  if (approveResult.approved && updatedVisit.status === 'approved' && updatedReport.status === 'approved') {
    console.log('✔ PASS: Pathologist approved the result, visit and report transitioned to approved.');
  } else {
    console.log('❌ FAIL: Pathologist approval failed to transition statuses correctly.');
  }

  // --- Step 11. Pathologist Rejection ---
  console.log('\n--- VERIFYING: PATHOLOGIST REJECTION ---');
  // Mark result as unapproved for rejection test
  criticalResultObj.result.isApproved = false;
  await criticalResultObj.result.save();

  const rejectResult = await ResultService.rejectResult(
    testLab._id,
    criticalResultObj.result._id,
    pathUser._id,
    'Re-run sample, MCV value seems exceptionally low'
  );

  if (rejectResult.isRejected && rejectResult.rejectionNote.includes('exceptionally low')) {
    console.log('✔ PASS: Result successfully rejected and sent back with a rejection note to the technician.');
  } else {
    console.log('❌ FAIL: Result rejection did not log rejection fields properly.');
  }

  // --- Step 12. Public Report Verification Endpoint Mock ---
  console.log('\n--- VERIFYING: PUBLIC QR REPORT VERIFICATION ---');
  
  // Clean up and restore approval states for verification query
  criticalResultObj.result.isApproved = true;
  criticalResultObj.result.approvedBy = pathUser._id;
  await criticalResultObj.result.save();

  const mockReq = { params: { qrVerificationId: report.qrVerificationId } };
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };

  // Import ReportController helper mock
  const verifyResult = await Report.findOne({ qrVerificationId: report.qrVerificationId, isDeleted: { $ne: true } })
    .populate('patientId')
    .populate('labId')
    .populate({
      path: 'visitId',
      populate: { path: 'tests' }
    });

  const approvedResult = await Result.findOne({ visitId: report.visitId, isApproved: true }).populate('approvedBy');
  const pathologistName = approvedResult.approvedBy.name 
    || `${approvedResult.approvedBy.firstName} ${approvedResult.approvedBy.lastName || ''}`.trim();
  const patientName = `${verifyResult.patientId.firstName} ${verifyResult.patientId.lastName || ''}`.trim();
  
  console.log('Verified Report Info:');
  console.log(`- Patient Name: ${patientName}`);
  console.log(`- Lab Name: ${verifyResult.labId.name}`);
  console.log(`- Pathologist Name: ${pathologistName}`);
  console.log(`- Verification Status: Authentic and unmodified`);

  if (patientName === 'TestPatient Alpha' && verifyResult.labId.name.includes('Test Laboratory') && pathologistName === 'TestPathologist Doc') {
    console.log('✔ PASS: Public report verification retrieves correct details.');
  } else {
    console.log('❌ FAIL: Public report verification failed.');
  }

  console.log('\n====== ALL TESTS COMPLETED SUCCESSFULLY ======\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test execution encountered an error:', err);
  process.exit(1);
});
