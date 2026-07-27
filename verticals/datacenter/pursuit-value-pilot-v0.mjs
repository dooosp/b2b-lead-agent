import {
  assertSafeArtifact,
  assertValidatedClaimRegistry,
  canonicalStringify,
  ClaimValidationError,
  sha256,
} from '../../knowledge/claim-registry/index.mjs';
import {
  buildPursuitRevisionSnapshot,
  buildPursuitTwinReviewPacket,
  renderPursuitTwinReviewPacketJson,
} from './pursuit-twin-v0.mjs';

export const PURSUIT_VALUE_PILOT_BOUNDARY = 'NOT_PRODUCTION_EVIDENCE';
export const PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY = 'LOCAL_TEST_SYNTHETIC_ONLY';
export const PURSUIT_VALUE_PILOT_REVIEWER_IDS = Object.freeze([
  'PV-R1',
  'PV-R2',
  'PV-R3',
  'PV-R4',
  'PV-R5',
]);

const CASE_SCHEMA = 'pursuit-value-pilot-case-v0';
const CATALOG_SCHEMA = 'pursuit-value-pilot-case-catalog-v0';
const PROTOCOL_SCHEMA = 'pursuit-value-pilot-protocol-v0';
const SESSION_SCHEMA = 'pursuit-value-pilot-session-v0';
const RESPONSE_SCHEMA = 'pursuit-value-pilot-session-response-v0';
const TEAM_WEEK_SCHEMA = 'pursuit-value-pilot-team-week-v0';
const TEAM_WEEK_RESPONSE_SCHEMA = 'pursuit-value-pilot-team-week-response-v0';
const AGGREGATE_SCHEMA = 'pursuit-value-pilot-aggregate-v0';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const REVIEWER_PATTERN = /^PV-R[1-5]$/;
const HUMAN_DECISIONS = new Set(['PURSUE', 'HOLD', 'NO_GO', 'NO_BID']);
const ROLES = new Set(['TECHNICAL_SALES', 'APPLICATION_ENGINEER', 'TENDER_SPEC_DESIGN']);
const EXPERIENCE_BANDS = new Set([
  'LT_2_YEARS',
  'Y2_TO_5',
  'Y6_TO_10',
  'GT_10_YEARS',
  'PREFER_NOT_TO_SAY',
]);
const YES_NO = new Set(['YES', 'NO']);
const YES_NO_UNSURE = new Set(['YES', 'NO', 'UNSURE']);
const TECHNICAL_DISPOSITIONS = new Set(['ACCEPTED_AS_WRITTEN', 'MODIFIED', 'REJECTED']);
const GAP_MATERIALITY = new Set(['KEY', 'NON_KEY', 'NOT_A_GAP']);
const DECISION_IMPACTS = new Set(['IMPROVED', 'NO_CHANGE', 'WORSE', 'UNSURE']);
const FINAL_DISPOSITIONS = new Set(['ADVANCE', 'ITERATE', 'STOP', 'UNSURE']);
const MAX_DURATION_SECONDS = 7_200;

const ASSIGNMENT_BLUEPRINT = Object.freeze([
  ['PV-R1', 'TECHNICAL_SALES', 'BASELINE_FIRST', 'PV-C1', 'PV-C2'],
  ['PV-R2', 'APPLICATION_ENGINEER', 'TWIN_FIRST', 'PV-C2', 'PV-C3'],
  ['PV-R3', 'TECHNICAL_SALES', 'BASELINE_FIRST', 'PV-C3', 'PV-C4'],
  ['PV-R4', 'APPLICATION_ENGINEER', 'TWIN_FIRST', 'PV-C4', 'PV-C5'],
  ['PV-R5', 'TENDER_SPEC_DESIGN', 'BASELINE_FIRST', 'PV-C5', 'PV-C1'],
]);

