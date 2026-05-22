import { Router } from 'express';
import DoctorController from './doctor.controller.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  payCommissionSchema,
  validateRequest
} from './doctor.validation.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Doctor portal routes (require authenticate only, no tenant context as doctors span labs)
router.get('/portal/patients', authenticate, authorize('doctor'), DoctorController.getPortalPatients);
router.get('/portal/commissions', authenticate, authorize('doctor'), DoctorController.getPortalCommissions);

// Lab staff routes (require authenticate → verifyTenant)
router.get('/', authenticate, verifyTenant, authorize('owner', 'receptionist'), DoctorController.getDoctors);
router.post('/', authenticate, verifyTenant, authorize('owner'), validateRequest(createDoctorSchema), DoctorController.createDoctor);
router.get('/:id', authenticate, verifyTenant, authorize('owner', 'receptionist', 'pathologist'), DoctorController.getDoctorById);
router.put('/:id', authenticate, verifyTenant, authorize('owner'), validateRequest(updateDoctorSchema), DoctorController.updateDoctor);
router.get('/:id/patients', authenticate, verifyTenant, authorize('owner', 'pathologist'), DoctorController.getDoctorPatients);
router.get('/:id/commissions', authenticate, verifyTenant, authorize('owner'), DoctorController.getDoctorCommissions);
router.post('/:id/commission/pay', authenticate, verifyTenant, authorize('owner'), validateRequest(payCommissionSchema), DoctorController.payCommission);
router.post('/:id/commission/statement', authenticate, verifyTenant, authorize('owner'), DoctorController.generateStatement);

export default router;
