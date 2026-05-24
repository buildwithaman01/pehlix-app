import bcrypt from 'bcryptjs';
import AuthService from './auth.service.js';
import User from '../staff/user.model.js';
import Patient from '../patients/patient.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import { PERMISSIONS } from '../../config/permissions.js';
import EmailService from '../../utils/email.js';
import WhatsAppService from '../../utils/whatsapp.js';

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
        user = await User.findOne({ phone });
      } else if (email) {
        user = await User.findOne({ email });
      }

      let patientRecord = null;
      let patientExists = false;
      if (user) {
        const authorizedRoles = ['doctor', 'owner', 'patient', 'superAdmin'];
        if (!authorizedRoles.includes(user.role)) {
          throw new AppError('Access denied. OTP login is restricted to authorized roles.', 'AUTH_OTP_DENIED', 403);
        }
      } else {
        // If user does not exist in DB, verify if they have any clinical Patient records on Pehlix
        if (phone) {
          patientRecord = await Patient.findOne({ phone, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
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

      // Extract recipient's email address and name for personalized delivery
      let recipientEmail = email || (user ? user.email : (patientRecord ? patientRecord.email : null));
      let recipientPhone = phone || (user ? user.phone : (patientRecord ? patientRecord.phone : null));
      let patientName = 'User';
      if (user) {
        patientName = user.name || 'User';
      } else if (patientRecord) {
        patientName = `${patientRecord.firstName} ${patientRecord.lastName || ''}`.trim() || 'Patient';
      }

      // Resolve the role of the user (defaults to patient if no User record exists)
      const role = user ? user.role : 'patient';

      if (role === 'patient' || role === 'doctor') {
        // Patients and doctors -> WhatsApp (if phone is available)
        if (recipientPhone) {
          WhatsAppService.send(recipientPhone, 'otp_verification', { otpCode: otp, patientName }).catch((err) => {
            console.error(`[sendOtp] Failed to deliver WhatsApp to ${recipientPhone}:`, err);
          });
        } else if (recipientEmail) {
          EmailService.sendOtp(recipientEmail, otp).catch((err) => {
            console.error(`[sendOtp] Failed to deliver email to ${recipientEmail}:`, err);
          });
        }
      } else if (role === 'owner' || role === 'superAdmin') {
        // Owners and Super Admins -> Email ONLY
        if (recipientEmail) {
          EmailService.sendOtp(recipientEmail, otp).catch((err) => {
            console.error(`[sendOtp] Failed to deliver email to ${recipientEmail}:`, err);
          });
        } else {
          console.warn(`[sendOtp] No email registered for ${targetIdentifier}. Skipping email OTP.`);
        }
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
        user = await User.findOne({ phone });
      } else if (email) {
        user = await User.findOne({ email });
      }
      
      if (user) {
        const authorizedRoles = ['doctor', 'owner', 'patient', 'superAdmin'];
        if (!authorizedRoles.includes(user.role)) {
          throw new AppError('Access denied. User not authorized for OTP login.', 'AUTH_OTP_DENIED', 403);
        }
      } else {
        // Find most recent Patient record to resolve name and auto-provision the User record
        let patientRecord = null;
        if (phone) {
          patientRecord = await Patient.findOne({ phone, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
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
          role: 'patient',
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

      // Determine permissions
      const permissions = user.role === 'superAdmin' ? ['*'] : (PERMISSIONS[user.role] || []);

      const accessToken = AuthService.generateAccessToken({
        userId: user._id,
        labId: user.labId,
        role: user.role,
        permissions
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

      const user = await User.findOne({ email });
      if (!user || !user.passwordHash) {
        return sendError(res, 'AUTH_TOKEN_INVALID', 'Invalid email or password', {}, 401);
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return sendError(res, 'AUTH_TOKEN_INVALID', 'Invalid email or password', {}, 401);
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
      const permissions = user.role === 'superAdmin' ? ['*'] : (PERMISSIONS[user.role] || []);

      const accessToken = AuthService.generateAccessToken({
        userId: user._id,
        labId: user.labId,
        role: user.role,
        permissions
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
      const permissions = user.role === 'superAdmin' ? ['*'] : (PERMISSIONS[user.role] || []);

      const accessToken = AuthService.generateAccessToken({
        userId: user._id,
        labId: user.labId,
        role: user.role,
        permissions
      });

      return sendSuccess(res, { accessToken }, 'Access token refreshed successfully');
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

      if (user.role === 'patient') {
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
  }
};

export default AuthController;
export { AuthController };
