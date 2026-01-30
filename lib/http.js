/**
 * withRetry — 외부 호출 재시도 래퍼 + timeout 강제
 * @param {Function} fn - 실행할 async 함수
 * @param {Object} opts - { retries, baseDelay, timeout, label }
 */
async function withRetry(fn, opts = {}) {
  const { retries = 1, baseDelay = 1000, timeout = 30000, label = '' } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`timeout ${timeout}ms`)), timeout)
        )
      ]);
      return result;
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
