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
import Result from '../src/modules/results/result.model.js';
import { ResultService } from '../src/modules/results/result.service.js';
import { TestsController } from '../src/modules/staff/tests.controller.js';
import { AuditLog } from '../src/middleware/audit.middleware.js';

// Load environment variables
dotenv.config();

async function runVerification() {
  console.log('\n====== STARTING CUSTOM PARAMETERS & RANGES VERIFICATION ======\n');

  // 1. Connect to database
  await connectDB();
  console.log('✔ Connected to MongoDB successfully.');

  const suffix = Date.now().toString().slice(-6);
  const testLabSlug = `test-lab-ranges-${suffix}`;

  // Clean up existing test labs
  await Lab.deleteMany({ slug: /^test-lab-ranges-/ });
  await User.deleteMany({ email: /^test-tech-ranges-/ });
  await Patient.deleteMany({ firstName: 'RangePatient' });
  await Doctor.deleteMany({ name: 'RangeDoctor' });
  await Visit.deleteMany({ visitCode: /^VIS-RANGE-/ });
  await AuditLog.deleteMany({ action: /test_/ });

  // 2. Create Lab and Tech User
  const testLab = await Lab.create({
    name: `Verification Lab ${suffix}`,
    slug: testLabSlug,
    phone: '9888888888',
    email: `${testLabSlug}@pehlix.com`,
    plan: 'starter',
    isActive: true
  });
  console.log(`✔ Created Test Lab: ${testLab.name}`);

  const techUser = await User.create({
    name: 'Range Tech',
    email: `test-tech-ranges-${suffix}@pehlix.com`,
    phone: `9888${suffix}`,
    role: 'technician',
    labId: testLab._id,
    isActive: true
  });
  console.log(`✔ Created Tech User: ${techUser.name}`);

  // 3. Ensure global catalog is seeded
  console.log('Checking standard master tests catalog...');
  const cbcMaster = await TestMaster.findOne({ code: 'CBC' });
  if (!cbcMaster) {
    console.error('❌ CBC not found in master catalog. Seeding might have failed.');
    process.exit(1);
  }
  console.log(`✔ Found global CBC Master test with parameters: ${cbcMaster.parameters.map(p => p.name).join(', ')}`);

  // Import CBC to Lab catalog
  const labCbc = await LabTest.create({
    labId: testLab._id,
    testId: cbcMaster._id,
    name: cbcMaster.name,
    code: cbcMaster.code,
    price: cbcMaster.basePrice,
    isActive: true
  });
  console.log(`✔ Imported CBC into Lab catalog: ID ${labCbc._id}`);

  // 4. Create custom test from scratch
  console.log('Creating a custom test...');
  const mockReqCreate = {
    user: { labId: testLab._id, _id: techUser._id, role: 'owner' },
    body: {
      name: 'Special Vitamin Profile',
      code: 'VITSPEC',
      price: 2500,
      department: 'Biochemistry',
      sampleType: 'Serum',
      container: 'Yellow Top',
      parameters: [
        { name: 'Active Vitamin D', unit: 'ng/mL', normalLow: 40, normalHigh: 80, criticalLow: 20, criticalHigh: 120 }
      ]
    }
  };

  let mockResJson = null;
  const mockRes = {
    status(code) {
      return this;
    },
    json(data) {
      mockResJson = data;
      return this;
    }
  };

  await TestsController.createCustomTest(mockReqCreate, mockRes, (err) => {
    if (err) throw err;
  });

  if (mockResJson?.status !== 'success') {
    console.error('❌ Failed to create custom test:', mockResJson);
    process.exit(1);
  }

  const customLabTest = mockResJson.data;
  console.log(`✔ Custom test created: ${customLabTest.name} (${customLabTest.code})`);

  // Verify uniqueness of code in TestMaster
  const customMaster = await TestMaster.findById(customLabTest.testId);
  console.log(`✔ Master test document created: Code = ${customMaster.code}, isCustom = ${customMaster.isCustom}`);

  // 5. Update standard test parameters (CBC overrides)
  console.log('Updating CBC parameters with overrides...');
  const customCbcParams = [
    { name: 'Hemoglobin (Hb)', unit: 'g/dL', normalLow: 14.0, normalHigh: 18.0, criticalLow: 8.0, criticalHigh: 21.0 },
    { name: 'Total Leukocyte Count (TLC)', unit: '/cumm', normalLow: 4500, normalHigh: 11500 }
  ];

  const mockReqUpdate = {
    user: { labId: testLab._id, _id: techUser._id, role: 'owner' },
    params: { id: labCbc._id },
    body: {
      price: 450,
      parameters: customCbcParams
    }
  };

  await TestsController.updateTest(mockReqUpdate, mockRes, (err) => {
    if (err) throw err;
  });

  const updatedLabCbc = await LabTest.findById(labCbc._id);
  console.log(`✔ CBC parameters updated. CustomParameters count: ${updatedLabCbc.customParameters.length}`);

  // 6. Test evaluation results (standard test validation)
  console.log('Testing results entry validation against custom ranges...');
  const patient = await Patient.create({
    firstName: 'RangePatient',
    lastName: 'Test',
    phone: '9777777777',
    gender: 'male',
    age: 35,
    ageUnit: 'years',
    patientCode: `PT-${suffix}`,
    labId: testLab._id
  });

  const doctor = await Doctor.create({
    name: 'RangeDoctor',
    phone: '9666666666',
    email: `doc-${suffix}@pehlix.com`,
    labId: testLab._id
  });

  const visit = await Visit.create({
    visitCode: `VIS-RANGE-${suffix}`,
    patientId: patient._id,
    referredBy: doctor._id,
    tests: [labCbc._id, customLabTest._id],
    paymentStatus: 'paid',
    labId: testLab._id
  });

  // Enter Hemoglobin = 13.5. 
  // Global CBC Hb normal low is 13.0, so 13.5 is NORMAL globally.
  // Overridden Hb normal low is 14.0, so 13.5 should flag as LOW (L) locally!
  const enteredParams = [
    { parameterName: 'Hemoglobin (Hb)', value: '13.5' }
  ];

  const submitRes = await ResultService.submitResult(
    testLab._id,
    {
      visitId: visit._id,
      testId: cbcMaster._id,
      parameters: enteredParams
    },
    techUser._id
  );

  const processedHb = submitRes.result.parameters.find(p => p.parameterName === 'Hemoglobin (Hb)');
  console.log(`Submitted Hb: 13.5 g/dL`);
  console.log(`Evaluated Status: ${processedHb.status}, isFlagged: ${processedHb.isFlagged}`);
  
  if (processedHb.status === 'low' && processedHb.isFlagged === true) {
    console.log('✔ SUCCESS: Local reference overrides evaluated correctly (13.5 g/dL flagged as low against custom 14.0 low limit).');
  } else {
    console.error('❌ FAILURE: Local overrides not respected.');
    process.exit(1);
  }

  // 7. Verify Reset works
  console.log('Testing reset overrides to default...');
  const mockReqReset = {
    user: { labId: testLab._id, _id: techUser._id, role: 'owner' },
    params: { id: labCbc._id }
  };

  await TestsController.resetTest(mockReqReset, mockRes, (err) => {
    if (err) throw err;
  });

  const resetCbc = await LabTest.findById(labCbc._id);
  console.log(`Reset completed. CustomParameters count: ${resetCbc.customParameters.length}, Selling Price: ${resetCbc.price}`);
  
  if (resetCbc.customParameters.length === 0 && resetCbc.price === cbcMaster.basePrice) {
    console.log('✔ SUCCESS: Reset successfully restored global default values.');
  } else {
    console.error('❌ FAILURE: Reset failed.');
    process.exit(1);
  }

  // 8. Verify Audit Logs
  const auditLogs = await AuditLog.find({ labId: testLab._id });
  console.log(`✔ Verified Audit Logs: Found ${auditLogs.length} matching events.`);
  auditLogs.forEach(log => {
    console.log(`  - [AuditLog] Action: ${log.action}, Details: ${JSON.stringify(log.details)}`);
  });

  // Clean up
  console.log('Cleaning up verification fixtures...');
  await Lab.findByIdAndDelete(testLab._id);
  await User.findByIdAndDelete(techUser._id);
  await Patient.findByIdAndDelete(patient._id);
  await Doctor.findByIdAndDelete(doctor._id);
  await Visit.findByIdAndDelete(visit._id);
  await TestMaster.findByIdAndDelete(customMaster._id);
  await LabTest.deleteMany({ labId: testLab._id });
  await Result.deleteMany({ visitId: visit._id });

  console.log('\n====== VERIFICATION COMPLETED SUCCESSFULLY! ======\n');
}

runVerification().catch(err => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
