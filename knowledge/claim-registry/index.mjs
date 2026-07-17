import { createHash } from 'node:crypto';

export const CLAIM_SCHEMA_VERSION = 'evidence-claim-v1';
export const REGISTRY_SCHEMA_VERSION = 'evidence-claim-registry-v1';

export const CLAIM_TYPES = Object.freeze([
  'PROJECT_FACT',
  'PRODUCT_CAPABILITY',
  'TECHNICAL_REQUIREMENT',
  'PERFORMANCE',
  'ROI',
  'REGULATION',
  'CERTIFICATION',
  'REFERENCE_CASE',
  'COMPETITOR',
  'INSTALLED_BASE',
  'PROJECT_STAGE',
  'SPECIFICATION_WINDOW'
]);

export const CLAIM_STATUSES = Object.freeze([
  'UNVERIFIED',
  'ASSUMPTION',
  'VERIFIED',
  'CONFLICTED',
  'EXPIRED',
  'RETRACTED'
]);

export const CUSTOMER_USE_STATES = Object.freeze(['BLOCKED', 'REVIEW_ONLY', 'ALLOWED']);
export const CLAIM_VALUE_TYPES = Object.freeze(['BOOLEAN', 'ENUM', 'STRING', 'STRING_SET', 'QUANTITY', 'RANGE']);

export const CLAIM_LIMITS = Object.freeze({
  maxRegistryBytes: 2_000_000,
  maxClaims: 1_000,
  maxEvidencePerClaim: 5,
  maxStatementChars: 2_000,
  maxQuoteChars: 4_000,
  maxConditions: 20,
  maxAliases: 40,
  maxDepth: 12,
  maxStringChars: 12_000
});

const TRUSTED_ORIGINS = new Set(['REPOSITORY_REVIEWED', 'REPOSITORY_REVIEWED_SYNTHETIC']);
const SECRET_KEY = /(?:authorization|cookie|password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|manual[_-]?notes?|reviewer[_-]?feedback|generated[_-]?suggestion)/i;
const SAFE_SECURITY_METRIC_KEYS = new Set(['secretLeakage', 'unsafeSecretShaped']);
const SECRET_VALUE = /(?:bearer\s+[a-z0-9._~+\/-]{16,}|gh[oprsu]_[a-z0-9]{20,}|sk-[a-z0-9_-]{20,}|AIza[a-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|passwd|token|api[_-]?key|secret)\s*[:=]\s*[^\s]{8,})/i;
const BIDI_OR_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;
const VALIDATED_REGISTRIES = new WeakSet();

export class ClaimValidationError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'ClaimValidationError';
    this.code = code;
    this.path = path;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeText(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeQuote(value) {
  return typeof value === 'string' ? value.normalize('NFC').replace(/\r\n?/g, '\n').trim() : '';
}

function assertSafeStructure(value, path = '$', depth = 0) {
  if (depth > CLAIM_LIMITS.maxDepth) throw new ClaimValidationError('MAX_DEPTH_EXCEEDED', path);
  if (typeof value === 'string') {
    if (value.length > CLAIM_LIMITS.maxStringChars) throw new ClaimValidationError('STRING_TOO_LONG', path);
    if (BIDI_OR_CONTROL.test(value)) throw new ClaimValidationError('CONTROL_CHARACTER_REFUSED', path);
    if (SECRET_VALUE.test(value)) throw new ClaimValidationError('SECRET_SHAPED_VALUE', path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeStructure(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    if (!isPlainObject(value)) throw new ClaimValidationError('NON_PLAIN_OBJECT', path);
    for (const key of Object.keys(value)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new ClaimValidationError('PROTOTYPE_KEY_REFUSED', `${path}.${key}`);
      }
      if (SECRET_KEY.test(key) && !SAFE_SECURITY_METRIC_KEYS.has(key)) {
        throw new ClaimValidationError('PROTECTED_FIELD_REFUSED', `${path}.${key}`);
      }
      assertSafeStructure(value[key], `${path}.${key}`, depth + 1);
    }
  }
}

export function assertSafeArtifact(value, path = '$') {
  assertSafeStructure(value, path);
  return true;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareAscii)
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalStringify(value)).digest('hex');
}

