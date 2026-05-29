import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/utils/db.js';
import Report from '../src/modules/reports/report.model.js';
import Patient from '../src/modules/patients/patient.model.js';
import Lab from '../src/modules/staff/lab.model.js';
import Visit from '../src/modules/visits/visit.model.js';
import Result from '../src/modules/results/result.model.js';
import TestMaster from '../src/modules/staff/testMaster.model.js';
import User from '../src/modules/staff/user.model.js';
import { ReportController } from '../src/modules/reports/report.controller.js';
import { AppError } from '../src/utils/errors.js';

dotenv.config();

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
  return res;
}

async function runCaptchaTests() {
  console.log('\n====== STARTING CAPTCHA RATE LIMIT TESTS ======\n');
  await connectDB();
  console.log('✔ Connected to MongoDB.');

  const testIp = '1.2.3.100';
  
  // Clear any existing rate limit in Redis
  const { Redis } = await import('@upstash/redis');
  const { default: config } = await import('../src/config/index.js');
  if (config.UPSTASH_REDIS_URL && config.UPSTASH_REDIS_TOKEN) {
    const redis = new Redis({
      url: config.UPSTASH_REDIS_URL,
      token: config.UPSTASH_REDIS_TOKEN
    });
    await redis.del(`rate-limit:verify-report:${testIp}`);
    console.log('✔ Cleaned up pre-existing rate limit key in Redis.');
  }

  const qrVerificationId = 'test-qr-' + Date.now();

  // Create a mock report for verification
  const report = await Report.create({
    labId: new mongoose.Types.ObjectId(),
    visitId: new mongoose.Types.ObjectId(),
    patientId: new mongoose.Types.ObjectId(),
    reportCode: 'REP-' + Date.now(),
    qrVerificationId,
    pdfUrl: 'https://test-bucket/reports/test.pdf',
    status: 'generated'
  });
  console.log('✔ Created mock report with qrVerificationId:', qrVerificationId);

  // 1. Send 10 successful requests
  console.log('\n--- TEST 1: Sending 10 successful requests ---');
  for (let i = 1; i <= 10; i++) {
    const req = {
      params: { qrVerificationId },
      headers: {
        'x-forwarded-for': testIp
      }
    };
    const res = mockResponse();
    
    // We expect verification to succeed
    await ReportController.verifyReport(req, res, (err) => {
      if (err) throw err;
    });
    console.log(`  ✔ Request ${i} succeeded.`);
  }

  // 2. The 11th request must trigger CAPTCHA_REQUIRED
  console.log('\n--- TEST 2: Sending 11th request (should trigger CAPTCHA) ---');
  const req11 = {
    params: { qrVerificationId },
    headers: {
      'x-forwarded-for': testIp
    }
  };
  const res11 = mockResponse();

  try {
    await ReportController.verifyReport(req11, res11, (err) => {
      if (err) throw err;
    });
    throw new Error('FAIL: 11th request did not trigger rate limiting!');
  } catch (error) {
    if (error instanceof AppError && error.code === 'CAPTCHA_REQUIRED') {
      console.log('✔ PASS: Rate limit triggered. Received expected error code:', error.code);
      console.log('  Message:', error.message);
    } else {
      console.error('❌ FAIL: Unexpected error:', error);
      throw error;
    }
  }

  // 3. Request with an invalid Turnstile token should fail with CAPTCHA_FAILED
  console.log('\n--- TEST 3: Sending 12th request with invalid Turnstile token ---');
  const req12 = {
    params: { qrVerificationId },
    headers: {
      'x-forwarded-for': testIp,
      'x-captcha-token': '' // empty token
    }
  };
  const res12 = mockResponse();

  try {
    await ReportController.verifyReport(req12, res12, (err) => {
      if (err) throw err;
    });
    throw new Error('FAIL: Request with empty token should have failed!');
  } catch (error) {
    if (error instanceof AppError && error.code === 'CAPTCHA_REQUIRED') {
      console.log('✔ PASS: Empty token rejected and kept CAPTCHA_REQUIRED state');
    } else {
      console.error('❌ FAIL: Unexpected error:', error);
      throw error;
    }
  }

  // 4. Request with valid Turnstile token should succeed and reset rate limits
  console.log('\n--- TEST 4: Sending request with mock valid Turnstile token ---');
  const req13 = {
    params: { qrVerificationId },
    headers: {
      'x-forwarded-for': testIp,
      'x-captcha-token': '1x00000000000000000000AA' // Cloudflare Turnstile "Always passes" test key
    }
  };
  const res13 = mockResponse();

  try {
    await ReportController.verifyReport(req13, res13, (err) => {
      if (err) throw err;
    });
    console.log('✔ PASS: Request with valid token succeeded.');
  } catch (error) {
    console.error('❌ FAIL: Request with valid token failed:', error);
    throw error;
  }

  // 5. Subsequent request should succeed without CAPTCHA because rate limit was reset
  console.log('\n--- TEST 5: Verify subsequent request succeeds without CAPTCHA ---');
  const req14 = {
    params: { qrVerificationId },
    headers: {
      'x-forwarded-for': testIp
    }
  };
  const res14 = mockResponse();

  try {
    await ReportController.verifyReport(req14, res14, (err) => {
      if (err) throw err;
    });
    console.log('✔ PASS: Subsequent request succeeded without CAPTCHA.');
  } catch (error) {
    console.error('❌ FAIL: Subsequent request failed:', error);
    throw error;
  }

  // Cleanup test report
  await Report.deleteOne({ _id: report._id });
  console.log('\n✔ Cleaned up mock report.');

  console.log('\n====== ALL CAPTCHA RATE LIMIT TESTS PASSED SUCCESSFULLY! ======\n');
  mongoose.connection.close();
}

runCaptchaTests().catch(err => {
  console.error('❌ Captcha rate limit test failed:', err);
  mongoose.connection.close();
  process.exit(1);
});
