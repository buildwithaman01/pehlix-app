import Visit from './visit.model.js';
import Invoice from '../billing/invoice.model.js';
import LabTest from '../staff/labTest.model.js';
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

    // Create visit record
    const visit = new Visit({
      ...data,
      labId,
      visitCode,
      registeredBy: createdBy,
      status: 'registered',
      statusTimestamps: {
        registeredAt: new Date()
      }
    });

    await visit.save();

    // Fetch prices from LabTest collection
    const labTests = await LabTest.find({ labId, _id: { $in: data.tests } });
    if (labTests.length !== data.tests.length) {
      throw new AppError('Some selected tests are invalid or not found for this lab', 'TEST_NOT_FOUND', 404);
    }

    // Preserve tests array order
    const testsMap = labTests.reduce((acc, lt) => {
      acc[lt._id.toString()] = lt;
      return acc;
    }, {});

    const lineItems = data.tests.map(testIdStr => {
      const lt = testsMap[testIdStr];
      return {
        testId: lt._id,
        testName: lt.name,
        price: lt.price,
        discount: 0,
        finalPrice: lt.price
      };
    });

    // Calculate billing amounts
    const subtotal = lineItems.reduce((sum, item) => sum + item.finalPrice, 0);
    const gstRate = 18;
    const gstAmount = Math.round((subtotal * (gstRate / 100)) * 100) / 100;
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

    // Generate invoice code
    const invoiceCode = await this.generateInvoiceCode(labId);

    // Create invoice document
    const invoice = new Invoice({
      labId,
      visitId: visit._id,
      patientId: data.patientId,
      invoiceCode,
      lineItems,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      amountPaid: 0,
      balanceAmount: totalAmount,
      paymentStatus: 'pending'
    });

    await invoice.save();

    // Update visit with invoiceId
    visit.invoiceId = invoice._id;
    await visit.save();

    return { visit, invoice };
  },

  /**
   * Retrieves visits by labId, with optional status filter and paginated results.
   */
  async getVisits(labId, filters = {}, page = 1, limit = 10) {
    const query = { labId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    const total = await Visit.countDocuments(query);
    const visits = await Visit.find(query)
      .populate('patientId', 'firstName lastName phone')
      .populate('invoiceId')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      visits,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
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

    // Fetch details for all tests in the visit
    const labTests = await LabTest.find({ labId, _id: { $in: visit.tests } });
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

    const subtotal = lineItems.reduce((sum, item) => sum + item.finalPrice, 0);
    const gstRate = 18;
    const gstAmount = Math.round((subtotal * (gstRate / 100)) * 100) / 100;
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
