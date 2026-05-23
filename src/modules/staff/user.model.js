import mongoose from 'mongoose';

const deviceHistorySchema = new mongoose.Schema({
  fingerprint: { type: String, required: true },
  userAgent: { type: String },
  ip: { type: String },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: function() {
      return this.role !== 'superAdmin' && this.role !== 'patient';
    },
    index: true
  },
  role: {
    type: String,
    enum: [
      'owner',
      'pathologist',
      'technician',
      'receptionist',
      'phlebotomist',
      'doctor',
      'patient',
      'collectionCenter',
      'superAdmin'
    ],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String
  },
  isOtpOnly: {
    type: Boolean,
    default: false
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  deviceHistory: [deviceHistorySchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  signature: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
export { User };
