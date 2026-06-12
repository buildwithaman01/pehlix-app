import mongoose from 'mongoose';

const parameterResultSchema = new mongoose.Schema({
  parameterName: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed
  },
  unit: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['normal', 'low', 'high', 'criticalLow', 'criticalHigh'],
    default: 'normal'
  },
  isFlagged: {
    type: Boolean,
    default: false
  },
  isOverride: {
    type: Boolean,
    default: false
  },
  overrideReason: {
    type: String,
    trim: true
  }
}, { _id: false });

const resultSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit',
    required: true,
    index: true
  },
  sampleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sample'
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestMaster',
    required: true
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  parameters: [parameterResultSchema],
  isCritical: {
    type: Boolean,
    default: false
  },
  criticalAlertSentAt: {
    type: Date
  },
  criticalAcknowledgedAt: {
    type: Date
  },
  criticalAcknowledgedBy: {
    type: String,
    trim: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  isRejected: {
    type: Boolean,
    default: false
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: {
    type: Date
  },
  rejectionNote: {
    type: String,
    trim: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for common queries
resultSchema.index({ labId: 1, visitId: 1 });
resultSchema.index({ labId: 1, testId: 1 });
// AD-005: Work queue — pending/unapproved results by lab
resultSchema.index({ labId: 1, isApproved: 1, createdAt: -1 });
// AD-005: Critical value alert queue
resultSchema.index({ labId: 1, isCritical: 1, createdAt: -1 });

// ─── Soft-delete filter middleware (AD-004 fix) ───────────────────────────
// Auto-exclude soft-deleted results from all reads UNLESS the caller
// explicitly sets { isDeleted: true } (e.g., audit recovery).
resultSchema.pre('find', function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

resultSchema.pre('findOne', function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

resultSchema.pre('countDocuments', function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);
export default Result;
export { Result };
