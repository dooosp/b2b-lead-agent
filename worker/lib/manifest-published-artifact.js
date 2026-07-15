import {
  parseBoundedPublishedArtifactJson,
  readBoundedPublishedArtifactJson,
  readBoundedResponseBytes,
} from './published-artifact-json.js';

const PUBLICATION_MANIFEST_MAX_BYTES = 64 * 1024;
const PUBLICATION_DESCRIPTOR_MAX_BYTES = 20 * 1024 * 1024;
const PUBLICATION_ARTIFACT_KINDS = Object.freeze(['report', 'latest', 'history']);
const FETCH_OPTIONS = Object.freeze({
  headers: {
    'User-Agent': 'B2B-Lead-Worker',
    'Cache-Control': 'no-cache',
  },
});

function publicationUrl(env, profileId, relativePath) {
  return `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/`
    + `${encodeURIComponent(profileId)}/${relativePath}?t=${Date.now()}`;
}

function manifestError(message) {
  return Object.assign(new Error(message), { code: 'ERR_PUBLISHED_MANIFEST_INVALID' });
}

function upstreamStatusError(message, status) {
  return Object.assign(new Error(message), {
    code: 'ERR_PUBLISHED_MANIFEST_UPSTREAM',
    status,
    staleFallbackEligible: status >= 500 && status <= 599,
  });
}

function assertExactKeys(value, keys) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function assertSafeImmutablePath(relativePath, publicationId) {
  if (
    typeof relativePath !== 'string'
    || relativePath.includes('\\')
    || relativePath.startsWith('/')
    || relativePath.includes('..')
    || !relativePath.startsWith(`publications/${publicationId}/`)
  ) {
    throw manifestError('Published manifest artifact path is invalid');
  }
}

function assertPublishedManifest(manifest, profileId) {
  const schemaVersion = manifest?.schemaVersion;
  const topLevelKeys = schemaVersion === 1
    ? [
        'artifacts', 'counts', 'generatedAt', 'inputDigest', 'previousPublicationId',
        'profileId', 'publicationId', 'renderVersion', 'reportDate', 'schemaVersion',
      ]
    : [
        'artifacts', 'counts', 'generatedAt', 'inputDigest', 'previousManifestSchemaVersion',
        'previousPublicationId', 'profileId', 'publicationId', 'renderVersion', 'reportDate',
        'runId', 'schemaVersion',
      ];
  if (
    ![1, 2].includes(schemaVersion)
    || !assertExactKeys(manifest, topLevelKeys)
    || manifest.renderVersion !== 1
    || manifest.profileId !== profileId
    || !/^pub-[a-f0-9]{32}$/.test(manifest.publicationId || '')
    || !(manifest.previousPublicationId === null
      || /^pub-[a-f0-9]{32}$/.test(manifest.previousPublicationId || ''))
    || !/^[a-f0-9]{64}$/.test(manifest.inputDigest || '')
    || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.reportDate || '')
    || typeof manifest.generatedAt !== 'string'
    || !Number.isFinite(Date.parse(manifest.generatedAt))
    || new Date(manifest.generatedAt).toISOString() !== manifest.generatedAt
    || !assertExactKeys(manifest.counts, ['artifacts', 'history', 'leads'])
    || manifest.counts.artifacts !== 3
    || !Number.isSafeInteger(manifest.counts.leads)
    || manifest.counts.leads < 0
    || !Number.isSafeInteger(manifest.counts.history)
    || manifest.counts.history < 0
    || !assertExactKeys(manifest.artifacts, PUBLICATION_ARTIFACT_KINDS)
    || (schemaVersion === 2 && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(manifest.runId || ''))
    || (
      schemaVersion === 2
      && !(
        (manifest.previousPublicationId === null && manifest.previousManifestSchemaVersion === null)
        || (
          manifest.previousPublicationId !== null
          && [1, 2].includes(manifest.previousManifestSchemaVersion)
        )
      )
    )
  ) {
    throw manifestError('Published manifest schema is invalid');
  }
  for (const kind of PUBLICATION_ARTIFACT_KINDS) {
    const descriptor = manifest.artifacts[kind];
    const descriptorKeys = kind === 'report'
      ? ['bytes', 'canonicalPath', 'kind', 'path', 'sha256']
      : ['bytes', 'canonicalPath', 'kind', 'path', 'records', 'sha256'];
    if (
      !assertExactKeys(descriptor, descriptorKeys)
      || descriptor.kind !== kind
      || !/^[a-f0-9]{64}$/.test(descriptor.sha256 || '')
      || !Number.isSafeInteger(descriptor.bytes)
      || descriptor.bytes < 0
      || descriptor.bytes > PUBLICATION_DESCRIPTOR_MAX_BYTES
      || (kind !== 'report' && (!Number.isSafeInteger(descriptor.records) || descriptor.records < 0))
    ) {
      throw manifestError('Published manifest artifact descriptor is invalid');
    }
    assertSafeImmutablePath(descriptor.path, manifest.publicationId);
  }
  if (
    manifest.artifacts.latest.canonicalPath !== 'latest-leads.json'
    || manifest.artifacts.history.canonicalPath !== 'lead-history.json'
    || manifest.artifacts.report.canonicalPath !== `lead-report-${manifest.reportDate}.md`
    || PUBLICATION_ARTIFACT_KINDS.some((kind) => (
      manifest.artifacts[kind].path
      !== `publications/${manifest.publicationId}/${manifest.artifacts[kind].canonicalPath}`
    ))
  ) {
    throw manifestError('Published manifest canonical paths are invalid');
  }
  const immutablePaths = PUBLICATION_ARTIFACT_KINDS.map((kind) => manifest.artifacts[kind].path);
  if (
    new Set(immutablePaths).size !== immutablePaths.length
    || manifest.artifacts.latest.records !== manifest.counts.leads
    || manifest.artifacts.history.records !== manifest.counts.history
  ) {
    throw manifestError('Published manifest artifact counts or paths are inconsistent');
  }
  return manifest;
}

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function readManifest(response, profileId) {
  let bytes;
  try {
    bytes = await readBoundedResponseBytes(response, { maxBytes: PUBLICATION_MANIFEST_MAX_BYTES });
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return assertPublishedManifest(JSON.parse(text), profileId);
  } catch (error) {
    if (error?.code === 'ERR_PUBLISHED_MANIFEST_INVALID') throw error;
    throw manifestError('Published manifest body is invalid');
  }
}

