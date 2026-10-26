// Coordinate publication preparation and commit while preserving the CommonJS API.
const path = require('path');
const {
  ARTIFACT_NAMES, PUBLICATION_SCHEMA_VERSION, PUBLICATION_RENDER_VERSION,
  PUBLICATION_ARTIFACT_KINDS, PUBLICATION_LATEST_MAX_RECORDS, PUBLICATION_HISTORY_MAX_RECORDS,
  PUBLICATION_JSON_MAX_BYTES, PUBLICATION_ENTRY_MAX_BYTES, normalizeProfileId, stableJsonValue, sha256,
} = require('./lib/publication/contract');
const {
  generateLeadId, normalizePublicationSources, prepareLeadSnapshotRecords, mergeLeadHistory,
  prepareValidatedLeadRecords, mergePreparedLeadHistory, semanticPublicationLead,
} = require('./lib/publication/lead-records');
const { composeLeadReport, escapeMarkdownText } = require('./lib/publication/report');
const { manifestRepositoryArtifactPaths, assertPublicationManifest } = require('./lib/publication/manifest');
const { buildPublicationArtifacts } = require('./lib/publication/artifacts');
const {
  DEFAULT_REPORTS_ROOT, saveLeadReport, saveLeadSnapshot, readLeadHistoryOrThrow,
  readCommittedPublication, findHistoricalRunManifest, repairPublicationCompatibilityMirrors,
  commitLeadPublication,
} = require('./lib/publication/store');

function prepareLeadPublication(qualifiedLeads, profile, options = {}) {
  const profileId = normalizeProfileId(profile);
  const reportsRoot = options.reportsRoot || DEFAULT_REPORTS_ROOT;
  const reportsDir = path.join(reportsRoot, profileId);
  const now = options.now || new Date().toISOString();
  const { validLeads, rejectedCount } = prepareValidatedLeadRecords(qualifiedLeads, {
    now,
    profileId,
    staleAfterDays: options.staleAfterDays,
    idFactory: options.idFactory || generateLeadId,
  });

  if (new Set(validLeads.map((lead) => lead.id)).size !== validLeads.length) {
    throw Object.assign(new Error('Published lead identities must be unique.'), {
      code: 'ERR_LEAD_PUBLICATION_DUPLICATE_ID',
    });
  }
  if (validLeads.length > PUBLICATION_LATEST_MAX_RECORDS) {
    throw Object.assign(new Error('Published latest-lead cardinality exceeds the consumer contract.'), {
      code: 'ERR_LEAD_PUBLICATION_LIMIT',
    });
  }

  if (validLeads.length === 0) {
    return {
      profileId,
      reportsDir,
      validLeads,
      rejectedCount,
      noChange: false,
      artifactCount: 0,
    };
  }

  const committed = readCommittedPublication(profile, { reportsRoot });
  const historyPath = path.join(reportsDir, ARTIFACT_NAMES.historyCanonical);
  const history = committed ? committed.history : readLeadHistoryOrThrow(historyPath);
  const orderedSemanticLeads = validLeads
    .map(semanticPublicationLead)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const inputDigest = sha256(Buffer.from(JSON.stringify(stableJsonValue({
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    renderVersion: PUBLICATION_RENDER_VERSION,
    profileId,
    leads: orderedSemanticLeads,
  })), 'utf8'));
  const runId = typeof options.runId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(options.runId)
    ? options.runId
    : `local-${inputDigest.slice(0, 32)}`;
  const historicalRunManifest = findHistoricalRunManifest(committed, runId);

  if (historicalRunManifest && historicalRunManifest.inputDigest !== inputDigest) {
    throw Object.assign(new Error('One run id cannot publish two different artifact sets.'), {
      code: 'ERR_RUN_ID_CONFLICT',
      stage: 'replay',
      retryable: false,
      safeMessage: 'Run identity conflicts with an existing publication.',
    });
  }

  if (
    historicalRunManifest
    && historicalRunManifest.publicationId !== committed.manifest.publicationId
  ) {
    return {
      profileId,
      reportsDir,
      validLeads,
      rejectedCount,
      noChange: true,
      sameRunReplay: true,
      historicalRunReplay: true,
      compatibilityIntact: true,
      publicationId: historicalRunManifest.publicationId,
      previousPublicationId: historicalRunManifest.previousPublicationId || null,
      inputDigest,
      manifest: historicalRunManifest,
      manifestPath: committed.manifestPath,
      artifactCount: PUBLICATION_ARTIFACT_KINDS.length,
      artifactPaths: [],
      repairArtifactPaths: [],
    };
  }

  if (committed && committed.manifest.inputDigest === inputDigest) {
    return {
      profileId,
      reportsDir,
      validLeads,
      rejectedCount,
      noChange: true,
      sameRunReplay: Boolean(historicalRunManifest),
      compatibilityIntact: committed.compatibilityIntact,
      publicationId: committed.manifest.publicationId,
      previousPublicationId: committed.manifest.previousPublicationId || null,
      inputDigest,
      manifest: committed.manifest,
      manifestPath: committed.manifestPath,
      artifactCount: PUBLICATION_ARTIFACT_KINDS.length,
      artifactPaths: [],
      repairArtifactPaths: manifestRepositoryArtifactPaths(profileId, committed.manifest),
    };
  }

  const {
    publicationId, previousPublicationId, manifest, manifestPayload, payloads, artifactPaths, report,
  } = buildPublicationArtifacts(validLeads, profile, {
    profileId, history, now, inputDigest, runId, previousManifest: committed ? committed.manifest : null,
  });

  return {
    profileId,
    reportsDir,
    validLeads,
    rejectedCount,
    noChange: false,
    compatibilityIntact: committed ? committed.compatibilityIntact : true,
    publicationId,
    previousPublicationId,
    inputDigest,
    manifest,
    manifestPayload,
    manifestPath: path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
    payloads,
    artifactCount: PUBLICATION_ARTIFACT_KINDS.length,
    artifactPaths,
    report,
  };
}

