import mongoose from 'mongoose';

const inventoryLogSchema = new mongoose.Schema({
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
    index: true
  },
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  action: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const InventoryLog = mongoose.models.InventoryLog || mongoose.model('InventoryLog', inventoryLogSchema);
export default InventoryLog;
export { InventoryLog };
