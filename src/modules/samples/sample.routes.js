import { Router } from 'express';
import SampleController from './sample.controller.js';
import {
  scanBarcodeSchema,
  updateSampleStatusSchema,
  rejectSampleSchema,
  validateRequest
} from './sample.validation.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply authenticate and verifyTenant to all sample routes
router.use(authenticate);
router.use(verifyTenant);

router.post(
  '/scan',
  authorize('owner', 'technician', 'pathologist'),
  validateRequest(scanBarcodeSchema),
  SampleController.scanBarcode
);

router.put(
  '/:id/status',
  authorize('owner', 'technician'),
  validateRequest(updateSampleStatusSchema),
  SampleController.updateSampleStatus
);

router.post(
  '/:id/reject',
  authorize('owner', 'technician'),
  validateRequest(rejectSampleSchema),
  SampleController.rejectSample
);

router.get(
  '/pending',
  authorize('owner', 'technician', 'pathologist'),
  SampleController.getPendingSamples
);

router.get(
  '/:id/chain',
  authorize('owner', 'technician', 'pathologist'),
  SampleController.getSampleChain
);

export default router;
