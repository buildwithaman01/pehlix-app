import PublicService from './public.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const PublicController = {
  /**
   * Get Lab profile and catalog for public booking page
   */
  async getLabBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const data = await PublicService.getLabBySlug(slug);
      
      if (!data) {
        return sendError(res, 'LAB_NOT_FOUND', 'Lab not found or is currently suspended', {}, 404);
      }

      if (!data.lab.planConfig?.modules?.publicBooking) {
        return sendError(res, 'FEATURE_DISABLED', 'Online booking is currently not available for this lab', {}, 403);
      }

      return sendSuccess(res, data, 'Lab details fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a booking directly from public page
   */
  async createBooking(req, res, next) {
    try {
      const { labId, patientData, collectionType, tests } = req.body;
      
      if (!labId || !patientData || !patientData.phone || !tests || tests.length === 0) {
        return sendError(res, 'VALIDATION_FAILED', 'Missing required booking details', {}, 400);
      }

      const mongoose = (await import('mongoose')).default;
      const Lab = mongoose.model('Lab');
      const lab = await Lab.findById(labId).select('planConfig.modules.publicBooking');
      
      if (!lab || !lab.planConfig?.modules?.publicBooking) {
        return sendError(res, 'FEATURE_DISABLED', 'Online booking is disabled for this lab', {}, 403);
      }

      // We bypass OTP in this MVP phase for frictionless UX
      const result = await PublicService.createBooking(req.body);
      
      return sendSuccess(res, result, 'Booking created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
};
