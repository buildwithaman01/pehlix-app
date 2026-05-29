import { Router } from 'express';
import InAppNotification from './inAppNotification.model.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import mongoose from 'mongoose';

const router = Router();

router.use(authenticate);
router.use(verifyTenant);

/**
 * GET /api/notifications/in-app
 * Returns in-app notifications for the authenticated user.
 * Supports ?unreadOnly=true&limit=20
 * Ordered: unread critical first, then by recency.
 */
router.get('/in-app', async (req, res, next) => {
  try {
    const labId = req.user.labId;
    const userId = req.user.userId;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const filter = {
      labId,
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { userId: null } // broadcast notifications
      ]
    };

    if (unreadOnly) {
      filter.isRead = false;
    }

    const notifications = await InAppNotification.find(filter)
      .sort({ isRead: 1, severity: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await InAppNotification.countDocuments({
      labId,
      isRead: false,
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { userId: null }
      ]
    });

    return sendSuccess(res, { notifications, unreadCount }, 'Notifications retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/in-app/:id/read
 * Marks a specific notification as read.
 */
router.post('/in-app/:id/read', async (req, res, next) => {
  try {
    const labId = req.user.labId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid notification ID', {}, 400);
    }

    const notification = await InAppNotification.findOneAndUpdate(
      { _id: id, labId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      return sendError(res, 'NOT_FOUND', 'Notification not found', {}, 404);
    }

    return sendSuccess(res, notification, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/in-app/read-all
 * Marks all unread notifications for this user as read.
 */
router.post('/in-app/read-all', async (req, res, next) => {
  try {
    const labId = req.user.labId;
    const userId = req.user.userId;

    const result = await InAppNotification.updateMany(
      {
        labId,
        isRead: false,
        $or: [
          { userId: new mongoose.Types.ObjectId(userId) },
          { userId: null }
        ]
      },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return sendSuccess(res, { modifiedCount: result.modifiedCount }, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
});

export default router;
