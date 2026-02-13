/**
 * withRetry — exponential backoff + jitter + timeout
 * Based on b2b-lead-agent pattern (best implementation)
 *
 * @param {Function} fn - async function to execute
 * @param {Object} opts
 * @param {number} opts.retries - max retry count (default: 2)
 * @param {number} opts.baseDelay - base delay in ms (default: 1000)
 * @param {number} opts.timeout - timeout per attempt in ms (default: 30000)
 * @param {string} opts.label - label for logging
 */
async function withRetry(fn, opts = {}) {
  const { retries = 2, baseDelay = 1000, timeout = 30000, label = 'LLM' } = opts;
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
        )
      ]);
      return result;
    } catch (err) {
      lastErr = err;

      // Don't retry on auth errors
      if (err.message?.includes('API_KEY') || err.status === 401 || err.status === 403) {
        throw err;
      }

      if (attempt < retries) {
        const jitter = Math.random() * 500;
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        console.warn(`[${label}] Attempt ${attempt + 1} failed: ${err.message}. Retry in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

module.exports = { withRetry };