function assertIsoTimestamp(value, path, { required = false } = {}) {
  if (!value) {
    if (required) throw new ClaimValidationError('DATE_REQUIRED', path);
    return '';
  }
  if (typeof value !== 'string') throw new ClaimValidationError('INVALID_DATE', path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ClaimValidationError('INVALID_DATE', path);
  }
  return value;
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || parts[0] === 0;
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const mappedIpv4 = (() => {
    if (!normalized.startsWith('::ffff:')) return '';
    const tail = normalized.slice('::ffff:'.length);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(tail)) return tail;
    const groups = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (!groups) return '';
    const high = Number.parseInt(groups[1], 16);
    const low = Number.parseInt(groups[2], 16);
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  })();
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
    || (mappedIpv4 !== '' && isPrivateIpv4(mappedIpv4));
}

export function normalizeEvidenceUrl(value, { synthetic = false, path = '$.sourceUrl' } = {}) {
  if (!value) return '';
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ClaimValidationError('MALFORMED_SOURCE_URL', path);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new ClaimValidationError('SOURCE_SCHEME_REFUSED', path);
  if (parsed.username || parsed.password) throw new ClaimValidationError('SOURCE_CREDENTIALS_REFUSED', path);
  if (parsed.hash) throw new ClaimValidationError('SOURCE_FRAGMENT_REFUSED', path);
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new ClaimValidationError('PRIVATE_SOURCE_URL_REFUSED', path);
  }
  if (hostname === 'synthetic.example' && !synthetic) throw new ClaimValidationError('SYNTHETIC_SOURCE_MODE_REQUIRED', path);
  for (const key of parsed.searchParams.keys()) {
    if (SECRET_KEY.test(key)) throw new ClaimValidationError('SOURCE_SECRET_QUERY_REFUSED', path);
  }
  parsed.searchParams.sort();
  parsed.hostname = hostname;
  return parsed.toString();
}

function normalizeSet(values, path, { allowEmpty = true } = {}) {
  if (!Array.isArray(values)) throw new ClaimValidationError('ARRAY_REQUIRED', path);
  const normalized = [...new Set(values.map((value, index) => {
    const text = normalizeText(value);
    if (!text) throw new ClaimValidationError('NONEMPTY_STRING_REQUIRED', `${path}[${index}]`);
    return text;
  }))].sort(compareAscii);
  if (!allowEmpty && normalized.length === 0) throw new ClaimValidationError('NONEMPTY_ARRAY_REQUIRED', path);
  return normalized;
}

function normalizeConditions(conditions = [], path) {
  if (!Array.isArray(conditions) || conditions.length > CLAIM_LIMITS.maxConditions) {
    throw new ClaimValidationError('INVALID_CONDITIONS', path);
  }
  return conditions.map((condition, index) => {
    if (!isPlainObject(condition)) throw new ClaimValidationError('INVALID_CONDITION', `${path}[${index}]`);
    const id = normalizeText(condition.id);
    const value = normalizeText(condition.value);
    if (!id || !value) throw new ClaimValidationError('INVALID_CONDITION', `${path}[${index}]`);
    return { id, value };
  }).sort((left, right) => compareAscii(`${left.id}\0${left.value}`, `${right.id}\0${right.value}`));
}

function normalizeValue(value = {}, path) {
  if (!isPlainObject(value)) throw new ClaimValidationError('INVALID_VALUE', path);
  const type = normalizeText(value.type);
  const key = normalizeText(value.key);
  if (!type || !key) throw new ClaimValidationError('VALUE_TYPE_AND_KEY_REQUIRED', path);
  if (!CLAIM_VALUE_TYPES.includes(type)) throw new ClaimValidationError('INVALID_VALUE_TYPE', `${path}.type`);
  const normalized = { type, key };
  for (const field of ['value', 'minimum', 'maximum']) {
    if (value[field] !== undefined) {
      if (typeof value[field] === 'number' && !Number.isFinite(value[field])) {
        throw new ClaimValidationError('NONFINITE_NUMBER', `${path}.${field}`);
      }
      normalized[field] = Array.isArray(value[field])
        ? normalizeSet(value[field], `${path}.${field}`)
        : typeof value[field] === 'string'
          ? normalizeText(value[field])
          : value[field];
    }
  }
  if (value.unit) normalized.unit = normalizeText(value.unit);
  if (value.quantityKind) normalized.quantityKind = normalizeText(value.quantityKind);
  if (type === 'BOOLEAN' && typeof normalized.value !== 'boolean') throw new ClaimValidationError('INVALID_BOOLEAN_VALUE', `${path}.value`);
  if ((type === 'ENUM' || type === 'STRING') && (typeof normalized.value !== 'string' || !normalized.value)) {
    throw new ClaimValidationError('INVALID_STRING_VALUE', `${path}.value`);
  }
  if (type === 'STRING_SET' && !Array.isArray(normalized.value)) throw new ClaimValidationError('INVALID_STRING_SET_VALUE', `${path}.value`);
  if (type === 'QUANTITY' && (!Number.isFinite(normalized.value) || !normalized.unit || !normalized.quantityKind)) {
    throw new ClaimValidationError('INVALID_QUANTITY_VALUE', path);
  }
  if (type === 'RANGE' && (!Number.isFinite(normalized.minimum) || !Number.isFinite(normalized.maximum) || normalized.minimum > normalized.maximum)) {
    throw new ClaimValidationError('INVALID_RANGE_VALUE', path);
  }
  return normalized;
}

