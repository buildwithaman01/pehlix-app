import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['cash', 'upi', 'card', 'wallet', 'online'],
    required: true
  },
  razorpayPaymentId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  razorpayOrderId: {
    type: String,
    trim: true
  },
  razorpaySignature: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending'
  },
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default Payment;
export { Payment };
