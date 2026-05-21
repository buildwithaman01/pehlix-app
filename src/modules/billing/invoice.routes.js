import { Router } from 'express';
import { InvoiceController } from './invoice.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';
import { generalRateLimit } from '../../middleware/rateLimit.middleware.js';

export const invoiceRouter = Router();

// Secure routes with authentication and tenant context
invoiceRouter.use(authenticate);
invoiceRouter.use(verifyTenant);

// Expose endpoints
invoiceRouter.post('/:id/payment-link', generalRateLimit, authorize('owner', 'receptionist', 'technician'), InvoiceController.generatePaymentLink);
invoiceRouter.post('/:id/record-payment', generalRateLimit, authorize('owner', 'receptionist'), InvoiceController.recordManualPayment);
invoiceRouter.post('/:id/waive', generalRateLimit, authorize('owner'), InvoiceController.waiveInvoice);

export default invoiceRouter;