function normalizeEvidence(evidence, claim, path) {
  if (!Array.isArray(evidence) || evidence.length > CLAIM_LIMITS.maxEvidencePerClaim) {
    throw new ClaimValidationError('INVALID_EVIDENCE_COUNT', path);
  }
  return evidence.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(item)) throw new ClaimValidationError('INVALID_EVIDENCE', itemPath);
    const sourceTitle = normalizeText(item.sourceTitle);
    const sourceUrl = normalizeEvidenceUrl(item.sourceUrl, { synthetic: claim.synthetic, path: `${itemPath}.sourceUrl` });
    const directQuote = normalizeQuote(item.directQuote);
    if (directQuote.length > CLAIM_LIMITS.maxQuoteChars) throw new ClaimValidationError('QUOTE_TOO_LONG', `${itemPath}.directQuote`);
    const normalized = {
      sourceTitle,
      sourceUrl,
      directQuote,
      publishedAt: assertIsoTimestamp(item.publishedAt, `${itemPath}.publishedAt`),
      effectiveAt: assertIsoTimestamp(item.effectiveAt, `${itemPath}.effectiveAt`),
      retrievedAt: assertIsoTimestamp(item.retrievedAt, `${itemPath}.retrievedAt`)
    };
    const expectedId = `ev_${sha256(normalized)}`;
    if (item.evidenceId && item.evidenceId !== expectedId) throw new ClaimValidationError('EVIDENCE_ID_MISMATCH', `${itemPath}.evidenceId`);
    return { evidenceId: expectedId, ...normalized };
  });
}

function computeClaimIdentityPayload(claim) {
  return {
    schemaVersion: claim.schemaVersion,
    claimType: claim.claimType,
    subject: claim.subject,
    statement: claim.statement,
    value: claim.value,
    applicability: claim.applicability,
    evidenceIds: claim.evidence.map((item) => item.evidenceId).sort(compareAscii)
  };
}

export function computeClaimId(claim) {
  return `clm_${sha256(computeClaimIdentityPayload(claim))}`;
}

