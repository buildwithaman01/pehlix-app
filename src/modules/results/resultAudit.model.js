import mongoose from 'mongoose';

/**
 * ResultAudit — Immutable clinical audit trail for NABL compliance.
 *
 * Rules:
 *   - This collection is APPEND-ONLY. Never update or delete documents.
 *   - One document per clinical event (submit, update, approve, reject, flag, amend).
 *   - Before/after snapshots capture the full parameter state at each event.
 *   - Retention: indefinite (NABL requires 7-year minimum; we keep forever).
 */
const resultAuditSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  resultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Result',
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
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestMaster'
  },
  testName: {
    type: String,
    trim: true
  },
  action: {
    type: String,
    required: true,
    enum: ['created', 'updated', 'approved', 'rejected', 'flagged_critical', 'critical_acknowledged', 'amendment']
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedByName: {
    type: String,
    trim: true
  },
  performedByRole: {
    type: String,
    trim: true
  },
  performedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  // Snapshot of parameters BEFORE the change (null for 'created')
  before: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Snapshot of parameters AFTER the change
  after: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Mandatory for 'rejected' and 'amendment' actions
  reason: {
    type: String,
    trim: true
  },
  // For critical acknowledgement events
  acknowledgedBy: {
    type: String,
    trim: true
  },
  // Applied reference range label (e.g. "Adult Male (18+ yrs)") for context
  appliedRangeLabel: {
    type: String,
    trim: true
  },
  // Whether this was from a pathologist impersonation session
  isImpersonation: {
    type: Boolean,
    default: false
  }
}, {
  // Use createdAt from timestamps; no updatedAt needed (immutable)
  timestamps: { createdAt: true, updatedAt: false }
});

// Compound indexes for efficient audit queries
resultAuditSchema.index({ labId: 1, resultId: 1, performedAt: -1 });
resultAuditSchema.index({ labId: 1, action: 1, performedAt: -1 });
resultAuditSchema.index({ labId: 1, performedBy: 1, performedAt: -1 });
resultAuditSchema.index({ labId: 1, visitId: 1 });

const ResultAudit = mongoose.models.ResultAudit || mongoose.model('ResultAudit', resultAuditSchema);
export default ResultAudit;
export { ResultAudit };
