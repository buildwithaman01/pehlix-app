import { Router } from 'express';
import ResultAudit from './resultAudit.model.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import mongoose from 'mongoose';

const router = Router();

router.use(authenticate);
router.use(verifyTenant);

/**
 * GET /api/audit/results
 * Returns clinical audit log entries for the lab.
 * Cursor-paginated, filterable by resultId, action, performedBy, and date range.
 * Access: owner, pathologist only.
 */
router.get('/', authorize('owner', 'pathologist'), async (req, res, next) => {
  try {
    const labId = req.user.labId;
    const { resultId, action, performedBy, from, to, cursor, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr, 10) || 20, 100);

    const filter = { labId };

    if (resultId && mongoose.Types.ObjectId.isValid(resultId)) {
      filter.resultId = new mongoose.Types.ObjectId(resultId);
    }
    if (action) {
      filter.action = action;
    }
    if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
      filter.performedBy = new mongoose.Types.ObjectId(performedBy);
    }
    if (from || to) {
      filter.performedAt = {};
      if (from) filter.performedAt.$gte = new Date(from);
      if (to) filter.performedAt.$lte = new Date(to);
    }

    // Cursor-based pagination (architectural rule #12)
    let nextCursor = null;
    let hasNextPage = false;

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const parts = decoded.split('_');
        if (parts.length === 2) {
          const cursorDate = new Date(parts[0]);
          const cursorId = parts[1];
          filter.$or = [
            { performedAt: { $lt: cursorDate } },
            { performedAt: cursorDate, _id: { $lt: new mongoose.Types.ObjectId(cursorId) } }
          ];
        }
      } catch (err) {
        console.error('[ResultAudit] Failed to parse cursor:', err);
      }
    }

    const entries = await ResultAudit.find(filter)
      .sort({ performedAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('performedBy', 'firstName lastName role')
      .populate('patientId', 'firstName lastName patientCode')
      .populate('testId', 'name code');

    if (entries.length > limit) {
      hasNextPage = true;
      const lastItem = entries[limit - 1];
      nextCursor = Buffer.from(`${lastItem.performedAt.toISOString()}_${lastItem._id.toString()}`).toString('base64');
      entries.splice(limit);
    }

    return sendSuccess(res, { entries, nextCursor, hasNextPage, limit }, 'Audit trail retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/results/:resultId
 * Returns the full audit trail for a specific result.
 */
router.get('/:resultId', authorize('owner', 'pathologist'), async (req, res, next) => {
  try {
    const labId = req.user.labId;
    const { resultId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid result ID', {}, 400);
    }

    const entries = await ResultAudit.find({ labId, resultId })
      .sort({ performedAt: 1 })
      .populate('performedBy', 'firstName lastName role qualifications')
      .populate('patientId', 'firstName lastName patientCode')
      .populate('testId', 'name code');

    return sendSuccess(res, entries, 'Result audit trail retrieved successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
