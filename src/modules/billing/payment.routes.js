import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';
import { generalRateLimit } from '../../middleware/rateLimit.middleware.js';

export const paymentRouter = Router();

// Secure routes with authentication and tenant context
paymentRouter.use(authenticate);
paymentRouter.use(verifyTenant);

// Expose endpoints
paymentRouter.get('/', generalRateLimit, authorize('owner', 'receptionist'), PaymentController.getPayments);
paymentRouter.delete('/:id', generalRateLimit, authorize('owner', 'receptionist'), PaymentController.deletePayment);

export default paymentRouter;
