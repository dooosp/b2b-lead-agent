// Manifest shape, artifact integrity descriptors and repository path contracts.
const path = require('path');
const {
  ARTIFACT_NAMES, LEGACY_PUBLICATION_SCHEMA_VERSION, PUBLICATION_SCHEMA_VERSION,
  PUBLICATION_RENDER_VERSION, PUBLICATION_ARTIFACT_KINDS,
  normalizeProfileId, isValidIsoTimestamp, sha256,
} = require('./contract');
function artifactDescriptor(kind, relativePath, canonicalPath, payload, records = null) {
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  return {
    kind,
    path: relativePath,
    canonicalPath,
    sha256: sha256(buffer),
    bytes: buffer.byteLength,
    ...(Number.isSafeInteger(records) ? { records } : {}),
  };
}

function manifestRepositoryArtifactPaths(profileId, manifest) {
  const repositoryPrefix = `reports/${profileId}`;
  return [
    `${repositoryPrefix}/${ARTIFACT_NAMES.manifestCanonical}`,
    ...(manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION
      ? [`${repositoryPrefix}/publications/${manifest.publicationId}/${ARTIFACT_NAMES.manifestCanonical}`]
      : []),
    ...PUBLICATION_ARTIFACT_KINDS.map((kind) => `${repositoryPrefix}/${manifest.artifacts[kind].path}`),
    ...PUBLICATION_ARTIFACT_KINDS.map((kind) => `${repositoryPrefix}/${manifest.artifacts[kind].canonicalPath}`),
  ];
}

function assertSafePublicationRelativePath(relativePath, publicationId) {
  if (
    typeof relativePath !== 'string'
    || relativePath.includes('\\')
    || path.posix.isAbsolute(relativePath)
    || path.posix.normalize(relativePath) !== relativePath
    || relativePath.includes('..')
    || !relativePath.startsWith(`publications/${publicationId}/`)
  ) {
    throw Object.assign(new Error('Publication manifest path is invalid.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  return relativePath;
}

function assertPublicationManifest(manifest, profile) {
  const profileId = normalizeProfileId(profile);
  const schemaVersion = manifest && manifest.schemaVersion;
  const expectedTopLevelKeys = schemaVersion === LEGACY_PUBLICATION_SCHEMA_VERSION
    ? [
        'artifacts',
        'counts',
        'generatedAt',
        'inputDigest',
        'previousPublicationId',
        'profileId',
        'publicationId',
        'renderVersion',
        'reportDate',
        'schemaVersion',
      ]
    : [
        'artifacts',
        'counts',
        'generatedAt',
        'inputDigest',
        'previousManifestSchemaVersion',
        'previousPublicationId',
        'profileId',
        'publicationId',
        'renderVersion',
        'reportDate',
        'runId',
        'schemaVersion',
      ];
  const topLevelKeys = manifest && typeof manifest === 'object'
    ? Object.keys(manifest).sort()
    : [];
  if (
    !manifest
    || ![LEGACY_PUBLICATION_SCHEMA_VERSION, PUBLICATION_SCHEMA_VERSION].includes(schemaVersion)
    || JSON.stringify(topLevelKeys) !== JSON.stringify(expectedTopLevelKeys)
    || manifest.renderVersion !== PUBLICATION_RENDER_VERSION
    || manifest.profileId !== profileId
    || !/^pub-[a-f0-9]{32}$/.test(manifest.publicationId || '')
    || !(manifest.previousPublicationId === null || /^pub-[a-f0-9]{32}$/.test(manifest.previousPublicationId || ''))
    || (
      schemaVersion === PUBLICATION_SCHEMA_VERSION
      && !(
        (manifest.previousPublicationId === null && manifest.previousManifestSchemaVersion === null)
        || (
          manifest.previousPublicationId !== null
          && [LEGACY_PUBLICATION_SCHEMA_VERSION, PUBLICATION_SCHEMA_VERSION]
            .includes(manifest.previousManifestSchemaVersion)
        )
      )
    )
    || (schemaVersion === PUBLICATION_SCHEMA_VERSION && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(manifest.runId || ''))
    || !/^[a-f0-9]{64}$/.test(manifest.inputDigest || '')
    || !isValidIsoTimestamp(manifest.generatedAt)
    || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.reportDate || '')
    || !manifest.counts
    || JSON.stringify(Object.keys(manifest.counts).sort()) !== JSON.stringify(['artifacts', 'history', 'leads'])
    || !Number.isSafeInteger(manifest.counts.leads)
    || !Number.isSafeInteger(manifest.counts.history)
    || manifest.counts.leads < 0
    || manifest.counts.history < 0
    || manifest.counts.artifacts !== PUBLICATION_ARTIFACT_KINDS.length
    || !manifest.artifacts
    || typeof manifest.artifacts !== 'object'
    || JSON.stringify(Object.keys(manifest.artifacts).sort()) !== JSON.stringify([...PUBLICATION_ARTIFACT_KINDS].sort())
  ) {
    throw Object.assign(new Error('Publication manifest is invalid.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  for (const kind of PUBLICATION_ARTIFACT_KINDS) {
    const artifact = manifest.artifacts[kind];
    const expectedArtifactKeys = kind === 'report'
      ? ['bytes', 'canonicalPath', 'kind', 'path', 'sha256']
      : ['bytes', 'canonicalPath', 'kind', 'path', 'records', 'sha256'];
    if (
      !artifact
      || JSON.stringify(Object.keys(artifact).sort()) !== JSON.stringify(expectedArtifactKeys)
      || artifact.kind !== kind
      || !/^[a-f0-9]{64}$/.test(artifact.sha256 || '')
      || !Number.isSafeInteger(artifact.bytes)
      || artifact.bytes < 0
      || artifact.bytes > 20 * 1024 * 1024
      || (kind !== 'report' && (!Number.isSafeInteger(artifact.records) || artifact.records < 0))
    ) {
      throw Object.assign(new Error('Publication manifest artifact is invalid.'), {
        code: 'ERR_PUBLICATION_MANIFEST_INVALID',
      });
    }
    assertSafePublicationRelativePath(artifact.path, manifest.publicationId);
  }
  if (
    manifest.artifacts.latest.canonicalPath !== ARTIFACT_NAMES.latestCanonical
    || manifest.artifacts.history.canonicalPath !== ARTIFACT_NAMES.historyCanonical
    || manifest.artifacts.report.canonicalPath !== ARTIFACT_NAMES.markdownCanonical(manifest.reportDate)
    || manifest.artifacts.latest.records !== manifest.counts.leads
    || manifest.artifacts.history.records !== manifest.counts.history
    || PUBLICATION_ARTIFACT_KINDS.some((kind) => (
      manifest.artifacts[kind].path
      !== `publications/${manifest.publicationId}/${manifest.artifacts[kind].canonicalPath}`
    ))
  ) {
    throw Object.assign(new Error('Publication manifest canonical paths are invalid.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  const artifactPaths = PUBLICATION_ARTIFACT_KINDS.map((kind) => manifest.artifacts[kind].path);
  if (new Set(artifactPaths).size !== artifactPaths.length) {
    throw Object.assign(new Error('Publication manifest artifact paths are duplicated.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  return manifest;
}

module.exports = {
  artifactDescriptor,
  manifestRepositoryArtifactPaths,
  assertPublicationManifest,
};
