import mongoose from 'mongoose';

const inAppNotificationSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
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
  isRead: {
    type: Boolean,
    default: false,
    required: true
  }
}, {
  timestamps: true
});

// Compound index for querying unread notifications within a lab
inAppNotificationSchema.index({ labId: 1, isRead: 1 });

const InAppNotification = mongoose.models.InAppNotification || mongoose.model('InAppNotification', inAppNotificationSchema);
export default InAppNotification;
export { InAppNotification };
