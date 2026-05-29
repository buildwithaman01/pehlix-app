import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Redis } from '@upstash/redis';
import config from '../../config/index.js';
import Lab from '../staff/lab.model.js';
import User from '../staff/user.model.js';
import Report from '../reports/report.model.js';
import PlatformAlert from '../analytics/alert.model.js';
import { AuditLog } from '../../middleware/audit.middleware.js';
import WhatsAppService from '../../utils/whatsapp.js';
import PdfService from '../../utils/pdf.js';
import { seedLabCatalog } from '../../utils/seedCatalog.js';

const redis = new Redis({
  url: config.UPSTASH_REDIS_URL,
  token: config.UPSTASH_REDIS_TOKEN
});

// --- INLINE SCHEMAS ---

const ImpersonationLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  reason: { type: String, required: true },
  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
  actionsCount: { type: Number, default: 0 }
});
export const ImpersonationLog = mongoose.models.ImpersonationLog || mongoose.model('ImpersonationLog', ImpersonationLogSchema);

const FeatureFlagsSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  enabled: { type: Boolean, default: false },
  rolloutPercentage: { type: Number, default: 0 },
  labIdsWhitelist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lab' }]
}, { timestamps: true });
export const FeatureFlags = mongoose.models.FeatureFlags || mongoose.model('FeatureFlags', FeatureFlagsSchema);

// --- HELPER FUNCTIONS ---

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// --- SERVICE IMPLEMENTATION ---

