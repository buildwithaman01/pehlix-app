import axios from 'axios';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import Notification from '../modules/notifications/notification.model.js';
import SmsService from './sms.js';

// Order of variables expected by Meta API templates
const TEMPLATE_VAR_MAP = {
  booking_confirmation: ['patientName', 'testList', 'totalAmount', 'expectedReportTime', 'labName'],
  sample_collected: ['patientName', 'labName', 'expectedReportTime'],
  report_ready_paid: ['patientName', 'reportLink', 'labName', 'reportCode'],
  report_ready_unpaid: ['patientName', 'pendingAmount', 'paymentLink', 'labName'],
  payment_received: ['patientName', 'amount', 'reportLink', 'labName'],
  payment_reminder_d1: ['patientName', 'pendingAmount', 'paymentLink', 'labName'],
  payment_reminder_d3: ['patientName', 'pendingAmount', 'paymentLink', 'labName'],
  payment_reminder_d7: ['patientName', 'pendingAmount', 'paymentLink', 'labName'],
  sample_rejected: ['patientName', 'rejectionReason', 'labName', 'rescheduleLink'],
  appointment_reminder: ['patientName', 'scheduledTime', 'address'],
  critical_value_alert: ['doctorName', 'patientName', 'testName', 'value', 'unit', 'normalRange', 'labName', 'labPhone', 'acknowledgeLink'],
  doctor_commission_statement: ['doctorName', 'month', 'totalReferrals', 'commissionAmount', 'statementLink', 'labName'],
  owner_daily_summary: ['ownerName', 'labName', 'date', 'patientCount', 'revenue', 'pendingAmount', 'reportCount', 'alerts'],
  trial_day_10: ['ownerName', 'patientsRegistered', 'reportsSent', 'planUpgradeLink'],
  staff_device_alert: ['staffName', 'labName', 'loginTime', 'deviceInfo']
};

/**
 * Reconstruct message text for SMS fallback
 */
function compileSmsMessage(templateName, variables) {
  const patientName = variables.patientName || 'Patient';
  const labName = variables.labName || 'Pehlix Lab';
  const doctorName = variables.doctorName || 'Doctor';
  const ownerName = variables.ownerName || 'Owner';
  const staffName = variables.staffName || 'Staff';

  const smsTemplates = {
    booking_confirmation: `Hi ${patientName}, your booking at ${labName} is confirmed. Tests: ${variables.testList || ''}. Expected report time: ${variables.expectedReportTime || ''}. You paid ${variables.totalAmount || 0}.`,
    sample_collected: `Hi ${patientName}, your sample has been collected. Your report from ${labName} will be ready by ${variables.expectedReportTime || ''}.`,
    report_ready_paid: `Hi ${patientName}, your report from ${labName} is ready. Tap to view: ${variables.reportLink || ''}. Report ID: ${variables.reportCode || ''}. Link valid 48 hours.`,
    report_ready_unpaid: `Hi ${patientName}, your report from ${labName} is ready. Please pay ${variables.pendingAmount || 0} to receive it: ${variables.paymentLink || ''}. Link valid 48 hours.`,
    payment_received: `Hi ${patientName}, payment of ${variables.amount || 0} received. Your report from ${labName} is here: ${variables.reportLink || ''}.`,
    payment_reminder_d1: `Hi ${patientName}, your report from ${labName} is ready. Pending payment: ${variables.pendingAmount || 0}. Pay here: ${variables.paymentLink || ''}.`,
    payment_reminder_d3: `Hi ${patientName}, friendly reminder — your lab report payment of ${variables.pendingAmount || 0} is still pending at ${labName}. Pay here: ${variables.paymentLink || ''}.`,
    payment_reminder_d7: `Hi ${patientName}, your report from ${labName} has been ready for 7 days. Payment of ${variables.pendingAmount || 0} is pending: ${variables.paymentLink || ''}.`,
    sample_rejected: `Hi ${patientName}, your sample from ${labName} could not be processed due to ${variables.rejectionReason || ''}. Please visit or book a home collection: ${variables.rescheduleLink || ''}.`,
    appointment_reminder: `Hi ${patientName}, reminder — your home collection is scheduled for ${variables.scheduledTime || ''} at ${variables.address || ''}. Our phlebotomist will arrive shortly.`,
    critical_value_alert: `URGENT: Dr ${doctorName}, patient ${patientName} has a critical value. ${variables.testName || ''}: ${variables.value || ''} ${variables.unit || ''}. Normal range: ${variables.normalRange || ''}. Please contact patient immediately. Lab: ${labName} ${variables.labPhone || ''}. Acknowledge: ${variables.acknowledgeLink || ''}.`,
    doctor_commission_statement: `Hi Dr ${doctorName}, your commission statement from ${labName} for ${variables.month || ''}. Referrals: ${variables.totalReferrals || 0}. Commission: ${variables.commissionAmount || 0}. Statement: ${variables.statementLink || ''}.`,
    owner_daily_summary: `${labName} — ${variables.date || ''}. Patients: ${variables.patientCount || 0}. Revenue: ${variables.revenue || 0}. Pending: ${variables.pendingAmount || 0}. Reports sent: ${variables.reportCount || 0}. Alerts: ${variables.alerts || ''}.`,
    trial_day_10: `Hi ${ownerName}, your Pehlix trial has 4 days remaining. You have registered ${variables.patientsRegistered || 0} patients and sent ${variables.reportsSent || 0} reports. Continue with full access: ${variables.planUpgradeLink || ''}.`,
    staff_device_alert: `Alert: ${staffName} logged into ${labName} Pehlix account from a new device at ${variables.loginTime || ''}. Device: ${variables.deviceInfo || ''}. If this was not you, contact support immediately.`
  };

  // Resolve template name or standard fallbacks
  const cleanName = templateName.replace(/_alert$/, '').replace(/_rejection_alert$/, '_rejected');
  return smsTemplates[templateName] || smsTemplates[cleanName] || `Notification from ${labName}: ${JSON.stringify(variables)}`;
}

