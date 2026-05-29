import mongoose from 'mongoose';

const whatsappOutboxSchema = new mongoose.Schema({
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
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  testNames: {
    type: [String],
    default: []
  },
  invoiceTotal: {
    type: Number,
    default: 0
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  pdfStatus: {
    type: String,
    enum: ['generating', 'ready', 'failed'],
    default: 'generating'
  },
  pdfUrl: {
    type: String,
    default: null
  },
  signedUrl: {
    type: String,
    default: null
  },
  signedUrlExpiry: {
    type: Date,
    default: null
  },
  waLink: {
    type: String,
    default: null
  },
  paymentLink: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'failed'],
    default: 'queued'
  },
  sentAt: {
    type: Date,
    default: null
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Compound indexes for optimal sorting and filtering
whatsappOutboxSchema.index({ labId: 1, status: 1 });
whatsappOutboxSchema.index({ labId: 1, createdAt: -1 });

// High-End System Design: MongoDB TTL index to clean up sent entries after 7 days (604800 seconds)
whatsappOutboxSchema.index({ sentAt: 1 }, { expireAfterSeconds: 604800 });

const WhatsAppOutbox = mongoose.models.WhatsAppOutbox || mongoose.model('WhatsAppOutbox', whatsappOutboxSchema);
export default WhatsAppOutbox;
export { WhatsAppOutbox };
