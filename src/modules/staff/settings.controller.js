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
        showWhatsAppOnResultEntry,
        // FIX-D-001: expose gstRate so lab owners can configure their billing tax rate
        gstRate
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
      // FIX-D-001: persist gstRate (0 = exempt, 18 = standard GST) — validated to 0–28 range
      if (gstRate !== undefined) {
        const rate = Number(gstRate);
        if (isNaN(rate) || rate < 0 || rate > 28) {
          return sendError(res, 'VALIDATION_FAILED', 'gstRate must be a number between 0 and 28', {}, 400);
        }
        lab.planConfig.features.gstRate = rate;
      }

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
  /**
   * GET /api/settings/onboarding-status
   * Returns completion status of 7 key lab setup steps.
   * Used by the OnboardingChecklist dashboard widget.
   */
  async getOnboardingStatus(req, res, next) {
    try {
      const labId = req.user.labId;
      const lab = await Lab.findById(labId).select('name logo address nablNumber gstNumber reportHeader planConfig registrationState');
      if (!lab) return sendError(res, 'LAB_NOT_FOUND', 'Lab not found', {}, 404);

      // Dynamic imports to avoid circular dependencies
      const { default: User } = await import('./user.model.js');
      const { default: Patient } = await import('../patients/patient.model.js');
      const { default: Doctor } = await import('../doctors/doctor.model.js');

      const [staffCount, patientCount, doctorCount] = await Promise.all([
        User.countDocuments({ labId, isActive: true, isDeleted: { $ne: true } }),
        Patient.countDocuments({ labId, isDeleted: { $ne: true } }),
        Doctor.countDocuments({ labId, isActive: true })
      ]);

      const steps = [
        {
          id: 'account_created',
          label: 'Account Created',
          done: true,
          link: null
        },
        {
          id: 'add_staff',
          label: 'Add your first staff member',
          done: staffCount > 1, // >1 because owner counts as 1
          link: '/staff'
        },
        {
          id: 'configure_settings',
          label: 'Complete lab profile (name, address, phone)',
          done: !!(lab.address?.city && lab.address?.state && lab.phone),
          link: '/settings'
        },
        {
          id: 'add_logo',
          label: 'Upload lab logo for reports',
          done: !!lab.logo,
          link: '/settings'
        },
        {
          id: 'first_patient',
          label: 'Register your first patient',
          done: patientCount > 0,
          link: '/patients'
        },
        {
          id: 'add_doctor',
          label: 'Add a referring doctor (optional)',
          done: doctorCount > 0,
          link: '/doctors'
        },
        {
          id: 'report_letterhead',
          label: 'Configure report letterhead & footer',
          done: !!(lab.reportHeader || lab.reportFooter),
          link: '/settings'
        }
      ];

      const completedCount = steps.filter(s => s.done).length;
      const isFullyOnboarded = completedCount === steps.length;
      const registrationState = lab.registrationState || 'sandbox';

      return sendSuccess(res, {
        steps,
        completedCount,
        totalSteps: steps.length,
        percentComplete: Math.round((completedCount / steps.length) * 100),
        isFullyOnboarded,
        registrationState
      }, 'Onboarding status retrieved');
    } catch (error) {
      next(error);
    }
  }
};

export default SettingsController;
