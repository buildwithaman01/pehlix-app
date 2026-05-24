import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/utils/db.js';
import User from '../src/modules/staff/user.model.js';
import Patient from '../src/modules/patients/patient.model.js';
import AuthService from '../src/modules/auth/auth.service.js';
import { AuthController } from '../src/modules/auth/auth.controller.js';

dotenv.config();

// Create mock response object
function mockResponse() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  res.cookie = (name, value, options) => {
    res.cookies = res.cookies || {};
    res.cookies[name] = value;
    return res;
  };
  return res;
}

async function runTests() {
  console.log('\n====== STARTING DECOUPLED PATIENT OTP TESTS ======\n');
  await connectDB();
  console.log('✔ Connected to MongoDB.');

  const suffix = Date.now().toString().slice(-6);
  const unregisteredPhone = '9900' + suffix;
  const patientPhone = '9911' + suffix;
  const doctorPhone = '9922' + suffix;

  // Cleanup old test users & patients
  await User.deleteMany({ phone: { $in: [unregisteredPhone, patientPhone, doctorPhone] } });
  await Patient.deleteMany({ phone: { $in: [patientPhone] } });

  // 1. Test Unregistered Phone OTP Request (should be blocked)
  console.log('\n--- TEST 1: Unregistered Phone OTP Request ---');
  try {
    const req = { body: { phone: unregisteredPhone } };
    const res = mockResponse();
    await AuthController.sendOtp(req, res, (err) => {
      if (err) throw err;
    });
    console.error('❌ FAIL: Unregistered number should have been blocked!');
  } catch (error) {
    if (error.statusCode === 403 && error.message.includes('not registered')) {
      console.log('✔ PASS: Unregistered phone request blocked correctly:', error.message);
    } else {
      console.error('❌ FAIL: Unexpected error:', error);
    }
  }

  // 2. Test Doctor Phone OTP Request (should succeed)
  console.log('\n--- TEST 2: Doctor OTP Request ---');
  const doctor = await User.create({
    role: 'doctor',
    name: `Dr. Test ${suffix}`,
    phone: doctorPhone,
    labId: new mongoose.Types.ObjectId(),
    isActive: true
  });
  try {
    const req = { body: { phone: doctorPhone } };
    const res = mockResponse();
    await AuthController.sendOtp(req, res, (err) => {
      if (err) throw err;
    });
    console.log('✔ PASS: Doctor OTP sent successfully. (Dev OTP code: 123456)');
  } catch (error) {
    console.error('❌ FAIL: Doctor OTP request failed:', error);
  }

  // 3. Test Patient On-Demand OTP Request (should succeed because clinical record exists)
  console.log('\n--- TEST 3: Patient On-Demand OTP Request ---');
  const patientRecord = await Patient.create({
    labId: new mongoose.Types.ObjectId(),
    patientCode: 'PAT99999',
    firstName: 'John',
    lastName: 'Doe',
    phone: patientPhone,
    age: 30,
    ageUnit: 'years',
    gender: 'male',
    consentGiven: true
  });
  console.log(`Created mock clinical patient record: ${patientRecord.firstName} ${patientRecord.lastName} (${patientRecord.phone})`);

  try {
    const req = { body: { phone: patientPhone } };
    const res = mockResponse();
    await AuthController.sendOtp(req, res, (err) => {
      if (err) throw err;
    });
    console.log('✔ PASS: Patient OTP sent successfully because clinical record exists.');
  } catch (error) {
    console.error('❌ FAIL: Patient OTP request failed:', error);
  }

  // 4. Test Patient OTP Verification & Auto-Provisioning
  console.log('\n--- TEST 4: Patient OTP Verification & Provisioning ---');
  try {
    const req = { body: { phone: patientPhone, otp: '123456' } };
    const res = mockResponse();
    await AuthController.verifyOtp(req, res, (err) => {
      if (err) throw err;
    });

    // Check if user was provisioned
    const provisionedUser = await User.findOne({ phone: patientPhone });
    if (provisionedUser && provisionedUser.role === 'patient') {
      console.log('✔ PASS: Patient user was auto-provisioned correctly!');
      console.log(`Provisioned Name: ${provisionedUser.name}`);
      console.log(`Provisioned Role: ${provisionedUser.role}`);
      if (provisionedUser.name === 'John Doe') {
        console.log('✔ PASS: Name dynamically matched clinical record name!');
      } else {
        console.error('❌ FAIL: Name did not match John Doe');
      }
    } else {
      console.error('❌ FAIL: Patient user not found or incorrect role!');
    }
  } catch (error) {
    console.error('❌ FAIL: Patient verifyOtp failed:', error);
  }

  // Cleanup test documents
  await User.deleteMany({ phone: { $in: [unregisteredPhone, patientPhone, doctorPhone] } });
  await Patient.deleteMany({ phone: { $in: [patientPhone] } });

  console.log('\n====== ALL DECOUPLED OTP TESTS COMPLETED SUCCESSFULLY! ======\n');
  mongoose.connection.close();
}

runTests().catch(err => {
  console.error('Test encountered an error:', err);
  mongoose.connection.close();
});
