import bcrypt from 'bcryptjs';
import AuthService from './auth.service.js';
import User from '../staff/user.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import { PERMISSIONS } from '../../config/permissions.js';

const AuthController = {
  /**
   * Request to send OTP to a phone number.
   */
  async sendOtp(req, res, next) {
    try {
      const { phone } = req.body;

      const otp = AuthService.generateOtp();
      await AuthService.storeOtp(phone, otp);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEVELOPMENT] OTP for ${phone} is: ${otp}`);
        return sendSuccess(res, { otp }, 'OTP sent successfully (Dev Mode)');
      }

      // Production SMS placeholder
      try {
        // await smsService.send(phone, otp);
      } catch (smsError) {
        console.error('Failed to send OTP via SMS:', smsError);
      }

      return sendSuccess(res, null, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verification of OTP. Creates a minimal patient record if they are logging in for the first time.
   */
  async verifyOtp(req, res, next) {
    try {
      const { phone, otp } = req.body;

      await AuthService.verifyOtp(phone, otp);

      let user = await User.findOne({ phone });
      
      if (!user) {
        // Create minimal patient user record
        user = await User.create({
          role: 'patient',
          name: `Patient-${phone.slice(-4)}`,
          phone: phone,
          labId: null
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
  }
};

export default AuthController;
export { AuthController };
