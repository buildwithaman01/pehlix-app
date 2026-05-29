import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/utils/db.js';
import Lab from '../src/modules/staff/lab.model.js';
import User from '../src/modules/staff/user.model.js';
import Patient from '../src/modules/patients/patient.model.js';
import Visit from '../src/modules/visits/visit.model.js';
import Sample from '../src/modules/samples/sample.model.js';
import Result from '../src/modules/results/result.model.js';
import ResultAudit from '../src/modules/results/resultAudit.model.js';
import Report from '../src/modules/reports/report.model.js';
import { PatientService } from '../src/modules/patients/patient.service.js';
import { ResultService } from '../src/modules/results/result.service.js';
import { ReportService } from '../src/modules/reports/report.service.js';
import { SampleService } from '../src/modules/samples/sample.service.js';
import { StaffController } from '../src/modules/staff/staff.controller.js';

dotenv.config();

async function runTests() {
  console.log('\n==================================================');
  console.log('  STARTING PHASE 3 CLINICAL COMPLIANCE VERIFICATION  ');
  console.log('==================================================\n');

  await connectDB();
  const suffix = Date.now().toString().slice(-6);

  // Fixtures
  const testLab = await Lab.create({
    name: `Compliance Lab ${suffix}`,
    slug: `comp-lab-${suffix}`,
    phone: '9888777666',
    email: `compliance-lab-${suffix}@pehlix.com`,
    plan: 'starter',
    isActive: true
  });

  const pathologist = await User.create({
    name: 'Dr. John Doe',
    email: `pathologist-${suffix}@pehlix.com`,
    phone: `9111${suffix}`,
    role: 'pathologist',
    labId: testLab._id,
    isActive: true,
    qualifications: 'MBBS, MD (Pathology)',
    registrationNumber: 'MC-12345'
  });

  const technician = await User.create({
    name: 'Jane Tech',
    email: `tech-${suffix}@pehlix.com`,
    phone: `9222${suffix}`,
    role: 'technician',
    labId: testLab._id,
    isActive: true
  });

  console.log('✔ Lab, Pathologist, and Technician created successfully.');

  try {
    // --------------------------------------------------
    // TEST 1: Consent & Data Governance Enforcements
    // --------------------------------------------------
    console.log('\n--- Test 1: Consent & Data Governance ---');
    
    // 1A. Attempt registration without consent
    try {
      await PatientService.createPatient(testLab._id, {
        firstName: 'Test',
        lastName: 'Consent',
        phone: '9333333333',
        age: 30,
        gender: 'female',
        consentGiven: false
      }, technician._id);
      console.error('❌ Fail: Registered patient without consent.');
      process.exit(1);
    } catch (err) {
      if (err.code === 'CONSENT_REQUIRED') {
        console.log('✔ Pass: Prevented patient registration without consent.');
      } else {
        throw err;
      }
    }

    // 1B. Register patient with consent
    const patient = await PatientService.createPatient(testLab._id, {
      firstName: 'Test',
      lastName: 'Consent',
      phone: '9333333333',
      email: 'consent@pehlix.com',
      age: 28,
      gender: 'female',
      consentGiven: true,
      consentMethod: 'staff_entry'
    }, technician._id, '192.168.1.50');

    if (patient.consentGiven && patient.consentIpAddress === '192.168.1.50' && patient.consentMethod === 'staff_entry') {
      console.log('✔ Pass: Consent metadata successfully tracked (IP: 192.168.1.50, Method: staff_entry).');
    } else {
      console.error('❌ Fail: Consent metadata was not recorded correctly:', patient);
      process.exit(1);
    }

    // --------------------------------------------------
    // TEST 2: Sample Chain of Custody & Rejection Guard
    // --------------------------------------------------
    console.log('\n--- Test 2: Sample Chain of Custody & Rejection Guard ---');

    const visit = await Visit.create({
      visitCode: `V-${suffix}`,
      patientId: patient._id,
      labId: testLab._id,
      paymentStatus: 'paid',
      tests: [new mongoose.Types.ObjectId()] // mock test id
    });

    const sample = await Sample.create({
      labId: testLab._id,
      barcodeId: `BAR-${suffix}`,
      visitId: visit._id,
      patientId: patient._id,
      sampleType: 'Blood',
      status: 'pending'
    });

    // 2A. Update status to received with storage location
    await SampleService.updateSampleStatus(testLab._id, sample._id, 'received', technician._id, 'Sample received at reception', 'Box-A4');
    
    let updatedSample = await Sample.findById(sample._id);
    if (updatedSample.status === 'received' && updatedSample.storageLocation === 'Box-A4' && updatedSample.receivedAt) {
      console.log('✔ Pass: Updated status to received, storage location and timestamp logged.');
    } else {
      console.error('❌ Fail: Status or storage location not logged correctly:', updatedSample);
      process.exit(1);
    }

    // 2B. Reject the sample
    await SampleService.rejectSample(testLab._id, sample._id, 'lipemic', pathologist._id);
    updatedSample = await Sample.findById(sample._id);
    
    if (updatedSample.status === 'rejected' && updatedSample.isRejected && updatedSample.rejectionReason === 'lipemic' && updatedSample.rejectedAt) {
      console.log('✔ Pass: Sample successfully marked as rejected, logs populated.');
    } else {
      console.error('❌ Fail: Sample rejection properties not recorded correctly:', updatedSample);
      process.exit(1);
    }

    // 2C. Retrieve chain of custody logs
    const chainOfCustody = updatedSample.chainOfCustody;
    if (chainOfCustody.length >= 2 && chainOfCustody[1].action === 'rejected') {
      console.log('✔ Pass: Chain of custody contains audit trail of status changes.');
    } else {
      console.error('❌ Fail: Chain of custody records missing or invalid:', chainOfCustody);
      process.exit(1);
    }

    // 2D. Enforce rejected sample result submission block
    try {
      await ResultService.submitResult(testLab._id, {
        visitId: visit._id,
        testId: visit.tests[0],
        sampleId: sample._id,
        parameters: [{ parameterName: 'Hemoglobin', value: '14.2' }]
      }, technician._id);
      console.error('❌ Fail: Submitted results against a rejected sample.');
      process.exit(1);
    } catch (err) {
      if (err.code === 'SAMPLE_REJECTED') {
        console.log('✔ Pass: Blocked submitting results against rejected sample.');
      } else {
        throw err;
      }
    }

    // --------------------------------------------------
    // TEST 3: Pathologist Signature upload URL generator
    // --------------------------------------------------
    console.log('\n--- Test 3: Pathologist Signature upload URL generator ---');
    
    let presignedResult = null;
    const mockRes = {
      status(c) { return this; },
      json(data) { presignedResult = data; return this; }
    };

    await StaffController.getSignatureUploadUrl({
      params: { id: pathologist._id },
      user: { labId: testLab._id, role: 'pathologist', userId: pathologist._id.toString() }
    }, mockRes, (err) => { if (err) throw err; });

    if (presignedResult && presignedResult.status === 'success' && presignedResult.data.uploadUrl && presignedResult.data.key) {
      console.log('✔ Pass: Generated R2 pre-signed upload URL for signature.');
      const updatedPathologist = await User.findById(pathologist._id);
      if (updatedPathologist.signatureImageKey === presignedResult.data.key) {
        console.log('✔ Pass: Updated signatureImageKey on user model.');
      } else {
        console.error('❌ Fail: signatureImageKey not set on pathologist user:', updatedPathologist);
        process.exit(1);
      }
    } else {
      console.error('❌ Fail: getSignatureUploadUrl controller returned error or unexpected structure:', presignedResult);
      process.exit(1);
    }

  } finally {
    console.log('\nCleaning up verification database records...');
    await Lab.findByIdAndDelete(testLab._id);
    await User.deleteMany({ labId: testLab._id });
    await Patient.deleteMany({ labId: testLab._id });
    await Visit.deleteMany({ labId: testLab._id });
    await Sample.deleteMany({ labId: testLab._id });
    await Result.deleteMany({ labId: testLab._id });
    await ResultAudit.deleteMany({ labId: testLab._id });
    await Report.deleteMany({ labId: testLab._id });
    await mongoose.disconnect();
  }

  console.log('\n==================================================');
  console.log('   VERIFICATION TESTS COMPLETED SUCCESSFULLY!      ');
  console.log('==================================================\n');
}

runTests().catch(err => {
  console.error('❌ Run tests failed:', err);
  process.exit(1);
});
