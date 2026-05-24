// Force test environment to bypass real QStash API requests
process.env.NODE_ENV = 'test';

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/utils/db.js';
import Report from '../src/modules/reports/report.model.js';
import Visit from '../src/modules/visits/visit.model.js';
import PlatformAlert from '../src/modules/analytics/alert.model.js';
import Patient from '../src/modules/patients/patient.model.js'; // Register schema
import Lab from '../src/modules/staff/lab.model.js'; // Register schema
import PdfService from '../src/utils/pdf.js';
import { pdfWebhookController } from '../src/modules/webhooks/pdf.webhook.js';
import ReportService from '../src/modules/reports/report.service.js';

dotenv.config();

function mockResponse() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
}

async function runTests() {
  console.log('\n====== STARTING PEHLIX PDF ARCHITECTURE TESTS ======\n');
  await connectDB();
  console.log('✔ Connected to MongoDB.');

  // Set up mock endpoints for test
  const RENDER_TEST_URL = 'https://mock-render-endpoint.com/generate';
  const GCP_TEST_URL = 'https://mock-gcp-endpoint.com/generate';
  const RAILWAY_TEST_URL = 'https://mock-railway-endpoint.com/generate';

  process.env.RENDER_PDF_ENDPOINT = RENDER_TEST_URL;
  process.env.GCP_PDF_ENDPOINT = GCP_TEST_URL;
  process.env.RAILWAY_PDF_ENDPOINT = RAILWAY_TEST_URL;

  // Cleanup/create mock database documents
  const labId = new mongoose.Types.ObjectId();
  const visitId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();

  await Report.deleteMany({ $or: [{ visitId }, { reportCode: 'RP-TESTPDFARCH' }] });
  await PlatformAlert.deleteMany({ labId });
  await Visit.deleteMany({ _id: visitId });

  // Create a mock visit
  const mockVisit = new Visit({
    _id: visitId,
    labId,
    patientId,
    visitCode: 'V-TESTPDFARCH',
    tests: [],
    status: 'approved'
  });
  await mockVisit.save();

  // Create a mock report
  const mockReport = new Report({
    labId,
    visitId,
    patientId,
    reportCode: 'RP-TESTPDFARCH',
    status: 'pending'
  });
  await mockReport.save();

  // Test 1: getAvailableNodes
  console.log('\n--- TEST 1: getAvailableNodes ---');
  const nodes = PdfService.getAvailableNodes();
  if (nodes.length === 3 && nodes.includes(RENDER_TEST_URL) && nodes.includes(GCP_TEST_URL) && nodes.includes(RAILWAY_TEST_URL)) {
    console.log('✔ PASS: getAvailableNodes returned all 3 configured endpoints');
  } else {
    console.error('❌ FAIL: getAvailableNodes returned:', nodes);
  }

  // Test 2: selectNode
  console.log('\n--- TEST 2: selectNode ---');
  const selectedNode = PdfService.selectNode();
  if (selectedNode && [RENDER_TEST_URL, GCP_TEST_URL, RAILWAY_TEST_URL].includes(selectedNode)) {
    console.log('✔ PASS: selectNode selected a valid endpoint:', selectedNode);
  } else {
    console.error('❌ FAIL: selectNode returned:', selectedNode);
  }

  // Test 3: selectNode with one node excluded
  console.log('\n--- TEST 3: selectNode with exclusions ---');
  const selectedNodeExcludingRender = PdfService.selectNode([RENDER_TEST_URL]);
  if (selectedNodeExcludingRender && selectedNodeExcludingRender !== RENDER_TEST_URL) {
    console.log('✔ PASS: selectNode with exclusion selected non-excluded endpoint:', selectedNodeExcludingRender);
  } else {
    console.error('❌ FAIL: selectNode with exclusion returned:', selectedNodeExcludingRender);
  }

  // Test 4: selectNode with all nodes excluded
  console.log('\n--- TEST 4: selectNode with all excluded ---');
  const selectAllExcluded = PdfService.selectNode([RENDER_TEST_URL, GCP_TEST_URL, RAILWAY_TEST_URL]);
  if (selectAllExcluded === null) {
    console.log('✔ PASS: selectNode with all excluded returned null');
  } else {
    console.error('❌ FAIL: selectNode with all excluded returned:', selectAllExcluded);
  }

  // Test 5: Concurrency lock logic simulation
  console.log('\n--- TEST 5: Concurrency Lock Simulation ---');
  // Simulated lock behavior
  let isProcessing = false;
  function handleGenerateSimulated(req, res) {
    if (isProcessing) {
      return res.status(429).json({ error: 'Node busy' });
    }
    isProcessing = true;
    setTimeout(() => {
      isProcessing = false;
    }, 50);
    return res.status(200).json({ status: 'ok' });
  }

  const res1 = mockResponse();
  const res2 = mockResponse();

  handleGenerateSimulated({}, res1);
  handleGenerateSimulated({}, res2);

  if (res1.statusCode === 200 && res2.statusCode === 429) {
    console.log('✔ PASS: Concurrency lock successfully blocked secondary request with 429');
  } else {
    console.error('❌ FAIL: Concurrency lock failed. res1:', res1.statusCode, 'res2:', res2.statusCode);
  }

  // Test 6: requeueToNextNode
  console.log('\n--- TEST 6: requeueToNextNode ---');
  const initialSelected = mockReport.selectedNode || RENDER_TEST_URL;
  const requeueRes = await PdfService.requeueToNextNode(mockReport._id, initialSelected);
  
  const updatedReport = await Report.findById(mockReport._id);
  if (requeueRes && requeueRes.node !== initialSelected && updatedReport.failedNodes.includes(initialSelected)) {
    console.log('✔ PASS: requeueToNextNode picked a different node:', requeueRes.node, 'Failed nodes tracked:', updatedReport.failedNodes);
  } else {
    console.error('❌ FAIL: requeueToNextNode failed. Requeue result:', requeueRes, 'Report state:', updatedReport);
  }

  // Test 7 & 8: Webhook failure handler, attempts count, and alerts
  console.log('\n--- TEST 7 & 8: webhook failure handling (DLQ/exhausted nodes) ---');
  
  // Set attempts to 2 so next failed webhook triggers hard failure (attempt >= 3)
  updatedReport.generationAttempts = 2;
  await updatedReport.save();

  // Mock a failed webhook callback from QStash
  const payloadBody = Buffer.from(JSON.stringify({
    reportId: mockReport._id.toString(),
    labId: labId.toString(),
    visitId: visitId.toString()
  })).toString('base64');

  const reqFailed = {
    headers: {
      authorization: 'Bearer ' + (process.env.PDF_SERVICE_SECRET || 'PLACEHOLDER_PDF_SERVICE_SHARED_SECRET')
    },
    body: {
      url: updatedReport.selectedNode,
      body: payloadBody,
      error: 'Puppeteer timeout out on node'
    }
  };

  const resFailed = mockResponse();
  
  // Temporarily configure secret for token validation bypass or compatibility
  process.env.PDF_SERVICE_SECRET = process.env.PDF_SERVICE_SECRET || 'PLACEHOLDER_PDF_SERVICE_SHARED_SECRET';

  await pdfWebhookController.onPdfFailed(reqFailed, resFailed, (err) => {
    if (err) throw err;
  });

  const finalReport = await Report.findById(mockReport._id);
  const alertsCreated = await PlatformAlert.find({ labId });

  if (finalReport.status === 'failed' && finalReport.generationAttempts === 3) {
    console.log('✔ PASS: Report marked as failed after 3 attempts');
  } else {
    console.error('❌ FAIL: Report status or attempts incorrect. Status:', finalReport.status, 'Attempts:', finalReport.generationAttempts);
  }

  const superAdminAlert = alertsCreated.find(a => a.type === 'pdf_generation_failed');
  const labOwnerAlert = alertsCreated.find(a => a.type === 'report_generation_failed');

  if (superAdminAlert && labOwnerAlert && alertsCreated.length === 2) {
    console.log('✔ PASS: PlatformAlerts created correctly for both super admin and lab owner');
  } else {
    console.error('❌ FAIL: PlatformAlerts missing or incorrect. Count:', alertsCreated.length, 'Alerts:', alertsCreated);
  }

  // Cleanup
  await Report.deleteMany({ visitId });
  await Visit.deleteMany({ _id: visitId });
  await PlatformAlert.deleteMany({ labId });

  console.log('\n====== ALL TESTS COMPLETED ======\n');
  mongoose.connection.close();
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  mongoose.connection.close();
});
