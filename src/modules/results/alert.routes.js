import { Router } from 'express';
import ResultController from './result.controller.js';
import { publicRateLimit } from '../../middleware/rateLimit.middleware.js';

const router = Router();

// Public route for critical value acknowledgement
router.get('/acknowledge/:alertId', publicRateLimit, ResultController.acknowledgeAlert);

export default router;
