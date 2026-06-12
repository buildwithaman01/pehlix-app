import mongoose from 'mongoose';
import { connectDB, closeDB, clearDB } from '../../../test-utils/db.js';
import DoctorService from '../doctor.service.js';
import Doctor from '../doctor.model.js';
import Visit from '../../visits/visit.model.js';
import Commission from '../commission.model.js';

beforeAll(async () => {
  await connectDB();
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await closeDB();
});

describe('DoctorService.calculateAndRecordCommission', () => {
  const labId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();
  const invoiceId = new mongoose.Types.ObjectId();

  it('should calculate and record percentage commission correctly', async () => {
    // 1. Setup Data
    const doctor = await Doctor.create({
      labId,
      name: 'Dr. Test Percentage',
      phone: '9876543210',
      commissionType: 'percentage',
      commissionValue: 20 // 20%
    });

    const visit = await Visit.create({
      labId,
      patientId,
      referredBy: doctor._id,
      visitDate: new Date(),
      status: 'registered',
      visitCode: 'V-001'
    });

    // 2. Execute Method (1000 paid amount)
    const commission = await DoctorService.calculateAndRecordCommission(
      labId,
      visit._id,
      invoiceId,
      1000
    );

    // 3. Assertions
    expect(commission).toBeDefined();
    expect(commission.commissionAmount).toBe(200); // 20% of 1000
    expect(commission.status).toBe('pending');
    expect(commission.doctorId.toString()).toBe(doctor._id.toString());
  });

  it('should calculate and record flat commission correctly', async () => {
    const doctor = await Doctor.create({
      labId,
      name: 'Dr. Test Flat',
      phone: '9876543211',
      commissionType: 'flat',
      commissionValue: 150 // Fixed ₹150
    });

    const visit = await Visit.create({
      labId,
      patientId,
      referredBy: doctor._id,
      visitDate: new Date(),
      status: 'registered',
      visitCode: 'V-002'
    });

    const commission = await DoctorService.calculateAndRecordCommission(
      labId,
      visit._id,
      invoiceId,
      500
    );

    expect(commission.commissionAmount).toBe(150);
  });

  it('should return null if commissionType is none', async () => {
    const doctor = await Doctor.create({
      labId,
      name: 'Dr. No Commission',
      phone: '9876543212',
      commissionType: 'none',
      commissionValue: 0
    });

    const visit = await Visit.create({
      labId,
      patientId,
      referredBy: doctor._id,
      visitDate: new Date(),
      status: 'registered',
      visitCode: 'V-003'
    });

    const commission = await DoctorService.calculateAndRecordCommission(
      labId,
      visit._id,
      invoiceId,
      1000
    );

    expect(commission).toBeNull();
  });

  it('should not create duplicate commissions (Idempotency)', async () => {
    const doctor = await Doctor.create({
      labId,
      name: 'Dr. Idempotent',
      phone: '9876543213',
      commissionType: 'flat',
      commissionValue: 100
    });

    const visit = await Visit.create({
      labId,
      patientId,
      referredBy: doctor._id,
      visitDate: new Date(),
      status: 'registered',
      visitCode: 'V-004'
    });

    // First call
    const firstCommission = await DoctorService.calculateAndRecordCommission(
      labId,
      visit._id,
      invoiceId,
      1000
    );

    // Second call with same visitId
    const secondCommission = await DoctorService.calculateAndRecordCommission(
      labId,
      visit._id,
      invoiceId,
      1000
    );

    // Should return the same commission record, not create a new one
    expect(firstCommission._id.toString()).toBe(secondCommission._id.toString());
    
    // DB count should be exactly 1
    const count = await Commission.countDocuments({ visitId: visit._id });
    expect(count).toBe(1);
  });
});
