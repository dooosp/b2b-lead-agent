import {
  assertSafeArtifact,
  canonicalStringify,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import { validatePageEvidenceAnchor } from './evidence-anchor.mjs';

export const CANDIDATE_SCHEMA_VERSION = 'evidence-claim-candidate-v0';
export const WORKBENCH_VERTICAL = 'datacenter';
export const WORKBENCH_DOMAIN = 'electrical_power';
export const WORKBENCH_JURISDICTION = 'KR';
export const PRODUCT_FAMILIES = Object.freeze([
  'medium_voltage_switchgear',
  'transformer'
]);
export const SUPPORTED_CLAIM_TYPES = Object.freeze([
  'PRODUCT_CAPABILITY',
  'PERFORMANCE',
  'CERTIFICATION',
  'TECHNICAL_REQUIREMENT'
]);
export const SUPPORTED_VALUE_TYPES = Object.freeze([
  'QUANTITY',
  'RANGE',
  'ENUM',
  'STRING_SET'
]);
export const PROJECT_STAGES = Object.freeze([
  'UNKNOWN',
  'SIGNAL',
  'ANNOUNCED',
  'FEASIBILITY',
  'BASIC_DESIGN',
  'DETAILED_DESIGN',
  'SPECIFICATION',
  'TENDER',
  'AWARD',
  'CONSTRUCTION',
  'COMMISSIONING',
  'OPERATION',
  'RETROFIT',
  'CANCELLED'
]);

export const EXTRACTION_METHODS = Object.freeze([
  'DETERMINISTIC_RULE',
  'MANUAL_EXACT_QUOTE'
]);

export const EXTRACTION_REASON_CODES = Object.freeze([
  'EXACT_LABEL_VALUE_MATCH',
  'EXPLICIT_CERTIFICATION_TOKEN',
  'EXPLICIT_PROTOCOL_TOKEN',
  'EXPLICIT_ENUM_TOKEN',
  'EXPLICIT_NORMATIVE_CUE',
  'EXPLICIT_LIMITATION_OR_EXCLUSION',
  'HUMAN_SELECTED_EXACT_EVIDENCE',
  'CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW'
]);

export const CONDITION_IDS = Object.freeze([
  'altitude',
  'ambient_temperature',
  'configuration',
  'cooling_method',
  'frequency',
  'installation',
  'installation_condition',
  'insulation_medium',
  'operating_condition',
  'product_variant',
  'standard_edition'
]);

const FAMILY_DISPLAY_NAMES = Object.freeze({
  medium_voltage_switchgear: 'Medium-voltage Switchgear',
  transformer: 'Transformer'
});

const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'candidateId',
  'synthetic',
  'documentId',
  'evidenceAnchorId',
  'claimType',
  'subject',
  'statement',
  'value',
  'applicability',
  'validity',
  'extractionMethod',
  'extractionRuleId',
  'extractionReasons',
  'reviewState'
]);

