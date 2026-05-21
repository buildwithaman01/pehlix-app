import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
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
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  tests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabTest'
  }],
  price: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

packageSchema.index({ labId: 1, code: 1 }, { unique: true });

const Package = mongoose.models.Package || mongoose.model('Package', packageSchema);
export default Package;
export { Package };