/**
 * Determine recipient type based on template name
 */
function getRecipientType(templateName) {
  if (['critical_value_alert', 'doctor_commission_statement'].includes(templateName)) {
    return 'doctor';
  }
  if (['owner_daily_summary', 'trial_day_10'].includes(templateName)) {
    return 'owner';
  }
  if (['staff_device_alert'].includes(templateName)) {
    return 'staff';
  }
  return 'patient';
}

export const WhatsAppService = {
  /**
   * Sends a WhatsApp message using Meta Cloud API.
   * If all 3 attempts fail, triggers SMS fallback via MSG91.
   * Logs everything to the Notifications collection.
   */
  async send(phone, templateName, variables = {}) {
    // 1. Resolve labId
    let labId = variables.labId || (variables.lab && (variables.lab._id || variables.lab));
    if (!labId) {
      try {
        const Lab = mongoose.model('Lab');
        const defaultLab = await Lab.findOne();
        if (defaultLab) {
          labId = defaultLab._id;
        } else {
          labId = new mongoose.Types.ObjectId();
        }
      } catch (err) {
        labId = new mongoose.Types.ObjectId();
      }
    }

    const recipientType = getRecipientType(templateName);

    // 2. Initialize notification log
    const notification = await Notification.create({
      labId,
      recipientPhone: phone,
      recipientType,
      channel: 'whatsapp',
      templateName,
      variables,
      status: 'queued',
      retryCount: 0
    });

    // 3. Map variables to Meta Cloud API components parameters
    const varKeys = TEMPLATE_VAR_MAP[templateName] || Object.keys(variables);
    const parameters = varKeys.map(key => ({
      type: 'text',
      text: String(variables[key] !== undefined ? variables[key] : '')
    }));

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en_US'
        },
        components: [
          {
            type: 'body',
            parameters
          }
        ]
      }
    };

    let attempt = 0;
    let success = false;
    let lastError = null;
    let externalMessageId = null;

    // Retry loop (3 attempts)
    while (attempt < 3 && !success) {
      try {
        attempt++;
        const response = await axios.post(
          `https://graph.facebook.com/v18.0/${config.META_WHATSAPP_PHONE_NUMBER_ID}/messages`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${config.META_WHATSAPP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        externalMessageId = response.data?.messages?.[0]?.id || 'meta_msg_success_placeholder';
        success = true;
      } catch (error) {
        lastError = error;
        notification.retryCount = attempt;
        await notification.save();
      }
    }

    if (success) {
      notification.status = 'sent';
      notification.externalMessageId = externalMessageId;
      notification.sentAt = new Date();
      await notification.save();
      return { success: true, messageId: externalMessageId };
    } else {
      notification.status = 'failed';
      notification.failureReason = lastError?.response?.data 
        ? JSON.stringify(lastError.response.data) 
        : lastError?.message || 'Meta API Call Failed';
      await notification.save();

      // Trigger SMS Fallback via MSG91
      const smsMessage = compileSmsMessage(templateName, variables);
      console.log(`[SMS Fallback Triggered for ${phone}] Message: "${smsMessage}"`);

      const smsResult = await SmsService.send(phone, smsMessage);

      // Log SMS fallback notification
      await Notification.create({
        labId,
        recipientPhone: phone,
        recipientType,
        channel: 'sms',
        templateName,
        variables: { ...variables, fallbackOriginalTemplate: templateName, smsText: smsMessage },
        status: smsResult.success ? 'sent' : 'failed',
        failureReason: smsResult.success ? undefined : (typeof smsResult.error === 'object' ? JSON.stringify(smsResult.error) : (smsResult.error || 'SMS failed')),
        sentAt: smsResult.success ? new Date() : undefined
      });

      return {
        success: false,
        fallbackSent: smsResult.success,
        error: lastError?.message
      };
    }
  },

  /**
   * Sends a direct text message via WhatsApp using Meta Cloud API (non-template message).
   * Falls back to SMS via MSG91 if all 3 attempts fail.
   */
  async sendDirectText(phone, text, labId) {
    if (!labId) {
      try {
        const Lab = mongoose.model('Lab');
        const defaultLab = await Lab.findOne();
        if (defaultLab) {
          labId = defaultLab._id;
        } else {
          labId = new mongoose.Types.ObjectId();
        }
      } catch (err) {
        labId = new mongoose.Types.ObjectId();
      }
    }

    const recipientType = 'owner';

    // Initialize notification log
    const notification = await Notification.create({
      labId,
      recipientPhone: phone,
      recipientType,
      channel: 'whatsapp',
      templateName: 'direct_text_message',
      variables: { text },
      status: 'queued',
      retryCount: 0
    });

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    };

    let attempt = 0;
    let success = false;
    let lastError = null;
    let externalMessageId = null;

    // Retry loop (3 attempts)
    while (attempt < 3 && !success) {
      try {
        attempt++;
        const response = await axios.post(
          `https://graph.facebook.com/v18.0/${config.META_WHATSAPP_PHONE_NUMBER_ID}/messages`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${config.META_WHATSAPP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        externalMessageId = response.data?.messages?.[0]?.id || 'meta_msg_success_placeholder';
        success = true;
      } catch (error) {
        lastError = error;
        notification.retryCount = attempt;
        await notification.save();
      }
    }

    if (success) {
      notification.status = 'sent';
      notification.externalMessageId = externalMessageId;
      notification.sentAt = new Date();
      await notification.save();
      return { success: true, messageId: externalMessageId };
    } else {
      notification.status = 'failed';
      notification.failureReason = lastError?.response?.data 
        ? JSON.stringify(lastError.response.data) 
        : lastError?.message || 'Meta API Call Failed';
      await notification.save();

      // Trigger SMS Fallback via MSG91
      console.log(`[SMS Fallback Triggered for ${phone}] Message: "${text}"`);
      const smsResult = await SmsService.send(phone, text);

      // Log SMS fallback notification
      await Notification.create({
        labId,
        recipientPhone: phone,
        recipientType,
        channel: 'sms',
        templateName: 'direct_text_message',
        variables: { text, fallbackOriginalTemplate: 'direct_text_message', smsText: text },
        status: smsResult.success ? 'sent' : 'failed',
        failureReason: smsResult.success ? undefined : (typeof smsResult.error === 'object' ? JSON.stringify(smsResult.error) : (smsResult.error || 'SMS failed')),
        sentAt: smsResult.success ? new Date() : undefined
      });

      return {
        success: false,
        fallbackSent: smsResult.success,
        error: lastError?.message
      };
    }
  }
};

export default WhatsAppService;
