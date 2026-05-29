import mongoose from 'mongoose';

const referenceRangeSchema = new mongoose.Schema({
  label: {
    type: String,
    trim: true  // e.g. "Adult Male (18+ yrs)", "Paediatric (1-12 yrs)"
  },
  genderMatch: [{
    type: String,
    enum: ['male', 'female', 'other', 'any']
  }],
  ageMin: { type: Number, default: 0 },
  ageMax: { type: Number, default: 150 },
  ageUnit: {
    type: String,
    enum: ['years', 'months', 'days'],
    default: 'years'
  },
  normalLow: { type: Number },
  normalHigh: { type: Number },
  criticalLow: { type: Number },
  criticalHigh: { type: Number }
}, { _id: false });

const testParameterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  unit: {
    type: String,
    trim: true
  },
  // Default flat ranges — used as fallback if no referenceRanges entry matches
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
  // Age/gender-specific reference ranges (Phase 3.4)
  referenceRanges: [referenceRangeSchema]
}, { _id: false });

const derivedFormulaSchema = new mongoose.Schema({
  targetParameter: {
    type: String,
    required: true,
    trim: true
  },
  formula: {
    type: String,
    required: true,
    trim: true
  },
  inputs: [{
    type: String,
    trim: true
  }]
}, { _id: false });

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
  parameters: [testParameterSchema],
  derivedFormulas: [derivedFormulaSchema],
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    index: true
  },
  isCustom: {
    type: Boolean,
    default: false
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
