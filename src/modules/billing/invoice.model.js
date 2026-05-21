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
invoiceSchema.pre('save', function(next) {
  if (this.totalAmount !== undefined && this.amountPaid !== undefined) {
    this.balanceAmount = this.totalAmount - this.amountPaid;
  }
  next();
});

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
export default Invoice;
export { Invoice };
