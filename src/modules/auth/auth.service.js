import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Redis } from '@upstash/redis';
import { AppError } from '../../utils/errors.js';
import User from '../staff/user.model.js';
import config from '../../config/index.js';

// Initialise Upstash Redis client
const redis = new Redis({
  url: config.UPSTASH_REDIS_URL,
  token: config.UPSTASH_REDIS_TOKEN
});

const AuthService = {
  /**
   * Generates a random 6-digit OTP string.
   */
  generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
  },

  /**
   * Stores the generated OTP in Upstash Redis.
   * Checks if the phone number is locked first.
   */
  async storeOtp(phone, otp) {
    const isLocked = await redis.get(`otp:locked:${phone}`);
    if (isLocked) {
      throw new AppError('This number is locked due to too many OTP attempts. Please try again later.', 'AUTH_OTP_MAX_ATTEMPTS', 429);
    }

    // Store the OTP with a 5-minute (300s) TTL
    await redis.set(`otp:${phone}`, otp, { ex: 300 });
  },

  /**
   * Verifies the input OTP against the cached Redis value.
   * Tracks and increments attempts, applying a 30-minute lock if failures exceed 3.
   */
  async verifyOtp(phone, inputOtp) {
    const isLocked = await redis.get(`otp:locked:${phone}`);
    if (isLocked) {
      throw new AppError('Too many failed attempts. Number locked for 30 minutes.', 'AUTH_OTP_MAX_ATTEMPTS', 429);
    }

    const storedOtp = await redis.get(`otp:${phone}`);
    if (!storedOtp) {
      throw new AppError('OTP has expired or does not exist.', 'AUTH_OTP_EXPIRED', 400);
    }

    const attemptsKey = `otp:attempts:${phone}`;
    const attempts = await redis.incr(attemptsKey);
    
    if (attempts === 1) {
      await redis.expire(attemptsKey, 300); // 5 minutes TTL
    }

    if (attempts >= 3) {
      await redis.set(`otp:locked:${phone}`, 'locked', { ex: 1800 }); // 30 minutes lockout
      await redis.del(`otp:${phone}`);
      await redis.del(attemptsKey);
      throw new AppError('Too many failed attempts. Number locked for 30 minutes.', 'AUTH_OTP_MAX_ATTEMPTS', 429);
    }

    if (storedOtp !== inputOtp) {
      throw new AppError('Invalid OTP.', 'AUTH_OTP_INVALID', 400);
    }

    // Cleanup on successful verification
    await redis.del(`otp:${phone}`);
    await redis.del(attemptsKey);
    return true;
  },

  /**
   * Generates a signed Access JWT (expiry 15m) using RS256 algorithm.
   */
  generateAccessToken(payload) {
    const privateKey = (process.env.JWT_ACCESS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!privateKey || privateKey.includes('PLACEHOLDER')) {
      throw new AppError('JWT Access Private Key is missing or misconfigured.', 'INTERNAL_SERVER_ERROR', 500);
    }

    // Expected keys in payload: userId, labId, role, permissions
    return jwt.sign(
      {
        userId: payload.userId,
        labId: payload.labId,
        role: payload.role,
        permissions: payload.permissions
      },
      privateKey,
      { algorithm: 'RS256', expiresIn: '15m' }
    );
  },

  /**
   * Generates a signed Refresh JWT (expiry 7d) using RS256 algorithm.
   */
  generateRefreshToken(userId, tokenVersion) {
    const privateKey = (process.env.JWT_REFRESH_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!privateKey || privateKey.includes('PLACEHOLDER')) {
      throw new AppError('JWT Refresh Private Key is missing or misconfigured.', 'INTERNAL_SERVER_ERROR', 500);
    }

    return jwt.sign(
      { userId, tokenVersion },
      privateKey,
      { algorithm: 'RS256', expiresIn: '7d' }
    );
  },

  /**
   * Validates a Refresh JWT. Verifies its signature and checks if the token version matches the user database record.
   */
  async validateRefreshToken(token) {
    const publicKey = (process.env.JWT_REFRESH_PUBLIC_KEY || '').replace(/\\n/g, '\n');
    if (!publicKey || publicKey.includes('PLACEHOLDER')) {
      throw new AppError('JWT Refresh Public Key is missing or misconfigured.', 'INTERNAL_SERVER_ERROR', 500);
    }

    try {
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
      
      const user = await User.findById(decoded.userId);
      if (!user || user.isSuspended || !user.isActive) {
        throw new AppError('User not found or suspended.', 'AUTH_TOKEN_INVALID', 401);
      }

      if (user.tokenVersion !== decoded.tokenVersion) {
        throw new AppError('Token was revoked.', 'AUTH_TOKEN_INVALID', 401);
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired refresh token.', 'AUTH_TOKEN_INVALID', 401);
    }
  },

  /**
   * Sets the refresh token HTTP-only secure cookie.
   */
  setRefreshTokenCookie(res, token) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });
  },

  /**
   * Hashes user-agent and client IP into a SHA-256 device fingerprint.
   */
  generateDeviceFingerprint(userAgent, ip) {
    return crypto.createHash('sha256').update(userAgent + ip).digest('hex');
  },

  /**
   * Checks if the user is logging in from a new device fingerprint, updates history, and returns status.
   */
  async checkAndTrackDevice(user, userAgent, ip) {
    const fingerprint = this.generateDeviceFingerprint(userAgent, ip);
    const existingDevice = user.deviceHistory.find(d => d.fingerprint === fingerprint);
    let isNewDevice = false;

    if (existingDevice) {
      existingDevice.lastSeen = new Date();
    } else {
      user.deviceHistory.push({
        fingerprint,
        userAgent,
        ip,
        firstSeen: new Date(),
        lastSeen: new Date()
      });
      isNewDevice = true;
    }

    await user.save();
    return isNewDevice;
  }
};

export default AuthService;
export { AuthService };
