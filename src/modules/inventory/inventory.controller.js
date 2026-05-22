import InventoryService from './inventory.service.js';
import { sendSuccess } from '../../utils/response.js';

export const InventoryController = {
  async createItem(req, res, next) {
    try {
      const item = await InventoryService.createItem(req.user.labId, req.body, req.user.userId);
      return sendSuccess(res, item, 'Inventory item created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async getItems(req, res, next) {
    try {
      const { category, isLowStock, page, limit } = req.query;
      const results = await InventoryService.getItems(
        req.user.labId,
        { category, isLowStock },
        page,
        limit
      );
      return sendSuccess(res, results, 'Inventory items retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getItemById(req, res, next) {
    try {
      const item = await InventoryService.getItemById(req.user.labId, req.params.id);
      return sendSuccess(res, item, 'Inventory item retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async updateItem(req, res, next) {
    try {
      const item = await InventoryService.updateItem(req.user.labId, req.params.id, req.body);
      return sendSuccess(res, item, 'Inventory item updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async adjustStock(req, res, next) {
    try {
      const { quantityChange, type, notes, purchaseOrderNumber } = req.body;
      const result = await InventoryService.adjustStock(
        req.user.labId,
        req.params.id,
        quantityChange,
        type,
        req.user.userId,
        notes,
        purchaseOrderNumber
      );
      return sendSuccess(res, result, 'Stock adjusted successfully');
    } catch (error) {
      next(error);
    }
  },

  async getAlerts(req, res, next) {
    try {
      const items = await InventoryService.getLowStockItems(req.user.labId);
      return sendSuccess(res, items, 'Low stock items retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getConsumption(req, res, next) {
    try {
      const { period } = req.query;
      const report = await InventoryService.getConsumptionReport(req.user.labId, period);
      return sendSuccess(res, report, 'Consumption report retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default InventoryController;