function normalizeClaim(rawClaim, index) {
  const path = `$.claims[${index}]`;
  if (!isPlainObject(rawClaim)) throw new ClaimValidationError('INVALID_CLAIM', path);
  assertSafeStructure(rawClaim, path);
  const schemaVersion = normalizeText(rawClaim.schemaVersion || CLAIM_SCHEMA_VERSION);
  if (schemaVersion !== CLAIM_SCHEMA_VERSION) throw new ClaimValidationError('UNSUPPORTED_CLAIM_SCHEMA', `${path}.schemaVersion`);
  const claimType = normalizeText(rawClaim.claimType);
  if (!CLAIM_TYPES.includes(claimType)) throw new ClaimValidationError('INVALID_CLAIM_TYPE', `${path}.claimType`);
  if (!isPlainObject(rawClaim.subject)) throw new ClaimValidationError('INVALID_SUBJECT', `${path}.subject`);
  const subject = {
    type: normalizeText(rawClaim.subject.type),
    id: normalizeText(rawClaim.subject.id),
    displayName: normalizeText(rawClaim.subject.displayName)
  };
  if (!subject.type || !subject.id || !subject.displayName) throw new ClaimValidationError('SUBJECT_FIELDS_REQUIRED', `${path}.subject`);
  const statement = normalizeText(rawClaim.statement);
  if (!statement) throw new ClaimValidationError('STATEMENT_REQUIRED', `${path}.statement`);
  if (statement.length > CLAIM_LIMITS.maxStatementChars) throw new ClaimValidationError('STATEMENT_TOO_LONG', `${path}.statement`);
  const applicabilityInput = rawClaim.applicability || {};
  if (!isPlainObject(applicabilityInput)) throw new ClaimValidationError('INVALID_APPLICABILITY', `${path}.applicability`);
  const applicability = {
    verticalId: normalizeText(applicabilityInput.verticalId),
    productFamilyIds: normalizeSet(applicabilityInput.productFamilyIds || [], `${path}.applicability.productFamilyIds`),
    projectStages: normalizeSet(applicabilityInput.projectStages || [], `${path}.applicability.projectStages`),
    jurisdictions: normalizeSet(applicabilityInput.jurisdictions || [], `${path}.applicability.jurisdictions`),
    conditions: normalizeConditions(applicabilityInput.conditions || [], `${path}.applicability.conditions`)
  };
  if (!applicability.verticalId) throw new ClaimValidationError('VERTICAL_REQUIRED', `${path}.applicability.verticalId`);
  const synthetic = rawClaim.synthetic === true;
  const normalized = {
    schemaVersion,
    claimKey: normalizeText(rawClaim.claimKey),
    claimType,
    synthetic,
    subject,
    statement,
    value: normalizeValue(rawClaim.value, `${path}.value`),
    applicability,
    evidence: [],
    verification: {
      reviewed: rawClaim.verification?.reviewed === true,
      verifiedAt: assertIsoTimestamp(rawClaim.verification?.verifiedAt, `${path}.verification.verifiedAt`),
      validUntil: assertIsoTimestamp(rawClaim.verification?.validUntil, `${path}.verification.validUntil`),
      conflictClaimKeys: normalizeSet(rawClaim.verification?.conflictClaimKeys || [], `${path}.verification.conflictClaimKeys`),
      retracted: rawClaim.verification?.retracted === true,
      retractionReason: normalizeText(rawClaim.verification?.retractionReason)
    },
    provenance: {
      origin: normalizeText(rawClaim.provenance?.origin),
      profileId: normalizeText(rawClaim.provenance?.profileId),
      sourcePath: normalizeText(rawClaim.provenance?.sourcePath),
      sourceField: normalizeText(rawClaim.provenance?.sourceField)
    }
  };
  if (!normalized.provenance.origin || !normalized.provenance.sourcePath || !normalized.provenance.sourceField) {
    throw new ClaimValidationError('PROVENANCE_REQUIRED', `${path}.provenance`);
  }
  normalized.evidence = normalizeEvidence(rawClaim.evidence || [], normalized, `${path}.evidence`);
  normalized.claimId = computeClaimId(normalized);
  if (rawClaim.claimId && rawClaim.claimId !== normalized.claimId) throw new ClaimValidationError('CLAIM_ID_MISMATCH', `${path}.claimId`);
  return normalized;
}

function hasCompleteEvidence(claim) {
  return claim.evidence.length > 0 && claim.evidence.every((evidence) => (
    evidence.sourceTitle
    && evidence.sourceUrl
    && evidence.directQuote
    && evidence.publishedAt
    && evidence.retrievedAt
  ));
}

function validateClaimDates(claim, asOf) {
  const evidenceDates = claim.evidence.flatMap((evidence) => [evidence.publishedAt, evidence.effectiveAt, evidence.retrievedAt].filter(Boolean));
  const reviewDates = [claim.verification.verifiedAt, ...evidenceDates].filter(Boolean);
  if (reviewDates.some((date) => date > asOf)) throw new ClaimValidationError('FUTURE_EVIDENCE_DATE', `$.claims.${claim.claimKey || claim.claimId}`);
  for (const evidence of claim.evidence) {
    if (evidence.publishedAt && evidence.retrievedAt && evidence.publishedAt > evidence.retrievedAt) {
      throw new ClaimValidationError('EVIDENCE_CHRONOLOGY_INVALID', `$.claims.${claim.claimKey || claim.claimId}`);
    }
    if (evidence.retrievedAt && claim.verification.verifiedAt && evidence.retrievedAt > claim.verification.verifiedAt) {
      throw new ClaimValidationError('EVIDENCE_CHRONOLOGY_INVALID', `$.claims.${claim.claimKey || claim.claimId}`);
    }
  }
}

function deriveStatus(claim, asOf) {
  if (claim.verification.retracted) return 'RETRACTED';
  if (claim.verification.conflictClaimKeys.length > 0) return 'CONFLICTED';
  if (claim.verification.validUntil && asOf >= claim.verification.validUntil) return 'EXPIRED';
  if (claim.provenance.origin === 'ASSUMPTION') return 'ASSUMPTION';
  if (!TRUSTED_ORIGINS.has(claim.provenance.origin)) return 'UNVERIFIED';
  if (!claim.verification.reviewed || !claim.verification.verifiedAt || !hasCompleteEvidence(claim)) return 'UNVERIFIED';
  return 'VERIFIED';
}

