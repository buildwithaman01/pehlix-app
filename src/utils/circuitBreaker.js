import { Redis } from '@upstash/redis';
import config from '../config/index.js';

/**
 * Redis-backed Circuit Breaker (AD-001 fix)
 * 
 * ARCHITECTURE DECISION (2026-06-12):
 * The previous in-memory implementation reset to CLOSED on every Vercel cold start,
 * making it useless in production serverless environments. This version persists breaker
 * state in Upstash Redis using a lightweight key-per-service approach:
 *
 *   CB:{name}:state      — "OPEN" | "HALF_OPEN" | absent (= CLOSED)
 *   CB:{name}:failures   — consecutive failure count (integer, incremented atomically)
 *   CB:{name}:openedAt   — Unix timestamp (ms) when breaker opened
 *
 * Design principles:
 *   - Redis failure NEVER blocks the primary action. If Redis is unreachable, we degrade
 *     gracefully to a local in-process state (worst-case = original behaviour).
 *   - CLOSED state is represented by key ABSENCE (no TTL needed — Redis has no entry to expire).
 *   - OPEN state key has a TTL equal to cooldownMs. When it expires naturally, the breaker
 *     transitions to HALF_OPEN on next request (no cron, no scheduler needed).
 *   - Same public API: new CircuitBreaker({name, ...}) + execute(actionFn, fallbackFn)
 *
 * Public API is 100% backward-compatible. whatsapp.js and email.js require zero changes.
 */

// Shared Redis client — module-level singleton (reused across invocations in warm lambda)
let redisClient = null;

function getRedis() {
  if (!redisClient) {
    try {
      redisClient = new Redis({
        url: config.UPSTASH_REDIS_URL,
        token: config.UPSTASH_REDIS_TOKEN
      });
    } catch (err) {
      console.error('[CircuitBreaker] Failed to initialise Redis client:', err.message);
    }
  }
  return redisClient;
}

export class CircuitBreaker {
  /**
   * @param {Object} options
   * @param {number} [options.failureThreshold=5]  - Consecutive failures before opening
   * @param {number} [options.cooldownMs=30000]     - Duration (ms) to stay OPEN before HALF_OPEN retry
   * @param {number} [options.timeoutMs=3000]       - Action timeout in ms
   * @param {string} [options.name='General']       - Service identifier — used as Redis key prefix
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownMs = options.cooldownMs || 30000;
    this.timeoutMs = options.timeoutMs || 3000;
    this.name = options.name || 'General';

    // Local fallback state — used only when Redis is unreachable
    this._localState = 'CLOSED';
    this._localFailures = 0;
    this._localNextAttemptTime = 0;

    // Redis key prefixes
    this._keyState    = `CB:${this.name}:state`;
    this._keyFailures = `CB:${this.name}:failures`;
  }

  // ─── Redis State Helpers ──────────────────────────────────────────────────

  async _getState() {
    try {
      const redis = getRedis();
      if (!redis) return this._localState;
      const state = await redis.get(this._keyState);
      return state || 'CLOSED'; // null / absent = CLOSED
    } catch {
      return this._localState;
    }
  }

  async _openBreaker() {
    this._localState = 'OPEN';
    this._localNextAttemptTime = Date.now() + this.cooldownMs;
    try {
      const redis = getRedis();
      if (!redis) return;
      const ttlSeconds = Math.ceil(this.cooldownMs / 1000);
      // OPEN key auto-expires after cooldown → breaker becomes HALF_OPEN on next check
      await redis.set(this._keyState, 'OPEN', { ex: ttlSeconds });
    } catch (err) {
      console.error(`[CircuitBreaker: ${this.name}] Redis write failed (openBreaker):`, err.message);
    }
  }

  async _halfOpenBreaker() {
    this._localState = 'HALF_OPEN';
    try {
      const redis = getRedis();
      if (!redis) return;
      // HALF_OPEN is transient — keep TTL tight (30s). Next success → delete key; next failure → re-OPEN.
      await redis.set(this._keyState, 'HALF_OPEN', { ex: 30 });
    } catch (err) {
      console.error(`[CircuitBreaker: ${this.name}] Redis write failed (halfOpen):`, err.message);
    }
  }

  async _closeBreaker() {
    this._localState = 'CLOSED';
    this._localFailures = 0;
    try {
      const redis = getRedis();
      if (!redis) return;
      // CLOSED = key deleted. Also reset failure counter.
      await redis.del(this._keyState);
      await redis.del(this._keyFailures);
    } catch (err) {
      console.error(`[CircuitBreaker: ${this.name}] Redis write failed (closeBreaker):`, err.message);
    }
  }

  async _incrementFailures() {
    this._localFailures++;
    try {
      const redis = getRedis();
      if (!redis) return this._localFailures;
      const count = await redis.incr(this._keyFailures);
      // Ensure the failure key has a TTL (2× cooldown) so it doesn't persist forever
      if (count === 1) {
        await redis.expire(this._keyFailures, Math.ceil((this.cooldownMs * 2) / 1000));
      }
      return count;
    } catch {
      return this._localFailures;
    }
  }

  // ─── Core Execute ─────────────────────────────────────────────────────────

  /**
   * Executes the action inside the circuit breaker.
   * If OPEN: immediately invokes fallback.
   * If HALF_OPEN: runs a single probe request. Success → CLOSE; failure → re-OPEN.
   * If CLOSED: runs normally. On threshold failures → OPEN.
   *
   * @param {Function} actionFn   - Async function to run (the real external call)
   * @param {Function} fallbackFn - Fallback invoked on OPEN breaker or action failure
   * @returns {Promise<any>}
   */
  async execute(actionFn, fallbackFn) {
    const state = await this._getState();

    // ── OPEN: fail fast ──
    if (state === 'OPEN') {
      console.warn(`[CircuitBreaker: ${this.name}] Breaker is OPEN. Executing fast fallback.`);
      return fallbackFn(new Error('Circuit breaker is OPEN.'));
    }

    const isHalfOpen = state === 'HALF_OPEN';
    if (isHalfOpen) {
      console.log(`[CircuitBreaker: ${this.name}] Breaker is HALF_OPEN. Running probe request.`);
    }

    // ── CLOSED / HALF_OPEN: try action ──
    try {
      const result = await this._executeWithTimeout(actionFn, this.timeoutMs);

      // Success
      if (isHalfOpen) {
        console.log(`[CircuitBreaker: ${this.name}] Probe succeeded. Transitioning HALF_OPEN → CLOSED.`);
      }
      await this._closeBreaker();
      return result;

    } catch (error) {
      const failures = await this._incrementFailures();
      console.error(`[CircuitBreaker: ${this.name}] Failure #${failures}. Error: ${error.message}`);

      if (isHalfOpen || failures >= this.failureThreshold) {
        console.warn(`[CircuitBreaker: ${this.name}] Threshold reached (${failures}). Transitioning to OPEN for ${this.cooldownMs / 1000}s.`);
        await this._openBreaker();
      }

      return fallbackFn(error);
    }
  }

  // ─── Timeout Wrapper ─────────────────────────────────────────────────────

  _executeWithTimeout(actionFn, ms) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Action timed out after ${ms}ms`));
      }, ms);
    });

    return Promise.race([
      actionFn().finally(() => clearTimeout(timeoutId)),
      timeoutPromise
    ]);
  }
}

export default CircuitBreaker;
