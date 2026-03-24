const fs = require('fs');
const path = require('path');

function assertGoogleCredentialsFileExists(env = process.env) {
  const credentialPath = typeof env.GOOGLE_APPLICATION_CREDENTIALS === 'string'
    ? env.GOOGLE_APPLICATION_CREDENTIALS.trim()
    : '';

  if (!credentialPath) {
    return;
  }

  const resolvedPath = path.resolve(credentialPath);
  let stats;

  try {
    stats = fs.statSync(resolvedPath);
  } catch (error) {
    throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file is missing: ${resolvedPath}`);
  }

  if (!stats.isFile()) {
    throw new Error(`GOOGLE_APPLICATION_CREDENTIALS is not a file: ${resolvedPath}`);
  }
}

module.exports = {
  assertGoogleCredentialsFileExists,
};
