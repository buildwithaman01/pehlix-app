import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { otpRateLimit, loginRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateRequest, sendOtpSchema, verifyOtpSchema, loginSchema } from './auth.validation.js';

const router = Router();

// OTP send endpoint with rate limiting and phone number validation
router.post('/send-otp', otpRateLimit, validateRequest(sendOtpSchema), AuthController.sendOtp);

// OTP verification endpoint with rate limiting and code validation
router.post('/verify-otp', otpRateLimit, validateRequest(verifyOtpSchema), AuthController.verifyOtp);

// Staff password login endpoint with login rate limiting and credential validation
router.post('/login', loginRateLimit, validateRequest(loginSchema), AuthController.login);

// Token refresh endpoint (reads secure cookie)
router.post('/refresh', AuthController.refresh);

// Log out endpoint (invalidates tokens via DB state check)
router.post('/logout', authenticate, AuthController.logout);

export default router;
export { router as authRouter };
