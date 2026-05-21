import mongoose from 'mongoose';

const visitSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  visitCode: {
    type: String,
    required: true,
    trim: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  visitType: {
    type: String,
    enum: ['walkIn', 'homeCollection', 'centerPickup'],
    default: 'walkIn'
  },
  status: {
    type: String,
    enum: ['registered', 'sampleCollected', 'processing', 'resultsEntered', 'approved', 'reported', 'delivered'],
    default: 'registered'
  },
  tests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabTest'
  }],
  sampleIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sample'
  }],
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  },
  expectedReportTime: {
    type: Date
  },
  scheduledDate: {
    type: Date
  },
  statusTimestamps: {
    registeredAt: { type: Date, default: Date.now },
    sampleCollectedAt: { type: Date },
    processingAt: { type: Date },
    resultsEnteredAt: { type: Date },
    approvedAt: { type: Date },
    reportedAt: { type: Date },
    deliveredAt: { type: Date }
  }
}, {
  timestamps: true
});

// Indexes
visitSchema.index({ labId: 1, status: 1 });
visitSchema.index({ labId: 1, patientId: 1 });
visitSchema.index({ labId: 1, createdAt: -1 });

const Visit = mongoose.models.Visit || mongoose.model('Visit', visitSchema);
export default Visit;
export { Visit };
