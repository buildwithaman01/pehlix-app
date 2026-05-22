import { Client } from '@upstash/qstash';
import { config } from '../config/index.js';

const qstashClient = new Client({
  token: config.UPSTASH_QSTASH_TOKEN
});

export const QStashService = {
  /**
   * Enqueues a job using Upstash QStash.
   * @param {string} endpoint - The full destination URL.
   * @param {object} payload - JSON payload.
   * @param {number} [delaySeconds=0] - Delay in seconds before processing.
   * @returns {Promise<string>} The messageId from QStash.
   */
  async enqueue(endpoint, payload, delaySeconds = 0) {
    const options = {
      url: endpoint,
      body: payload
    };
    if (delaySeconds > 0) {
      options.delay = delaySeconds;
    }
    const res = await qstashClient.publishJSON(options);
    return res.messageId;
  },

  /**
   * Enqueues a notification job delivering to the internal endpoint.
   * @param {string} templateName - Name of the WhatsApp template.
   * @param {object} variables - Template parameters.
   * @param {string} phone - Recipient phone number.
   * @returns {Promise<string>} The messageId from QStash.
   */
  async enqueueNotification(templateName, variables, phone, delaySeconds = 0) {
    const endpoint = `${config.NEXT_PUBLIC_APP_URL}/api/internal/notifications/send`;
    const payload = {
      templateName,
      variables,
      phone
    };
    return this.enqueue(endpoint, payload, delaySeconds);
  },

  /**
   * Alias/backward compatibility helper for existing code that passed a single object.
   */
  async enqueueJob(payload) {
    const endpoint = `${config.NEXT_PUBLIC_APP_URL}/api/internal/payments/process`; // default internal worker url
    return this.enqueue(endpoint, payload);
  }
};

// Also support named export and destructured single payload signature
export const enqueueNotification = async (firstArg, variables, phone, delaySeconds = 0) => {
  if (typeof firstArg === 'object' && firstArg !== null) {
    // Called as: enqueueNotification({ templateName, phone, variables })
    const { templateName, phone: p, variables: vars } = firstArg;
    return QStashService.enqueueNotification(templateName, vars, p, delaySeconds);
  }
  // Called as: enqueueNotification(templateName, variables, phone)
  return QStashService.enqueueNotification(firstArg, variables, phone, delaySeconds);
};

export default QStashService;
