import Payment from './payment.model.js';
import { sendSuccess } from '../../utils/response.js';

export const PaymentController = {
  /**
   * Fetch all payments for a lab
   */
  async getPayments(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const labId = req.user.labId;

      const query = { labId, status: 'success' };

      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .populate('patientId', 'firstName lastName')
          .populate('invoiceId', 'invoiceCode')
          .populate('collectedBy', 'firstName lastName')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Payment.countDocuments(query)
      ]);

      // Format response
      const formattedPayments = payments.map(p => ({
        ...p,
        patientName: p.patientId ? `${p.patientId.firstName} ${p.patientId.lastName || ''}`.trim() : 'Unknown Patient',
        invoiceCode: p.invoiceId?.invoiceCode || 'Unknown',
        collectedBy: p.collectedBy ? `${p.collectedBy.firstName} ${p.collectedBy.lastName || ''}`.trim() : 'System'
      }));

      return sendSuccess(res, {
        payments: formattedPayments,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }, 'Payments retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Deletes a payment and updates the associated invoice.
   */
  async deletePayment(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      const payment = await Payment.findOne({ _id: id, labId });
      if (!payment) {
        const AppError = (await import('../../utils/AppError.js')).default;
        throw new AppError('Payment not found', 'PAYMENT_NOT_FOUND', 404);
      }

      const Invoice = (await import('./invoice.model.js')).default;
      const invoice = await Invoice.findOne({ _id: payment.invoiceId, labId });

      if (invoice && payment.status === 'success') {
        invoice.amountPaid = Math.max(0, (invoice.amountPaid || 0) - payment.amount);
        if (invoice.amountPaid === 0) {
          invoice.paymentStatus = 'pending';
        } else if (invoice.amountPaid < invoice.totalAmount) {
          invoice.paymentStatus = 'partial';
        }
        await invoice.save();
      }

      await Payment.deleteOne({ _id: id });

      return sendSuccess(res, null, 'Payment deleted successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default PaymentController;