const FORBIDDEN_AUTHORITY_KEY = /^(?:status|verification|verified|verifiedAt|customerUse|customerUseAllowed|allowed|finalFit|fitResult|commercialApproval|productionApproved|legallyApproved|claimId|confidence|modelConfidence|reviewerIdentity|reviewerLabel|reviewerName|reviewerEmail|userId|recipient|freeform|notes?|customer|customerData|privateData)$/i;
const FORBIDDEN_AUTHORITY_VALUE = /(?:^|[^A-Z0-9])(?:(?:VERIFIED|ALLOWED|CUSTOMER_USE_ALLOWED|PRODUCTION_APPROVED|LEGALLY_APPROVED|COMMERCIAL_APPROVED|PRODUCTION[-_\s]+READY)(?=$|[^A-Z0-9])|(?:CUSTOMER[-_\s]+USE|COMMERCIAL(?:LY)?|LEGAL(?:LY)?|PRODUCTION)\s+(?:IS\s+)?(?:APPROVED|ALLOWED|PERMITTED|AUTHORI[ZS]ED)\b|(?:APPROVED|ALLOWED|PERMITTED|AUTHORI[ZS]ED)\s+FOR\s+(?:CUSTOMER[-_\s]+USE|COMMERCIAL|LEGAL|PRODUCTION)\b|(?:COMMERCIAL|LEGAL|PRODUCTION)\s+APPROVAL\s+(?:GRANTED|GIVEN|CONFIRMED)\b|(?:고객\s*사용|고객용|상업적?|법적?|법률|프로덕션)\s*(?:승인|허용))/iu;
const UNSAFE_TEXT = /(?:[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]|bearer\s+[a-z0-9._~+\/-]{16,}|gh[oprsu]_[a-z0-9]{20,}|sk-[a-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|passwd|token|api[_-]?key|secret)\s*[:=]\s*[^\s]{8,})/iu;
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const NEGATED_EVIDENCE_CUE = /(?:\b(?:does|do|did|is|are|was|were|shall|must|can)\s+not\b|\b(?:doesn['’]t|don['’]t|didn['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|can['’]t)\b|\bcannot\b|\bno\s+longer\b|\b(?:not|never)\s+(?:support(?:ed|s|ing)?|conform(?:s|ed|ing)?|compl(?:y|ies|ied|ying)|certif(?:y|ies|ied|ication)|suitable|permit(?:ted|s)?|allow(?:ed|s)?|meet(?:s|ing)?|IEC|KS|Modbus|DNP|BACnet|SNMP)\b|:\s*(?:no|n\s*\/\s*a|x|disabled|pending)\b|\bno\s+(?:support|certification)\b|\bhas\s+no\b|\bfail(?:s|ed|ing)?\s+to\s+(?:support|conform|comply|certify|meet)\b|\b(?:support|certification)\s+(?:is\s+)?(?:unavailable|absent|disabled|suspended|invalid|pending|planned|expected)\b|\b(?:has|have|had|was|were|is|are)\s+(?:been\s+)?(?:disabled|deactivated|suspended|deprecated|lapsed|ceased|revoked|withdrawn|expired|removed|discontinued|terminated)\b|\b(?:under\s+(?:review|development)|on\s+the\s+roadmap|future\s+release|applying\s+for|application\s+(?:was\s+)?submitted|certification\s+target|pending\s+confirmation)\b|\b(?:proposed|planned|target|expected)\s+(?:rated\s+)?(?:voltage|current|power|capacity|temperature|capability|certification|support)\b|\b(?:will|would|may|might)\s+be\s+supported\b|\b(?:unsupported|uncertified|non[-\s]?(?:compliant|conforming|certified)|revoked|withdrawn|expired|removed|disabled|deactivated|suspended|deprecated|lapsed|ceased|invalid|discontinued|terminated|obsolete|lack(?:s|ed|ing)?|without|exclude(?:s|d)?|excluding)\b|(?:지원|준수|적합|인증|허용)\s*(?:하지\s*않|되지\s*않|안\s*(?:됨|함)|없(?:음|다)|만료|취소|철회|종료|중단|정지|해제|폐기|무효|대기|예정|계획|개발\s*중|심사\s*중|신청|:\s*(?:X|없음|대기|예정))|(?:예상|목표|제안|계획)\s*(?:정격\s*)?(?:전압|전류|용량|성능|인증|지원)|미지원|비지원|미인증|제외|불가|아님)/iu;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const SAFE_RULE_ID = /^OECRW0-[A-Z0-9-]{3,80}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const CAPABILITY_TAXONOMY = Object.freeze({
  medium_voltage_switchgear: Object.freeze({
    rated_voltage: { types: ['QUANTITY'], quantityKind: 'voltage', units: ['V', 'kV'] },
    rated_current: { types: ['QUANTITY'], quantityKind: 'current', units: ['A', 'kA'] },
    short_circuit_rating: { types: ['QUANTITY'], quantityKind: 'current', units: ['A', 'kA'] },
    frequency: { types: ['QUANTITY'], quantityKind: 'frequency', units: ['Hz'] },
    insulation_medium: { types: ['ENUM'] },
    indoor_outdoor_use: { types: ['STRING_SET'] },
    ingress_protection: { types: ['ENUM'] },
    ambient_temperature: { types: ['RANGE'], quantityKind: 'temperature', units: ['degC'] },
    altitude: { types: ['QUANTITY'], quantityKind: 'length', units: ['m'] },
    applicable_standard: { types: ['STRING_SET'] },
    certification: { types: ['STRING_SET'] },
    communication_protocol: { types: ['STRING_SET'] },
    installation_condition: { types: ['STRING_SET'] }
  }),
  transformer: Object.freeze({
    transformer_capacity: { types: ['QUANTITY'], quantityKind: 'apparent_power', units: ['VA', 'kVA', 'MVA'] },
    primary_voltage: { types: ['QUANTITY'], quantityKind: 'voltage', units: ['V', 'kV'] },
    secondary_voltage: { types: ['QUANTITY'], quantityKind: 'voltage', units: ['V', 'kV'] },
    frequency: { types: ['QUANTITY'], quantityKind: 'frequency', units: ['Hz'] },
    vector_group: { types: ['ENUM'] },
    cooling_method: { types: ['ENUM'] },
    efficiency_class: { types: ['ENUM'] },
    ambient_temperature: { types: ['RANGE'], quantityKind: 'temperature', units: ['degC'] },
    altitude: { types: ['QUANTITY'], quantityKind: 'length', units: ['m'] },
    applicable_standard: { types: ['STRING_SET'] },
    certification: { types: ['STRING_SET'] },
    communication_protocol: { types: ['STRING_SET'] },
    installation_condition: { types: ['STRING_SET'] }
  })
});

export { CAPABILITY_TAXONOMY };

export class CandidateValidationError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'CandidateValidationError';
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

function assertExactKeys(value, allowed, path) {
  if (!isPlainObject(value)) throw new CandidateValidationError('OBJECT_REQUIRED', path);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new CandidateValidationError('UNKNOWN_FIELD_REFUSED', `${path}.${key}`);
  }
}

function assertNoAuthorityFields(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoAuthorityFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
      if (FORBIDDEN_AUTHORITY_VALUE.test(normalized)) {
        throw new CandidateValidationError('AUTHORITY_VALUE_REFUSED', path);
      }
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_AUTHORITY_KEY.test(key)) {
      throw new CandidateValidationError('AUTHORITY_FIELD_REFUSED', `${path}.${key}`);
    }
    assertNoAuthorityFields(child, `${path}.${key}`);
  }
}

function normalizeText(value, path, { max = 1_000, allowEmpty = false, piiSafe = true } = {}) {
  if (typeof value !== 'string') throw new CandidateValidationError('STRING_REQUIRED', path);
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!allowEmpty && !normalized) throw new CandidateValidationError('NONEMPTY_STRING_REQUIRED', path);
  if (normalized.length > max) throw new CandidateValidationError('STRING_TOO_LONG', path);
  if (UNSAFE_TEXT.test(normalized)) throw new CandidateValidationError('UNSAFE_TEXT_REFUSED', path);
  if (piiSafe && EMAIL_ADDRESS.test(normalized)) throw new CandidateValidationError('IDENTITY_OR_PRIVATE_TEXT_REFUSED', path);
  return normalized;
}

