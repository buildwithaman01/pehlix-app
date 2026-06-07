import { Router } from 'express';
import Expense from './expense.model.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { sendSuccess, sendError } from '../../utils/response.js';

const router = Router();

router.use(authenticate);
router.use(verifyTenant);

// Get all expenses for a lab
router.get('/', async (req, res, next) => {
  try {
    const expenses = await Expense.find({ labId: req.user.labId })
      .populate('createdBy', 'name email firstName lastName')
      .sort({ date: -1 });
    return sendSuccess(res, expenses, 'Expenses retrieved successfully');
  } catch (error) {
    next(error);
  }
});

// Create new expense
router.post('/', async (req, res, next) => {
  try {
    const { title, amount, category, description, date, receiptUrl } = req.body;
    
    const expense = new Expense({
      labId: req.user.labId,
      title,
      amount,
      category,
      description,
      date: date || new Date(),
      receiptUrl,
      createdBy: req.user.userId
    });

    await expense.save();
    return sendSuccess(res, expense, 'Expense created successfully', 201);
  } catch (error) {
    next(error);
  }
});

// Delete expense
router.delete('/:id', async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, labId: req.user.labId });
    if (!expense) {
      return sendError(res, 'NOT_FOUND', 'Expense not found', {}, 404);
    }
    return sendSuccess(res, null, 'Expense deleted successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
