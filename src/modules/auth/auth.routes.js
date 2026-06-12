import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { otpRateLimit, loginRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateRequest, sendOtpSchema, verifyOtpSchema, loginSchema, registerLabSchema } from './auth.validation.js';

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

// Set or update password endpoint for authenticated users (after OTP verification or for profile changes)
router.post('/set-password', authenticate, AuthController.setPassword);

// Laboratory self-registration route (public)
router.post('/register-lab', validateRequest(registerLabSchema), AuthController.registerLab);

// --- Password Reset Flow (self-service, public routes) ---
// Step 1: Request OTP to email
router.post('/forgot-password', loginRateLimit, AuthController.forgotPassword);
// Step 2: Verify OTP → returns one-time reset token
router.post('/verify-reset-otp', loginRateLimit, AuthController.verifyResetOtp);
// Step 3: Set new password using reset token
router.post('/reset-password', loginRateLimit, AuthController.resetPassword);

export default router;
export { router as authRouter };
