export const REVIEW_PACKET_SCHEMA_VERSION = 'pursuit-review-packet-v0';
export const REVIEW_POLICY_SCHEMA_VERSION = 'pursuit-review-disposition-policy-v0';
export const REVIEW_ACKNOWLEDGEMENT_POLICY_ID = 'synthetic-technical-review-nonclaims-v0';
export const REVIEW_ACKNOWLEDGEMENT_TEXT = 'This packet records a synthetic technical-review disposition only. It is not a final commercial decision, CRM update, customer send, outreach approval, deployment, or production action. Pricing, availability, delivery, budget, procurement access, competitive position, and win probability were not evaluated.';

export const REVIEW_DISPOSITIONS = Object.freeze([
  'READY_FOR_TECHNICAL_REVIEW',
  'HOLD_FOR_PROJECT_EVIDENCE',
  'HOLD_FOR_PRODUCT_EVIDENCE',
  'HOLD_FOR_TECHNICAL_REQUIREMENTS',
  'DEFER_FOR_PROJECT_STAGE',
  'REJECT_TECHNICAL_MISMATCH',
  'ESCALATE_DOMAIN_EXPERT'
]);

export const REVIEW_PACKET_LIMITS = Object.freeze({
  maxBytes: 32 * 1024,
  maxIdLength: 128,
  maxReasonCodes: 16,
  maxQuestionIds: 100
});

const SELECTION_KEYS = new Set(['productFamilyId', 'disposition', 'reasonCodes', 'selectedQuestionIds', 'acknowledgedNonClaims']);

export class PursuitReviewValidationError extends Error {
  constructor(code, path) {
    super(`${code} at ${path}`);
    this.name = 'PursuitReviewValidationError';
    this.code = code;
    this.path = path;
  }
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;
  const output = {};
  for (const key of Object.keys(value).sort(compareAscii)) output[key] = canonicalize(value[key]);
  return output;
}

export function canonicalReviewJson(value) {
  return JSON.stringify(canonicalize(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function assertId(value, path) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_:-]{1,128}$/.test(value)) {
    throw new PursuitReviewValidationError('REVIEW_ID_INVALID', path);
  }
  return value;
}

function normalizeIds(value, path, maximum) {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string')) {
    throw new PursuitReviewValidationError('REVIEW_ID_LIST_INVALID', path);
  }
  value.forEach((item, index) => assertId(item, `${path}[${index}]`));
  if (new Set(value).size !== value.length) throw new PursuitReviewValidationError('REVIEW_ID_LIST_DUPLICATE', path);
  return [...value].sort(compareAscii);
}

export function validateReviewSelection(viewModel, selection) {
  if (!isPlainObject(viewModel)
    || viewModel.schemaVersion !== 'datacenter-pursuit-workbench-v0'
    || viewModel.boundary !== 'NOT_PRODUCTION_EVIDENCE'
    || viewModel.productionReady !== false
    || viewModel.productionReviewerWorkflowReady !== false
    || viewModel.issue165Status !== 'HOLD'
    || viewModel.synthetic !== true
    || viewModel.reviewPolicy?.schemaVersion !== REVIEW_POLICY_SCHEMA_VERSION) {
    throw new PursuitReviewValidationError('REVIEW_VIEW_MODEL_INVALID', '$.viewModel');
  }
  if (!isPlainObject(selection)) throw new PursuitReviewValidationError('REVIEW_SELECTION_INVALID', '$.selection');
  for (const key of Object.keys(selection)) {
    if (!SELECTION_KEYS.has(key)) throw new PursuitReviewValidationError('REVIEW_SELECTION_FIELD_REFUSED', `$.selection.${key}`);
  }
  if (Object.keys(selection).length !== SELECTION_KEYS.size) throw new PursuitReviewValidationError('REVIEW_SELECTION_INCOMPLETE', '$.selection');
  const productFamilyId = assertId(selection.productFamilyId, '$.selection.productFamilyId');
  if (!REVIEW_DISPOSITIONS.includes(selection.disposition)) throw new PursuitReviewValidationError('REVIEW_DISPOSITION_UNKNOWN', '$.selection.disposition');
  const familyPolicy = viewModel.reviewPolicy.families.find((family) => family.productFamilyId === productFamilyId);
  if (!familyPolicy) throw new PursuitReviewValidationError('REVIEW_PRODUCT_FAMILY_UNKNOWN', '$.selection.productFamilyId');
  const dispositionPolicy = familyPolicy.dispositions.find((item) => item.value === selection.disposition);
  if (!dispositionPolicy?.supported) throw new PursuitReviewValidationError('REVIEW_DISPOSITION_UNSUPPORTED', '$.selection.disposition');
  const reasonCodes = normalizeIds(selection.reasonCodes, '$.selection.reasonCodes', REVIEW_PACKET_LIMITS.maxReasonCodes);
  if (reasonCodes.length === 0) throw new PursuitReviewValidationError('REVIEW_REASON_REQUIRED', '$.selection.reasonCodes');
  if (reasonCodes.some((code) => !dispositionPolicy.reasonCodes.includes(code))) {
    throw new PursuitReviewValidationError('REVIEW_REASON_UNSUPPORTED', '$.selection.reasonCodes');
  }
  const selectedQuestionIds = normalizeIds(selection.selectedQuestionIds, '$.selection.selectedQuestionIds', REVIEW_PACKET_LIMITS.maxQuestionIds);
  if (selectedQuestionIds.some((id) => !familyPolicy.questionIds.includes(id))) {
    throw new PursuitReviewValidationError('REVIEW_QUESTION_UNSUPPORTED', '$.selection.selectedQuestionIds');
  }
  if (selection.acknowledgedNonClaims !== true) throw new PursuitReviewValidationError('REVIEW_ACKNOWLEDGEMENT_REQUIRED', '$.selection.acknowledgedNonClaims');
  return deepFreeze({ productFamilyId, disposition: selection.disposition, reasonCodes, selectedQuestionIds, acknowledgedNonClaims: true });
}

