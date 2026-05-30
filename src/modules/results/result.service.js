import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Razorpay from 'razorpay';
import { config } from '../../config/index.js';
import Result from './result.model.js';
import ResultAudit from './resultAudit.model.js';
import Visit from '../visits/visit.model.js';
import TestMaster from '../staff/testMaster.model.js';
import Report from '../reports/report.model.js';
import VisitService from '../visits/visit.service.js';
import Invoice from '../billing/invoice.model.js';
import qstashService from '../../utils/qstash.js';
import SmsService from '../../utils/sms.js';
import { AppError } from '../../utils/errors.js';
import InventoryService from '../inventory/inventory.service.js';
import WhatsAppOutboxService from '../whatsappOutbox/whatsappOutbox.service.js';
import InAppNotification from '../notifications/inAppNotification.model.js';
import User from '../staff/user.model.js';

/**
 * Helper: fires an InAppNotification to all owners and pathologists of a lab.
 * Fire-and-forget — does not throw.
 */
async function notifyLabStaff(labId, type, severity, title, message, link, meta = {}) {
  try {
    const recipients = await User.find({
      labId,
      role: { $in: ['owner', 'pathologist'] },
      isActive: true
    }).select('_id').lean();

    if (recipients.length === 0) return;

    const notifications = recipients.map(u => ({
      labId,
      userId: u._id,
      type,
      severity,
      title,
      message,
      link,
      meta
    }));

    await InAppNotification.insertMany(notifications, { ordered: false });
  } catch (err) {
    console.error('[ResultService] Failed to create in-app notifications:', err.message);
  }
}

