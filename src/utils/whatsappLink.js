/**
 * Service to generate pre-filled wa.me links for manual sharing
 * by receptionists/staff. Matches standard Pehlix templates.
 */
export const WhatsAppLinkService = {
  /**
   * Cleans phone number and wraps it in a wa.me URL with pre-filled message text.
   */
  generateLink(phone, message) {
    if (!phone) return null;
    
    // Clean all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Ensure 91 country code is present (Indian numbers)
    const phoneWithCountry = cleanPhone.startsWith('91') && cleanPhone.length > 10
      ? cleanPhone
      : '91' + (cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.substring(2) : cleanPhone);
      
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`;
  },

  /**
   * Template 1: booking_confirmation
   */
  generateBookingConfirmation(patient, lab, visit, invoice) {
    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
    const labName = lab?.name || 'Pehlix Lab';
    const testList = visit?.tests?.map(t => t.name).join(', ') || 'Diagnostic Tests';
    const totalAmount = invoice?.totalAmount || 0;
    const expectedReportTime = visit?.expectedReportTime || 'Same day';
    
    const message = `Hi ${patientName}, your booking at ${labName} is confirmed.

Tests: ${testList}
Expected report time: ${expectedReportTime}
Amount Paid: ₹${totalAmount}

Thank you for choosing ${labName}.
Powered by Pehlix`;

    return this.generateLink(patient.phone, message);
  },

  /**
   * Template 3: report_ready_paid
   */
  generateReportReady(patient, lab, report, signedUrl) {
    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
    const labName = lab?.name || 'Pehlix Lab';
    const reportCode = report?.reportCode || 'Report';

    const message = `Hi ${patientName}, your report from ${labName} is ready.

Tap to view your report:
${signedUrl}

Report ID: ${reportCode}
This link is valid for 48 hours.

Thank you.
Powered by Pehlix`;

    return this.generateLink(patient.phone, message);
  },

  /**
   * Template 4: report_ready_unpaid
   */
  generatePaymentRequest(patient, lab, invoice, paymentLink) {
    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
    const labName = lab?.name || 'Pehlix Lab';
    const balance = invoice?.balanceAmount !== undefined ? invoice.balanceAmount : (invoice?.totalAmount - invoice?.amountPaid);

    const message = `Hi ${patientName}, your report from ${labName} is ready.

Please pay the outstanding balance of ₹${balance} to receive your report:
${paymentLink}

Once payment is captured, your report link will be shared.

Thank you.
Powered by Pehlix`;

    return this.generateLink(patient.phone, message);
  },

  /**
   * Templates 6, 7, 8: payment_reminders
   */
  generatePaymentReminder(patient, lab, invoice, paymentLink, daysOld) {
    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
    const labName = lab?.name || 'Pehlix Lab';
    const balance = invoice?.balanceAmount !== undefined ? invoice.balanceAmount : (invoice?.totalAmount - invoice?.amountPaid);

    let greeting = '';
    if (daysOld <= 1) {
      greeting = `Hi ${patientName}, gentle reminder from ${labName}. Your report is ready but payment is pending.`;
    } else if (daysOld <= 3) {
      greeting = `Hi ${patientName}, friendly reminder — your lab report payment of ₹${balance} is still pending at ${labName}.`;
    } else {
      greeting = `Hi ${patientName}, final notice — your report from ${labName} has been ready for ${daysOld} days, but outstanding payment of ₹${balance} remains pending.`;
    }

    const message = `${greeting}

Pay securely online to access your report instantly:
${paymentLink}

Thank you.
Powered by Pehlix`;

    return this.generateLink(patient.phone, message);
  },

  /**
   * Template 11: critical_value_alert
   */
  generateCriticalAlert(doctor, patient, result, lab) {
    const doctorName = doctor?.name || 'Doctor';
    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
    const testName = result?.testId?.name || 'Diagnostic test';
    const value = result?.value || '';
    const unit = result?.unit || '';
    const normalRange = result?.normalRange || '';
    const labName = lab?.name || 'Pehlix Lab';
    const labPhone = lab?.phone || '';
    const acknowledgeLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.pehlix.in'}/ack/${result?._id}`;

    const message = `URGENT: Dr ${doctorName}, patient ${patientName} has a critical value.

Test: ${testName}
Result: ${value} ${unit} (Normal: ${normalRange})

Please contact patient immediately.
Lab: ${labName} (${labPhone})
Acknowledge receipt: ${acknowledgeLink}

Powered by Pehlix`;

    return this.generateLink(doctor.phone, message);
  }
};

export default WhatsAppLinkService;
