import HomeCollectionService from './homeCollection.service.js';
import { sendSuccess } from '../../utils/response.js';

export const HomeCollectionController = {
  async createHomeCollection(req, res, next) {
    try {
      const collection = await HomeCollectionService.createHomeCollection(
        req.user.labId,
        req.body,
        req.user.userId
      );
      return sendSuccess(res, collection, 'Home collection booking created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async getHomeCollections(req, res, next) {
    try {
      const { status, assignedPhlebotomist, startDate, endDate, page, limit } = req.query;
      const results = await HomeCollectionService.getHomeCollections(
        req.user.labId,
        { status, assignedPhlebotomist, startDate, endDate },
        page,
        limit
      );
      return sendSuccess(res, results, 'Home collections retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getPhlebotomistJobs(req, res, next) {
    try {
      const phlebotomistId = (req.user.roles && req.user.roles.includes('phlebotomist')) ? req.user.userId : (req.query.phlebotomistId || req.user.userId);
      const date = req.query.date || new Date().toISOString();
      const jobs = await HomeCollectionService.getPhlebotomistJobs(
        req.user.labId,
        phlebotomistId,
        date
      );
      return sendSuccess(res, jobs, 'Phlebotomist jobs retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async assignPhlebotomist(req, res, next) {
    try {
      const { assignedPhlebotomist } = req.body;
      const collection = await HomeCollectionService.assignPhlebotomist(
        req.user.labId,
        req.params.id,
        assignedPhlebotomist,
        req.user._id
      );
      return sendSuccess(res, 'Phlebotomist assigned successfully', { collection });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update home collection status and GPS data.
   */
  async updateStatus(req, res, next) {
    try {
      const { status, gpsCoordinates, notes, cashCollected } = req.body;
      const collection = await HomeCollectionService.updateStatus(
        req.user.labId,
        req.params.id,
        status,
        req.user.userId,
        { gpsCoordinates, notes, cashCollected }
      );
      return sendSuccess(res, collection, 'Home collection status updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async processOfflineSync(req, res, next) {
    try {
      const phlebotomistId = req.user.userId;
      const results = await HomeCollectionService.processOfflineSync(
        req.user.labId,
        phlebotomistId,
        req.body.actions
      );
      return sendSuccess(res, results, 'Offline actions synchronized successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default HomeCollectionController;
