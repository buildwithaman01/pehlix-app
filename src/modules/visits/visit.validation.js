import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

export const createVisitSchema = z.object({
  body: z.object({
    patientId: z.string().regex(mongoIdRegex, 'Invalid patient ID'),
    visitType: z.enum(['walkIn', 'homeCollection', 'centerPickup']),
    tests: z.array(z.string().regex(mongoIdRegex, 'Invalid test ID')).min(1, 'At least one test must be selected'),
    referredBy: z.string().regex(mongoIdRegex, 'Invalid referredBy doctor ID').optional().or(z.literal('')),
    notes: z.string().trim().optional(),
    scheduledDate: z.preprocess((val) => {
      if (!val) return undefined;
      const date = new Date(val);
      return isNaN(date.getTime()) ? undefined : date;
    }, z.date().optional())
  })
});

export const addTestsSchema = z.object({
  body: z.object({
    tests: z.array(z.string().regex(mongoIdRegex, 'Invalid test ID')).min(1, 'At least one test must be specified')
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
