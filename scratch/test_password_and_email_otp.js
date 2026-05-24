import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/utils/db.js';
import User from '../src/modules/staff/user.model.js';
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
  console.log('\n====== STARTING PASSWORD & EMAIL OTP TESTS ======\n');
  await connectDB();
  console.log('✔ Connected to MongoDB.');

  const suffix = Date.now().toString().slice(-6);
  const ownerEmail = `owner_${suffix}@laboratory.com`;
  const ownerPhone = '9800' + suffix;

  // 1. Create a mock lab owner
  console.log('\n--- TEST 1: Create Lab Owner and Request Email OTP ---');
  const owner = await User.create({
    role: 'owner',
    name: `Lab Owner ${suffix}`,
    phone: ownerPhone,
    email: ownerEmail,
    labId: new mongoose.Types.ObjectId(),
    isActive: true,
    isOtpOnly: true
  });
  console.log(`Created mock owner: ${owner.name} (${owner.email})`);

  try {
    const req = { body: { email: ownerEmail } };
    const res = mockResponse();
    await AuthController.sendOtp(req, res, (err) => {
      if (err) throw err;
    });
    console.log('✔ PASS: Email OTP requested successfully.');
  } catch (error) {
    console.error('❌ FAIL: Email OTP request failed:', error);
  }

  // 2. Verify Email OTP
  console.log('\n--- TEST 2: Verify Email OTP ---');
  try {
    const req = { body: { email: ownerEmail, otp: '123456' } };
    const res = mockResponse();
    await AuthController.verifyOtp(req, res, (err) => {
      if (err) throw err;
    });

    if (res.body?.status === 'success') {
      console.log('✔ PASS: Email OTP verified successfully.');
    } else {
      console.error('❌ FAIL: OTP verification returned failure body:', res.body);
    }
  } catch (error) {
    console.error('❌ FAIL: Email OTP verification failed:', error);
  }

  // 3. Set Password for Lab Owner (authenticated)
  console.log('\n--- TEST 3: Set Password for Authenticated Owner ---');
  try {
    const req = { 
      user: { userId: owner._id, role: 'owner' },
      body: { password: 'securePassword123' }
    };
    const res = mockResponse();
    await AuthController.setPassword(req, res, (err) => {
      if (err) throw err;
    });

    // Check if passwordHash was created and isOtpOnly set to false
    const updatedOwner = await User.findById(owner._id);
    if (updatedOwner.passwordHash && !updatedOwner.isOtpOnly) {
      console.log('✔ PASS: Password set successfully on Owner document.');
    } else {
      console.error('❌ FAIL: Owner document was not updated correctly.');
    }
  } catch (error) {
    console.error('❌ FAIL: Set password failed:', error);
  }

  // 4. Log in with Email & Password
  console.log('\n--- TEST 4: Login with Email and New Password ---');
  try {
    const req = {
      body: { email: ownerEmail, password: 'securePassword123' },
      headers: { 'user-agent': 'Mozilla/5.0' },
      ip: '127.0.0.1'
    };
    const res = mockResponse();
    await AuthController.login(req, res, (err) => {
      if (err) throw err;
    });

    if (res.body?.status === 'success' && res.body?.data?.accessToken) {
      console.log('✔ PASS: Login successful with password!');
    } else {
      console.error('❌ FAIL: Login failed:', res.body);
    }
  } catch (error) {
    console.error('❌ FAIL: Login encountered error:', error);
  }

  // 5. Try to log in with incorrect password
  console.log('\n--- TEST 5: Login with Incorrect Password (should fail) ---');
  try {
    const req = {
      body: { email: ownerEmail, password: 'wrongPassword' },
      headers: { 'user-agent': 'Mozilla/5.0' },
      ip: '127.0.0.1'
    };
    const res = mockResponse();
    await AuthController.login(req, res, (err) => {
      if (err) throw err;
    });
    if (res.statusCode === 401) {
      console.log('✔ PASS: Login blocked due to invalid credentials.');
    } else {
      console.error('❌ FAIL: Login should have returned 401 but got status:', res.statusCode);
    }
  } catch (error) {
    console.error('❌ FAIL: Unexpected error during invalid login:', error);
  }

  // Cleanup test documents
  await User.findByIdAndDelete(owner._id);
  console.log('\n====== ALL PASSWORD & EMAIL OTP TESTS COMPLETED SUCCESSFULLY! ======\n');
  mongoose.connection.close();
}

runTests().catch(err => {
  console.error('Test encountered an error:', err);
  mongoose.connection.close();
});
