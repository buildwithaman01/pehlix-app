import mongoose from 'mongoose';

const commissionSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    index: true
  },
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit',
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  invoiceTotalAmount: {
    type: Number,
    required: true
  },
  commissionType: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true
  },
  commissionValue: {
    type: Number,
    required: true
  },
  commissionAmount: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'statement_sent', 'paid'],
    default: 'pending'
  },
  paidAt: {
    type: Date
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentReference: {
    type: String
  },
  statementSentAt: {
    type: Date
  },
  notes: {
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

// Indexes
commissionSchema.index({ labId: 1, doctorId: 1, month: 1, year: 1 });
commissionSchema.index({ labId: 1, status: 1 });
commissionSchema.index({ labId: 1, visitId: 1 }, { unique: true });

const Commission = mongoose.models.Commission || mongoose.model('Commission', commissionSchema);
export default Commission;
export { Commission };
