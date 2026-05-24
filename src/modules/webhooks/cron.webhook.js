import { Router } from 'express';
import mongoose from 'mongoose';
import DoctorService from '../doctors/doctor.service.js';
import AnalyticsService from '../analytics/analytics.service.js';
import Invoice from '../billing/invoice.model.js';
import Notification from '../notifications/notification.model.js';
import InventoryItem from '../inventory/inventoryItem.model.js';
import Lab from '../staff/lab.model.js';
import User from '../staff/user.model.js';
import WhatsAppService from '../../utils/whatsapp.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import Report from '../reports/report.model.js';
import ReportService from '../reports/report.service.js';

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
  let targetMonth = now.getMonth();
  let targetYear = now.getFullYear();

  if (targetMonth === 0) {
    targetMonth = 12;
    targetYear -= 1;
  }

  if (req.body.month !== undefined) targetMonth = Number(req.body.month);
  if (req.body.year !== undefined) targetYear = Number(req.body.year);

  sendSuccess(res, { queued: true, month: targetMonth, year: targetYear }, 'Monthly commission statements processing triggered');

  try {
    console.log(`[Cron] Starting statement cron for month: ${targetMonth}, year: ${targetYear}`);
    const result = await DoctorService.runMonthlyStatementCron(targetMonth, targetYear);
    console.log('[Cron] Statement cron completed successfully:', result);
  } catch (error) {
    console.error('[Cron] Statement cron failed in background:', error);
  }
});

/**
 * POST /api/cron/daily-summary
 * Fires at 9:30pm IST daily.
 * Triggers owner summary WhatsApp notifications.
 */
cronRouter.post('/daily-summary', async (req, res) => {
  sendSuccess(res, { queued: true }, 'Daily summary notifications processing triggered');

  try {
    console.log('[Cron] Starting Daily WhatsApp Summary Cron...');
    const result = await AnalyticsService.runDailySummaryForAllLabs();
    console.log('[Cron] Daily WhatsApp Summary Cron completed successfully:', result);
  } catch (error) {
    console.error('[Cron] Daily WhatsApp Summary Cron failed:', error);
  }
});

/**
 * POST /api/cron/health-score-update
 * Fires at 2am IST daily.
 * Calculates and updates lab health scores.
 */
cronRouter.post('/health-score-update', async (req, res) => {
  sendSuccess(res, { queued: true }, 'Lab health score update processing triggered');

  try {
    console.log('[Cron] Starting Lab Health Score Update Cron...');
    const result = await AnalyticsService.runHealthScoreUpdate();
    console.log('[Cron] Lab Health Score Update Cron completed successfully:', result);
  } catch (error) {
    console.error('[Cron] Lab Health Score Update Cron failed:', error);
  }
});

/**
 * POST /api/cron/payment-reminders
 * Fires twice daily — 10am and 5pm IST.
 * Evaluates pending payments and sends 1-day, 3-day, and 7-day payment reminder templates.
 */
cronRouter.post('/payment-reminders', async (req, res) => {
  sendSuccess(res, { queued: true }, 'Payment reminders processing triggered');

  try {
    console.log('[Cron] Starting Payment Reminders Cron...');
    
    // Find all invoices with pending/partial paymentStatus and labId
    const invoices = await Invoice.find({
      paymentStatus: { $in: ['pending', 'partial'] },
      labId: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    }).populate('patientId');

    const now = new Date();
    let d1Count = 0;
    let d3Count = 0;
    let d7Count = 0;

    const labCache = {};
    const getLabName = async (labId) => {
      const idStr = labId.toString();
      if (labCache[idStr]) return labCache[idStr];
      const lab = await Lab.findById(labId);
      if (lab) {
        labCache[idStr] = lab.name;
        return lab.name;
      }
      return 'Our Lab';
    };

    for (const invoice of invoices) {
      const diffTime = Math.abs(now - invoice.createdAt);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let templateName = null;
      if (diffDays === 1) {
        templateName = 'payment_reminder_d1';
      } else if (diffDays === 3) {
        templateName = 'payment_reminder_d3';
      } else if (diffDays === 7) {
        templateName = 'payment_reminder_d7';
      }

      if (!templateName) continue;

      const patient = invoice.patientId;
      if (!patient || !patient.phone) continue;

      // Only send if not already sent
      const existingNotification = await Notification.findOne({
        templateName,
        'variables.invoiceId': invoice._id
      });

      if (existingNotification) {
        continue;
      }

      const labName = await getLabName(invoice.labId);
      const patientName = patient.firstName 
        ? `${patient.firstName} ${patient.lastName || ''}`.trim() 
        : 'Patient';

      const balanceAmountVal = invoice.balanceAmount !== undefined 
        ? invoice.balanceAmount 
        : (invoice.totalAmount - invoice.amountPaid);

      const variables = {
        patientName,
        pendingAmount: formatCurrency(balanceAmountVal),
        paymentLink: invoice.razorpayPaymentLinkUrl || '',
        labName,
        invoiceId: invoice._id,
        labId: invoice.labId
      };

      try {
        await WhatsAppService.send(patient.phone, templateName, variables);
        
        if (templateName === 'payment_reminder_d1') d1Count++;
        else if (templateName === 'payment_reminder_d3') d3Count++;
        else if (templateName === 'payment_reminder_d7') d7Count++;
      } catch (err) {
        console.error(`[Cron] Failed to send ${templateName} to ${patient.phone} for invoice ${invoice._id}:`, err);
      }
    }

    console.log(`[Cron] Payment reminders sent: D1: ${d1Count}, D3: ${d3Count}, D7: ${d7Count}`);
  } catch (error) {
    console.error('[Cron] Payment reminders failed:', error);
  }
});

