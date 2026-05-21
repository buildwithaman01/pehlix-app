import Result from './result.model.js';
import Visit from '../visits/visit.model.js';
import TestMaster from '../staff/testMaster.model.js';
import Report from '../reports/report.model.js';
import VisitService from '../visits/visit.service.js';
import qstashService from '../../utils/qstash.js';
import { AppError } from '../../utils/errors.js';

export const ResultService = {
  /**
   * Compares parameter values against Normal/Critical limits in TestMaster document.
   */
  async checkCriticalValues(parameters, testMasterDoc) {
    let isCritical = false;
    const flaggedParameters = [];
    const processedParameters = [];

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

      if (match && isNumeric) {
        // 1. Check Critical range first
        if (match.criticalLow !== undefined && match.criticalLow !== null && numericVal <= match.criticalLow) {
          status = 'criticalLow';
          isFlagged = true;
          isCritical = true;
          flaggedParameters.push({ parameterName: p.parameterName, value: numericVal, limit: match.criticalLow, status });
        } else if (match.criticalHigh !== undefined && match.criticalHigh !== null && numericVal >= match.criticalHigh) {
          status = 'criticalHigh';
          isFlagged = true;
          isCritical = true;
          flaggedParameters.push({ parameterName: p.parameterName, value: numericVal, limit: match.criticalHigh, status });
        }
        // 2. Check Normal range if not critical
        else if (match.normalLow !== undefined && match.normalLow !== null && numericVal < match.normalLow) {
          status = 'low';
          isFlagged = true;
        } else if (match.normalHigh !== undefined && match.normalHigh !== null && numericVal > match.normalHigh) {
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

      // Check if all input parameters are present
      const allInputsPresent = inputs.every(inp => paramsMap[inp.toUpperCase().trim()] !== undefined);

      if (allInputsPresent) {
        try {
          let calculatedValue = null;

          // Simple switch/case for safe formula evaluation
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
            // Find if parameter already exists in submitted parameters
            const idx = updatedParameters.findIndex(p => p.parameterName.toUpperCase().trim() === targetParameter.toUpperCase().trim());
            const derivedParamObj = {
              parameterName: targetParameter,
              value: calculatedValue,
              isDerived: true
            };

            if (idx !== -1) {
              // Maintain units or other pre-existing values if any, but update value
              updatedParameters[idx] = {
                ...updatedParameters[idx],
                value: calculatedValue
              };
            } else {
              updatedParameters.push(derivedParamObj);
            }
            // Update paramsMap for subsequent formula chains
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
   */
  async submitResult(labId, data, enteredBy) {
    const { visitId, testId, sampleId, parameters } = data;

    // 1. Find visit
    const visit = await Visit.findOne({ _id: visitId, labId });
    if (!visit) {
      throw new AppError('Visit not found', 'VISIT_NOT_FOUND', 404);
    }

    // 2. Find test master record (master catalog, global)
    const testMasterDoc = await TestMaster.findById(testId);
    if (!testMasterDoc) {
      throw new AppError('Test catalog record not found', 'TEST_NOT_FOUND', 404);
    }

    // 3. Calculate derived values
    const parametersWithDerived = await this.calculateDerivedValues(parameters, testMasterDoc);

    // 4. Check critical/normal ranges
    const { isCritical, flaggedParameters, processedParameters } = await this.checkCriticalValues(parametersWithDerived, testMasterDoc);

    // 5. Create or Update Result document
    let result = await Result.findOne({ labId, visitId, testId, isDeleted: { $ne: true } });
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

    // 6. Check if all tests for the visit have results entered.
    // If so, update visit status to 'resultsEntered'
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

    // Record alert timestamp
    result.criticalAlertSentAt = new Date();
    await result.save();

    const doctorPhone = visit.referredBy ? visit.referredBy.phone : null;
    const patientName = visit.patientId ? `${visit.patientId.firstName} ${visit.patientId.lastName || ''}`.trim() : 'Patient';
    const testName = result.testId ? result.testId.name : 'Diagnostic Test';

    // Collect parameter values triggering critical flags
    const criticalParams = result.parameters.filter(p => p.status === 'criticalLow' || p.status === 'criticalHigh');
    const value = criticalParams.map(p => `${p.parameterName}: ${p.value}`).join(', ');
    const unit = criticalParams.map(p => p.unit || '').join(', ');
    
    // Find matching normal range limits from parameters
    const normalRange = criticalParams.map(p => {
      // Find normal limit boundaries
      const match = (result.testId?.parameters || []).find(mp => mp.name.toLowerCase() === p.parameterName.toLowerCase());
      return match ? `${match.normalLow || 0} - ${match.normalHigh || 0}` : 'N/A';
    }).join(', ');

    // Alert payload
    const alertPayload = {
      type: 'critical_value_alert',
      doctorPhone,
      patientName,
      testName,
      value,
      unit,
      normalRange,
      labName: 'Pehlix Diagnostic Lab',
      labPhone: '9999999999'
    };

    // Log the alert payload to console as requested
    console.log('--- [CRITICAL VALUE ALERT LOG] ---');
    console.log(JSON.stringify(alertPayload, null, 2));
    console.log('---------------------------------');

    // Create a QStash escalation job placeholder
    console.log('ESCALATION JOB WOULD BE QUEUED HERE — 15 minute acknowledgement check');
    await qstashService.enqueueJob({
      jobType: 'critical_acknowledgement_check',
      resultId: result._id.toString(),
      visitId: visit._id.toString(),
      delayMinutes: 15
    });

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
    result.criticalAcknowledgedBy = alertId; // doctor's identifier or URL token
    await result.save();

    console.log(`[Critical Alert Acknowledged] Result ${resultId} acknowledged by ${alertId}`);
    return result;
  },

  /**
   * Retrieves pathologist approval queue. Prioritizes critical results and older pending results.
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
   * Pathologist approves a result, updates report details, triggers PDF generation.
   */
  async approveResult(labId, resultId, pathologistId, pathologistNote) {
    const result = await Result.findOne({ _id: resultId, labId });
    if (!result) {
      throw new AppError('Result not found', 'REPORT_NOT_FOUND', 404);
    }

    result.isApproved = true;
    result.approvedBy = pathologistId;
    result.approvedAt = new Date();
    await result.save();

    // Find linked report
    let report = await Report.findOne({ visitId: result.visitId, labId });
    if (report) {
      if (pathologistNote) {
        report.pathologistNote = pathologistNote;
      }
      report.status = 'approved';
      await report.save();
    }

    // Check if all results for this visit are approved.
    // If so, transition visit status to 'approved'
    const pendingApprovalCount = await Result.countDocuments({
      visitId: result.visitId,
      labId,
      isApproved: false,
      isDeleted: { $ne: true }
    });

    if (pendingApprovalCount === 0) {
      await VisitService.updateVisitStatus(labId, result.visitId, 'approved');
    }

    // Log PDF generation job payload (placeholder for AGENT_08)
    const pdfJob = {
      type: 'generate_pdf',
      visitId: result.visitId.toString(),
      labId: labId.toString(),
      reportId: report ? report._id.toString() : null
    };

    console.log('--- [PDF GENERATION JOB PAYLOAD] ---');
    console.log(JSON.stringify(pdfJob, null, 2));
    console.log('------------------------------------');

    return {
      approved: true,
      reportId: report ? report._id : null
    };
  },

  /**
   * Updates an existing result record and re-runs range and formula checks.
   */
  async updateResult(labId, resultId, data, enteredBy) {
    const result = await Result.findOne({ _id: resultId, labId });
    if (!result) {
      throw new AppError('Result not found', 'REPORT_NOT_FOUND', 404);
    }

    const testMasterDoc = await TestMaster.findById(result.testId);
    if (!testMasterDoc) {
      throw new AppError('Test catalog record not found', 'TEST_NOT_FOUND', 404);
    }

    const parametersWithDerived = await this.calculateDerivedValues(data.parameters, testMasterDoc);
    const { isCritical, flaggedParameters, processedParameters } = await this.checkCriticalValues(parametersWithDerived, testMasterDoc);

    result.parameters = processedParameters;
    result.isCritical = isCritical;
    result.enteredBy = enteredBy;
    await result.save();

    return { result, isCritical, flaggedParameters };
  },

  /**
   * Pathologist rejects a result, records rejection note, logs alert for technician.
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

    // Log notification payload for technician
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
