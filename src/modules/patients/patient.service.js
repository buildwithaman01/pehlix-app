import mongoose from 'mongoose';
import Patient from './patient.model.js';
import Visit from '../visits/visit.model.js';
import Report from '../reports/report.model.js';
import { AppError } from '../../utils/errors.js';
import { calculateBlindIndex } from '../../utils/crypto.js';

export const PatientService = {
  /**
   * Generates a unique patient code sequentially per lab.
   * Format: PAT + 5-digit sequential number (e.g. PAT00001)
   */
  async generatePatientCode(labId) {
    const count = await Patient.countDocuments({ labId });
    const nextNum = count + 1;
    const sequentialStr = String(nextNum).padStart(5, '0');
    return `PAT${sequentialStr}`;
  },

  /**
   * Creates a new patient record. Enforces DPDP Act 2023 consent requirement.
   */
  async createPatient(labId, data, createdBy, ipAddress = null) {
    // 3.1 Consent enforcement — patient cannot be registered without consent
    if (!data.consentGiven) {
      throw new AppError(
        'Patient consent is required before registration. Please confirm the patient has verbally consented to data collection.',
        'CONSENT_REQUIRED',
        422
      );
    }

    const patientCode = await this.generatePatientCode(labId);

    const patient = new Patient({
      ...data,
      labId,
      patientCode,
      consentTimestamp: new Date(),
      consentIpAddress: ipAddress || undefined,
      consentMethod: data.consentMethod || 'staff_entry',
      isActive: true
    });

    await patient.save();
    return patient;
  },

  /**
   * Finds one patient by labId and phone (auto-fill lookup).
   */
  async findByPhone(labId, phone) {
    const blindIndex = calculateBlindIndex(phone, 'phone');
    const patient = await Patient.findOne({ labId, phoneBlindIndex: blindIndex, isDeleted: { $ne: true } });
    return patient;
  },

  /**
   * Searches patients with MongoDB Atlas Search, falling back to regex.
   */
  async searchPatients(labId, query = '', page = 1, limit = 10, cursor = null) {
    let patients = [];
    let total = 0;

    if (!query || query.trim() === '') {
      const filter = { labId, isDeleted: { $ne: true } };
      let hasNextPage = false;
      let nextCursor = null;

      if (cursor !== null) {
        if (cursor) {
          try {
            const decoded = Buffer.from(cursor, 'base64').toString('utf8');
            const parts = decoded.split('_');
            if (parts.length === 2) {
              const cursorDate = new Date(parts[0]);
              const cursorId = parts[1];
              filter.$or = [
                { createdAt: { $lt: cursorDate } },
                { createdAt: cursorDate, _id: { $lt: new mongoose.Types.ObjectId(cursorId) } }
              ];
            }
          } catch (err) {
            console.error('[PatientService] Failed to parse cursor, falling back to all records:', err);
          }
        }

        patients = await Patient.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit + 1);

        if (patients.length > limit) {
          hasNextPage = true;
          const lastItem = patients[limit - 1];
          nextCursor = Buffer.from(`${lastItem.createdAt.toISOString()}_${lastItem._id.toString()}`).toString('base64');
          patients = patients.slice(0, limit);
        }
      } else {
        total = await Patient.countDocuments(filter);
        patients = await Patient.find(filter)
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1, _id: -1 });

        const totalPages = Math.ceil(total / limit);
        return {
          patients,
          total,
          page,
          limit,
          totalPages
        };
      }

      return {
        patients,
        nextCursor,
        hasNextPage,
        limit
      };
    }

    const cleanQuery = query.replace(/\D/g, '');
    const isPhoneSearch = cleanQuery.length >= 10;
    const phoneHash = isPhoneSearch ? calculateBlindIndex(cleanQuery, 'phone') : null;

    // Try Atlas Search first
    try {
      const shouldConditions = [
        {
          text: {
            query: query,
            path: ['firstName', 'lastName']
          }
        },
        {
          phrase: {
            query: query,
            path: 'patientCode'
          }
        }
      ];

      if (isPhoneSearch) {
        shouldConditions.push({
          equals: {
            path: 'phoneBlindIndex',
            value: phoneHash
          }
        });
      }

      const pipeline = [
        {
          $search: {
            index: 'default',
            compound: {
              filter: [
                {
                  equals: {
                    path: 'labId',
                    value: labId
                  }
                }
              ],
              should: shouldConditions
            }
          }
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: (page - 1) * limit }, { $limit: limit }]
          }
        }
      ];

      const results = await Patient.aggregate(pipeline);
      total = results[0]?.metadata[0]?.total || 0;
      patients = results[0]?.data || [];

      // If we got nothing, fallback to regex just in case the Atlas index isn't ready or doesn't support the query format
      if (patients.length === 0 && total === 0) {
        throw new Error('No results from Atlas search; falling back to regex.');
      }
    } catch (error) {
      // Fallback: standard Regex search
      const regex = new RegExp(query, 'i');
      const orConditions = [
        { firstName: regex },
        { lastName: regex },
        { patientCode: regex }
      ];

      if (isPhoneSearch) {
        orConditions.push({ phoneBlindIndex: phoneHash });
      }

      const filter = {
        labId,
        isDeleted: { $ne: true },
        $or: orConditions
      };

      total = await Patient.countDocuments(filter);
      patients = await Patient.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });
    }

    return {
      patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Retrieves visit history for a specific patient, mapping in report statuses.
   */
  async getPatientHistory(labId, patientId) {
    // 1. Fetch visits populated with their invoice details
    const visits = await Visit.find({ labId, patientId })
      .populate('invoiceId')
      .sort({ createdAt: -1 });

    // 2. Fetch all reports for this patient to map statuses in memory
    const reports = await Report.find({ labId, patientId });
    const reportMap = reports.reduce((acc, report) => {
      acc[report.visitId.toString()] = {
        reportId: report._id,
        reportCode: report.reportCode,
        status: report.status,
        pdfUrl: report.pdfUrl,
        deliveredAt: report.deliveredAt
      };
      return acc;
    }, {});

    // 3. Attach report info to each visit object
    const history = visits.map(visit => {
      const visitObj = visit.toObject();
      visitObj.report = reportMap[visit._id.toString()] || null;
      return visitObj;
    });

    return history;
  }
};

export default PatientService;
