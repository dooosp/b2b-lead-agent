const fs = require('fs');
const path = require('path');

function resolveEnvFile({ appRoot = process.cwd() } = {}) {
  const configured = process.env.B2B_ENV_FILE;

  if (!configured) {
    return path.join(appRoot, '.env');
  }

  return path.isAbsolute(configured) ? configured : path.join(appRoot, configured);
}

function loadRuntimeEnv({ appRoot = process.cwd() } = {}) {
  const dotenvEnabled = !['0', 'false', 'no'].includes(String(process.env.B2B_LOAD_DOTENV || '').toLowerCase());

  if (!dotenvEnabled) {
    return { loaded: false, reason: 'disabled' };
  }

  const envFile = resolveEnvFile({ appRoot });
  if (!fs.existsSync(envFile)) {
    return { loaded: false, reason: 'missing', envFile };
  }

  require('dotenv').config({ path: envFile });
  return { loaded: true, envFile };
}

module.exports = {
  loadRuntimeEnv,
  resolveEnvFile,
};
