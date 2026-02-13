/**
 * withRetry — 외부 호출 재시도 래퍼 + timeout
 */
async function withRetry(fn, opts = {}) {
  const { retries = 1, baseDelay = 1000, timeout = 30000, label = '' } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`timeout ${timeout}ms`)), timeout)
        )
      ]);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const jitter = Math.random() * 500;
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        console.warn(`[retry] ${label} attempt ${attempt + 1} failed: ${err.message}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

module.exports = { withRetry };
