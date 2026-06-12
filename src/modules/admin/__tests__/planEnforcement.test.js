import mongoose from 'mongoose';
import { connectDB, closeDB, clearDB } from '../../../test-utils/db.js';
import VisitService from '../../visits/visit.service.js';
import Lab from '../../staff/lab.model.js';
import Visit from '../../visits/visit.model.js';
import User from '../../staff/user.model.js';

beforeAll(async () => {
  await connectDB();
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await closeDB();
});

describe('Plan Enforcements', () => {

  describe('Monthly Tests Limit (VisitService)', () => {
    it('should throw error when monthly tests limit is reached', async () => {
      // Setup Lab with 10 test limit
      const lab = await Lab.create({
        name: 'Limit Test Lab',
        phone: '9999999999',
        slug: 'limit-test-lab',
        planConfig: {
          limits: {
            monthlyTests: 10
          }
        }
      });

      // Simulate 10 existing tests this month
      // Mongoose models mocked or seeded directly
      for(let i=0; i<5; i++) {
         await Visit.create({
            labId: lab._id,
            patientId: new mongoose.Types.ObjectId(),
            visitCode: `V-TEST-${i}`,
            tests: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()] // 2 tests per visit
         });
      }

      // Try creating a new visit with 1 test
      await expect(
        VisitService.createVisit(lab._id, {
          tests: [{ testId: new mongoose.Types.ObjectId() }],
          patientId: new mongoose.Types.ObjectId()
        }, new mongoose.Types.ObjectId())
      ).rejects.toThrow('PLAN_LIMIT_EXCEEDED');
    });
  });

});
