import mongoose from 'mongoose';

const outsourcedOrderSchema = new mongoose.Schema({
  labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true, index: true },
  sampleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sample', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  referenceLabName: { type: String, required: true },
  status: { 
    type: String, 
    required: true,
    enum: ['pending_dispatch', 'dispatched', 'received_by_ref', 'result_ready', 'completed'],
    default: 'pending_dispatch'
  },
  trackingId: { type: String },
  courierName: { type: String },
  dispatchDate: { type: Date },
  expectedReturnDate: { type: Date },
  actualReturnDate: { type: Date },
  cost: { type: Number },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.models.OutsourcedOrder || mongoose.model('OutsourcedOrder', outsourcedOrderSchema);
