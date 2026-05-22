import { authenticateSuperAdmin } from '../../middleware/auth.middleware.js';
import { AuditLog } from '../../middleware/audit.middleware.js';
import { sendError } from '../../utils/response.js';

/**
 * Middleware chain specifically for super admin routes:
 * 1. authenticateSuperAdmin
 * 2. Additional validations:
 *    - Double check role is 'superAdmin'
 *    - IP whitelist validation (with 403 response on failure and logging)
 */
export function superAdminAuth(req, res, next) {
  authenticateSuperAdmin(req, res, (err) => {
    if (err) return next(err);

    // Double check role
    if (!req.user || req.user.role !== 'superAdmin') {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Forbidden: Super Admin access required', {}, 403);
    }

    // IP whitelist verification
    let clientIp = req.ip || req.socket.remoteAddress || '';
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
      clientIp = '127.0.0.1';
    }

    const whitelistEnv = process.env.SUPER_ADMIN_IP_WHITELIST || '';
    const whitelist = whitelistEnv.split(',').map(ip => ip.trim()).filter(Boolean);

    if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
      console.log(`[SuperAdminAuth] Blocked unauthorized IP: ${clientIp}`);
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Access denied from this IP address', {}, 403);
    }

    next();
  });
}

/**
 * Audit log middleware specialized for super admin operations.
 * Adds superAdmin: true and tracks isImpersonation.
 */
export function superAdminAudit(req, res, next) {
  req.startTime = Date.now();

  res.on('finish', () => {
    try {
      const duration = Date.now() - req.startTime;
      const logData = {
        labId: req.user?.labId || null,
        userId: req.user?.userId || null,
        role: req.user?.role || null,
        action: `${req.method} ${req.originalUrl || req.path}`,
        statusCode: res.statusCode,
        duration,
        ip: req.ip || req.socket.remoteAddress || '',
        userAgent: req.headers['user-agent'] || '',
        isImpersonation: req.user?.isImpersonation || false,
        impersonatedBy: req.user?.impersonatedBy || null,
        superAdmin: true
      };

      AuditLog.create(logData).catch(err => {
        console.error('Super admin audit log save failed:', err);
      });
    } catch (err) {
      console.error('Error during super admin audit log calculation:', err);
    }
  });

  next();
}
