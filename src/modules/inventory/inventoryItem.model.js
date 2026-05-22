import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
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
  category: {
    type: String,
    enum: ['reagent', 'consumable', 'equipment', 'stationery', 'other'],
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  currentStock: {
    type: Number,
    required: true,
    default: 0
  },
  minimumStock: {
    type: Number,
    required: true,
    default: 10
  },
  reorderQuantity: {
    type: Number,
    default: 50
  },
  costPerUnit: {
    type: Number,
    default: 0
  },
  supplier: {
    name: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  barcodeId: {
    type: String,
    sparse: true,
    unique: true
  },
  location: {
    type: String
  },
  expiryDate: {
    type: Date
  },
  reagentConsumption: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestMaster'
    },
    quantityPerTest: {
      type: Number
    }
  }],
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

// Indexes
inventoryItemSchema.index({ labId: 1, category: 1 });
inventoryItemSchema.index({ labId: 1, name: 1 });

const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
export default InventoryItem;
export { InventoryItem };
