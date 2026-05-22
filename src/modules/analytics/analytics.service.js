import mongoose from 'mongoose';
import Lab from '../staff/lab.model.js';
import User from '../staff/user.model.js';
import Patient from '../patients/patient.model.js';
import Visit from '../visits/visit.model.js';
import Invoice from '../billing/invoice.model.js';
import Report from '../reports/report.model.js';
import Result from '../results/result.model.js';
import InventoryItem from '../inventory/inventoryItem.model.js';
import InventoryLog from '../inventory/inventoryLog.model.js';
import HomeCollection from '../homeCollections/homeCollection.model.js';
import Notification from '../notifications/notification.model.js';
import Doctor from '../doctors/doctor.model.js';
import Sample from '../samples/sample.model.js';
import PlatformAlert from './alert.model.js';
import QStashService from '../../utils/qstash.js';
import { AuditLog } from '../../middleware/audit.middleware.js';

const toObjectId = (id) => {
  if (!id) return null;
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
};

function getPeriodDateRange(period) {
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case '7days':
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '30days':
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '90days':
      startDate.setDate(now.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
  }
  return { startDate, endDate };
}

function formatCurrency(amount) {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });
  return formatter.format(amount || 0).replace('INR', '₹').replace(/\s/g, '');
}

export const AnalyticsService = {
  async getDashboardSummary(labId) {
    const labIdObj = toObjectId(labId);
    const now = new Date();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const lastWeekStart = new Date(todayStart);
    lastWeekStart.setDate(todayStart.getDate() - 7);
    const lastWeekEnd = new Date(todayEnd);
    lastWeekEnd.setDate(todayEnd.getDate() - 7);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(todayEnd.getDate() - 1);

    const [
      revenueTodayAgg,
      revenueLastWeekAgg,
      patientsToday,
      patientsYesterday,
      pendingPaymentsAgg,
      reportsSent,
      delayedReports,
      lowStockAlerts,
      criticalValuesPending
    ] = await Promise.all([
      // todayRevenue
      Invoice.aggregate([
        { $match: { labId: labIdObj, paymentStatus: 'paid', createdAt: { $gte: todayStart, $lte: todayEnd }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // same day last week revenue
      Invoice.aggregate([
        { $match: { labId: labIdObj, paymentStatus: 'paid', createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // todayPatients
      Visit.countDocuments({ labId: labIdObj, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      // yesterdayPatients
      Visit.countDocuments({ labId: labIdObj, createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      // pendingPayments
      Invoice.aggregate([
        { $match: { labId: labIdObj, paymentStatus: { $in: ['pending', 'partial'] }, isDeleted: { $ne: true } } },
        { $group: { _id: null, totalPending: { $sum: '$balanceAmount' }, invoiceCount: { $sum: 1 } } }
      ]),
      // reportsSent
      Report.countDocuments({ labId: labIdObj, deliveredAt: { $gte: todayStart, $lte: todayEnd }, isDeleted: { $ne: true } }),
      // delayedReports
      Visit.countDocuments({ labId: labIdObj, status: { $ne: 'delivered' }, expectedReportTime: { $lt: now } }),
      // lowStockAlerts
      InventoryItem.countDocuments({ labId: labIdObj, isDeleted: { $ne: true }, $expr: { $lte: ['$currentStock', '$minimumStock'] } }),
      // criticalValuesPending
      Result.countDocuments({ labId: labIdObj, isCritical: true, criticalAcknowledgedAt: null, isDeleted: { $ne: true } })
    ]);

    const amountToday = revenueTodayAgg[0]?.total || 0;
    const amountLastWeek = revenueLastWeekAgg[0]?.total || 0;
    const vsLastWeek = amountLastWeek > 0 
      ? parseFloat((((amountToday - amountLastWeek) / amountLastWeek) * 100).toFixed(2))
      : (amountToday > 0 ? 100 : 0);

    const vsYesterday = patientsYesterday > 0
      ? parseFloat((((patientsToday - patientsYesterday) / patientsYesterday) * 100).toFixed(2))
      : (patientsToday > 0 ? 100 : 0);

    return {
      todayRevenue: {
        amount: amountToday,
        vsLastWeek
      },
      todayPatients: {
        count: patientsToday,
        vsYesterday
      },
      pendingPayments: {
        totalPending: pendingPaymentsAgg[0]?.totalPending || 0,
        invoiceCount: pendingPaymentsAgg[0]?.invoiceCount || 0
      },
      reportsSent: {
        count: reportsSent
      },
      delayedReports: {
        count: delayedReports
      },
      lowStockAlerts: {
        count: lowStockAlerts
      },
      criticalValuesPending: {
        count: criticalValuesPending
      },
      generatedAt: new Date()
    };
  },

  async getRevenueAnalytics(labId, period) {
    const labIdObj = toObjectId(labId);
    const { startDate, endDate } = getPeriodDateRange(period);

    const matchQuery = {
      labId: labIdObj,
      paymentStatus: 'paid',
      createdAt: { $gte: startDate, $lte: endDate },
      isDeleted: { $ne: true }
    };

    const dailyData = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const hourlyData = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    const chartData = dailyData.map(d => ({ date: d._id, revenue: d.revenue }));
    const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);

    const dayDiff = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const averagePerDay = parseFloat((totalRevenue / dayDiff).toFixed(2));

    let bestDay = null;
    let maxRevenue = 0;
    chartData.forEach(item => {
      if (item.revenue > maxRevenue) {
        maxRevenue = item.revenue;
        bestDay = item.date;
      }
    });

    const peakHour = hourlyData.length > 0 ? hourlyData[0]._id : null;

    return {
      revenueData: chartData,
      totalRevenue,
      averagePerDay,
      bestDay,
      peakHour
    };
  },

  async getTestAnalytics(labId, period) {
    const labIdObj = toObjectId(labId);
    const { startDate, endDate } = getPeriodDateRange(period);

    const matchQuery = {
      labId: labIdObj,
      createdAt: { $gte: startDate, $lte: endDate },
      isDeleted: { $ne: true }
    };

    const testStats = await Invoice.aggregate([
      { $match: matchQuery },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: '$lineItems.testId',
          testName: { $first: '$lineItems.testName' },
          count: { $sum: 1 },
          revenue: { $sum: '$lineItems.finalPrice' }
        }
      }
    ]);

    const sortedByRevenue = [...testStats]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(t => ({ testName: t.testName, count: t.count, revenue: t.revenue }));

    const sortedByVolume = [...testStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(t => ({ testName: t.testName, count: t.count, revenue: t.revenue }));

    return {
      topTestsByRevenue: sortedByRevenue,
      topTestsByVolume: sortedByVolume
    };
  },

  async getDoctorAnalytics(labId, period) {
    const labIdObj = toObjectId(labId);
    const { startDate, endDate } = getPeriodDateRange(period);

    const doctorStats = await Visit.aggregate([
      {
        $match: {
          labId: labIdObj,
          referredBy: { $exists: true, $ne: null },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'invoice'
        }
      },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'commissions',
          localField: '_id',
          foreignField: 'visitId',
          as: 'commission'
        }
      },
      { $unwind: { path: '$commission', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$referredBy',
          totalReferrals: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$invoice.totalAmount', 0] } },
          totalCommission: { $sum: { $ifNull: ['$commission.commissionAmount', 0] } }
        }
      }
    ]);

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const twentyEightDaysAgo = new Date(now);
    twentyEightDaysAgo.setDate(now.getDate() - 28);

    const [weekStats, fourWeekStats] = await Promise.all([
      Visit.aggregate([
        { $match: { labId: labIdObj, referredBy: { $exists: true, $ne: null }, createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: '$referredBy', count: { $sum: 1 } } }
      ]),
      Visit.aggregate([
        { $match: { labId: labIdObj, referredBy: { $exists: true, $ne: null }, createdAt: { $gte: twentyEightDaysAgo } } },
        { $group: { _id: '$referredBy', count: { $sum: 1 } } }
      ])
    ]);

    const weekMap = {};
    weekStats.forEach(s => { weekMap[s._id.toString()] = s.count; });

    const fourWeekMap = {};
    fourWeekStats.forEach(s => { fourWeekMap[s._id.toString()] = s.count; });

    const allDoctors = await Doctor.find({ labId: labIdObj, isDeleted: { $ne: true } });
    const doctorStatsMap = {};
    doctorStats.forEach(stat => {
      doctorStatsMap[stat._id.toString()] = stat;
    });

    const results = allDoctors.map(doc => {
      const docIdStr = doc._id.toString();
      const stats = doctorStatsMap[docIdStr] || { totalReferrals: 0, totalRevenue: 0, totalCommission: 0 };
      
      const thisWeekCount = weekMap[docIdStr] || 0;
      const fourWeekCount = fourWeekMap[docIdStr] || 0;
      const fourWeekAverage = fourWeekCount / 4;

      let anomaly = false;
      let reason = '';
      if (fourWeekAverage > 0 && thisWeekCount < 0.5 * fourWeekAverage) {
        anomaly = true;
        reason = 'referral_drop';
      }

      return {
        doctorId: doc._id,
        name: doc.name,
        phone: doc.phone,
        qualification: doc.qualification,
        specialization: doc.specialization,
        commissionType: doc.commissionType,
        commissionValue: doc.commissionValue,
        totalReferrals: stats.totalReferrals,
        totalRevenue: stats.totalRevenue,
        totalCommission: stats.totalCommission,
        anomaly,
        reason: anomaly ? reason : undefined
      };
    });

    results.sort((a, b) => b.totalRevenue - a.totalRevenue);
    return results;
  },

  async getPatientAnalytics(labId, period) {
    const labIdObj = toObjectId(labId);
    const { startDate, endDate } = getPeriodDateRange(period);

    const [newPatients, returningPatientsAgg] = await Promise.all([
      Patient.countDocuments({
        labId: labIdObj,
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: { $ne: true }
      }),
      Visit.aggregate([
        { $match: { labId: labIdObj } },
        { $group: { _id: '$patientId', visitCount: { $sum: 1 } } },
        { $match: { visitCount: { $gt: 1 } } },
        { $count: 'count' }
      ])
    ]);

    const returningPatients = returningPatientsAgg[0]?.count || 0;
    const totalPatients = await Patient.countDocuments({ labId: labIdObj, isDeleted: { $ne: true } });
    const retentionRate = totalPatients > 0 ? parseFloat(((returningPatients / totalPatients) * 100).toFixed(2)) : 0;

    const topTests = await Visit.aggregate([
      { $match: { labId: labIdObj, createdAt: { $gte: startDate, $lte: endDate } } },
      { $unwind: '$tests' },
      { $group: { _id: '$tests', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'labtests',
          localField: '_id',
          foreignField: '_id',
          as: 'testDetails'
        }
      },
      { $unwind: { path: '$testDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          testId: '$_id',
          testName: { $ifNull: ['$testDetails.name', 'Unknown Test'] },
          count: 1
        }
      }
    ]);

    return {
      newPatients,
      returningPatients,
      retentionRate,
      topTestsOrdered: topTests
    };
  },

  async getOperationsAnalytics(labId, period) {
    const labIdObj = toObjectId(labId);
    const { startDate, endDate } = getPeriodDateRange(period);

    const [tatStats, sampleStats, fpyStats, statusStats] = await Promise.all([
      Report.aggregate([
        { $match: { labId: labIdObj, deliveredAt: { $gte: startDate, $lte: endDate }, isDeleted: { $ne: true } } },
        {
          $lookup: {
            from: 'visits',
            localField: 'visitId',
            foreignField: '_id',
            as: 'visit'
          }
        },
        { $unwind: '$visit' },
        {
          $project: {
            tatMinutes: {
              $divide: [{ $subtract: ['$deliveredAt', '$visit.createdAt'] }, 1000 * 60]
            }
          }
        },
        {
          $group: {
            _id: null,
            averageTat: { $avg: '$tatMinutes' }
          }
        }
      ]),
      Sample.aggregate([
        { $match: { labId: labIdObj, createdAt: { $gte: startDate, $lte: endDate }, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalSamples: { $sum: 1 },
            rejectedSamples: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            }
          }
        }
      ]),
      Visit.aggregate([
        { $match: { labId: labIdObj, createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: 'samples',
            localField: '_id',
            foreignField: 'visitId',
            as: 'samples'
          }
        },
        {
          $project: {
            hasRejectedSample: {
              $anyElementTrue: {
                $map: {
                  input: '$samples',
                  as: 's',
                  in: { $eq: ['$$s.status', 'rejected'] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            visitsWithoutRejections: {
              $sum: { $cond: [{ $eq: ['$hasRejectedSample', false] }, 1, 0] }
            }
          }
        }
      ]),
      Visit.aggregate([
        { $match: { labId: labIdObj, status: { $in: ['registered', 'sampleCollected', 'processing', 'resultsEntered', 'approved'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const averageTurnaroundTime = tatStats[0]?.averageTat 
      ? parseFloat(tatStats[0].averageTat.toFixed(2)) 
      : 0;

    const totalSamples = sampleStats[0]?.totalSamples || 0;
    const rejectedSamples = sampleStats[0]?.rejectedSamples || 0;
    const rejectionRate = totalSamples > 0 
      ? parseFloat(((rejectedSamples / totalSamples) * 100).toFixed(2)) 
      : 0;

    const totalVisitsCount = fpyStats[0]?.totalVisits || 0;
    const visitsWithoutRejections = fpyStats[0]?.visitsWithoutRejections || 0;
    const firstPassYield = totalVisitsCount > 0 
      ? parseFloat(((visitsWithoutRejections / totalVisitsCount) * 100).toFixed(2)) 
      : 0;

    const pendingByStage = {
      registered: 0,
      sampleCollected: 0,
      processing: 0,
      resultsEntered: 0,
      approved: 0
    };
    statusStats.forEach(s => {
      if (pendingByStage[s._id] !== undefined) {
        pendingByStage[s._id] = s.count;
      }
    });

    return {
      averageTurnaroundTime,
      rejectionRate,
      firstPassYield,
      pendingByStage
    };
  },

  async getPendingPaymentsBreakdown(labId) {
    const labIdObj = toObjectId(labId);
    const now = new Date();

    const pendingInvoices = await Invoice.aggregate([
      {
        $match: {
          labId: labIdObj,
          paymentStatus: { $in: ['pending', 'partial'] },
          isDeleted: { $ne: true }
        }
      },
      {
        $project: {
          balanceAmount: 1,
          createdAt: 1,
          daysPending: {
            $divide: [{ $subtract: [now, '$createdAt'] }, 1000 * 60 * 60 * 24]
          }
        }
      },
      {
        $project: {
          balanceAmount: 1,
          daysPending: 1,
          bucket: {
            $cond: [
              { $lte: ['$daysPending', 1] }, '0-1 days',
              {
                $cond: [
                  { $lte: ['$daysPending', 3] }, '2-3 days',
                  {
                    $cond: [
                      { $lte: ['$daysPending', 7] }, '4-7 days',
                      {
                        $cond: [
                          { $lte: ['$daysPending', 30] }, '8-30 days',
                          '30+ days'
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  },
  {
    $group: {
      _id: '$bucket',
      count: { $sum: 1 },
      totalAmount: { $sum: '$balanceAmount' }
    }
  }
]);

    const buckets = {
      '0-1 days': { count: 0, totalAmount: 0 },
      '2-3 days': { count: 0, totalAmount: 0 },
      '4-7 days': { count: 0, totalAmount: 0 },
      '8-30 days': { count: 0, totalAmount: 0 },
      '30+ days': { count: 0, totalAmount: 0 }
    };

    pendingInvoices.forEach(b => {
      if (buckets[b._id] !== undefined) {
        buckets[b._id] = { count: b.count, totalAmount: b.totalAmount };
      }
    });

    const oldestInvoices = await Invoice.find({
      labId: labIdObj,
      paymentStatus: { $in: ['pending', 'partial'] },
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: 1 })
      .limit(20)
      .populate('patientId');

    const oldestList = oldestInvoices.map(inv => {
      const patient = inv.patientId || {};
      const patientName = patient.firstName 
        ? `${patient.firstName} ${patient.lastName || ''}`.trim() 
        : 'Unknown Patient';
      const daysPending = Math.floor((now - inv.createdAt) / (1000 * 60 * 60 * 24));
      return {
        invoiceId: inv._id,
        invoiceCode: inv.invoiceCode,
        patientName,
        phone: patient.phone || '',
        amount: inv.balanceAmount !== undefined ? inv.balanceAmount : (inv.totalAmount - inv.amountPaid),
        daysPending
      };
    });

    return {
      buckets,
      oldestPending: oldestList
    };
  },

  async calculateHealthScore(labId) {
    const labIdObj = toObjectId(labId);
    const now = new Date();
    const lab = await Lab.findById(labIdObj);
    if (!lab) {
      throw new Error(`Lab ${labId} not found`);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // 1. Login Frequency (20 points max)
    const logs = await AuditLog.aggregate([
      { $match: { labId: labIdObj, timestamp: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } } } }
    ]);
    const uniqueDaysCount = logs.length;
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const loggedInToday = logs.some(l => l._id === todayStr);

    let loginPoints = 0;
    let churnRisk = false;
    if (uniqueDaysCount === 0) {
      churnRisk = true;
    } else {
      if (loggedInToday) loginPoints += 10;
      if (uniqueDaysCount >= 5) loginPoints += 10;
    }

    // 2. Patient Volume (20 points max)
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const monthlyPatientsCount = await Patient.countDocuments({
      labId: labIdObj,
      createdAt: { $gte: thisMonthStart },
      isDeleted: { $ne: true }
    });
    const monthlyPatientsLimit = lab.planConfig?.limits?.monthlyPatients;
    let patientVolumePoints = 5;
    if (!monthlyPatientsLimit || monthlyPatientsLimit <= 0) {
      patientVolumePoints = 20;
    } else {
      const percentage = (monthlyPatientsCount / monthlyPatientsLimit) * 100;
      if (percentage > 50) {
        patientVolumePoints = 20;
      } else if (percentage >= 20) {
        patientVolumePoints = 10;
      } else {
        patientVolumePoints = 5;
      }
    }

    // 3. WhatsApp Connected (10 points)
    const deliveredNotification = await Notification.findOne({
      labId: labIdObj,
      status: { $in: ['sent', 'delivered'] },
      createdAt: { $gte: sevenDaysAgo }
    });
    const whatsappPoints = deliveredNotification ? 10 : 0;

    // 4. Doctor Portal Active (10 points)
    const activeDoctorPortal = await Doctor.findOne({
      labId: labIdObj,
      portalAccess: true,
      isDeleted: { $ne: true }
    });
    const doctorPortalPoints = activeDoctorPortal ? 10 : 0;

    // 5. Inventory Active (5 points)
    const inventoryLogEntry = await InventoryLog.findOne({
      labId: labIdObj,
      createdAt: { $gte: thirtyDaysAgo }
    });
    const inventoryPoints = inventoryLogEntry ? 5 : 0;

    // 6. Home Collection Active (5 points)
    const homeCollectionEntry = await HomeCollection.findOne({
      labId: labIdObj,
      createdAt: { $gte: thirtyDaysAgo }
    });
    const homeCollectionPoints = homeCollectionEntry ? 5 : 0;

    // 7. Staff Usage (10 points)
    const distinctUsers = await AuditLog.distinct('userId', {
      labId: labIdObj,
      timestamp: { $gte: sevenDaysAgo },
      userId: { $ne: null }
    });
    const staffUsagePoints = distinctUsers.length > 1 ? 10 : (distinctUsers.length === 1 ? 5 : 0);

    // 8. Payment Health (10 points)
    const paymentPoints = (lab.billing?.status === 'active' || lab.billing?.status === 'trial') ? 10 : 0;

    // 9. Support Health (10 points)
    const supportPoints = 10;

    const score = loginPoints + patientVolumePoints + whatsappPoints + doctorPortalPoints + 
                  inventoryPoints + homeCollectionPoints + staffUsagePoints + paymentPoints + supportPoints;

    return {
      score,
      breakdown: {
        loginFrequency: { earned: loginPoints, max: 20 },
        patientVolume: { earned: patientVolumePoints, max: 20 },
        whatsappConnected: { earned: whatsappPoints, max: 10 },
        doctorPortalActive: { earned: doctorPortalPoints, max: 10 },
        inventoryActive: { earned: inventoryPoints, max: 5 },
        homeCollectionActive: { earned: homeCollectionPoints, max: 5 },
        staffUsage: { earned: staffUsagePoints, max: 10 },
        paymentHealth: { earned: paymentPoints, max: 10 },
        supportHealth: { earned: supportPoints, max: 10 }
      },
      churnRisk,
      calculatedAt: new Date()
    };
  },

  async updateLabHealthScore(labId, score) {
    const labIdObj = toObjectId(labId);
    await Lab.findByIdAndUpdate(labIdObj, {
      healthScore: score,
      healthScoreUpdatedAt: new Date()
    });

    if (score < 50) {
      await PlatformAlert.create({
        labId: labIdObj,
        type: 'health_score_low',
        score,
        message: 'Lab health score is below 50 — proactive outreach needed',
        isRead: false
      });
    }

    if (score < 30) {
      console.log(`[URGENT] Lab health score is below 30 for lab ${labIdObj}. Score: ${score}`);
    }
  },

  async runHealthScoreUpdate() {
    const activeLabs = await Lab.find({ isActive: true, isSuspended: false });
    let processed = 0;
    let alerts = 0;
    let urgent = 0;

    for (let i = 0; i < activeLabs.length; i += 10) {
      const batch = activeLabs.slice(i, i + 10);
      await Promise.all(batch.map(async (lab) => {
        try {
          const healthData = await this.calculateHealthScore(lab._id);
          await this.updateLabHealthScore(lab._id, healthData.score);
          processed++;
          if (healthData.score < 50) alerts++;
          if (healthData.score < 30) urgent++;
        } catch (err) {
          console.error(`Failed to update health score for lab ${lab._id}:`, err);
        }
      }));

      if (i + 10 < activeLabs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      processed,
      alerts,
      urgent
    };
  },

  async getDailyWhatsAppSummary(labId) {
    const labIdObj = toObjectId(labId);
    const lab = await Lab.findById(labIdObj).populate('owner');
    if (!lab) {
      throw new Error(`Lab ${labId} not found`);
    }

    let ownerName = lab.owner?.name || '';
    if (!ownerName) {
      const ownerUser = await User.findOne({ labId: labIdObj, role: 'owner' });
      ownerName = ownerUser?.name || 'Lab Owner';
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      revenueTodayAgg,
      patientsTodayCount,
      pendingPaymentsAgg,
      reportsDeliveredCount,
      lowStockCount,
      criticalValuesPending
    ] = await Promise.all([
      // Revenue
      Invoice.aggregate([
        { $match: { labId: labIdObj, paymentStatus: 'paid', createdAt: { $gte: todayStart, $lte: todayEnd }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // Patient visits registered today
      Visit.countDocuments({ labId: labIdObj, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      // Total pending payments (all time balanceAmount for pending/partial)
      Invoice.aggregate([
        { $match: { labId: labIdObj, paymentStatus: { $in: ['pending', 'partial'] }, isDeleted: { $ne: true } } },
        { $group: { _id: null, totalPending: { $sum: '$balanceAmount' } } }
      ]),
      // Reports delivered today
      Report.countDocuments({ labId: labIdObj, deliveredAt: { $gte: todayStart, $lte: todayEnd }, isDeleted: { $ne: true } }),
      // Low stock alerts
      InventoryItem.countDocuments({ labId: labIdObj, isDeleted: { $ne: true }, $expr: { $lte: ['$currentStock', '$minimumStock'] } }),
      // Critical values pending
      Result.countDocuments({ labId: labIdObj, isCritical: true, criticalAcknowledgedAt: null, isDeleted: { $ne: true } })
    ]);

    const revenueAmount = revenueTodayAgg[0]?.total || 0;
    const pendingAmount = pendingPaymentsAgg[0]?.totalPending || 0;

    const formattedRevenue = formatCurrency(revenueAmount);
    const formattedPending = formatCurrency(pendingAmount);

    const totalAlerts = lowStockCount + criticalValuesPending;
    let alerts = 'No alerts';
    if (totalAlerts > 0) {
      const parts = [];
      if (lowStockCount > 0) parts.push(`${lowStockCount} low stock`);
      if (criticalValuesPending > 0) parts.push(`${criticalValuesPending} critical alert${criticalValuesPending > 1 ? 's' : ''}`);
      alerts = parts.join(', ');
    }

    const dateOptions = { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' };
    const dateFormatted = new Date().toLocaleDateString('en-IN', dateOptions).replace(/,/g, '');

    return {
      ownerName,
      labName: lab.name,
      date: dateFormatted,
      patientCount: patientsTodayCount,
      revenue: formattedRevenue,
      pendingAmount: formattedPending,
      reportCount: reportsDeliveredCount,
      alerts
    };
  },

  async runDailySummaryForAllLabs() {
    const activeLabs = await Lab.find({
      isActive: true,
      isSuspended: false,
      'billing.status': { $ne: 'suspended' }
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < activeLabs.length; i += 10) {
      const batch = activeLabs.slice(i, i + 10);
      await Promise.all(batch.map(async (lab) => {
        try {
          const ownerUser = await User.findOne({ labId: lab._id, role: 'owner' });
          const phone = ownerUser?.phone || lab.phone;

          if (!phone) {
            skipped++;
            console.log(`[Daily Summary] Skipped lab ${lab.name} (${lab._id}) - No phone found`);
            return;
          }

          const variables = await this.getDailyWhatsAppSummary(lab._id);
          // Queue via QStashService
          await QStashService.enqueueNotification('owner_daily_summary', variables, phone);
          
          sent++;
          console.log(`[Daily Summary] Queued summary for lab ${lab.name} to ${phone}`);
        } catch (err) {
          failed++;
          console.error(`[Daily Summary] Failed to process daily summary for lab ${lab._id}:`, err);
        }
      }));

      if (i + 10 < activeLabs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { sent, failed, skipped };
  }
};

export default AnalyticsService;