function publishLeadReport(leadReport, qualifiedLeads, profile, options = {}) {
  const prepared = prepareLeadPublication(qualifiedLeads, profile, {
    ...options,
    now: options.now || (leadReport && leadReport.now) || new Date().toISOString(),
  });
  if (prepared.validLeads.length === 0) {
    throw Object.assign(new Error('No valid leads were available for publication.'), {
      code: 'ERR_NO_VALID_LEADS',
    });
  }
  if (prepared.noChange) {
    if (!prepared.compatibilityIntact) repairPublicationCompatibilityMirrors(profile, options);
    return {
      reportsDir: prepared.reportsDir,
      manifestPath: prepared.manifestPath,
      publicationId: prepared.publicationId,
      inputDigest: prepared.inputDigest,
      artifactCount: prepared.artifactCount,
      artifactPaths: [],
      localCommitted: true,
      noChange: true,
    };
  }
  return { ...commitLeadPublication(prepared, profile, options), noChange: false };
}

const generateReport = composeLeadReport;
const saveReport = saveLeadReport;
const saveLeadsJson = saveLeadSnapshot;

module.exports = {
  generateReport,
  saveReport,
  saveLeadsJson,
  composeLeadReport,
  saveLeadReport,
  saveLeadSnapshot,
  publishLeadReport,
  prepareLeadPublication,
  commitLeadPublication,
  readCommittedPublication,
  repairPublicationCompatibilityMirrors,
  prepareValidatedLeadRecords,
  mergePreparedLeadHistory,
  assertPublicationManifest,
  ARTIFACT_NAMES,
  PUBLICATION_SCHEMA_VERSION,
  PUBLICATION_RENDER_VERSION,
  PUBLICATION_LATEST_MAX_RECORDS,
  PUBLICATION_HISTORY_MAX_RECORDS,
  PUBLICATION_JSON_MAX_BYTES,
  PUBLICATION_ENTRY_MAX_BYTES,
  mergeLeadHistory,
  prepareLeadSnapshotRecords,
  normalizePublicationSources,
  escapeMarkdownText,
};
