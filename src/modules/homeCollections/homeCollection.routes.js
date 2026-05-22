import { Router } from 'express';
import HomeCollectionController from './homeCollection.controller.js';
import {
  createHomeCollectionSchema,
  updateStatusSchema,
  offlineSyncSchema,
  validateRequest
} from './homeCollection.validation.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { requireModule } from '../../middleware/module.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply base middleware chain: authenticate → verifyTenant
router.use(authenticate);
router.use(verifyTenant);

// Get all home collections (for owner/receptionist)
router.get('/', authorize('owner', 'receptionist'), requireModule('homeCollections'), HomeCollectionController.getHomeCollections);

// Create home collection booking (for owner/receptionist)
router.post('/', authorize('owner', 'receptionist'), requireModule('homeCollections'), validateRequest(createHomeCollectionSchema), HomeCollectionController.createHomeCollection);

// Get phlebotomist's jobs (specifically for logged in phlebotomist or owner query)
router.get('/my-jobs', authorize('phlebotomist', 'owner'), requireModule('homeCollections'), HomeCollectionController.getPhlebotomistJobs);
router.get('/phlebotomist', authorize('phlebotomist', 'owner'), requireModule('homeCollections'), HomeCollectionController.getPhlebotomistJobs);

// Offline synchronization endpoint (for phlebotomists)
router.post('/sync', authorize('phlebotomist'), requireModule('homeCollections'), validateRequest(offlineSyncSchema), HomeCollectionController.processOfflineSync);

// Update home collection status
router.put('/:id/status', authorize('phlebotomist', 'owner'), requireModule('homeCollections'), validateRequest(updateStatusSchema), HomeCollectionController.updateStatus);

// Force collected status (alternative endpoint)
router.post('/:id/collect', authorize('phlebotomist', 'owner'), requireModule('homeCollections'), (req, res, next) => {
  req.body.status = 'collected';
  // Let's validate before controller
  validateRequest(updateStatusSchema)(req, res, next);
}, HomeCollectionController.updateStatus);

export default router;
