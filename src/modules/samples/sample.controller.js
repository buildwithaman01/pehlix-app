import mongoose from 'mongoose';
import { config } from '../../config/index.js';
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
      const { status, notes, storageLocation } = req.body;
      const labId = req.user.labId;
      const userId = req.user.userId || req.user._id;

      const updatedSample = await SampleService.updateSampleStatus(labId, id, status, userId, notes, storageLocation);

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
      const userId = req.user.userId || req.user._id;

      const sample = await SampleService.rejectSample(labId, id, rejectionReason, userId);

      // Queue QStash job (rejection alert WhatsApp template)
      const patientPhone = sample.patientId ? sample.patientId.phone : null;
      const patientName = sample.patientId ? `${sample.patientId.firstName} ${sample.patientId.lastName || ''}`.trim() : 'Patient';

      const lab = await mongoose.model('Lab').findById(labId);
      const labName = lab?.name || 'Pehlix Lab';
      const rescheduleLink = `${config.NEXT_PUBLIC_APP_URL}/bookings/reschedule?visit=${sample.visitId ? (sample.visitId.visitCode || sample.visitId._id) : ''}`;

      const variables = {
        patientName,
        rejectionReason: sample.rejectionReason,
        labName,
        rescheduleLink,
        labId: labId.toString()
      };

      if (patientPhone) {
        await qstashService.enqueueNotification('sample_rejected', variables, patientPhone);
      }

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
  },

  /**
   * Retrieve chain of custody events for a sample
   */
  async getSampleChain(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      const SampleModel = mongoose.model('Sample');
      const sample = await SampleModel.findOne({ _id: id, labId, isDeleted: { $ne: true } })
        .populate('chainOfCustody.performedBy', 'name role');

      if (!sample) {
        throw new AppError('Sample not found', 'VISIT_NOT_FOUND', 404);
      }

      return sendSuccess(res, sample.chainOfCustody, 'Chain of custody retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default SampleController;
