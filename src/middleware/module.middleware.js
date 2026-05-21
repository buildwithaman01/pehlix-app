import { sendError } from '../utils/response.js';

/**
 * Middleware factory to restrict access to endpoints based on the tenant's plan modules.
 * @param {string} moduleName Module name (e.g. 'inventory', 'analytics')
 */
export function requireModule(moduleName) {
  return (req, res, next) => {
    const planConfig = req.planConfig;
    if (!planConfig || !planConfig.modules || planConfig.modules[moduleName] !== true) {
      return sendError(res, 'TENANT_MODULE_DISABLED', 'This module is not enabled on your plan', {}, 403);
    }
    next();
  };
}

/**
 * Middleware factory to restrict access to endpoints based on the tenant's plan features.
 * @param {string} featureName Feature name
 */
export function requireFeature(featureName) {
  return (req, res, next) => {
    const planConfig = req.planConfig;
    if (!planConfig || !planConfig.features || planConfig.features[featureName] !== true) {
      return sendError(res, 'TENANT_MODULE_DISABLED', 'This feature is not enabled on your plan', {}, 403);
    }
    next();
  };
}
