import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import WhatsAppOutboxController from './whatsappOutbox.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';
import { getClientIp } from '../../middleware/rateLimit.middleware.js';

const router = Router();

// GAP 9: Polling Rate Limiter - maximum 20 requests per minute per IP in production
const outboxPollRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  skip: () => process.env.NODE_ENV !== 'production',
  message: {
    status: 'error',
    code: 'OUTBOX_POLL_RATE_LIMIT_EXCEEDED',
    message: 'Too many polling requests. Rate limit is 20 requests per minute.'
  }
});

// Middleware pipeline: must be authenticated, verified tenant, and be an owner or receptionist
router.use(authenticate);
router.use(verifyTenant);
router.use(authorize('owner', 'receptionist'));

// Routes
router.get('/', outboxPollRateLimit, WhatsAppOutboxController.getOutbox);
router.get('/stats', outboxPollRateLimit, WhatsAppOutboxController.getOutboxStats);
router.patch('/:id/sent', WhatsAppOutboxController.markSent);
router.post('/:id/retry', WhatsAppOutboxController.retryGeneration);

export default router;
