import axios from 'axios';
import { config } from '../config/index.js';

export const TurnstileService = {
  /**
   * Verifies a Cloudflare Turnstile token.
   * @param {string} token - The client's turnstile response token.
   * @param {string} [ip] - The client's IP address.
   * @returns {Promise<boolean>} - True if verified successfully, false otherwise.
   */
  async verifyToken(token, ip) {
    if (!token) {
      console.warn('[TurnstileService] No token provided for verification');
      return false;
    }

    const secretKey = config.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      console.warn('[TurnstileService] TURNSTILE_SECRET_KEY is not configured. Defaulting to true in non-production.');
      if (config.NODE_ENV !== 'production') {
        return true;
      }
      return false;
    }

    try {
      // Cloudflare Turnstile siteverify expects application/x-www-form-urlencoded or multipart/form-data
      // but JSON payload is also accepted by the API. Let's use form-urlencoded just to be safe.
      const params = new URLSearchParams();
      params.append('secret', secretKey);
      params.append('response', token);
      if (ip) {
        params.append('remoteip', ip);
      }

      const response = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;
      if (data && data.success) {
        return true;
      } else {
        console.warn('[TurnstileService] Verification failed:', data ? data['error-codes'] : 'unknown error');
        return false;
      }
    } catch (error) {
      console.error('[TurnstileService] Verification request failed:', error.response?.data || error.message);
      return false;
    }
  }
};

export default TurnstileService;
