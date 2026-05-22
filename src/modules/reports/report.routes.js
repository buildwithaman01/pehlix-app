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

router.get(
  '/:id/url',
  authorize('owner', 'pathologist', 'technician', 'receptionist', 'doctor'),
  ReportController.getPdfUrl
);

router.get(
  '/:id/download',
  authorize('owner', 'pathologist', 'technician', 'receptionist'),
  ReportController.downloadReport
);

router.post(
  '/:id/regenerate',
  authorize('owner', 'pathologist'),
  ReportController.regenerateReport
);

router.post(
  '/:id/resend-patient',
  authorize('owner', 'pathologist', 'technician', 'receptionist'),
  ReportController.resendToPatient
);

router.post(
  '/:id/resend-doctor',
  authorize('owner', 'pathologist', 'technician', 'receptionist'),
  ReportController.resendToDoctor
);

router.post(
  '/:id/share-link',
  authorize('owner', 'pathologist', 'technician', 'receptionist'),
  ReportController.generateShareLink
);

export default router;
