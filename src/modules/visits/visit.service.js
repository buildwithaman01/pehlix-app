import mongoose from 'mongoose';
import Visit from './visit.model.js';
import Invoice from '../billing/invoice.model.js';
import LabTest from '../staff/labTest.model.js';
import Payment from '../billing/payment.model.js';
import Sample from '../samples/sample.model.js';
import Result from '../results/result.model.js';
import Lab from '../staff/lab.model.js';
import DoctorService from '../doctors/doctor.service.js';
import { AppError } from '../../utils/errors.js';

export const VisitService = {
  /**
   * Generates a unique visit code sequentially per lab for today.
   * Format: VIS + YYYYMMDD + 3-digit sequential (e.g. VIS20240516001)
   */
  async generateVisitCode(labId) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await Visit.countDocuments({
      labId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    const nextNum = count + 1;
    const seqStr = String(nextNum).padStart(3, '0');
    return `VIS${dateStr}${seqStr}`;
  },

  /**
   * Generates a unique invoice code sequentially per lab for today.
   * Format: INV + YYYYMMDD + 3-digit sequential (e.g. INV20240516001)
   */
  async generateInvoiceCode(labId) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await Invoice.countDocuments({
      labId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    const nextNum = count + 1;
    const seqStr = String(nextNum).padStart(3, '0');
    return `INV${dateStr}${seqStr}`;
  },

  /**
   * Creates a new visit and automatically generates its associated GST invoice.
   */
  async createVisit(labId, data, createdBy) {
    // Generate visit code
    const visitCode = await this.generateVisitCode(labId);

    const {
      patientId,
      visitType = 'walkIn',
      tests,
      referredBy,
      notes,
      scheduledDate,
      paymentMethod = 'cash',
      amountPaid = 0,
      source = 'reception'
    } = data;

    // Create visit record
    const visit = new Visit({
      patientId,
      visitType,
      tests,
      referredBy,
      notes,
      scheduledDate,
      labId,
      visitCode,
      registeredBy: createdBy,
      source,
      status: 'registered',
      statusTimestamps: {
        registeredAt: new Date()
      }
    });

    await visit.save();

    // Fetch prices from LabTest collection and populate testId for Sample/Result generation
    const labTests = await LabTest.find({ labId, _id: { $in: tests } }).populate('testId');
    if (labTests.length !== tests.length) {
      throw new AppError('Some selected tests are invalid or not found for this lab', 'TEST_NOT_FOUND', 404);
    }

    // Preserve tests array order
    const testsMap = labTests.reduce((acc, lt) => {
      acc[lt._id.toString()] = lt;
      return acc;
    }, {});

    const lineItems = tests.map(testIdStr => {
      const lt = testsMap[testIdStr];
      return {
        testId: lt._id,
        testName: lt.name,
        price: lt.price,
        discount: 0,
        finalPrice: lt.price
      };
    });

    // --- SAMPLE & RESULT GENERATION LOGIC ---
    const sampleGroups = {}; // key: containerType_sampleType
    
    for (const testIdStr of tests) {
      const lt = testsMap[testIdStr];
      const tm = lt.testId; // Populated TestMaster
      const containerType = tm?.container || 'Unknown Container';
      const sampleType = tm?.sampleType || 'Unknown Sample Type';
      const groupKey = `${containerType}_${sampleType}`;

      if (!sampleGroups[groupKey]) {
        sampleGroups[groupKey] = {
          containerType,
          sampleType,
          tests: []
        };
      }
      sampleGroups[groupKey].tests.push(lt);
    }

    const createdSamples = [];
    const createdResults = [];
    let sampleIndex = 1;

    for (const key in sampleGroups) {
      const group = sampleGroups[key];
      const barcodeId = `${visitCode}-${String(sampleIndex).padStart(2, '0')}`;
      
      const sample = new Sample({
        labId,
        barcodeId,
        visitId: visit._id,
        patientId,
        sampleType: group.sampleType,
        containerType: group.containerType,
        status: 'pending',
        chainOfCustody: [{
          action: 'Sample registration required',
          performedBy: createdBy,
          timestamp: new Date(),
          notes: 'Auto-generated during visit creation'
        }]
      });
      await sample.save();
      createdSamples.push(sample._id);
      sampleIndex++;

      // Create Result documents for each test in this sample group
      for (const lt of group.tests) {
        const tm = lt.testId;
        const parameters = (tm?.parameters || []).map(p => ({
          parameterName: p.name,
          unit: p.unit,
          status: 'normal',
          isFlagged: false
        }));

        const resultDoc = new Result({
          labId,
          visitId: visit._id,
          sampleId: sample._id,
          testId: tm._id, // testMaster ID
          parameters,
          isApproved: false,
          isDeleted: false
        });
        await resultDoc.save();
        createdResults.push(resultDoc._id);
      }
    }

    visit.sampleIds = createdSamples;
    visit.resultIds = createdResults;
    // -----------------------------------------

    // Calculate billing amounts
    // FIX-C-001: GST rate from lab config (default 0 — most diagnostic tests are GST-exempt in India)
    const lab = await Lab.findById(labId).select('planConfig').lean();
    const gstRate = lab?.planConfig?.features?.gstRate ?? 0;
    const subtotal = lineItems.reduce((sum, item) => sum + item.finalPrice, 0);
    const gstAmount = gstRate > 0 ? Math.round((subtotal * (gstRate / 100)) * 100) / 100 : 0;
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

    // Generate invoice code
    const invoiceCode = await this.generateInvoiceCode(labId);

    // Calculate actual payment details
    let finalAmountPaid = 0;
    if (paymentMethod === 'credit') {
      finalAmountPaid = 0;
    } else if (paymentMethod === 'partial') {
      finalAmountPaid = amountPaid;
    } else {
      // cash, upi, card
      finalAmountPaid = totalAmount;
    }

    const balanceAmount = totalAmount - finalAmountPaid;
    let paymentStatus = 'pending';
    if (finalAmountPaid >= totalAmount) {
      paymentStatus = 'paid';
    } else if (finalAmountPaid > 0) {
      paymentStatus = 'partial';
    }

    // Create invoice document
    const invoice = new Invoice({
      labId,
      visitId: visit._id,
      patientId,
      invoiceCode,
      lineItems,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      amountPaid: finalAmountPaid,
      balanceAmount,
      paymentStatus
    });

    await invoice.save();

    // Create Payment transaction record if payment was made
    if (finalAmountPaid > 0) {
      const mappedMethod = ['cash', 'upi', 'card'].includes(paymentMethod) ? paymentMethod : 'cash';
      await Payment.create({
        labId,
        invoiceId: invoice._id,
        patientId,
        amount: finalAmountPaid,
        method: mappedMethod,
        status: 'success',
        collectedBy: createdBy,
        notes: `Collected at registration via ${paymentMethod}`
      });
    }

    // Trigger doctor commission calculation if the invoice is fully paid
    if (paymentStatus === 'paid') {
      try {
        await DoctorService.calculateAndRecordCommission(
          labId,
          visit._id,
          invoice._id,
          totalAmount
        );
      } catch (err) {
        console.error('[VisitService] Failed to calculate and record doctor commission:', err);
      }
    }

    // Update visit with invoiceId
    visit.invoiceId = invoice._id;
    await visit.save();

    // Track total referrals and revenue for the referring doctor/agent
    if (referredBy) {
      try {
        const Doctor = mongoose.model('Doctor');
        await Doctor.updateOne(
          { _id: referredBy, labId },
          { $inc: { totalReferrals: 1, totalRevenue: totalAmount } }
        );
      } catch (err) {
        console.error('[VisitService] Failed to update doctor totals:', err);
      }
    }

    return { visit, invoice };
  },

  /**
   * Retrieves visits by labId, with optional status filter and paginated results.
   */
  async getVisits(labId, filters = {}, page = 1, limit = 10, cursor = null) {
    const query = { labId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.source) {
      query.source = filters.source;
    }

    let visits;
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
            query.$or = [
              { createdAt: { $lt: cursorDate } },
              { createdAt: cursorDate, _id: { $lt: new mongoose.Types.ObjectId(cursorId) } }
            ];
          }
        } catch (err) {
          console.error('[VisitService] Failed to parse cursor, falling back to all records:', err);
        }
      }

      visits = await Visit.find(query)
        .populate('patientId', 'firstName lastName phone')
        .populate('invoiceId')
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);

      if (visits.length > limit) {
        hasNextPage = true;
        const lastItem = visits[limit - 1];
        nextCursor = Buffer.from(`${lastItem.createdAt.toISOString()}_${lastItem._id.toString()}`).toString('base64');
        visits = visits.slice(0, limit);
      }
    } else {
      const total = await Visit.countDocuments(query);
      visits = await Visit.find(query)
        .populate('patientId', 'firstName lastName phone')
        .populate('invoiceId')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1, _id: -1 });

      const totalPages = Math.ceil(total / limit);
      return {
        visits,
        total,
        page,
        limit,
        totalPages
      };
    }

    return {
      visits,
      nextCursor,
      hasNextPage,
      limit
    };
  },

  /**
   * Retrieves a specific visit by ID, populated with patient, invoice, and samples.
   */
  async getVisitById(labId, visitId) {
    const visit = await Visit.findOne({ _id: visitId, labId })
      .populate('patientId')
      .populate('invoiceId')
      .populate('sampleIds');

    if (!visit) {
      throw new AppError('Visit not found', 'VISIT_NOT_FOUND', 404);
    }
    return visit;
  },

  /**
   * Updates visit status and records the timestamp of status change.
   */
  async updateVisitStatus(labId, visitId, status) {
    const visit = await Visit.findOne({ _id: visitId, labId });
    if (!visit) {
      throw new AppError('Visit not found', 'VISIT_NOT_FOUND', 404);
    }

    visit.status = status;

    if (!visit.statusTimestamps) {
      visit.statusTimestamps = {};
    }

    const timestampKey = `${status}At`;
    visit.statusTimestamps[timestampKey] = new Date();
    
    // Explicitly mark statusTimestamps as modified if it's Mixed or nested
    visit.markModified('statusTimestamps');

    await visit.save();
    return visit;
  },

  /**
   * Appends tests to a visit and recalculates invoice line items, GST, and totals.
   */
  async addTests(labId, visitId, testIds, updatedBy) {
    const visit = await Visit.findOne({ _id: visitId, labId });
    if (!visit) {
      throw new AppError('Visit not found', 'VISIT_NOT_FOUND', 404);
    }

    // Filter out tests that are already in the visit to avoid duplicate entries
    const existingTestsSet = new Set(visit.tests.map(id => id.toString()));
    const newTestsFiltered = testIds.filter(id => !existingTestsSet.has(id.toString()));

    if (newTestsFiltered.length === 0) {
      const invoice = await Invoice.findOne({ visitId: visit._id, labId });
      return { visit, invoice };
    }

    visit.tests = [...visit.tests, ...newTestsFiltered];
    await visit.save();

    let invoice = await Invoice.findOne({ visitId: visit._id, labId });
    if (!invoice) {
      const invoiceCode = await this.generateInvoiceCode(labId);
      invoice = new Invoice({
        labId,
        visitId: visit._id,
        patientId: visit.patientId,
        invoiceCode,
        lineItems: [],
        subtotal: 0,
        gstRate: 18,
        gstAmount: 0,
        totalAmount: 0,
        amountPaid: 0,
        balanceAmount: 0,
        paymentStatus: 'pending'
      });
    }

    // Fetch details for all tests in the visit, including populated testId
    const labTests = await LabTest.find({ labId, _id: { $in: visit.tests } }).populate('testId');
    const testsMap = labTests.reduce((acc, lt) => {
      acc[lt._id.toString()] = lt;
      return acc;
    }, {});

    const lineItems = visit.tests.map(tId => {
      const lt = testsMap[tId.toString()];
      if (!lt) {
        throw new AppError(`Test ${tId} not found for this lab`, 'TEST_NOT_FOUND', 404);
      }
      return {
        testId: lt._id,
        testName: lt.name,
        price: lt.price,
        discount: 0,
        finalPrice: lt.price
      };
    });

    // --- SAMPLE & RESULT GENERATION FOR NEW TESTS ---
    const newLabTests = newTestsFiltered.map(id => testsMap[id.toString()]);
    const sampleGroups = {}; // key: containerType_sampleType
    
    for (const lt of newLabTests) {
      const tm = lt.testId; // Populated TestMaster
      const containerType = tm?.container || 'Unknown Container';
      const sampleType = tm?.sampleType || 'Unknown Sample Type';
      const groupKey = `${containerType}_${sampleType}`;

      if (!sampleGroups[groupKey]) {
        sampleGroups[groupKey] = {
          containerType,
          sampleType,
          tests: []
        };
      }
      sampleGroups[groupKey].tests.push(lt);
    }

    const createdSamples = visit.sampleIds ? [...visit.sampleIds] : [];
    const createdResults = visit.resultIds ? [...visit.resultIds] : [];
    
    // Find existing highest sample index to avoid barcode collisions
    const existingSamples = await Sample.find({ visitId: visit._id });
    let maxIndex = 0;
    existingSamples.forEach(s => {
      if (s.barcodeId && s.barcodeId.startsWith(visit.visitCode + '-')) {
        const parts = s.barcodeId.split('-');
        const idx = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(idx) && idx > maxIndex) {
          maxIndex = idx;
        }
      }
    });
    let sampleIndex = maxIndex + 1;

    for (const key in sampleGroups) {
      const group = sampleGroups[key];
      
      // Check if we already have a sample of this exact container & type for this visit
      let sample = existingSamples.find(s => s.containerType === group.containerType && s.sampleType === group.sampleType);
      
      if (!sample) {
        const barcodeId = `${visit.visitCode}-${String(sampleIndex).padStart(2, '0')}`;
        sample = new Sample({
          labId,
          barcodeId,
          visitId: visit._id,
          patientId: visit.patientId,
          sampleType: group.sampleType,
          containerType: group.containerType,
          status: 'pending',
          chainOfCustody: [{
            action: 'Sample registration required',
            performedBy: updatedBy,
            timestamp: new Date(),
            notes: 'Auto-generated during add tests'
          }]
        });
        await sample.save();
        createdSamples.push(sample._id);
        sampleIndex++;
      }

      // Create Result documents for each new test in this sample group
      for (const lt of group.tests) {
        const tm = lt.testId;
        const parameters = (tm?.parameters || []).map(p => ({
          parameterName: p.name,
          unit: p.unit,
          status: 'normal',
          isFlagged: false
        }));

        const resultDoc = new Result({
          labId,
          visitId: visit._id,
          sampleId: sample._id,
          testId: tm._id, // testMaster ID
          parameters,
          isApproved: false,
          isDeleted: false
        });
        await resultDoc.save();
        createdResults.push(resultDoc._id);
      }
    }

    visit.sampleIds = createdSamples;
    visit.resultIds = createdResults;
    // ------------------------------------------------

    // FIX-C-001: GST rate from lab config (default 0 — most diagnostic tests are GST-exempt)
    const labDoc = await Lab.findById(labId).select('planConfig').lean();
    const gstRate = labDoc?.planConfig?.features?.gstRate ?? 0;
    const subtotal = lineItems.reduce((sum, item) => sum + item.finalPrice, 0);
    const gstAmount = gstRate > 0 ? Math.round((subtotal * (gstRate / 100)) * 100) / 100 : 0;
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

    invoice.lineItems = lineItems;
    invoice.subtotal = subtotal;
    invoice.gstAmount = gstAmount;
    invoice.totalAmount = totalAmount;
    invoice.balanceAmount = totalAmount - invoice.amountPaid;

    if (invoice.balanceAmount <= 0) {
      invoice.paymentStatus = 'paid';
    } else if (invoice.amountPaid > 0) {
      invoice.paymentStatus = 'partial';
    } else {
      invoice.paymentStatus = 'pending';
    }

    await invoice.save();

    if (!visit.invoiceId) {
      visit.invoiceId = invoice._id;
      await visit.save();
    }

    return { visit, invoice };
  }
};

export default VisitService;
