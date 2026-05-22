import mongoose from 'mongoose';

const inventoryLogSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  type: {
    type: String,
    enum: ['purchase', 'consumption', 'adjustment', 'expiry', 'transfer'],
    required: true
  },
  quantityChange: {
    type: Number,
    required: true
  },
  quantityBefore: {
    type: Number,
    required: true
  },
  quantityAfter: {
    type: Number,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  relatedTestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestMaster'
  },
  relatedVisitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },
  purchaseOrderNumber: {
    type: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
inventoryLogSchema.index({ labId: 1, itemId: 1, createdAt: -1 });
inventoryLogSchema.index({ labId: 1, type: 1 });

const InventoryLog = mongoose.models.InventoryLog || mongoose.model('InventoryLog', inventoryLogSchema);
export default InventoryLog;
export { InventoryLog };
