import { z } from 'zod';
import { sendError } from '../../utils/response.js';

export const createDoctorSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    phone: z.string().length(10, 'Phone must be exactly 10 digits').regex(/^\d{10}$/, 'Phone must contain only numbers'),
    qualification: z.string().trim().optional(),
    email: z.string().email('Invalid email format').trim().optional().or(z.literal('')),
    specialization: z.string().trim().optional(),
    registrationNumber: z.string().trim().optional(),
    commissionType: z.enum(['percentage', 'flat', 'none']).default('none'),
    commissionValue: z.number().min(0, 'Commission value must be at least 0').default(0),
    portalAccess: z.boolean().default(false)
  })
});

export const updateDoctorSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').trim().optional(),
    phone: z.string().length(10, 'Phone must be exactly 10 digits').regex(/^\d{10}$/, 'Phone must contain only numbers').optional(),
    qualification: z.string().trim().optional(),
    email: z.string().email('Invalid email format').trim().optional().or(z.literal('')),
    specialization: z.string().trim().optional(),
    registrationNumber: z.string().trim().optional(),
    commissionType: z.enum(['percentage', 'flat', 'none']).optional(),
    commissionValue: z.number().min(0, 'Commission value must be at least 0').optional(),
    portalAccess: z.boolean().optional()
  })
});

export const payCommissionSchema = z.object({
  body: z.object({
    commissionIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid commission ID format')).min(1, 'At least one commission ID is required'),
    amount: z.number().positive('Amount must be a positive number'),
    month: z.number().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
    year: z.number().min(2024, 'Year must be 2024 or later'),
    paymentReference: z.string().optional(),
    notes: z.string().optional()
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
