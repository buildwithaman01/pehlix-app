import { Router } from 'express';
import ResultController from './result.controller.js';
import {
  submitResultSchema,
  updateResultSchema,
  flagCriticalSchema,
  validateRequest
} from './result.validation.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply authenticate and verifyTenant to all routes
router.use(authenticate);
router.use(verifyTenant);

router.post(
  '/',
  authorize('owner', 'technician'),
  validateRequest(submitResultSchema),
  ResultController.submitResult
);

router.post(
  '/:id/flag-critical',
  authorize('owner', 'technician'),
  validateRequest(flagCriticalSchema),
  ResultController.flagCritical
);

router.put(
  '/:id',
  authorize('owner', 'technician'),
  validateRequest(updateResultSchema),
  ResultController.updateResult
);

router.get(
  '/approval-queue',
  authorize('owner', 'pathologist'),
  ResultController.getApprovalQueue
);

router.post(
  '/:id/approve',
  authorize('owner', 'pathologist'),
  ResultController.approveResult
);

router.post(
  '/:id/reject',
  authorize('owner', 'pathologist'),
  ResultController.rejectResult
);

export default router;
