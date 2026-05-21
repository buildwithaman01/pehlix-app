import express from 'express';
import razorpayWebhook from './razorpay.webhook.js';

export const webhookRouter = express.Router();

// Public webhook route without auth middlewares
webhookRouter.post('/razorpay', razorpayWebhook);

export default webhookRouter;
