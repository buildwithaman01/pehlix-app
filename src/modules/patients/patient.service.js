import Patient from './patient.model.js';
import Visit from '../visits/visit.model.js';
import Report from '../reports/report.model.js';
import { AppError } from '../../utils/errors.js';

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
   * Creates a new patient record.
   */
  async createPatient(labId, data, createdBy) {
    const patientCode = await this.generatePatientCode(labId);

    const consentTimestamp = data.consentGiven ? new Date() : undefined;

    // Build the patient document, ensuring labId is set from the parameter
    const patient = new Patient({
      ...data,
      labId,
      patientCode,
      consentTimestamp,
      isActive: true
    });

    await patient.save();
    return patient;
  },

  /**
   * Finds one patient by labId and phone (auto-fill lookup).
   */
  async findByPhone(labId, phone) {
    const patient = await Patient.findOne({ labId, phone, isDeleted: { $ne: true } });
    return patient;
  },

  /**
   * Searches patients with MongoDB Atlas Search, falling back to regex.
   */
  async searchPatients(labId, query, page = 1, limit = 10) {
    let patients = [];
    let total = 0;

    // Try Atlas Search first
    try {
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
              should: [
                {
                  text: {
                    query: query,
                    path: ['firstName', 'lastName', 'phone']
                  }
                },
                {
                  phrase: {
                    query: query,
                    path: 'patientCode'
                  }
                }
              ]
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
      const filter = {
        labId,
        isDeleted: { $ne: true },
        $or: [
          { firstName: regex },
          { lastName: regex },
          { phone: regex },
          { patientCode: regex }
        ]
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
