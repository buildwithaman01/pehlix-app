import Lab from './lab.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';

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
        razorpayKeySecret
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
