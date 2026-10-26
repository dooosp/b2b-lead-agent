// Build immutable publication bytes from validated records and explicit history.
const {
  ARTIFACT_NAMES, PUBLICATION_SCHEMA_VERSION, PUBLICATION_RENDER_VERSION,
  PUBLICATION_ARTIFACT_KINDS, PUBLICATION_HISTORY_MAX_RECORDS,
  PUBLICATION_ENTRY_MAX_BYTES, PUBLICATION_JSON_MAX_BYTES, sha256,
} = require('./contract');
const { mergePreparedLeadHistory } = require('./lead-records');
const { composeLeadReport } = require('./report');
const { artifactDescriptor, assertPublicationManifest, manifestRepositoryArtifactPaths } = require('./manifest');

function buildPublicationArtifacts(validLeads, profile, {
  profileId, history, now, inputDigest, runId, previousManifest = null,
}) {
  const previousPublicationId = previousManifest ? previousManifest.publicationId : null;
  const previousManifestSchemaVersion = previousManifest ? previousManifest.schemaVersion : null;
  const mergedHistory = mergePreparedLeadHistory(history, validLeads, { now });
  if (new Set(mergedHistory.map((lead) => lead.id)).size !== mergedHistory.length) {
    throw Object.assign(new Error('Published history lead identities must be unique.'), {
      code: 'ERR_LEAD_PUBLICATION_DUPLICATE_ID',
    });
  }
  if (mergedHistory.length > PUBLICATION_HISTORY_MAX_RECORDS) {
    throw Object.assign(new Error('Published lead history exceeds the consumer contract.'), {
      code: 'ERR_LEAD_PUBLICATION_LIMIT',
    });
  }
  if (
    [...validLeads, ...mergedHistory]
      .some((lead) => Buffer.byteLength(JSON.stringify(lead), 'utf8') > PUBLICATION_ENTRY_MAX_BYTES)
  ) {
    throw Object.assign(new Error('Published lead bytes exceed the consumer entry contract.'), {
      code: 'ERR_LEAD_PUBLICATION_LIMIT',
    });
  }
  const report = composeLeadReport(validLeads, profile, { now });
  const payloads = {
    report: Buffer.from(report.content, 'utf8'),
    latest: Buffer.from(JSON.stringify(validLeads, null, 2), 'utf8'),
    history: Buffer.from(JSON.stringify(mergedHistory, null, 2), 'utf8'),
  };
  if (['latest', 'history'].some((kind) => payloads[kind].byteLength > PUBLICATION_JSON_MAX_BYTES)) {
    throw Object.assign(new Error('Published JSON bytes exceed the consumer contract.'), {
      code: 'ERR_LEAD_PUBLICATION_LIMIT',
    });
  }
  // Bind the immutable generation name to the exact bytes and manifest inputs.
  // A hard exit after the generation rename but before the pointer commit can
  // otherwise leave an orphan with the same logical-input id but different
  // timestamp-derived bytes, permanently blocking a later retry.
  const publicationId = `pub-${sha256(Buffer.from(JSON.stringify({
    profileId,
    inputDigest,
    previousPublicationId,
    previousManifestSchemaVersion,
    renderVersion: PUBLICATION_RENDER_VERSION,
    runId,
    generatedAt: now,
    reportDate: report.dateStr,
    artifacts: Object.fromEntries(PUBLICATION_ARTIFACT_KINDS.map((kind) => [kind, {
      bytes: payloads[kind].byteLength,
      sha256: sha256(payloads[kind]),
    }])),
  }), 'utf8')).slice(0, 32)}`;
  const generationPrefix = `publications/${publicationId}`;
  const artifacts = {
    report: artifactDescriptor(
      'report',
      `${generationPrefix}/${ARTIFACT_NAMES.markdownCanonical(report.dateStr)}`,
      ARTIFACT_NAMES.markdownCanonical(report.dateStr),
      payloads.report,
    ),
    latest: artifactDescriptor(
      'latest',
      `${generationPrefix}/${ARTIFACT_NAMES.latestCanonical}`,
      ARTIFACT_NAMES.latestCanonical,
      payloads.latest,
      validLeads.length,
    ),
    history: artifactDescriptor(
      'history',
      `${generationPrefix}/${ARTIFACT_NAMES.historyCanonical}`,
      ARTIFACT_NAMES.historyCanonical,
      payloads.history,
      mergedHistory.length,
    ),
  };
  const manifest = {
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    renderVersion: PUBLICATION_RENDER_VERSION,
    profileId,
    runId,
    publicationId,
    previousPublicationId,
    previousManifestSchemaVersion,
    inputDigest,
    generatedAt: now,
    reportDate: report.dateStr,
    counts: {
      leads: validLeads.length,
      history: mergedHistory.length,
      artifacts: PUBLICATION_ARTIFACT_KINDS.length,
    },
    artifacts,
  };
  assertPublicationManifest(manifest, profile);
  const manifestPayload = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const artifactPaths = manifestRepositoryArtifactPaths(profileId, manifest);

  return {
    publicationId,
    previousPublicationId,
    manifest,
    manifestPayload,
    payloads,
    artifactPaths,
    report,
  };
}

module.exports = {
  buildPublicationArtifacts,
};
