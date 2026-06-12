import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabTest',
    required: true
  },
  testName: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalPrice: {
    type: Number,
    required: true
  }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
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
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  invoiceCode: {
    type: String,
    required: true,
    trim: true
  },
  lineItems: [lineItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  gstRate: {
    type: Number,
    default: 18
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'waived'],
    default: 'pending'
  },
  razorpayPaymentLinkId: {
    type: String,
    trim: true
  },
  razorpayPaymentLinkUrl: {
    type: String,
    trim: true
  },
  waivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  waivedAt: {
    type: Date
  },
  waiveReason: {
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

// Middleware to calculate balance amount before save
invoiceSchema.pre('save', function() {
  if (this.totalAmount !== undefined && this.amountPaid !== undefined) {
    this.balanceAmount = this.totalAmount - this.amountPaid;
  }
});

// Keep balanceAmount consistent on partial-payment updates too
invoiceSchema.pre('findOneAndUpdate', function() {
  const update = this.getUpdate();
  const set = update?.$set || update;
  if (set && set.totalAmount !== undefined && set.amountPaid !== undefined) {
    const target = update.$set ? update.$set : update;
    target.balanceAmount = set.totalAmount - set.amountPaid;
  }
});

// ─── Soft-delete filter middleware (AD-004 fix) ───────────────────────────
// Auto-exclude soft-deleted invoices from all reads UNLESS the caller
// explicitly sets { isDeleted: true } (e.g., admin audit).
invoiceSchema.pre('find', function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

invoiceSchema.pre('findOne', function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

invoiceSchema.pre('countDocuments', function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

// ─── Compound indexes (AD-005 fix) ───────────────────────────────────────
// Billing dashboard: pending balance query sorted by date
invoiceSchema.index({ labId: 1, paymentStatus: 1 });
// Billing history: paginated list by date
invoiceSchema.index({ labId: 1, createdAt: -1 });
// Per-patient invoice lookup
invoiceSchema.index({ labId: 1, patientId: 1, createdAt: -1 });

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
export default Invoice;
export { Invoice };
