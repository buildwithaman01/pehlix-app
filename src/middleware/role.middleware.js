import { sendError } from '../utils/response.js';

/**
 * Helper to safely check if a user has at least one of the required roles.
 * @param {Object} user - The user object from req.user
 * @param {string|string[]} roles - The required role(s)
 * @returns {boolean} True if the user has at least one of the roles
 */
export function hasRole(user, roles) {
  if (!user || !user.roles || !Array.isArray(user.roles)) return false;
  
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return user.roles.some(role => allowedRoles.includes(role));
}

/**
 * Express middleware to restrict routes to specific roles.
 * Must be used AFTER auth.middleware.js authenticate().
 * @param {string|string[]} roles - The role(s) allowed to access this route
 */
export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'AUTH_REQUIRED', 'Authentication required', {}, 401);
    }

    if (!hasRole(req.user, roles)) {
      return sendError(res, 'FORBIDDEN', 'You do not have permission to perform this action', {}, 403);
    }

    next();
  };
}
