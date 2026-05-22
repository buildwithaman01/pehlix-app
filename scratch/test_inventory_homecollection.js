import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../src/utils/db.js';
import InventoryService from '../src/modules/inventory/inventory.service.js';
import HomeCollectionService from '../src/modules/homeCollections/homeCollection.service.js';
import ResultService from '../src/modules/results/result.service.js';
import QStashService from '../src/utils/qstash.js';
import SmsService from '../src/utils/sms.js';

// Load environment variables
dotenv.config();

// Local store to track mock notifications
const qstashNotifications = [];
const smsMessages = [];

// Mock QStashService and SmsService methods
QStashService.enqueue = async (endpoint, payload, delaySeconds) => {
  console.log(`   [MOCK QStash enqueue] endpoint: ${endpoint}, delay: ${delaySeconds || 0}s`);
  return 'mock_msg_id_' + Math.random().toString(36).substr(2, 9);
};

QStashService.enqueueNotification = async (templateName, variables, phone, delaySeconds = 0) => {
  console.log(`   [MOCK QStash notification] template: ${templateName}, phone: ${phone}, delay: ${delaySeconds}s`);
  qstashNotifications.push({ templateName, variables, phone, delaySeconds });
  return 'mock_notif_id_' + Math.random().toString(36).substr(2, 9);
};

SmsService.send = async (phone, message) => {
  console.log(`   [MOCK SMS send] phone: ${phone}, message: "${message.substring(0, 50)}..."`);
  smsMessages.push({ phone, message });
  return { success: true };
};

