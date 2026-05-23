import mongoose from 'mongoose';
import { sendError } from '../utils/response.js';

let Lab;
try {
  const labModule = await import('../modules/staff/lab.model.js');
  Lab = labModule.Lab || labModule.default;
} catch (error) {
  const labSchema = new mongoose.Schema({
    labId: mongoose.Schema.Types.ObjectId,
    isActive: Boolean,
    isSuspended: Boolean,
    planConfig: mongoose.Schema.Types.Mixed
  });
  Lab = mongoose.models.Lab || mongoose.model('Lab', labSchema);
}

/**
 * Middleware to verify that the tenant (Lab) exists, is active, and is not suspended.
 * Attaches the lab configuration to the request object.
 */
export async function verifyTenant(req, res, next) {
  try {
    const labId = req.user?.labId;
    if (!labId) {
      return sendError(res, 'TENANT_NOT_FOUND', 'Tenant ID is missing from user context', {}, 404);
    }

    const lab = await Lab.findById(labId);
    if (!lab) {
      return sendError(res, 'TENANT_NOT_FOUND', 'Tenant not found', {}, 404);
    }

    if (lab.isSuspended) {
      return sendError(res, 'TENANT_SUSPENDED', 'Tenant account is suspended', {}, 403);
    }

    if (!lab.isActive) {
      return sendError(res, 'TENANT_NOT_FOUND', 'Tenant is inactive', {}, 404);
    }

    if (lab.registrationState === 'sandbox' && lab.tempTrialExpiry && new Date() > new Date(lab.tempTrialExpiry)) {
      return sendError(res, 'TRIAL_EXPIRED', 'Your temporary unverified trial has expired. Please contact support or the administrator to extend your trial.', {}, 403);
    }

    req.planConfig = lab.planConfig;
    req.lab = lab;
    next();
  } catch (error) {
    console.error('Tenant verification error:', error);
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Tenant verification failed', {}, 500);
  }
}
