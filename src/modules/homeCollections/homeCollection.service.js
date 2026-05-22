import mongoose from 'mongoose';
import HomeCollection from './homeCollection.model.js';
import Patient from '../patients/patient.model.js';
import User from '../staff/user.model.js';
import Lab from '../staff/lab.model.js';
import QStashService from '../../utils/qstash.js';
import { AppError } from '../../utils/errors.js';
import { config } from '../../config/index.js';

export const HomeCollectionService = {
  /**
   * Create a home collection booking and schedule WhatsApp reminder.
   */
  async createHomeCollection(labId, data, createdBy) {
    // 1. Fetch patient, phlebotomist, lab
    const patient = await Patient.findOne({ _id: data.patientId, labId });
    if (!patient) {
      throw new AppError('Patient not found', 'VALIDATION_FAILED', 404);
    }
    const phlebotomist = await User.findOne({ _id: data.assignedPhlebotomist, labId, role: 'phlebotomist' });
    if (!phlebotomist) {
      throw new AppError('Phlebotomist not found', 'VALIDATION_FAILED', 404);
    }
    const lab = await Lab.findById(labId);
    if (!lab) {
      throw new AppError('Lab not found', 'VALIDATION_FAILED', 404);
    }

    // 2. Create home collection record
    const homeCollection = new HomeCollection({
      ...data,
      labId,
      status: 'scheduled',
      statusHistory: [{
        status: 'scheduled',
        timestamp: new Date(),
        updatedBy: createdBy,
        notes: 'Appointment scheduled'
      }]
    });

    await homeCollection.save();

    // 3. Calculate delaySeconds for reminder (2 hours before timeSlot starts)
    const scheduledDate = new Date(data.scheduledDate);
    const slotStartHour = {
      '7-9am': 7,
      '9-11am': 9,
      '11am-1pm': 11,
      '2-4pm': 14,
      '4-6pm': 16
    }[data.timeSlot] || 7;

    const reminderTime = new Date(scheduledDate);
    reminderTime.setHours(slotStartHour - 2, 0, 0, 0);

    const now = new Date();
    const delaySeconds = Math.max(0, Math.floor((reminderTime.getTime() - now.getTime()) / 1000));

    // 4. Format date to DD-MM-YYYY
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const year = scheduledDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    // 5. Enqueue WhatsApp notification via QStash
    const variables = {
      patientName: `${patient.firstName} ${patient.lastName || ''}`.trim(),
      scheduledDate: formattedDate,
      timeSlot: data.timeSlot,
      phlebotomistName: phlebotomist.name,
      phlebotomistPhone: phlebotomist.phone,
      labName: lab.name,
      labPhone: lab.phone,
      labId: labId.toString()
    };

    try {
      await QStashService.enqueueNotification(
        'home_visit_reminder',
        variables,
        patient.phone,
        delaySeconds
      );
    } catch (err) {
      console.error('[HOMECOLLECTION] Failed to enqueue QStash reminder:', err);
    }

    return homeCollection;
  },

  /**
   * Get active jobs assigned to a phlebotomist on a specific date, sorted by slot order.
   */
  async getPhlebotomistJobs(labId, phlebotomistId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const jobs = await HomeCollection.find({
      labId,
      assignedPhlebotomist: phlebotomistId,
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      isDeleted: false
    })
      .populate('patientId')
      .populate('visitId')
      .lean();

    const slotOrder = ['7-9am', '9-11am', '11am-1pm', '2-4pm', '4-6pm'];
    jobs.sort((a, b) => slotOrder.indexOf(a.timeSlot) - slotOrder.indexOf(b.timeSlot));

    return jobs;
  },

  /**
   * Transition home collection status.
   */
  async updateStatus(labId, homeCollectionId, newStatus, userId, extras = {}) {
    const homeCollection = await HomeCollection.findOne({ _id: homeCollectionId, labId, isDeleted: false });
    if (!homeCollection) {
      throw new AppError('Home collection not found', 'VALIDATION_FAILED', 404);
    }

    homeCollection.status = newStatus;

    // Build status history entry
    const historyEntry = {
      status: newStatus,
      timestamp: new Date(),
      updatedBy: userId
    };

    if (extras.gpsCoordinates) {
      historyEntry.gpsCoordinates = extras.gpsCoordinates;
      homeCollection.gpsCoordinates = extras.gpsCoordinates;
    }
    if (extras.notes) {
      historyEntry.notes = extras.notes;
      homeCollection.notes = extras.notes;
    }

    homeCollection.statusHistory.push(historyEntry);

    // If 'collected', handle cashCollected
    if (newStatus === 'collected') {
      if (extras.cashCollected !== undefined) {
        homeCollection.cashCollected = extras.cashCollected;
        homeCollection.cashReceivedAt = new Date();
      }
    }

    await homeCollection.save();

    // Fetch patient, lab details for notifications
    const patient = await Patient.findById(homeCollection.patientId);
    const lab = await Lab.findById(labId);

    if (patient && lab) {
      const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
      
      if (newStatus === 'collected') {
        const variables = {
          patientName,
          labName: lab.name,
          labPhone: lab.phone,
          labId: labId.toString(),
          expectedReportTime: 'today evening'
        };
        try {
          await QStashService.enqueueNotification(
            'sample_collected',
            variables,
            patient.phone
          );
        } catch (err) {
          console.error('[HOMECOLLECTION] Failed to enqueue sample_collected notification:', err);
        }
      } else if (newStatus === 'patientAbsent') {
        const rescheduleLink = `${config.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/appointments/reschedule?id=${homeCollectionId}`;
        const variables = {
          patientName,
          labName: lab.name,
          labPhone: lab.phone,
          labId: labId.toString(),
          rescheduleLink
        };
        try {
          await QStashService.enqueueNotification(
            'sample_rejected', // using sample_rejected template as fallback / rescheduling notification
            variables,
            patient.phone
          );
        } catch (err) {
          console.error('[HOMECOLLECTION] Failed to enqueue reschedule notification:', err);
        }
      }
    }

    return homeCollection;
  },

  /**
   * Process offline sync array chronologically.
   */
  async processOfflineSync(labId, phlebotomistId, actions) {
    // Sort actions chronologically by offlineCreatedAt
    const sortedActions = [...actions].sort((a, b) => new Date(a.offlineCreatedAt) - new Date(b.offlineCreatedAt));

    const results = [];

    for (const action of sortedActions) {
      try {
        const { homeCollectionId, status, gpsCoordinates, notes, cashCollected, offlineCreatedAt } = action;

        const homeCollection = await HomeCollection.findOne({
          _id: homeCollectionId,
          labId,
          isDeleted: false
        });

        if (!homeCollection) {
          results.push({ homeCollectionId, success: false, error: 'Home collection not found' });
          continue;
        }

        // Apply status transition
        homeCollection.status = status;
        homeCollection.isOfflineSynced = true;
        homeCollection.offlineCreatedAt = new Date(offlineCreatedAt);

        // Build history entry with original offline timestamp
        const historyEntry = {
          status,
          timestamp: new Date(offlineCreatedAt),
          updatedBy: phlebotomistId
        };

        if (gpsCoordinates) {
          historyEntry.gpsCoordinates = gpsCoordinates;
          homeCollection.gpsCoordinates = gpsCoordinates;
        }
        if (notes) {
          historyEntry.notes = notes;
          homeCollection.notes = notes;
        }

        homeCollection.statusHistory.push(historyEntry);

        if (status === 'collected') {
          if (cashCollected !== undefined) {
            homeCollection.cashCollected = cashCollected;
            homeCollection.cashReceivedAt = new Date(offlineCreatedAt);
          }
        }

        await homeCollection.save();

        // Trigger notifications
        const patient = await Patient.findById(homeCollection.patientId);
        const lab = await Lab.findById(labId);

        if (patient && lab) {
          const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
          if (status === 'collected') {
            const variables = {
              patientName,
              labName: lab.name,
              labPhone: lab.phone,
              labId: labId.toString(),
              expectedReportTime: 'today evening'
            };
            try {
              await QStashService.enqueueNotification(
                'sample_collected',
                variables,
                patient.phone
              );
            } catch (err) {
              console.error('[HOMECOLLECTION] Failed to enqueue offline sample_collected notification:', err);
            }
          } else if (status === 'patientAbsent') {
            const rescheduleLink = `${config.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/appointments/reschedule?id=${homeCollectionId}`;
            const variables = {
              patientName,
              labName: lab.name,
              labPhone: lab.phone,
              labId: labId.toString(),
              rescheduleLink
            };
            try {
              await QStashService.enqueueNotification(
                'sample_rejected',
                variables,
                patient.phone
              );
            } catch (err) {
              console.error('[HOMECOLLECTION] Failed to enqueue offline reschedule notification:', err);
            }
          }
        }

        results.push({ homeCollectionId, success: true });
      } catch (err) {
        results.push({ homeCollectionId, success: false, error: err.message });
      }
    }

    return results;
  },

  /**
   * Paginated search for home collections.
   */
  async getHomeCollections(labId, filters = {}, page = 1, limit = 10) {
    const query = { labId, isDeleted: false };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.assignedPhlebotomist) {
      query.assignedPhlebotomist = filters.assignedPhlebotomist;
    }

    if (filters.startDate || filters.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.scheduledDate.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.scheduledDate.$lte = end;
      }
    }

    const limitNum = parseInt(limit, 10) || 10;
    const pageNum = parseInt(page, 10) || 1;
    const skip = (pageNum - 1) * limitNum;

    const total = await HomeCollection.countDocuments(query);
    const collections = await HomeCollection.find(query)
      .populate('patientId', 'firstName lastName phone')
      .populate('assignedPhlebotomist', 'name phone')
      .sort({ scheduledDate: -1, timeSlot: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return {
      collections,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    };
  }
};

export default HomeCollectionService;
