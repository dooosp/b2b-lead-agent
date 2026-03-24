const { createGcsArchiveAdapterFromEnv } = require('./gcs-archive');
const { createFirestoreLeadMirrorAdapterFromEnv } = require('./firestore-lead-mirror');

function createStorageLogger(logger = console) {
  return {
    info(message) {
      (logger.log || logger.info || console.log)(message);
    },
    warn(message) {
      (logger.warn || console.warn)(message);
    },
  };
}

function resolveStorageConfig(options = {}) {
  const storage = options.storage && typeof options.storage === 'object' ? options.storage : {};
  const env = storage.env || process.env;

  return {
    adapters: Array.isArray(storage.adapters) ? storage.adapters.filter(Boolean) : null,
    strict: storage.strict === true || env.LEAD_STORAGE_STRICT === '1',
    env,
  };
}

function buildStorageAdapters(config) {
  if (config.adapters) {
    return config.adapters;
  }

  const adapters = [];
  const gcsAdapter = createGcsArchiveAdapterFromEnv({ env: config.env });
  if (gcsAdapter) {
    adapters.push(gcsAdapter);
  }

  const firestoreAdapter = createFirestoreLeadMirrorAdapterFromEnv({ env: config.env });
  if (firestoreAdapter) {
    adapters.push(firestoreAdapter);
  }

  return adapters;
}

async function publishStorageMirrors(context, options = {}) {
  const logger = createStorageLogger(options.logger);
  const config = resolveStorageConfig(options);
  const adapters = buildStorageAdapters(config);

  if (adapters.length === 0) {
    return [];
  }

  const results = [];
  for (const adapter of adapters) {
    try {
      await adapter.publish(context);
      results.push({ name: adapter.name || 'unknown', ok: true });
    } catch (error) {
      if (config.strict) {
        throw error;
      }

      logger.warn(
        `  [Role 5] storage mirror skipped after ${adapter.name || 'unknown'} failure: ${error.message}`
      );
      results.push({ name: adapter.name || 'unknown', ok: false, error });
    }
  }

  return results;
}

module.exports = {
  publishStorageMirrors,
};
