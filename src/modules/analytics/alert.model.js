import mongoose from 'mongoose';

const platformAlertSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true
  },
  type: {
    type: String,
    required: true
  },
  score: {
    type: Number
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false,
    required: true
  },
  readAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  }
});

platformAlertSchema.index({ labId: 1, isRead: 1, createdAt: 1 });

const PlatformAlert = mongoose.models.PlatformAlert || mongoose.model('PlatformAlert', platformAlertSchema);
export default PlatformAlert;
export { PlatformAlert };
