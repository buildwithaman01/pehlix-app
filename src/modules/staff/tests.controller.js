import LabTest from './labTest.model.js';
import TestMaster from './testMaster.model.js';
import Package from './package.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuditLog } from '../../middleware/audit.middleware.js';

export const TestsController = {
  /**
   * List and search lab-specific tests (imported into LabTest).
   */
  async getTests(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const { search, page = 1, limit = 50, isActive } = req.query;
      const query = { labId };

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      if (search) {
        // Find matching test master records first
        const masters = await TestMaster.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } }
          ]
        });
        const masterIds = masters.map(m => m._id);
        query.$or = [
          { testId: { $in: masterIds } },
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } }
        ];
      }

      const total = await LabTest.countDocuments(query);
      const tests = await LabTest.find(query)
        .populate('testId')
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));

      return sendSuccess(res, { tests, total, page: parseInt(page), limit: parseInt(limit) }, 'Lab tests retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Search global TestMaster catalog.
   */
  async getMasterCatalog(req, res, next) {
    try {
      const { search, page = 1, limit = 50 } = req.query;
      
      // Exclude custom tests from other labs (only return global tests or own custom tests)
      const labId = req.user.labId;
      const query = { 
        isActive: true,
        $or: [
          { isCustom: { $ne: true } },
          { labId }
        ]
      };

      if (search) {
        query.$and = [
          {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { code: { $regex: search, $options: 'i' } }
            ]
          }
        ];
      }

      const total = await TestMaster.countDocuments(query);
      const masters = await TestMaster.find(query)
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));

      return sendSuccess(res, { masters, total, page: parseInt(page), limit: parseInt(limit) }, 'Global master catalog retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Import a test from TestMaster catalog.
   */
  async importTest(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const { testId, price, customTurnaroundTime } = req.body;
      if (!testId) {
        return sendError(res, 'VALIDATION_FAILED', 'testId is required', {}, 400);
      }

      const master = await TestMaster.findById(testId);
      if (!master) {
        return sendError(res, 'MASTER_TEST_NOT_FOUND', 'Master test not found', {}, 404);
      }

      const existing = await LabTest.findOne({ labId, testId });
      if (existing) {
        return sendError(res, 'DUPLICATE_TEST', 'This test has already been imported in your lab catalog', {}, 400);
      }

      const newTest = await LabTest.create({
        labId,
        testId,
        name: master.name,
        code: master.code.split('-')[0], // User-friendly code for display
        price: price !== undefined ? price : master.basePrice,
        customTurnaroundTime: customTurnaroundTime !== undefined ? customTurnaroundTime : undefined,
        isActive: true
      });

      return sendSuccess(res, newTest, 'Test imported successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a custom test from scratch.
   */
  async createCustomTest(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const { code, name, price, customTurnaroundTime, department, sampleType, container, parameters = [] } = req.body;
      if (!code || !name || price === undefined) {
        return sendError(res, 'VALIDATION_FAILED', 'Code, name, and price are required', {}, 400);
      }

      const normalizedCode = code.trim().toUpperCase();
      const uniqueMasterCode = `${normalizedCode}-${labId}`;

      // Check if code matches any existing custom test or global test
      const existingMaster = await TestMaster.findOne({ code: uniqueMasterCode });
      if (existingMaster) {
        return sendError(res, 'DUPLICATE_TEST', `A custom test with code ${normalizedCode} already exists`, {}, 400);
      }

      // Create new private TestMaster
      const newMaster = await TestMaster.create({
        code: uniqueMasterCode,
        name: name.trim(),
        department: department || 'General',
        sampleType: sampleType || 'Whole Blood',
        container: container || 'EDTA Tube (Purple)',
        basePrice: price,
        parameters,
        labId,
        isCustom: true,
        isActive: true
      });

      // Create matching LabTest
      const newLabTest = await LabTest.create({
        labId,
        testId: newMaster._id,
        name: name.trim(),
        code: normalizedCode, // Simple clean code for display
        price,
        customTurnaroundTime,
        isActive: true
      });

      // Audit Log
      await AuditLog.create({
        labId,
        userId: req.user._id,
        role: req.user.role,
        action: 'custom_test_created',
        timestamp: new Date(),
        details: {
          testId: newMaster._id,
          code: normalizedCode,
          name: name.trim(),
          price
        }
      });

      return sendSuccess(res, newLabTest, 'Custom test created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reset lab test parameters back to master defaults.
   */
  async resetTest(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;

      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const test = await LabTest.findOne({ _id: id, labId }).populate('testId');
      if (!test) {
        return sendError(res, 'TEST_NOT_FOUND', 'Lab test not found', {}, 404);
      }

      const oldParams = test.customParameters || [];

      test.customParameters = [];
      if (test.testId) {
        test.price = test.testId.basePrice;
      }
      test.customTurnaroundTime = undefined;

      await test.save();

      // Audit Log
      await AuditLog.create({
        labId,
        userId: req.user._id,
        role: req.user.role,
        action: 'test_parameters_reset',
        timestamp: new Date(),
        details: {
          testId: test._id,
          code: test.code,
          oldParameters: oldParams
        }
      });

      return sendSuccess(res, test, 'Lab test parameters reset to global default');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update lab test details (price, turnaround, isActive, customParameters).
   */
  async updateTest(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;
      const { price, customTurnaroundTime, isActive, parameters } = req.body;

      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const test = await LabTest.findOne({ _id: id, labId });
      if (!test) {
        return sendError(res, 'TEST_NOT_FOUND', 'Lab test not found', {}, 404);
      }

      const oldPrice = test.price;
      const oldTat = test.customTurnaroundTime;
      const oldParams = test.customParameters || [];

      if (price !== undefined) test.price = price;
      if (customTurnaroundTime !== undefined) test.customTurnaroundTime = customTurnaroundTime;
      if (isActive !== undefined) test.isActive = isActive;
      if (parameters !== undefined) test.customParameters = parameters;

      await test.save();

      // Log to AuditLog if fields changed
      await AuditLog.create({
        labId,
        userId: req.user._id,
        role: req.user.role,
        action: 'test_settings_updated',
        timestamp: new Date(),
        details: {
          testId: test._id,
          code: test.code,
          changes: {
            price: price !== undefined ? { old: oldPrice, new: price } : undefined,
            customTurnaroundTime: customTurnaroundTime !== undefined ? { old: oldTat, new: customTurnaroundTime } : undefined,
            parameters: parameters !== undefined ? { old: oldParams, new: parameters } : undefined
          }
        }
      });

      return sendSuccess(res, test, 'Lab test updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single test by ID.
   */
  async getTestById(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;

      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const test = await LabTest.findOne({ _id: id, labId }).populate('testId');
      if (!test) {
        return sendError(res, 'TEST_NOT_FOUND', 'Lab test not found', {}, 404);
      }

      return sendSuccess(res, test, 'Lab test details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get packages.
   */
  async getPackages(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const packages = await Package.find({ labId, isActive: true }).populate('tests');
      return sendSuccess(res, packages, 'Lab packages retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default TestsController;