function normalizeId(value, path) {
  const normalized = normalizeText(value, path, { max: 128, piiSafe: true });
  if (!SAFE_ID.test(normalized)) throw new CandidateValidationError('INVALID_ID', path);
  return normalized;
}

function normalizeSet(values, path, allowed) {
  if (!Array.isArray(values)) throw new CandidateValidationError('ARRAY_REQUIRED', path);
  const normalized = [...new Set(values.map((value, index) => normalizeText(value, `${path}[${index}]`, { max: 120 })))].sort(compareAscii);
  if (allowed && normalized.some((value) => !allowed.includes(value))) {
    throw new CandidateValidationError('UNSUPPORTED_SET_VALUE', path);
  }
  return normalized;
}

function normalizeIsoTimestamp(value, path) {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) throw new CandidateValidationError('INVALID_DATE', path);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new CandidateValidationError('INVALID_DATE', path);
  return value;
}

function normalizeUnit(value) {
  const compact = String(value ?? '').normalize('NFKC').replace(/\s+/gu, '');
  const aliases = new Map([
    ['kv', 'kV'], ['v', 'V'], ['ka', 'kA'], ['a', 'A'], ['hz', 'Hz'],
    ['va', 'VA'], ['kva', 'kVA'], ['mva', 'MVA'], ['m', 'm'],
    ['°c', 'degC'], ['℃', 'degC'], ['degc', 'degC']
  ]);
  return aliases.get(compact.toLowerCase()) || compact;
}

export function normalizeCandidateValue(rawValue, productFamily, path = '$.value') {
  assertExactKeys(rawValue, new Set(['type', 'key', 'value', 'minimum', 'maximum', 'unit', 'quantityKind']), path);
  const type = normalizeText(rawValue.type, `${path}.type`, { max: 32 });
  const key = normalizeText(rawValue.key, `${path}.key`, { max: 80 });
  if (!SUPPORTED_VALUE_TYPES.includes(type)) throw new CandidateValidationError('UNSUPPORTED_VALUE_TYPE', `${path}.type`);
  const taxonomy = CAPABILITY_TAXONOMY[productFamily]?.[key];
  if (!taxonomy) throw new CandidateValidationError('UNSUPPORTED_CAPABILITY_KEY', `${path}.key`);
  if (!taxonomy.types.includes(type)) throw new CandidateValidationError('CAPABILITY_VALUE_TYPE_MISMATCH', `${path}.type`);

  if (type === 'QUANTITY') {
    if (!Number.isFinite(rawValue.value)) throw new CandidateValidationError('FINITE_NUMBER_REQUIRED', `${path}.value`);
    const unit = normalizeUnit(rawValue.unit);
    const quantityKind = normalizeText(rawValue.quantityKind, `${path}.quantityKind`, { max: 40 });
    if (!taxonomy.units.includes(unit)) throw new CandidateValidationError('UNIT_NOT_ALLOWED', `${path}.unit`);
    if (quantityKind !== taxonomy.quantityKind) throw new CandidateValidationError('QUANTITY_KIND_MISMATCH', `${path}.quantityKind`);
    return { type, key, value: rawValue.value, unit, quantityKind };
  }

  if (type === 'RANGE') {
    if (!Number.isFinite(rawValue.minimum) || !Number.isFinite(rawValue.maximum)) {
      throw new CandidateValidationError('FINITE_RANGE_REQUIRED', path);
    }
    if (rawValue.minimum > rawValue.maximum) throw new CandidateValidationError('RANGE_ORDER_INVALID', path);
    const unit = normalizeUnit(rawValue.unit);
    const quantityKind = normalizeText(rawValue.quantityKind, `${path}.quantityKind`, { max: 40 });
    if (!taxonomy.units.includes(unit)) throw new CandidateValidationError('UNIT_NOT_ALLOWED', `${path}.unit`);
    if (quantityKind !== taxonomy.quantityKind) throw new CandidateValidationError('QUANTITY_KIND_MISMATCH', `${path}.quantityKind`);
    return { type, key, minimum: rawValue.minimum, maximum: rawValue.maximum, unit, quantityKind };
  }

  if (type === 'ENUM') {
    return { type, key, value: normalizeText(rawValue.value, `${path}.value`, { max: 120 }) };
  }

  const value = normalizeSet(rawValue.value, `${path}.value`);
  if (value.length === 0) throw new CandidateValidationError('NONEMPTY_STRING_SET_REQUIRED', `${path}.value`);
  return { type, key, value };
}

