import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true, index: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Reagents', 'Salary', 'Rent', 'Electricity', 'Marketing', 'Maintenance', 'Miscellaneous']
  },
  description: { type: String },
  date: { type: Date, default: Date.now },
  receiptUrl: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
