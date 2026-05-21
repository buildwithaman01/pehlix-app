import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  qualification: {
    type: String,
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
  specialization: {
    type: String,
    trim: true
  },
  registrationNumber: {
    type: String,
    trim: true
  },
  commissionType: {
    type: String,
    enum: ['percentage', 'flat', 'none'],
    default: 'none'
  },
  commissionValue: {
    type: Number,
    default: 0
  },
  portalAccess: {
    type: Boolean,
    default: false
  },
  totalReferrals: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Doctor = mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);
export default Doctor;
export { Doctor };
