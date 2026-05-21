import crypto from 'crypto';
import QStashService from '../../utils/qstash.js';
import { config } from '../../config/index.js';

/**
 * Handles incoming Razorpay webhook events.
 * Bypasses standard auth, verifies the signature, and enqueues background processing.
 */
export const razorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Signature missing' });
    }

    const webhookSecret = config.RAZORPAY_WEBHOOK_SECRET || '';
    
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const bodyPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    hmac.update(bodyPayload);
    const generatedSignature = hmac.digest('hex');

    // Also support checking signature matching directly for raw verification if needed
    if (generatedSignature !== signature) {
      // In case of minor json formatting differences, log details and reject
      console.warn('[Webhook] Signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Return 200 immediately to Razorpay
    res.status(200).json({ status: 'ok' });

    // Enqueue processing job to background worker via QStash
    const processEndpoint = `${config.NEXT_PUBLIC_APP_URL}/api/internal/payments/process`;
    await QStashService.enqueue(processEndpoint, req.body);
  } catch (error) {
    console.error('Razorpay webhook handler error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
  }
};

export default razorpayWebhook;
