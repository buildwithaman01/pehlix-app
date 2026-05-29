import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  reportCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  qrVerificationId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  pdfUrl: {
    type: String,
    trim: true
  },
  pathologistNote: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'generating', 'generated', 'delivered', 'failed'],
    default: 'pending'
  },
  deliveryChannel: {
    type: String,
    enum: ['whatsapp', 'email', 'sms', 'portal']
  },
  deliveredAt: {
    type: Date
  },
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  patientDeliveredAt: {
    type: Date
  },
  doctorDeliveredAt: {
    type: Date
  },
  generatedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  selectedNode: {
    type: String,
    trim: true
  },
  failedNodes: {
    type: [String],
    default: []
  },
  qstashMessageId: {
    type: String,
    trim: true
  },
  generationAttempts: {
    type: Number,
    default: 0
  },
  lastFailureReason: {
    type: String,
    trim: true
  },
  // Phase 3.6 — Report Amendment & Version History
  version: {
    type: Number,
    default: 1
  },
  isAmended: {
    type: Boolean,
    default: false
  },
  amendmentReason: {
    type: String,
    trim: true
  },
  amendedAt: {
    type: Date
  },
  amendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Links amended version back to original report
  originalReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  },
  // R2 key of the pre-amendment PDF (archived copy)
  previousPdfUrl: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ labId: 1, visitId: 1 });

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);
export default Report;
export { Report };
