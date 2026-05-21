import { Router } from 'express';
import ReportController from './report.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';
import { publicRateLimit } from '../../middleware/rateLimit.middleware.js';

const router = Router();

// Public route - QR Verification (Must be rate-limited, no auth)
router.get('/verify/:qrVerificationId', publicRateLimit, ReportController.verifyReport);

// All other routes require authentication and tenant verification
router.use(authenticate);
router.use(verifyTenant);

router.get(
  '/',
  authorize('owner', 'pathologist', 'technician', 'receptionist'),
  ReportController.getReports
);

router.get(
  '/:id',
  authorize('owner', 'pathologist', 'technician', 'receptionist', 'doctor'),
  ReportController.getReportById
);

router.post(
  '/:id/deliver',
  authorize('owner', 'pathologist'),
  ReportController.deliverReport
);

export default router;
