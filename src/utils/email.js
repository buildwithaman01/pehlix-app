import nodemailer from 'nodemailer';
import axios from 'axios';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { CircuitBreaker } from './circuitBreaker.js';

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST || process.env.SMTP_HOST,
  port: parseInt(config.SMTP_PORT || process.env.SMTP_PORT || '587', 10),
  secure: (config.SMTP_PORT || process.env.SMTP_PORT) === '465',
  auth: {
    user: config.SMTP_USER || process.env.SMTP_USER,
    pass: config.SMTP_PASS || process.env.SMTP_PASS
  }
});

const resendApiBreaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 30000,
  timeoutMs: 3000,
  name: 'ResendAPI'
});

export const EmailService = {
  resendApiBreaker,

  /**
   * Send transactional email using Resend HTTP API directly
   */
  async sendViaResend({ to, subject, html, text, labId }) {
    if (!config.RESEND_API_KEY) {
      throw new Error('Resend API key is missing from configuration');
    }

    const callResendApi = async () => {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: config.SMTP_FROM || 'Pehlix Health <onboarding@resend.dev>',
          to: [to],
          subject,
          html: html || text,
          text: text || html
        },
        {
          headers: {
            Authorization: `Bearer ${config.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { messageId: response.data?.id || 'resend-mock-id' };
    };

    const handleFallback = async (error) => {
      console.warn(`[EmailService] Resend API Circuit Breaker fallback triggered: ${error.message}`);
      
      try {
        const Notification = mongoose.model('Notification');
        let finalLabId = labId;
        if (!finalLabId) {
          const Lab = mongoose.model('Lab');
          const defaultLab = await Lab.findOne();
          finalLabId = defaultLab ? defaultLab._id : new mongoose.Types.ObjectId();
        }

        await Notification.create({
          labId: finalLabId,
          recipientPhone: to, // schema requires recipientPhone, we will store the email address there
          recipientType: 'patient',
          channel: 'email',
          templateName: 'resend_fallback',
          variables: { to, subject, error: error.message },
          status: 'failed',
          failureReason: `Resend Breaker: ${error.message}`
        });
      } catch (err) {
        console.error('[EmailService] Failed to log email fallback failure in DB:', err.message);
      }

      return { success: false, error: error.message, isFallback: true };
    };

    try {
      return await resendApiBreaker.execute(callResendApi, handleFallback);
    } catch (err) {
      return handleFallback(err);
    }
  },

  /**
   * Send transactional email using SMTP transporter (Nodemailer)
   */
  async sendViaSmtp({ to, subject, html, text }) {
    const info = await transporter.sendMail({
      from: config.SMTP_FROM || process.env.SMTP_FROM || '"Pehlix Health" <noreply@pehlix.in>',
      to,
      subject,
      text,
      html
    });
    return info;
  },

  /**
   * Unified sendEmail method that determines route dynamically
   */
  async sendEmail({ to, subject, html, text, preferResend = false, labId }) {
    // Development Mode Bypass (only if neither Resend nor SMTP is configured)
    const hasResend = !!config.RESEND_API_KEY;
    const hasSmtp = !!(config.SMTP_HOST && config.SMTP_USER);
    if (config.NODE_ENV !== 'production' && !hasResend && !hasSmtp) {
      console.log('\n--- [DEVELOPMENT EMAIL OUTBOX] ---');
      console.log(`To:      ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Route:   ${preferResend ? 'Resend API' : 'SMTP'}`);
      console.log(`Content: ${text || html}`);
      console.log('----------------------------------\n');
      return { messageId: 'dev-mock-id' };
    }

    try {
      if (preferResend && config.RESEND_API_KEY) {
        return await this.sendViaResend({ to, subject, html, text, labId });
      }

      const hasSmtpConfig = (config.SMTP_HOST || process.env.SMTP_HOST) && (config.SMTP_USER || process.env.SMTP_USER);
      if (hasSmtpConfig) {
        return await this.sendViaSmtp({ to, subject, html, text });
      } else if (config.RESEND_API_KEY) {
        // Fallback to Resend HTTP API if SMTP is not configured
        return await this.sendViaResend({ to, subject, html, text, labId });
      } else {
        console.warn(`[EmailService] Neither SMTP nor Resend API key is configured. Email skipped.`);
        return null;
      }
    } catch (error) {
      console.error('[EmailService] Failed to dispatch email:', error);
      throw error;
    }
  },

  /**
   * Send verification OTP to patient, doctor, or owner
   */
  async sendOtp(to, otp) {
    const subject = `Pehlix Verification OTP: ${otp}`;
    const text = `Your verification code is: ${otp}. This code is valid for 5 minutes.`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 24px; font-weight: bold; color: #0F3D3E; letter-spacing: -0.5px;">Pehlix</span>
        </div>
        <h2 style="color: #1f2937; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 8px;">Verification Code</h2>
        <p style="color: #4b5563; font-size: 14px; text-align: center; margin-bottom: 24px;">Enter the following OTP code to sign in to your Pehlix account.</p>
        <div style="background-color: #f0fdf4; border: 1px dashed #86efac; border-radius: 12px; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0F3D3E; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px; line-height: 1.5;">
          This OTP is valid for 5 minutes. If you did not request this code, please ignore this email.
        </p>
      </div>
    `;
    return this.sendOtpWithFallback(to, subject, text, html);
  },

  // Helper to trap/prevent failure during test runs or if user email is empty
  async sendOtpWithFallback(to, subject, text, html) {
    if (!to) {
      console.log('[EmailService] Recipient email is empty, skipping dispatch.');
      return null;
    }
    try {
      return await this.sendEmail({ to, subject, text, html });
    } catch (e) {
      console.error('[EmailService] Failed to deliver OTP email:', e.message);
      return null;
    }
  }
};

export default EmailService;
