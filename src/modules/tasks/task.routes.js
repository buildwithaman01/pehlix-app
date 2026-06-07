import { Router } from 'express';
import Task from './task.model.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { sendSuccess, sendError } from '../../utils/response.js';

const router = Router();

router.use(authenticate);
router.use(verifyTenant);

// Get all tasks for a lab
router.get('/', async (req, res, next) => {
  try {
    const tasks = await Task.find({ labId: req.user.labId })
      .populate('assignedTo', 'name email firstName lastName')
      .populate('createdBy', 'name email firstName lastName')
      .sort({ createdAt: -1 });
    return sendSuccess(res, tasks, 'Tasks retrieved successfully');
  } catch (error) {
    next(error);
  }
});

// Create new task
router.post('/', async (req, res, next) => {
  try {
    const { title, description, priority, assignedTo, dueDate } = req.body;
    
    const task = new Task({
      labId: req.user.labId,
      title,
      description,
      priority: priority || 'medium',
      assignedTo: assignedTo || null,
      dueDate,
      createdBy: req.user.userId
    });

    await task.save();
    return sendSuccess(res, task, 'Task created successfully', 201);
  } catch (error) {
    next(error);
  }
});

// Update task status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, labId: req.user.labId },
      { $set: { status } },
      { new: true }
    );
    if (!task) return sendError(res, 'NOT_FOUND', 'Task not found', {}, 404);
    
    return sendSuccess(res, task, 'Task status updated');
  } catch (error) {
    next(error);
  }
});

// Delete task
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, labId: req.user.labId });
    if (!task) return sendError(res, 'NOT_FOUND', 'Task not found', {}, 404);
    return sendSuccess(res, null, 'Task deleted successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