function normalizeConditions(rawConditions, path) {
  if (!Array.isArray(rawConditions) || rawConditions.length > 12) {
    throw new CandidateValidationError('INVALID_CONDITION_COUNT', path);
  }
  const normalized = rawConditions.map((condition, index) => {
    const conditionPath = `${path}[${index}]`;
    assertExactKeys(condition, new Set(['id', 'value']), conditionPath);
    const id = normalizeText(condition.id, `${conditionPath}.id`, { max: 80 });
    if (!CONDITION_IDS.includes(id)) throw new CandidateValidationError('UNSUPPORTED_CONDITION_ID', `${conditionPath}.id`);
    const value = normalizeText(condition.value, `${conditionPath}.value`, { max: 120 });
    if (id === 'product_variant') {
      const reserved = new Set(['unknown', 'any', 'all', 'default', 'not_stated', 'unspecified', 'unscoped']);
      if (value.length > 80 || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(value) || reserved.has(value)) {
        throw new CandidateValidationError('NONCANONICAL_PRODUCT_VARIANT', `${conditionPath}.value`);
      }
    }
    return { id, value };
  }).sort((left, right) => compareAscii(`${left.id}\0${left.value}`, `${right.id}\0${right.value}`));
  const ids = new Set();
  for (const condition of normalized) {
    if (ids.has(condition.id)) throw new CandidateValidationError('DUPLICATE_CONDITION_ID', path);
    ids.add(condition.id);
  }
  return normalized;
}

function normalizeApplicability(rawApplicability, productFamily, path = '$.applicability') {
  assertExactKeys(rawApplicability, new Set([
    'vertical', 'domain', 'productFamily', 'jurisdiction', 'projectStages', 'conditions'
  ]), path);
  if (rawApplicability.vertical !== WORKBENCH_VERTICAL) throw new CandidateValidationError('VERTICAL_OUT_OF_SCOPE', `${path}.vertical`);
  if (rawApplicability.domain !== WORKBENCH_DOMAIN) throw new CandidateValidationError('DOMAIN_OUT_OF_SCOPE', `${path}.domain`);
  if (rawApplicability.productFamily !== productFamily) throw new CandidateValidationError('PRODUCT_FAMILY_MISMATCH', `${path}.productFamily`);
  if (rawApplicability.jurisdiction !== WORKBENCH_JURISDICTION) throw new CandidateValidationError('JURISDICTION_OUT_OF_SCOPE', `${path}.jurisdiction`);
  const projectStages = normalizeSet(rawApplicability.projectStages, `${path}.projectStages`, PROJECT_STAGES);
  if (projectStages.length === 0) throw new CandidateValidationError('PROJECT_STAGE_REQUIRED', `${path}.projectStages`);
  return {
    vertical: WORKBENCH_VERTICAL,
    domain: WORKBENCH_DOMAIN,
    productFamily,
    jurisdiction: WORKBENCH_JURISDICTION,
    projectStages,
    conditions: normalizeConditions(rawApplicability.conditions, `${path}.conditions`)
  };
}

function normalizeValidity(rawValidity, path = '$.validity') {
  assertExactKeys(rawValidity, new Set(['type', 'validUntil']), path);
  const type = normalizeText(rawValidity.type, `${path}.type`, { max: 32 });
  if (type === 'NOT_STATED') {
    if (rawValidity.validUntil !== null) throw new CandidateValidationError('VALID_UNTIL_MUST_BE_NULL', `${path}.validUntil`);
    return { type, validUntil: null };
  }
  if (type !== 'VALID_UNTIL') throw new CandidateValidationError('UNSUPPORTED_VALIDITY_TYPE', `${path}.type`);
  return { type, validUntil: normalizeIsoTimestamp(rawValidity.validUntil, `${path}.validUntil`) };
}

function candidateIdentityPayload(candidate) {
  return {
    schemaVersion: candidate.schemaVersion,
    synthetic: candidate.synthetic,
    documentId: candidate.documentId,
    evidenceAnchorId: candidate.evidenceAnchorId,
    claimType: candidate.claimType,
    subject: candidate.subject,
    statement: candidate.statement,
    value: candidate.value,
    applicability: candidate.applicability,
    validity: candidate.validity
  };
}

export function formatCandidateStatement(productFamily, value) {
  const formattedValue = value.type === 'RANGE'
    ? `${value.minimum}–${value.maximum} ${value.unit}`
    : value.type === 'STRING_SET'
      ? value.value.join(', ')
      : `${value.value}${value.unit ? ` ${value.unit}` : ''}`;
  return `${FAMILY_DISPLAY_NAMES[productFamily]} 공식 문서 검토 후보: ${value.key} = ${formattedValue}.`;
}

export function computeCandidateId(candidate) {
  return `cand_${sha256(candidateIdentityPayload(candidate))}`;
}

