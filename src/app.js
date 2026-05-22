import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { config } from './config/index.js';
import authRouter from './modules/auth/auth.routes.js';

const app = express();

// Standard middleware in the exact requested order:
// 1. express.json()
app.use(express.json());

// 2. express.urlencoded()
app.use(express.urlencoded({ extended: true }));

// 3. helmet()
app.use(helmet());

// 4. cors() with origin from config
app.use(cors({
  origin: config.NEXT_PUBLIC_APP_URL || '*',
  credentials: true
}));

// 5. cookieParser() and mongoSanitize()
app.use(cookieParser());

// Express 5 compatibility workaround for express-mongo-sanitize
app.use((req, res, next) => {
  if (req.query) {
    Object.defineProperty(req, 'query', {
      value: { ...req.query },
      writable: true,
      configurable: true
    });
  }
  if (req.params) {
    Object.defineProperty(req, 'params', {
      value: { ...req.params },
      writable: true,
      configurable: true
    });
  }
  next();
});

app.use(mongoSanitize());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Mount auth router
app.use('/api/auth', authRouter);

// Import and mount all module routers under /api prefix (commented out until created)
import patientRouter from './modules/patients/patient.routes.js';
import visitRouter from './modules/visits/visit.routes.js';
import resultRouter from './modules/results/result.routes.js';
import reportRouter from './modules/reports/report.routes.js';
import alertRouter from './modules/results/alert.routes.js';
import sampleRouter from './modules/samples/sample.routes.js';
import webhookRouter from './modules/webhooks/webhook.routes.js';
import invoiceRouter from './modules/billing/invoice.routes.js';

// Internal Background Job Processing routes
import mongoose from 'mongoose';
import PaymentService from './modules/billing/payment.service.js';
import WhatsAppService from './utils/whatsapp.js';
import SmsService from './utils/sms.js';
import QStashService from './utils/qstash.js';
import pdfWebhookController from './modules/webhooks/pdf.webhook.js';
import ReportService from './modules/reports/report.service.js';
import Report from './modules/reports/report.model.js';
import Visit from './modules/visits/visit.model.js';
import { AppError } from './utils/errors.js';

const internalRouter = express.Router();

internalRouter.post('/pdf/generated', pdfWebhookController.onPdfGenerated);
internalRouter.post('/pdf/failed', pdfWebhookController.onPdfFailed);

internalRouter.post('/reports/generate', async (req, res, next) => {
  try {
    const { visitId, labId } = req.body;
    console.log(`[QStash PDF Generation Job] Starting generation for visit ${visitId}`);
    
    // Find or create report
    let report = await Report.findOne({ visitId, labId });
    if (!report) {
      const visit = await Visit.findById(visitId);
      if (!visit) {
        throw new AppError('Visit not found', 'VISIT_NOT_FOUND', 404);
      }
      report = await ReportService.createReportRecord(labId, visitId, visit.patientId);
    }
    
    const result = await ReportService.triggerPdfGeneration(report._id);
    return res.status(200).json({ success: true, messageId: result.messageId, reportCode: result.reportCode });
  } catch (error) {
    console.error('[QStash PDF Generation Job] Failed starting PDF generation:', error);
    next(error);
  }
});

