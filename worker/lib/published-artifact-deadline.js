export const PUBLISHED_ARTIFACT_DEFAULT_TIMEOUT_MS = 10_000;
export const PUBLISHED_ARTIFACT_TIMEOUT_CODE = 'ERR_PUBLISHED_ARTIFACT_TIMEOUT';

function timeoutBudget(value) {
  const milliseconds = typeof value === 'string' && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : value;
  if (
    !Number.isSafeInteger(milliseconds)
    || milliseconds < 1
    || milliseconds > PUBLISHED_ARTIFACT_DEFAULT_TIMEOUT_MS
  ) {
    throw Object.assign(new TypeError('Published artifact timeout must be an integer from 1 to 10000 ms'), {
      code: 'ERR_PUBLISHED_ARTIFACT_TIMEOUT_CONFIG',
      staleFallbackEligible: false,
    });
  }
  return milliseconds;
}

// Cancellation is best effort. Awaiting it would let a stuck upstream extend
// the deadline; attaching a rejection handler also covers late failures.
export function cancelPublishedArtifactStream(stream, reason) {
  try {
    Promise.resolve(stream?.cancel?.(reason)).catch(() => {});
  } catch {
    // The original read/validation/timeout error remains authoritative.
  }
}

/** One budget owned by the whole manifest + artifact transaction. */
export function createPublishedArtifactDeadline(timeoutMs = PUBLISHED_ARTIFACT_DEFAULT_TIMEOUT_MS) {
  const expiresAt = Date.now() + timeoutBudget(timeoutMs);
  const controller = new AbortController();
  const error = Object.assign(new Error('Published artifact request deadline exceeded'), {
    code: PUBLISHED_ARTIFACT_TIMEOUT_CODE,
    staleFallbackEligible: true,
  });
  const waiters = new Set();
  const expire = () => {
    if (controller.signal.aborted) return;
    for (const reject of waiters) reject(error);
    controller.abort(error);
  };
  const timer = setTimeout(expire, expiresAt - Date.now());
  const assertActive = () => {
    if (Date.now() >= expiresAt) expire();
    if (controller.signal.aborted) throw error;
  };
  return {
    signal: controller.signal,
    assertActive,
    async run(operation) {
      assertActive();
      let rejectExpired;
      const expired = new Promise((_resolve, reject) => { rejectExpired = reject; });
      waiters.add(rejectExpired);
      try {
        // Promise.race consumes late operation rejections even after expiry.
        const result = await Promise.race([Promise.resolve().then(operation), expired]);
        assertActive();
        return result;
      } finally {
        // A long sequence of small chunks must not retain completed waiters.
        waiters.delete(rejectExpired);
      }
    },
    dispose() { clearTimeout(timer); },
  };
}
