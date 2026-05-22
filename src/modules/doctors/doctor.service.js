import mongoose from 'mongoose';
import Doctor from './doctor.model.js';
import Commission from './commission.model.js';
import User from '../staff/user.model.js';
import Visit from '../visits/visit.model.js';
import Report from '../reports/report.model.js';
import Lab from '../staff/lab.model.js';
import { AppError } from '../../utils/errors.js';
import QStashService from '../../utils/qstash.js';
import { config } from '../../config/index.js';

export const DoctorService = {
  /**
   * Creates a new doctor.
   * If portalAccess is true, auto-provisions a minimal User record if it doesn't exist.
   */
  async createDoctor(labId, data, createdBy) {
    // 1. Build Doctor document (ensure labId from parameter, never from data)
    const doctorData = { ...data, labId };
    
    // 2. If portalAccess is true, verify or provision User
    if (data.portalAccess === true) {
      let user = await User.findOne({ phone: data.phone, role: 'doctor' });
      if (!user) {
        user = await User.create({
          name: data.name,
          role: 'doctor',
          phone: data.phone,
          labId: labId,
          isActive: true,
          isOtpOnly: true
        });
      }
      doctorData.userId = user._id;
    }

    const doctor = await Doctor.create(doctorData);
    return doctor;
  },

  /**
   * Updates an existing doctor.
   */
  async updateDoctor(labId, doctorId, data) {
    // Determine if portalAccess is toggling to true and we need to provision a user
    if (data.portalAccess === true) {
      const doctor = await Doctor.findOne({ _id: doctorId, labId });
      if (doctor && !doctor.userId) {
        const phone = data.phone || doctor.phone;
        const name = data.name || doctor.name;
        let user = await User.findOne({ phone, role: 'doctor' });
        if (!user) {
          user = await User.create({
            name,
            role: 'doctor',
            phone,
            labId,
            isActive: true,
            isOtpOnly: true
          });
        }
        data.userId = user._id;
      }
    }

    const updatedDoctor = await Doctor.findOneAndUpdate(
      { _id: doctorId, labId },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!updatedDoctor) {
      throw new AppError('Doctor not found', 'DOCTOR_NOT_FOUND', 404);
    }

    return updatedDoctor;
  },

  /**
   * Gets a list of doctors with pagination.
   */
  async getDoctors(labId, filters = {}, page = 1, limit = 10) {
    const query = { labId, isDeleted: false };
    
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    const total = await Doctor.countDocuments(query);
    const doctors = await Doctor.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      doctors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves a single doctor by ID and aggregates referrals & commission info.
   */
  async getDoctorById(labId, doctorId) {
    const doctor = await Doctor.findOne({ _id: doctorId, labId, isDeleted: false });
    if (!doctor) {
      throw new AppError('Doctor not found', 'DOCTOR_NOT_FOUND', 404);
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const currentMonth = startOfMonth.getMonth() + 1;
    const currentYear = startOfMonth.getFullYear();

    const [commissionsAggregation] = await Commission.aggregate([
      {
        $match: {
          labId: new mongoose.Types.ObjectId(labId),
          doctorId: new mongoose.Types.ObjectId(doctorId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          thisMonthCommissionTotal: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$month', currentMonth] },
                    { $eq: ['$year', currentYear] }
                  ]
                },
                '$commissionAmount',
                0
              ]
            }
          }
        }
      }
    ]);

    const totalReferrals = commissionsAggregation?.totalReferrals || 0;
    const thisMonthCommissionTotal = commissionsAggregation?.thisMonthCommissionTotal || 0;

    return {
      ...doctor.toObject(),
      totalReferrals,
      thisMonthCommissionTotal
    };
  },

  /**
   * Gets visits referred by a specific doctor.
   */
  async getDoctorPatients(labId, doctorId, page = 1, limit = 10) {
    const query = { labId, referredBy: doctorId };
    const total = await Visit.countDocuments(query);

    const visits = await Visit.find(query)
      .populate('patientId', 'firstName lastName phone age ageUnit gender')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const visitIds = visits.map(v => v._id);
    const reports = await Report.find({ labId, visitId: { $in: visitIds } });
    const reportMap = reports.reduce((acc, r) => {
      acc[r.visitId.toString()] = r.status;
      return acc;
    }, {});

    const results = visits.map(v => {
      const vObj = v.toObject();
      vObj.reportStatus = reportMap[v._id.toString()] || 'pending';
      return vObj;
    });

    return {
      visits: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Calculates and records commission. Idempotent check prevents double recording.
   */
  async calculateAndRecordCommission(labId, visitId, invoiceId, paidAmount) {
    const visit = await Visit.findOne({ _id: visitId, labId });
    if (!visit || !visit.referredBy) return null;

    const doctor = await Doctor.findOne({ _id: visit.referredBy, labId });
    if (!doctor || doctor.commissionType === 'none' || doctor.commissionValue === 0) {
      return null;
    }

    // Idempotency: check if a Commission record already exists for this visit
    const existingCommission = await Commission.findOne({ labId, visitId });
    if (existingCommission) return existingCommission;

    let commissionAmount = 0;
    if (doctor.commissionType === 'percentage') {
      commissionAmount = (paidAmount * doctor.commissionValue) / 100;
    } else if (doctor.commissionType === 'flat') {
      commissionAmount = doctor.commissionValue;
    }

    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear();

    const commission = await Commission.create({
      labId,
      doctorId: doctor._id,
      visitId,
      patientId: visit.patientId,
      invoiceId,
      invoiceTotalAmount: paidAmount,
      commissionType: doctor.commissionType,
      commissionValue: doctor.commissionValue,
      commissionAmount,
      month,
      year,
      status: 'pending'
    });

    // Update doctor totals
    doctor.totalReferrals = (doctor.totalReferrals || 0) + 1;
    doctor.totalRevenue = (doctor.totalRevenue || 0) + paidAmount;
    await doctor.save();

    return commission;
  },

  /**
   * Retrieves commission records grouped by status.
   */
  async getDoctorCommissions(labId, doctorId, month, year) {
    const filter = { labId, doctorId, isDeleted: false };
    
    if (month !== undefined && month !== null && month !== '') {
      filter.month = Number(month);
    }
    if (year !== undefined && year !== null && year !== '') {
      filter.year = Number(year);
    }

    const commissions = await Commission.find(filter)
      .populate('visitId')
      .populate('patientId')
      .populate('invoiceId');

    const pending = [];
    const statement_sent = [];
    const paid = [];

    let pendingTotal = 0;
    let statementSentTotal = 0;
    let paidTotal = 0;

    for (const comm of commissions) {
      if (comm.status === 'pending') {
        pending.push(comm);
        pendingTotal += comm.commissionAmount;
      } else if (comm.status === 'statement_sent') {
        statement_sent.push(comm);
        statementSentTotal += comm.commissionAmount;
      } else if (comm.status === 'paid') {
        paid.push(comm);
        paidTotal += comm.commissionAmount;
      }
    }

    return {
      pending,
      statement_sent,
      paid,
      totals: {
        pending: pendingTotal,
        statement_sent: statementSentTotal,
        paid: paidTotal
      }
    };
  },

  /**
   * Marks a set of commission records as paid.
   */
  async markCommissionPaid(labId, doctorId, commissionIds, paymentReference, paidBy) {
    const result = await Commission.updateMany(
      { _id: { $in: commissionIds }, labId, doctorId, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          paidBy,
          paymentReference
        }
      }
    );
    return result.modifiedCount;
  },

  /**
   * Generates a monthly statement, enqueues a WhatsApp notification, and updates status.
   */
  async generateMonthlyStatement(labId, doctorId, month, year) {
    const commissions = await Commission.find({ labId, doctorId, month, year, isDeleted: false })
      .populate('doctorId')
      .populate({
        path: 'visitId',
        populate: { path: 'tests', select: 'name' }
      })
      .populate('patientId');

    if (commissions.length === 0) return null;

    const doctor = commissions[0].doctorId;
    const lab = await Lab.findById(labId);
    const labName = lab?.name || 'Pehlix Lab';

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const formattedMonth = `${monthNames[month - 1]} ${year}`;

    let totalCommissionAmount = 0;
    const records = commissions.map(comm => {
      totalCommissionAmount += comm.commissionAmount;
      
      const patientName = comm.patientId
        ? `${comm.patientId.firstName} ${comm.patientId.lastName || ''}`.trim()
        : 'Unknown';
        
      const visitCode = comm.visitId?.visitCode || 'N/A';
      
      const testNames = comm.visitId?.tests
        ? comm.visitId.tests.map(t => t.name).join(', ')
        : 'N/A';
        
      return {
        visitCode,
        patientName,
        testNames,
        invoiceAmount: comm.invoiceTotalAmount,
        commissionAmount: comm.commissionAmount
      };
    });

    const statementData = {
      doctorName: doctor.name,
      qualification: doctor.qualification || '',
      phone: doctor.phone,
      labName,
      month: formattedMonth,
      commissions: records,
      totalReferrals: commissions.length,
      totalCommissionAmount
    };

    const statementLink = `${config.NEXT_PUBLIC_APP_URL || 'https://app.pehlix.in'}/doctor/portal`;

    // Queue WhatsApp job
    await QStashService.enqueueNotification(
      'doctor_commission_statement',
      {
        doctorName: doctor.name,
        month: formattedMonth,
        totalReferrals: String(commissions.length),
        commissionAmount: String(totalCommissionAmount),
        statementLink,
        labName
      },
      doctor.phone
    );

    // Update only the commissions that are pending to statement_sent
    await Commission.updateMany(
      { _id: { $in: commissions.map(c => c._id) }, status: 'pending' },
      {
        $set: {
          status: 'statement_sent',
          statementSentAt: new Date()
        }
      }
    );

    return statementData;
  },

  /**
   * Runs the monthly statement generation for all active labs and eligible doctors.
   */
  async runMonthlyStatementCron(month, year) {
    const activeLabs = await Lab.find({ isActive: true });
    let successCount = 0;
    let failureCount = 0;
    const labsProcessed = [];

    for (const lab of activeLabs) {
      const labId = lab._id;
      const doctorIds = await Commission.distinct('doctorId', {
        labId,
        month,
        year,
        status: 'pending',
        isDeleted: false
      });

      if (doctorIds.length > 0) {
        labsProcessed.push(lab.name);
      }

      for (const docId of doctorIds) {
        try {
          const statement = await this.generateMonthlyStatement(labId, docId, month, year);
          if (statement) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (err) {
          console.error(`Failed to generate monthly statement for doctor ${docId} in lab ${labId}:`, err);
          failureCount++;
        }
      }
    }

    return {
      successCount,
      failureCount,
      labsProcessedCount: labsProcessed.length,
      labsProcessed
    };
  }
};

export default DoctorService;
