import { WhatsAppOutboxService } from './whatsappOutbox.service.js';
import { ReportService } from '../reports/report.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import WhatsAppOutbox from './whatsappOutbox.model.js';

export const WhatsAppOutboxController = {
  /**
   * GET /api/whatsapp-outbox
   * Retrieves outbox items for the lab.
   */
  async getOutbox(req, res, next) {
    try {
      const labId = req.user.labId;
      const { status, page, limit, cursor } = req.query;

      const result = await WhatsAppOutboxService.getOutboxForLab(
        labId,
        status,
        page,
        limit,
        cursor
      );

      return sendSuccess(res, result, 'Outbox items retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/whatsapp-outbox/:id/sent
   * Marks a manual outbox entry as sent. Verified with labId isolation (GAP 5).
   */
  async markSent(req, res, next) {
    try {
      const outboxId = req.params.id;
      const userId = req.user._id;
      const labId = req.user.labId;

      await WhatsAppOutboxService.markAsSent(outboxId, userId, labId);

      return sendSuccess(res, null, 'Message marked as sent successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/whatsapp-outbox/stats
   * Retrieves outbox stats for the badge count.
   */
  async getOutboxStats(req, res, next) {
    try {
      const labId = req.user.labId;
      const stats = await WhatsAppOutboxService.getOutboxStats(labId);

      return sendSuccess(res, stats, 'Outbox statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/whatsapp-outbox/:id/retry
   * Retries PDF generation for a failed report. Reset status and re-queues. (GAP 7)
   */
  async retryGeneration(req, res, next) {
    try {
      const outboxId = req.params.id;
      const labId = req.user.labId;

      const entry = await WhatsAppOutbox.findOne({ _id: outboxId, labId });
      if (!entry) {
        throw new AppError('Outbox entry not found or unauthorized', 'OUTBOX_NOT_FOUND', 404);
      }

      console.log(`[WhatsAppOutboxController] Manually triggering PDF retry for outbox entry: ${outboxId}, report: ${entry.reportId}`);

      // Call report service to archive old version, reset status, and re-enqueue PDF generation
      const regenRes = await ReportService.regenerateReport(labId, entry.reportId);

      // Reset outbox state back to generating
      entry.pdfStatus = 'generating';
      await entry.save();

      // Invalidate cache
      await WhatsAppOutboxService.invalidateStatsCache(labId);

      return sendSuccess(res, { messageId: regenRes.messageId }, 'PDF generation successfully re-queued');
    } catch (error) {
      next(error);
    }
  }
};

export default WhatsAppOutboxController;
