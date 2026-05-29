import Lab from './lab.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import qstashService from '../../utils/qstash.js';
import { config } from '../../config/index.js';
import WhatsAppOutboxService from '../whatsappOutbox/whatsappOutbox.service.js';

export const SettingsController = {
  /**
   * Get the current lab settings.
   */
  async getSettings(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const lab = await Lab.findById(labId);
      if (!lab) {
        return sendError(res, 'LAB_NOT_FOUND', 'Lab configuration not found', {}, 404);
      }

      const labObj = lab.toObject();
      if (labObj.razorpayKeySecret) {
        labObj.razorpayKeySecret = '********';
      }

      return sendSuccess(res, labObj, 'Lab settings retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update current lab settings.
   */
  async updateSettings(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const {
        name,
        phone,
        email,
        address,
        logo,
        reportHeader,
        reportFooter,
        nablNumber,
        gstNumber,
        razorpayKeyId,
        razorpayKeySecret,
        communicationMode,
        paymentCheckMode,
        showWhatsAppOnResultEntry
      } = req.body;

      const lab = await Lab.findById(labId);
      if (!lab) {
        return sendError(res, 'LAB_NOT_FOUND', 'Lab configuration not found', {}, 404);
      }

      if (name) lab.name = name;
      if (phone) lab.phone = phone;
      if (email) lab.email = email;
      if (address) lab.address = address;
      if (logo !== undefined) lab.logo = logo;
      if (reportHeader !== undefined) lab.reportHeader = reportHeader;
      if (reportFooter !== undefined) lab.reportFooter = reportFooter;
      if (nablNumber !== undefined) lab.nablNumber = nablNumber;
      if (gstNumber !== undefined) lab.gstNumber = gstNumber;
      if (razorpayKeyId !== undefined) lab.razorpayKeyId = razorpayKeyId;
      
      if (razorpayKeySecret !== undefined && razorpayKeySecret !== '********') {
        lab.razorpayKeySecret = razorpayKeySecret;
      }

      // Save planConfig features configuration (GAP 10)
      if (!lab.planConfig) {
        lab.planConfig = {};
      }
      if (!lab.planConfig.features) {
        lab.planConfig.features = {};
      }

      // Check transition from waMe to metaApi
      if (communicationMode !== undefined && communicationMode !== lab.planConfig?.features?.communicationMode) {
        const oldMode = lab.planConfig?.features?.communicationMode || 'waMe';
        if (oldMode === 'waMe' && communicationMode === 'metaApi') {
          try {
            await qstashService.enqueue(`${config.NEXT_PUBLIC_APP_URL}/api/internal/whatsapp-outbox/process-meta`, {
              labId: labId.toString()
            });
            console.log(`[SettingsController] Scheduled outbox Meta transition job for lab ${labId}`);
          } catch (qstashErr) {
            console.error('[SettingsController] Failed to queue transition job via QStash, falling back to inline background trigger:', qstashErr.message);
            WhatsAppOutboxService.processOutboxToMeta(labId).catch(console.error);
          }
        }
      }

      if (communicationMode !== undefined) lab.planConfig.features.communicationMode = communicationMode;
      if (paymentCheckMode !== undefined) lab.planConfig.features.paymentCheckMode = paymentCheckMode;
      if (showWhatsAppOnResultEntry !== undefined) lab.planConfig.features.showWhatsAppOnResultEntry = showWhatsAppOnResultEntry;

      lab.markModified('planConfig');
      await lab.save();

      const labObj = lab.toObject();
      if (labObj.razorpayKeySecret) {
        labObj.razorpayKeySecret = '********';
      }

      return sendSuccess(res, labObj, 'Lab settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default SettingsController;
