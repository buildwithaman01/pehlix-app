import Sample from './sample.model.js';
import Visit from '../visits/visit.model.js';
import Patient from '../patients/patient.model.js';
import { AppError } from '../../utils/errors.js';

export const SampleService = {
  /**
   * Scans a barcode and returns the complete work object: { sample, visit, patient, tests, invoiceStatus }
   * Optimised to complete in under 200ms using lean().
   */
  async scanBarcode(labId, barcodeId) {
    const sample = await Sample.findOne({ barcodeId, labId, isDeleted: { $ne: true } })
      .populate({
        path: 'visitId',
        populate: [
          { path: 'patientId' },
          { path: 'tests' },
          { path: 'invoiceId' }
        ]
      })
      .lean();

    if (!sample) {
      throw new AppError('Sample not found for this barcode', 'VISIT_NOT_FOUND', 404);
    }

    const visit = sample.visitId;
    const patient = visit ? visit.patientId : null;
    const tests = visit ? visit.tests : [];
    const invoiceStatus = visit && visit.invoiceId ? visit.invoiceId.paymentStatus : 'pending';

    // Return sample with visitId as ref instead of nested object, and separate fields
    return {
      sample: {
        ...sample,
        visitId: visit ? visit._id : null
      },
      visit: visit ? { ...visit, patientId: patient ? patient._id : null, tests: tests.map(t => t._id), invoiceId: visit.invoiceId ? visit.invoiceId._id : null } : null,
      patient,
      tests,
      invoiceStatus
    };
  },

  /**
   * Updates sample status and pushes to chain of custody
   */
  async updateSampleStatus(labId, sampleId, status, userId, notes, storageLocation = null) {
    const sample = await Sample.findOne({ _id: sampleId, labId, isDeleted: { $ne: true } });
    if (!sample) {
      throw new AppError('Sample not found', 'VISIT_NOT_FOUND', 404);
    }

    sample.status = status;
    
    if (storageLocation !== null) {
      sample.storageLocation = storageLocation;
    }

    if (status === 'received' && !sample.receivedAt) {
      sample.receivedAt = new Date();
    } else if (status === 'disposed' && !sample.disposedAt) {
      sample.disposedAt = new Date();
    } else if (status === 'rejected') {
      sample.isRejected = true;
      sample.rejectedBy = userId;
      sample.rejectedAt = new Date();
      if (notes) {
        sample.rejectionReason = notes;
      }
    }

    sample.chainOfCustody.push({
      action: status,
      performedBy: userId,
      timestamp: new Date(),
      notes: notes || `Sample status updated to ${status}`
    });

    await sample.save();
    return sample;
  },

  /**
   * Rejects a sample, records rejection reason, and populates for notification triggering.
   */
  async rejectSample(labId, sampleId, rejectionReason, userId) {
    const sample = await Sample.findOne({ _id: sampleId, labId, isDeleted: { $ne: true } });
    if (!sample) {
      throw new AppError('Sample not found', 'VISIT_NOT_FOUND', 404);
    }

    sample.status = 'rejected';
    sample.isRejected = true;
    sample.rejectionReason = rejectionReason;
    sample.rejectedBy = userId;
    sample.rejectedAt = new Date();
    sample.chainOfCustody.push({
      action: 'rejected',
      performedBy: userId,
      timestamp: new Date(),
      notes: rejectionReason
    });

    await sample.save();

    // Populate visitId and patientId before returning
    const populatedSample = await Sample.findById(sampleId)
      .populate('visitId')
      .populate('patientId');

    return populatedSample;
  },

  /**
   * Retrieves pending/received samples sorted by oldest first.
   */
  async getPendingSamples(labId) {
    return await Sample.find({
      labId,
      status: { $in: ['pending', 'received'] },
      isDeleted: { $ne: true }
    })
      .populate({
        path: 'visitId',
        populate: {
          path: 'patientId',
          select: 'firstName lastName phone'
        }
      })
      .sort({ createdAt: 1 });
  }
};

export default SampleService;
