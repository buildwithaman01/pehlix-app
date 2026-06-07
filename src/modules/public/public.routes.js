import express from 'express';
import { PublicController } from './public.controller.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for public endpoints to prevent abuse
const generalPublicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 bookings per hour
  message: 'Too many bookings created from this IP, please try again after an hour'
});

// GET lab metadata and catalog by slug
router.get('/labs/:slug', generalPublicLimiter, PublicController.getLabBySlug);

// POST create booking
router.post('/bookings', bookingLimiter, PublicController.createBooking);

export default router;
