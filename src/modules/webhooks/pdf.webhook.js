import ReportService from '../reports/report.service.js';
import Report from '../reports/report.model.js';
import InAppNotification from '../notifications/inAppNotification.model.js';
import PlatformAlert from '../analytics/alert.model.js';
import WhatsAppService from '../../utils/whatsapp.js';
import SmsService from '../../utils/sms.js';
import PdfService from '../../utils/pdf.js';
import { config } from '../../config/index.js';
import WhatsAppOutboxService from '../whatsappOutbox/whatsappOutbox.service.js';

/**
 * Helper to verify shared PDF service secret.
 */
function verifySecret(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header missing' });
    return false;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== config.PDF_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return false;
  }
  return true;
}

export const pdfWebhookController = {
  /**
   * POST /api/internal/pdf/generated
   * Callback from the PDF microservice when PDF generation and R2 upload are successful.
   */
  async onPdfGenerated(req, res, next) {
    try {
      if (!verifySecret(req, res)) return;

      const { reportId, pdfUrl, qrVerificationId } = req.body;
      if (!reportId || !pdfUrl) {
        return res.status(400).json({ error: 'reportId and pdfUrl are required' });
      }

      console.log(`[PdfWebhook] Received completion callback for report ${reportId}. PDF URL: ${pdfUrl}`);
      const report = await ReportService.onPdfGenerated(reportId, pdfUrl, qrVerificationId);

      return res.status(200).json({ status: 'success', reportCode: report.reportCode });
    } catch (error) {
      console.error('[PdfWebhook] Error in onPdfGenerated callback:', error);
      next(error);
    }
  },

  /**
   * POST /api/internal/pdf/failed
   * DLQ fallback callback from QStash when all nodes and retries fail.
   */
  async onPdfFailed(req, res, next) {
    try {
      if (!verifySecret(req, res)) return;

      const { url, body, error } = req.body;
      const failedNode = url;
      const errorMessage = error || 'Unknown failure across all nodes';
      
      console.error(`[PdfWebhook] failureCallback triggered for endpoint: ${failedNode}. Error: ${errorMessage}`);

      // Decode the QStash body if base64 encoded
      let payload = body;
      if (typeof body === 'string') {
        try {
          const decoded = Buffer.from(body, 'base64').toString('utf-8');
          payload = JSON.parse(decoded);
        } catch (e) {
          try {
            payload = JSON.parse(body);
          } catch (err) {
            console.warn('[PdfWebhook] Failed to parse failure body as JSON:', err.message);
          }
        }
      }

      if (!payload || !payload.reportId) {
        console.error('[PdfWebhook] failureCallback payload missing reportId');
        return res.status(400).json({ error: 'Payload missing reportId' });
      }

      const { reportId, labId } = payload;
      const report = await Report.findById(reportId)
        .populate('patientId')
        .populate('labId');

      if (!report) {
        console.error(`[PdfWebhook] failureCallback failed: Report not found in db: ${reportId}`);
        return res.status(404).json({ error: 'Report not found' });
      }

      // Increment generationAttempts
      report.generationAttempts = (report.generationAttempts || 0) + 1;
      report.lastFailureReason = errorMessage;
      await report.save();

      const patientName = report.patientId 
        ? `${report.patientId.firstName} ${report.patientId.lastName || ''}`.trim() 
        : 'Patient';
      const labName = report.labId?.name || 'Diagnostic Laboratory';
      const reportCode = report.reportCode;

      if (report.generationAttempts >= 3) {
        // All nodes exhausted. Mark report status 'failed'.
        report.status = 'failed';
        await report.save();
        await WhatsAppOutboxService.markGenerationFailed(reportId);

        // Create PlatformAlert for super admin
        await PlatformAlert.create({
          labId: report.labId?._id || labId,
          type: 'pdf_generation_failed',
          message: `PDF generation failed after 3 attempts for report ${reportCode || reportId}. Reason: ${errorMessage}`
        });

        // Create PlatformAlert for lab owner
        await PlatformAlert.create({
          labId: report.labId?._id || labId,
          type: 'report_generation_failed',
          message: `Report could not be generated for ${patientName} (${reportCode}). Please try regenerating from your dashboard.`
        });

        console.error(`URGENT PDF FAILURE — reportId: ${reportId}, labId: ${labId}, all failed nodes: ${(report.failedNodes || []).join(', ')}`);

        // Send WhatsApp alert to super admin
        const adminPhone = process.env.SUPER_ADMIN_PHONE || '9999999999';
        try {
          await WhatsAppService.send(adminPhone, 'staff_device_alert', {
            staffName: 'Pehlix PDF Engine',
            labName: labName,
            loginTime: new Date().toISOString(),
            deviceInfo: `DLQ failure for Patient: ${patientName}, Report: ${reportCode}, Error: ${errorMessage.substring(0, 100)}`
          });
        } catch (wsErr) {
          console.error('[PdfWebhook] Failed to send WhatsApp alert to super admin:', wsErr);
        }

        // Send SMS fallback to super admin
        try {
          await SmsService.send(
            adminPhone,
            `ALERT: PDF generation failed for ${patientName} at ${labName}. Report ID: ${reportId}. Error: ${errorMessage.substring(0, 100)}`
          );
        } catch (smsErr) {
          console.error('[PdfWebhook] Failed to send SMS alert to super admin:', smsErr);
        }

        return res.status(200).json({ status: 'logged', action: 'marked_failed' });
      } else {
        // Try next node
        const requeueRes = await PdfService.requeueToNextNode(reportId, failedNode);
        if (requeueRes) {
          console.log(`[PdfWebhook] Requeued report ${reportId} to node ${requeueRes.node}, attempt ${report.generationAttempts}`);
          return res.status(200).json({ status: 'requeued', node: requeueRes.node, attempt: report.generationAttempts });
        } else {
          // If no node found, requeueToNextNode already marks report.status = 'failed'
          // We should create alerts as well in this fallback scenario
          report.status = 'failed';
          await report.save();
          await WhatsAppOutboxService.markGenerationFailed(reportId);

          await PlatformAlert.create({
            labId: report.labId?._id || labId,
            type: 'pdf_generation_failed',
            message: `PDF generation failed: No fallback nodes available for report ${reportCode || reportId}.`
          });

          await PlatformAlert.create({
            labId: report.labId?._id || labId,
            type: 'report_generation_failed',
            message: `Report could not be generated for ${patientName} (${reportCode}). No fallback nodes available.`
          });

          return res.status(200).json({ status: 'logged', action: 'failed_no_fallback' });
        }
      }
    } catch (error) {
      console.error('[PdfWebhook] Error in onPdfFailed callback:', error);
      next(error);
    }
  }
};

export default pdfWebhookController;
