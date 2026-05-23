import express from 'express';
import AdminController from './admin.controller.js';
import { superAdminAuth, superAdminAudit } from './admin.middleware.js';
import { validateRequest, createLabSchema } from './admin.validation.js';

const router = express.Router();

// Apply superAdminAuth and superAdminAudit to all routes in this router
router.use(superAdminAuth);
router.use(superAdminAudit);

// Lab Management Routes
router.get('/labs', AdminController.getAllLabs);
router.post('/labs', validateRequest(createLabSchema), AdminController.createLab);
router.get('/labs/:id', AdminController.getLabById);
router.put('/labs/:id/config', AdminController.updateLabConfig);
router.put('/labs/:id/suspend', AdminController.suspendLab);
router.put('/labs/:id/restore', AdminController.restoreLab);
router.post('/labs/:id/impersonate', AdminController.impersonateLab);
router.put('/labs/:id/billing', AdminController.overrideBilling);
router.get('/labs/:id/audit', AdminController.getLabAuditLog);

// Platform & Analytics Routes
router.get('/platform/metrics', AdminController.getPlatformMetrics);
router.get('/platform/revenue', AdminController.getPlatformRevenue);

// Feature Flags Routes
router.get('/feature-flags', AdminController.getFeatureFlags);
router.put('/feature-flags/:name', AdminController.updateFeatureFlag);

// Dead Letter Queue Routes
router.get('/dead-letter-queue', AdminController.getDeadLetterQueue);
router.post('/dead-letter-queue/:reportId/retry', AdminController.retryDeadLetterJob);

// Announcement Routes
router.post('/announcements', AdminController.sendAnnouncement);

export default router;
