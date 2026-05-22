import mongoose from 'mongoose';
import InventoryItem from './inventoryItem.model.js';
import InventoryLog from './inventoryLog.model.js';
import { AppError } from '../../utils/errors.js';

export const InventoryService = {
  /**
   * Create a new inventory item and log initial stock if present.
   */
  async createItem(labId, data, createdBy) {
    const item = new InventoryItem({
      ...data,
      labId,
      isActive: true,
      isDeleted: false
    });

    await item.save();

    if (item.currentStock > 0) {
      const log = new InventoryLog({
        labId,
        itemId: item._id,
        type: 'purchase',
        quantityChange: item.currentStock,
        quantityBefore: 0,
        quantityAfter: item.currentStock,
        performedBy: createdBy,
        notes: 'Initial stock on creation'
      });
      await log.save();
    }

    return item;
  },

  /**
   * Find items matching criteria, with pagination.
   */
  async getItems(labId, filters = {}, page = 1, limit = 10) {
    const query = { labId, isDeleted: false };

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.isLowStock === 'true' || filters.isLowStock === true) {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }

    const limitNum = parseInt(limit, 10) || 10;
    const pageNum = parseInt(page, 10) || 1;
    const skip = (pageNum - 1) * limitNum;

    const total = await InventoryItem.countDocuments(query);
    const items = await InventoryItem.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const results = items.map(item => ({
      ...item,
      isLowStock: item.currentStock <= item.minimumStock
    }));

    return {
      items: results,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    };
  },

  /**
   * Retrieve item by ID.
   */
  async getItemById(labId, itemId) {
    const item = await InventoryItem.findOne({ _id: itemId, labId, isDeleted: false });
    if (!item) {
      throw new AppError('Inventory item not found', 'VALIDATION_FAILED', 404);
    }
    return item;
  },

  /**
   * Update item properties.
   */
  async updateItem(labId, itemId, data) {
    const item = await InventoryItem.findOne({ _id: itemId, labId, isDeleted: false });
    if (!item) {
      throw new AppError('Inventory item not found', 'VALIDATION_FAILED', 404);
    }

    Object.assign(item, data);
    await item.save();
    return item;
  },

  /**
   * Adjust stock manually or via system events.
   */
  async adjustStock(labId, itemId, quantityChange, type, userId, notes, purchaseOrderNumber, relatedTestId = null, relatedVisitId = null) {
    const item = await InventoryItem.findOne({ _id: itemId, labId, isDeleted: false });
    if (!item) {
      throw new AppError('Inventory item not found', 'VALIDATION_FAILED', 404);
    }

    const quantityBefore = item.currentStock;
    const quantityAfter = quantityBefore + quantityChange;

    if (quantityAfter < 0) {
      throw new AppError('Insufficient stock. Cannot reduce below zero.', 'VALIDATION_FAILED', 400);
    }

    item.currentStock = quantityAfter;

    const log = new InventoryLog({
      labId,
      itemId,
      type,
      quantityChange,
      quantityBefore,
      quantityAfter,
      performedBy: userId,
      relatedTestId,
      relatedVisitId,
      purchaseOrderNumber,
      notes
    });

    await log.save();
    await item.save();

    const isLowStock = quantityAfter <= item.minimumStock;
    return { item, log, isLowStock };
  },

  /**
   * Automatically deduct inventory reagents when a test result is entered.
   */
  async autoConsumeForTest(labId, testId, visitId, userId) {
    let consumed = 0;
    let failed = 0;
    const details = [];

    try {
      const items = await InventoryItem.find({
        labId,
        isDeleted: false,
        'reagentConsumption.testId': testId
      });

      for (const item of items) {
        try {
          const rc = item.reagentConsumption.find(c => c.testId.toString() === testId.toString());
          if (rc) {
            const qty = rc.quantityPerTest;
            const result = await this.adjustStock(
              labId,
              item._id,
              -qty,
              'consumption',
              userId,
              'Auto-deducted on result entry',
              null,
              testId,
              visitId
            );
            consumed++;
            details.push({ itemId: item._id, status: 'success', quantityConsumed: qty });
          }
        } catch (err) {
          failed++;
          details.push({ itemId: item._id, status: 'failed', error: err.message });
          console.error(`[INVENTORY] Auto-deduction failed for item ${item._id}:`, err);
        }
      }
    } catch (err) {
      console.error('[INVENTORY] Auto-deduction error:', err);
    }

    return { consumed, failed, details };
  },

  /**
   * Fetch all items with stock <= minimum stock, sorted by critical ratio.
   */
  async getLowStockItems(labId) {
    const items = await InventoryItem.find({
      labId,
      isDeleted: false,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    }).lean();

    items.sort((a, b) => {
      const scoreA = a.minimumStock > 0 ? (a.currentStock / a.minimumStock) : 0;
      const scoreB = b.minimumStock > 0 ? (b.currentStock / b.minimumStock) : 0;
      return scoreA - scoreB;
    });

    return items;
  },

  /**
   * Aggregates consumption patterns for a given period.
   */
  async getConsumptionReport(labId, period) {
    let startDate = new Date();
    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      // default to 30 days
      startDate.setDate(startDate.getDate() - 30);
    }

    const pipeline = [
      {
        $match: {
          labId: new mongoose.Types.ObjectId(labId),
          type: 'consumption',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$itemId',
          totalConsumed: { $sum: { $abs: '$quantityChange' } }
        }
      },
      {
        $lookup: {
          from: 'inventoryitems',
          localField: '_id',
          foreignField: '_id',
          as: 'item'
        }
      },
      {
        $unwind: '$item'
      },
      {
        $project: {
          itemId: '$_id',
          name: '$item.name',
          totalConsumed: 1
        }
      },
      {
        $sort: { totalConsumed: -1 }
      }
    ];

    return await InventoryLog.aggregate(pipeline);
  }
};

export default InventoryService;