function fail(code, path = '$') {
  throw new ClaimValidationError(code, path);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  return JSON.parse(canonicalStringify(value));
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function withoutCanonicalHash(value) {
  const copy = clone(value);
  delete copy.canonicalSha256;
  return copy;
}

function withCanonicalHash(value) {
  const body = clone(value);
  return clone({ ...body, canonicalSha256: sha256(body) });
}

function assertCanonicalHash(value, path) {
  if (!isPlainObject(value) || !HASH_PATTERN.test(value.canonicalSha256 || '')) {
    fail('PILOT_CANONICAL_HASH_REQUIRED', `${path}.canonicalSha256`);
  }
  if (value.canonicalSha256 !== sha256(withoutCanonicalHash(value))) {
    fail('PILOT_CANONICAL_HASH_MISMATCH', `${path}.canonicalSha256`);
  }
}

function assertExactKeys(value, keys, path) {
  if (!isPlainObject(value)) fail('PILOT_OBJECT_REQUIRED', path);
  const actual = Object.keys(value).sort(compareAscii);
  const expected = [...keys].sort(compareAscii);
  if (canonicalStringify(actual) !== canonicalStringify(expected)) {
    fail('PILOT_OBJECT_KEYS_INVALID', path);
  }
}

function assertEnum(value, allowed, path) {
  if (!allowed.has(value)) fail('PILOT_ENUM_INVALID', path);
}

function assertIso(value, path) {
  if (typeof value !== 'string') fail('PILOT_TIMESTAMP_INVALID', path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail('PILOT_TIMESTAMP_INVALID', path);
  }
  return parsed.getTime();
}

function assertBoundary(value, path, schemaVersion) {
  if (!isPlainObject(value)
    || value.schemaVersion !== schemaVersion
    || value.boundary !== PURSUIT_VALUE_PILOT_BOUNDARY
    || value.executionBoundary !== PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY
    || value.productionReady !== false
    || value.issue165Status !== 'HOLD') {
    fail('PILOT_BOUNDARY_INVALID', path);
  }
}

function registryPayload(registry) {
  assertValidatedClaimRegistry(registry);
  return {
    schemaVersion: registry.schemaVersion,
    asOf: registry.asOf,
    claims: registry.claims,
  };
}

export function serializePursuitValuePilotCanonical(value) {
  assertSafeArtifact(value, '$.pursuitValuePilotCanonicalValue');
  return canonicalStringify(value);
}

export function hashPursuitValuePilotCanonical(value) {
  return sha256(serializePursuitValuePilotCanonical(value));
}

// JSON.parse accepts duplicate object keys. Human intake does not: the last-key-wins
// behavior would make the reviewed value ambiguous, so a small strict parser is used.
export function parsePursuitValuePilotJsonStrict(text) {
  if (typeof text !== 'string') fail('PILOT_JSON_TEXT_REQUIRED');
  let cursor = 0;
  const whitespace = () => {
    while (cursor < text.length && /[\x20\x09\x0a\x0d]/.test(text[cursor])) cursor += 1;
  };
  const parseString = () => {
    const start = cursor;
    if (text[cursor] !== '"') fail('PILOT_JSON_INVALID');
    cursor += 1;
    while (cursor < text.length) {
      const character = text[cursor];
      if (character === '"') {
        cursor += 1;
        try { return JSON.parse(text.slice(start, cursor)); } catch { fail('PILOT_JSON_INVALID'); }
      }
      if (character === '\\') {
        cursor += 1;
        if (cursor >= text.length || !/["\\/bfnrtu]/.test(text[cursor])) fail('PILOT_JSON_INVALID');
        if (text[cursor] === 'u') {
          if (!/^[a-fA-F0-9]{4}$/.test(text.slice(cursor + 1, cursor + 5))) fail('PILOT_JSON_INVALID');
          cursor += 4;
        }
      } else if (character.charCodeAt(0) < 0x20) {
        fail('PILOT_JSON_INVALID');
      }
      cursor += 1;
    }
    fail('PILOT_JSON_INVALID');
  };
  const parseValue = () => {
    whitespace();
    const character = text[cursor];
    if (character === '"') return parseString();
    if (character === '{') {
      cursor += 1;
      const object = Object.create(null);
      const keys = new Set();
      whitespace();
      if (text[cursor] === '}') { cursor += 1; return object; }
      while (cursor < text.length) {
        whitespace();
        const key = parseString();
        if (keys.has(key)) fail('PILOT_JSON_DUPLICATE_KEY');
        keys.add(key);
        whitespace();
        if (text[cursor] !== ':') fail('PILOT_JSON_INVALID');
        cursor += 1;
        object[key] = parseValue();
        whitespace();
        if (text[cursor] === '}') { cursor += 1; return object; }
        if (text[cursor] !== ',') fail('PILOT_JSON_INVALID');
        cursor += 1;
      }
      fail('PILOT_JSON_INVALID');
    }
    if (character === '[') {
      cursor += 1;
      const array = [];
      whitespace();
      if (text[cursor] === ']') { cursor += 1; return array; }
      while (cursor < text.length) {
        array.push(parseValue());
        whitespace();
        if (text[cursor] === ']') { cursor += 1; return array; }
        if (text[cursor] !== ',') fail('PILOT_JSON_INVALID');
        cursor += 1;
      }
      fail('PILOT_JSON_INVALID');
    }
    for (const [token, value] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(token, cursor)) { cursor += token.length; return value; }
    }
    const number = text.slice(cursor).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!number) fail('PILOT_JSON_INVALID');
    cursor += number[0].length;
    const value = Number(number[0]);
    if (!Number.isFinite(value)) fail('PILOT_JSON_INVALID');
    return value;
  };
  const result = parseValue();
  whitespace();
  if (cursor !== text.length) fail('PILOT_JSON_INVALID');
  assertSafeArtifact(result, '$.pursuitValuePilotJson');
  return clone(result);
}

function identity(opportunityId, index) {
  return {
    opportunityId,
    accountDisplayName: `Synthetic Pilot Account ${index}`,
    projectDisplayName: `Synthetic Pilot Project ${index}`,
    facilityDisplayName: `Synthetic Pilot Facility ${index}`,
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR',
  };
}

function quantityRequirement(productFamilyId, { known }) {
  return {
    requirementId: 'req_incoming_voltage',
    category: 'electrical_power',
    key: 'incoming_voltage',
    productFamilyIds: [productFamilyId],
    priority: 'HARD',
    valueState: known ? 'KNOWN' : 'UNKNOWN',
    operator: 'GTE',
    value: {
      type: 'QUANTITY',
      key: 'incoming_voltage',
      value: 22.9,
      unit: 'kV',
      quantityKind: 'voltage',
    },
    evidenceClaimRefs: known ? ['req_voltage_22_9kv'] : [],
  };
}

function enumRequirement(productFamilyId, { known }) {
  return {
    requirementId: 'req_cooling_architecture',
    category: 'cooling',
    key: 'cooling_architecture',
    productFamilyIds: [productFamilyId],
    priority: 'HARD',
    valueState: known ? 'KNOWN' : 'UNKNOWN',
    operator: 'EQ',
    value: { type: 'ENUM', key: 'cooling_architecture', value: 'WATER_COOLED' },
    evidenceClaimRefs: known ? ['req_cooling_water'] : [],
  };
}

function protocolRequirement(productFamilyId, { known }) {
  return {
    requirementId: 'req_required_protocols',
    category: 'controls_bms',
    key: 'required_protocols',
    productFamilyIds: [productFamilyId],
    priority: 'HARD',
    valueState: known ? 'KNOWN' : 'UNKNOWN',
    operator: 'CONTAINS_ALL',
    value: { type: 'STRING_SET', key: 'required_protocols', value: ['BACNET_IP'] },
    evidenceClaimRefs: known ? ['req_bacnet'] : [],
  };
}

const CASE_BLUEPRINTS = Object.freeze([
  { caseId: 'PV-C1', productFamilyId: 'medium_voltage_switchgear', requirement: quantityRequirement, previousKnown: true, currentKnown: false },
  { caseId: 'PV-C2', productFamilyId: 'oil_free_compressor', requirement: enumRequirement, previousKnown: true, currentKnown: false },
  { caseId: 'PV-C3', productFamilyId: 'building_management', requirement: protocolRequirement, previousKnown: true, currentKnown: false },
  { caseId: 'PV-C4', productFamilyId: 'energy_analytics', requirement: protocolRequirement, previousKnown: false, currentKnown: true },
  { caseId: 'PV-C5', productFamilyId: 'fire_detection', requirement: protocolRequirement, previousKnown: false, currentKnown: true },
]);

function opportunity(blueprint, index, known) {
  const opportunityId = `synthetic_pursuit_value_${index}`;
  return {
    schemaVersion: 'project-opportunity-v0',
    synthetic: true,
    opportunityId,
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR',
    conditions: {},
    identity: identity(opportunityId, index),
    stage: { value: 'BASIC_DESIGN', evidenceClaimRefs: ['stage_basic_design'] },
    candidateProductFamilyIds: [blueprint.productFamilyId],
    requirements: [blueprint.requirement(blueprint.productFamilyId, { known })],
  };
}

function revision(blueprint, id, supersedesRevisionId, effectiveAt, known) {
  const requirementClaim = blueprint.requirement(blueprint.productFamilyId, { known })
    .evidenceClaimRefs[0];
  return {
    documentKey: `synthetic_pursuit_value_${blueprint.caseId.toLowerCase()}`,
    revisionId: id,
    supersedesRevisionId,
    effectiveAt,
    evidenceClaimRefs: ['stage_basic_design', ...(requirementClaim ? [requirementClaim] : [])],
  };
}

function buildCaseRecord(blueprint, index, registry, verticalPack) {
  const previousOpportunity = opportunity(blueprint, index, blueprint.previousKnown);
  const currentOpportunity = opportunity(blueprint, index, blueprint.currentKnown);
  const previousSnapshot = buildPursuitRevisionSnapshot({
    opportunity: previousOpportunity,
    sourceRevision: revision(
      blueprint,
      `${blueprint.caseId}-R1`,
      null,
      '2026-04-01T00:00:00.000Z',
      blueprint.previousKnown,
    ),
    observedAt: '2026-04-02T00:00:00.000Z',
  }, registry, verticalPack);
  const currentSnapshot = buildPursuitRevisionSnapshot({
    opportunity: currentOpportunity,
    sourceRevision: revision(
      blueprint,
      `${blueprint.caseId}-R2`,
      `${blueprint.caseId}-R1`,
      '2026-05-01T00:00:00.000Z',
      blueprint.currentKnown,
    ),
    observedAt: '2026-05-02T00:00:00.000Z',
  }, registry, verticalPack);
  const priorHumanDecision = {
    decisionId: `${blueprint.caseId.toLowerCase()}-synthetic-prior-decision`,
    decision: index % 2 === 0 ? 'HOLD' : 'PURSUE',
    decidedAt: '2026-04-03T00:00:00.000Z',
    snapshotCanonicalSha256: previousSnapshot.canonicalSha256,
    reviewReceipt: `${blueprint.caseId.toLowerCase()}-synthetic-local-review-receipt`,
  };
  const twinPacket = buildPursuitTwinReviewPacket({
    previousSnapshot,
    currentSnapshot,
    priorHumanDecision,
  }, registry, verticalPack);
  const baselineBody = {
    schemaVersion: 'pursuit-value-pilot-baseline-artifact-v0',
    boundary: PURSUIT_VALUE_PILOT_BOUNDARY,
    executionBoundary: PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY,
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    caseId: blueprint.caseId,
    projectOpportunity: currentOpportunity,
    sourceRevision: currentSnapshot.sourceRevision,
    finalHumanDecision: 'NOT_MADE',
    note: 'Unassisted structured project artifact; no Specification Fit, Spec Delta, or Minimum Evidence interpretation is included.',
  };
  const baselineArtifact = withCanonicalHash(baselineBody);
  return withCanonicalHash({
    schemaVersion: CASE_SCHEMA,
    boundary: PURSUIT_VALUE_PILOT_BOUNDARY,
    executionBoundary: PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY,
    dataClass: 'REPOSITORY_REVIEWED_SYNTHETIC',
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    caseId: blueprint.caseId,
    opportunityId: currentOpportunity.opportunityId,
    productFamilyId: blueprint.productFamilyId,
    baselineArtifact,
    baselineArtifactCanonicalSha256: baselineArtifact.canonicalSha256,
    twinPacket,
    twinPacketCanonicalSha256: twinPacket.canonicalSha256,
    finalHumanDecision: 'NOT_MADE',
  });
}

export function buildPursuitValuePilotCaseCatalog(registry, verticalPack) {
  assertValidatedClaimRegistry(registry);
  assertSafeArtifact(verticalPack, '$.verticalPack');
  const cases = CASE_BLUEPRINTS.map((blueprint, index) => (
    buildCaseRecord(blueprint, index + 1, registry, verticalPack)
  ));
  const catalog = withCanonicalHash({
    schemaVersion: CATALOG_SCHEMA,
    boundary: PURSUIT_VALUE_PILOT_BOUNDARY,
    executionBoundary: PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY,
    dataClass: 'REPOSITORY_REVIEWED_SYNTHETIC',
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    registryCanonicalSha256: sha256(registryPayload(registry)),
    verticalPackCanonicalSha256: sha256(verticalPack),
    caseCount: cases.length,
    cases,
  });
  validatePursuitValuePilotCaseCatalog(catalog);
  return catalog;
}

function validateBaselineArtifact(artifact, caseRecord, path) {
  assertBoundary(artifact, path, 'pursuit-value-pilot-baseline-artifact-v0');
  assertExactKeys(artifact, [
    'schemaVersion', 'boundary', 'executionBoundary', 'productionReady',
    'issue165Status', 'synthetic', 'caseId', 'projectOpportunity',
    'sourceRevision', 'finalHumanDecision', 'note', 'canonicalSha256',
  ], path);
  if (artifact.synthetic !== true
    || artifact.caseId !== caseRecord.caseId
    || artifact.finalHumanDecision !== 'NOT_MADE'
    || artifact.projectOpportunity?.opportunityId !== caseRecord.opportunityId
    || artifact.projectOpportunity?.synthetic !== true
    || Object.hasOwn(artifact, 'fitResult')) {
    fail('PILOT_BASELINE_ARTIFACT_INVALID', path);
  }
  assertCanonicalHash(artifact, path);
}

function validateCaseRecord(record, expectedCaseId, path) {
  assertBoundary(record, path, CASE_SCHEMA);
  assertExactKeys(record, [
    'schemaVersion', 'boundary', 'executionBoundary', 'dataClass',
    'productionReady', 'issue165Status', 'synthetic', 'caseId',
    'opportunityId', 'productFamilyId', 'baselineArtifact',
    'baselineArtifactCanonicalSha256', 'twinPacket',
    'twinPacketCanonicalSha256', 'finalHumanDecision', 'canonicalSha256',
  ], path);
  if (record.dataClass !== 'REPOSITORY_REVIEWED_SYNTHETIC'
    || record.synthetic !== true
    || record.caseId !== expectedCaseId
    || typeof record.opportunityId !== 'string'
    || typeof record.productFamilyId !== 'string'
    || record.finalHumanDecision !== 'NOT_MADE') {
    fail('PILOT_CASE_INVALID', path);
  }
  validateBaselineArtifact(record.baselineArtifact, record, `${path}.baselineArtifact`);
  if (record.baselineArtifactCanonicalSha256 !== record.baselineArtifact.canonicalSha256) {
    fail('PILOT_BASELINE_HASH_MISMATCH', `${path}.baselineArtifactCanonicalSha256`);
  }
  // The renderer is also the public structural validator for the complete
  // Pursuit Twin packet and all nested hashes.
  renderPursuitTwinReviewPacketJson(record.twinPacket);
  if (record.twinPacketCanonicalSha256 !== record.twinPacket.canonicalSha256
    || record.twinPacket.opportunityId !== record.opportunityId
    || record.twinPacket.productionReady !== false
    || record.twinPacket.finalHumanDecision !== 'NOT_MADE') {
    fail('PILOT_TWIN_PACKET_BINDING_INVALID', `${path}.twinPacket`);
  }
  assertCanonicalHash(record, path);
}

export function validatePursuitValuePilotCaseCatalog(catalog, registry, verticalPack) {
  assertSafeArtifact(catalog, '$.caseCatalog');
  assertBoundary(catalog, '$.caseCatalog', CATALOG_SCHEMA);
  assertExactKeys(catalog, [
    'schemaVersion', 'boundary', 'executionBoundary', 'dataClass',
    'productionReady', 'issue165Status', 'synthetic',
    'registryCanonicalSha256', 'verticalPackCanonicalSha256',
    'caseCount', 'cases', 'canonicalSha256',
  ], '$.caseCatalog');
  if (catalog.dataClass !== 'REPOSITORY_REVIEWED_SYNTHETIC'
    || catalog.synthetic !== true
    || catalog.caseCount !== 5
    || !Array.isArray(catalog.cases)
    || catalog.cases.length !== 5
    || !HASH_PATTERN.test(catalog.registryCanonicalSha256 || '')
    || !HASH_PATTERN.test(catalog.verticalPackCanonicalSha256 || '')) {
    fail('PILOT_CASE_CATALOG_INVALID', '$.caseCatalog');
  }
  catalog.cases.forEach((record, index) => (
    validateCaseRecord(record, `PV-C${index + 1}`, `$.caseCatalog.cases[${index}]`)
  ));
  if (new Set(catalog.cases.map((record) => record.opportunityId)).size !== 5) {
    fail('PILOT_CASE_OPPORTUNITY_DUPLICATE', '$.caseCatalog.cases');
  }
  assertCanonicalHash(catalog, '$.caseCatalog');
  if (registry !== undefined || verticalPack !== undefined) {
    if (!registry || !verticalPack) fail('PILOT_DOMAIN_INPUTS_INCOMPLETE');
    const expected = buildPursuitValuePilotCaseCatalog(registry, verticalPack);
    if (canonicalStringify(expected) !== canonicalStringify(catalog)) {
      fail('PILOT_CASE_CATALOG_DOMAIN_MISMATCH', '$.caseCatalog');
    }
  }
  return clone(catalog);
}

function buildCaseBinding(caseRecord) {
  const requirementIds = caseRecord.baselineArtifact.projectOpportunity.requirements
    .map((requirement) => requirement.requirementId)
    .sort(compareAscii);
  const binding = {
    caseId: caseRecord.caseId,
    caseCanonicalSha256: caseRecord.canonicalSha256,
    baselineArtifactCanonicalSha256: caseRecord.baselineArtifactCanonicalSha256,
    twinPacketCanonicalSha256: caseRecord.twinPacketCanonicalSha256,
    allowedDecisionTraceRefs: [
      `${caseRecord.caseId}:SPEC_DELTA:${caseRecord.twinPacket.specificationDelta.canonicalSha256}`,
      `${caseRecord.caseId}:MINIMUM_EVIDENCE:${caseRecord.twinPacket.minimumEvidenceToAdvance.canonicalSha256}`,
      `${caseRecord.caseId}:DOSSIER:${caseRecord.twinPacket.currentPursuitDossierCanonicalSha256}`,
    ],
    allowedGapIds: requirementIds.map((requirementId) => `${caseRecord.caseId}:${requirementId}`),
  };
  return withCanonicalHash(binding);
}

function buildAssignment(blueprint) {
  const [reviewerId, assignedRole, presentationOrder, assignedBaselineCaseId, assignedTwinCaseId] = blueprint;
  return withCanonicalHash({
    reviewerId,
    assignedRole,
    presentationOrder,
    assignedBaselineCaseId,
    assignedTwinCaseId,
  });
}

export function buildPursuitValuePilotProtocol(registry, verticalPack, { caseCatalog } = {}) {
  const catalog = caseCatalog || buildPursuitValuePilotCaseCatalog(registry, verticalPack);
  validatePursuitValuePilotCaseCatalog(catalog, registry, verticalPack);
  const protocol = withCanonicalHash({
    schemaVersion: PROTOCOL_SCHEMA,
    boundary: PURSUIT_VALUE_PILOT_BOUNDARY,
    executionBoundary: PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY,
    dataClass: 'REPOSITORY_REVIEWED_SYNTHETIC',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    method: 'COUNTERBALANCED_MATCHED_SYNTHETIC_PROJECT_REVIEW',
    catalogCanonicalSha256: catalog.canonicalSha256,
    registryCanonicalSha256: catalog.registryCanonicalSha256,
    verticalPackCanonicalSha256: catalog.verticalPackCanonicalSha256,
    caseBindings: catalog.cases.map(buildCaseBinding),
    reviewerAssignments: ASSIGNMENT_BLUEPRINT.map(buildAssignment),
    teamWeekAssignments: [{ teamWeekId: 'PV-WEEK-1', teamId: 'TEAM-1' }],
    thresholds: {
      pairedMedianTimeReductionBasisPoints: 5_000,
      traceableDecisionBasisPoints: 10_000,
      acceptedTechnicalStateBasisPoints: 7_000,
      acceptedTechnicalStateMinimumCount: 4,
      keyGapProjectCoverageBasisPoints: 10_000,
      keyGapMeanMinimumMilli: 1_000,
      unsupportedCustomerUseClaimMaximumCount: 0,
      repeatUseMinimumCount: 3,
      weeklyTeamMinimumCount: 1,
      weeklyTeamRepeatUseObserved: 'YES',
      weeklyTeamMinimumPacketUseCount: 2,
      weeklyTeamMaximumWindowDays: 7,
    },
    fixedDenominators: { reviewers: 5, twinProjects: 5, teamWeeks: 1 },
    systemFinalDecisionAcceptance: 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION',
    automaticPilotDecision: false,
    pilotDisposition: 'NOT_MADE',
  });
  validatePursuitValuePilotProtocol(protocol);
  return protocol;
}

function assertBinding(binding, expectedCaseId, path) {
  assertExactKeys(binding, [
    'caseId', 'caseCanonicalSha256', 'baselineArtifactCanonicalSha256',
    'twinPacketCanonicalSha256', 'allowedDecisionTraceRefs',
    'allowedGapIds', 'canonicalSha256',
  ], path);
  if (binding.caseId !== expectedCaseId
    || !HASH_PATTERN.test(binding.caseCanonicalSha256 || '')
    || !HASH_PATTERN.test(binding.baselineArtifactCanonicalSha256 || '')
    || !HASH_PATTERN.test(binding.twinPacketCanonicalSha256 || '')
    || !Array.isArray(binding.allowedDecisionTraceRefs)
    || binding.allowedDecisionTraceRefs.length < 1
    || new Set(binding.allowedDecisionTraceRefs).size !== binding.allowedDecisionTraceRefs.length
    || binding.allowedDecisionTraceRefs.some((value) => typeof value !== 'string' || !value.startsWith(`${expectedCaseId}:`))
    || !Array.isArray(binding.allowedGapIds)
    || binding.allowedGapIds.length < 1
    || new Set(binding.allowedGapIds).size !== binding.allowedGapIds.length
    || binding.allowedGapIds.some((value) => typeof value !== 'string' || !value.startsWith(`${expectedCaseId}:`))) {
    fail('PILOT_CASE_BINDING_INVALID', path);
  }
  assertCanonicalHash(binding, path);
}

function assertAssignment(assignment, blueprint, path) {
  assertExactKeys(assignment, [
    'reviewerId', 'assignedRole', 'presentationOrder',
    'assignedBaselineCaseId', 'assignedTwinCaseId', 'canonicalSha256',
  ], path);
  const expected = buildAssignment(blueprint);
  if (canonicalStringify(assignment) !== canonicalStringify(expected)) {
    fail('PILOT_REVIEWER_ASSIGNMENT_INVALID', path);
  }
  assertCanonicalHash(assignment, path);
}

export function validatePursuitValuePilotProtocol(protocol, registry, verticalPack) {
  assertSafeArtifact(protocol, '$.protocol');
  assertBoundary(protocol, '$.protocol', PROTOCOL_SCHEMA);
  assertExactKeys(protocol, [
    'schemaVersion', 'boundary', 'executionBoundary', 'dataClass',
    'productionReady', 'productionReviewerWorkflowReady', 'issue165Status',
    'synthetic', 'method', 'catalogCanonicalSha256',
    'registryCanonicalSha256', 'verticalPackCanonicalSha256', 'caseBindings',
    'reviewerAssignments', 'teamWeekAssignments', 'thresholds',
    'fixedDenominators', 'systemFinalDecisionAcceptance',
    'automaticPilotDecision', 'pilotDisposition', 'canonicalSha256',
  ], '$.protocol');
  if (protocol.dataClass !== 'REPOSITORY_REVIEWED_SYNTHETIC'
    || protocol.productionReviewerWorkflowReady !== false
    || protocol.synthetic !== true
    || protocol.method !== 'COUNTERBALANCED_MATCHED_SYNTHETIC_PROJECT_REVIEW'
    || !HASH_PATTERN.test(protocol.catalogCanonicalSha256 || '')
    || !HASH_PATTERN.test(protocol.registryCanonicalSha256 || '')
    || !HASH_PATTERN.test(protocol.verticalPackCanonicalSha256 || '')
    || protocol.systemFinalDecisionAcceptance !== 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION'
    || protocol.automaticPilotDecision !== false
    || protocol.pilotDisposition !== 'NOT_MADE') {
    fail('PILOT_PROTOCOL_INVALID', '$.protocol');
  }
  if (!Array.isArray(protocol.caseBindings) || protocol.caseBindings.length !== 5) {
    fail('PILOT_CASE_BINDINGS_INVALID', '$.protocol.caseBindings');
  }
  protocol.caseBindings.forEach((binding, index) => (
    assertBinding(binding, `PV-C${index + 1}`, `$.protocol.caseBindings[${index}]`)
  ));
  if (!Array.isArray(protocol.reviewerAssignments) || protocol.reviewerAssignments.length !== 5) {
    fail('PILOT_REVIEWER_ASSIGNMENTS_INVALID', '$.protocol.reviewerAssignments');
  }
  protocol.reviewerAssignments.forEach((assignment, index) => (
    assertAssignment(assignment, ASSIGNMENT_BLUEPRINT[index], `$.protocol.reviewerAssignments[${index}]`)
  ));
  const baselineCases = protocol.reviewerAssignments.map((item) => item.assignedBaselineCaseId).sort(compareAscii);
  const twinCases = protocol.reviewerAssignments.map((item) => item.assignedTwinCaseId).sort(compareAscii);
  if (canonicalStringify(baselineCases) !== canonicalStringify(['PV-C1', 'PV-C2', 'PV-C3', 'PV-C4', 'PV-C5'])
    || canonicalStringify(twinCases) !== canonicalStringify(['PV-C1', 'PV-C2', 'PV-C3', 'PV-C4', 'PV-C5'])
    || protocol.reviewerAssignments.some((item) => item.assignedBaselineCaseId === item.assignedTwinCaseId)
    || !protocol.reviewerAssignments.some((item) => item.presentationOrder === 'BASELINE_FIRST')
    || !protocol.reviewerAssignments.some((item) => item.presentationOrder === 'TWIN_FIRST')) {
    fail('PILOT_COUNTERBALANCE_INVALID', '$.protocol.reviewerAssignments');
  }
  if (canonicalStringify(protocol.teamWeekAssignments) !== canonicalStringify([
    { teamWeekId: 'PV-WEEK-1', teamId: 'TEAM-1' },
  ])) fail('PILOT_TEAM_WEEK_ASSIGNMENT_INVALID', '$.protocol.teamWeekAssignments');
  if (canonicalStringify(protocol.thresholds) !== canonicalStringify({
    pairedMedianTimeReductionBasisPoints: 5_000,
    traceableDecisionBasisPoints: 10_000,
    acceptedTechnicalStateBasisPoints: 7_000,
    acceptedTechnicalStateMinimumCount: 4,
    keyGapProjectCoverageBasisPoints: 10_000,
    keyGapMeanMinimumMilli: 1_000,
    unsupportedCustomerUseClaimMaximumCount: 0,
    repeatUseMinimumCount: 3,
    weeklyTeamMinimumCount: 1,
    weeklyTeamRepeatUseObserved: 'YES',
    weeklyTeamMinimumPacketUseCount: 2,
    weeklyTeamMaximumWindowDays: 7,
  }) || canonicalStringify(protocol.fixedDenominators) !== canonicalStringify({
    reviewers: 5, twinProjects: 5, teamWeeks: 1,
  })) fail('PILOT_THRESHOLDS_INVALID', '$.protocol.thresholds');
  assertCanonicalHash(protocol, '$.protocol');
  if (registry !== undefined || verticalPack !== undefined) {
    if (!registry || !verticalPack) fail('PILOT_DOMAIN_INPUTS_INCOMPLETE');
    const expectedCatalog = buildPursuitValuePilotCaseCatalog(registry, verticalPack);
    const expected = buildPursuitValuePilotProtocol(registry, verticalPack, { caseCatalog: expectedCatalog });
    if (canonicalStringify(expected) !== canonicalStringify(protocol)) {
      fail('PILOT_PROTOCOL_DOMAIN_MISMATCH', '$.protocol');
    }
  }
  return clone(protocol);
}

function assignmentFor(protocol, reviewerId) {
  const matches = protocol.reviewerAssignments.filter((item) => item.reviewerId === reviewerId);
  if (matches.length !== 1) fail('PILOT_REVIEWER_ASSIGNMENT_NOT_FOUND', '$.reviewerId');
  return matches[0];
}

function bindingFor(protocol, caseId) {
  const matches = protocol.caseBindings.filter((item) => item.caseId === caseId);
  if (matches.length !== 1) fail('PILOT_CASE_BINDING_NOT_FOUND', '$.caseId');
  return matches[0];
}

function blankTrial(caseId) {
  return {
    caseId,
    startedAt: null,
    completedAt: null,
    elapsedSeconds: null,
    humanDecision: null,
    evidenceTraceAttestation: null,
    selectedDecisionTraceRefs: [],
    gapAssessments: [],
  };
}

function blankHumanInput(assignment) {
  return {
    role: null,
    experienceBand: null,
    eligibilityConfirmed: null,
    syntheticOnlyConfirmed: null,
    baseline: blankTrial(assignment.assignedBaselineCaseId),
    twin: blankTrial(assignment.assignedTwinCaseId),
    technicalStateDisposition: null,
    unsupportedCustomerUseClaimObserved: null,
    unsupportedCustomerUseClaimCount: null,
    wouldUseAgain: null,
    weeklyUseIntent: null,
    willingnessToPay: null,
    decisionImpact: null,
    finalDisposition: null,
  };
}

function makeSession(protocol, assignment, humanInput, humanEvidenceStatus) {
  return withCanonicalHash({
    schemaVersion: SESSION_SCHEMA,
    boundary: PURSUIT_VALUE_PILOT_BOUNDARY,
    executionBoundary: PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY,
    dataClass: 'DEIDENTIFIED_STRUCTURED_HUMAN_INPUT',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    reviewerIdentity: 'NOT_COLLECTED',
    synthetic: true,
    protocolCanonicalSha256: protocol.canonicalSha256,
    sessionId: `PV-SESSION-${assignment.reviewerId.slice(-2)}`,
    reviewerId: assignment.reviewerId,
    assignmentCanonicalSha256: assignment.canonicalSha256,
    assignedRole: assignment.assignedRole,
    presentationOrder: assignment.presentationOrder,
    assignedBaselineCaseId: assignment.assignedBaselineCaseId,
    assignedTwinCaseId: assignment.assignedTwinCaseId,
    humanEvidenceStatus,
    systemFinalDecisionAcceptance: 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION',
    automaticPilotDecision: false,
    pilotDisposition: 'NOT_MADE',
    finalHumanDecision: 'NOT_MADE',
    humanInput,
  });
}

export function buildBlankPursuitValuePilotSession(protocol, reviewerId) {
  validatePursuitValuePilotProtocol(protocol);
  if (!REVIEWER_PATTERN.test(reviewerId || '')) fail('PILOT_REVIEWER_ID_INVALID', '$.reviewerId');
  const assignment = assignmentFor(protocol, reviewerId);
  const session = makeSession(protocol, assignment, blankHumanInput(assignment), 'INCOMPLETE');
  validatePursuitValuePilotSession(session, protocol);
  return session;
}

function assertTrialShape(trial, caseId, path) {
  assertExactKeys(trial, [
    'caseId', 'startedAt', 'completedAt', 'elapsedSeconds', 'humanDecision',
    'evidenceTraceAttestation', 'selectedDecisionTraceRefs', 'gapAssessments',
  ], path);
  if (trial.caseId !== caseId
    || !Array.isArray(trial.selectedDecisionTraceRefs)
    || !Array.isArray(trial.gapAssessments)) fail('PILOT_TRIAL_INVALID', path);
}

function validateCompletedTrial(trial, { phase, binding }, path) {
  const startedAt = assertIso(trial.startedAt, `${path}.startedAt`);
  const completedAt = assertIso(trial.completedAt, `${path}.completedAt`);
  if (completedAt < startedAt
    || !Number.isInteger(trial.elapsedSeconds)
    || trial.elapsedSeconds < 1
    || trial.elapsedSeconds > MAX_DURATION_SECONDS) {
    fail('PILOT_TRIAL_TIMING_INVALID', path);
  }
  assertEnum(trial.humanDecision, HUMAN_DECISIONS, `${path}.humanDecision`);
  if (phase === 'baseline') {
    if (trial.evidenceTraceAttestation !== null
      || trial.selectedDecisionTraceRefs.length !== 0
      || trial.gapAssessments.length !== 0) {
      fail('PILOT_BASELINE_ASSISTED_INPUT_REFUSED', path);
    }
    return;
  }
  assertEnum(trial.evidenceTraceAttestation, YES_NO, `${path}.evidenceTraceAttestation`);
  if (new Set(trial.selectedDecisionTraceRefs).size !== trial.selectedDecisionTraceRefs.length
    || trial.selectedDecisionTraceRefs.some((reference) => !binding.allowedDecisionTraceRefs.includes(reference))
    || (trial.evidenceTraceAttestation === 'YES' && trial.selectedDecisionTraceRefs.length === 0)
    || (trial.evidenceTraceAttestation === 'NO' && trial.selectedDecisionTraceRefs.length !== 0)) {
    fail('PILOT_DECISION_TRACE_INVALID', `${path}.selectedDecisionTraceRefs`);
  }
  const seenGaps = new Set();
  trial.gapAssessments.forEach((assessment, index) => {
    const assessmentPath = `${path}.gapAssessments[${index}]`;
    assertExactKeys(assessment, [
      'gapId', 'materiality', 'priorAwareness', 'discoveredBeforeDecision',
    ], assessmentPath);
    if (!binding.allowedGapIds.includes(assessment.gapId) || seenGaps.has(assessment.gapId)) {
      fail('PILOT_GAP_ID_INVALID', `${assessmentPath}.gapId`);
    }
    seenGaps.add(assessment.gapId);
    assertEnum(assessment.materiality, GAP_MATERIALITY, `${assessmentPath}.materiality`);
    assertEnum(assessment.priorAwareness, YES_NO_UNSURE, `${assessmentPath}.priorAwareness`);
    assertEnum(assessment.discoveredBeforeDecision, YES_NO, `${assessmentPath}.discoveredBeforeDecision`);
  });
}

function assertHumanInputShape(humanInput, assignment, path) {
  assertExactKeys(humanInput, [
    'role', 'experienceBand', 'eligibilityConfirmed', 'syntheticOnlyConfirmed',
    'baseline', 'twin', 'technicalStateDisposition',
    'unsupportedCustomerUseClaimObserved', 'unsupportedCustomerUseClaimCount',
    'wouldUseAgain', 'weeklyUseIntent', 'willingnessToPay', 'decisionImpact',
    'finalDisposition',
  ], path);
  assertTrialShape(humanInput.baseline, assignment.assignedBaselineCaseId, `${path}.baseline`);
  assertTrialShape(humanInput.twin, assignment.assignedTwinCaseId, `${path}.twin`);
}

function validateCompletedHumanInput(humanInput, assignment, protocol) {
  if (humanInput.role !== assignment.assignedRole) {
    fail('PILOT_REVIEWER_ROLE_INELIGIBLE', '$.session.humanInput.role');
  }
  assertEnum(humanInput.role, ROLES, '$.session.humanInput.role');
  assertEnum(humanInput.experienceBand, EXPERIENCE_BANDS, '$.session.humanInput.experienceBand');
  if (humanInput.eligibilityConfirmed !== 'YES' || humanInput.syntheticOnlyConfirmed !== 'YES') {
    fail('PILOT_REVIEWER_ATTESTATION_REQUIRED', '$.session.humanInput');
  }
  validateCompletedTrial(humanInput.baseline, {
    phase: 'baseline',
    binding: bindingFor(protocol, assignment.assignedBaselineCaseId),
  }, '$.session.humanInput.baseline');
  validateCompletedTrial(humanInput.twin, {
    phase: 'twin',
    binding: bindingFor(protocol, assignment.assignedTwinCaseId),
  }, '$.session.humanInput.twin');
  const baselineStartedAt = assertIso(
    humanInput.baseline.startedAt,
    '$.session.humanInput.baseline.startedAt',
  );
  const baselineCompletedAt = assertIso(
    humanInput.baseline.completedAt,
    '$.session.humanInput.baseline.completedAt',
  );
  const twinStartedAt = assertIso(
    humanInput.twin.startedAt,
    '$.session.humanInput.twin.startedAt',
  );
  const twinCompletedAt = assertIso(
    humanInput.twin.completedAt,
    '$.session.humanInput.twin.completedAt',
  );
  if ((assignment.presentationOrder === 'BASELINE_FIRST' && baselineCompletedAt > twinStartedAt)
    || (assignment.presentationOrder === 'TWIN_FIRST' && twinCompletedAt > baselineStartedAt)) {
    fail('PILOT_PRESENTATION_ORDER_TIMING_INVALID', '$.session.humanInput');
  }
  assertEnum(
    humanInput.technicalStateDisposition,
    TECHNICAL_DISPOSITIONS,
    '$.session.humanInput.technicalStateDisposition',
  );
  assertEnum(
    humanInput.unsupportedCustomerUseClaimObserved,
    YES_NO,
    '$.session.humanInput.unsupportedCustomerUseClaimObserved',
  );
  if (!Number.isInteger(humanInput.unsupportedCustomerUseClaimCount)
    || humanInput.unsupportedCustomerUseClaimCount < 0
    || humanInput.unsupportedCustomerUseClaimCount > 100
    || (humanInput.unsupportedCustomerUseClaimObserved === 'NO'
      && humanInput.unsupportedCustomerUseClaimCount !== 0)
    || (humanInput.unsupportedCustomerUseClaimObserved === 'YES'
      && humanInput.unsupportedCustomerUseClaimCount < 1)) {
    fail('PILOT_UNSUPPORTED_CLAIM_COUNT_INVALID', '$.session.humanInput.unsupportedCustomerUseClaimCount');
  }
  assertEnum(humanInput.wouldUseAgain, YES_NO, '$.session.humanInput.wouldUseAgain');
  assertEnum(humanInput.weeklyUseIntent, YES_NO_UNSURE, '$.session.humanInput.weeklyUseIntent');
  assertEnum(humanInput.willingnessToPay, YES_NO_UNSURE, '$.session.humanInput.willingnessToPay');
  assertEnum(humanInput.decisionImpact, DECISION_IMPACTS, '$.session.humanInput.decisionImpact');
  assertEnum(humanInput.finalDisposition, FINAL_DISPOSITIONS, '$.session.humanInput.finalDisposition');
}

export function validatePursuitValuePilotSession(session, protocol) {
  validatePursuitValuePilotProtocol(protocol);
  assertSafeArtifact(session, '$.session');
  assertBoundary(session, '$.session', SESSION_SCHEMA);
  assertExactKeys(session, [
    'schemaVersion', 'boundary', 'executionBoundary', 'dataClass',
    'productionReady', 'productionReviewerWorkflowReady', 'issue165Status',
    'reviewerIdentity', 'synthetic', 'protocolCanonicalSha256', 'sessionId',
    'reviewerId', 'assignmentCanonicalSha256', 'assignedRole',
    'presentationOrder', 'assignedBaselineCaseId', 'assignedTwinCaseId',
    'humanEvidenceStatus', 'systemFinalDecisionAcceptance',
    'automaticPilotDecision', 'pilotDisposition', 'finalHumanDecision',
    'humanInput', 'canonicalSha256',
  ], '$.session');
  if (!REVIEWER_PATTERN.test(session.reviewerId || '')) fail('PILOT_REVIEWER_ID_INVALID', '$.session.reviewerId');
  const assignment = assignmentFor(protocol, session.reviewerId);
  if (session.dataClass !== 'DEIDENTIFIED_STRUCTURED_HUMAN_INPUT'
    || session.productionReviewerWorkflowReady !== false
    || session.reviewerIdentity !== 'NOT_COLLECTED'
    || session.synthetic !== true
    || session.protocolCanonicalSha256 !== protocol.canonicalSha256
    || session.sessionId !== `PV-SESSION-${session.reviewerId.slice(-2)}`
    || session.assignmentCanonicalSha256 !== assignment.canonicalSha256
    || session.assignedRole !== assignment.assignedRole
    || session.presentationOrder !== assignment.presentationOrder
    || session.assignedBaselineCaseId !== assignment.assignedBaselineCaseId
    || session.assignedTwinCaseId !== assignment.assignedTwinCaseId
    || session.systemFinalDecisionAcceptance !== 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION'
    || session.automaticPilotDecision !== false
    || session.pilotDisposition !== 'NOT_MADE'
    || session.finalHumanDecision !== 'NOT_MADE') {
    fail('PILOT_SESSION_BINDING_INVALID', '$.session');
  }
  assertHumanInputShape(session.humanInput, assignment, '$.session.humanInput');
  const blank = blankHumanInput(assignment);
  if (session.humanEvidenceStatus === 'INCOMPLETE') {
    if (canonicalStringify(session.humanInput) !== canonicalStringify(blank)) {
      fail('PILOT_PARTIAL_HUMAN_INPUT_REFUSED', '$.session.humanInput');
    }
  } else if (session.humanEvidenceStatus === 'COMPLETED') {
    validateCompletedHumanInput(session.humanInput, assignment, protocol);
  } else {
    fail('PILOT_HUMAN_EVIDENCE_STATUS_INVALID', '$.session.humanEvidenceStatus');
  }
  assertCanonicalHash(session, '$.session');
  return clone(session);
}

export function buildCompletedPursuitValuePilotSession(protocol, reviewerId, humanInput) {
  validatePursuitValuePilotProtocol(protocol);
  const assignment = assignmentFor(protocol, reviewerId);
  const session = makeSession(protocol, assignment, clone(humanInput), 'COMPLETED');
  return validatePursuitValuePilotSession(session, protocol);
}

export function validatePursuitValuePilotSessionResponseEnvelope(
  envelope,
  protocol,
  blankSession,
) {
  validatePursuitValuePilotProtocol(protocol);
  const validatedBlank = validatePursuitValuePilotSession(blankSession, protocol);
  if (validatedBlank.humanEvidenceStatus !== 'INCOMPLETE') {
    fail('PILOT_BLANK_SESSION_REQUIRED', '$.blankSession');
  }
  assertSafeArtifact(envelope, '$.responseEnvelope');
  assertExactKeys(envelope, [
    'schemaVersion', 'protocolCanonicalSha256', 'blankSessionCanonicalSha256',
    'sessionId', 'reviewerId', 'humanInput',
  ], '$.responseEnvelope');
  if (envelope.schemaVersion !== RESPONSE_SCHEMA
    || envelope.protocolCanonicalSha256 !== protocol.canonicalSha256
    || envelope.blankSessionCanonicalSha256 !== validatedBlank.canonicalSha256
    || envelope.sessionId !== validatedBlank.sessionId
    || envelope.reviewerId !== validatedBlank.reviewerId) {
    fail('PILOT_RESPONSE_ENVELOPE_BINDING_INVALID', '$.responseEnvelope');
  }
  const completed = buildCompletedPursuitValuePilotSession(
    protocol,
    validatedBlank.reviewerId,
    envelope.humanInput,
  );
  return { envelope: clone(envelope), completedSession: completed };
}

export function materializePursuitValuePilotSessionResponse(
  envelope,
  blankSession,
  protocol,
) {
  return validatePursuitValuePilotSessionResponseEnvelope(
    envelope,
    protocol,
    blankSession,
  ).completedSession;
}

function blankTeamHumanInput() {
  return {
    participationConfirmed: null,
    syntheticOnlyConfirmed: null,
    weekStartedAt: null,
    weekCompletedAt: null,
    packetUseCount: null,
    repeatUseObserved: null,
  };
}

function makeTeamWeek(protocol, teamWeekId, humanInput, humanEvidenceStatus) {
  return withCanonicalHash({
    schemaVersion: TEAM_WEEK_SCHEMA,
    boundary: PURSUIT_VALUE_PILOT_BOUNDARY,
    executionBoundary: PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY,
    dataClass: 'DEIDENTIFIED_STRUCTURED_TEAM_INPUT',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    teamIdentity: 'NOT_COLLECTED',
    synthetic: true,
    protocolCanonicalSha256: protocol.canonicalSha256,
    teamWeekId,
    teamId: 'TEAM-1',
    reviewerIds: [...PURSUIT_VALUE_PILOT_REVIEWER_IDS],
    humanEvidenceStatus,
    automaticPilotDecision: false,
    pilotDisposition: 'NOT_MADE',
    humanInput,
  });
}

export function buildBlankPursuitValuePilotTeamWeek(protocol, teamWeekId = 'PV-WEEK-1') {
  validatePursuitValuePilotProtocol(protocol);
  if (teamWeekId !== 'PV-WEEK-1') fail('PILOT_TEAM_WEEK_ID_INVALID', '$.teamWeekId');
  const record = makeTeamWeek(protocol, teamWeekId, blankTeamHumanInput(), 'INCOMPLETE');
  validatePursuitValuePilotTeamWeek(record, protocol);
  return record;
}

export function buildCompletedPursuitValuePilotTeamWeek(protocol, humanInput) {
  validatePursuitValuePilotProtocol(protocol);
  const record = makeTeamWeek(protocol, 'PV-WEEK-1', clone(humanInput), 'COMPLETED');
  return validatePursuitValuePilotTeamWeek(record, protocol);
}

export function buildBlankPursuitValuePilotTeamWeekResponseEnvelope(protocol, blankTeamWeek) {
  validatePursuitValuePilotProtocol(protocol);
  const blank = validatePursuitValuePilotTeamWeek(blankTeamWeek, protocol);
  if (blank.humanEvidenceStatus !== 'INCOMPLETE') {
    fail('PILOT_BLANK_TEAM_WEEK_REQUIRED', '$.blankTeamWeek');
  }
  return clone({
    schemaVersion: TEAM_WEEK_RESPONSE_SCHEMA,
    protocolCanonicalSha256: protocol.canonicalSha256,
    blankTeamWeekCanonicalSha256: blank.canonicalSha256,
    teamWeekId: blank.teamWeekId,
    teamId: blank.teamId,
    humanInput: blank.humanInput,
  });
}

export function materializePursuitValuePilotTeamWeekResponse(
  envelope,
  blankTeamWeek,
  protocol,
) {
  validatePursuitValuePilotProtocol(protocol);
  const blank = validatePursuitValuePilotTeamWeek(blankTeamWeek, protocol);
  if (blank.humanEvidenceStatus !== 'INCOMPLETE') {
    fail('PILOT_BLANK_TEAM_WEEK_REQUIRED', '$.blankTeamWeek');
  }
  assertSafeArtifact(envelope, '$.teamWeekResponseEnvelope');
  assertExactKeys(envelope, [
    'schemaVersion', 'protocolCanonicalSha256', 'blankTeamWeekCanonicalSha256',
    'teamWeekId', 'teamId', 'humanInput',
  ], '$.teamWeekResponseEnvelope');
  if (envelope.schemaVersion !== TEAM_WEEK_RESPONSE_SCHEMA
    || envelope.protocolCanonicalSha256 !== protocol.canonicalSha256
    || envelope.blankTeamWeekCanonicalSha256 !== blank.canonicalSha256
    || envelope.teamWeekId !== blank.teamWeekId
    || envelope.teamId !== blank.teamId) {
    fail('PILOT_TEAM_WEEK_RESPONSE_BINDING_INVALID', '$.teamWeekResponseEnvelope');
  }
  assertExactKeys(envelope.humanInput, [
    'participationConfirmed', 'syntheticOnlyConfirmed', 'weekStartedAt',
    'weekCompletedAt', 'packetUseCount', 'repeatUseObserved',
  ], '$.teamWeekResponseEnvelope.humanInput');
  if (canonicalStringify(envelope.humanInput) === canonicalStringify(blank.humanInput)) {
    return blank;
  }
  return buildCompletedPursuitValuePilotTeamWeek(protocol, envelope.humanInput);
}

export function validatePursuitValuePilotTeamWeek(record, protocol) {
  validatePursuitValuePilotProtocol(protocol);
  assertSafeArtifact(record, '$.teamWeek');
  assertBoundary(record, '$.teamWeek', TEAM_WEEK_SCHEMA);
  assertExactKeys(record, [
    'schemaVersion', 'boundary', 'executionBoundary', 'dataClass',
    'productionReady', 'productionReviewerWorkflowReady', 'issue165Status',
    'teamIdentity', 'synthetic', 'protocolCanonicalSha256', 'teamWeekId',
    'teamId', 'reviewerIds', 'humanEvidenceStatus', 'automaticPilotDecision',
    'pilotDisposition', 'humanInput', 'canonicalSha256',
  ], '$.teamWeek');
  assertExactKeys(record.humanInput, [
    'participationConfirmed', 'syntheticOnlyConfirmed', 'weekStartedAt',
    'weekCompletedAt', 'packetUseCount', 'repeatUseObserved',
  ], '$.teamWeek.humanInput');
  if (record.dataClass !== 'DEIDENTIFIED_STRUCTURED_TEAM_INPUT'
    || record.productionReviewerWorkflowReady !== false
    || record.teamIdentity !== 'NOT_COLLECTED'
    || record.synthetic !== true
    || record.protocolCanonicalSha256 !== protocol.canonicalSha256
    || record.teamWeekId !== 'PV-WEEK-1'
    || record.teamId !== 'TEAM-1'
    || canonicalStringify(record.reviewerIds) !== canonicalStringify(PURSUIT_VALUE_PILOT_REVIEWER_IDS)
    || record.automaticPilotDecision !== false
    || record.pilotDisposition !== 'NOT_MADE') {
    fail('PILOT_TEAM_WEEK_BINDING_INVALID', '$.teamWeek');
  }
  if (record.humanEvidenceStatus === 'INCOMPLETE') {
    if (canonicalStringify(record.humanInput) !== canonicalStringify(blankTeamHumanInput())) {
      fail('PILOT_PARTIAL_TEAM_INPUT_REFUSED', '$.teamWeek.humanInput');
    }
  } else if (record.humanEvidenceStatus === 'COMPLETED') {
    const input = record.humanInput;
    if (input.participationConfirmed !== 'YES' || input.syntheticOnlyConfirmed !== 'YES') {
      fail('PILOT_TEAM_ATTESTATION_REQUIRED', '$.teamWeek.humanInput');
    }
    const start = assertIso(input.weekStartedAt, '$.teamWeek.humanInput.weekStartedAt');
    const end = assertIso(input.weekCompletedAt, '$.teamWeek.humanInput.weekCompletedAt');
    if (end <= start
      || end - start > protocol.thresholds.weeklyTeamMaximumWindowDays * 24 * 60 * 60 * 1_000
      || !Number.isInteger(input.packetUseCount)
      || input.packetUseCount < 1
      || input.packetUseCount > 100) {
      fail('PILOT_TEAM_WEEK_USAGE_INVALID', '$.teamWeek.humanInput');
    }
    assertEnum(input.repeatUseObserved, YES_NO, '$.teamWeek.humanInput.repeatUseObserved');
    const repeatedUseByCount = input.packetUseCount
      >= protocol.thresholds.weeklyTeamMinimumPacketUseCount;
    const repeatedUseAttested = input.repeatUseObserved
      === protocol.thresholds.weeklyTeamRepeatUseObserved;
    if (repeatedUseByCount !== repeatedUseAttested) {
      fail('PILOT_TEAM_WEEK_REPEAT_USE_CONTRADICTION', '$.teamWeek.humanInput');
    }
  } else {
    fail('PILOT_HUMAN_EVIDENCE_STATUS_INVALID', '$.teamWeek.humanEvidenceStatus');
  }
  assertCanonicalHash(record, '$.teamWeek');
  return clone(record);
}

function basisPoints(numerator, denominator) {
  return denominator === 0 ? 0 : Math.round((numerator * 10_000) / denominator);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function metric(status, fields) {
  return { status, ...fields };
}

function criterion(status, observed, target) {
  return { status, observed, target };
}

function validatedInputSet(protocol, sessions, teamWeeks) {
  if (!Array.isArray(sessions) || sessions.length !== 5) {
    fail('PILOT_SESSION_SET_INVALID', '$.sessions');
  }
  if (!Array.isArray(teamWeeks) || teamWeeks.length !== 1) {
    fail('PILOT_TEAM_WEEK_SET_INVALID', '$.teamWeeks');
  }
  const validatedSessions = sessions.map((session) => validatePursuitValuePilotSession(session, protocol));
  const reviewerIds = validatedSessions.map((session) => session.reviewerId).sort(compareAscii);
  if (canonicalStringify(reviewerIds) !== canonicalStringify(PURSUIT_VALUE_PILOT_REVIEWER_IDS)) {
    fail('PILOT_SESSION_SET_INVALID', '$.sessions');
  }
  const validatedTeamWeeks = teamWeeks.map((record) => validatePursuitValuePilotTeamWeek(record, protocol));
  return { validatedSessions, validatedTeamWeeks };
}

function computeAggregate(protocol, sessions, teamWeeks) {
  const { validatedSessions, validatedTeamWeeks } = validatedInputSet(protocol, sessions, teamWeeks);
  const completedSessions = validatedSessions.filter((session) => session.humanEvidenceStatus === 'COMPLETED');
  const completedTeamWeeks = validatedTeamWeeks.filter((record) => record.humanEvidenceStatus === 'COMPLETED');
  const repeatedUseTeamWeeks = completedTeamWeeks.filter((record) => (
    record.humanInput.repeatUseObserved === protocol.thresholds.weeklyTeamRepeatUseObserved
    && record.humanInput.packetUseCount >= protocol.thresholds.weeklyTeamMinimumPacketUseCount
  ));
  const complete = completedSessions.length === 5 && completedTeamWeeks.length === 1;
  const evaluationStatus = complete ? 'EVALUATED' : 'INCOMPLETE';

  let pairedReductions = [];
  let traceableCount = 0;
  let acceptedTechnicalStateCount = 0;
  let keyGapProjectCount = 0;
  let keyGapCount = 0;
  let unsupportedClaimCount = 0;
  let repeatUseCount = 0;
  if (complete) {
    pairedReductions = completedSessions.map((session) => {
      const baseline = session.humanInput.baseline.elapsedSeconds;
      const twin = session.humanInput.twin.elapsedSeconds;
      return Math.round(((baseline - twin) * 10_000) / baseline);
    });
    traceableCount = completedSessions.filter((session) => (
      session.humanInput.twin.evidenceTraceAttestation === 'YES'
      && session.humanInput.twin.selectedDecisionTraceRefs.length > 0
    )).length;
    acceptedTechnicalStateCount = completedSessions.filter((session) => (
      session.humanInput.technicalStateDisposition === 'ACCEPTED_AS_WRITTEN'
    )).length;
    const keyGapCounts = completedSessions.map((session) => session.humanInput.twin.gapAssessments
      .filter((assessment) => (
        assessment.materiality === 'KEY'
        && assessment.discoveredBeforeDecision === 'YES'
      )).length);
    keyGapProjectCount = keyGapCounts.filter((count) => count > 0).length;
    keyGapCount = keyGapCounts.reduce((total, count) => total + count, 0);
    unsupportedClaimCount = completedSessions.reduce((total, session) => (
      total + session.humanInput.unsupportedCustomerUseClaimCount
    ), 0);
    repeatUseCount = completedSessions.filter((session) => session.humanInput.wouldUseAgain === 'YES').length;
  }

  const medianReduction = complete ? median(pairedReductions) : null;
  const traceableBasisPoints = complete ? basisPoints(traceableCount, 5) : null;
  const acceptedBasisPoints = complete ? basisPoints(acceptedTechnicalStateCount, 5) : null;
  const keyGapCoverageBasisPoints = complete ? basisPoints(keyGapProjectCount, 5) : null;
  const keyGapMeanMilli = complete ? Math.round((keyGapCount * 1_000) / 5) : null;
  const criteria = {
    pairedInitialReviewTimeReduction: criterion(
      complete ? (medianReduction >= 5_000 ? 'MET' : 'NOT_MET') : 'INCOMPLETE',
      medianReduction,
      { operator: 'GTE', value: 5_000, unit: 'BASIS_POINTS' },
    ),
    traceableHumanDecisions: criterion(
      complete ? (traceableBasisPoints === 10_000 ? 'MET' : 'NOT_MET') : 'INCOMPLETE',
      traceableBasisPoints,
      { operator: 'EQ', value: 10_000, unit: 'BASIS_POINTS' },
    ),
    acceptedTechnicalState: criterion(
      complete ? (acceptedTechnicalStateCount >= 4 && acceptedBasisPoints >= 7_000 ? 'MET' : 'NOT_MET') : 'INCOMPLETE',
      complete ? { count: acceptedTechnicalStateCount, basisPoints: acceptedBasisPoints } : null,
      { operator: 'GTE', count: 4, basisPoints: 7_000 },
    ),
    keyGapProjectCoverage: criterion(
      complete ? (keyGapCoverageBasisPoints === 10_000 && keyGapMeanMilli >= 1_000 ? 'MET' : 'NOT_MET') : 'INCOMPLETE',
      complete ? { coverageBasisPoints: keyGapCoverageBasisPoints, meanMilli: keyGapMeanMilli } : null,
      { coverageBasisPoints: 10_000, meanMilli: 1_000 },
    ),
    unsupportedCustomerUseClaims: criterion(
      complete ? (unsupportedClaimCount === 0 ? 'MET' : 'NOT_MET') : 'INCOMPLETE',
      complete ? unsupportedClaimCount : null,
      { operator: 'LTE', value: 0, unit: 'COUNT' },
    ),
    repeatUseIntent: criterion(
      complete ? (repeatUseCount >= 3 ? 'MET' : 'NOT_MET') : 'INCOMPLETE',
      complete ? repeatUseCount : null,
      { operator: 'GTE', value: 3, denominator: 5 },
    ),
    weeklyPilotTeam: criterion(
      complete ? (repeatedUseTeamWeeks.length >= 1 ? 'MET' : 'NOT_MET') : 'INCOMPLETE',
      complete ? repeatedUseTeamWeeks.length : null,
      {
        operator: 'GTE',
        value: protocol.thresholds.weeklyTeamMinimumCount,
        denominator: 1,
        repeatUseObserved: protocol.thresholds.weeklyTeamRepeatUseObserved,
        minimumPacketUseCount: protocol.thresholds.weeklyTeamMinimumPacketUseCount,
        maximumWindowDays: protocol.thresholds.weeklyTeamMaximumWindowDays,
      },
    ),
  };
  const criterionStatuses = Object.values(criteria).map((item) => item.status);
  const aggregate = {
    schemaVersion: AGGREGATE_SCHEMA,
    boundary: PURSUIT_VALUE_PILOT_BOUNDARY,
    executionBoundary: PURSUIT_VALUE_PILOT_EXECUTION_BOUNDARY,
    dataClass: 'BOUNDED_REDACTED_AGGREGATE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    protocolCanonicalSha256: protocol.canonicalSha256,
    documentStatus: complete ? 'COMPLETE_FOR_HUMAN_DISPOSITION' : 'INCOMPLETE',
    humanEvidenceStatus: complete ? 'COMPLETE' : 'INCOMPLETE',
    thresholdEvaluationStatus: complete ? 'EVALUATED' : 'INCOMPLETE',
    systemFinalDecisionAcceptance: 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION',
    automaticPilotDecision: false,
    pilotDisposition: 'NOT_MADE',
    counts: {
      fixedReviewerDenominator: 5,
      eligibleCompletedReviewerCount: completedSessions.length,
      humanPursuitDecisionCount: complete ? 5 : 0,
      acceptedTechnicalStateCount: complete ? acceptedTechnicalStateCount : 0,
      fixedTwinProjectDenominator: 5,
      fixedTeamWeekDenominator: 1,
      completedTeamWeekCount: completedTeamWeeks.length,
      repeatedUseTeamWeekCount: repeatedUseTeamWeeks.length,
    },
    metrics: {
      pairedInitialReviewTimeReduction: metric(evaluationStatus, {
        observationCount: complete ? 5 : 0,
        medianBasisPoints: medianReduction,
        minimumBasisPoints: complete ? Math.min(...pairedReductions) : null,
        maximumBasisPoints: complete ? Math.max(...pairedReductions) : null,
      }),
      traceableHumanDecisions: metric(evaluationStatus, {
        count: complete ? traceableCount : 0,
        denominator: 5,
        basisPoints: traceableBasisPoints,
      }),
      acceptedTechnicalState: metric(evaluationStatus, {
        count: complete ? acceptedTechnicalStateCount : 0,
        denominator: 5,
        basisPoints: acceptedBasisPoints,
      }),
      keyGaps: metric(evaluationStatus, {
        coveredProjectCount: complete ? keyGapProjectCount : 0,
        projectDenominator: 5,
        coverageBasisPoints: keyGapCoverageBasisPoints,
        keyGapCount: complete ? keyGapCount : 0,
        meanPerProjectMilli: keyGapMeanMilli,
      }),
      unsupportedCustomerUseClaims: metric(evaluationStatus, {
        count: complete ? unsupportedClaimCount : 0,
      }),
      repeatUseIntent: metric(evaluationStatus, {
        count: complete ? repeatUseCount : 0,
        denominator: 5,
        basisPoints: complete ? basisPoints(repeatUseCount, 5) : null,
      }),
      weeklyPilotTeam: metric(evaluationStatus, {
        count: complete ? repeatedUseTeamWeeks.length : 0,
        completedRecordCount: completedTeamWeeks.length,
        denominator: 1,
        basisPoints: complete ? basisPoints(repeatedUseTeamWeeks.length, 1) : null,
      }),
    },
    criteria,
    allTargetsMet: complete ? criterionStatuses.every((status) => status === 'MET') : null,
    humanDispositionRequired: complete,
    redaction: {
      rawSessionAnswersIncluded: false,
      rawTimingValuesIncluded: false,
      identitiesIncluded: false,
      caseContentIncluded: false,
      freeTextIncluded: false,
    },
  };
  return withCanonicalHash(aggregate);
}

export function buildPursuitValuePilotAggregate(protocol, sessions, teamWeeks) {
  validatePursuitValuePilotProtocol(protocol);
  const aggregate = computeAggregate(protocol, sessions, teamWeeks);
  return validatePursuitValuePilotAggregate(aggregate, protocol, sessions, teamWeeks);
}

export function validatePursuitValuePilotAggregate(aggregate, protocol, sessions, teamWeeks) {
  validatePursuitValuePilotProtocol(protocol);
  assertSafeArtifact(aggregate, '$.aggregate');
  assertBoundary(aggregate, '$.aggregate', AGGREGATE_SCHEMA);
  assertExactKeys(aggregate, [
    'schemaVersion', 'boundary', 'executionBoundary', 'dataClass',
    'productionReady', 'productionReviewerWorkflowReady', 'issue165Status',
    'protocolCanonicalSha256', 'documentStatus', 'humanEvidenceStatus',
    'thresholdEvaluationStatus', 'systemFinalDecisionAcceptance',
    'automaticPilotDecision', 'pilotDisposition', 'counts', 'metrics',
    'criteria', 'allTargetsMet', 'humanDispositionRequired', 'redaction',
    'canonicalSha256',
  ], '$.aggregate');
  if (aggregate.dataClass !== 'BOUNDED_REDACTED_AGGREGATE'
    || aggregate.productionReviewerWorkflowReady !== false
    || aggregate.protocolCanonicalSha256 !== protocol.canonicalSha256
    || aggregate.systemFinalDecisionAcceptance !== 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION'
    || aggregate.automaticPilotDecision !== false
    || aggregate.pilotDisposition !== 'NOT_MADE'
    || aggregate.redaction?.rawSessionAnswersIncluded !== false
    || aggregate.redaction?.rawTimingValuesIncluded !== false
    || aggregate.redaction?.identitiesIncluded !== false
    || aggregate.redaction?.caseContentIncluded !== false
    || aggregate.redaction?.freeTextIncluded !== false) {
    fail('PILOT_AGGREGATE_BOUNDARY_INVALID', '$.aggregate');
  }
  assertCanonicalHash(aggregate, '$.aggregate');
  const expected = computeAggregate(protocol, sessions, teamWeeks);
  if (canonicalStringify(expected) !== canonicalStringify(aggregate)) {
    fail('PILOT_AGGREGATE_MISMATCH', '$.aggregate');
  }
  return clone(aggregate);
}
