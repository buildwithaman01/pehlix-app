import AnalyticsService from './analytics.service.js';
import { sendSuccess } from '../../utils/response.js';

export const AnalyticsController = {
  async getDashboard(req, res, next) {
    try {
      const labId = req.user.labId;
      const summary = await AnalyticsService.getDashboardSummary(labId);
      return sendSuccess(res, summary, 'Dashboard summary retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getRevenue(req, res, next) {
    try {
      const labId = req.user.labId;
      const period = req.query.period || '30days';
      const revenueData = await AnalyticsService.getRevenueAnalytics(labId, period);
      return sendSuccess(res, revenueData, 'Revenue analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getTests(req, res, next) {
    try {
      const labId = req.user.labId;
      const period = req.query.period || '30days';
      const testData = await AnalyticsService.getTestAnalytics(labId, period);
      return sendSuccess(res, testData, 'Test analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getDoctors(req, res, next) {
    try {
      const labId = req.user.labId;
      const period = req.query.period || '30days';
      const doctorData = await AnalyticsService.getDoctorAnalytics(labId, period);
      return sendSuccess(res, doctorData, 'Doctor analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getPatients(req, res, next) {
    try {
      const labId = req.user.labId;
      const period = req.query.period || '30days';
      const patientData = await AnalyticsService.getPatientAnalytics(labId, period);
      return sendSuccess(res, patientData, 'Patient analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getOperations(req, res, next) {
    try {
      const labId = req.user.labId;
      const period = req.query.period || '30days';
      const operationsData = await AnalyticsService.getOperationsAnalytics(labId, period);
      return sendSuccess(res, operationsData, 'Operations analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getHealthScore(req, res, next) {
    try {
      const labId = req.user.labId;
      const score = await AnalyticsService.calculateHealthScore(labId);
      return sendSuccess(res, score, 'Lab health score retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getPendingPayments(req, res, next) {
    try {
      const labId = req.user.labId;
      const pendingData = await AnalyticsService.getPendingPaymentsBreakdown(labId);
      return sendSuccess(res, pendingData, 'Pending payments breakdown retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default AnalyticsController;
