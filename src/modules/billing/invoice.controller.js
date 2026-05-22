import Razorpay from 'razorpay';
import Invoice from './invoice.model.js';
import Payment from './payment.model.js';
import Lab from '../staff/lab.model.js';
import Patient from '../patients/patient.model.js';
import { AppError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import QStashService from '../../utils/qstash.js';
import { config } from '../../config/index.js';

export const InvoiceController = {
  /**
   * Generates a Razorpay payment link for an invoice.
   * Uses the Lab's specific Razorpay keys.
   */
  async generatePaymentLink(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      // Find invoice by ID and labId
      const invoice = await Invoice.findOne({ _id: id, labId, isDeleted: { $ne: true } })
        .populate('patientId');
      
      if (!invoice) {
        throw new AppError('Invoice not found', 'REPORT_NOT_FOUND', 404);
      }

      // Get lab credentials
      const lab = await Lab.findById(labId);
      if (!lab || !lab.razorpayKeyId || !lab.razorpayKeySecret) {
        throw new AppError('Lab Razorpay keys are not configured. Please contact the administrator.', 'VALIDATION_ERROR', 400);
      }

      const balanceAmount = invoice.balanceAmount !== undefined ? invoice.balanceAmount : (invoice.totalAmount - invoice.amountPaid);
      if (balanceAmount <= 0) {
        throw new AppError('Invoice is already fully paid.', 'VALIDATION_ERROR', 400);
      }

      // Initialize Razorpay with lab keys
      const razorpayInstance = new Razorpay({
        key_id: lab.razorpayKeyId,
        key_secret: lab.razorpayKeySecret
      });

      const patient = invoice.patientId;
      const patientName = patient ? `${patient.firstName} ${patient.lastName || ''}`.trim() : 'Patient';
      const patientPhone = patient ? patient.phone : '9999999999';

      // Create Payment Link via Razorpay API
      const response = await razorpayInstance.paymentLink.create({
        amount: Math.round(balanceAmount * 100), // convert to paise
        currency: 'INR',
        accept_partial: false,
        description: `Lab services payment for invoice code: ${invoice.invoiceCode}`,
        customer: {
          name: patientName,
          contact: patientPhone.startsWith('+') ? patientPhone : `+91${patientPhone}`, // format Indian number prefix if missing
          email: patient?.email || 'patient@pehlix.in'
        },
        notify: {
          sms: false,
          email: false
        },
        reminder_enable: true,
        notes: {
          invoiceId: invoice._id.toString()
        },
        callback_url: `${config.NEXT_PUBLIC_APP_URL}/billing/callback`,
        callback_method: 'get'
      });

      // Save payment link details in invoice
      invoice.razorpayPaymentLinkId = response.id;
      invoice.razorpayPaymentLinkUrl = response.short_url;
      await invoice.save();

      return sendSuccess(res, {
        paymentLinkId: response.id,
        paymentLink: response.short_url
      }, 'Payment link generated successfully');
    } catch (error) {
      console.error('Razorpay payment link generation failed:', error);
      next(error);
    }
  },

  /**
   * Records a manual payment (e.g. cash, custom UPI, etc.) for an invoice.
   */
  async recordManualPayment(req, res, next) {
    try {
      const { id } = req.params;
      const { amount, method, notes } = req.body;
      const labId = req.user.labId;
      const userId = req.user._id;

      // Validate inputs
      if (!amount || amount <= 0) {
        throw new AppError('Amount must be a positive number', 'VALIDATION_ERROR', 400);
      }
      if (!['cash', 'upi', 'card', 'wallet', 'online'].includes(method)) {
        throw new AppError('Invalid payment method', 'VALIDATION_ERROR', 400);
      }

      const invoice = await Invoice.findOne({ _id: id, labId, isDeleted: { $ne: true } })
        .populate('patientId')
        .populate('labId');
      if (!invoice) {
        throw new AppError('Invoice not found', 'REPORT_NOT_FOUND', 404);
      }

      const currentBalance = invoice.totalAmount - invoice.amountPaid;
      if (amount > currentBalance) {
        throw new AppError(`Payment amount ${amount} exceeds remaining invoice balance of ${currentBalance}`, 'VALIDATION_ERROR', 400);
      }

      // Create Payment record
      const payment = await Payment.create({
        labId,
        invoiceId: invoice._id,
        patientId: invoice.patientId?._id || invoice.patientId,
        amount,
        method,
        status: 'success',
        collectedBy: userId,
        notes: notes || 'Manual payment entry'
      });

      // Update invoice paid amount
      invoice.amountPaid = (invoice.amountPaid || 0) + amount;
      
      if (invoice.amountPaid >= invoice.totalAmount) {
        invoice.paymentStatus = 'paid';
      } else {
        invoice.paymentStatus = 'partial';
      }
      await invoice.save();

      // If fully paid, enqueue PDF generation job placeholder
      if (invoice.paymentStatus === 'paid') {
        const pdfEndpoint = `${config.NEXT_PUBLIC_APP_URL}/api/internal/reports/generate`;
        await QStashService.enqueue(pdfEndpoint, {
          visitId: invoice.visitId.toString(),
          labId: labId.toString(),
          invoiceId: invoice._id.toString()
        });
      }

      // Trigger WhatsApp payment received flow
      if (invoice.patientId && invoice.patientId.phone) {
        const patientName = `${invoice.patientId.firstName} ${invoice.patientId.lastName || ''}`.trim();
        const reportLink = `${config.NEXT_PUBLIC_APP_URL}/reports/view/${invoice.visitId}`;
        const labName = invoice.labId?.name || 'Pehlix Lab';
        await QStashService.enqueueNotification(
          'payment_received',
          {
            patientName,
            amount: amount,
            reportLink,
            labName,
            labId: labId.toString()
          },
          invoice.patientId.phone
        );
      }

      return sendSuccess(res, { payment, invoice }, 'Manual payment recorded successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Waives an invoice's outstanding amount.
   * Owner only access (checked by route level authorization).
   */
  async waiveInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const { waiveReason } = req.body;
      const labId = req.user.labId;
      const userId = req.user._id;

      if (!waiveReason || waiveReason.trim().length < 5) {
        throw new AppError('A valid waive reason of at least 5 characters is required.', 'VALIDATION_ERROR', 400);
      }

      const invoice = await Invoice.findOne({ _id: id, labId, isDeleted: { $ne: true } });
      if (!invoice) {
        throw new AppError('Invoice not found', 'REPORT_NOT_FOUND', 404);
      }

      invoice.paymentStatus = 'waived';
      invoice.waivedBy = userId;
      invoice.waivedAt = new Date();
      invoice.waiveReason = waiveReason;
      await invoice.save();

      return sendSuccess(res, invoice, 'Invoice waived successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default InvoiceController;
