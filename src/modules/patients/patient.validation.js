import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

const addressSchema = z.object({
  street: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional()
});

export const createPatientSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters').trim(),
    lastName: z.string().trim().optional(),
    phone: z.string().length(10, 'Phone must be exactly 10 digits').regex(/^\d{10}$/, 'Phone must contain only numbers'),
    age: z.number().positive('Age must be a positive number'),
    ageUnit: z.enum(['years', 'months', 'days']),
    gender: z.enum(['male', 'female', 'other']),
    email: z.string().email('Invalid email format').trim().optional().or(z.literal('')),
    address: addressSchema.optional(),
    bloodGroup: z.string().trim().optional(),
    referredBy: z.string().regex(mongoIdRegex, 'Invalid referredBy doctor ID').optional().or(z.literal('')),
    familyAccountId: z.string().regex(mongoIdRegex, 'Invalid familyAccountId').optional().or(z.literal('')),
    consentGiven: z.literal(true, {
      errorMap: () => ({ message: 'Patient consent must be given' })
    })
  })
});

export const updatePatientSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters').trim().optional(),
    lastName: z.string().trim().optional(),
    phone: z.string().length(10, 'Phone must be exactly 10 digits').regex(/^\d{10}$/, 'Phone must contain only numbers').optional(),
    age: z.number().positive('Age must be a positive number').optional(),
    ageUnit: z.enum(['years', 'months', 'days']).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    email: z.string().email('Invalid email format').trim().optional().or(z.literal('')),
    address: addressSchema.optional(),
    bloodGroup: z.string().trim().optional(),
    referredBy: z.string().regex(mongoIdRegex, 'Invalid referredBy doctor ID').optional().or(z.literal('')),
    familyAccountId: z.string().regex(mongoIdRegex, 'Invalid familyAccountId').optional().or(z.literal('')),
    consentGiven: z.boolean().optional()
  })
});

export const searchPatientSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query must not be empty'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(10)
  })
});

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