internalRouter.post('/payments/process', async (req, res, next) => {
  try {
    const payload = req.body;
    const event = payload.event;
    console.log(`[QStash Payment Job] Processing background event: ${event}`);

    let result = { success: false };
    if (event === 'payment.captured') {
      result = await PaymentService.processPaymentCapture(payload);
    } else if (event === 'subscription.charged') {
      result = await PaymentService.processSubscriptionCharged(payload);
    } else if (event === 'subscription.payment.failed') {
      result = await PaymentService.processSubscriptionFailed(payload);
    } else {
      console.warn(`[QStash Payment Job] Unhandled event type: ${event}`);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('[QStash Payment Job] Failed processing payment background event:', error);
    next(error);
  }
});

internalRouter.post('/notifications/send', async (req, res, next) => {
  try {
    const { templateName, variables, phone } = req.body;
    console.log(`[QStash Notification Job] Dispatching template "${templateName}" to phone: ${phone}`);
    const result = await WhatsAppService.send(phone, templateName, variables);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[QStash Notification Job] Failed dispatching template message:', error);
    next(error);
  }
});

internalRouter.post('/critical-acknowledgement-check', async (req, res, next) => {
  try {
    const { resultId, visitId, labId, alertId, attempt = 1 } = req.body;
    console.log(`[QStash Escalation Check] Checking result ${resultId} for acknowledgement (attempt ${attempt})`);
    
    const Result = mongoose.model('Result');
    const result = await Result.findById(resultId);
    
    if (!result) {
      return res.status(200).json({ success: false, reason: 'Result not found' });
    }
    
    if (result.criticalAcknowledgedAt) {
      console.log(`[QStash Escalation Check] Result ${resultId} already acknowledged.`);
      return res.status(200).json({ success: true, acknowledged: true });
    }
    
    if (attempt === 1) {
      console.log(`[QStash Escalation Check] Result ${resultId} not acknowledged on attempt 1. Re-firing alerts...`);
      
      const Visit = mongoose.model('Visit');
      const visit = await Visit.findById(visitId).populate('patientId').populate('referredBy');
      const lab = await mongoose.model('Lab').findById(labId);
      
      if (visit) {
        const doctorPhone = visit.referredBy ? visit.referredBy.phone : null;
        const doctorName = visit.referredBy ? visit.referredBy.name : 'Doctor';
        const patientName = visit.patientId ? `${visit.patientId.firstName} ${visit.patientId.lastName || ''}`.trim() : 'Patient';
        const testName = result.testId ? (await mongoose.model('TestMaster').findById(result.testId))?.name : 'Diagnostic Test';
        
        const criticalParams = result.parameters.filter(p => p.status === 'criticalLow' || p.status === 'criticalHigh');
        const value = criticalParams.map(p => `${p.parameterName}: ${p.value}`).join(', ');
        const unit = criticalParams.map(p => p.unit || '').join(', ');
        const normalRange = criticalParams.map(p => 'N/A').join(', ');
        
        const labName = lab?.name || 'Pehlix Diagnostic Lab';
        const labPhone = lab?.phone || '9999999999';
        
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
        
        if (doctorPhone) {
          await QStashService.enqueueNotification('critical_value_alert', alertPayload, doctorPhone);
          const smsMessage = `URGENT REMINDER: Dr ${doctorName}, patient ${patientName} has an unacknowledged critical value. ${testName}: ${value} ${unit}. Lab: ${labName} ${labPhone}. Acknowledge: ${acknowledgeLink}`;
          await SmsService.send(doctorPhone, smsMessage);
        }
        
        console.log(`[EXOTEL VOICE CALL] Triggering automated call to doctor ${doctorPhone} for result ${resultId}`);
        
        await QStashService.enqueue(
          `${config.NEXT_PUBLIC_APP_URL}/api/internal/critical-acknowledgement-check`,
          { resultId, visitId, labId, alertId, attempt: 2 },
          900
        );
      }
    } else if (attempt === 2) {
      console.log(`[QStash Escalation Check] Result ${resultId} not acknowledged on attempt 2. Alerting lab owner...`);
      const lab = await mongoose.model('Lab').findById(labId).populate('owner');
      const ownerPhone = lab?.owner?.phone;
      const ownerName = lab?.owner ? `${lab.owner.firstName} ${lab.owner.lastName || ''}`.trim() : 'Owner';
      
      const Visit = mongoose.model('Visit');
      const visit = await Visit.findById(visitId).populate('patientId');
      const patientName = visit?.patientId ? `${visit.patientId.firstName} ${visit.patientId.lastName || ''}`.trim() : 'Patient';
      
      const labName = lab?.name || 'Pehlix Lab';
      
      if (ownerPhone) {
        await SmsService.send(ownerPhone, `URGENT: Referring doctor has not acknowledged critical value alert for patient ${patientName} after 30 minutes. Please take manual action.`);
        
        await QStashService.enqueueNotification(
          'owner_daily_summary',
          {
            ownerName,
            labName,
            date: new Date().toLocaleDateString(),
            patientCount: 0,
            revenue: 0,
            pendingAmount: 0,
            reportCount: 0,
            alerts: `Dr. has not acknowledged critical value for ${patientName}`,
            labId: labId.toString()
          },
          ownerPhone
        );
      }
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[QStash Escalation Check] Failed processing escalation check:', error);
    next(error);
  }
});

// Route mountings under /api
app.use('/api/patients', patientRouter);
app.use('/api/visits', visitRouter);
app.use('/api/results', resultRouter);
app.use('/api/reports', reportRouter);
app.use('/api/critical', alertRouter);
app.use('/api/samples', sampleRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/internal', internalRouter);

export default app;
export { app };
