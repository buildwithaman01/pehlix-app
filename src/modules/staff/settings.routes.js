import { Router } from 'express';
import SettingsController from './settings.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply auth + tenant check + owner only access
router.use(authenticate);
router.use(verifyTenant);
router.use(authorize('owner'));

router.get('/', SettingsController.getSettings);
router.put('/', SettingsController.updateSettings);
router.patch('/', SettingsController.updateSettings);

export default router;
