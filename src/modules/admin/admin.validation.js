import { z } from 'zod';
import { sendError } from '../../utils/response.js';

export const createLabSchema = z.object({
  body: z.object({
    labName: z.string().min(3, { message: 'Lab name must be at least 3 characters long' }),
    city: z.string().min(2, { message: 'City is required' }),
    phone: z.string().length(10).regex(/^\d{10}$/, { message: 'Lab phone must be exactly 10 digits' }),
    email: z.string().email({ message: 'Invalid email address' }),
    plan: z.enum(['starter', 'growth', 'pro', 'custom'], { message: 'Invalid plan selected' }),
    ownerName: z.string().min(3, { message: 'Owner name must be at least 3 characters long' }),
    ownerPhone: z.string().length(10).regex(/^\d{10}$/, { message: 'Owner phone must be exactly 10 digits' }),
    ownerEmail: z.string().email({ message: 'Invalid owner email address' })
  })
});

/**
 * Middleware to validate incoming request data against a Zod schema.
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
        const details = (error.issues || error.errors || []).reduce((acc, err) => {
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
