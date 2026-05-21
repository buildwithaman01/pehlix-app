import { z } from 'zod';
import { sendError } from '../../utils/response.js';

export const submitResultSchema = z.object({
  body: z.object({
    visitId: z.string().min(1, 'Visit ID is required'),
    testId: z.string().min(1, 'Test ID is required'),
    sampleId: z.string().optional(),
    parameters: z.array(
      z.object({
        parameterName: z.string().min(1, 'Parameter name is required'),
        value: z.union([z.string(), z.number()]),
        unit: z.string().optional(),
        isOverride: z.boolean().optional().default(false),
        overrideReason: z.string().optional()
      })
    ).min(1, 'At least one parameter result is required')
  })
});

export const updateResultSchema = z.object({
  body: z.object({
    visitId: z.string().optional(),
    testId: z.string().optional(),
    sampleId: z.string().optional(),
    parameters: z.array(
      z.object({
        parameterName: z.string().min(1, 'Parameter name is required'),
        value: z.union([z.string(), z.number()]),
        unit: z.string().optional(),
        isOverride: z.boolean().optional().default(false),
        overrideReason: z.string().optional()
      })
    ).min(1, 'At least one parameter result is required')
  })
});

export const flagCriticalSchema = z.object({
  body: z.object({
    confirmed: z.boolean({
      required_error: 'Confirmation is required'
    })
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