function normalizeCandidate(rawCandidate, { providedIdAllowed = true } = {}) {
  if (!isPlainObject(rawCandidate)) throw new CandidateValidationError('CANDIDATE_OBJECT_REQUIRED');
  assertSafeArtifact(rawCandidate);
  assertNoAuthorityFields(rawCandidate);
  assertExactKeys(rawCandidate, TOP_LEVEL_KEYS, '$');
  const schemaVersion = rawCandidate.schemaVersion ?? CANDIDATE_SCHEMA_VERSION;
  if (schemaVersion !== CANDIDATE_SCHEMA_VERSION) throw new CandidateValidationError('UNSUPPORTED_CANDIDATE_SCHEMA', '$.schemaVersion');
  if (typeof rawCandidate.synthetic !== 'boolean') throw new CandidateValidationError('SYNTHETIC_BOOLEAN_REQUIRED', '$.synthetic');
  if (!SUPPORTED_CLAIM_TYPES.includes(rawCandidate.claimType)) throw new CandidateValidationError('UNSUPPORTED_CLAIM_TYPE', '$.claimType');
  assertExactKeys(rawCandidate.subject, new Set(['type', 'id', 'displayName']), '$.subject');
  if (rawCandidate.subject.type !== 'PRODUCT_FAMILY') throw new CandidateValidationError('SUBJECT_TYPE_OUT_OF_SCOPE', '$.subject.type');
  const productFamily = normalizeId(rawCandidate.subject.id, '$.subject.id');
  if (!PRODUCT_FAMILIES.includes(productFamily)) throw new CandidateValidationError('PRODUCT_FAMILY_OUT_OF_SCOPE', '$.subject.id');
  const expectedDisplayName = FAMILY_DISPLAY_NAMES[productFamily];
  if (rawCandidate.subject.displayName !== expectedDisplayName) throw new CandidateValidationError('SUBJECT_DISPLAY_NAME_MISMATCH', '$.subject.displayName');
  const extractionMethod = normalizeText(rawCandidate.extractionMethod, '$.extractionMethod', { max: 40 });
  if (!EXTRACTION_METHODS.includes(extractionMethod)) throw new CandidateValidationError('UNSUPPORTED_EXTRACTION_METHOD', '$.extractionMethod');
  const extractionRuleId = normalizeText(rawCandidate.extractionRuleId, '$.extractionRuleId', { max: 90 });
  if (!SAFE_RULE_ID.test(extractionRuleId)) throw new CandidateValidationError('INVALID_EXTRACTION_RULE_ID', '$.extractionRuleId');
  if (extractionMethod === 'MANUAL_EXACT_QUOTE' && extractionRuleId !== 'OECRW0-MANUAL-STRUCTURED-ENTRY') {
    throw new CandidateValidationError('MANUAL_RULE_ID_MISMATCH', '$.extractionRuleId');
  }
  if (extractionMethod === 'DETERMINISTIC_RULE' && extractionRuleId === 'OECRW0-MANUAL-STRUCTURED-ENTRY') {
    throw new CandidateValidationError('DETERMINISTIC_RULE_ID_REQUIRED', '$.extractionRuleId');
  }
  const extractionReasons = normalizeSet(rawCandidate.extractionReasons, '$.extractionReasons', EXTRACTION_REASON_CODES);
  if (extractionReasons.length === 0) throw new CandidateValidationError('EXTRACTION_REASON_REQUIRED', '$.extractionReasons');
  if (extractionMethod === 'DETERMINISTIC_RULE' && !extractionReasons.includes('CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW')) {
    throw new CandidateValidationError('UNCERTAINTY_REASON_REQUIRED', '$.extractionReasons');
  }
  if (rawCandidate.reviewState !== 'REVIEW_REQUIRED') throw new CandidateValidationError('REVIEW_STATE_MUST_REQUIRE_REVIEW', '$.reviewState');
  const value = normalizeCandidateValue(rawCandidate.value, productFamily);
  const statement = normalizeText(rawCandidate.statement, '$.statement', { max: 1_000 });
  if (statement !== formatCandidateStatement(productFamily, value)) {
    throw new CandidateValidationError('CANDIDATE_STATEMENT_MISMATCH', '$.statement');
  }
  const normalized = {
    schemaVersion,
    synthetic: rawCandidate.synthetic,
    documentId: normalizeId(rawCandidate.documentId, '$.documentId'),
    evidenceAnchorId: normalizeId(rawCandidate.evidenceAnchorId, '$.evidenceAnchorId'),
    claimType: rawCandidate.claimType,
    subject: { type: 'PRODUCT_FAMILY', id: productFamily, displayName: expectedDisplayName },
    statement,
    value,
    applicability: normalizeApplicability(rawCandidate.applicability, productFamily),
    validity: normalizeValidity(rawCandidate.validity),
    extractionMethod,
    extractionRuleId,
    extractionReasons,
    reviewState: 'REVIEW_REQUIRED'
  };
  const candidateId = computeCandidateId(normalized);
  if (rawCandidate.candidateId !== undefined) {
    if (!providedIdAllowed) throw new CandidateValidationError('CANDIDATE_ID_INPUT_REFUSED', '$.candidateId');
    if (rawCandidate.candidateId !== candidateId) throw new CandidateValidationError('CANDIDATE_ID_MISMATCH', '$.candidateId');
  }
  return Object.freeze({ schemaVersion, candidateId, ...Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== 'schemaVersion')) });
}

export function validateCandidate(candidate) {
  return normalizeCandidate(candidate);
}

export function createCandidate(input, { inject = {} } = {}) {
  inject.beforeCandidateNormalization?.(input);
  const candidate = normalizeCandidate(input);
  inject.afterCandidateNormalization?.(candidate);
  return candidate;
}

function resolveProductFamily(document) {
  const raw = document?.productFamily
    ? [document.productFamily]
    : document?.source?.productFamilies ?? document?.productFamilies ?? document?.productFamilyIds ?? document?.families;
  const families = [...new Set((Array.isArray(raw) ? raw : []).filter((family) => PRODUCT_FAMILIES.includes(family)))];
  if (families.length !== 1) throw new CandidateValidationError('EXACT_PRODUCT_FAMILY_REQUIRED', '$.document.productFamilies');
  return families[0];
}

function resolveAnchorQuote(anchor) {
  const quote = anchor?.selection?.quote ?? anchor?.directQuote ?? anchor?.exactQuote ?? anchor?.quote;
  return normalizeText(quote, '$.anchors.directQuote', { max: 500 });
}

