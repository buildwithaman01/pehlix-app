import DoctorService from './doctor.service.js';
import Doctor from './doctor.model.js';
import Commission from './commission.model.js';
import Visit from '../visits/visit.model.js';
import Report from '../reports/report.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';

export const DoctorController = {
  async createDoctor(req, res, next) {
    try {
      const labId = req.user.labId; // Lab staff context only
      const doctor = await DoctorService.createDoctor(labId, req.body, req.user.userId);
      return sendSuccess(res, doctor, 'Doctor registered successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async getDoctors(req, res, next) {
    try {
      const labId = req.user.labId;
      const { page = 1, limit = 10, isActive } = req.query;
      const result = await DoctorService.getDoctors(labId, { isActive }, Number(page), Number(limit));
      return sendSuccess(res, result, 'Doctors retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getDoctorById(req, res, next) {
    try {
      const labId = req.user.labId;
      const doctorId = req.params.id;
      const doctor = await DoctorService.getDoctorById(labId, doctorId);
      return sendSuccess(res, doctor, 'Doctor retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async updateDoctor(req, res, next) {
    try {
      const labId = req.user.labId;
      const doctorId = req.params.id;
      const doctor = await DoctorService.updateDoctor(labId, doctorId, req.body);
      return sendSuccess(res, doctor, 'Doctor updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getDoctorPatients(req, res, next) {
    try {
      const labId = req.user.labId;
      const doctorId = req.params.id;
      const { page = 1, limit = 10 } = req.query;
      const result = await DoctorService.getDoctorPatients(labId, doctorId, Number(page), Number(limit));
      return sendSuccess(res, result, 'Doctor referrals retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getDoctorCommissions(req, res, next) {
    try {
      const labId = req.user.labId;
      const doctorId = req.params.id;
      const { month, year } = req.query;
      const result = await DoctorService.getDoctorCommissions(labId, doctorId, month, year);
      return sendSuccess(res, result, 'Doctor commissions retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async payCommission(req, res, next) {
    try {
      const labId = req.user.labId;
      const doctorId = req.params.id;
      const { commissionIds, paymentReference } = req.body;
      const paidBy = req.user.userId;

      const updatedCount = await DoctorService.markCommissionPaid(
        labId,
        doctorId,
        commissionIds,
        paymentReference,
        paidBy
      );

      return sendSuccess(res, { updatedCount }, `Successfully marked ${updatedCount} commissions as paid`);
    } catch (error) {
      next(error);
    }
  },

  async generateStatement(req, res, next) {
    try {
      const labId = req.user.labId;
      const doctorId = req.params.id;

      // Determine previous month/year as default
      const now = new Date();
      let defaultMonth = now.getMonth(); // 0-11. If May (4), default is 4 (April)
      let defaultYear = now.getFullYear();
      if (defaultMonth === 0) {
        defaultMonth = 12;
        defaultYear -= 1;
      }

      const month = req.body.month !== undefined ? Number(req.body.month) : defaultMonth;
      const year = req.body.year !== undefined ? Number(req.body.year) : defaultYear;

      const statementData = await DoctorService.generateMonthlyStatement(labId, doctorId, month, year);
      if (!statementData) {
        return sendSuccess(res, null, 'No pending commissions found for the specified period');
      }

      return sendSuccess(res, statementData, 'Monthly statement generated and sent successfully');
    } catch (error) {
      next(error);
    }
  },

  /* Doctor Portal Controllers */

  async getPortalPatients(req, res, next) {
    try {
      if (req.user.role !== 'doctor') {
        throw new AppError('Unauthorized: Access denied', 'AUTH_INSUFFICIENT_PERMISSIONS', 403);
      }

      const doctor = await Doctor.findOne({ userId: req.user.userId });
      if (!doctor) {
        throw new AppError('Doctor record not found for this user', 'DOCTOR_NOT_FOUND', 404);
      }

      const visits = await Visit.find({ referredBy: doctor._id })
        .populate('patientId', 'firstName lastName phone')
        .populate('tests', 'name')
        .sort({ createdAt: -1 });

      const visitIds = visits.map(v => v._id);
      const reports = await Report.find({ visitId: { $in: visitIds } });
      const reportMap = reports.reduce((acc, r) => {
        acc[r.visitId.toString()] = r.status;
        return acc;
      }, {});

      const results = visits.map(v => {
        const vObj = v.toObject();
        vObj.reportStatus = reportMap[v._id.toString()] || 'pending';
        return vObj;
      });

      return sendSuccess(res, results, 'Portal referred patients retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getPortalCommissions(req, res, next) {
    try {
      if (req.user.role !== 'doctor') {
        throw new AppError('Unauthorized: Access denied', 'AUTH_INSUFFICIENT_PERMISSIONS', 403);
      }

      const doctor = await Doctor.findOne({ userId: req.user.userId });
      if (!doctor) {
        throw new AppError('Doctor record not found for this user', 'DOCTOR_NOT_FOUND', 404);
      }

      const commissions = await Commission.find({ doctorId: doctor._id, isDeleted: false })
        .populate('labId', 'name')
        .populate('visitId', 'visitCode')
        .populate('patientId', 'firstName lastName');

      // Group commissions by lab and month in memory
      const grouped = {};
      for (const comm of commissions) {
        const labIdStr = comm.labId?._id?.toString() || 'unknown_lab';
        const labName = comm.labId?.name || 'Unknown Lab';
        const monthKey = `${comm.year}-${String(comm.month).padStart(2, '0')}`;

        if (!grouped[labIdStr]) {
          grouped[labIdStr] = {
            labId: labIdStr,
            labName,
            months: {}
          };
        }

        if (!grouped[labIdStr].months[monthKey]) {
          grouped[labIdStr].months[monthKey] = {
            month: comm.month,
            year: comm.year,
            commissions: [],
            totalAmount: 0
          };
        }

        grouped[labIdStr].months[monthKey].commissions.push(comm);
        grouped[labIdStr].months[monthKey].totalAmount += comm.commissionAmount;
      }

      const result = Object.values(grouped).map(labGroup => ({
        ...labGroup,
        months: Object.values(labGroup.months).sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        })
      }));

      return sendSuccess(res, result, 'Portal commissions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default DoctorController;
