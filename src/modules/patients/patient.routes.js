import { Router } from 'express';
import PatientController from './patient.controller.js';
import {
  createPatientSchema,
  updatePatientSchema,
  searchPatientSchema,
  validateRequest
} from './patient.validation.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';
import { generalRateLimit } from '../../middleware/rateLimit.middleware.js';

const router = Router();

// Apply middleware chain: authenticate → verifyTenant → authorize('owner', 'receptionist') to all routes
router.use(authenticate);
router.use(verifyTenant);
router.use(authorize('owner', 'receptionist'));

router.get('/', generalRateLimit, validateRequest(searchPatientSchema), PatientController.getPatients);
router.post('/', validateRequest(createPatientSchema), PatientController.createPatient);
router.get('/search', validateRequest(searchPatientSchema), PatientController.searchPatients);
router.get('/autofill', PatientController.autoFill);
router.get('/:id', PatientController.getPatientById);
router.put('/:id', validateRequest(updatePatientSchema), PatientController.updatePatient);
router.get('/:id/history', PatientController.getPatientHistory);

export default router;
