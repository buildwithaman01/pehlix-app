import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  recipientPhone: {
    type: String,
    required: true,
    trim: true
  },
  recipientType: {
    type: String,
    enum: ['patient', 'doctor', 'owner', 'staff'],
    required: true
  },
  channel: {
    type: String,
    enum: ['whatsapp', 'sms', 'email'],
    required: true
  },
  templateName: {
    type: String,
    trim: true
  },
  variables: {
    type: mongoose.Schema.Types.Mixed
  },
  externalMessageId: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'failed'],
    default: 'queued',
    required: true
  },
  retryCount: {
    type: Number,
    default: 0
  },
  failureReason: {
    type: String,
    trim: true
  },
  sentAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
// Compound index for status queries within a lab
notificationSchema.index({ labId: 1, status: 1 });

// Compound index for recipient queries within a lab
notificationSchema.index({ labId: 1, recipientPhone: 1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
export { Notification };
