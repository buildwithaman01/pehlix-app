import mongoose from 'mongoose';

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['scheduled', 'enroute', 'arrived', 'collected', 'patientAbsent', 'cancelled'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  gpsCoordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  notes: {
    type: String
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

const homeCollectionSchema = new mongoose.Schema({
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
  assignedPhlebotomist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  timeSlot: {
    type: String,
    enum: ['7-9am', '9-11am', '11am-1pm', '2-4pm', '4-6pm'],
    required: true
  },
  address: {
    street: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    landmark: { type: String }
  },
  gpsCoordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  status: {
    type: String,
    enum: ['scheduled', 'enroute', 'arrived', 'collected', 'patientAbsent', 'cancelled'],
    default: 'scheduled',
    required: true
  },
  statusHistory: [statusHistorySchema],
  cashCollected: {
    type: Number,
    default: 0
  },
  cashReceivedAt: {
    type: Date
  },
  notes: {
    type: String
  },
  isOfflineSynced: {
    type: Boolean,
    default: false
  },
  offlineCreatedAt: {
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
homeCollectionSchema.index({ labId: 1, assignedPhlebotomist: 1, scheduledDate: 1 });
homeCollectionSchema.index({ labId: 1, status: 1 });

const HomeCollection = mongoose.models.HomeCollection || mongoose.model('HomeCollection', homeCollectionSchema);
export default HomeCollection;
export { HomeCollection };
