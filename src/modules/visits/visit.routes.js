import { Router } from 'express';
import VisitController from './visit.controller.js';
import {
  createVisitSchema,
  addTestsSchema,
  validateRequest
} from './visit.validation.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply base authentication and tenant validation middlewares to all visit routes
router.use(authenticate);
router.use(verifyTenant);

router.post('/', authorize('owner', 'receptionist'), validateRequest(createVisitSchema), VisitController.createVisit);
router.get('/', authorize('owner', 'receptionist', 'pathologist', 'technician'), VisitController.getVisits);
router.get('/:id', authorize('owner', 'receptionist', 'pathologist', 'technician'), VisitController.getVisitById);
router.put('/:id/status', authorize('owner', 'receptionist', 'technician', 'pathologist'), VisitController.updateVisitStatus);
router.post('/:id/tests', authorize('owner', 'receptionist'), validateRequest(addTestsSchema), VisitController.addTests);

export default router;