function deriveStructuredContext(quote) {
  const conditions = [];
  const extractionReasons = [];
  const indoorOnly = /(?:indoor\s+(?:use\s+)?only|indoor-only|indoor\s+installation|옥내용|실내용)/iu.test(quote);
  const outdoorOnly = /(?:outdoor\s+(?:use\s+)?only|outdoor-only|outdoor\s+installation|옥외용|실외용)/iu.test(quote);
  if (indoorOnly || outdoorOnly) {
    conditions.push({ id: 'installation_condition', value: indoorOnly ? 'indoor_only' : 'outdoor_only' });
    extractionReasons.push('EXPLICIT_LIMITATION_OR_EXCLUSION');
  }
  const altitude = quote.match(/(?:altitude|고도)[^\d+-]{0,24}(?:up\s+to|maximum|max\.?|이하|최대)?\s*(\d+(?:\.\d+)?)\s*m\b/iu);
  if (altitude && /(?:up\s+to|maximum|max\.?|이하|최대)/iu.test(altitude[0])) {
    conditions.push({ id: 'altitude', value: `maximum_${altitude[1]}_m` });
    extractionReasons.push('EXPLICIT_LIMITATION_OR_EXCLUSION');
  }
  if (/(?:not\s+(?:suitable|supported|permitted)|excluding|except\s+for|only\b|제외|불가|전용|이하|미만)/iu.test(quote)) {
    extractionReasons.push('EXPLICIT_LIMITATION_OR_EXCLUSION');
  }
  return {
    conditions: conditions.sort((left, right) => compareAscii(`${left.id}\0${left.value}`, `${right.id}\0${right.value}`)),
    extractionReasons: [...new Set(extractionReasons)].sort(compareAscii)
  };
}

function createRuleCandidate({ document, anchor, productFamily, claimType, value, ruleId, reason, projectStages = ['SPECIFICATION', 'TENDER'], conditions = [], extractionReasons = [] }) {
  return createCandidate({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    synthetic: document.synthetic === true,
    documentId: document.documentId,
    evidenceAnchorId: anchor.evidenceAnchorId ?? anchor.anchorId,
    claimType,
    subject: {
      type: 'PRODUCT_FAMILY',
      id: productFamily,
      displayName: FAMILY_DISPLAY_NAMES[productFamily]
    },
    statement: formatCandidateStatement(productFamily, value),
    value,
    applicability: {
      vertical: WORKBENCH_VERTICAL,
      domain: WORKBENCH_DOMAIN,
      productFamily,
      jurisdiction: WORKBENCH_JURISDICTION,
      projectStages,
      conditions
    },
    validity: { type: 'NOT_STATED', validUntil: null },
    extractionMethod: 'DETERMINISTIC_RULE',
    extractionRuleId: ruleId,
    extractionReasons: [reason, ...extractionReasons, 'CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW'],
    reviewState: 'REVIEW_REQUIRED'
  });
}

const NUMERIC_RULES = Object.freeze([
  { families: ['medium_voltage_switchgear'], key: 'rated_voltage', labels: ['rated voltage', '정격 전압'], units: 'k?V', quantityKind: 'voltage', ruleId: 'OECRW0-PC-MVS-RATED-VOLTAGE' },
  { families: ['medium_voltage_switchgear'], key: 'rated_current', labels: ['rated current', '정격 전류'], units: 'k?A', quantityKind: 'current', ruleId: 'OECRW0-PC-MVS-RATED-CURRENT' },
  { families: ['medium_voltage_switchgear'], key: 'short_circuit_rating', labels: ['short circuit current', 'short-circuit rating', '단락 전류'], units: 'k?A', quantityKind: 'current', ruleId: 'OECRW0-PC-MVS-SHORT-CIRCUIT' },
  { families: PRODUCT_FAMILIES, key: 'frequency', labels: ['rated frequency', 'frequency', '정격 주파수', '주파수'], units: 'Hz', quantityKind: 'frequency', ruleId: 'OECRW0-PC-COMMON-FREQUENCY' },
  { families: PRODUCT_FAMILIES, key: 'altitude', labels: ['altitude', '고도'], units: 'm', quantityKind: 'length', ruleId: 'OECRW0-PC-COMMON-ALTITUDE' },
  { families: ['transformer'], key: 'transformer_capacity', labels: ['rated power', 'rated capacity', 'transformer capacity', '정격 용량', '변압기 용량'], units: '(?:M|k)?VA', quantityKind: 'apparent_power', ruleId: 'OECRW0-PC-TR-RATED-POWER' },
  { families: ['transformer'], key: 'primary_voltage', labels: ['primary voltage', 'input voltage', '1차 전압', '입력 전압'], units: 'k?V', quantityKind: 'voltage', ruleId: 'OECRW0-PC-TR-INPUT-VOLTAGE' },
  { families: ['transformer'], key: 'secondary_voltage', labels: ['secondary voltage', 'output voltage', '2차 전압', '출력 전압'], units: 'k?V', quantityKind: 'voltage', ruleId: 'OECRW0-PC-TR-OUTPUT-VOLTAGE' }
]);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractNumericCandidates(document, anchor, quote, productFamily) {
  const candidates = [];
  const context = deriveStructuredContext(quote);
  const normative = /(?:\bshall\b|\bmust\b|\brequired\b|요구|하여야|해야\s*한다)/iu.test(quote);
  for (const rule of NUMERIC_RULES.filter((item) => item.families.includes(productFamily))) {
    const label = rule.labels.map(escapeRegex).join('|');
    const expression = new RegExp(`(?:${label})\\s*(?::|=|is|은|는)?\\s*([+-]?\\d+(?:[.,]\\d+)?)\\s*(${rule.units})(?![A-Za-z])`, 'giu');
    const matches = [...quote.matchAll(expression)];
    if (matches.length !== 1 || matches[0][1].includes(',')) continue;
    const compatibleQuantities = [...quote.matchAll(new RegExp(`[+-]?\\d+(?:[.,]\\d+)?\\s*(?:${rule.units})(?![A-Za-z])`, 'giu'))];
    if (compatibleQuantities.length !== 1) continue;
    const value = Number(matches[0][1]);
    if (!Number.isFinite(value)) continue;
    candidates.push(createRuleCandidate({
      document,
      anchor,
      productFamily,
      claimType: normative ? 'TECHNICAL_REQUIREMENT' : 'PRODUCT_CAPABILITY',
      value: { type: 'QUANTITY', key: rule.key, value, unit: normalizeUnit(matches[0][2]), quantityKind: rule.quantityKind },
      ruleId: rule.ruleId,
      reason: normative ? 'EXPLICIT_NORMATIVE_CUE' : 'EXACT_LABEL_VALUE_MATCH',
      conditions: context.conditions,
      extractionReasons: context.extractionReasons
    }));
  }
  return candidates;
}