/**
 * POST /api/cron/low-stock-alerts
 * Fires at 8am IST daily.
 * Checks inventory stock limits and warns owners.
 */
cronRouter.post('/low-stock-alerts', async (req, res) => {
  sendSuccess(res, { queued: true }, 'Low stock alerts processing triggered');

  try {
    console.log('[Cron] Starting Low Stock Alerts Cron...');
    const lowStockItems = await InventoryItem.find({
      isDeleted: { $ne: true },
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    });

    const grouped = {};
    lowStockItems.forEach(item => {
      const lId = item.labId.toString();
      if (!grouped[lId]) grouped[lId] = [];
      grouped[lId].push(item);
    });

    let alertsSent = 0;

    for (const [labIdStr, items] of Object.entries(grouped)) {
      const lab = await Lab.findById(labIdStr);
      if (!lab || !lab.isActive || lab.isSuspended) continue;

      const ownerUser = await User.findOne({ labId: lab._id, role: 'owner' });
      const phone = ownerUser?.phone || lab.phone;

      if (!phone) {
        console.log(`[Cron] Skipped low stock alerts for lab ${lab.name} - No phone found`);
        continue;
      }

      const itemsListStr = items.map(item => `- ${item.name} (Stock: ${item.currentStock}, Min: ${item.minimumStock})`).join('\n');
      const message = `Low Stock Alert for ${lab.name}:\nThe following inventory items are below their minimum threshold:\n${itemsListStr}`;

      try {
        await WhatsAppService.sendDirectText(phone, message, lab._id);
        alertsSent++;
      } catch (err) {
        console.error(`[Cron] Failed to send low stock alert to owner of lab ${lab.name}:`, err);
      }
    }

    console.log(`[Cron] Low stock alerts sent to ${alertsSent} labs.`);
  } catch (error) {
    console.error('[Cron] Low stock alerts cron failed:', error);
  }
});

/**
 * POST /api/cron/pdf-watchdog
 * Fires every 30 minutes to recover stuck reports.
 * Validates CRON_SECRET middleware.
 */
cronRouter.post('/pdf-watchdog', async (req, res) => {
  // Send 200 response immediately as requested
  sendSuccess(res, { triggered: true }, 'PDF watchdog background processing triggered');

  try {
    console.log('[Cron] Starting PDF Watchdog Cron...');
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find reports stuck in 'pending' or 'generating' created > 30 mins ago
    const stuckReports = await Report.find({
      status: { $in: ['pending', 'generating'] },
      createdAt: { $lt: thirtyMinutesAgo },
      $or: [
        { generationAttempts: { $lt: 3 } },
        { generationAttempts: { $exists: false } }
      ]
    });

    console.log(`[Cron] Watchdog found ${stuckReports.length} stuck reports.`);

    let reQueuedCount = 0;
    for (const report of stuckReports) {
      try {
        await ReportService.triggerPdfGeneration(report._id);
        console.log(`[Cron] Watchdog re-queued stuck report ${report._id}`);
        reQueuedCount++;
      } catch (err) {
        console.error(`[Cron] Watchdog failed to re-queue report ${report._id}:`, err);
      }
    }

    console.log(`[Cron] PDF Watchdog Cron completed. Re-queued ${reQueuedCount} reports.`);
  } catch (error) {
    console.error('[Cron] PDF Watchdog Cron failed:', error);
  }
});

function formatCurrency(amount) {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });
  return formatter.format(amount || 0).replace('INR', '₹').replace(/\s/g, '');
}

export default cronRouter;