function applicabilityMatches(claim, context) {
  const applicability = claim.applicability;
  if (!context || claim.synthetic !== (context.synthetic === true)) return false;
  if (!context.verticalId || context.verticalId !== applicability.verticalId) return false;
  if (applicability.jurisdictions.length === 0 || !context.jurisdiction || !applicability.jurisdictions.includes(context.jurisdiction)) return false;
  if (applicability.productFamilyIds.length > 0) {
    if (!context.productFamilyId || !applicability.productFamilyIds.includes(context.productFamilyId)) return false;
  }
  if (applicability.projectStages.length > 0) {
    if (!context.projectStage || !applicability.projectStages.includes(context.projectStage)) return false;
  }
  const contextConditions = context.conditions || {};
  return applicability.conditions.every((condition) => contextConditions[condition.id] === condition.value);
}

export function deriveCustomerUse(claim, context) {
  if (claim.status !== 'VERIFIED') return { state: 'BLOCKED', reasonCodes: [`CLAIM_${claim.status}`] };
  if (!applicabilityMatches(claim, context)) return { state: 'BLOCKED', reasonCodes: ['CLAIM_NOT_APPLICABLE'] };
  if (!hasCompleteEvidence(claim)) return { state: 'BLOCKED', reasonCodes: ['CLAIM_EVIDENCE_INCOMPLETE'] };
  return { state: 'ALLOWED', reasonCodes: [] };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

class ReadonlyMap extends Map {
  constructor(entries = []) {
    super();
    for (const [key, value] of entries) Map.prototype.set.call(this, key, value);
  }

  set() {
    throw new TypeError('Validated claim registry indexes are read-only.');
  }

  delete() {
    throw new TypeError('Validated claim registry indexes are read-only.');
  }

  clear() {
    throw new TypeError('Validated claim registry indexes are read-only.');
  }
}

export function createValidatedClaimRegistry(rawRegistry, { asOf } = {}) {
  const normalizedAsOf = assertIsoTimestamp(asOf, '$.asOf', { required: true });
  assertSafeStructure(rawRegistry);
  const serializedBytes = Buffer.byteLength(JSON.stringify(rawRegistry), 'utf8');
  if (serializedBytes > CLAIM_LIMITS.maxRegistryBytes) throw new ClaimValidationError('REGISTRY_TOO_LARGE');
  const claimsInput = Array.isArray(rawRegistry) ? rawRegistry : rawRegistry?.claims;
  if (!Array.isArray(claimsInput)) throw new ClaimValidationError('REGISTRY_CLAIMS_REQUIRED', '$.claims');
  if (claimsInput.length > CLAIM_LIMITS.maxClaims) throw new ClaimValidationError('TOO_MANY_CLAIMS', '$.claims');
  const claims = claimsInput.map(normalizeClaim);
  const byId = new Map();
  const byKey = new Map();
  for (const claim of claims) {
    if (byId.has(claim.claimId)) throw new ClaimValidationError('DUPLICATE_CLAIM_ID', `$.claims.${claim.claimId}`);
    byId.set(claim.claimId, claim);
    if (claim.claimKey) {
      if (byKey.has(claim.claimKey)) throw new ClaimValidationError('DUPLICATE_CLAIM_KEY', `$.claims.${claim.claimKey}`);
      byKey.set(claim.claimKey, claim);
    }
  }
  for (const claim of claims) {
    for (const conflictKey of claim.verification.conflictClaimKeys) {
      const target = byKey.get(conflictKey);
      if (!target) throw new ClaimValidationError('UNKNOWN_CONFLICT_CLAIM', `$.claims.${claim.claimKey}.verification.conflictClaimKeys`);
      if (!claim.claimKey || !target.verification.conflictClaimKeys.includes(claim.claimKey)) {
        throw new ClaimValidationError('ASYMMETRIC_CONFLICT_CLAIM', `$.claims.${claim.claimKey || claim.claimId}.verification.conflictClaimKeys`);
      }
    }
  }
  const materialized = claims.map((claim) => {
    const conflictClaimIds = claim.verification.conflictClaimKeys.map((key) => {
      const target = byKey.get(key);
      if (!target) throw new ClaimValidationError('UNKNOWN_CONFLICT_CLAIM', `$.claims.${claim.claimKey}.verification.conflictClaimKeys`);
      return target.claimId;
    }).sort(compareAscii);
    validateClaimDates(claim, normalizedAsOf);
    return {
      ...claim,
      verification: { ...claim.verification, conflictClaimIds },
      status: deriveStatus(claim, normalizedAsOf)
    };
  }).sort((left, right) => compareAscii(left.claimId, right.claimId));
  const registry = {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    asOf: normalizedAsOf,
    claims: materialized,
    byId: new ReadonlyMap(materialized.map((claim) => [claim.claimId, claim])),
    byKey: new ReadonlyMap(materialized.filter((claim) => claim.claimKey).map((claim) => [claim.claimKey, claim]))
  };
  const frozenRegistry = deepFreeze(registry);
  VALIDATED_REGISTRIES.add(frozenRegistry);
  return frozenRegistry;
}

export function assertValidatedClaimRegistry(registry, path = '$.registry') {
  if (!registry || !VALIDATED_REGISTRIES.has(registry)) {
    throw new ClaimValidationError('UNVALIDATED_REGISTRY', path);
  }
  return registry;
}

export function projectTrustedReferences(registry, context) {
  assertValidatedClaimRegistry(registry);
  return registry.claims
    .filter((claim) => claim.claimType === 'REFERENCE_CASE')
    .map((claim) => ({ claim, customerUse: deriveCustomerUse(claim, context) }))
    .filter(({ customerUse }) => customerUse.state === 'ALLOWED')
    .map(({ claim }) => ({
      claimId: claim.claimId,
      statement: claim.statement,
      sourceTitle: claim.evidence[0].sourceTitle,
      sourceUrl: claim.evidence[0].sourceUrl,
      directQuote: claim.evidence[0].directQuote,
      verifiedAt: claim.verification.verifiedAt,
      provenanceProfileId: claim.provenance.profileId,
      applicability: claim.applicability
    }))
    .sort((left, right) => compareAscii(left.claimId, right.claimId));
}

export function auditLegacyInventory(inventory) {
  if (!isPlainObject(inventory) || !Array.isArray(inventory.candidates)) {
    throw new ClaimValidationError('INVALID_LEGACY_INVENTORY');
  }
  assertSafeStructure(inventory);
  const violations = [];
  const candidateIds = new Map();
  for (const candidate of inventory.candidates) {
    if (candidateIds.has(candidate.candidateId)) violations.push({ candidateId: candidate.candidateId, reasonCode: 'DUPLICATE_CANDIDATE_ID' });
    candidateIds.set(candidate.candidateId, candidate);
    if (candidate.currentTrustClassification === 'VERIFIED' && !candidate.sourceAvailability) {
      violations.push({ candidateId: candidate.candidateId, reasonCode: 'LEGACY_UNSOURCED_VERIFIED' });
    }
    if (candidate.derivedCustomerUse === 'ALLOWED' && candidate.currentTrustClassification !== 'VERIFIED') {
      violations.push({ candidateId: candidate.candidateId, reasonCode: 'UNVERIFIED_CUSTOMER_USE_ALLOWED' });
    }
  }
  return {
    totalClaimCandidates: inventory.candidates.length,
    verified: inventory.candidates.filter((candidate) => candidate.currentTrustClassification === 'VERIFIED').length,
    unverified: inventory.candidates.filter((candidate) => candidate.currentTrustClassification === 'UNVERIFIED').length,
    assumption: inventory.candidates.filter((candidate) => candidate.currentTrustClassification === 'ASSUMPTION').length,
    missingSource: inventory.candidates.filter((candidate) => !candidate.sourceAvailability).length,
    missingQuote: inventory.candidates.filter((candidate) => !candidate.directQuoteAvailability).length,
    missingVerificationDate: inventory.candidates.filter((candidate) => !candidate.verificationDateAvailability).length,
    customerUseBlocked: inventory.candidates.filter((candidate) => candidate.derivedCustomerUse === 'BLOCKED').length,
    unsafeSecretShaped: 0,
    duplicateCount: violations.filter((violation) => violation.reasonCode === 'DUPLICATE_CANDIDATE_ID').length,
    violations: violations.sort((left, right) => compareAscii(`${left.candidateId}:${left.reasonCode}`, `${right.candidateId}:${right.reasonCode}`))
  };
}

export function renderMarkdownCell(value) {
  return normalizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/\\/g, '\\\\')
    .replace(/([`*_[\]()!|])/g, '\\$1')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
