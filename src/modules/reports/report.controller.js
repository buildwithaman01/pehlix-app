import Report from './report.model.js';
import Result from '../results/result.model.js';
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
   * Mark report delivered and log WhatsApp notification payload placeholder
   */
  async deliverReport(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      const report = await Report.findOne({ _id: id, labId, isDeleted: { $ne: true } }).populate('patientId');
      if (!report) {
        throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
      }

      report.deliveredAt = new Date();
      report.deliveryChannel = 'whatsapp';
      await report.save();

      // Log WhatsApp delivery placeholder (implemented fully in AGENT_09)
      const recipientPhone = report.patientId ? report.patientId.phone : null;
      const patientName = report.patientId ? `${report.patientId.firstName} ${report.patientId.lastName || ''}`.trim() : 'Patient';

      console.log('--- [REPORT DELIVER WHATSAPP PAYLOAD] ---');
      console.log(
        JSON.stringify(
          {
            type: 'deliver_report_via_whatsapp',
            reportId: report._id.toString(),
            patientPhone: recipientPhone,
            patientName,
            pdfUrl: report.pdfUrl,
            labId: labId.toString()
          },
          null,
          2
        )
      );
      console.log('-----------------------------------------');

      return sendSuccess(res, report, 'Report marked as delivered and delivery job queued');
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
