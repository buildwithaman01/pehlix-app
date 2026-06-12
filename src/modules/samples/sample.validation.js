import { z } from 'zod';
import { sendError } from '../../utils/response.js';

export const scanBarcodeSchema = z.object({
  body: z.object({
    barcodeId: z.string().min(1, 'Barcode ID is required')
  })
});

export const updateSampleStatusSchema = z.object({
  body: z.object({
    status: z.preprocess((val) => (typeof val === 'string' ? val.toLowerCase() : val), z.enum(['pending', 'collected', 'in_transit', 'received', 'processing', 'stored', 'rejected', 'disposed'])),
    notes: z.string().optional(),
    storageLocation: z.string().optional()
  })
});

export const rejectSampleSchema = z.object({
  body: z.object({
    rejectionReason: z.string().min(5, 'Rejection reason must be at least 5 characters')
  })
});

export function validateRequest(schema) {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      req.body = parsed.body;
      req.query = parsed.query;
      req.params = parsed.params;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues.reduce((acc, err) => {
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
