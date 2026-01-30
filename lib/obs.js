const crypto = require('crypto');

function createRun() {
  const runId = crypto.randomBytes(4).toString('hex');
  const counters = {};
  const timers = {};

  function log(stage, level, msg, extra = {}) {
    const entry = { ts: new Date().toISOString(), runId, stage, level, msg, ...extra };
    if (level === 'error' || level === 'warn') {
      console.error(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  function logError(stage, err, extra = {}) {
    log(stage, 'error', err.message, { errName: err.name, ...extra });
  }

  function time(stage) {
    const start = Date.now();
    timers[stage] = start;
    return {
      end() {
        const duration_ms = Date.now() - start;
        log(stage, 'info', `${stage} completed`, { duration_ms });
        return duration_ms;
      }
    };
  }

  function count(key, n = 1) {
    counters[key] = (counters[key] || 0) + n;
  }

  function summary() {
    log('pipeline', 'info', 'run completed', { counters });
  }

  return { runId, log, logError, time, count, summary };
}

module.exports = { createRun };
