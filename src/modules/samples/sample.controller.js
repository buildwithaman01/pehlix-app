import SampleService from './sample.service.js';
import qstashService from '../../utils/qstash.js';
import { sendSuccess } from '../../utils/response.js';

export const SampleController = {
  /**
   * Scan barcode and retrieve complete work object
   */
  async scanBarcode(req, res, next) {
    try {
      const { barcodeId } = req.body;
      const labId = req.user.labId;

      const workObject = await SampleService.scanBarcode(labId, barcodeId);

      return sendSuccess(res, workObject, 'Barcode scanned successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update sample status and custody tracking
   */
  async updateSampleStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const labId = req.user.labId;
      const userId = req.user._id;

      const updatedSample = await SampleService.updateSampleStatus(labId, id, status, userId, notes);

      return sendSuccess(res, updatedSample, `Sample status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reject a sample and trigger notification payload logging
   */
  async rejectSample(req, res, next) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const labId = req.user.labId;
      const userId = req.user._id;

      const sample = await SampleService.rejectSample(labId, id, rejectionReason, userId);

      // Queue QStash job placeholder (rejection alert WhatsApp template)
      const patientPhone = sample.patientId ? sample.patientId.phone : null;
      const patientName = sample.patientId ? `${sample.patientId.firstName} ${sample.patientId.lastName || ''}`.trim() : 'Patient';

      await qstashService.enqueueNotification({
        type: 'sample_rejected',
        templateName: 'sample_rejection_alert',
        recipientPhone: patientPhone,
        data: {
          patientName,
          rejectionReason: sample.rejectionReason,
          visitCode: sample.visitId ? sample.visitId.visitCode : null,
          labId: labId.toString()
        }
      });

      return sendSuccess(res, sample, 'Sample rejected successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieve list of pending/received samples
   */
  async getPendingSamples(req, res, next) {
    try {
      const labId = req.user.labId;
      const samples = await SampleService.getPendingSamples(labId);

      return sendSuccess(res, samples, 'Pending samples retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default SampleController;
