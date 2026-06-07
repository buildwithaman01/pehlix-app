import { Router } from 'express';
import OutsourcedOrder from './outsourcedOrder.model.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { verifyTenant } from '../../middleware/tenant.middleware.js';
import { sendSuccess, sendError } from '../../utils/response.js';

const router = Router();

router.use(authenticate);
router.use(verifyTenant);

// Get all outsourced orders for a lab
router.get('/', async (req, res, next) => {
  try {
    const orders = await OutsourcedOrder.find({ labId: req.user.labId })
      .populate('patientId', 'firstName lastName phone')
      .populate('testId', 'name code')
      .sort({ createdAt: -1 });
    return sendSuccess(res, orders, 'Outsourced orders retrieved successfully');
  } catch (error) {
    next(error);
  }
});

// Create new outsourced order
router.post('/', async (req, res, next) => {
  try {
    const { sampleId, patientId, visitId, testId, referenceLabName, expectedReturnDate, cost, notes } = req.body;
    
    const order = new OutsourcedOrder({
      labId: req.user.labId,
      sampleId,
      patientId,
      visitId,
      testId,
      referenceLabName,
      status: 'pending_dispatch',
      expectedReturnDate,
      cost,
      notes,
      createdBy: req.user.userId
    });

    await order.save();
    return sendSuccess(res, order, 'Outsourced order created successfully', 201);
  } catch (error) {
    next(error);
  }
});

// Update outsourced order status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, trackingId, courierName, actualReturnDate } = req.body;
    const updates = { status };
    if (trackingId) updates.trackingId = trackingId;
    if (courierName) updates.courierName = courierName;
    if (status === 'dispatched' && !actualReturnDate) updates.dispatchDate = new Date();
    if (actualReturnDate) updates.actualReturnDate = actualReturnDate;

    const order = await OutsourcedOrder.findOneAndUpdate(
      { _id: req.params.id, labId: req.user.labId },
      { $set: updates },
      { new: true }
    );
    if (!order) return sendError(res, 'NOT_FOUND', 'Outsourced order not found', {}, 404);
    
    return sendSuccess(res, order, 'Outsourced order status updated');
  } catch (error) {
    next(error);
  }
});

export default router;
