import { Router } from 'express';
import DoctorService from '../doctors/doctor.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const cronRouter = Router();

// Middleware to validate Authorization: Bearer process.env.CRON_SECRET
cronRouter.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Missing cron authorization header', {}, 401);
  }
  const token = authHeader.split(' ')[1];
  if (token !== process.env.CRON_SECRET) {
    return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Invalid cron authorization token', {}, 401);
  }
  next();
});

/**
 * POST /api/cron/commission-statements
 * Fires on 1st of every month at 7am IST.
 * Generates previous month's statements.
 */
cronRouter.post('/commission-statements', async (req, res) => {
  const now = new Date();
  let targetMonth = now.getMonth(); // 0-11. (e.g. if May, getMonth() is 4, representing April in 1-based)
  let targetYear = now.getFullYear();

  if (targetMonth === 0) {
    targetMonth = 12;
    targetYear -= 1;
  }

  // Allow overriding for manual debugging or testing
  if (req.body.month !== undefined) targetMonth = Number(req.body.month);
  if (req.body.year !== undefined) targetYear = Number(req.body.year);

  // Return 200 immediately, process in background
  sendSuccess(res, { queued: true, month: targetMonth, year: targetYear }, 'Monthly commission statements processing triggered');

  // Perform background processing
  try {
    console.log(`[Cron] Starting statement cron for month: ${targetMonth}, year: ${targetYear}`);
    const result = await DoctorService.runMonthlyStatementCron(targetMonth, targetYear);
    console.log('[Cron] Statement cron completed successfully:', result);
  } catch (error) {
    console.error('[Cron] Statement cron failed in background:', error);
  }
});

/**
 * TODO: Daily Summary Cron (AGENT_11 to fill in)
 * POST /api/cron/daily-summary
 * Fires daily at 9pm IST.
 * Sends daily dashboard summary to lab owners.
 */
// cronRouter.post('/daily-summary', async (req, res) => { ... });

/**
 * TODO: Low Stock Alert Cron (AGENT_11 to fill in)
 * POST /api/cron/low-stock-alert
 * Fires daily at 9am IST.
 * Checks inventory levels and alerts owners.
 */
// cronRouter.post('/low-stock-alert', async (req, res) => { ... });

export default cronRouter;
