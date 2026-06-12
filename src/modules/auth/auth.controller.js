import bcrypt from 'bcryptjs';
import AuthService from './auth.service.js';
import User from '../staff/user.model.js';
import Patient from '../patients/patient.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import { PERMISSIONS } from '../../config/permissions.js';
import EmailService from '../../utils/email.js';
import WhatsAppService from '../../utils/whatsapp.js';
import { AdminService } from '../admin/admin.service.js';
import { calculateBlindIndex } from '../../utils/crypto.js';

const AuthController = {
  /**
   * Request to send OTP to a phone number.
   */
  async sendOtp(req, res, next) {
    try {
      const { phone, email } = req.body;
      const targetIdentifier = phone || email;

      let user = null;
      if (phone) {
        user = await User.findOne({ phone }).populate('labId', 'name planConfig');
      } else if (email) {
        user = await User.findOne({ email }).populate('labId', 'name planConfig');
      }

      let patientRecord = null;
      let patientExists = false;
      if (user) {
        const authorizedRoles = ['doctor', 'owner', 'patient', 'superAdmin'];
        if (!user.roles || !user.roles.some(r => authorizedRoles.includes(r))) {
          throw new AppError('Access denied. OTP login is restricted to authorized roles.', 'AUTH_OTP_DENIED', 403);
        }
      } else {
        // If user does not exist in DB, verify if they have any clinical Patient records on Pehlix
        if (phone) {
          const blindIndex = calculateBlindIndex(phone, 'phone');
          patientRecord = await Patient.findOne({ phoneBlindIndex: blindIndex, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
        } else if (email) {
          patientRecord = await Patient.findOne({ email, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
        }
        patientExists = !!patientRecord;
        if (!patientExists) {
          throw new AppError('Access denied. Contact information is not registered with any laboratory.', 'AUTH_OTP_DENIED', 403);
        }
      }

      const otp = AuthService.generateOtp();
      await AuthService.storeOtp(targetIdentifier, otp);
      
      // FIX-004 (Security): OTP log ONLY in non-production. Was previously logging in production
      // which means OTP values were visible in Vercel production logs accessible to team members.
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[OTP_LOG] Generated OTP for ${targetIdentifier}: ${otp}`);
      }

      // Extract recipient's email address and name for personalized delivery
      let recipientEmail = email || (user ? user.email : (patientRecord ? patientRecord.email : null));
      let recipientPhone = phone || (user ? user.phone : (patientRecord ? patientRecord.phone : null));
      let patientName = 'User';
      if (user) {
        patientName = user.name || 'User';
      } else if (patientRecord) {
        patientName = `${patientRecord.firstName} ${patientRecord.lastName || ''}`.trim() || 'Patient';
      }

      // Send OTP based on user role and available channels
      const isStaffOrOwner = user && user.roles && user.roles.some(r => ['owner', 'superAdmin', 'pathologist', 'technician', 'receptionist', 'admin'].includes(r));
      
      let emailDispatched = false;
      let whatsappDispatched = false;
      const dispatchPromises = [];

      // 1. Send via Email if recipient has a registered email AND (they logged in via email OR they are staff/owner)
      if (recipientEmail) {
        if (email || isStaffOrOwner) {
          const p = EmailService.sendOtp(recipientEmail, otp).then(() => {
            console.log(`[sendOtp] OTP successfully sent to email: ${recipientEmail}`);
          }).catch((err) => {
            console.error(`[sendOtp] Failed to deliver email to ${recipientEmail}:`, err);
          });
          dispatchPromises.push(p);
          emailDispatched = true;
        }
      }

      // 2. Send via WhatsApp if recipient has a phone number AND (they logged in via phone OR they are NOT staff/owner)
      if (recipientPhone) {
        if (phone || !isStaffOrOwner) {
          const p = WhatsAppService.send(recipientPhone, 'otp_verification', { otpCode: otp, patientName }).then(() => {
            console.log(`[sendOtp] OTP successfully sent to WhatsApp: ${recipientPhone}`);
          }).catch((err) => {
            console.error(`[sendOtp] Failed to deliver WhatsApp to ${recipientPhone}:`, err);
          });
          dispatchPromises.push(p);
          whatsappDispatched = true;
        }
      }

      // 3. Fallback: If nothing was dispatched (e.g. phone login but no WhatsApp template match or email missing), try any available channel
      if (!emailDispatched && !whatsappDispatched) {
        if (recipientEmail) {
          const p = EmailService.sendOtp(recipientEmail, otp).catch((err) => {
            console.error(`[sendOtp] Fallback email failed:`, err);
          });
          dispatchPromises.push(p);
        } else if (recipientPhone) {
          const p = WhatsAppService.send(recipientPhone, 'otp_verification', { otpCode: otp, patientName }).catch((err) => {
            console.error(`[sendOtp] Fallback WhatsApp failed:`, err);
          });
          dispatchPromises.push(p);
        }
      }

      // Await all dispatch promises so Vercel doesn't freeze before completion
      if (dispatchPromises.length > 0) {
        await Promise.all(dispatchPromises);
      }

      // Phone SMS OTP delivery is kept commented out in the codebase as a future fallback option
      /*
      try {
        // const SmsService = await import('../../utils/sms.js');
        // await SmsService.default.send(phone, `Your Pehlix verification code is: ${otp}. Valid for 5 minutes.`);
      } catch (smsError) {
        console.error('Failed to send OTP via SMS:', smsError);
      }
      */

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEVELOPMENT] OTP for ${targetIdentifier} is: ${otp}`);
        return sendSuccess(res, { otp }, 'OTP sent successfully (Dev Mode)');
      }

      return sendSuccess(res, null, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verification of OTP. Restricted to doctors, owners, and registered patients.
   */
  async verifyOtp(req, res, next) {
    try {
      const { phone, email, otp } = req.body;
      const targetIdentifier = phone || email;

      await AuthService.verifyOtp(targetIdentifier, otp);

      let user = null;
      if (phone) {
        user = await User.findOne({ phone }).populate('labId', 'name planConfig');
      } else if (email) {
        user = await User.findOne({ email }).populate('labId', 'name planConfig');
      }
      
      if (user) {
        if (user.role && (!user.roles || user.roles.length === 0)) {
          user.roles = [user.role];
          await user.save();
        }
        const authorizedRoles = ['doctor', 'owner', 'patient', 'superAdmin'];
        if (!user.roles || !user.roles.some(r => authorizedRoles.includes(r))) {
          throw new AppError('Access denied. User not authorized for OTP login.', 'AUTH_OTP_DENIED', 403);
        }
      } else {
        // Find most recent Patient record to resolve name and auto-provision the User record
        let patientRecord = null;
        if (phone) {
          const blindIndex = calculateBlindIndex(phone, 'phone');
          patientRecord = await Patient.findOne({ phoneBlindIndex: blindIndex, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
        } else if (email) {
          patientRecord = await Patient.findOne({ email, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
        }

        if (!patientRecord) {
          throw new AppError('Access denied. User not authorized for OTP login.', 'AUTH_OTP_DENIED', 403);
        }

        const patientPhone = phone || patientRecord.phone;
        const patientEmail = email || patientRecord.email;
        const patientName = `${patientRecord.firstName} ${patientRecord.lastName || ''}`.trim() || `Patient-${patientPhone ? patientPhone.slice(-4) : 'User'}`;
        
        user = await User.create({
          roles: ['patient'],
          name: patientName,
          phone: patientPhone,
          email: patientEmail,
          labId: null, // Patients span multiple labs dynamically
          isOtpOnly: true,
          isActive: true
        });
      }

      // Increment token version to invalidate previous sessions
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      // Determine permissions (merge all permissions for all roles)
      let permissions = [];
      if (user.roles && user.roles.includes('superAdmin')) {
        permissions = ['*'];
      } else if (user.roles) {
        user.roles.forEach(role => {
          if (PERMISSIONS[role]) permissions.push(...PERMISSIONS[role]);
        });
      }

      const accessToken = AuthService.generateAccessToken({
        userId: user._id,
        labId: user.labId,
        roles: user.roles || [],
        permissions: [...new Set(permissions)]
      });

      const refreshToken = AuthService.generateRefreshToken(user._id, user.tokenVersion);
      AuthService.setRefreshTokenCookie(res, refreshToken);

      const userObj = user.toObject();
      delete userObj.passwordHash;
      delete userObj.deviceHistory;
      delete userObj.tokenVersion;
      delete userObj.__v;

      return sendSuccess(res, { accessToken, user: userObj }, 'OTP verified successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Staff login using email and password.
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email }).populate('labId', 'name planConfig');
      if (!user || !user.passwordHash) {
        return sendError(res, 'AUTH_TOKEN_INVALID', 'Invalid email or password', {}, 401);
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return sendError(res, 'AUTH_TOKEN_INVALID', 'Invalid email or password', {}, 401);
      }

      if (user.role && (!user.roles || user.roles.length === 0)) {
        user.roles = [user.role];
        await user.save();
      }

      if (!user.isActive) {
        return sendError(res, 'AUTH_ACCOUNT_SUSPENDED', 'Account is deactivated', {}, 403);
      }

      if (user.isSuspended) {
        return sendError(res, 'AUTH_ACCOUNT_SUSPENDED', 'Account is suspended', {}, 403);
      }

      // Tracks device changes and updates user device history
      const userAgent = req.headers['user-agent'] || '';
      let ip = req.ip || req.socket.remoteAddress || '';
      if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1';
      }

      // Update session tracking variables
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      const isNewDevice = await AuthService.checkAndTrackDevice(user, userAgent, ip);

      if (isNewDevice) {
        console.log(`[ALERT] New device detected for user: ${user.name} (${user.email}) from IP: ${ip}`);
        // WhatsApp alert placeholder will be triggered here
      }

      // Determine permissions
      let permissions = [];
      if (user.roles && user.roles.includes('superAdmin')) {
        permissions = ['*'];
      } else if (user.roles) {
        user.roles.forEach(role => {
          if (PERMISSIONS[role]) permissions.push(...PERMISSIONS[role]);
        });
      }

      const accessToken = AuthService.generateAccessToken({
        userId: user._id,
        labId: user.labId,
        roles: user.roles || [],
        permissions: [...new Set(permissions)]
      });

      const refreshToken = AuthService.generateRefreshToken(user._id, user.tokenVersion);
      AuthService.setRefreshTokenCookie(res, refreshToken);

      const userObj = user.toObject();
      delete userObj.passwordHash;
      delete userObj.deviceHistory;
      delete userObj.tokenVersion;
      delete userObj.__v;

      return sendSuccess(res, { accessToken, user: userObj }, 'Login successful');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Refreshes the access token using the HTTP-only Refresh Token.
   */
  async refresh(req, res, next) {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) {
        return sendError(res, 'AUTH_TOKEN_INVALID', 'Refresh token is missing', {}, 401);
      }

      const user = await AuthService.validateRefreshToken(token);

      // Determine permissions
      let permissions = [];
      if (user.roles && user.roles.includes('superAdmin')) {
        permissions = ['*'];
      } else if (user.roles) {
        user.roles.forEach(role => {
          if (PERMISSIONS[role]) permissions.push(...PERMISSIONS[role]);
        });
      }

      const accessToken = AuthService.generateAccessToken({
        userId: user._id,
        labId: user.labId,
        roles: user.roles || [],
        permissions: [...new Set(permissions)]
      });

      const userObj = user.toObject();
      delete userObj.passwordHash;
      delete userObj.deviceHistory;
      delete userObj.tokenVersion;
      delete userObj.__v;

      return sendSuccess(res, { accessToken, user: userObj }, 'Access token refreshed successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Log out request. Revokes the session by incrementing the tokenVersion on the user document.
   */
  async logout(req, res, next) {
    try {
      const userId = req.user?.userId;
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          user.tokenVersion = (user.tokenVersion || 0) + 1;
          await user.save();
        }
      }

      res.clearCookie('refreshToken');
      return sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Set or change password for the authenticated user.
   */
  async setPassword(req, res, next) {
    try {
      const { password } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 401);
      }

      if (!password || password.length < 6) {
        throw new AppError('Password must be at least 6 characters long', 'VALIDATION_FAILED', 400);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      if (user.roles && user.roles.includes('patient') && user.roles.length === 1) {
        throw new AppError('Patients are not allowed to set passwords. OTP login only.', 'ACCESS_DENIED', 403);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user.passwordHash = passwordHash;
      user.isOtpOnly = false;
      await user.save();

      return sendSuccess(res, null, 'Password set successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Laboratory self-registration (public)
   */
  async registerLab(req, res, next) {
    try {
      const labData = {
        ...req.body,
        plan: 'starter' // Enforce starter plan for self-registration
      };
      
      const result = await AdminService.createLab(labData, 'self-registered');
      return sendSuccess(res, result, 'Laboratory registered successfully and owner account provisioned', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Step 1: Staff requests password reset — sends OTP to their registered email.
   * POST /auth/forgot-password  { email }
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) throw new AppError('Email address is required.', 'VALIDATION_ERROR', 400);

      // Look up the user — only staff (non-OTP-only users with passwords) can reset
      const user = await User.findOne({ email, isDeleted: { $ne: true } }).select('firstName email isActive isSuspended');
      
      // Security: Always return success even if user not found (prevents email enumeration)
      if (!user || !user.isActive || user.isSuspended) {
        return sendSuccess(res, null, 'If that email is registered, you will receive a reset code shortly.');
      }

      const otp = AuthService.generateOtp();
      await AuthService.storePasswordResetOtp(email, otp);

      // Send OTP via email (same Resend integration as existing OTP flow)
      await EmailService.sendEmail({
        to: email,
        subject: 'Pehlix — Password Reset Code',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px;">
            <h2 style="color:#4f46e5;margin-bottom:8px;">Password Reset</h2>
            <p style="color:#374151;">Hi ${user.firstName},</p>
            <p style="color:#374151;">Your password reset code is:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#fff;border-radius:8px;margin:16px 0;color:#111827;">${otp}</div>
            <p style="color:#6b7280;font-size:14px;">This code expires in <strong>5 minutes</strong>. If you did not request this, ignore this email.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="color:#9ca3af;font-size:12px;">Pehlix · Lab Management System · pehlix.in</p>
          </div>
        `
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[RESET_OTP] ${email}: ${otp}`);
      }

      return sendSuccess(res, null, 'If that email is registered, you will receive a reset code shortly.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Step 2: Verify OTP and get a one-time reset token.
   * POST /auth/verify-reset-otp  { email, otp }
   * Returns: { resetToken } — used in Step 3 as a URL param
   */
  async verifyResetOtp(req, res, next) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) throw new AppError('Email and OTP are required.', 'VALIDATION_ERROR', 400);

      const resetToken = await AuthService.verifyPasswordResetOtp(email, otp);
      return sendSuccess(res, { resetToken }, 'OTP verified. You may now set a new password.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Step 3: Set new password using the one-time reset token.
   * POST /auth/reset-password  { token, newPassword }
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) throw new AppError('Reset token and new password are required.', 'VALIDATION_ERROR', 400);
      if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters long.', 'VALIDATION_ERROR', 400);

      // Consume the token (validates + deletes it from Redis atomically)
      const email = await AuthService.consumePasswordResetToken(token);

      const user = await User.findOne({ email, isDeleted: { $ne: true } });
      if (!user) throw new AppError('User account not found.', 'NOT_FOUND', 404);

      // Hash and save new password
      const saltRounds = 12;
      user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
      user.isOtpOnly = false;
      // Invalidate all existing sessions by bumping token version
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      return sendSuccess(res, null, 'Password has been reset successfully. Please log in with your new password.');
    } catch (error) {
      next(error);
    }
  }
};

export default AuthController;
export { AuthController };
