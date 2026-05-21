import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';

/**
 * Middleware to authenticate requests using an RS256 signed JWT access token.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'AUTH_TOKEN_INVALID', 'Authentication token is missing or invalid', {}, 401);
    }

    const token = authHeader.split(' ')[1];
    const publicKey = (process.env.JWT_ACCESS_PUBLIC_KEY || '').replace(/\\n/g, '\n');

    if (!publicKey) {
      return sendError(res, 'AUTH_TOKEN_INVALID', 'JWT public key configuration is missing', {}, 401);
    }

    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

    req.user = {
      userId: decoded.userId,
      labId: decoded.labId,
      role: decoded.role,
      permissions: decoded.permissions,
      isImpersonation: decoded.isImpersonation || false,
      impersonatedBy: decoded.impersonatedBy || null
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'AUTH_TOKEN_EXPIRED', 'Authentication token has expired', {}, 401);
    }
    return sendError(res, 'AUTH_TOKEN_INVALID', 'Authentication token is invalid', {}, 401);
  }
}

/**
 * Middleware to authenticate Super Admin requests using HS256 JWT and IP whitelisting.
 */
export async function authenticateSuperAdmin(req, res, next) {
  try {
    // 1. IP Whitelist Verification
    let clientIp = req.ip || req.socket.remoteAddress || '';
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
      clientIp = '127.0.0.1';
    }

    const whitelistEnv = process.env.SUPER_ADMIN_IP_WHITELIST || '';
    const whitelist = whitelistEnv.split(',').map(ip => ip.trim()).filter(Boolean);

    if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Forbidden: client IP not whitelisted', {}, 403);
    }

    // 2. Token Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'AUTH_TOKEN_INVALID', 'Authentication token is missing or invalid', {}, 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SUPER_ADMIN_SECRET;

    if (!secret) {
      return sendError(res, 'AUTH_TOKEN_INVALID', 'Super Admin Secret is not configured', {}, 401);
    }

    const decoded = jwt.verify(token, secret);

    if (decoded.role !== 'superAdmin') {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Forbidden: Super Admin access required', {}, 403);
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      permissions: decoded.permissions || ['*'],
      isImpersonation: decoded.isImpersonation || false,
      impersonatedBy: decoded.impersonatedBy || null
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'AUTH_TOKEN_EXPIRED', 'Authentication token has expired', {}, 401);
    }
    return sendError(res, 'AUTH_TOKEN_INVALID', 'Authentication token is invalid', {}, 401);
  }
}
