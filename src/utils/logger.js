/**
 * Pehlix — Centralized Logger
 * Streams logs to Better Stack (Logtail) in production.
 * Falls back to console in development / if token is missing.
 */
import { Logtail } from '@logtail/node';

const token = process.env.BETTER_STACK_SOURCE_TOKEN;
const isProd = process.env.NODE_ENV === 'production';

// Create Logtail instance only when token is present
let logtail = null;
if (token && !token.startsWith('PLACEHOLDER')) {
  logtail = new Logtail(token);
}

function fmt(level, message, meta = {}) {
  return { level, message, service: 'pehlix-app', env: process.env.NODE_ENV || 'development', ...meta };
}

const logger = {
  info(message, meta = {}) {
    if (logtail) logtail.info(message, fmt('info', message, meta));
    else if (!isProd) console.log(`[INFO]  ${message}`, meta);
  },
  warn(message, meta = {}) {
    if (logtail) logtail.warn(message, fmt('warn', message, meta));
    else console.warn(`[WARN]  ${message}`, meta);
  },
  error(message, meta = {}) {
    if (logtail) logtail.error(message, fmt('error', message, meta));
    else console.error(`[ERROR] ${message}`, meta);
  },
  debug(message, meta = {}) {
    if (!isProd) console.debug(`[DEBUG] ${message}`, meta);
  },
  // Flush all pending logs (call before process exit)
  async flush() {
    if (logtail) await logtail.flush();
  }
};

export default logger;
