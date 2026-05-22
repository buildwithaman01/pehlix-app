import { z } from 'zod';
import { sendError } from '../../utils/response.js';

export const createHomeCollectionSchema = z.object({
  body: z.object({
    visitId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid visit ID format'),
    patientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid patient ID format'),
    assignedPhlebotomist: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid phlebotomist ID format'),
    scheduledDate: z.coerce.date({ required_error: 'Scheduled date is required' }),
    timeSlot: z.enum(['7-9am', '9-11am', '11am-1pm', '2-4pm', '4-6pm'], {
      errorMap: () => ({ message: 'Invalid time slot' })
    }),
    address: z.object({
      street: z.string().min(1, 'Street address is required').trim(),
      city: z.string().trim().optional(),
      state: z.string().trim().optional(),
      pincode: z.string().trim().optional(),
      landmark: z.string().trim().optional()
    }),
    notes: z.string().trim().optional()
  })
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['scheduled', 'enroute', 'arrived', 'collected', 'patientAbsent', 'cancelled'], {
      errorMap: () => ({ message: 'Invalid status' })
    }),
    gpsCoordinates: z.object({
      lat: z.number(),
      lng: z.number()
    }).optional(),
    notes: z.string().trim().optional(),
    cashCollected: z.number().min(0).optional()
  })
});

export const offlineSyncSchema = z.object({
  body: z.object({
    actions: z.array(
      z.object({
        homeCollectionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid home collection ID format'),
        status: z.enum(['scheduled', 'enroute', 'arrived', 'collected', 'patientAbsent', 'cancelled']),
        gpsCoordinates: z.object({
          lat: z.number(),
          lng: z.number()
        }).optional(),
        notes: z.string().trim().optional(),
        cashCollected: z.number().min(0).optional(),
        offlineCreatedAt: z.coerce.date()
      })
    ).min(1, 'Actions array cannot be empty')
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
