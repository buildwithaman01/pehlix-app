import { Router } from 'express';
import InventoryController from './inventory.controller.js';
import {
  createItemSchema,
  updateItemSchema,
  adjustStockSchema,
  validateRequest
} from './inventory.validation.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { requireModule } from '../../middleware/module.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply base middleware chain: authenticate → verifyTenant → requireModule('inventory')
router.use(authenticate);
router.use(verifyTenant);
router.use(requireModule('inventory'));

router.get('/', authorize('owner', 'technician', 'pathologist'), InventoryController.getItems);
router.post('/', authorize('owner'), validateRequest(createItemSchema), InventoryController.createItem);
router.get('/alerts', authorize('owner', 'technician'), InventoryController.getAlerts);
router.get('/consumption', authorize('owner'), InventoryController.getConsumption);
router.get('/:id', authorize('owner', 'technician'), InventoryController.getItemById);
router.put('/:id', authorize('owner'), validateRequest(updateItemSchema), InventoryController.updateItem);
router.patch('/:id', authorize('owner'), validateRequest(updateItemSchema), InventoryController.updateItem);
router.post('/:id/adjust', authorize('owner', 'technician'), validateRequest(adjustStockSchema), InventoryController.adjustStock);

export default router;