function extractRangeCandidates(document, anchor, quote, productFamily) {
  const labels = ['ambient temperature range', 'ambient temperature', 'operating temperature range', 'operating temperature', '주위 온도 범위', '주위 온도', '사용 온도 범위', '사용 온도'];
  const expression = new RegExp(`(?:${labels.map(escapeRegex).join('|')})\\s*(?::|=|is|은|는)?\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*(?:°?C|℃|degC)?\\s*(?:-|–|—|~|to|부터)\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*(?:°?C|℃|degC)`, 'giu');
  const matches = [...quote.matchAll(expression)];
  if (matches.length !== 1) return [];
  const minimum = Number(matches[0][1]);
  const maximum = Number(matches[0][2]);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) return [];
  const context = deriveStructuredContext(quote);
  const conditions = [
    ...context.conditions.filter((condition) => condition.id !== 'operating_condition'),
    { id: 'operating_condition', value: 'document_stated_range' }
  ];
  return [createRuleCandidate({
    document,
    anchor,
    productFamily,
    claimType: 'PRODUCT_CAPABILITY',
    value: { type: 'RANGE', key: 'ambient_temperature', minimum, maximum, unit: 'degC', quantityKind: 'temperature' },
    ruleId: 'OECRW0-PC-COMMON-AMBIENT-TEMPERATURE',
    reason: 'EXACT_LABEL_VALUE_MATCH',
    conditions,
    extractionReasons: context.extractionReasons
  })];
}

function extractCertificationCandidates(document, anchor, quote, productFamily) {
  const standardToken = '(?:IEC\\s*\\d+(?:-\\d+)*|IEEE\\s*[A-Z0-9.-]+|KS\\s*[A-Z0-9.-]+)';
  const affirmative = [
    new RegExp(`(?:^|[.!?]\\s*)certification\\s*[:=]\\s*${standardToken}\\s*[.]?\\s*$`, 'iu'),
    new RegExp(`\\bcertified(?:\\s+to|\\s+under)?\\s+${standardToken}\\b`, 'iu'),
    new RegExp(`\\b(?:conforms?\\s+to|complies?\\s+with)\\s+${standardToken}\\b`, 'iu'),
    new RegExp(`${standardToken}\\s*(?:인증\\s*(?:완료|획득|보유|받음)|준수(?:함|됨)?|적합(?:함|됨)?)`, 'iu'),
    new RegExp(`(?:인증|준수|적합)\\s*[:=]\\s*${standardToken}\\s*[.]?\\s*$`, 'iu')
  ];
  if (!affirmative.some((expression) => expression.test(quote))) return [];
  const tokens = [...quote.matchAll(/\b(?:IEC\s*\d+(?:-\d+)*|IEEE\s*[A-Z0-9.-]+|KS\s*[A-Z0-9.-]+)\b/giu)]
    .map((match) => match[0].replace(/\s+/gu, ' ').trim().toUpperCase());
  const unique = [...new Set(tokens)].sort(compareAscii);
  if (unique.length !== 1) return [];
  const context = deriveStructuredContext(quote);
  return [createRuleCandidate({
    document,
    anchor,
    productFamily,
    claimType: 'CERTIFICATION',
    value: { type: 'STRING_SET', key: 'certification', value: unique },
    ruleId: 'OECRW0-CERT-EXPLICIT-STANDARD',
    reason: 'EXPLICIT_CERTIFICATION_TOKEN',
    conditions: context.conditions,
    extractionReasons: context.extractionReasons
  })];
}

function extractProtocolCandidates(document, anchor, quote, productFamily) {
  const protocolToken = '(?:IEC\\s*61850|Modbus\\s+TCP|BACnet\\s*\\/\\s*IP)';
  const affirmative = [
    /\b(?:supported\s+)?protocols?\s*[:=]/iu,
    new RegExp(`\\bsupports?\\s+${protocolToken}\\b`, 'iu'),
    new RegExp(`${protocolToken}\\s+(?:is\\s+)?supported\\b`, 'iu'),
    /(?:지원\s*프로토콜|통신\s*프로토콜)\s*[:=]/iu,
    new RegExp(`${protocolToken}\\s*지원(?:함|됨)`, 'iu')
  ];
  if (!affirmative.some((expression) => expression.test(quote))) return [];
  const protocols = [
    ['IEC 61850', /\bIEC\s*61850\b/iu],
    ['Modbus TCP', /\bModbus\s+TCP\b/iu],
    ['BACnet/IP', /\bBACnet\s*\/\s*IP\b/iu]
  ].filter(([, expression]) => expression.test(quote)).map(([name]) => name);
  if (protocols.length === 0) return [];
  const context = deriveStructuredContext(quote);
  return [createRuleCandidate({
    document,
    anchor,
    productFamily,
    claimType: 'PRODUCT_CAPABILITY',
    value: { type: 'STRING_SET', key: 'communication_protocol', value: protocols },
    ruleId: 'OECRW0-PC-EXPLICIT-PROTOCOL',
    reason: 'EXPLICIT_PROTOCOL_TOKEN',
    conditions: context.conditions,
    extractionReasons: context.extractionReasons
  })];
}

