import mongoose from 'mongoose';

const homeCollectionSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'collected', 'delivered', 'cancelled'],
    default: 'pending',
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

const HomeCollection = mongoose.models.HomeCollection || mongoose.model('HomeCollection', homeCollectionSchema);
export default HomeCollection;
export { HomeCollection };
