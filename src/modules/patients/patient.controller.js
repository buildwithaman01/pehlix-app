import PatientService from './patient.service.js';
import Patient from './patient.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';

export const PatientController = {
  /**
   * Registers a new patient.
   */
  async createPatient(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user token context', {}, 403);
      }

      const patient = await PatientService.createPatient(labId, req.body, req.user.userId);
      return sendSuccess(res, patient, 'Patient registered successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * List / search patients.
   */
  async getPatients(req, res, next) {
    try {
      const labId = req.user.labId;
      const query = req.query.q || '';
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;

      const result = await PatientService.searchPatients(labId, query, page, limit);
      return sendSuccess(res, result, 'Patients retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves a specific patient by ID.
   */
  async getPatientById(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;

      const patient = await Patient.findOne({ _id: id, labId, isDeleted: { $ne: true } });
      if (!patient) {
        return sendError(res, 'PATIENT_NOT_FOUND', 'Patient not found', {}, 404);
      }

      return sendSuccess(res, patient, 'Patient retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Updates an existing patient's details.
   */
  async updatePatient(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;

      const updatedPatient = await Patient.findOneAndUpdate(
        { _id: id, labId, isDeleted: { $ne: true } },
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!updatedPatient) {
        return sendError(res, 'PATIENT_NOT_FOUND', 'Patient not found', {}, 404);
      }

      return sendSuccess(res, updatedPatient, 'Patient updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Searches patients.
   */
  async searchPatients(req, res, next) {
    try {
      const labId = req.user.labId;
      const query = req.query.q || '';
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;

      const result = await PatientService.searchPatients(labId, query, page, limit);
      return sendSuccess(res, result, 'Patient search completed');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves visit and invoice history for a specific patient.
   */
  async getPatientHistory(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;

      const history = await PatientService.getPatientHistory(labId, id);
      return sendSuccess(res, history, 'Patient history retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Auto-fill helper looking up a patient by phone number.
   * Never returns 404; returns data: null if not found.
   */
  async autoFill(req, res, next) {
    try {
      const labId = req.user.labId;
      const { phone } = req.query;

      if (!phone) {
        return sendError(res, 'VALIDATION_FAILED', 'Phone query parameter is required', {}, 400);
      }

      const patient = await PatientService.findByPhone(labId, phone);
      return sendSuccess(res, patient, patient ? 'Patient found' : 'No matching patient found');
    } catch (error) {
      next(error);
    }
  }
};

export default PatientController;
