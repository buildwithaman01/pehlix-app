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
    enum: ['pending', 'generating', 'generated', 'delivered', 'failed'],
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
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ labId: 1, visitId: 1 });

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);
export default Report;
export { Report };
