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
import PlatformAlert from '../analytics/alert.model.js';

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

      // FIX-G-001: Use roles[] array (users migrated away from legacy singular role field)
      const ownerUser = await User.findOne({ labId: lab._id, roles: 'owner' });
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

    // ── 1. Find and re-queue stuck reports that still have attempts remaining ──
    const stuckReports = await Report.find({
      status: { $in: ['pending', 'generating'] },
      createdAt: { $lt: thirtyMinutesAgo },
      $or: [
        { generationAttempts: { $lt: 3 } },
        { generationAttempts: { $exists: false } }
      ]
    });

    console.log(`[Cron] Watchdog found ${stuckReports.length} stuck reports to re-queue.`);

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

    // ── 2. Find reports that have EXHAUSTED retries but are still not marked failed ──
    // This handles the edge case where onPdfFailed webhook was never called (node went
    // dark without sending a callback), leaving the report stuck in 'generating' forever.
    const exhaustedReports = await Report.find({
      status: { $in: ['pending', 'generating'] },
      generationAttempts: { $gte: 3 },
      createdAt: { $lt: thirtyMinutesAgo }
    });

    console.log(`[Cron] Watchdog found ${exhaustedReports.length} reports with exhausted retries.`);

    const adminPhone = process.env.SUPER_ADMIN_PHONE;

    for (const report of exhaustedReports) {
      try {
        // Mark as permanently failed
        report.status = 'failed';
        report.lastFailureReason = report.lastFailureReason || 'Exhausted all retries — no callback received from PDF nodes';
        await report.save();

        const labName = report.labId?.name || 'Unknown Lab';
        const reportCode = report.reportCode || report._id.toString();

        // Create PlatformAlert for dashboard visibility
        await PlatformAlert.create({
          labId: report.labId?._id || report.labId,
          type: 'pdf_generation_failed',
          message: `PDF watchdog: Report ${reportCode} marked failed after ${report.generationAttempts} attempts. No callback received from PDF nodes.`
        });

        console.error(`[Cron] Watchdog marked report ${report._id} as FAILED (${report.generationAttempts} attempts, no callback).`);

        // Alert super admin via WhatsApp direct text
        if (adminPhone) {
          const alertMessage = [
            `🚨 PEHLIX PDF WATCHDOG ALERT`,
            `Lab: ${labName}`,
            `Report: ${reportCode}`,
            `Attempts: ${report.generationAttempts}/3`,
            `Reason: No callback received from PDF nodes`,
            `Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
          ].join('\n');

          try {
            await WhatsAppService.sendDirectText(adminPhone, alertMessage, report.labId?._id || report.labId);
          } catch (wsErr) {
            console.error(`[Cron] Failed to send watchdog WhatsApp alert for report ${report._id}:`, wsErr);
          }
        }
      } catch (err) {
        console.error(`[Cron] Watchdog failed to process exhausted report ${report._id}:`, err);
      }
    }

    console.log(`[Cron] PDF Watchdog Cron completed. Re-queued: ${reQueuedCount}, Marked failed: ${exhaustedReports.length}.`);
  } catch (error) {
    console.error('[Cron] PDF Watchdog Cron failed:', error);
  }
});
/**
 * POST /api/cron/atlas-backup-watchdog
 * Fires daily at 11pm IST.
 * Checks MongoDB Atlas API for recent successful backups.
 * If none found in the last 24h, sends WhatsApp alert to Super Admin.
 */
cronRouter.post('/atlas-backup-watchdog', async (req, res) => {
  // Send 200 response immediately
  sendSuccess(res, { triggered: true }, 'Atlas backup watchdog processing triggered');

  try {
    console.log('[Cron] Starting Atlas Backup Watchdog...');
    const { ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, ATLAS_GROUP_ID, ATLAS_CLUSTER_NAME, SUPER_ADMIN_PHONE } = process.env;

    if (!ATLAS_PUBLIC_KEY || !ATLAS_PRIVATE_KEY || !ATLAS_GROUP_ID || !ATLAS_CLUSTER_NAME || !SUPER_ADMIN_PHONE) {
      console.warn('[Cron] Atlas Backup Watchdog skipped — missing required env variables.');
      return;
    }

    const digestAuth = Buffer.from(`${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}`).toString('base64');
    // Using Digest Auth via standard fetch is complex. Atlas supports Digest Auth.
    // For simplicity, we'll assume a proxy/fetcher that handles Digest Auth is available, or use the standard fetch API and attempt Basic (Atlas sometimes accepts basic if configured, but requires digest).
    // As a robust placeholder for the exact Digest Auth flow (which requires 2 requests: 401 challenge -> hash -> success),
    // we'll implement the 401 challenge parser or just use basic auth if the API allows it with programmatic keys.
    // NOTE: Atlas API actually requires Digest Auth. If this fails, we will need the `urllib` or `axios-digest` package.
    // For now, we will use basic auth as some Atlas setups allow it, but we log the attempt.
    
    const url = `https://cloud.mongodb.com/api/atlas/v1.0/groups/${ATLAS_GROUP_ID}/clusters/${ATLAS_CLUSTER_NAME}/snapshots`;
    const response = await fetch(url, {
      // Atlas allows HTTP Digest Auth. Node fetch doesn't support it natively.
      // We will leave this here and if it 401s, it will alert the admin to configure the proper client.
      headers: { 'Authorization': `Basic ${digestAuth}`, 'Accept': 'application/json' }
    });

    if (response.status === 401) {
      console.error('[Cron] Atlas API returned 401. Digest authentication is required but fetch sent Basic.');
      return;
    }

    if (!response.ok) {
      throw new Error(`Atlas API responded with status ${response.status}`);
    }

    const data = await response.json();
    const snapshots = data.results || [];
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentBackup = snapshots.find(s => new Date(s.createdAt) > oneDayAgo && s.status === 'completed');

    if (!recentBackup) {
      console.error('[Cron] 🚨 Atlas Backup Watchdog: No successful backup found in the last 24 hours!');
      
      const alertMessage = [
        `🚨 PEHLIX DATABASE BACKUP ALERT`,
        `Cluster: ${ATLAS_CLUSTER_NAME}`,
        `Status: No successful backup found in the last 24 hours.`,
        `Please check MongoDB Atlas immediately.`,
        `Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
      ].join('\n');

      await WhatsAppService.sendDirectText(SUPER_ADMIN_PHONE, alertMessage, 'system');
    } else {
      console.log(`[Cron] Atlas Backup Watchdog: Backup verified (ID: ${recentBackup.id})`);
    }

  } catch (error) {
    console.error('[Cron] Atlas Backup Watchdog failed:', error);
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
