import { PERMISSIONS } from '../config/permissions.js';
import { sendError } from '../utils/response.js';

/**
 * Middleware factory to check if the user's role allows access to a specific module.
 * @param {string} requiredModule Module name (e.g. 'patients', 'billing')
 */
export function checkPermission(requiredModule) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Access denied: role not defined', {}, 403);
    }

    // superAdmin gets bypass access to all modules
    if (role === 'superAdmin') {
      return next();
    }

    const allowed = PERMISSIONS[role];
    if (!allowed || (!allowed.includes('*') && !allowed.includes(requiredModule))) {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', `Access denied: insufficient permissions for ${requiredModule}`, {}, 403);
    }

    next();
  };
}

/**
 * Middleware factory to check if the user's role is in the list of authorized roles.
 * @param {...string} roles Authorized roles
 */
export function authorize(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Access denied: insufficient permissions', {}, 403);
    }
    next();
  };
}
