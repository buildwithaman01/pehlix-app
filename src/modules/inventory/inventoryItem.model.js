import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  currentStock: {
    type: Number,
    required: true,
    default: 0
  },
  minimumStock: {
    type: Number,
    required: true,
    default: 0
  },
  isDeleted: {
    type: Boolean,
    default: false,
    required: true
  }
}, {
  timestamps: true
});

const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
export default InventoryItem;
export { InventoryItem };