// Main verification runner
async function runVerification() {
  console.log('Connecting to database...');
  await connectDB();
  console.log('Connected successfully.\n');

  // Create temporary test identifiers to avoid conflict
  const labId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();
  const visitId = new mongoose.Types.ObjectId();
  const testId = new mongoose.Types.ObjectId();

  console.log(`Using Test Identifiers:
  Lab ID: ${labId}
  User ID: ${userId}
  Patient ID: ${patientId}
  Visit ID: ${visitId}
  Test ID: ${testId}
  `);

  // Seed minimum DB dependency records
  // 1. Lab
  const Lab = mongoose.model('Lab');
  await Lab.create({
    _id: labId,
    name: 'Pehlix Test Lab',
    slug: 'pehlix-test-lab-' + Date.now(),
    phone: '9999999999',
    email: 'testlab@pehlix.com',
    plan: 'pro',
    planConfig: {
      modules: {
        inventory: true,
        homeCollections: true
      }
    }
  });

  // 2. Patient
  const Patient = mongoose.model('Patient');
  await Patient.create({
    _id: patientId,
    labId,
    patientCode: 'PAT-' + Date.now(),
    firstName: 'John',
    lastName: 'Doe',
    phone: '9876543210',
    age: 30,
    gender: 'male',
    consentGiven: true
  });

  // 3. User (Phlebotomist)
  const User = mongoose.model('User');
  await User.create({
    _id: userId,
    labId,
    role: 'phlebotomist',
    name: 'Phlebo Sam',
    phone: '9888888888',
    email: 'phlebo@pehlix.com',
    isActive: true
  });

  // 4. TestMaster
  const TestMaster = mongoose.model('TestMaster');
  await TestMaster.create({
    _id: testId,
    code: 'HEM-' + Date.now(),
    name: 'Hemoglobin Test',
    department: 'Hematology',
    basePrice: 200,
    parameters: [
      { name: 'Hb', unit: 'g/dL', normalLow: 12, normalHigh: 16, criticalLow: 8, criticalHigh: 20 }
    ]
  });

  // 5. Visit
  const Visit = mongoose.model('Visit');
  await Visit.create({
    _id: visitId,
    labId,
    patientId,
    visitCode: 'VIS-' + Date.now(),
    visitType: 'homeCollection',
    tests: [testId],
    status: 'registered'
  });

  console.log('--- STARTING 10 CHECKPOINTS ---');

  // ==========================================
  // CHECKPOINT 1: Creation of inventory items and purchase log
  // ==========================================
  console.log('\n[CHECKPOINT 1] Creating inventory item...');
  const itemA = await InventoryService.createItem(labId, {
    name: 'Reagent Alpha',
    category: 'reagent',
    unit: 'vials',
    currentStock: 100,
    minimumStock: 20,
    reorderQuantity: 50,
    costPerUnit: 10,
    supplier: { name: 'Sigma Supplier', phone: '1234567890' }
  }, userId);

  // Check purchase log
  const InventoryLog = mongoose.model('InventoryLog');
  const log1 = await InventoryLog.findOne({ itemId: itemA._id, type: 'purchase' });
  if (itemA.currentStock === 100 && log1 && log1.quantityChange === 100) {
    console.log('✅ Checkpoint 1 Passed: Item created, purchase log verified.');
  } else {
    throw new Error('❌ Checkpoint 1 Failed');
  }

  // ==========================================
  // CHECKPOINT 2: Stock adjustments & low-stock state
  // ==========================================
  console.log('\n[CHECKPOINT 2] Adjusting stock manually (reducing to low stock)...');
  const adjustResult = await InventoryService.adjustStock(
    labId,
    itemA._id,
    -85,
    'adjustment',
    userId,
    'Manual stock reduction for testing'
  );

  if (adjustResult.item.currentStock === 15 && adjustResult.isLowStock === true) {
    console.log('✅ Checkpoint 2 Passed: Manual adjustment reduced stock to 15, low-stock flag triggered.');
  } else {
    throw new Error('❌ Checkpoint 2 Failed');
  }

  // ==========================================
  // CHECKPOINT 3: Insufficient stock limit check
  // ==========================================
  console.log('\n[CHECKPOINT 3] Verifying insufficient stock limit throws 400...');
  try {
    await InventoryService.adjustStock(
      labId,
      itemA._id,
      -20, // 15 - 20 = -5 (insufficient)
      'adjustment',
      userId,
      'Invalid adjustment below zero'
    );
    throw new Error('Should have thrown an error');
  } catch (error) {
    if (error.statusCode === 400 && error.message.includes('Insufficient stock')) {
      console.log('✅ Checkpoint 3 Passed: Successfully blocked negative stock with 400 error.');
    } else {
      throw error;
    }
  }

  // ==========================================
  // CHECKPOINT 4: Auto-consumption triggered on result entry
  // ==========================================
  console.log('\n[CHECKPOINT 4] Seeding item with auto-consumption mapping and submitting result...');
  // Create another item mapped to hemoglobin test
  const itemB = await InventoryService.createItem(labId, {
    name: 'Hb Reagent Tube',
    category: 'reagent',
    unit: 'tubes',
    currentStock: 10,
    minimumStock: 3,
    reagentConsumption: [{ testId, quantityPerTest: 2 }]
  }, userId);

  // Submit test result
  await ResultService.submitResult(labId, {
    visitId,
    testId,
    parameters: [{ parameterName: 'Hb', value: '14' }]
  }, userId);

  // Check if stock of itemB was reduced by 2
  const updatedItemB = await InventoryService.getItemById(labId, itemB._id);
  const consumptionLog = await InventoryLog.findOne({ itemId: itemB._id, type: 'consumption' });

  if (updatedItemB.currentStock === 8 && consumptionLog && consumptionLog.quantityChange === -2) {
    console.log('✅ Checkpoint 4 Passed: Result submission successfully triggered auto-consumption & created linked log.');
  } else {
    throw new Error('❌ Checkpoint 4 Failed');
  }

  // ==========================================
  // CHECKPOINT 5: Get low stock items sorted by severity
  // ==========================================
  console.log('\n[CHECKPOINT 5] Fetching low stock items sorted by critical ratio...');
  // Item A: 15 / 20 = 0.75 ratio
  // Item B: 8 / 3 = 2.67 ratio (Wait, item B is not low stock because 8 > 3. Let's make it low stock.)
  // Let's reduce Item B to 2 (minimum is 3, ratio 2/3 = 0.67)
  await InventoryService.adjustStock(labId, itemB._id, -6, 'adjustment', userId, 'make low stock');
  
  const lowStockItems = await InventoryService.getLowStockItems(labId);
  // Item B ratio: 2/3 = 0.67, Item A ratio: 15/20 = 0.75
  // Item B should come first
  if (lowStockItems.length >= 2 && lowStockItems[0].name === 'Hb Reagent Tube' && lowStockItems[1].name === 'Reagent Alpha') {
    console.log('✅ Checkpoint 5 Passed: Low stock items retrieved and sorted correctly by severity.');
  } else {
    console.log('lowStockItems:', lowStockItems);
    throw new Error('❌ Checkpoint 5 Failed');
  }

  // ==========================================
  // CHECKPOINT 6: Consumption reporting aggregations
  // ==========================================
  console.log('\n[CHECKPOINT 6] Fetching consumption report...');
  const report = await InventoryService.getConsumptionReport(labId, 'today');
  
  if (report.length > 0 && report[0].name === 'Hb Reagent Tube' && report[0].totalConsumed === 2) {
    console.log('✅ Checkpoint 6 Passed: Consumption aggregation report matches expected output.');
  } else {
    console.log('report:', report);
    throw new Error('❌ Checkpoint 6 Failed');
  }

  // ==========================================
  // CHECKPOINT 7: Creating a home collection and scheduling QStash reminders
  // ==========================================
  console.log('\n[CHECKPOINT 7] Creating home collection booking...');
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 1); // Tomorrow

  const homeCol = await HomeCollectionService.createHomeCollection(labId, {
    visitId,
    patientId,
    assignedPhlebotomist: userId,
    scheduledDate,
    timeSlot: '9-11am',
    address: { street: '123 Main St', city: 'Ranchi', pincode: '834001' }
  }, userId);

  // Check if reminder notification was queued
  const reminderNotif = qstashNotifications.find(n => n.templateName === 'home_visit_reminder');
  if (homeCol && homeCol.status === 'scheduled' && reminderNotif) {
    console.log(`✅ Checkpoint 7 Passed: Booking created, QStash reminder scheduled with delay of ${reminderNotif.delaySeconds}s.`);
  } else {
    throw new Error('❌ Checkpoint 7 Failed');
  }

  // ==========================================
  // CHECKPOINT 8: Transitioning collection status to collected, checking logs & notifications
  // ==========================================
  console.log('\n[CHECKPOINT 8] Transitioning status to "collected" and checking WhatsApp queues...');
  await HomeCollectionService.updateStatus(labId, homeCol._id, 'collected', userId, {
    cashCollected: 500,
    notes: 'Sample collected, cash received'
  });

  const collectedCol = await mongoose.model('HomeCollection').findById(homeCol._id);
  const collectedNotif = qstashNotifications.find(n => n.templateName === 'sample_collected');

  if (collectedCol.status === 'collected' && collectedCol.cashCollected === 500 && collectedNotif) {
    console.log('✅ Checkpoint 8 Passed: Status transitioned to "collected", cash details saved, sample_collected notification queued.');
  } else {
    throw new Error('❌ Checkpoint 8 Failed');
  }

  // ==========================================
  // CHECKPOINT 9: Simulating PWA offline sync array
  // ==========================================
  console.log('\n[CHECKPOINT 9] Simulating PWA offline sync process...');
  // Create another collection to sync
  const homeCol2 = await HomeCollectionService.createHomeCollection(labId, {
    visitId,
    patientId,
    assignedPhlebotomist: userId,
    scheduledDate,
    timeSlot: '11am-1pm',
    address: { street: '456 Ring Rd', city: 'Ranchi' }
  }, userId);

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const oneMinAgo = new Date(Date.now() - 1 * 60 * 1000);

  // Sync actions
  const offlineActions = [
    {
      homeCollectionId: homeCol2._id.toString(),
      status: 'enroute',
      notes: 'En route now',
      offlineCreatedAt: tenMinAgo
    },
    {
      homeCollectionId: homeCol2._id.toString(),
      status: 'arrived',
      notes: 'Arrived at site',
      offlineCreatedAt: fiveMinAgo
    },
    {
      homeCollectionId: homeCol2._id.toString(),
      status: 'patientAbsent',
      notes: 'Patient not available',
      offlineCreatedAt: oneMinAgo
    }
  ];

  await HomeCollectionService.processOfflineSync(labId, userId, offlineActions);

  const syncedCol = await mongoose.model('HomeCollection').findById(homeCol2._id);
  
  // Verify status is patientAbsent, and statusHistory has entries in correct timestamp order
  const history = syncedCol.statusHistory;
  const isChronological = history[1].status === 'enroute' && history[2].status === 'arrived' && history[3].status === 'patientAbsent';
  const hasRescheduleAlert = qstashNotifications.some(n => n.templateName === 'sample_rejected'); // using sample_rejected for rescheduling alert

  if (syncedCol.status === 'patientAbsent' && isChronological && hasRescheduleAlert) {
    console.log('✅ Checkpoint 9 Passed: Offline sync applied actions chronologically, rescheduled alert queued.');
  } else {
    console.log('syncedCol history:', history);
    throw new Error('❌ Checkpoint 9 Failed');
  }

  // ==========================================
  // CHECKPOINT 10: Phlebotomist job list sorted by slot
  // ==========================================
  console.log('\n[CHECKPOINT 10] Retrieving phlebotomist job list sorted by slot...');
  // Delete previous collections or just query for tomorrow
  await mongoose.model('HomeCollection').deleteMany({ labId });

  // Create 3 collections for tomorrow
  await HomeCollectionService.createHomeCollection(labId, {
    visitId,
    patientId,
    assignedPhlebotomist: userId,
    scheduledDate,
    timeSlot: '4-6pm',
    address: { street: 'Slot 3 address' }
  }, userId);

  await HomeCollectionService.createHomeCollection(labId, {
    visitId,
    patientId,
    assignedPhlebotomist: userId,
    scheduledDate,
    timeSlot: '7-9am',
    address: { street: 'Slot 1 address' }
  }, userId);

  await HomeCollectionService.createHomeCollection(labId, {
    visitId,
    patientId,
    assignedPhlebotomist: userId,
    scheduledDate,
    timeSlot: '11am-1pm',
    address: { street: 'Slot 2 address' }
  }, userId);

  const jobs = await HomeCollectionService.getPhlebotomistJobs(labId, userId, scheduledDate);

  const correctOrder = jobs.length === 3 && jobs[0].timeSlot === '7-9am' && jobs[1].timeSlot === '11am-1pm' && jobs[2].timeSlot === '4-6pm';

  if (correctOrder) {
    console.log('✅ Checkpoint 10 Passed: Jobs retrieved and sorted chronologically by slot.');
  } else {
    console.log('jobs order:', jobs.map(j => j.timeSlot));
    throw new Error('❌ Checkpoint 10 Failed');
  }

  console.log('\n=============================================');
  console.log('🎉 ALL 10 VERIFICATION CHECKPOINTS PASSED! 🎉');
  console.log('=============================================');

  // Clean up seeded database documents
  console.log('\nCleaning up database...');
  await Lab.deleteMany({ _id: labId });
  await Patient.deleteMany({ labId });
  await User.deleteMany({ labId });
  await TestMaster.deleteMany({ _id: testId });
  await Visit.deleteMany({ labId });
  await mongoose.model('InventoryItem').deleteMany({ labId });
  await mongoose.model('InventoryLog').deleteMany({ labId });
  await mongoose.model('HomeCollection').deleteMany({ labId });
  await mongoose.model('Result').deleteMany({ labId });
  console.log('Database cleaned.');
}

runVerification()
  .then(() => {
    console.log('Verification run complete.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Verification run failed:', err);
    process.exit(1);
  });
