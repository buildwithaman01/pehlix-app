import { z } from 'zod';
import { sendError } from '../../utils/response.js';

export const createItemSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').trim(),
    category: z.enum(['reagent', 'consumable', 'equipment', 'stationery', 'other'], {
      errorMap: () => ({ message: 'Invalid category' })
    }),
    unit: z.string().min(1, 'Unit is required').trim(),
    minimumStock: z.number().min(0, 'Minimum stock must be at least 0').default(10),
    currentStock: z.number().min(0).default(0).optional(),
    reorderQuantity: z.number().min(0).default(50).optional(),
    costPerUnit: z.number().min(0).default(0).optional(),
    supplier: z.object({
      name: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      email: z.string().trim().optional()
    }).optional(),
    barcodeId: z.string().trim().optional(),
    location: z.string().trim().optional(),
    expiryDate: z.coerce.date().optional(),
    reagentConsumption: z.array(
      z.object({
        testId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid test ID format'),
        quantityPerTest: z.number().positive('Quantity per test must be positive')
      })
    ).optional()
  })
});

export const updateItemSchema = z.object({
  body: z.object({
    name: z.string().min(1).trim().optional(),
    category: z.enum(['reagent', 'consumable', 'equipment', 'stationery', 'other']).optional(),
    unit: z.string().min(1).trim().optional(),
    minimumStock: z.number().min(0).optional(),
    currentStock: z.number().min(0).optional(),
    reorderQuantity: z.number().min(0).optional(),
    costPerUnit: z.number().min(0).optional(),
    supplier: z.object({
      name: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      email: z.string().trim().optional()
    }).optional(),
    barcodeId: z.string().trim().optional(),
    location: z.string().trim().optional(),
    expiryDate: z.coerce.date().optional(),
    reagentConsumption: z.array(
      z.object({
        testId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid test ID format'),
        quantityPerTest: z.number().positive()
      })
    ).optional(),
    isActive: z.boolean().optional(),
    isDeleted: z.boolean().optional()
  })
});

export const adjustStockSchema = z.object({
  body: z.object({
    quantityChange: z.number().refine(val => val !== 0, { message: 'Quantity change cannot be zero' }),
    type: z.enum(['purchase', 'adjustment', 'expiry', 'transfer']),
    notes: z.string().optional(),
    purchaseOrderNumber: z.string().optional()
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
