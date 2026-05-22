import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/utils/db.js';
import Lab from '../src/modules/staff/lab.model.js';
import User from '../src/modules/staff/user.model.js';
import Patient from '../src/modules/patients/patient.model.js';
import Doctor from '../src/modules/doctors/doctor.model.js';
import Visit from '../src/modules/visits/visit.model.js';
import LabTest from '../src/modules/staff/labTest.model.js';
import Invoice from '../src/modules/billing/invoice.model.js';
import Commission from '../src/modules/doctors/commission.model.js';
import DoctorService from '../src/modules/doctors/doctor.service.js';
import QStashService from '../src/utils/qstash.js';

dotenv.config();

// Mock QStash notification system to make verification offline-safe
QStashService.enqueueNotification = async (templateName, variables, phone) => {
  console.log(`[MOCK QStash] Enqueued notification template "${templateName}" to ${phone}`);
  return 'mock-msg-id-12345';
};

async function runVerification() {
  console.log('\n====== STARTING E2E DOCTOR COMMISSION VERIFICATION ======\n');

  // Connect to the DB
  await connectDB();
  console.log('✔ Connected to MongoDB successfully.');

  const suffix = Date.now().toString().slice(-6);

  // Clean up existing test data
  console.log('Cleaning up old test documents...');
  await Lab.deleteMany({ slug: /^test-doc-lab-/ });
  await Patient.deleteMany({ firstName: 'TestDocPatient' });
  await Doctor.deleteMany({ name: /^Test Doctor/ });
  await Visit.deleteMany({ visitCode: /^VIS-DOC-/ });
  await Invoice.deleteMany({ invoiceCode: /^INV-DOC-/ });
  await Commission.deleteMany({});
  await User.deleteMany({ role: 'doctor' });

  // 1. Create a test lab and doctor with commissionType: percentage, commissionValue: 10
  console.log('\n--- CHECK 1: Creating lab and percentage commission doctor ---');
  const lab = await Lab.create({
    name: `Test Doc Lab ${suffix}`,
    slug: `test-doc-lab-${suffix}`,
    phone: '9999999999',
    email: `test-lab-${suffix}@pehlix.in`,
    plan: 'starter',
    isActive: true,
    isSuspended: false
  });
  console.log(`✔ Lab created: ${lab.name}`);

  const doctor1 = await DoctorService.createDoctor(lab._id, {
    name: `Test Doctor Percentage ${suffix}`,
    phone: '9000000001',
    email: `percentage-doc-${suffix}@pehlix.in`,
    qualification: 'MBBS, MD',
    commissionType: 'percentage',
    commissionValue: 10,
    portalAccess: true
  }, 'system');
  
  console.log(`✔ Doctor 1 created: ${doctor1.name}`);
  console.log(`  Commission type: ${doctor1.commissionType}, value: ${doctor1.commissionValue}%`);
  console.log(`  Linked portal userId: ${doctor1.userId}`);

  // Verify that User record was created for doctor
  const linkedUser = await User.findById(doctor1.userId);
  if (linkedUser && linkedUser.role === 'doctor') {
    console.log('✔ PASS: Minimal User record automatically provisioned for doctor portal.');
  } else {
    throw new Error('❌ FAIL: User record not provisioned for doctor portal.');
  }

  // 2. Create a patient and visit with referredBy set to the doctor's id
  console.log('\n--- CHECK 2: Creating patient and visit referred by doctor ---');
  const patient = await Patient.create({
    labId: lab._id,
    patientCode: `PAT-${suffix}`,
    firstName: 'TestDocPatient',
    lastName: 'Singh',
    phone: '9111111111',
    age: 45,
    ageUnit: 'years',
    gender: 'female',
    consentGiven: true
  });
  console.log(`✔ Patient created: ${patient.firstName} ${patient.lastName}`);

  const visit = await Visit.create({
    labId: lab._id,
    visitCode: `VIS-DOC-${suffix}`,
    patientId: patient._id,
    referredBy: doctor1._id,
    status: 'registered'
  });
  console.log(`✔ Visit created: ${visit.visitCode}`);

  // 3. Create an invoice for 1000 rupees
  console.log('\n--- CHECK 3: Creating invoice for visit ---');
  const invoice = await Invoice.create({
    labId: lab._id,
    visitId: visit._id,
    patientId: patient._id,
    invoiceCode: `INV-DOC-${suffix}`,
    subtotal: 1000,
    totalAmount: 1000,
    amountPaid: 0,
    balanceAmount: 1000,
    paymentStatus: 'pending'
  });
  console.log(`✔ Invoice created: ${invoice.invoiceCode}, Total Amount: Rs. ${invoice.totalAmount}`);

  // 4. Call doctorService.calculateAndRecordCommission directly
  console.log('\n--- CHECK 4 & 5: Calculating and verifying percentage commission ---');
  const commission1 = await DoctorService.calculateAndRecordCommission(
    lab._id,
    visit._id,
    invoice._id,
    invoice.totalAmount
  );

  if (!commission1) {
    throw new Error('❌ FAIL: Commission record was not created.');
  }
  console.log(`✔ Commission record created: id=${commission1._id}`);
  console.log(`  Commission Amount calculated: Rs. ${commission1.commissionAmount}`);

  // 5. Verify commission record was created with commissionAmount 100 (10% of 1000)
  if (commission1.commissionAmount === 100) {
    console.log('✔ PASS: Commission amount is exactly 100 (10% of 1000).');
  } else {
    throw new Error(`❌ FAIL: Expected commission 100, got ${commission1.commissionAmount}`);
  }

  // 6. Call doctorService.getDoctorCommissions and verify the record appears
  console.log('\n--- CHECK 6: Retrieving doctor commissions and verifying groupings ---');
  const commissionsGroup = await DoctorService.getDoctorCommissions(lab._id, doctor1._id);
  console.log('✔ Doctor Commissions groupings:', {
    pendingCount: commissionsGroup.pending.length,
    totals: commissionsGroup.totals
  });

  if (commissionsGroup.pending.length === 1 && commissionsGroup.pending[0]._id.equals(commission1._id)) {
    console.log('✔ PASS: Commission appears correctly in the pending group.');
  } else {
    throw new Error('❌ FAIL: Commission does not appear in pending group.');
  }

  // 7. Call doctorService.generateMonthlyStatement and verify it returns correct data and updates status
  console.log('\n--- CHECK 7: Generating monthly statement ---');
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const statement = await DoctorService.generateMonthlyStatement(
    lab._id,
    doctor1._id,
    currentMonth,
    currentYear
  );

  if (!statement) {
    throw new Error('❌ FAIL: Statement generation returned null.');
  }
  console.log('✔ Statement Data:', {
    doctorName: statement.doctorName,
    labName: statement.labName,
    month: statement.month,
    totalReferrals: statement.totalReferrals,
    totalCommissionAmount: statement.totalCommissionAmount,
    recordsCount: statement.commissions.length
  });

  if (statement.totalCommissionAmount === 100 && statement.totalReferrals === 1) {
    console.log('✔ PASS: Statement values are correct.');
  } else {
    throw new Error('❌ FAIL: Statement contains invalid totals.');
  }

  // Verify status updated to statement_sent in DB
  const commissionReloaded = await Commission.findById(commission1._id);
  console.log(`  Commission status after statement generation: ${commissionReloaded.status}`);
  if (commissionReloaded.status === 'statement_sent') {
    console.log('✔ PASS: Commission status transitioned to statement_sent.');
  } else {
    throw new Error(`❌ FAIL: Expected status statement_sent, got ${commissionReloaded.status}`);
  }

  // 8. Call doctorService.markCommissionPaid and verify status changes to paid
  console.log('\n--- CHECK 8: Marking commission as paid ---');
  const updatedCount = await DoctorService.markCommissionPaid(
    lab._id,
    doctor1._id,
    [commission1._id],
    'TXN-MOCK-999',
    new mongoose.Types.ObjectId()
  );

  console.log(`✔ Commissions marked paid count: ${updatedCount}`);
  const commissionPaid = await Commission.findById(commission1._id);
  console.log(`  Commission status in DB: ${commissionPaid.status}, Ref: ${commissionPaid.paymentReference}`);

  if (updatedCount === 1 && commissionPaid.status === 'paid' && commissionPaid.paymentReference === 'TXN-MOCK-999') {
    console.log('✔ PASS: Commission successfully marked as paid.');
  } else {
    throw new Error('❌ FAIL: Marking commission paid failed.');
  }

  // 9. Verify idempotency — calling calculateAndRecordCommission again for the same visitId returns the existing record without duplicate
  console.log('\n--- CHECK 9: Verifying idempotency of commission calculations ---');
  const duplicateCallResult = await DoctorService.calculateAndRecordCommission(
    lab._id,
    visit._id,
    invoice._id,
    invoice.totalAmount
  );

  const totalCommissionsCount = await Commission.countDocuments({ labId: lab._id, visitId: visit._id });
  console.log(`✔ DB records count for this visit: ${totalCommissionsCount}`);
  
  if (totalCommissionsCount === 1 && duplicateCallResult._id.equals(commission1._id)) {
    console.log('✔ PASS: Idempotency is working. Returned existing record without duplication.');
  } else {
    throw new Error('❌ FAIL: Idempotency check failed, duplicate record created.');
  }

  // 10. Tests flat commission type — creates a second doctor with commissionType flat and commissionValue 200
  console.log('\n--- CHECK 10: Testing flat commission type doctor ---');
  const doctor2 = await DoctorService.createDoctor(lab._id, {
    name: `Test Doctor Flat ${suffix}`,
    phone: '9000000002',
    email: `flat-doc-${suffix}@pehlix.in`,
    qualification: 'MD Pathology',
    commissionType: 'flat',
    commissionValue: 200,
    portalAccess: false
  }, 'system');

  console.log(`✔ Doctor 2 created: ${doctor2.name}`);
  console.log(`  Commission type: ${doctor2.commissionType}, value: Rs. ${doctor2.commissionValue}`);

  // Create another patient & visit
  const patient2 = await Patient.create({
    labId: lab._id,
    patientCode: `PAT2-${suffix}`,
    firstName: 'TestDocPatient2',
    phone: '9222222222',
    age: 22,
    ageUnit: 'years',
    gender: 'male',
    consentGiven: true
  });

  const visit2 = await Visit.create({
    labId: lab._id,
    visitCode: `VIS-DOC2-${suffix}`,
    patientId: patient2._id,
    referredBy: doctor2._id,
    status: 'registered'
  });

  const invoice2 = await Invoice.create({
    labId: lab._id,
    visitId: visit2._id,
    patientId: patient2._id,
    invoiceCode: `INV-DOC2-${suffix}`,
    subtotal: 5000,
    totalAmount: 5000,
    amountPaid: 0,
    balanceAmount: 5000,
    paymentStatus: 'pending'
  });

  const commission2 = await DoctorService.calculateAndRecordCommission(
    lab._id,
    visit2._id,
    invoice2._id,
    invoice2.totalAmount
  );

  console.log(`✔ Commission calculated for flat-rate doctor: Rs. ${commission2.commissionAmount} (Invoice was Rs. ${invoice2.totalAmount})`);
  if (commission2.commissionAmount === 200) {
    console.log('✔ PASS: Flat commission amount matches commissionValue perfectly.');
  } else {
    throw new Error(`❌ FAIL: Expected commission 200, got ${commission2.commissionAmount}`);
  }

  console.log('\n====== ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY! ======\n');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
