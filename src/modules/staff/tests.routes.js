import { Router } from 'express';
import TestsController from './tests.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply auth + tenant check to all endpoints
router.use(authenticate);
router.use(verifyTenant);

// Packages route must be before /:id to prevent matching packages as id parameter
router.get('/packages', authorize('owner', 'receptionist', 'technician', 'pathologist'), TestsController.getPackages);

// Search master catalog (global)
router.get('/master', authorize('owner'), TestsController.getMasterCatalog);

// Lab-specific tests
router.get('/', authorize('owner', 'receptionist', 'technician', 'pathologist'), TestsController.getTests);
router.post('/', authorize('owner'), TestsController.importTest);
router.post('/custom', authorize('owner'), TestsController.createCustomTest);
router.post('/:id/reset', authorize('owner'), TestsController.resetTest);
router.get('/:id', authorize('owner', 'receptionist', 'technician', 'pathologist'), TestsController.getTestById);
router.patch('/:id', authorize('owner'), TestsController.updateTest);
router.put('/:id', authorize('owner'), TestsController.updateTest);

export default router;
