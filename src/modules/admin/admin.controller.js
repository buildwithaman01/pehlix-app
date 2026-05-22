import AdminService from './admin.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const AdminController = {
  /**
   * Get all labs - platform-wide
   */
  async getAllLabs(req, res, next) {
    try {
      const { plan, status, city, healthScoreBelow, page, limit } = req.query;
      const filters = {
        plan,
        status,
        city,
        healthScoreBelow: healthScoreBelow !== undefined ? Number(healthScoreBelow) : undefined
      };
      const result = await AdminService.getAllLabs(filters, page, limit);
      return sendSuccess(res, result, 'Labs fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get lab by ID
   */
  async getLabById(req, res, next) {
    try {
      const result = await AdminService.getLabById(req.params.id);
      if (!result) {
        return sendError(res, 'TENANT_NOT_FOUND', 'Lab not found', {}, 404);
      }
      return sendSuccess(res, result, 'Lab details fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update lab configuration changes on planConfig
   */
  async updateLabConfig(req, res, next) {
    try {
      const configChanges = req.body;
      if (!configChanges || Object.keys(configChanges).length === 0) {
        return sendError(res, 'VALIDATION_FAILED', 'At least one configuration change field is required', {}, 400);
      }
      const result = await AdminService.updateLabConfig(req.params.id, configChanges, req.user.userId);
      return sendSuccess(res, result, 'Lab configuration updated. Changes take effect immediately.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Suspend a lab
   */
  async suspendLab(req, res, next) {
    try {
      const { reason } = req.body;
      if (!reason || reason.trim().length < 10) {
        return sendError(res, 'VALIDATION_FAILED', 'Suspension reason is required and must be at least 10 characters long', {}, 400);
      }
      const result = await AdminService.suspendLab(req.params.id, reason, req.user.userId);
      return sendSuccess(res, result, 'Lab suspended successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Restore a suspended lab
   */
  async restoreLab(req, res, next) {
    try {
      const result = await AdminService.restoreLab(req.params.id, req.user.userId);
      return sendSuccess(res, result, 'Lab restored successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create impersonation token
   */
  async impersonateLab(req, res, next) {
    try {
      const { userId, reason } = req.body;
      if (!userId) {
        return sendError(res, 'VALIDATION_FAILED', 'User ID to impersonate is required', {}, 400);
      }
      if (!reason || reason.trim() === '') {
        return sendError(res, 'VALIDATION_FAILED', 'Impersonation reason is required', {}, 400);
      }
      const result = await AdminService.createImpersonationToken(req.params.id, userId, req.user.userId, reason);
      return sendSuccess(res, result, 'Impersonation token generated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Override billing config for a lab
   */
  async overrideBilling(req, res, next) {
    try {
      const result = await AdminService.overrideBilling(req.params.id, req.body, req.user.userId);
      return sendSuccess(res, result, 'Billing override updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get platform metrics
   */
  async getPlatformMetrics(req, res, next) {
    try {
      const result = await AdminService.getPlatformMetrics();
      return sendSuccess(res, result, 'Platform metrics fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get platform expected subscription revenue
   */
  async getPlatformRevenue(req, res, next) {
    try {
      const { period } = req.query;
      const result = await AdminService.getPlatformRevenue(period);
      return sendSuccess(res, result, 'Platform revenue fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get lab audit log
   */
  async getLabAuditLog(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await AdminService.getLabAuditLog(req.params.id, page, limit);
      return sendSuccess(res, result, 'Lab audit logs fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get DLQ (failed PDF generation jobs)
   */
  async getDeadLetterQueue(req, res, next) {
    try {
      const result = await AdminService.getDeadLetterQueue();
      return sendSuccess(res, result, 'Dead letter queue fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retry a DLQ job
   */
  async retryDeadLetterJob(req, res, next) {
    try {
      const { reportId } = req.params;
      const result = await AdminService.retryDeadLetterJob(reportId, req.user.userId);
      return sendSuccess(res, result, 'Dead letter queue job retried successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get feature flags
   */
  async getFeatureFlags(req, res, next) {
    try {
      const result = await AdminService.getFeatureFlags();
      return sendSuccess(res, result, 'Feature flags fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update feature flag
   */
  async updateFeatureFlag(req, res, next) {
    try {
      const { name } = req.params;
      const result = await AdminService.updateFeatureFlag(name, req.body, req.user.userId);
      return sendSuccess(res, result, 'Feature flag updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send platform announcement
   */
  async sendAnnouncement(req, res, next) {
    try {
      const { target, channel, message, scheduledAt } = req.body;
      if (!target || typeof target !== 'object') {
        return sendError(res, 'VALIDATION_FAILED', 'Target object is required', {}, 400);
      }
      if (!channel || !Array.isArray(channel) || channel.length === 0) {
        return sendError(res, 'VALIDATION_FAILED', 'Channel array is required and must not be empty', {}, 400);
      }
      if (!message || message.trim() === '') {
        return sendError(res, 'VALIDATION_FAILED', 'Announcement message is required', {}, 400);
      }
      const result = await AdminService.sendAnnouncement(target, channel, message, scheduledAt, req.user.userId);
      return sendSuccess(res, result, 'Announcement sent successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default AdminController;