async function defaultSha256(value) {
  if (!globalThis.crypto?.subtle) throw new PursuitReviewValidationError('REVIEW_HASH_UNAVAILABLE', '$.packetId');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeClockValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new PursuitReviewValidationError('REVIEW_CLOCK_INVALID', '$.createdAt');
  return date.toISOString();
}

export async function buildPursuitReviewPacket(viewModel, selection, { clock = () => new Date(), hash = defaultSha256 } = {}) {
  const normalized = validateReviewSelection(viewModel, selection);
  const hashes = viewModel.artifactHashes;
  const requiredHashKeys = ['dossierJsonSha256', 'dossierMarkdownSha256', 'timelineSha256'];
  if (!isPlainObject(hashes)
    || Object.keys(hashes).length !== requiredHashKeys.length
    || requiredHashKeys.some((key) => !Object.hasOwn(hashes, key) || !/^[a-f0-9]{64}$/.test(hashes[key]))) {
    throw new PursuitReviewValidationError('REVIEW_ARTIFACT_HASH_INVALID', '$.viewModel.artifactHashes');
  }
  const packetWithoutId = {
    schemaVersion: REVIEW_PACKET_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    persistence: 'NONE',
    reviewerIdentity: 'NOT_COLLECTED',
    packetIntegrity: 'UNSIGNED_LOCAL_PACKET',
    createdAt: normalizeClockValue(clock()),
    scenarioId: assertId(viewModel.scenario.id, '$.viewModel.scenario.id'),
    opportunityId: assertId(viewModel.project.opportunityId, '$.viewModel.project.opportunityId'),
    productFamilyId: normalized.productFamilyId,
    artifactHashes: {
      dossierJsonSha256: hashes.dossierJsonSha256,
      dossierMarkdownSha256: hashes.dossierMarkdownSha256,
      timelineSha256: hashes.timelineSha256
    },
    disposition: normalized.disposition,
    reasonCodes: normalized.reasonCodes,
    selectedQuestionIds: normalized.selectedQuestionIds,
    acknowledgement: { policyId: REVIEW_ACKNOWLEDGEMENT_POLICY_ID, accepted: true }
  };
  const digest = await hash(canonicalReviewJson(packetWithoutId));
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new PursuitReviewValidationError('REVIEW_HASH_INVALID', '$.packetId');
  const packet = canonicalize({ ...packetWithoutId, packetId: `prv0_${digest}` });
  if (new TextEncoder().encode(canonicalReviewJson(packet)).byteLength > REVIEW_PACKET_LIMITS.maxBytes) {
    throw new PursuitReviewValidationError('REVIEW_PACKET_TOO_LARGE', '$.packet');
  }
  return deepFreeze(packet);
}

export function serializePursuitReviewPacket(packet) {
  const serialized = `${JSON.stringify(canonicalize(packet), null, 2)}\n`;
  if (new TextEncoder().encode(serialized).byteLength > REVIEW_PACKET_LIMITS.maxBytes) {
    throw new PursuitReviewValidationError('REVIEW_PACKET_TOO_LARGE', '$.packet');
  }
  return serialized;
}

export function pursuitReviewPacketFilename(packet) {
  const scenarioId = assertId(packet?.scenarioId, '$.packet.scenarioId').toLowerCase();
  const packetId = typeof packet?.packetId === 'string' ? packet.packetId : '';
  if (!/^prv0_[a-f0-9]{64}$/.test(packetId)) throw new PursuitReviewValidationError('REVIEW_PACKET_ID_INVALID', '$.packet.packetId');
  return `pursuit-review-${scenarioId}-${packetId.slice(5, 17)}.json`;
}
