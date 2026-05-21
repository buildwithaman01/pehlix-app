/**
 * Standard Success Response Format
 * @param {object} res Express response object
 * @param {any} data Response payload
 * @param {string} message Human readable success message
 * @param {number} statusCode HTTP Status code (default: 200)
 */
export function sendSuccess(res, data, message, statusCode = 200) {
  return res.status(statusCode).json({
    status: 'success',
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Standard Error Response Format
 * @param {object} res Express response object
 * @param {string} code Machine readable error code (from ERROR_CODES)
 * @param {string} message Human readable error message
 * @param {object} details Object containing specific error validation details or metadata
 * @param {number} statusCode HTTP Status code (default: 400)
 */
export function sendError(res, code, message, details = {}, statusCode = 400) {
  return res.status(statusCode).json({
    status: 'error',
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  });
}
