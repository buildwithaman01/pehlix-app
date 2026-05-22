import PatientService from './patient.service.js';
import Patient from './patient.model.js';
import User from '../staff/user.model.js';
import Visit from '../visits/visit.model.js';
import Report from '../reports/report.model.js';
import Result from '../results/result.model.js';
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
  },

  /**
   * Get patient portal profile.
   */
  async getPortalProfile(req, res, next) {
    try {
      const userId = req.user.userId;
      const user = await User.findById(userId);
      if (!user) {
        return sendError(res, 'USER_NOT_FOUND', 'Patient user not found', {}, 404);
      }

      const patients = await Patient.find({ phone: user.phone, isDeleted: { $ne: true } }).populate('labId');
      return sendSuccess(res, { user, patients }, 'Portal profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get patient portal reports and trends.
   */
  async getPortalReports(req, res, next) {
    try {
      const userId = req.user.userId;
      const user = await User.findById(userId);
      if (!user) {
        return sendError(res, 'USER_NOT_FOUND', 'Patient user not found', {}, 404);
      }

      // Find all patient records matching phone number
      const patients = await Patient.find({ phone: user.phone, isDeleted: { $ne: true } });
      const patientIds = patients.map(p => p._id);

      // Find all reports corresponding to these patient records
      const reports = await Report.find({
        patientId: { $in: patientIds },
        status: { $in: ['approved', 'generating', 'generated', 'delivered'] },
        isDeleted: { $ne: true }
      })
      .populate('labId')
      .populate('patientId')
      .populate({
        path: 'visitId',
        populate: [
          { path: 'tests' },
          { path: 'referredBy' }
        ]
      })
      .sort({ createdAt: -1 });

      // Build parameter trends: get all approved results
      const visitIds = reports.map(r => r.visitId ? r.visitId._id : null).filter(Boolean);
      const results = await Result.find({
        visitId: { $in: visitIds },
        isApproved: true,
        isDeleted: { $ne: true }
      })
      .populate('testId')
      .populate({
        path: 'visitId',
        select: 'createdAt visitCode'
      });

      // Format parameter trends: group by parameter name, collect chronological values
      const trends = {};
      results.forEach(resObj => {
        const visitDate = resObj.visitId?.createdAt || resObj.createdAt;
        const visitCode = resObj.visitId?.visitCode || 'N/A';
        resObj.parameters.forEach(param => {
          const numValue = parseFloat(param.value);
          if (!isNaN(numValue)) {
            if (!trends[param.parameterName]) {
              trends[param.parameterName] = {
                parameterName: param.parameterName,
                unit: param.unit || '',
                data: []
              };
            }
            trends[param.parameterName].data.push({
              visitCode,
              date: visitDate,
              value: numValue,
              status: param.status || 'normal'
            });
          }
        });
      });

      // Sort data in each trend chronologically
      Object.keys(trends).forEach(paramName => {
        trends[paramName].data.sort((a, b) => new Date(a.date) - new Date(b.date));
      });

      return sendSuccess(res, { reports, trends: Object.values(trends) }, 'Portal reports and trends retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default PatientController;
