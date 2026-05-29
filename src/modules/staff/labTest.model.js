import mongoose from 'mongoose';

const labRefRangeSchema = new mongoose.Schema({
  label: { type: String, trim: true },
  genderMatch: [{ type: String, enum: ['male', 'female', 'other', 'any'] }],
  ageMin: { type: Number, default: 0 },
  ageMax: { type: Number, default: 150 },
  ageUnit: { type: String, enum: ['years', 'months', 'days'], default: 'years' },
  normalLow: { type: Number },
  normalHigh: { type: Number },
  criticalLow: { type: Number },
  criticalHigh: { type: Number }
}, { _id: false });

const customParameterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  unit: {
    type: String,
    trim: true
  },
  normalLow: {
    type: Number
  },
  normalHigh: {
    type: Number
  },
  criticalLow: {
    type: Number
  },
  criticalHigh: {
    type: Number
  },
  isDerived: {
    type: Boolean,
    default: false
  },
  // Per-lab age/gender reference ranges — overrides TestMaster ranges when set
  referenceRanges: [labRefRangeSchema]
}, { _id: false });

const labTestSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestMaster',
    required: true
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
  price: {
    type: Number,
    required: true
  },
  customTurnaroundTime: {
    type: Number // in hours
  },
  customParameters: [customParameterSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound unique index for labId + testId
labTestSchema.index({ labId: 1, testId: 1 }, { unique: true });

const LabTest = mongoose.models.LabTest || mongoose.model('LabTest', labTestSchema);
export default LabTest;
export { LabTest };
