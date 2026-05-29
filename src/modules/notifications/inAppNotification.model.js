import mongoose from 'mongoose';

/**
 * InAppNotification — In-app alerts for lab staff.
 * Phase 3.8: Enhanced with userId targeting, severity, link, and 30-day TTL.
 */
const inAppNotificationSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  // Target user — if null, notification is for all owners+pathologists of the lab
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  type: {
    type: String,
    enum: [
      'critical_value',         // Critical result detected
      'result_rejected',        // Pathologist rejected a result
      'pdf_failed',             // PDF generation failed
      'low_stock',              // Inventory below threshold
      'payment_overdue',        // Invoice overdue
      'report_delivered',       // Report delivered to patient
      'system'                  // Generic system notification
    ],
    default: 'system'
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  // Deep link in the app to navigate to
  link: {
    type: String,
    trim: true
  },
  // Context payload for rendering the notification (e.g. patientId, resultId)
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    required: true
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes for efficient unread notification queries
inAppNotificationSchema.index({ labId: 1, isRead: 1, createdAt: -1 });
inAppNotificationSchema.index({ labId: 1, userId: 1, isRead: 1 });

// 30-day TTL — older notifications auto-pruned
inAppNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

const InAppNotification = mongoose.models.InAppNotification || mongoose.model('InAppNotification', inAppNotificationSchema);
export default InAppNotification;
export { InAppNotification };
