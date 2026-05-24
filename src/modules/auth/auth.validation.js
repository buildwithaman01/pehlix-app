import { z } from 'zod';
import { sendError } from '../../utils/response.js';

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().length(10).regex(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' }).optional(),
    email: z.string().email({ message: 'Invalid email address' }).optional()
  }).refine((data) => data.phone || data.email, {
    message: 'Either email or phone number is required',
    path: ['phone']
  })
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().length(10).regex(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' }).optional(),
    email: z.string().email({ message: 'Invalid email address' }).optional(),
    otp: z.string().length(6).regex(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  }).refine((data) => data.phone || data.email, {
    message: 'Either email or phone number is required',
    path: ['phone']
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' })
  })
});

/**
 * Middleware to validate incoming request data against a Zod schema.
 * Parses req.body, req.query, and req.params.
 * On validation failure, returns standard VALIDATION_FAILED error.
 */
export function validateRequest(schema) {
  return async (req, res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.reduce((acc, err) => {
          const field = err.path.slice(1).join('.') || 'field';
          acc[field] = err.message;
          return acc;
        }, {});
        
        return sendError(res, 'VALIDATION_FAILED', 'Validation failed', details, 400);
      }
      next(error);
    }
  };
}
