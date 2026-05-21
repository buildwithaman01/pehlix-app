import ResultService from './result.service.js';
import Result from './result.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';

export const ResultController = {
  /**
   * Submit results. Handles critical value warnings before saving.
   */
  async submitResult(req, res, next) {
    try {
      const labId = req.user.labId;
      const enteredBy = req.user._id;

      const { result, isCritical, flaggedParameters } = await ResultService.submitResult(labId, req.body, enteredBy);

      if (isCritical) {
        return sendSuccess(
          res,
          {
            result,
            isCritical: true,
            flaggedParameters,
            requiresConfirmation: true
          },
          'Critical values detected — technician confirmation required before saving'
        );
      }

      return sendSuccess(res, result, 'Result submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Flag critical value confirmed by technician and trigger alerts.
   */
  async flagCritical(req, res, next) {
    try {
      const { id } = req.params;
      const { confirmed } = req.body;
      const labId = req.user.labId;

      if (!confirmed) {
        throw new AppError('Confirmation must be true to trigger critical alerts', 'VALIDATION_FAILED', 400);
      }

      const result = await Result.findOne({ _id: id, labId });
      if (!result) {
        throw new AppError('Result not found', 'REPORT_NOT_FOUND', 404);
      }

      const alertResult = await ResultService.triggerCriticalAlert(labId, result._id, result.visitId);

      return sendSuccess(res, alertResult, 'Critical alert sent to referring doctor');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update result parameters and re-evaluate limits/formulas.
   */
  async updateResult(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;
      const enteredBy = req.user._id;

      const updated = await ResultService.updateResult(labId, id, req.body, enteredBy);

      return sendSuccess(res, updated, 'Result updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Pathologist approval queue list
   */
  async getApprovalQueue(req, res, next) {
    try {
      const labId = req.user.labId;
      const queue = await ResultService.getApprovalQueue(labId);

      return sendSuccess(res, queue, 'Approval queue retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Pathologist result approval
   */
  async approveResult(req, res, next) {
    try {
      const { id } = req.params;
      const { pathologistNote } = req.body;
      const labId = req.user.labId;
      const pathologistId = req.user._id;

      const approvalResult = await ResultService.approveResult(labId, id, pathologistId, pathologistNote);

      return sendSuccess(res, approvalResult, 'Report approved. PDF generation queued.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Pathologist result rejection
   */
  async rejectResult(req, res, next) {
    try {
      const { id } = req.params;
      const { rejectionNote } = req.body;
      const labId = req.user.labId;
      const pathologistId = req.user._id;

      if (!rejectionNote || rejectionNote.trim().length < 10) {
        throw new AppError('Rejection note is required and must be at least 10 characters', 'VALIDATION_FAILED', 400);
      }

      const rejectionResult = await ResultService.rejectResult(labId, id, pathologistId, rejectionNote);

      return sendSuccess(res, rejectionResult, 'Result rejected and sent back to technician');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Doctor critical value acknowledgement (PUBLIC route)
   */
  async acknowledgeAlert(req, res, next) {
    try {
      const { alertId } = req.params;
      const { resultId } = req.query;

      if (!resultId) {
        throw new AppError('Result ID is required as a query parameter', 'VALIDATION_FAILED', 400);
      }

      const result = await ResultService.acknowledgeAlert(resultId, alertId);

      // Find result doctor name for custom message
      const populated = await Result.findById(resultId).populate({
        path: 'visitId',
        populate: { path: 'referredBy' }
      });
      const doctorName = populated?.visitId?.referredBy?.name || 'Doctor';

      return sendSuccess(res, result, `Critical value acknowledged. Thank you Dr. ${doctorName}.`);
    } catch (error) {
      next(error);
    }
  }
};

export default ResultController;
