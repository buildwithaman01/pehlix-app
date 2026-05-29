import { Router } from 'express';
import StaffController from './staff.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply auth + tenant check to all staff endpoints
router.use(authenticate);
router.use(verifyTenant);

// List staff
router.get('/', authorize('owner', 'receptionist', 'pathologist', 'technician'), StaffController.getStaff);

// Create new staff member
router.post('/', authorize('owner'), StaffController.createStaff);

// Update staff details / toggle active status
router.patch('/:id', authorize('owner'), StaffController.updateStaff);
router.put('/:id', authorize('owner'), StaffController.updateStaff);

// Signature upload URL generator for pathologist
router.put('/:id/signature', authorize('owner', 'pathologist'), StaffController.getSignatureUploadUrl);

export default router;
