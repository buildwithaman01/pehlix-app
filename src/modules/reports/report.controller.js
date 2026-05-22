import Report from './report.model.js';
import Result from '../results/result.model.js';
import ReportService from './report.service.js';
import R2Service from '../../utils/r2.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';

export const ReportController = {
  /**
   * Find reports by labId with pagination
   */
  async getReports(req, res, next) {
    try {
      const labId = req.user.labId;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;

      const total = await Report.countDocuments({ labId, isDeleted: { $ne: true } });
      const reports = await Report.find({ labId, isDeleted: { $ne: true } })
        .populate('patientId', 'firstName lastName phone')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

      return sendSuccess(
        res,
        {
          reports,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        },
        'Reports retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Find a report by _id and labId
   */
  async getReportById(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      const report = await Report.findOne({ _id: id, labId, isDeleted: { $ne: true } })
        .populate('patientId')
        .populate('visitId');

      if (!report) {
        throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
      }

      return sendSuccess(res, report, 'Report retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/reports/:id/url
   * Generates a 24-hour signed URL for internal lab owner/staff access.
   */
  async getPdfUrl(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;
      const userRole = req.user.role || 'staff';

      const result = await ReportService.getReportWithSignedUrl(labId, id, userRole);
      return sendSuccess(res, { signedUrl: result.signedUrl }, 'Signed PDF URL generated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/reports/:id/download
   * Generates a signed URL for direct download, forcing Content-Disposition: attachment.
   */
  async downloadReport(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      const report = await Report.findOne({ _id: id, labId });
      if (!report) {
        throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
      }
      if (!report.pdfUrl) {
        throw new AppError('Report PDF is not ready yet', 'REPORT_NOT_READY', 400);
      }

      const downloadUrl = await R2Service.getSignedDownloadUrl(report.pdfUrl);
      return sendSuccess(res, { downloadUrl }, 'Download URL generated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/reports/:id/regenerate
   * Archives old PDF version, resets status, and re-queues PDF generation job.
   */
  async regenerateReport(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      const result = await ReportService.regenerateReport(labId, id);
      return sendSuccess(
        res,
        { report: result.report, messageId: result.messageId },
        'Report regeneration queued successfully'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/reports/:id/resend-patient
   * Manually triggers WhatsApp resending of the report link or paywall link to patient.
   */
  async resendToPatient(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      await ReportService.resendToPatient(labId, id);
      return sendSuccess(res, null, 'Report resent to patient successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/reports/:id/resend-doctor
   * Manually triggers WhatsApp sending of the report link to referred doctor.
   */
  async resendToDoctor(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      await ReportService.resendToDoctor(labId, id);
      return sendSuccess(res, null, 'Report sent to referring doctor successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/reports/:id/share-link
   * Generates a 7-day signed share link.
   */
  async generateShareLink(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      const result = await ReportService.generateShareLink(labId, id);
      return sendSuccess(res, result, 'Share link generated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Public QR code verification endpoint
   */
  async verifyReport(req, res, next) {
    try {
      const { qrVerificationId } = req.params;

      const report = await Report.findOne({ qrVerificationId, isDeleted: { $ne: true } })
        .populate('patientId')
        .populate('labId')
        .populate({
          path: 'visitId',
          populate: { path: 'tests' }
        });

      if (!report) {
        return sendSuccess(
          res,
          {
            verified: false,
            message: 'Report not found'
          },
          'Report verification failed'
        );
      }

      // Query pathologist details from approval result record
      const approvedResult = await Result.findOne({ visitId: report.visitId, isApproved: true }).populate('approvedBy');
      const approvedAt = approvedResult ? approvedResult.approvedAt : report.updatedAt;
      const pathologistName = approvedResult?.approvedBy?.name
        || (approvedResult?.approvedBy?.firstName
          ? `${approvedResult.approvedBy.firstName} ${approvedResult.approvedBy.lastName || ''}`.trim()
          : 'Authorized Pathologist');

      const patientName = report.patientId ? `${report.patientId.firstName} ${report.patientId.lastName || ''}`.trim() : 'Patient';
      const labName = report.labId ? report.labId.name : 'Diagnostic Laboratory';
      const tests = report.visitId?.tests ? report.visitId.tests.map(t => t.name) : [];

      return sendSuccess(
        res,
        {
          verified: true,
          patientName,
          labName,
          tests,
          approvedAt,
          pathologistName
        },
        'Report verified successfully'
      );
    } catch (error) {
      next(error);
    }
  }
};

export default ReportController;
