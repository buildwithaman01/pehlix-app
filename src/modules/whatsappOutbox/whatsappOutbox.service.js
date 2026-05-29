import mongoose from 'mongoose';
import { Redis } from '@upstash/redis';
import WhatsAppOutbox from './whatsappOutbox.model.js';
import WhatsAppLinkService from '../../utils/whatsappLink.js';
import R2Service from '../../utils/r2.js';
import config from '../../config/index.js';
import { AppError } from '../../utils/errors.js';
import Invoice from '../billing/invoice.model.js';
import WhatsAppService from '../../utils/whatsapp.js';

// Initialize Redis client for stats caching
const redis = new Redis({
  url: config.UPSTASH_REDIS_URL,
  token: config.UPSTASH_REDIS_TOKEN
});

const STATS_CACHE_PREFIX = 'outbox-stats:';
const CACHE_TTL = 30; // 30 seconds

/**
 * Service to manage the manual WhatsApp Outbox queue.
 */
export const WhatsAppOutboxService = {
  /**
   * Helper to invalidate the stats cache for a lab.
   */
  async invalidateStatsCache(labId) {
    try {
      const cacheKey = `${STATS_CACHE_PREFIX}${labId.toString()}`;
      await redis.del(cacheKey);
      console.log(`[WhatsAppOutboxService] Invalidated stats cache for lab: ${labId}`);
    } catch (err) {
      console.error('[WhatsAppOutboxService] Failed to invalidate stats cache:', err.message);
    }
  },

  /**
   * Creates a new outbox entry when a report is approved.
   * Deduplicates by reportId to prevent double-clicks/duplicate rows.
   */
  async createOutboxEntry(labId, visitId, patientId, reportId, invoiceData, patientData, testNames) {
    // 1. Deduplication (GAP 4)
    const existing = await WhatsAppOutbox.findOne({ reportId, labId });
    if (existing) {
      console.log(`[WhatsAppOutboxService] Outbox entry already exists for report: ${reportId}. Returning existing.`);
      return existing;
    }

    const patientName = `${patientData.firstName} ${patientData.lastName || ''}`.trim();
    const balanceAmount = invoiceData.balanceAmount !== undefined 
      ? invoiceData.balanceAmount 
      : (invoiceData.totalAmount - invoiceData.amountPaid);

    // Get payment link if present
    const paymentLink = invoiceData.razorpayPaymentLinkUrl || `${config.NEXT_PUBLIC_APP_URL}/pay/${invoiceData._id}`;

    const outbox = new WhatsAppOutbox({
      labId,
      visitId,
      patientId,
      reportId,
      patientName,
      testNames,
      invoiceTotal: invoiceData.totalAmount || 0,
      amountPaid: invoiceData.amountPaid || 0,
      balanceAmount,
      paymentLink,
      pdfStatus: 'generating',
      status: 'queued'
    });

    const savedOutbox = await outbox.save();
    
    // Invalidate stats cache
    await this.invalidateStatsCache(labId);

    return savedOutbox;
  },

  /**
   * Called when PDF is generated to update outbox row and compute waLink.
   */
  async updatePdfReady(reportId, pdfUrl, signedUrl, signedUrlExpiry) {
    const entry = await WhatsAppOutbox.findOne({ reportId }).populate(['patientId', 'labId']);
    if (!entry) {
      console.warn(`[WhatsAppOutboxService] Outbox entry not found for report: ${reportId}`);
      return null;
    }

    entry.pdfStatus = 'ready';
    entry.pdfUrl = pdfUrl;
    entry.signedUrl = signedUrl;
    entry.signedUrlExpiry = signedUrlExpiry;

    // Generate pre-filled waLink based on payment status
    let messageText = '';
    const patient = entry.patientId;
    const lab = entry.labId;
    
    if (entry.balanceAmount > 0) {
      messageText = WhatsAppLinkService.generatePaymentRequest(patient, lab, entry, entry.paymentLink);
    } else {
      messageText = WhatsAppLinkService.generateReportReady(patient, lab, entry, signedUrl);
    }

    entry.waLink = messageText;
    const updated = await entry.save();

    // Invalidate stats cache
    await this.invalidateStatsCache(entry.labId);

    return updated;
  },

  /**
   * Sets outbox entry state to failed if PDF generation fails.
   */
  async markGenerationFailed(reportId) {
    const entry = await WhatsAppOutbox.findOne({ reportId });
    if (!entry) {
      console.warn(`[WhatsAppOutboxService] Outbox entry not found for report failure: ${reportId}`);
      return null;
    }

    entry.pdfStatus = 'failed';
    const updated = await entry.save();

    // Invalidate stats cache
    await this.invalidateStatsCache(entry.labId);

    return updated;
  },

  /**
   * Fetch outbox rows for a lab with filters and pagination.
   * Handles signed URL expiry refresh on load.
   */
  async getOutboxForLab(labId, statusFilter, page = 1, limit = 20, cursor = null) {
    const query = { labId, isDeleted: { $ne: true } };

    if (statusFilter === 'ready') {
      query.status = 'queued';
      query.pdfStatus = 'ready';
    } else if (statusFilter === 'generating') {
      query.status = 'queued';
      query.pdfStatus = 'generating';
    } else if (statusFilter === 'failed') {
      query.status = 'queued';
      query.pdfStatus = 'failed';
    } else if (statusFilter === 'pending_payment') {
      query.status = 'queued';
      query.balanceAmount = { $gt: 0 };
    } else if (statusFilter === 'sent') {
      query.status = 'sent';
    } else {
      // 'all' or default -> show all active queued or sent items
      // Let's just exclude failed outbox items from default view unless clicked
    }

    let rawEntries;
    let hasNextPage = false;
    let nextCursor = null;
    let total = 0;

    if (cursor !== null) {
      if (cursor) {
        try {
          const decoded = Buffer.from(cursor, 'base64').toString('utf8');
          const parts = decoded.split('_');
          if (parts.length === 2) {
            const cursorDate = new Date(parts[0]);
            const cursorId = parts[1];
            query.$or = [
              { createdAt: { $lt: cursorDate } },
              { createdAt: cursorDate, _id: { $lt: new mongoose.Types.ObjectId(cursorId) } }
            ];
          }
        } catch (err) {
          console.error('[WhatsAppOutboxService] Failed to parse cursor, falling back to all records:', err);
        }
      }

      rawEntries = await WhatsAppOutbox.find(query)
        .populate('sentBy', 'name')
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);

      if (rawEntries.length > limit) {
        hasNextPage = true;
        rawEntries = rawEntries.slice(0, limit);
      }
    } else {
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 20;
      const skip = (pageNum - 1) * limitNum;

      total = await WhatsAppOutbox.countDocuments(query);
      rawEntries = await WhatsAppOutbox.find(query)
        .populate('sentBy', 'name')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum);
    }

    const entries = [];

    // GAP 1: Validate/refresh signed URL expiry on fetch + Sync invoice balance
    const nowMs = Date.now();
    for (const entry of rawEntries) {
      // Sync invoice payment status dynamically
      try {
        const InvoiceModel = mongoose.model('Invoice');
        const inv = await InvoiceModel.findOne({ visitId: entry.visitId, labId: entry.labId });
        if (inv) {
          const latestBalance = inv.balanceAmount !== undefined ? inv.balanceAmount : (inv.totalAmount - inv.amountPaid);
          if (latestBalance !== entry.balanceAmount) {
            entry.balanceAmount = latestBalance;
            entry.amountPaid = inv.amountPaid;
            
            // Regenerate waLink
            const populated = await entry.populate(['patientId', 'labId']);
            let regeneratedLink = '';
            if (entry.balanceAmount > 0) {
              regeneratedLink = WhatsAppLinkService.generatePaymentRequest(populated.patientId, populated.labId, entry, entry.paymentLink);
            } else {
              let currentSignedUrl = entry.signedUrl;
              if (!currentSignedUrl || !entry.signedUrlExpiry || new Date(entry.signedUrlExpiry).getTime() < nowMs + 5000) {
                if (entry.pdfUrl) {
                  currentSignedUrl = await R2Service.getSignedUrl(entry.pdfUrl, 172800);
                  entry.signedUrl = currentSignedUrl;
                  entry.signedUrlExpiry = new Date(Date.now() + 172800 * 1000);
                }
              }
              regeneratedLink = WhatsAppLinkService.generateReportReady(populated.patientId, populated.labId, entry, currentSignedUrl);
            }
            entry.waLink = regeneratedLink;
            await entry.save();
          }
        }
      } catch (syncErr) {
        console.error(`[WhatsAppOutboxService] Failed to sync latest invoice balance for outbox ${entry._id}:`, syncErr.message);
      }

      if (
        entry.pdfStatus === 'ready' && 
        entry.pdfUrl && 
        (!entry.signedUrlExpiry || new Date(entry.signedUrlExpiry).getTime() < nowMs + 5000)
      ) {
        try {
          console.log(`[WhatsAppOutboxService] Signed URL expired for outbox entry ${entry._id}. Refreshing...`);
          
          // Generate new signed R2 URL valid for 48 hours (172800 seconds)
          const newSignedUrl = await R2Service.getSignedUrl(entry.pdfUrl, 172800);
          const newExpiry = new Date(Date.now() + 172800 * 1000);
          
          entry.signedUrl = newSignedUrl;
          entry.signedUrlExpiry = newExpiry;
          
          // Regenerate waLink with refreshed URL
          const populated = await entry.populate(['patientId', 'labId']);
          let regeneratedLink = '';
          if (entry.balanceAmount > 0) {
            regeneratedLink = WhatsAppLinkService.generatePaymentRequest(populated.patientId, populated.labId, entry, entry.paymentLink);
          } else {
            regeneratedLink = WhatsAppLinkService.generateReportReady(populated.patientId, populated.labId, entry, newSignedUrl);
          }
          entry.waLink = regeneratedLink;
          
          await entry.save();
        } catch (err) {
          console.error(`[WhatsAppOutboxService] Failed to refresh expired signed URL for outbox ${entry._id}:`, err.message);
        }
      }
      entries.push(entry);
    }

    if (cursor !== null) {
      if (hasNextPage && entries.length > 0) {
        const lastItem = entries[entries.length - 1];
        nextCursor = Buffer.from(`${lastItem.createdAt.toISOString()}_${lastItem._id.toString()}`).toString('base64');
      }
      return {
        entries,
        nextCursor,
        hasNextPage,
        limit
      };
    }

    return {
      entries,
      total,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Marks outbox entry as sent (manual check off).
   * Encapsulates labId isolation query check.
   */
  async markAsSent(outboxId, userId, labId) {
    // GAP 5: Find with labId isolation
    const entry = await WhatsAppOutbox.findOne({ _id: outboxId, labId });
    if (!entry) {
      throw new AppError('Outbox entry not found or unauthorized', 'OUTBOX_NOT_FOUND', 404);
    }

    entry.status = 'sent';
    entry.sentAt = new Date();
    entry.sentBy = userId;
    const updated = await entry.save();

    // Invalidate cache
    await this.invalidateStatsCache(labId);

    return updated;
  },

  /**
   * Retrieves aggregate outbox statistics for badges and dashboards.
   * Utilizes Redis caching to reduce Mongo Atlas load (GAP 6).
   */
  async getOutboxStats(labId) {
    const cacheKey = `${STATS_CACHE_PREFIX}${labId.toString()}`;
    
    // Check cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        // Cached could be object directly or string depending on client parser
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    } catch (err) {
      console.warn('[WhatsAppOutboxService] Redis cache read failed, falling back to db:', err.message);
    }

    // Cache miss, run aggregation
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [ready, generating, failed, needsPayment, sentToday] = await Promise.all([
      WhatsAppOutbox.countDocuments({ labId, status: 'queued', pdfStatus: 'ready' }),
      WhatsAppOutbox.countDocuments({ labId, status: 'queued', pdfStatus: 'generating' }),
      WhatsAppOutbox.countDocuments({ labId, status: 'queued', pdfStatus: 'failed' }),
      WhatsAppOutbox.countDocuments({ labId, status: 'queued', balanceAmount: { $gt: 0 } }),
      WhatsAppOutbox.countDocuments({ labId, status: 'sent', sentAt: { $gte: startOfToday } })
    ]);

    const stats = { ready, generating, failed, needsPayment, sentToday };

    // Set cache
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(stats));
    } catch (err) {
      console.error('[WhatsAppOutboxService] Failed to cache stats in Redis:', err.message);
    }

    return stats;
  },

  /**
   * Transition Background Job: auto-delivers all ready outbox items via Meta Cloud API (GAP 10).
   */
  async processOutboxToMeta(labId) {
    console.log(`[WhatsAppOutboxService] Starting background Meta transition for lab: ${labId}`);
    const readyEntries = await WhatsAppOutbox.find({ labId, status: 'queued', pdfStatus: 'ready' })
      .populate('patientId')
      .populate('reportId');

    const Lab = mongoose.model('Lab');
    const Visit = mongoose.model('Visit');
    const lab = await Lab.findById(labId);

    let processedCount = 0;
    for (const entry of readyEntries) {
      try {
        const patient = entry.patientId;
        const report = entry.reportId;

        if (patient && patient.phone) {
          const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
          const labName = lab?.name || 'Pehlix Lab';

          if (entry.balanceAmount > 0) {
            // Send unpaid paywall
            await WhatsAppService.send(patient.phone, 'report_ready_unpaid', {
              patientName,
              pendingAmount: entry.balanceAmount,
              paymentLink: entry.paymentLink,
              labName,
              labId: labId.toString()
            });
          } else {
            // Generate signed URL
            const reportLink = await R2Service.getSignedUrl(entry.pdfUrl, 172800);

            await WhatsAppService.send(patient.phone, 'report_ready_paid', {
              patientName,
              reportLink,
              labName,
              reportCode: report?.reportCode || entry.reportId.toString(),
              labId: labId.toString()
            });

            // Mark report as delivered
            if (report) {
              report.status = 'delivered';
              report.deliveredAt = new Date();
              report.patientDeliveredAt = new Date();
              report.deliveryChannel = 'whatsapp';
              await report.save();

              await Visit.findByIdAndUpdate(entry.visitId, {
                status: 'delivered',
                'statusTimestamps.deliveredAt': new Date()
              });
            }
          }

          // Mark outbox entry as sent
          entry.status = 'sent';
          entry.sentAt = new Date();
          await entry.save();
          processedCount++;
        }
      } catch (err) {
        console.error(`[WhatsAppOutboxService] Failed to auto-deliver outbox entry ${entry._id} via Meta:`, err.message);
      }
    }
    console.log(`[WhatsAppOutboxService] Completed background Meta transition for lab: ${labId}. Sent ${processedCount} messages.`);
    await this.invalidateStatsCache(labId);
  }
};

export default WhatsAppOutboxService;
