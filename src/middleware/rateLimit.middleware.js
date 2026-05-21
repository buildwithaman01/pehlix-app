import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for OTP requests: max 3 requests per 15 minutes per IP.
 */
export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'AUTH_OTP_MAX_ATTEMPTS',
    message: 'Too many OTP requests'
  }
});

/**
 * Rate limiter for login requests: max 5 requests per 15 minutes per IP.
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'AUTH_OTP_MAX_ATTEMPTS',
    message: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

/**
 * General rate limiter: max 100 requests per minute per IP.
 */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'SYSTEM_RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again after 1 minute.'
  }
});

/**
 * Public endpoint rate limiter (e.g. report verification): max 30 requests per minute per IP.
 */
export const publicRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'SYSTEM_RATE_LIMIT_EXCEEDED',
    message: 'Too many requests on report verification endpoint. Please try again later.'
  }
});
