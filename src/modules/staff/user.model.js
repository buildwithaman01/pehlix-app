import mongoose from 'mongoose';
import mongooseEncryptionPlugin from '../../utils/encryption.plugin.js';
import { calculateBlindIndex } from '../../utils/crypto.js';

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
  phoneBlindIndex: {
    type: String,
    index: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  emailBlindIndex: {
    type: String,
    index: true
  },
  passwordHash: {
    type: String
  },
  isOtpOnly: {
    type: Boolean,
    default: true
  },
  // Pathologist professional credentials (Phase 3.5 — NABL sign-off)
  qualifications: {
    type: String,
    trim: true  // e.g. "MBBS, MD (Pathology)"
  },
  registrationNumber: {
    type: String,
    trim: true  // Medical Council registration number
  },
  signatureImageKey: {
    type: String,
    trim: true  // R2 key: labs/{labId}/signatures/{userId}.png
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

// Pre-save hook to calculate blind indexes
userSchema.pre('save', function () {
  if (this.isModified('phone')) {
    this.phoneBlindIndex = calculateBlindIndex(this.phone, 'phone');
  }
  if (this.isModified('email')) {
    this.emailBlindIndex = calculateBlindIndex(this.email, 'email');
  }
});

// Pre-findOneAndUpdate hook to calculate blind indexes
userSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (update) {
    const set = update.$set || update;
    if (set.phone !== undefined) {
      set.phoneBlindIndex = calculateBlindIndex(set.phone, 'phone');
    }
    if (set.email !== undefined) {
      set.emailBlindIndex = calculateBlindIndex(set.email, 'email');
    }
  }
});

// Register encryption plugin
userSchema.plugin(mongooseEncryptionPlugin, { fields: ['phone', 'email'] });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
export { User };