function extractEnumCandidates(document, anchor, quote, productFamily) {
  const results = [];
  const context = deriveStructuredContext(quote);
  if (productFamily === 'medium_voltage_switchgear') {
    const mediumMatch = quote.match(/(?:insulation medium|절연 매질)\s*(?::|=|is|은|는)?\s*(vacuum|air|SF6|진공|공기)/iu);
    if (mediumMatch) {
      const aliases = { '진공': 'vacuum', '공기': 'air' };
      const value = aliases[mediumMatch[1]] ?? mediumMatch[1].toLowerCase();
      results.push(createRuleCandidate({
        document,
        anchor,
        productFamily,
        claimType: 'PRODUCT_CAPABILITY',
        value: { type: 'ENUM', key: 'insulation_medium', value },
        ruleId: 'OECRW0-PC-MVS-INSULATION-MEDIUM',
        reason: 'EXPLICIT_ENUM_TOKEN',
        conditions: context.conditions,
        extractionReasons: context.extractionReasons
      }));
    }
  }
  if (productFamily === 'transformer') {
    const coolingMatch = quote.match(/(?:cooling method|냉각 방식)\s*(?::|=|is|은|는)?\s*(ONAN|ONAF|AN|AF)/iu);
    if (coolingMatch) {
      results.push(createRuleCandidate({
        document,
        anchor,
        productFamily,
        claimType: 'PRODUCT_CAPABILITY',
        value: { type: 'ENUM', key: 'cooling_method', value: coolingMatch[1].toUpperCase() },
        ruleId: 'OECRW0-PC-TR-COOLING-METHOD',
        reason: 'EXPLICIT_ENUM_TOKEN',
        conditions: context.conditions,
        extractionReasons: context.extractionReasons
      }));
    }
    const efficiencyMatch = quote.match(/(?:efficiency class|효율 등급)\s*(?::|=|is|은|는)?\s*([A-Z0-9][A-Z0-9._-]{0,39})/iu);
    if (efficiencyMatch) {
      results.push(createRuleCandidate({
        document,
        anchor,
        productFamily,
        claimType: 'PERFORMANCE',
        value: { type: 'ENUM', key: 'efficiency_class', value: efficiencyMatch[1].toUpperCase() },
        ruleId: 'OECRW0-PERF-TR-EFFICIENCY-CLASS',
        reason: 'EXPLICIT_ENUM_TOKEN',
        conditions: context.conditions,
        extractionReasons: context.extractionReasons
      }));
    }
  }
  return results;
}

export function extractDeterministicCandidates({ document, anchors }, { inject = {} } = {}) {
  inject.beforeCandidateGeneration?.({ document, anchors });
  if (!isPlainObject(document)) throw new CandidateValidationError('DOCUMENT_OBJECT_REQUIRED', '$.document');
  if (!Array.isArray(anchors) || anchors.length === 0) throw new CandidateValidationError('ANCHORS_REQUIRED', '$.anchors');
  const productFamily = resolveProductFamily(document);
  const candidates = [];
  for (const anchor of anchors) {
    if (!isPlainObject(anchor)) throw new CandidateValidationError('ANCHOR_OBJECT_REQUIRED', '$.anchors');
    inject.beforeAnchorValidation?.({ document, anchor });
    const validatedAnchor = validatePageEvidenceAnchor(document, anchor);
    inject.afterAnchorValidation?.(validatedAnchor);
    const anchorDocumentId = validatedAnchor.documentId;
    if (anchorDocumentId !== document.documentId) throw new CandidateValidationError('ANCHOR_DOCUMENT_MISMATCH', '$.anchors.documentId');
    const quote = resolveAnchorQuote(validatedAnchor);
    if (NEGATED_EVIDENCE_CUE.test(quote)) continue;
    candidates.push(
      ...extractNumericCandidates(document, validatedAnchor, quote, productFamily),
      ...extractRangeCandidates(document, validatedAnchor, quote, productFamily),
      ...extractCertificationCandidates(document, validatedAnchor, quote, productFamily),
      ...extractProtocolCandidates(document, validatedAnchor, quote, productFamily),
      ...extractEnumCandidates(document, validatedAnchor, quote, productFamily)
    );
  }
  const byId = new Map();
  for (const candidate of candidates) {
    const prior = byId.get(candidate.candidateId);
    if (prior && canonicalStringify(prior) !== canonicalStringify(candidate)) {
      throw new CandidateValidationError('CANDIDATE_ID_CONTENT_CONFLICT', '$.candidates');
    }
    byId.set(candidate.candidateId, candidate);
  }
  const result = [...byId.values()].sort((left, right) => compareAscii(left.candidateId, right.candidateId));
  inject.afterCandidateGeneration?.(result);
  return Object.freeze(result);
}
