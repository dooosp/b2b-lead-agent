// Shared publication wire-format constants and deterministic scalar helpers.
const crypto = require('crypto');
const ARTIFACT_NAMES = {
  markdownCanonical: (dateStr) => `lead-report-${dateStr}.md`,
  latestCanonical: 'latest-leads.json',
  historyCanonical: 'lead-history.json',
  manifestCanonical: 'publication-manifest.json',
};

const LEGACY_PUBLICATION_SCHEMA_VERSION = 1;
const PUBLICATION_SCHEMA_VERSION = 2;
const PUBLICATION_RENDER_VERSION = 1;
const PUBLICATION_ARTIFACT_KINDS = Object.freeze(['report', 'latest', 'history']);
const PUBLICATION_LATEST_MAX_RECORDS = 90;
const PUBLICATION_HISTORY_MAX_RECORDS = 500;
const PUBLICATION_JSON_MAX_BYTES = 8_000_000;
const PUBLICATION_ENTRY_MAX_BYTES = 1_900_000;
const PUBLICATION_LEAD_ID_MAX_BYTES = 256;
const PUBLICATION_LOCK_NAME = '.publication-lock';

function normalizeSnapshotText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProfileId(profile) {
  const profileId = normalizeSnapshotText(profile && profile.id);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(profileId)) {
    throw Object.assign(new Error('Publication profile id is invalid.'), {
      code: 'ERR_PUBLICATION_PROFILE_INVALID',
    });
  }
  return profileId;
}

function isValidIsoTimestamp(value) {
  const normalized = normalizeSnapshotText(value);
  return normalized && Number.isFinite(Date.parse(normalized)) ? normalized : '';
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])])
  );
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = {
  ARTIFACT_NAMES,
  LEGACY_PUBLICATION_SCHEMA_VERSION,
  PUBLICATION_SCHEMA_VERSION,
  PUBLICATION_RENDER_VERSION,
  PUBLICATION_ARTIFACT_KINDS,
  PUBLICATION_LATEST_MAX_RECORDS,
  PUBLICATION_HISTORY_MAX_RECORDS,
  PUBLICATION_JSON_MAX_BYTES,
  PUBLICATION_ENTRY_MAX_BYTES,
  PUBLICATION_LEAD_ID_MAX_BYTES,
  PUBLICATION_LOCK_NAME,
  normalizeSnapshotText,
  normalizeProfileId,
  isValidIsoTimestamp,
  stableJsonValue,
  sha256,
};
