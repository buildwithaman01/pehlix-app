import { Router } from 'express';
import AnalyticsController from './analytics.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply authentication and tenant verification to all routes
router.use(authenticate, verifyTenant);

router.get('/dashboard', authorize('owner', 'receptionist'), AnalyticsController.getDashboard);
router.get('/revenue', authorize('owner'), AnalyticsController.getRevenue);
router.get('/tests', authorize('owner'), AnalyticsController.getTests);
router.get('/doctors', authorize('owner'), AnalyticsController.getDoctors);
router.get('/patients', authorize('owner'), AnalyticsController.getPatients);
router.get('/operations', authorize('owner', 'pathologist'), AnalyticsController.getOperations);
router.get('/health-score', authorize('owner'), AnalyticsController.getHealthScore);
router.get('/pending-payments', authorize('owner'), AnalyticsController.getPendingPayments);

export default router;
