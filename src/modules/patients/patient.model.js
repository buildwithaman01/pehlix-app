import mongoose from 'mongoose';
import mongooseEncryptionPlugin from '../../utils/encryption.plugin.js';
import { calculateBlindIndex } from '../../utils/crypto.js';

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true }
}, { _id: false });

const patientSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  patientCode: {
    type: String,
    required: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
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
  alternatePhone: {
    type: String,
    trim: true
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
  age: {
    type: Number,
    required: true
  },
  ageUnit: {
    type: String,
    enum: ['years', 'months', 'days'],
    default: 'years'
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  address: addressSchema,
  bloodGroup: {
    type: String,
    trim: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  familyAccountId: {
    type: mongoose.Schema.Types.ObjectId
  },
  consentGiven: {
    type: Boolean,
    required: true,
    default: false
  },
  consentTimestamp: {
    type: Date
  },
  consentVersion: {
    type: Number,
    default: 1
  },
  consentIpAddress: {
    type: String,
    trim: true
  },
  consentMethod: {
    type: String,
    enum: ['staff_entry', 'patient_portal', 'whatsapp'],
    default: 'staff_entry'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
// Compound index for labId + phoneBlindIndex
patientSchema.index({ labId: 1, phoneBlindIndex: 1 });

// Compound unique index for labId + patientCode
patientSchema.index({ labId: 1, patientCode: 1 }, { unique: true });

/*
Atlas Search Index Definition (Lucene):
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "firstName": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "lastName": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "phone": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "patientCode": {
        "type": "string",
        "analyzer": "lucene.keyword"
      }
    }
  }
}
*/

// Pre-save hook to calculate blind indexes
patientSchema.pre('save', function () {
  if (this.isModified('phone')) {
    this.phoneBlindIndex = calculateBlindIndex(this.phone, 'phone');
  }
  if (this.isModified('email')) {
    this.emailBlindIndex = calculateBlindIndex(this.email, 'email');
  }
});

// Pre-findOneAndUpdate hook to calculate blind indexes
patientSchema.pre('findOneAndUpdate', function () {
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
patientSchema.plugin(mongooseEncryptionPlugin, { fields: ['phone', 'email'] });

const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);
export default Patient;
export { Patient };
