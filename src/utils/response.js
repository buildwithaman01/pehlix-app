export function sendSuccess(res, data, message, statusCode = 200) {
  return res.status(statusCode).json({
    status: 'success',
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

export function sendError(res, code, message, details = {}, statusCode = 400) {
  return res.status(statusCode).json({
    status: 'error',
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  });
}
