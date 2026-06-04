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
  }
};

export default PaymentController;
