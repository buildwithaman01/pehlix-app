import mongoose from 'mongoose';
import VisitService from './visit.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import WhatsAppLinkService from '../../utils/whatsappLink.js';

export const VisitController = {
  /**
   * Creates a new visit and its invoice.
   * Returns 201 with { visit, invoice }.
   */
  async createVisit(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user token context', {}, 403);
      }

      const result = await VisitService.createVisit(labId, req.body, req.user.userId);

      const Lab = mongoose.model('Lab');
      const Patient = mongoose.model('Patient');
      const TestMaster = mongoose.model('TestMaster');

      const lab = await Lab.findById(labId);
      const isWaMe = !lab?.planConfig?.features?.communicationMode || lab.planConfig.features.communicationMode === 'waMe';

      if (isWaMe) {
        const patient = await Patient.findById(result.visit.patientId);
        if (patient) {
          const tests = await TestMaster.find({ _id: { $in: result.visit.tests } });
          const visitObj = {
            ...result.visit.toObject(),
            tests
          };
          const bookingLink = WhatsAppLinkService.generateBookingConfirmation(patient, lab, visitObj, result.invoice);
          result.bookingLink = bookingLink;
        }
      }

      return sendSuccess(res, result, 'Visit registered successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves paginated list of visits, optionally filtered by status.
   */
  async getVisits(req, res, next) {
    try {
      const labId = req.user.labId;
      const status = req.query.status;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const cursor = req.query.cursor || null;

      const filters = {};
      if (status) {
        filters.status = status;
      }

      const result = await VisitService.getVisits(labId, filters, page, limit, cursor);
      return sendSuccess(res, result, 'Visits retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves a specific visit by ID.
   */
  async getVisitById(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;

      const visit = await VisitService.getVisitById(labId, id);
      return sendSuccess(res, visit, 'Visit retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Updates status of a specific visit.
   */
  async updateVisitStatus(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return sendError(res, 'VALIDATION_FAILED', 'Status is required', {}, 400);
      }

      const visit = await VisitService.updateVisitStatus(labId, id, status);
      return sendSuccess(res, visit, 'Visit status updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Adds test(s) to a visit and recalculates invoice.
   */
  async addTests(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;
      const { tests } = req.body;

      if (!tests || !Array.isArray(tests) || tests.length === 0) {
        return sendError(res, 'VALIDATION_FAILED', 'Tests array must contain at least one test ID', {}, 400);
      }

      const result = await VisitService.addTests(labId, id, tests, req.user.userId);
      return sendSuccess(res, result, 'Tests added and invoice updated successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default VisitController;
