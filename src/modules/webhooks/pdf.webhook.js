import ReportService from '../reports/report.service.js';
import Report from '../reports/report.model.js';
import InAppNotification from '../notifications/inAppNotification.model.js';
import WhatsAppService from '../../utils/whatsapp.js';
import SmsService from '../../utils/sms.js';
import { config } from '../../config/index.js';

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
      console.error(`[PdfWebhook] DLQ Triggered for endpoint: ${url}. Error: ${error}`);

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
        console.error('[PdfWebhook] DLQ failure payload missing reportId');
        return res.status(400).json({ error: 'Payload missing reportId' });
      }

      const { reportId, visitId, labId } = payload;
      const report = await Report.findById(reportId)
        .populate('patientId')
        .populate('labId');

      if (!report) {
        console.error(`[PdfWebhook] DLQ failed: Report not found in db: ${reportId}`);
        return res.status(404).json({ error: 'Report not found' });
      }

      // 1. Update report status to failed
      report.status = 'failed';
      await report.save();

      const patientName = report.patientId 
        ? `${report.patientId.firstName} ${report.patientId.lastName || ''}`.trim() 
        : 'Patient';
      const labName = report.labId?.name || 'Diagnostic Laboratory';
      const reportCode = report.reportCode;

      // 2. Create in-app notification for the lab owner
      await InAppNotification.create({
        labId: report.labId?._id || labId,
        title: 'Report Generation Failed',
        message: `PDF generation failed for patient ${patientName} (Report Code: ${reportCode}). Please try regenerating manually from the dashboard.`
      });

      // 3. Send WhatsApp alert to super admin (reusing staff_device_alert template to fit registered list)
      const adminPhone = process.env.SUPER_ADMIN_PHONE || '9999999999';
      const errorStr = error || 'Unknown failure across all nodes';
      
      try {
        await WhatsAppService.send(adminPhone, 'staff_device_alert', {
          staffName: 'Pehlix PDF Engine',
          labName: labName,
          loginTime: new Date().toISOString(),
          deviceInfo: `DLQ failure for Patient: ${patientName}, Report: ${reportCode}, Visit: ${visitId || report.visitId}. Error: ${errorStr.substring(0, 100)}`
        });
      } catch (wsErr) {
        console.error('[PdfWebhook] Failed to send WhatsApp alert to super admin:', wsErr);
      }

      // 4. Send SMS fallback to super admin
      try {
        await SmsService.send(
          adminPhone,
          `ALERT: PDF generation failed for ${patientName} at ${labName}. Visit ID: ${visitId || report.visitId}, Report ID: ${reportId}. Error: ${errorStr.substring(0, 100)}`
        );
      } catch (smsErr) {
        console.error('[PdfWebhook] Failed to send SMS alert to super admin:', smsErr);
      }

      return res.status(200).json({ status: 'logged' });
    } catch (error) {
      console.error('[PdfWebhook] Error in onPdfFailed callback:', error);
      next(error);
    }
  }
};

export default pdfWebhookController;
