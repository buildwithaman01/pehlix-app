import mongoose from 'mongoose';

const testMasterSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  sampleType: {
    type: String,
    trim: true
  },
  container: {
    type: String,
    trim: true
  },
  basePrice: {
    type: Number,
    required: true,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const TestMaster = mongoose.models.TestMaster || mongoose.model('TestMaster', testMasterSchema);
export default TestMaster;
export { TestMaster };
