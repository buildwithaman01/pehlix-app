import { PERMISSIONS } from '../config/permissions.js';
import { sendError } from '../utils/response.js';

/**
 * Middleware factory to check if the user's role allows access to a specific module.
 * @param {string} requiredModule Module name (e.g. 'patients', 'billing')
 */
export function checkPermission(requiredModule) {
  return (req, res, next) => {
    const roles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    
    if (!roles.length) {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Access denied: role not defined', {}, 403);
    }

    // superAdmin gets bypass access to all modules
    if (roles.includes('superAdmin')) {
      return next();
    }

    const hasPermission = roles.some(role => {
      const allowed = PERMISSIONS[role];
      return allowed && (allowed.includes('*') || allowed.includes(requiredModule));
    });

    if (!hasPermission) {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', `Access denied: insufficient permissions for ${requiredModule}`, {}, 403);
    }

    next();
  };
}

/**
 * Middleware factory to check if the user's role is in the list of authorized roles.
 * @param {...string} authorizedRoles Authorized roles
 */
export function authorize(...authorizedRoles) {
  return (req, res, next) => {
    const roles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    
    if (!roles.length || !roles.some(role => authorizedRoles.includes(role))) {
      return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Access denied: insufficient permissions', {}, 403);
    }
    
    next();
  };
}
