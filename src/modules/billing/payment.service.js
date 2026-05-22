import mongoose from 'mongoose';
import { config } from '../../config/index.js';
import QStashService from '../../utils/qstash.js';
import Payment from './payment.model.js';
import Invoice from './invoice.model.js';
import DoctorService from '../doctors/doctor.service.js';

export const PaymentService = {
  /**
   * Processes the payment.captured webhook event.
   * Ensures idempotency using razorpayPaymentId.
   */
  async processPaymentCapture(payload) {
    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      throw new Error('Payment entity missing in payload');
    }

    const razorpayPaymentId = paymentEntity.id;
    const notes = paymentEntity.notes || {};
    const invoiceId = notes.invoiceId || notes.invoice_id;

    if (!invoiceId) {
      console.warn(`[Payment] Captured payment received without invoiceId in notes: ${razorpayPaymentId}`);
      return { success: false, reason: 'No invoiceId in payment notes' };
    }

    // 1. Idempotency Check
    const existingPayment = await Payment.findOne({ razorpayPaymentId });
    if (existingPayment) {
      console.log(`[Payment] Duplicate payment detected and ignored: ${razorpayPaymentId}`);
      return { success: true, alreadyProcessed: true, paymentId: existingPayment._id };
    }

    // 2. Fetch Invoice
    const invoice = await Invoice.findById(invoiceId)
      .populate('patientId')
      .populate('labId');

    if (!invoice) {
      throw new Error(`Invoice not found for ID: ${invoiceId}`);
    }

    const amountPaidNow = paymentEntity.amount / 100; // Convert paise to INR

    // 3. Mark Invoice Paid and Update Balance
    invoice.amountPaid = (invoice.amountPaid || 0) + amountPaidNow;
    if (invoice.amountPaid >= invoice.totalAmount) {
      invoice.paymentStatus = 'paid';
    } else if (invoice.amountPaid > 0) {
      invoice.paymentStatus = 'partial';
    }
    await invoice.save();

    // Trigger doctor commission calculation if the invoice is fully paid
    if (invoice.paymentStatus === 'paid') {
      try {
        await DoctorService.calculateAndRecordCommission(
          invoice.labId._id || invoice.labId,
          invoice.visitId,
          invoice._id,
          invoice.totalAmount
        );
      } catch (err) {
        console.error('[Payment Service] Failed to calculate and record doctor commission:', err);
      }
    }

    // 4. Create Payment record
    const paymentRecord = await Payment.create({
      labId: invoice.labId._id || invoice.labId,
      invoiceId: invoice._id,
      patientId: invoice.patientId._id || invoice.patientId,
      amount: amountPaidNow,
      method: 'online',
      razorpayPaymentId,
      razorpayOrderId: paymentEntity.order_id,
      status: 'success',
      notes: 'Paid online via Razorpay payment link'
    });

    const patientName = invoice.patientId 
      ? `${invoice.patientId.firstName} ${invoice.patientId.lastName || ''}`.trim() 
      : 'Patient';

    const reportLink = `${config.NEXT_PUBLIC_APP_URL}/reports/view/${invoice.visitId}`;

    // 5. Enqueue WhatsApp notification job using QStash
    if (invoice.patientId && invoice.patientId.phone) {
      await QStashService.enqueueNotification(
        'payment_received',
        {
          patientName,
          amount: amountPaidNow,
          reportLink,
          labName: invoice.labId?.name || 'Pehlix Lab',
          labId: invoice.labId?._id?.toString()
        },
        invoice.patientId.phone
      );
    }

    // 6. Enqueue PDF generation job placeholder
    const pdfEndpoint = `${config.NEXT_PUBLIC_APP_URL}/api/internal/reports/generate`;
    await QStashService.enqueue(pdfEndpoint, {
      visitId: invoice.visitId.toString(),
      labId: invoice.labId?._id?.toString(),
      invoiceId: invoice._id.toString()
    });

    return {
      success: true,
      paymentId: paymentRecord._id,
      invoiceStatus: invoice.paymentStatus
    };
  },

  /**
   * Processes the subscription.charged webhook event.
   */
  async processSubscriptionCharged(payload) {
    const subscription = payload.payload?.subscription?.entity;
    if (!subscription) {
      console.warn('[Payment] Subscription entity missing in payload');
      return { success: false };
    }

    const subscriptionId = subscription.id;
    const Lab = mongoose.model('Lab');
    const lab = await Lab.findOne({ 'billing.razorpaySubscriptionId': subscriptionId });

    if (lab) {
      lab.billing.status = 'active';
      if (subscription.current_end) {
        lab.billing.nextBillingDate = new Date(subscription.current_end * 1000);
      }
      await lab.save();

      // Notify lab owner of successful subscription renewal
      const User = mongoose.model('User');
      const owner = await User.findById(lab.owner);
      if (owner && owner.phone) {
        await QStashService.enqueueNotification(
          'payment_received',
          {
            patientName: owner.firstName || 'Owner',
            amount: (subscription.amount || 0) / 100,
            reportLink: `${config.NEXT_PUBLIC_APP_URL}/billing`,
            labName: 'Pehlix Platform',
            labId: lab._id.toString()
          },
          owner.phone
        );
      }
      return { success: true, labId: lab._id };
    }

    return { success: false, reason: 'Lab not found for subscription ID' };
  },

  /**
   * Processes the subscription.payment.failed webhook event.
   */
  async processSubscriptionFailed(payload) {
    const subscription = payload.payload?.subscription?.entity;
    if (!subscription) {
      console.warn('[Payment] Subscription entity missing in payload');
      return { success: false };
    }

    const subscriptionId = subscription.id;
    const Lab = mongoose.model('Lab');
    const lab = await Lab.findOne({ 'billing.razorpaySubscriptionId': subscriptionId });

    if (lab) {
      lab.billing.status = 'grace';
      await lab.save();

      // Notify lab owner of billing failure
      const User = mongoose.model('User');
      const owner = await User.findById(lab.owner);
      if (owner && owner.phone) {
        await QStashService.enqueueNotification(
          'trial_day_10',
          {
            ownerName: owner.firstName || 'Owner',
            patientsRegistered: 0,
            reportsSent: 0,
            planUpgradeLink: `${config.NEXT_PUBLIC_APP_URL}/billing/upgrade`,
            labId: lab._id.toString()
          },
          owner.phone
        );
      }
      return { success: true, labId: lab._id };
    }

    return { success: false, reason: 'Lab not found for subscription ID' };
  }
};

export default PaymentService;
