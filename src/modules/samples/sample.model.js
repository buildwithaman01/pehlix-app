import mongoose from 'mongoose';

const chainOfCustodySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    trim: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: false });

const gpsCoordinatesSchema = new mongoose.Schema({
  lat: {
    type: Number
  },
  lng: {
    type: Number
  }
}, { _id: false });

const sampleSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  barcodeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
  sampleType: {
    type: String,
    required: true,
    trim: true
  },
  containerType: {
    type: String,
    trim: true
  },
  volume: {
    type: String,
    trim: true
  },
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  collectedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'collected', 'received', 'processing', 'rejected'],
    default: 'pending',
    required: true
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  gpsCoordinates: gpsCoordinatesSchema,
  chainOfCustody: [chainOfCustodySchema],
  isDeleted: {
    type: Boolean,
    default: false,
    required: true
  }
}, {
  timestamps: true
});

// Indexes
// Compound index for status queries within a lab
sampleSchema.index({ labId: 1, status: 1 });

const Sample = mongoose.models.Sample || mongoose.model('Sample', sampleSchema);
export default Sample;
export { Sample };