export const ResultService = {
  /**
   * Phase 3.4 — Selects the most demographically specific reference range for a parameter.
   * Priority: gender-specific + age match > any-gender + age match > flat default.
   */
  selectReferenceRange(paramMasterDoc, patientAge, patientAgeUnit, patientGender) {
    // Convert patient age to years for uniform comparison
    let ageInYears = parseFloat(patientAge) || 0;
    if (patientAgeUnit === 'months') ageInYears = ageInYears / 12;
    if (patientAgeUnit === 'days') ageInYears = ageInYears / 365.25;

    const defaultRange = {
      normalLow: paramMasterDoc.normalLow,
      normalHigh: paramMasterDoc.normalHigh,
      criticalLow: paramMasterDoc.criticalLow,
      criticalHigh: paramMasterDoc.criticalHigh,
      label: 'Standard'
    };

    if (!paramMasterDoc.referenceRanges || paramMasterDoc.referenceRanges.length === 0) {
      return defaultRange;
    }

    const gender = patientGender || 'other';

    // Find all ranges that match patient age
    const agematched = paramMasterDoc.referenceRanges.filter(r => {
      let rangeMinYears = parseFloat(r.ageMin) || 0;
      let rangeMaxYears = parseFloat(r.ageMax) ?? 150;
      const rUnit = r.ageUnit || 'years';
      if (rUnit === 'months') { rangeMinYears /= 12; rangeMaxYears /= 12; }
      if (rUnit === 'days') { rangeMinYears /= 365.25; rangeMaxYears /= 365.25; }
      return ageInYears >= rangeMinYears && ageInYears <= rangeMaxYears;
    });

    if (agematched.length === 0) return defaultRange;

    // Prefer gender-specific match
    const genderSpecific = agematched.filter(r =>
      r.genderMatch && r.genderMatch.length > 0 &&
      !r.genderMatch.includes('any') &&
      r.genderMatch.includes(gender)
    );

    const best = genderSpecific.length > 0
      ? genderSpecific[0]
      : (agematched.find(r => !r.genderMatch || r.genderMatch.includes('any') || r.genderMatch.length === 0) || agematched[0]);

    return {
      normalLow: best.normalLow ?? defaultRange.normalLow,
      normalHigh: best.normalHigh ?? defaultRange.normalHigh,
      criticalLow: best.criticalLow ?? defaultRange.criticalLow,
      criticalHigh: best.criticalHigh ?? defaultRange.criticalHigh,
      label: best.label || 'Standard'
    };
  },

  /**
   * Compares parameter values against Normal/Critical limits from TestMaster.
   * Phase 3.4: now accepts patientDemographics to select age/gender-specific ranges.
   */
  async checkCriticalValues(parameters, testMasterDoc, patientDemographics = {}) {
    let isCritical = false;
    const flaggedParameters = [];
    const processedParameters = [];

    const { age, ageUnit = 'years', gender } = patientDemographics;

    const masterParamsMap = (testMasterDoc.parameters || []).reduce((acc, param) => {
      acc[param.name.toLowerCase().trim()] = param;
      return acc;
    }, {});

    for (const p of parameters) {
      const match = masterParamsMap[p.parameterName.toLowerCase().trim()];
      const numericVal = parseFloat(p.value);
      const isNumeric = !isNaN(numericVal);

      let status = 'normal';
      let isFlagged = false;
      let appliedRangeLabel = 'Standard';

      if (match && isNumeric) {
        // Phase 3.4: select the appropriate demographic range
        const range = this.selectReferenceRange(match, age, ageUnit, gender);
        appliedRangeLabel = range.label;

        // 1. Check Critical range first
        if (range.criticalLow !== undefined && range.criticalLow !== null && numericVal <= range.criticalLow) {
          status = 'criticalLow';
          isFlagged = true;
          isCritical = true;
          flaggedParameters.push({ parameterName: p.parameterName, value: numericVal, limit: range.criticalLow, status });
        } else if (range.criticalHigh !== undefined && range.criticalHigh !== null && numericVal >= range.criticalHigh) {
          status = 'criticalHigh';
          isFlagged = true;
          isCritical = true;
          flaggedParameters.push({ parameterName: p.parameterName, value: numericVal, limit: range.criticalHigh, status });
        }
        // 2. Check Normal range if not critical
        else if (range.normalLow !== undefined && range.normalLow !== null && numericVal < range.normalLow) {
          status = 'low';
          isFlagged = true;
        } else if (range.normalHigh !== undefined && range.normalHigh !== null && numericVal > range.normalHigh) {
          status = 'high';
          isFlagged = true;
        }
      }

      processedParameters.push({
        parameterName: p.parameterName,
        value: p.value,
        unit: p.unit || (match ? match.unit : ''),
        status,
        isFlagged,
        appliedRangeLabel,
        isOverride: p.isOverride || false,
        overrideReason: p.overrideReason || ''
      });
    }

    return {
      isCritical,
      flaggedParameters,
      processedParameters
    };
  },

  /**
   * Safe evaluation of derived formulas (e.g. MCH = MCV * MCHC / 100).
   */
  async calculateDerivedValues(parameters, testMasterDoc) {
    if (!testMasterDoc.derivedFormulas || testMasterDoc.derivedFormulas.length === 0) {
      return parameters;
    }

    const paramsMap = parameters.reduce((acc, p) => {
      acc[p.parameterName.toUpperCase().trim()] = p.value;
      return acc;
    }, {});

    const updatedParameters = [...parameters];

    for (const df of testMasterDoc.derivedFormulas) {
      const { targetParameter, formula, inputs } = df;

      const allInputsPresent = inputs.every(inp => paramsMap[inp.toUpperCase().trim()] !== undefined);

      if (allInputsPresent) {
        try {
          let calculatedValue = null;

          const key = `${targetParameter.toUpperCase().trim()}:${formula.toUpperCase().replace(/\s+/g, '')}`;
          switch (key) {
            case 'MCH:MCV*MCHC/100': {
              const mcv = parseFloat(paramsMap['MCV']);
              const mchc = parseFloat(paramsMap['MCHC']);
              if (!isNaN(mcv) && !isNaN(mchc)) {
                calculatedValue = Math.round(((mcv * mchc) / 100) * 100) / 100;
              }
              break;
            }
            default:
              console.warn(`Formula '${formula}' for ${targetParameter} is not registered in the system.`);
          }

          if (calculatedValue !== null) {
            const idx = updatedParameters.findIndex(p => p.parameterName.toUpperCase().trim() === targetParameter.toUpperCase().trim());
            const derivedParamObj = {
              parameterName: targetParameter,
              value: calculatedValue,
              isDerived: true
            };

            if (idx !== -1) {
              updatedParameters[idx] = { ...updatedParameters[idx], value: calculatedValue };
            } else {
              updatedParameters.push(derivedParamObj);
            }
            paramsMap[targetParameter.toUpperCase().trim()] = calculatedValue;
          }
        } catch (err) {
          console.error(`Error calculating derived value for ${targetParameter}:`, err);
        }
      } else {
        console.warn(`Cannot evaluate formula for ${targetParameter}: missing input parameters ${inputs.join(', ')}`);
      }
    }

    return updatedParameters;
  },

  /**
   * Submits/saves a test result.
   * Phase 3.2: writes ResultAudit entry.
   * Phase 3.4: uses patient demographics for range selection.
   */
  async submitResult(labId, data, enteredBy) {
    const { visitId, testId, sampleId, parameters } = data;

    // Phase 3.3 — Enforce sample not rejected before results entry
    if (sampleId) {
      const SampleModel = mongoose.model('Sample');
      const sample = await SampleModel.findOne({ _id: sampleId, labId, isDeleted: { $ne: true } });
      if (sample && sample.status === 'rejected') {
        throw new AppError('Cannot enter results for a rejected sample. Please collect a new sample.', 'SAMPLE_REJECTED', 422);
      }
    }

    // 1. Find visit and populate patient for demographics
    const visit = await Visit.findOne({ _id: visitId, labId }).populate('patientId');
    if (!visit) {
      throw new AppError('Visit not found', 'VISIT_NOT_FOUND', 404);
    }

    const patientDemographics = {
      age: visit.patientId?.age,
      ageUnit: visit.patientId?.ageUnit || 'years',
      gender: visit.patientId?.gender
    };

    // 2. Find test master record
    const testMasterDoc = await TestMaster.findById(testId);
    if (!testMasterDoc) {
      throw new AppError('Test catalog record not found', 'TEST_NOT_FOUND', 404);
    }

    // Check for custom parameter overrides in LabTest (Arch Rule #3)
    const LabTestModel = mongoose.model('LabTest');
    const labTest = await LabTestModel.findOne({ labId, testId });
    if (labTest && labTest.customParameters && labTest.customParameters.length > 0) {
      testMasterDoc.parameters = labTest.customParameters;
    }

    // 3. Calculate derived values
    const parametersWithDerived = await this.calculateDerivedValues(parameters, testMasterDoc);

    // 4. Check critical/normal ranges with patient demographics
    const { isCritical, flaggedParameters, processedParameters } = await this.checkCriticalValues(
      parametersWithDerived, testMasterDoc, patientDemographics
    );

    // 5. Create or Update Result document
    let result = await Result.findOne({ labId, visitId, testId, isDeleted: { $ne: true } });
    const beforeSnapshot = result ? result.parameters.toObject ? result.parameters.toObject() : result.parameters : null;
    const isUpdate = !!result;

    if (result) {
      result.parameters = processedParameters;
      result.isCritical = isCritical;
      result.enteredBy = enteredBy;
      if (sampleId) result.sampleId = sampleId;
    } else {
      result = new Result({
        labId,
        visitId,
        testId,
        sampleId,
        enteredBy,
        parameters: processedParameters,
        isCritical
      });
    }

    await result.save();

    // Phase 3.2 — Write immutable audit entry
    ResultAudit.create({
      labId,
      resultId: result._id,
      visitId,
      patientId: visit.patientId?._id || visit.patientId,
      testId,
      testName: testMasterDoc.name,
      action: isUpdate ? 'updated' : 'created',
      performedBy: enteredBy,
      performedByRole: 'technician',
      before: beforeSnapshot,
      after: processedParameters
    }).catch(err => console.error('[ResultAudit] Failed to write audit entry:', err));

    // Auto consume inventory reagents
    try {
      await InventoryService.autoConsumeForTest(labId, testId, visitId, enteredBy);
    } catch (err) {
      console.error('[INVENTORY] Auto-consumption error in submitResult:', err);
    }

    // 6. Update visit status if all results are entered
    const resultsCount = await Result.countDocuments({ visitId: visit._id, isDeleted: { $ne: true } });
    if (resultsCount >= visit.tests.length) {
      await VisitService.updateVisitStatus(labId, visit._id, 'resultsEntered');
    }

    return {
      result,
      isCritical,
      flaggedParameters
    };
  },

  /**
   * Triggers the critical alerts (WhatsApp, SMS, voice call queues).
   * Phase 3.2: writes ResultAudit entry.
   * Phase 3.8: fires in-app notifications to owners and pathologists.
   */
  async triggerCriticalAlert(labId, resultId, visitId) {
    const result = await Result.findOne({ _id: resultId, labId }).populate('testId');
    if (!result) {
      throw new AppError('Result not found', 'REPORT_NOT_FOUND', 404);
    }

    const visit = await Visit.findOne({ _id: visitId, labId })
      .populate('patientId')
      .populate('referredBy');
    if (!visit) {
      throw new AppError('Visit not found', 'VISIT_NOT_FOUND', 404);
    }

    result.criticalAlertSentAt = new Date();
    await result.save();

    const doctorPhone = visit.referredBy ? visit.referredBy.phone : null;
    const doctorName = visit.referredBy ? visit.referredBy.name : 'Doctor';
    const patientName = visit.patientId ? `${visit.patientId.firstName} ${visit.patientId.lastName || ''}`.trim() : 'Patient';
    const testName = result.testId ? result.testId.name : 'Diagnostic Test';

    const criticalParams = result.parameters.filter(p => p.status === 'criticalLow' || p.status === 'criticalHigh');
    const value = criticalParams.map(p => `${p.parameterName}: ${p.value}`).join(', ');
    const unit = criticalParams.map(p => p.unit || '').join(', ');

    const normalRange = criticalParams.map(p => {
      const match = (result.testId?.parameters || []).find(mp => mp.name.toLowerCase() === p.parameterName.toLowerCase());
      return match ? `${match.normalLow || 0} - ${match.normalHigh || 0}` : 'N/A';
    }).join(', ');

    const lab = await mongoose.model('Lab').findById(labId);
    const labName = lab?.name || 'Pehlix Diagnostic Lab';
    const labPhone = lab?.phone || '9999999999';

    const alertId = uuidv4();
    const acknowledgeLink = `${config.NEXT_PUBLIC_APP_URL}/api/critical/acknowledge/${alertId}?resultId=${result._id}`;

    const alertPayload = {
      doctorName,
      patientName,
      testName,
      value,
      unit,
      normalRange,
      labName,
      labPhone,
      acknowledgeLink,
      labId: labId.toString()
    };

    console.log('--- [CRITICAL VALUE ALERT LOG] ---');
    console.log(JSON.stringify(alertPayload, null, 2));
    console.log('---------------------------------');

    if (doctorPhone) {
      await qstashService.enqueueNotification('critical_value_alert', alertPayload, doctorPhone);

      const smsMessage = `URGENT: Dr ${doctorName}, patient ${patientName} has a critical value. ${testName}: ${value} ${unit}. Normal range: ${normalRange}. Please contact patient immediately. Lab: ${labName} ${labPhone}. Acknowledge: ${acknowledgeLink}`;
      await SmsService.send(doctorPhone, smsMessage);
    }

    // Phase 3.8 — Fire in-app notifications to all owners + pathologists
    notifyLabStaff(
      labId,
      'critical_value',
      'critical',
      `⚠️ Critical Value — ${testName}`,
      `Patient ${patientName}: ${value} (Critical). Refer Dr. ${doctorName} notified.`,
      '/critical',
      { resultId: result._id.toString(), visitId: visitId.toString(), patientName, testName }
    );

    // Phase 3.2 — Write audit entry for critical flag
    ResultAudit.create({
      labId,
      resultId: result._id,
      visitId,
      patientId: visit.patientId?._id || visit.patientId,
      testId: result.testId?._id,
      testName,
      action: 'flagged_critical',
      performedBy: result.enteredBy || result.approvedBy,
      before: null,
      after: { criticalParams, acknowledgeLink }
    }).catch(err => console.error('[ResultAudit] Failed to write flagged_critical audit entry:', err));

    await qstashService.enqueue(
      `${config.NEXT_PUBLIC_APP_URL}/api/internal/critical-acknowledgement-check`,
      {
        resultId: result._id.toString(),
        visitId: visit._id.toString(),
        labId: labId.toString(),
        alertId
      },
      900
    );

    return {
      alertSent: true,
      escalationScheduled: true
    };
  },

  /**
   * Acknowledges the critical alert (called publicly via WhatsApp link).
   */
  async acknowledgeAlert(resultId, alertId) {
    const result = await Result.findById(resultId);
    if (!result) {
      throw new AppError('Result not found', 'REPORT_NOT_FOUND', 404);
    }

    result.criticalAcknowledgedAt = new Date();
    result.criticalAcknowledgedBy = alertId;
    await result.save();

    const visitDoc = await Visit.findById(result.visitId).select('patientId').lean();
    const patientId = visitDoc?.patientId;

    // Phase 3.2 — Audit entry for acknowledgement
    ResultAudit.create({
      labId: result.labId,
      resultId: result._id,
      visitId: result.visitId,
      patientId: patientId,
      action: 'critical_acknowledged',
      performedBy: result.enteredBy || result.approvedBy || result.rejectedBy || result._id,
      acknowledgedBy: alertId,
      before: null,
      after: { acknowledgedAt: result.criticalAcknowledgedAt }
    }).catch(err => console.error('[ResultAudit] Failed to write acknowledgement audit entry:', err));

    console.log(`[Critical Alert Acknowledged] Result ${resultId} acknowledged by ${alertId}`);
    return result;
  },

  /**
   * Retrieves pathologist approval queue. Prioritizes critical results.
   */
  async getApprovalQueue(labId) {
    return await Result.find({ labId, isApproved: false, isDeleted: { $ne: true } })
      .populate({
        path: 'visitId',
        populate: [
          { path: 'patientId', select: 'firstName lastName phone gender age ageUnit' },
          { path: 'referredBy', select: 'name phone email' }
        ]
      })
      .populate('testId', 'name code department')
      .sort({ isCritical: -1, createdAt: 1 });
  },

  /**
   * Returns all critical results for the Critical Monitor dashboard (Phase 3.7).
   */
  async getCriticalMonitor(labId) {
    const results = await Result.find({
      labId,
      isCritical: true,
      isApproved: true,
      isDeleted: { $ne: true }
    })
      .populate({
        path: 'visitId',
        populate: [
          { path: 'patientId', select: 'firstName lastName phone patientCode' },
          { path: 'referredBy', select: 'name phone' }
        ]
      })
      .populate('testId', 'name code')
      .populate('approvedBy', 'name')
      .sort({ criticalAcknowledgedAt: 1, createdAt: -1 })
      .lean();

    const now = new Date();
    return results.map(r => {
      const criticalParams = r.parameters.filter(p => p.status === 'criticalLow' || p.status === 'criticalHigh');
      const sentAt = r.criticalAlertSentAt ? new Date(r.criticalAlertSentAt) : null;
      const minutesSinceAlert = sentAt ? Math.floor((now - sentAt) / 60000) : null;

      let escalationStatus = 'open';
      if (r.criticalAcknowledgedAt) {
        escalationStatus = 'acknowledged';
      } else if (minutesSinceAlert !== null && minutesSinceAlert >= 30) {
        escalationStatus = 'escalated';
      } else if (minutesSinceAlert !== null && minutesSinceAlert >= 15) {
        escalationStatus = 'overdue';
      }

      return {
        ...r,
        criticalParams,
        minutesSinceAlert,
        escalationStatus
      };
    });
  },

  /**
   * Pathologist approves a result.
   * Phase 3.2: writes ResultAudit entry.
   */
  async approveResult(labId, resultId, pathologistId, pathologistNote) {
    const result = await Result.findOne({ _id: resultId, labId });
    if (!result) {
      throw new AppError('Result not found', 'REPORT_NOT_FOUND', 404);
    }

    const beforeSnapshot = result.parameters.toObject ? result.parameters.toObject() : result.parameters;

    result.isApproved = true;
    result.approvedBy = pathologistId;
    result.approvedAt = new Date();
    await result.save();

    // Fetch pathologist name for audit
    const pathologist = await User.findById(pathologistId).select('name role').lean();
    const visitDoc = await Visit.findById(result.visitId).select('patientId').lean();
    const patientId = visitDoc?.patientId;

    // Phase 3.2 — Write audit entry
    ResultAudit.create({
      labId,
      resultId: result._id,
      visitId: result.visitId,
      patientId: patientId,
      testId: result.testId,
      action: 'approved',
      performedBy: pathologistId,
      performedByName: pathologist?.name,
      performedByRole: pathologist?.role || 'pathologist',
      before: beforeSnapshot,
      after: { isApproved: true, approvedAt: result.approvedAt, pathologistNote }
    }).catch(err => console.error('[ResultAudit] Failed to write approved audit entry:', err));

    // Find linked report
    let report = await Report.findOne({ visitId: result.visitId, labId });
    if (report) {
      if (pathologistNote) {
        report.pathologistNote = pathologistNote;
      }
      report.status = 'approved';
      await report.save();
    }

    // Check if all results for this visit are approved
    const pendingApprovalCount = await Result.countDocuments({
      visitId: result.visitId,
      labId,
      isApproved: false,
      isDeleted: { $ne: true }
    });

    if (pendingApprovalCount === 0) {
      await VisitService.updateVisitStatus(labId, result.visitId, 'approved');

      const invoice = await Invoice.findOne({ visitId: result.visitId, labId }).populate('patientId');
      if (invoice) {
        const balance = invoice.balanceAmount !== undefined ? invoice.balanceAmount : (invoice.totalAmount - invoice.amountPaid);

        const lab = await mongoose.model('Lab').findById(labId);
        const labName = lab?.name || 'Pehlix Lab';

        const patientName = invoice.patientId
          ? `${invoice.patientId.firstName} ${invoice.patientId.lastName || ''}`.trim()
          : 'Patient';
        const phone = invoice.patientId?.phone;

        const isWaMe = !lab?.planConfig?.features?.communicationMode || lab.planConfig.features.communicationMode === 'waMe';

        if (isWaMe) {
          const visit = await Visit.findOne({ _id: result.visitId, labId }).populate('tests');
          const testNames = visit ? visit.tests.map(t => t.name) : [];

          if (report) {
            await WhatsAppOutboxService.createOutboxEntry(
              labId,
              result.visitId,
              invoice.patientId._id,
              report._id,
              invoice,
              invoice.patientId,
              testNames
            );
          }

          const pdfEndpoint = `${config.NEXT_PUBLIC_APP_URL}/api/internal/reports/generate`;
          await qstashService.enqueue(pdfEndpoint, {
            visitId: result.visitId.toString(),
            labId: labId.toString(),
            invoiceId: invoice._id.toString()
          });
        } else {
          // Meta API Automated Flow
          if (balance > 0) {
            let paymentLink = invoice.razorpayPaymentLinkUrl;

            if (!paymentLink) {
              if (lab && lab.razorpayKeyId && lab.razorpayKeySecret) {
                try {
                  const rpay = new Razorpay({
                    key_id: lab.razorpayKeyId,
                    key_secret: lab.razorpayKeySecret
                  });

                  const formattedPhone = phone
                    ? (phone.startsWith('+') ? phone : `+91${phone}`)
                    : '9999999999';

                  const link = await rpay.paymentLink.create({
                    amount: Math.round(balance * 100),
                    currency: 'INR',
                    accept_partial: false,
                    description: `Payment for Lab Invoice #${invoice.invoiceCode}`,
                    customer: { name: patientName, contact: formattedPhone },
                    notify: { sms: false, email: false },
                    reminder_enable: false,
                    notes: { invoiceId: invoice._id.toString() },
                    callback_url: `${config.NEXT_PUBLIC_APP_URL}/billing/callback`,
                    callback_method: 'get'
                  });

                  paymentLink = link.short_url;
                  invoice.razorpayPaymentLinkId = link.id;
                  invoice.razorpayPaymentLinkUrl = paymentLink;
                  await invoice.save();
                } catch (err) {
                  console.error('[approveResult] Failed to generate Razorpay link:', err);
                  paymentLink = `${config.NEXT_PUBLIC_APP_URL}/pay/${invoice._id}`;
                }
              } else {
                paymentLink = `${config.NEXT_PUBLIC_APP_URL}/pay/${invoice._id}`;
              }
            }

            if (phone) {
              await qstashService.enqueueNotification(
                'report_ready_unpaid',
                { patientName, pendingAmount: balance, paymentLink, labName, labId: labId.toString() },
                phone
              );
            }
          } else {
            const pdfEndpoint = `${config.NEXT_PUBLIC_APP_URL}/api/internal/reports/generate`;
            await qstashService.enqueue(pdfEndpoint, {
              visitId: result.visitId.toString(),
              labId: labId.toString(),
              invoiceId: invoice._id.toString()
            });

            const reportLink = `${config.NEXT_PUBLIC_APP_URL}/reports/view/${result.visitId}`;
            const reportCode = report ? (report.reportCode || invoice.invoiceCode) : invoice.invoiceCode;

            if (phone) {
              await qstashService.enqueueNotification(
                'report_ready_paid',
                { patientName, reportLink, labName, reportCode, labId: labId.toString() },
                phone
              );
            }
          }
        }
      }
    }

    return {
      approved: true,
      reportId: report ? report._id : null
    };
  },

  /**
   * Updates an existing result record.
   * Phase 3.2: writes ResultAudit entry with before/after snapshots.
   * Phase 3.4: re-runs range checks with demographics.
   */
  async updateResult(labId, resultId, data, enteredBy) {
    const result = await Result.findOne({ _id: resultId, labId });
    if (!result) {
      throw new AppError('Result not found', 'REPORT_NOT_FOUND', 404);
    }

    // Phase 3.3 — Enforce sample not rejected before results update
    if (result.sampleId) {
      const SampleModel = mongoose.model('Sample');
      const sample = await SampleModel.findOne({ _id: result.sampleId, labId, isDeleted: { $ne: true } });
      if (sample && sample.status === 'rejected') {
        throw new AppError('Cannot update results for a rejected sample.', 'SAMPLE_REJECTED', 422);
      }
    }

    const beforeSnapshot = result.parameters.toObject ? result.parameters.toObject() : [...result.parameters];

    const testMasterDoc = await TestMaster.findById(result.testId);
    if (!testMasterDoc) {
      throw new AppError('Test catalog record not found', 'TEST_NOT_FOUND', 404);
    }

    // Check for custom parameter overrides
    const LabTestModel = mongoose.model('LabTest');
    const labTest = await LabTestModel.findOne({ labId, testId: result.testId });
    if (labTest && labTest.customParameters && labTest.customParameters.length > 0) {
      testMasterDoc.parameters = labTest.customParameters;
    }

    // Fetch patient demographics for range selection
    const visit = await Visit.findOne({ _id: result.visitId, labId }).populate('patientId');
    const patientDemographics = {
      age: visit?.patientId?.age,
      ageUnit: visit?.patientId?.ageUnit || 'years',
      gender: visit?.patientId?.gender
    };

    const parametersWithDerived = await this.calculateDerivedValues(data.parameters, testMasterDoc);
    const { isCritical, flaggedParameters, processedParameters } = await this.checkCriticalValues(
      parametersWithDerived, testMasterDoc, patientDemographics
    );

    result.parameters = processedParameters;
    result.isCritical = isCritical;
    result.enteredBy = enteredBy;
    await result.save();

    // Phase 3.2 — Audit entry with before/after snapshots
    ResultAudit.create({
      labId,
      resultId: result._id,
      visitId: result.visitId,
      patientId: visit?.patientId?._id || visit?.patientId,
      testId: result.testId,
      testName: testMasterDoc.name,
      action: 'updated',
      performedBy: enteredBy,
      before: beforeSnapshot,
      after: processedParameters
    }).catch(err => console.error('[ResultAudit] Failed to write updated audit entry:', err));

    return { result, isCritical, flaggedParameters };
  },

  /**
   * Pathologist rejects a result.
   * Phase 3.2: writes ResultAudit entry with reason.
   */
  async rejectResult(labId, resultId, pathologistId, rejectionNote) {
    const result = await Result.findOne({ _id: resultId, labId });
    if (!result) {
      throw new AppError('Result not found', 'REPORT_NOT_FOUND', 404);
    }

    result.isRejected = true;
    result.rejectedBy = pathologistId;
    result.rejectedAt = new Date();
    result.rejectionNote = rejectionNote;
    await result.save();

    const pathologist = await User.findById(pathologistId).select('name role').lean();
    const visitDoc = await Visit.findById(result.visitId).select('patientId').lean();
    const patientId = visitDoc?.patientId;

    // Phase 3.2 — Audit entry with mandatory reason
    ResultAudit.create({
      labId,
      resultId: result._id,
      visitId: result.visitId,
      patientId: patientId,
      testId: result.testId,
      action: 'rejected',
      performedBy: pathologistId,
      performedByName: pathologist?.name,
      performedByRole: pathologist?.role || 'pathologist',
      reason: rejectionNote,
      before: result.parameters,
      after: { isRejected: true, rejectionNote }
    }).catch(err => console.error('[ResultAudit] Failed to write rejected audit entry:', err));

    const technicianAlert = {
      type: 'result_rejected_by_pathologist',
      resultId: result._id.toString(),
      rejectionNote,
      pathologistId: pathologistId.toString(),
      labId: labId.toString()
    };

    console.log('--- [TECHNICIAN REJECTION NOTIFICATION LOG] ---');
    console.log(JSON.stringify(technicianAlert, null, 2));
    console.log('-----------------------------------------------');

    return result;
  }
};

export default ResultService;