export const AdminService = {
  /**
   * Find all labs - platform-wide
   */
  async getAllLabs(filters = {}, page = 1, limit = 10) {
    const query = {};
    if (filters.plan) {
      query.plan = filters.plan;
    }
    if (filters.status) {
      query['billing.status'] = filters.status;
    }
    if (filters.city) {
      query['address.city'] = { $regex: new RegExp(filters.city, 'i') };
    }
    if (filters.healthScoreBelow !== undefined && filters.healthScoreBelow !== null) {
      query.healthScore = { $lt: Number(filters.healthScoreBelow) };
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    let sort = { createdAt: -1 };
    if (filters.healthScoreBelow !== undefined && filters.healthScoreBelow !== null) {
      sort = { healthScore: 1 };
    }

    const total = await Lab.countDocuments(query);
    const labs = await Lab.find(query)
      .populate('owner', 'name phone')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    return { labs, total, page: pageNum, limit: limitNum };
  },

  /**
   * Create a new lab and provision its owner user account.
   */
  async createLab(data, createdBy) {
    // 1. Check if user with owner phone already exists
    const existingUser = await User.findOne({ phone: data.ownerPhone });
    if (existingUser) {
      throw new Error(`A user with phone number ${data.ownerPhone} already exists`);
    }

    // 2. Generate slug
    const baseSlug = data.labName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const rand = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${rand}`;

    // 3. Define default plan configuration based on selected plan
    let planConfig = {
      modules: {
        patients: true,
        visits: true,
        results: true,
        reports: true,
        billing: true,
        doctors: true,
        staff: true,
        notifications: true,
        samples: true,
        inventory: false,
        homeCollections: false,
        analytics: false,
        webhooks: false
      },
      limits: {
        staffCount: 3,
        monthlyTests: 300
      },
      features: {
        whatsappAlerts: true,
        smsAlerts: true,
        communicationMode: 'waMe',
        paymentCheckMode: 'pendingOnly',
        showWhatsAppOnResultEntry: true
      },
      flags: {}
    };

    if (data.plan === 'growth') {
      planConfig.modules.inventory = true;
      planConfig.modules.homeCollections = true;
      planConfig.modules.analytics = true;
      planConfig.limits.staffCount = 10;
      planConfig.limits.monthlyTests = 1500;
      planConfig.features.automatedReminders = true;
      planConfig.features.dailySummaries = true;
    } else if (data.plan === 'pro' || data.plan === 'custom') {
      planConfig.modules.inventory = true;
      planConfig.modules.homeCollections = true;
      planConfig.modules.analytics = true;
      planConfig.modules.webhooks = true;
      planConfig.limits.staffCount = 999;
      planConfig.limits.monthlyTests = 99999;
      planConfig.features.automatedReminders = true;
      planConfig.features.dailySummaries = true;
      planConfig.features.webhookIntegrations = true;
      planConfig.features.customTemplates = true;
    }

    // 4. Create the Lab document
    const hasGst = !!(data.gstNumber || data.gstin);
    const hasNabl = !!(data.nablNumber);
    const isTrusted = hasGst || hasNabl;

    const registrationState = isTrusted ? 'production' : 'sandbox';
    const now = new Date();
    const trialEndDate = new Date();
    let tempTrialExpiry = null;

    if (isTrusted) {
      trialEndDate.setDate(now.getDate() + 14); // Standard 14-day trial
    } else {
      trialEndDate.setDate(now.getDate() + 2); // 2-day trial
      tempTrialExpiry = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
    }

    const lab = new Lab({
      name: data.labName,
      slug,
      phone: data.phone || data.ownerPhone,
      email: data.email || data.ownerEmail,
      address: {
        city: data.city
      },
      plan: data.plan,
      planConfig,
      billing: {
        status: 'trial',
        trialStartDate: now,
        trialEndDate
      },
      nablNumber: data.nablNumber || '',
      gstNumber: data.gstNumber || data.gstin || '',
      registrationState,
      tempTrialExpiry,
      isActive: true,
      isSuspended: false
    });

    const savedLab = await lab.save();

    // 5. Create the Owner User account
    const owner = new User({
      name: data.ownerName,
      role: 'owner',
      phone: data.ownerPhone,
      email: data.ownerEmail,
      labId: savedLab._id,
      isOtpOnly: true,
      isActive: true
    });

    const savedOwner = await owner.save();

    // 6. Link the owner to the lab document
    savedLab.owner = savedOwner._id;
    await savedLab.save();

    // Seed standard test catalog for this lab
    try {
      await seedLabCatalog(savedLab._id);
    } catch (seedErr) {
      console.error('Failed to seed standard tests during lab creation:', seedErr);
    }

    // 7. Log to audit logs
    const isSuperAdmin = mongoose.Types.ObjectId.isValid(createdBy);
    await AuditLog.create({
      labId: savedLab._id,
      userId: isSuperAdmin ? createdBy : savedOwner._id,
      role: isSuperAdmin ? 'superAdmin' : 'owner',
      action: 'lab_onboarded',
      superAdmin: isSuperAdmin,
      timestamp: new Date(),
      details: {
        labId: savedLab._id,
        ownerId: savedOwner._id,
        plan: data.plan,
        createdBy: isSuperAdmin ? createdBy : 'self'
      }
    });

    return {
      lab: savedLab,
      owner: savedOwner
    };
  },

  /**
   * Find lab by ID
   */
  async getLabById(labId) {
    return await Lab.findById(labId).populate('owner', 'name phone email').lean();
  },

  /**
   * Update lab configuration changes on planConfig
   */
  async updateLabConfig(labId, configChanges, changedBy) {
    const lab = await Lab.findById(labId).lean();
    if (!lab) {
      throw new Error('Lab not found');
    }

    const updateObj = {};
    for (const [key, val] of Object.entries(configChanges)) {
      updateObj[`planConfig.${key}`] = val;
    }

    const updatedLab = await Lab.findByIdAndUpdate(labId, { $set: updateObj }, { new: true }).lean();

    // Log config updates to audit logs
    for (const [key, val] of Object.entries(configChanges)) {
      const oldValue = getNestedValue(lab.planConfig || {}, key);
      await AuditLog.create({
        labId,
        userId: changedBy,
        role: 'superAdmin',
        action: 'planConfig_change',
        superAdmin: true,
        timestamp: new Date(),
        details: { field: key, oldValue, newValue: val, changedBy, labId }
      });
    }

    return updatedLab;
  },

  /**
   * Suspend a lab
   */
  async suspendLab(labId, reason, suspendedBy) {
    const lab = await Lab.findById(labId);
    if (!lab) {
      throw new Error('Lab not found');
    }

    lab.isSuspended = true;
    lab.isActive = false;
    lab.suspensionReason = reason;
    lab.tokenVersion = (lab.tokenVersion || 0) + 1;
    lab.suspendedAt = new Date();
    await lab.save();

    // Force logout of all lab users
    await User.updateMany({ labId: lab._id }, { $inc: { tokenVersion: 1 } });

    // WhatsApp lab owner
    const ownerUser = await User.findOne({ labId: lab._id, role: 'owner' });
    const phone = ownerUser?.phone || lab.phone;
    if (phone) {
      const message = `Your lab "${lab.name}" has been suspended. Reason: ${reason}`;
      try {
        await WhatsAppService.sendDirectText(phone, message, lab._id);
      } catch (err) {
        console.error('Failed to send suspension text to owner:', err);
      }
    }

    // Log to AuditLog
    await AuditLog.create({
      labId: lab._id,
      userId: suspendedBy,
      role: 'superAdmin',
      action: 'lab_suspended',
      superAdmin: true,
      timestamp: new Date(),
      details: { reason, suspendedBy }
    });

    return lab;
  },

  /**
   * Restore a suspended lab
   */
  async restoreLab(labId, restoredBy) {
    const lab = await Lab.findById(labId);
    if (!lab) {
      throw new Error('Lab not found');
    }

    lab.isSuspended = false;
    lab.isActive = true;
    lab.suspensionReason = undefined;
    lab.suspendedAt = undefined;
    await lab.save();

    // WhatsApp owner
    const ownerUser = await User.findOne({ labId: lab._id, role: 'owner' });
    const phone = ownerUser?.phone || lab.phone;
    if (phone) {
      const message = `Your lab "${lab.name}" has been restored successfully.`;
      try {
        await WhatsAppService.sendDirectText(phone, message, lab._id);
      } catch (err) {
        console.error('Failed to send restoration text to owner:', err);
      }
    }

    // Log to AuditLog
    await AuditLog.create({
      labId: lab._id,
      userId: restoredBy,
      role: 'superAdmin',
      action: 'lab_restored',
      superAdmin: true,
      timestamp: new Date(),
      details: { restoredBy }
    });

    return lab;
  },

  /**
   * Create impersonation token
   */
  async createImpersonationToken(labId, targetUserId, adminId, reason) {
    if (!reason || reason.trim() === '') {
      throw new Error('Impersonation reason is required');
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    if (targetUser.labId?.toString() !== labId.toString()) {
      throw new Error('User does not belong to this lab');
    }

    const privateKey = (process.env.JWT_ACCESS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!privateKey || privateKey.includes('PLACEHOLDER')) {
      throw new Error('JWT Access Private Key is missing or misconfigured.');
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const payload = {
      userId: targetUserId.toString(),
      labId: labId.toString(),
      role: targetUser.role,
      permissions: targetUser.permissions || [],
      isImpersonation: true,
      impersonatedBy: adminId.toString(),
      impersonationReason: reason,
      exp: Math.floor(expiresAt.getTime() / 1000)
    };

    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

    // Save in ImpersonationLog
    await ImpersonationLog.create({
      adminId,
      targetUserId,
      labId,
      reason,
      startedAt: new Date(),
      expiresAt,
      endedAt: null,
      actionsCount: 0
    });

    // Log to AuditLog
    await AuditLog.create({
      labId,
      userId: targetUserId,
      role: 'superAdmin',
      action: 'impersonation_started',
      superAdmin: true,
      isImpersonation: true,
      impersonatedBy: adminId,
      timestamp: new Date(),
      details: { targetUserId, labId, reason }
    });

    const lab = await Lab.findById(labId).lean();
    const labName = lab ? lab.name : 'Unknown Lab';

    return {
      token,
      expiresAt,
      targetUser: {
        name: targetUser.name,
        role: targetUser.role,
        labName
      }
    };
  },

  /**
   * Override billing configs
   */
  async overrideBilling(labId, billingOverride, adminId) {
    const lab = await Lab.findById(labId).lean();
    if (!lab) {
      throw new Error('Lab not found');
    }

    const updateObj = {};
    if (billingOverride.plan !== undefined) updateObj['plan'] = billingOverride.plan;
    if (billingOverride.status !== undefined) {
      updateObj['billing.status'] = billingOverride.status;
      if (billingOverride.status === 'active') {
        updateObj['registrationState'] = 'production';
        updateObj['tempTrialExpiry'] = null;
      }
    }
    if (billingOverride.nextBillingDate !== undefined) updateObj['billing.nextBillingDate'] = billingOverride.nextBillingDate;
    
    if (billingOverride.trialEndDate !== undefined) {
      updateObj['billing.trialEndDate'] = billingOverride.trialEndDate;
      // Mirror the new trialEndDate to tempTrialExpiry and mark trial as extended to unlock
      updateObj['tempTrialExpiry'] = billingOverride.trialEndDate;
      updateObj['isTrialExtended'] = true;
    }
    
    if (billingOverride.registrationState !== undefined) {
      updateObj['registrationState'] = billingOverride.registrationState;
    }
    if (billingOverride.customPricingNotes !== undefined) updateObj['billing.customPricingNotes'] = billingOverride.customPricingNotes;

    const updatedLab = await Lab.findByIdAndUpdate(labId, { $set: updateObj }, { new: true }).lean();

    // Log details
    await AuditLog.create({
      labId,
      userId: adminId,
      role: 'superAdmin',
      action: 'billing_override',
      superAdmin: true,
      timestamp: new Date(),
      details: {
        oldValues: {
          plan: lab.plan,
          status: lab.billing?.status,
          nextBillingDate: lab.billing?.nextBillingDate,
          trialEndDate: lab.billing?.trialEndDate,
          customPricingNotes: lab.billing?.customPricingNotes
        },
        newValues: {
          plan: updatedLab.plan,
          status: updatedLab.billing?.status,
          nextBillingDate: updatedLab.billing?.nextBillingDate,
          trialEndDate: updatedLab.billing?.trialEndDate,
          customPricingNotes: updatedLab.billing?.customPricingNotes
        }
      }
    });

    return updatedLab;
  },

  /**
   * Get overall platform metrics
   */
  async getPlatformMetrics() {
    const allLabs = await Lab.find().lean();
    const totalLabs = allLabs.length;
    const activeLabs = allLabs.filter(l => l.billing?.status === 'active').length;
    const trialLabs = allLabs.filter(l => l.billing?.status === 'trial').length;
    const graceLabs = allLabs.filter(l => l.billing?.status === 'grace').length;
    const suspendedLabs = allLabs.filter(l => l.isSuspended === true).length;

    const planPrices = { starter: 999, growth: 2499, pro: 4999, custom: 0 };
    let currentMrr = 0;
    let newMrrThisMonth = 0;
    let churnedMrrThisMonth = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const lab of allLabs) {
      const planPrice = planPrices[lab.plan] || 0;
      if (lab.billing?.status === 'active') {
        currentMrr += planPrice;
        if (new Date(lab.createdAt) >= startOfMonth) {
          newMrrThisMonth += planPrice;
        }
      } else if (lab.isSuspended || lab.billing?.status === 'suspended' || lab.billing?.status === 'expired') {
        const dateToCheck = lab.suspendedAt || lab.updatedAt;
        if (dateToCheck && new Date(dateToCheck) >= startOfMonth) {
          churnedMrrThisMonth += planPrice;
        }
      }
    }

    const trialsStartedThisMonth = allLabs.filter(l => l.billing?.status === 'trial' && new Date(l.createdAt) >= startOfMonth).length;
    const convertedThisMonth = allLabs.filter(l => l.billing?.status === 'active' && new Date(l.createdAt) >= startOfMonth).length;
    const trialConversionRate = trialsStartedThisMonth > 0 ? Number(((convertedThisMonth / trialsStartedThisMonth) * 100).toFixed(2)) : 0;

    const healthDist = { '0-30': 0, '31-50': 0, '51-70': 0, '71-90': 0, '91-100': 0 };
    for (const lab of allLabs) {
      const score = lab.healthScore || 0;
      if (score <= 30) healthDist['0-30']++;
      else if (score <= 50) healthDist['31-50']++;
      else if (score <= 70) healthDist['51-70']++;
      else if (score <= 90) healthDist['71-90']++;
      else healthDist['91-100']++;
    }

    const cityCounts = {};
    for (const lab of allLabs) {
      const city = lab.address?.city || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
    const geographicDistribution = Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const modulesList = [
      'patients', 'visits', 'results', 'reports', 'billing', 'inventory',
      'doctors', 'staff', 'notifications', 'webhooks', 'analytics',
      'homeCollections', 'samples'
    ];
    const featureAdoption = {};
    for (const mod of modulesList) {
      const enabledCount = allLabs.filter(l => l.planConfig?.modules?.[mod] === true).length;
      featureAdoption[mod] = totalLabs > 0 ? Number(((enabledCount / totalLabs) * 100).toFixed(2)) : 0;
    }

    const recentSignups = allLabs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 7)
      .map(l => ({
        name: l.name,
        city: l.address?.city || 'Unknown',
        plan: l.plan,
        date: l.createdAt
      }));

    return {
      totalLabs,
      activeLabs,
      trialLabs,
      graceLabs,
      suspendedLabs,
      mrrData: {
        currentMRR: currentMrr,
        newMRRThisMonth: newMrrThisMonth,
        churnedMRRThisMonth: churnedMrrThisMonth
      },
      trialConversionRate,
      healthScoreDistribution: healthDist,
      geographicDistribution,
      featureAdoption,
      recentSignups
    };
  },

  /**
   * Get expected subscription MRR time series
   */
  async getPlatformRevenue(period) {
    const allLabs = await Lab.find().lean();
    const planPrices = { starter: 999, growth: 2499, pro: 4999, custom: 0 };

    const now = new Date();
    let startMonthCount = 1;
    if (period === 'lastMonth') startMonthCount = 2;
    else if (period === '3months') startMonthCount = 3;
    else if (period === '6months') startMonthCount = 6;
    else if (period === 'thisYear') startMonthCount = now.getMonth() + 1;

    const months = [];
    for (let i = startMonthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
    }

    const timeSeries = [];
    for (const mDate of months) {
      const monthEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0, 23, 59, 59, 999);
      let mrr = 0;
      for (const lab of allLabs) {
        if (new Date(lab.createdAt) <= monthEnd) {
          const isCurrentlyActive = lab.billing?.status === 'active';
          const wasSuspendedAfter = lab.suspendedAt ? new Date(lab.suspendedAt) > monthEnd : true;
          if (isCurrentlyActive && wasSuspendedAfter) {
            mrr += planPrices[lab.plan] || 0;
          }
        }
      }
      const monthLabel = mDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      timeSeries.push({ month: monthLabel, mrr });
    }

    return timeSeries;
  },

  /**
   * Find audit log for specific lab
   */
  async getLabAuditLog(labId, page = 1, limit = 20) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query = { labId: new mongoose.Types.ObjectId(labId) };
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return { logs, total, page: pageNum, limit: limitNum };
  },

  /**
   * Get PDF generation Dead Letter Queue (DLQ)
   */
  async getDeadLetterQueue() {
    const failedReports = await Report.find({
      status: 'failed',
      $or: [
        { pdfUrl: { $exists: false } },
        { pdfUrl: null },
        { pdfUrl: '' }
      ]
    })
      .populate('labId', 'name')
      .populate('patientId', 'firstName lastName')
      .populate('visitId', 'visitCode')
      .lean();

    return failedReports.map(r => ({
      lab: r.labId ? r.labId.name : 'Unknown Lab',
      patient: r.patientId ? `${r.patientId.firstName || ''} ${r.patientId.lastName || ''}`.trim() : 'Unknown Patient',
      visitId: r.visitId ? r.visitId._id : null,
      visitCode: r.visitId ? r.visitId.visitCode : null,
      reportId: r._id,
      createdAt: r.createdAt,
      lastFailureTimestamp: r.updatedAt
    }));
  },

  /**
   * Retry PDF generation forced to Oracle VM
   */
  async retryDeadLetterJob(reportId, adminId) {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    await PdfService.enqueuePdfJob(report.visitId, report.labId, report._id, 100);
    report.status = 'pending';
    await report.save();

    await AuditLog.create({
      labId: report.labId,
      userId: adminId,
      role: 'superAdmin',
      action: 'dlq_retry',
      superAdmin: true,
      timestamp: new Date(),
      details: { adminId, reportId }
    });

    return { queued: true, reportId };
  },

  /**
   * Get feature flags
   */
  async getFeatureFlags() {
    return await FeatureFlags.find().lean();
  },

  /**
   * Update feature flag config
   */
  async updateFeatureFlag(flagName, updates, adminId) {
    let flag = await FeatureFlags.findOne({ name: flagName });
    if (!flag) {
      flag = new FeatureFlags({ name: flagName });
    }

    if (updates.enabled !== undefined) flag.enabled = updates.enabled;
    if (updates.rolloutPercentage !== undefined) flag.rolloutPercentage = updates.rolloutPercentage;
    if (updates.labIdsWhitelist !== undefined) {
      flag.labIdsWhitelist = updates.labIdsWhitelist.map(id => new mongoose.Types.ObjectId(id));
    }
    if (updates.description !== undefined) flag.description = updates.description;

    await flag.save();

    await AuditLog.create({
      userId: adminId,
      role: 'superAdmin',
      action: 'feature_flag_update',
      superAdmin: true,
      timestamp: new Date(),
      details: { flagName, updates }
    });

    return flag;
  },

  /**
   * Send platform announcement
   */
  async sendAnnouncement(target, channel, message, scheduledAt, adminId) {
    const query = { isActive: true, isSuspended: false };

    if (target.type === 'all') {
      // standard query
    } else if (target.type === 'plan') {
      query.plan = target.plan;
    } else if (target.type === 'status') {
      query['billing.status'] = target.status;
    } else if (target.type === 'city') {
      query['address.city'] = { $regex: new RegExp(target.city, 'i') };
    } else if (target.type === 'specific') {
      query._id = { $in: target.labIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const labs = await Lab.find(query).lean();
    let sentCount = 0;

    for (const lab of labs) {
      const ownerUser = await User.findOne({ labId: lab._id, role: 'owner' });
      const phone = ownerUser?.phone || lab.phone;

      if (channel.includes('whatsapp') && phone) {
        try {
          await WhatsAppService.sendDirectText(phone, message, lab._id);
        } catch (err) {
          console.error(`Failed to send WhatsApp announcement to owner of lab ${lab.name}:`, err);
        }
      }

      if (channel.includes('inapp')) {
        try {
          await PlatformAlert.create({
            labId: lab._id,
            type: 'announcement',
            message,
            isRead: false,
            createdAt: new Date()
          });
        } catch (err) {
          console.error(`Failed to create platform alert announcement for lab ${lab.name}:`, err);
        }
      }

      sentCount++;
    }

    return { sent: sentCount, channels: channel };
  },

  /**
   * Unlock OTP lockouts (brute-force locked or daily requests exceeded) for a phone number
   */
  async unlockOtpLockout(phone, adminId) {
    if (!phone || phone.trim() === '') {
      throw new Error('Phone number is required');
    }

    const dailyRequestsKey = `otp:daily_requests:${phone}`;
    const lockedKey = `otp:locked:${phone}`;
    const attemptsKey = `otp:attempts:${phone}`;
    const otpKey = `otp:${phone}`;

    // Deletes the lockout keys from Upstash Redis
    const deletedDaily = await redis.del(dailyRequestsKey);
    const deletedLocked = await redis.del(lockedKey);
    await redis.del(attemptsKey);
    await redis.del(otpKey);

    return {
      phone,
      unlockedFromDailyLimit: deletedDaily > 0,
      unlockedFromBruteForceLockout: deletedLocked > 0
    };
  }
};

export default AdminService;
