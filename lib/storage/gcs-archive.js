const fs = require('fs/promises');
const { assertGoogleCredentialsFileExists } = require('./google-auth-preflight');

function requireStorageSdk() {
  try {
    return require('@google-cloud/storage');
  } catch (error) {
    const sdkError = new Error(
      'GCS archive is enabled but @google-cloud/storage is not installed. Add the package before enabling LEAD_STORAGE_GCS_BUCKET.'
    );
    sdkError.cause = error;
    throw sdkError;
  }
}

function normalizeObjectPath(prefix, remotePath) {
  const segments = [prefix || '', remotePath || '']
    .join('/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.join('/');
}

function createGcsArchiveAdapter(config = {}) {
  const bucketName = typeof config.bucketName === 'string' ? config.bucketName.trim() : '';
  if (!bucketName) {
    return null;
  }

  return {
    name: 'gcs-archive',
    async publish(context) {
      assertGoogleCredentialsFileExists();
      const { Storage } = requireStorageSdk();
      const storage = config.client || new Storage(config.clientOptions);
      const bucket = storage.bucket(bucketName);

      for (const artifact of context.artifacts) {
        const objectPath = normalizeObjectPath(config.objectPrefix, artifact.remotePath);
        const contents = await fs.readFile(artifact.localPath);

        await bucket.file(objectPath).save(contents, {
          resumable: false,
          contentType: artifact.contentType,
          metadata: {
            metadata: {
              profileId: context.profile.id,
              artifactKind: artifact.kind,
              localPath: artifact.localPath,
            },
          },
        });
      }
    },
  };
}

function createGcsArchiveAdapterFromEnv(options = {}) {
  const env = options.env || process.env;
  const bucketName = typeof env.LEAD_STORAGE_GCS_BUCKET === 'string'
    ? env.LEAD_STORAGE_GCS_BUCKET.trim()
    : '';

  if (!bucketName) {
    return null;
  }

  return createGcsArchiveAdapter({
    bucketName,
    objectPrefix: env.LEAD_STORAGE_GCS_PREFIX || '',
  });
}

module.exports = {
  createGcsArchiveAdapter,
  createGcsArchiveAdapterFromEnv,
};
