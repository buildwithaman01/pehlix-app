import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true }
}, { _id: false });

const planConfigSchema = new mongoose.Schema({
  modules: {
    patients: { type: Boolean, default: false },
    visits: { type: Boolean, default: false },
    results: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    billing: { type: Boolean, default: false },
    inventory: { type: Boolean, default: false },
    doctors: { type: Boolean, default: false },
    staff: { type: Boolean, default: false },
    notifications: { type: Boolean, default: false },
    webhooks: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    homeCollections: { type: Boolean, default: false },
    samples: { type: Boolean, default: false }
  },
  limits: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  features: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  flags: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

const billingSchema = new mongoose.Schema({
  razorpaySubscriptionId: { type: String, trim: true },
  razorpayCustomerId: { type: String, trim: true },
  nextBillingDate: { type: Date },
  status: {
    type: String,
    enum: ['trial', 'active', 'grace', 'suspended', 'expired'],
    default: 'trial'
  },
  trialStartDate: { type: Date },
  trialEndDate: { type: Date }
}, { _id: false });

const labSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
  address: addressSchema,
  logo: {
    type: String,
    trim: true
  },
  reportHeader: {
    type: String,
    trim: true
  },
  reportFooter: {
    type: String,
    trim: true
  },
  nablNumber: {
    type: String,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true
  },
  plan: {
    type: String,
    enum: ['starter', 'growth', 'pro', 'custom'],
    default: 'starter',
    required: true
  },
  planConfig: {
    type: planConfigSchema,
    default: () => ({})
  },
  billing: {
    type: billingSchema,
    default: () => ({})
  },
  isActive: {
    type: Boolean,
    default: true,
    required: true
  },
  isSuspended: {
    type: Boolean,
    default: false,
    required: true
  },
  suspensionReason: {
    type: String,
    trim: true
  },
  industryType: {
    type: String,
    default: 'diagnostic_lab',
    required: true
  }
}, {
  timestamps: true
});

const Lab = mongoose.models.Lab || mongoose.model('Lab', labSchema);
export default Lab;
export { Lab };
