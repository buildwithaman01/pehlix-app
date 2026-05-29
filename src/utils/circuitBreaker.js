/**
 * Stateful Circuit Breaker implementation for robust fallback and fault tolerance.
 * Prevents queue piling, socket leakages, and serverless freezes on external service failures.
 */
export class CircuitBreaker {
  /**
   * @param {Object} options
   * @param {number} [options.failureThreshold=5] - Consecutive failures before opening breaker
   * @param {number} [options.cooldownMs=30000] - Duration in ms to stay open before half-open retry
   * @param {number} [options.timeoutMs=3000] - Action timeout in ms
   * @param {string} [options.name='General'] - Name of the circuit breaker for logging
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownMs = options.cooldownMs || 30000;
    this.timeoutMs = options.timeoutMs || 3000;
    this.name = options.name || 'General';

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.consecutiveFailures = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * Executes the action function inside the circuit breaker wrapper.
   * If the breaker is open, immediately invokes the fallback function.
   * Enforces a timeout on the action function.
   * @param {Function} actionFn - Async function to run
   * @param {Function} fallbackFn - Fallback function to invoke on breaker open or action failure
   * @returns {Promise<any>}
   */
  async execute(actionFn, fallbackFn) {
    const now = Date.now();

    // 1. Handle OPEN state & cooldown checks
    if (this.state === 'OPEN') {
      if (now >= this.nextAttemptTime) {
        console.log(`[CircuitBreaker: ${this.name}] Cooldown expired. Transitioning from OPEN to HALF_OPEN.`);
        this.state = 'HALF_OPEN';
      } else {
        console.warn(`[CircuitBreaker: ${this.name}] Breaker is OPEN. Executing fast fallback.`);
        return fallbackFn(new Error('Circuit breaker is open.'));
      }
    }

    // 2. Execute Action with Promise Timeout
    try {
      const result = await this.executeWithTimeout(actionFn, this.timeoutMs);
      
      // Success hook
      if (this.state === 'HALF_OPEN') {
        console.log(`[CircuitBreaker: ${this.name}] Probe request succeeded. Transitioning from HALF_OPEN to CLOSED.`);
        this.state = 'CLOSED';
      }
      this.consecutiveFailures = 0;
      return result;
    } catch (error) {
      // Failure hook
      this.consecutiveFailures++;
      console.error(`[CircuitBreaker: ${this.name}] Execution failure count: ${this.consecutiveFailures}. Error:`, error.message);

      if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
        console.warn(`[CircuitBreaker: ${this.name}] Failure threshold reached. Transitioning to OPEN for ${this.cooldownMs / 1000}s.`);
        this.state = 'OPEN';
        this.nextAttemptTime = Date.now() + this.cooldownMs;
      }

      return fallbackFn(error);
    }
  }

  /**
   * Helper to wrap a promise action with a timeout.
   */
  executeWithTimeout(actionFn, ms) {
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
