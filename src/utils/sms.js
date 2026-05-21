import axios from 'axios';
import { config } from '../config/index.js';

export const SmsService = {
  /**
   * Sends an SMS via MSG91 API.
   * @param {string} phone - Recipient phone number with country code.
   * @param {string} message - Message text.
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async send(phone, message) {
    try {
      // Clean phone number (remove + sign if present)
      const cleanPhone = phone ? phone.replace(/^\+/, '') : '';
      
      const response = await axios.post(
        'https://control.msg91.com/api/v5/sms/send',
        {
          template_id: process.env.MSG91_TEMPLATE_ID || 'PEHLIX_SMS',
          sender: config.MSG91_SENDER_ID || 'PEHLIX',
          short_url: '1',
          recipients: [
            {
              mobiles: cleanPhone,
              message: message
            }
          ]
        },
        {
          headers: {
            authkey: config.MSG91_AUTH_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error('MSG91 SMS failure:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }
};

export default SmsService;