export async function fetchManifestSelectedArtifactJson(
  env,
  profileId,
  artifactKind,
  canonicalFilename,
  { maxTopLevelEntries } = {},
) {
  const manifestResponse = await fetch(
    publicationUrl(env, profileId, 'publication-manifest.json'),
    FETCH_OPTIONS,
  );
  if (manifestResponse.status === 404) {
    const legacyResponse = await fetch(
      publicationUrl(env, profileId, canonicalFilename),
      FETCH_OPTIONS,
    );
    return {
      response: legacyResponse,
      payload: legacyResponse.ok
        ? await readBoundedPublishedArtifactJson(legacyResponse, { maxTopLevelEntries })
        : null,
      manifest: null,
    };
  }
  if (!manifestResponse.ok) {
    throw upstreamStatusError(
      `Published manifest fetch failed with status ${manifestResponse.status}`,
      manifestResponse.status,
    );
  }

  const manifest = await readManifest(manifestResponse, profileId);
  const descriptor = manifest.artifacts[artifactKind];
  if (!descriptor || descriptor.canonicalPath !== canonicalFilename) {
    throw manifestError('Published manifest does not select the requested artifact');
  }
  const artifactResponse = await fetch(
    publicationUrl(env, profileId, descriptor.path),
    FETCH_OPTIONS,
  );
  if (!artifactResponse.ok) {
    throw upstreamStatusError(
      `Published manifest-selected artifact fetch failed with status ${artifactResponse.status}`,
      artifactResponse.status,
    );
  }
  const bytes = await readBoundedResponseBytes(artifactResponse);
  if (bytes.byteLength !== descriptor.bytes || await sha256Hex(bytes) !== descriptor.sha256) {
    throw manifestError('Published manifest-selected artifact checksum failed');
  }
  const payload = parseBoundedPublishedArtifactJson(bytes, { maxTopLevelEntries });
  if (artifactKind !== 'report' && payload.length !== descriptor.records) {
    throw manifestError('Published manifest-selected artifact cardinality failed');
  }
  return { response: artifactResponse, payload, manifest };
}

export { assertPublishedManifest };
