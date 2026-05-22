import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Report from './report.model.js';
import Visit from '../visits/visit.model.js';
import { Invoice } from '../billing/invoice.model.js';
import { Doctor } from '../doctors/doctor.model.js';
import PdfService from '../../utils/pdf.js';
import R2Service from '../../utils/r2.js';
import WhatsAppService from '../../utils/whatsapp.js';
import { AppError } from '../../utils/errors.js';
import { config } from '../../config/index.js';
import Razorpay from 'razorpay';

// Helper to generate a unique 12-character uppercase alphanumeric code
export function generateReportCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const ReportService = {
  /**
   * Creates a new pending report record for a visit.
   */
  async createReportRecord(labId, visitId, patientId) {
    // Ensure uniqueness of reportCode
    let reportCode = '';
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 10) {
      reportCode = `RP-${generateReportCode()}`;
      const existing = await Report.findOne({ reportCode });
      if (!existing) {
        exists = false;
      }
      attempts++;
    }

    const qrVerificationId = uuidv4();

    const report = new Report({
      labId,
      visitId,
      patientId,
      reportCode,
      qrVerificationId,
      status: 'pending'
    });

    await report.save();
    return report;
  },

  /**
   * Triggers the PDF generation job via QStash.
   */
  async triggerPdfGeneration(reportId) {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    report.status = 'generating';
    await report.save();

    // Fetch visit with populated tests to compute score
    const visit = await Visit.findById(report.visitId).populate('tests');
    if (!visit) {
      throw new AppError('Visit not found for report', 'VISIT_NOT_FOUND', 404);
    }

    const complexityScore = PdfService.calculateComplexityScore(visit);
    
    // Enqueue PDF generation job
    const messageId = await PdfService.enqueuePdfJob(
      visit._id,
      visit.labId,
      report._id,
      complexityScore
    );

    return { messageId, reportCode: report.reportCode };
  },

  /**
   * Called by the PDF microservice callback when PDF is generated and uploaded.
   */
  async onPdfGenerated(reportId, pdfUrl, qrVerificationId) {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    report.status = 'generated';
    report.pdfUrl = pdfUrl; // stored as labs/LABID/reports/REPORTCODE.pdf
    if (qrVerificationId) {
      report.qrVerificationId = qrVerificationId;
    }
    report.generatedAt = new Date();
    await report.save();

    // Transition visit status to 'reported' if all reports for the visit are done
    // In this system, there's 1 report per visit usually, so update visit status
    await Visit.findByIdAndUpdate(report.visitId, {
      status: 'reported',
      'statusTimestamps.reportedAt': new Date()
    });

    // Check payment status and deliver report
    await this.checkAndDeliverReport(report._id);

    return report;
  },

  /**
   * Determines if the report should be delivered and triggers WhatsApp/SMS.
   */
  async checkAndDeliverReport(reportId) {
    const report = await Report.findById(reportId)
      .populate('patientId')
      .populate('visitId')
      .populate('labId');

    if (!report) {
      throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    // Only deliver if PDF is actually generated
    if (report.status !== 'generated' && report.status !== 'delivered') {
      console.log(`[ReportService] Report ${reportId} is not in generated/delivered state. Skipping delivery.`);
      return report;
    }

    const invoice = await Invoice.findOne({ visitId: report.visitId, labId: report.labId });
    if (!invoice) {
      console.log(`[ReportService] No invoice found for visit ${report.visitId}. Delivering report anyway.`);
      await this.sendPaidReport(report);
      return report;
    }

    const balance = invoice.balanceAmount !== undefined ? invoice.balanceAmount : (invoice.totalAmount - invoice.amountPaid);

    if (balance <= 0) {
      // Fully paid -> Deliver report
      await this.sendPaidReport(report);
    } else {
      // Unpaid / Partial -> Send payment link paywall
      await this.sendUnpaidPaywall(report, invoice, balance);
    }

    return report;
  },

  /**
   * Helper to send paid report notification.
   */
  async sendPaidReport(report) {
    const patient = report.patientId;
    if (!patient || !patient.phone) {
      console.warn(`[ReportService] Patient phone missing for report ${report._id}. Cannot deliver via WhatsApp.`);
      return;
    }

    // Generate signed R2 URL valid for 48 hours for patient delivery (172800 seconds)
    const reportLink = await R2Service.getSignedUrl(report.pdfUrl, 172800);
    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
    const labName = report.labId?.name || 'Pehlix Lab';
    const reportCode = report.reportCode;

    console.log(`[ReportService] Delivering paid report ${report.reportCode} to patient ${patient.phone}`);

    await WhatsAppService.send(patient.phone, 'report_ready_paid', {
      patientName,
      reportLink,
      labName,
      reportCode,
      labId: report.labId._id.toString()
    });

    report.status = 'delivered';
    report.deliveredAt = new Date();
    report.patientDeliveredAt = new Date();
    report.deliveryChannel = 'whatsapp';
    report.deliveryAttempts = (report.deliveryAttempts || 0) + 1;
    await report.save();

    // Update visit status to 'delivered'
    await Visit.findByIdAndUpdate(report.visitId, {
      status: 'delivered',
      'statusTimestamps.deliveredAt': new Date()
    });
  },

  /**
   * Helper to send unpaid paywall notification.
   */
  async sendUnpaidPaywall(report, invoice, balance) {
    const patient = report.patientId;
    if (!patient || !patient.phone) {
      console.warn(`[ReportService] Patient phone missing for report ${report._id}. Cannot deliver unpaid paywall.`);
      return;
    }

    const lab = report.labId;
    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
    const labName = lab?.name || 'Pehlix Lab';
    const phone = patient.phone;

    let paymentLink = invoice.razorpayPaymentLinkUrl;

    if (!paymentLink) {
      if (lab && lab.razorpayKeyId && lab.razorpayKeySecret) {
        try {
          const rpay = new Razorpay({
            key_id: lab.razorpayKeyId,
            key_secret: lab.razorpayKeySecret
          });
          
          const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

          const link = await rpay.paymentLink.create({
            amount: Math.round(balance * 100), // in paise
            currency: 'INR',
            accept_partial: false,
            description: `Payment for Lab Invoice #${invoice.invoiceCode}`,
            customer: {
              name: patientName,
              contact: formattedPhone
            },
            notify: {
              sms: false,
              email: false
            },
            reminder_enable: false,
            notes: {
              invoiceId: invoice._id.toString()
            },
            callback_url: `${config.NEXT_PUBLIC_APP_URL}/billing/callback`,
            callback_method: 'get'
          });
          
          paymentLink = link.short_url;
          invoice.razorpayPaymentLinkId = link.id;
          invoice.razorpayPaymentLinkUrl = paymentLink;
          await invoice.save();
        } catch (err) {
          console.error('[ReportService] Failed to generate Razorpay link:', err);
          paymentLink = `${config.NEXT_PUBLIC_APP_URL}/pay/${invoice._id}`;
        }
      } else {
        paymentLink = `${config.NEXT_PUBLIC_APP_URL}/pay/${invoice._id}`;
      }
    }

    console.log(`[ReportService] Sending unpaid paywall for report ${report.reportCode} to patient ${phone}`);

    await WhatsAppService.send(phone, 'report_ready_unpaid', {
      patientName,
      pendingAmount: balance,
      paymentLink,
      labName,
      labId: lab._id.toString()
    });

    report.status = 'approved'; // reset/hold at approved since unpaid
    report.deliveryAttempts = (report.deliveryAttempts || 0) + 1;
    await report.save();
  },

  /**
   * Fetches report details and generates a signed URL based on user role.
   */
  async getReportWithSignedUrl(labId, reportId, userRole) {
    const report = await Report.findOne({ _id: reportId, labId });
    if (!report) {
      throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    if (!report.pdfUrl) {
      throw new AppError('Report PDF has not been generated yet', 'REPORT_NOT_READY', 400);
    }

    // Determine expiry time based on role
    let expiry = 86400; // default 24 hours (lab owners, staff)
    if (userRole === 'patient') {
      expiry = 172800; // 48 hours
    } else if (userRole === 'share') {
      expiry = 604800; // 7 days
    }

    const signedUrl = await R2Service.getSignedUrl(report.pdfUrl, expiry);

    return {
      report,
      signedUrl
    };
  },

  /**
   * Regenerates a report PDF, archiving the old version first.
   */
  async regenerateReport(labId, reportId) {
    const report = await Report.findOne({ _id: reportId, labId });
    if (!report) {
      throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    // Archive previous PDF if it exists
    if (report.pdfUrl) {
      try {
        const oldPdfUrl = report.pdfUrl;
        const timestamp = Date.now();
        const archiveKey = oldPdfUrl.replace('.pdf', `_archived_${timestamp}.pdf`);
        await R2Service.copyObject(oldPdfUrl, archiveKey);
        console.log(`[ReportService] Archived old PDF to ${archiveKey}`);
      } catch (err) {
        console.error('[ReportService] Archiving old PDF failed, proceeding anyway:', err);
      }
    }

    // Reset report status to pending/generating
    report.pdfUrl = null;
    report.status = 'pending';
    report.generatedAt = null;
    await report.save();

    // Trigger PDF generation job
    const result = await this.triggerPdfGeneration(report._id);
    return {
      success: true,
      report,
      messageId: result.messageId
    };
  },

  /**
   * Resends the report link manually to the patient.
   */
  async resendToPatient(labId, reportId) {
    const report = await Report.findOne({ _id: reportId, labId }).populate('patientId');
    if (!report) {
      throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    if (report.status !== 'generated' && report.status !== 'delivered') {
      throw new AppError('Report PDF is not ready yet', 'REPORT_NOT_READY', 400);
    }

    const invoice = await Invoice.findOne({ visitId: report.visitId, labId });
    const balance = invoice ? (invoice.balanceAmount !== undefined ? invoice.balanceAmount : (invoice.totalAmount - invoice.amountPaid)) : 0;

    if (balance > 0) {
      await this.sendUnpaidPaywall(report, invoice, balance);
    } else {
      await this.sendPaidReport(report);
    }

    return { success: true };
  },

  /**
   * Sends report link manually to the referring doctor.
   */
  async resendToDoctor(labId, reportId) {
    const report = await Report.findOne({ _id: reportId, labId })
      .populate('patientId')
      .populate('labId')
      .populate({
        path: 'visitId',
        populate: { path: 'referredBy' }
      });

    if (!report) {
      throw new AppError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    if (report.status !== 'generated' && report.status !== 'delivered') {
      throw new AppError('Report PDF is not ready yet', 'REPORT_NOT_READY', 400);
    }

    const doctor = report.visitId?.referredBy;
    if (!doctor || !doctor.phone) {
      throw new AppError('Referred doctor or doctor phone number not found', 'DOCTOR_NOT_FOUND', 404);
    }

    // Generate signed R2 URL valid for 7 days (604800 seconds)
    const reportLink = await R2Service.getSignedUrl(report.pdfUrl, 604800);
    const patientName = report.patientId ? `${report.patientId.firstName} ${report.patientId.lastName || ''}`.trim() : 'Patient';
    const labName = report.labId?.name || 'Pehlix Lab';
    const reportCode = report.reportCode;

    console.log(`[ReportService] Sending report link ${report.reportCode} to Doctor ${doctor.name} (${doctor.phone})`);

    await WhatsAppService.send(doctor.phone, 'report_ready_paid', {
      patientName,
      reportLink,
      labName,
      reportCode,
      labId: labId.toString()
    });

    report.doctorDeliveredAt = new Date();
    await report.save();

    return { success: true };
  },

  /**
   * Generates a 7-day share link for manual sharing by lab owner.
   */
  async generateShareLink(labId, reportId) {
    const result = await this.getReportWithSignedUrl(labId, reportId, 'share');
    return {
      shareUrl: result.signedUrl,
      reportCode: result.report.reportCode
    };
  }
};

export default ReportService;
