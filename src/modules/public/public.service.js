import Lab from '../staff/lab.model.js';
import LabTest from '../staff/labTest.model.js';
import Package from '../staff/package.model.js';
import Patient from '../patients/patient.model.js';
import VisitService from '../visits/visit.service.js';
import HomeCollection from '../homeCollections/homeCollection.model.js';

class PublicService {
  /**
   * Get public lab profile by slug
   */
  async getLabBySlug(slug) {
    const lab = await Lab.findOne({ slug, isActive: true, isSuspended: false })
      .select('name slug address phone logoUrl email planConfig.modules.homeCollections planConfig.modules.publicBooking');
      
    if (!lab) return null;

    // Fetch tests for this lab
    const tests = await LabTest.find({ labId: lab._id, isActive: true })
      .select('name code testType price discountPrice turnaroundTime description category');

    // Fetch packages for this lab
    const packages = await Package.find({ labId: lab._id, isActive: true })
      .select('name code price discountPrice tests turnaroundTime description');

    return {
      lab,
      catalog: {
        tests,
        packages
      }
    };
  }

  /**
   * Create a public booking (Walk-in or Home Collection)
   */
  async createBooking(data) {
    const { labId, patientData, collectionType, tests, address, scheduledDate, timeSlot } = data;

    // 1. Find or create patient
    let patient = await Patient.findOne({ labId, phone: patientData.phone });
    if (!patient) {
      patient = new Patient({
        labId,
        firstName: patientData.firstName,
        lastName: patientData.lastName || '',
        phone: patientData.phone,
        age: patientData.age,
        gender: patientData.gender,
        patientId: `PID${Date.now().toString().slice(-6)}`
      });
      await patient.save();
    }

    // Calculate total amount (simplistic for now)
    // We should ideally fetch prices from DB to avoid client tampering, but for MVP we use passed tests if we don't have time to map all.
    // For safety, let's fetch real prices.
    let totalAmount = 0;
    const testIds = tests.map(t => t.testId);
    const dbTests = await LabTest.find({ _id: { $in: testIds }, labId });
    dbTests.forEach(t => {
      totalAmount += (t.discountPrice || t.price || 0);
    });

    // 2. Create Visit
    const visitData = {
      patientId: patient._id,
      tests: tests.map(t => t.testId),
      isWalkIn: collectionType === 'walk_in',
      source: 'public_booking',
      notes: `Public booking via portal. Type: ${collectionType}`
    };

    // System will act as creator if null
    const result = await VisitService.createVisit(labId, visitData, null);
    const visit = result.visit;

    // 3. Create Home Collection if needed
    if (collectionType === 'home_collection') {
      const homeCollection = new HomeCollection({
        labId,
        visitId: visit._id,
        patientId: patient._id,
        scheduledDate: new Date(scheduledDate),
        timeSlot,
        address: {
          street: address.street,
          city: address.city,
          state: address.state,
          pincode: address.pincode
        },
        status: 'scheduled'
      });
      await homeCollection.save();
    }

    return {
      visitId: visit._id,
      visitCode: visit.visitCode,
      patient: {
        id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`.trim(),
        phone: patient.phone
      },
      totalAmount,
      collectionType
    };
  }
}

export default new PublicService();
