export const HUMAN_VALIDATION_SESSION_SCHEMA_VERSION =
  'datacenter-pursuit-workbench-human-validation-session-v1';
export const HUMAN_VALIDATION_AGGREGATE_SCHEMA_VERSION =
  'datacenter-pursuit-workbench-human-validation-aggregate-v1';
export const HUMAN_VALIDATION_BOUNDARY = 'NOT_PRODUCTION_EVIDENCE';
export const HUMAN_VALIDATION_RUNTIME_SHA =
  '8098f66c6fb7e64464297c0ee70d25f49756135d';
export const HUMAN_VALIDATION_SESSION_DIRECTORY =
  'tmp/pursuit-workbench-human-validation';

export const HUMAN_VALIDATION_ARTIFACT_HASHES = Object.freeze({
  'package-lock.json': 'a14f41c200c480e20b1f3e3ef1ccedf48155e274888b4716aeb2e1b1ba4d97cc',
  'pursuit-workbench/fixtures/datacenter-workbench-v0.json': '08ec7591cfd89d8af33a2ca613df8762c2a852d8946f36379dc0aaabfc365d41',
  'docs/product/datacenter-pursuit-workbench-v0-review-guide.md': '3000973dab91408d6e360363872e43398228d39a88d010d21d6c5803d28b366a'
});

export const HUMAN_VALIDATION_REVIEWER_ROSTER = Object.freeze({
  R1: 'INDUSTRIAL_TECHNICAL_SALES',
  R2: 'INDUSTRIAL_TECHNICAL_SALES',
  R3: 'APPLICATION_ENGINEER',
  R4: 'APPLICATION_ENGINEER',
  R5: 'TENDER_SPEC_DESIGN_SUPPORT'
});

export const HUMAN_VALIDATION_SESSION_FILES = Object.freeze({
  R1: 'session-r1.json',
  R2: 'session-r2.json',
  R3: 'session-r3.json',
  R4: 'session-r4.json',
  R5: 'session-r5.json'
});

export const HUMAN_VALIDATION_SCENARIOS = Object.freeze({
  strong_verified_electrical_fit: Object.freeze({ systemOutcome: 'FIT', specificationWindow: 'OPEN' }),
  hard_voltage_mismatch: Object.freeze({ systemOutcome: 'NOT_FIT', specificationWindow: 'OPEN' }),
  conflicting_capability_claims: Object.freeze({ systemOutcome: 'INSUFFICIENT_EVIDENCE', specificationWindow: 'OPEN' })
});

export const HUMAN_VALIDATION_TASKS = Object.freeze({
  T1: Object.freeze(['strong_verified_electrical_fit']),
  T2: Object.freeze(['strong_verified_electrical_fit']),
  T3: Object.freeze(['hard_voltage_mismatch']),
  T4: Object.freeze(['strong_verified_electrical_fit', 'conflicting_capability_claims']),
  T5: Object.freeze(['conflicting_capability_claims']),
  T6: Object.freeze(['conflicting_capability_claims'])
});

export const HUMAN_VALIDATION_THRESHOLDS = Object.freeze({
  eligibleReviewerCount: 5,
  independentTaskCompletionRateMinimum: 0.8,
  fitAgreementRateMinimum: 0.8,
  claimBoundarySuccessRateMinimum: 0.9,
  seriousMisunderstandingCountMaximum: 0,
  internalPursuitUsefulReviewerCountMinimum: 3,
  medianReviewDurationSecondsMaximum: 900,
  pairedBaselineCountMinimum: 3,
  medianTimeReductionRateMinimum: 0.3,
  unresolvedP0CountMaximum: 0,
  unresolvedP1CountMaximum: 0
});

const REVIEWER_IDS = Object.freeze(Object.keys(HUMAN_VALIDATION_REVIEWER_ROSTER));
const TASK_IDS = Object.freeze(Object.keys(HUMAN_VALIDATION_TASKS));
const SCENARIO_IDS = Object.freeze(Object.keys(HUMAN_VALIDATION_SCENARIOS));
const ROLE_VALUES = Object.freeze([...new Set(Object.values(HUMAN_VALIDATION_REVIEWER_ROSTER))]);
const EXPERIENCE_VALUES = Object.freeze(['0_4_YEARS', '5_9_YEARS', '10_PLUS_YEARS']);
const SESSION_STATUS_VALUES = Object.freeze(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'INELIGIBLE']);
const INELIGIBILITY_REASONS = Object.freeze([
  'BUILD_NOT_CONFIRMED',
  'ARTIFACT_HASH_NOT_CONFIRMED',
  'WORKTREE_NOT_CLEAN',
  'SYNTHETIC_BOUNDARY_NOT_CONFIRMED',
  'ROLE_MISMATCH',
  'SESSION_ABORTED',
  'OTHER_NON_SENSITIVE_REASON'
]);
const TASK_OUTCOMES = Object.freeze(['COMPLETED_WITHOUT_HELP', 'COMPLETED_WITH_HELP', 'NOT_COMPLETED']);
const HELP_LEVELS = Object.freeze(['NONE', 'CLARIFY_PROMPT_ONLY', 'SUBSTANTIVE_HELP']);
const FIT_RESULTS = Object.freeze(['FIT', 'CONDITIONAL_FIT', 'NOT_FIT', 'INSUFFICIENT_EVIDENCE', 'NOT_EVALUATED']);
const USEFULNESS_VALUES = Object.freeze(['YES', 'PARTLY', 'NO']);
const INTERNAL_USE_VALUES = Object.freeze(['YES', 'MAYBE', 'NO']);
const FINDING_SEVERITIES = Object.freeze(['P0', 'P1', 'P2', 'P3']);
const FINDING_CATEGORIES = Object.freeze([
  'INFORMATION_ARCHITECTURE', 'TERMINOLOGY', 'FIT_EXPLANATION', 'SPECIFICATION_WINDOW',
  'CLAIM_BOUNDARY', 'TECHNICAL_QUESTION', 'REVIEW_DISPOSITION', 'REVIEW_PACKET',
  'TRACEABILITY', 'ACCESSIBILITY_INTERACTION', 'DATA_GAP', 'PRODUCT_HYPOTHESIS'
]);
const OBSERVATION_TYPES = Object.freeze([
  'MISUNDERSTANDING', 'TASK_FAILURE', 'FRICTION', 'MISSING_INFORMATION',
  'POSITIVE_SIGNAL', 'FEATURE_REQUEST'
]);
const REASON_CODES = Object.freeze([
  'STAGE_NOT_FOUND', 'PRODUCT_FAMILY_NOT_FOUND', 'FIT_RESULT_NOT_UNDERSTOOD',
  'HARD_MISMATCH_NOT_FOUND', 'BLOCKED_CLAIM_TREATED_AS_ALLOWED',
  'CONFLICT_RESOLVED_WITHOUT_EVIDENCE', 'FIT_CONFUSED_WITH_COMMERCIAL_APPROVAL',
  'SPEC_WINDOW_CONFUSED_WITH_FIT', 'TECHNICAL_QUESTION_NOT_USEFUL',
  'REVIEW_DISPOSITION_NOT_UNDERSTOOD', 'REVIEW_PACKET_ASSUMED_PERSISTED_OR_SENT',
  'TRACEABILITY_NOT_UNDERSTOOD', 'PURSUIT_MEETING_NOT_USEFUL',
  'ACCESSIBILITY_BLOCKER', 'OTHER'
]);
const SERIOUS_REASON_CODES = new Set([
  'BLOCKED_CLAIM_TREATED_AS_ALLOWED',
  'CONFLICT_RESOLVED_WITHOUT_EVIDENCE',
  'FIT_CONFUSED_WITH_COMMERCIAL_APPROVAL',
  'SPEC_WINDOW_CONFUSED_WITH_FIT',
  'REVIEW_PACKET_ASSUMED_PERSISTED_OR_SENT'
]);

export const HUMAN_VALIDATION_LIMITS = Object.freeze({
  maxFileBytes: 64 * 1024,
  maxDepth: 12,
  maxStringCharacters: 512,
  maxDescriptorCharacters: 240,
  maxFindingsPerSession: 100,
  maxFindingIdsPerTask: 30,
  maxTaskSeconds: 3_600,
  maxReviewSeconds: 14_400,
  maxBaselineSeconds: 86_400
});

const CONTROL_OR_BIDI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;
const EMAIL_SHAPED = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_SHAPED = /(?:\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\/(?:[^\s]*))/i;
const PHONE_SHAPED = /(?:\+?\d{1,3}[ .-])?(?:\(?\d{2,4}\)?[ .-]){2,}\d{3,4}|\b0\d{9,10}\b/;
const SECRET_SHAPED = /(?:\bbearer\s+[a-z0-9._~+\/-]{8,}|\bgh[oprsu]_[a-z0-9]{12,}|\bsk-[a-z0-9_-]{12,}|\bAIza[a-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:authorization|cookie|credential|password|passwd|token|api[_ -]?key|secret|jwt)\s*[:=]\s*\S+)/i;
const PRIVATE_SHAPED = /(?:\/Users\/|\/home\/|[A-Z]:\\|\b(?:customer|client|company|employer|project|person|contact|account|database|user)[ _-]?(?:name|id)\s*[:=]|\b(?:private|confidential)\s+(?:data|record|detail|fact|content)\b|\b(?:\d{1,3}\.){3}\d{1,3}\b)/i;

export class HumanValidationError extends Error {
  constructor(code, path = '$') {
    super(code);
    this.name = 'HumanValidationError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, path) {
  throw new HumanValidationError(code, path);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, path) {
  if (!isPlainObject(value)) fail('SESSION_SCHEMA_INVALID', path);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail('SESSION_SCHEMA_KEYS_INVALID', path);
  }
}

function assertSafeStrings(value, path = '$', depth = 0) {
  if (depth > HUMAN_VALIDATION_LIMITS.maxDepth) fail('SESSION_MAX_DEPTH_EXCEEDED', path);
  if (typeof value === 'string') {
    if (value.length > HUMAN_VALIDATION_LIMITS.maxStringCharacters) fail('SESSION_STRING_TOO_LONG', path);
    if (CONTROL_OR_BIDI.test(value)) fail('SESSION_CONTROL_CHARACTER_REFUSED', path);
    if (EMAIL_SHAPED.test(value) || URL_SHAPED.test(value) || PHONE_SHAPED.test(value)
      || SECRET_SHAPED.test(value) || PRIVATE_SHAPED.test(value)) {
      fail('SESSION_PROTECTED_CONTENT_REFUSED', path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeStrings(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    if (!isPlainObject(value)) fail('SESSION_NON_PLAIN_OBJECT', path);
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('SESSION_PROTOTYPE_KEY_REFUSED', path);
      assertSafeStrings(item, `${path}.${key}`, depth + 1);
    }
  }
}

function assertEnum(value, values, path, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (!values.includes(value)) fail('SESSION_ENUM_INVALID', path);
}

function assertBoolean(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== 'boolean') fail('SESSION_BOOLEAN_INVALID', path);
}

function assertInteger(value, path, maximum, { nullable = false, minimum = 0 } = {}) {
  if (nullable && value === null) return;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail('SESSION_NUMBER_INVALID', path);
}

function assertDescriptor(value, path) {
  if (value === null) return;
  if (typeof value !== 'string' || value.length === 0
    || value.length > HUMAN_VALIDATION_LIMITS.maxDescriptorCharacters
    || value.trim() !== value || /[\r\n]/.test(value)) {
    fail('SESSION_DESCRIPTOR_INVALID', path);
  }
}

function assertDate(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('SESSION_DATE_INVALID', path);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) fail('SESSION_DATE_INVALID', path);
}

function assertExactArray(value, expected, path) {
  if (!Array.isArray(value) || value.length !== expected.length
    || value.some((item, index) => item !== expected[index])) fail('SESSION_COVERAGE_INVALID', path);
}

function assertFindingIdList(value, reviewerId, path) {
  if (!Array.isArray(value) || value.length > HUMAN_VALIDATION_LIMITS.maxFindingIdsPerTask) {
    fail('SESSION_FINDING_IDS_INVALID', path);
  }
  const pattern = new RegExp(`^HV-${reviewerId}-\\d{3}$`);
  if (value.some((item) => typeof item !== 'string' || !pattern.test(item))
    || new Set(value).size !== value.length) fail('SESSION_FINDING_IDS_INVALID', path);
}

function baseTask(taskId) {
  return {
    taskId,
    scenarioIds: [...HUMAN_VALIDATION_TASKS[taskId]],
    outcome: null,
    timeToFirstCorrectInterpretationSeconds: null,
    totalTimeSeconds: null,
    helpLevel: null,
    findingIds: []
  };
}

function taskSkeleton(taskId) {
  const task = baseTask(taskId);
  if (taskId === 'T2') task.fitTreatedAsCommercialApproval = null;
  if (taskId === 'T4') {
    task.allowedClaimCheckPassed = null;
    task.blockedClaimCheckPassed = null;
    task.favorableConflictedValueSelected = null;
  }
  if (taskId === 'T5') task.technicalQuestionUsefulness = null;
  if (taskId === 'T6') {
    task.packetUnderstoodAsLocalNotSaved = null;
    task.packetUnderstoodAsNotSentOrApproved = null;
  }
  return task;
}

export function createHumanValidationSessionSkeleton(reviewerId) {
  if (!REVIEWER_IDS.includes(reviewerId)) fail('SESSION_REVIEWER_ID_INVALID', '$.reviewer.reviewerId');
  return {
    schemaVersion: HUMAN_VALIDATION_SESSION_SCHEMA_VERSION,
    boundary: HUMAN_VALIDATION_BOUNDARY,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    containsRealCustomerData: false,
    productRuntime: {
      sha: HUMAN_VALIDATION_RUNTIME_SHA,
      artifactSha256: { ...HUMAN_VALIDATION_ARTIFACT_HASHES }
    },
    reviewer: {
      reviewerId,
      targetRole: HUMAN_VALIDATION_REVIEWER_ROSTER[reviewerId],
      actualRole: null,
      experienceBand: null,
      sessionDate: null,
      facilitatorId: 'F1'
    },
    session: {
      status: 'NOT_STARTED',
      eligible: null,
      ineligibilityReason: null
    },
    confirmations: {
      runtimeShaConfirmed: null,
      artifactHashesConfirmed: null,
      cleanWorktreeConfirmed: null,
      syntheticOnlyBoundaryConfirmed: null,
      productionOrRealDataActionPerformed: null
    },
    taskResults: Object.fromEntries(TASK_IDS.map((taskId) => [taskId, taskSkeleton(taskId)])),
    scenarioJudgments: Object.fromEntries(SCENARIO_IDS.map((scenarioId) => [scenarioId, {
      scenarioId,
      systemOutcome: HUMAN_VALIDATION_SCENARIOS[scenarioId].systemOutcome,
      reviewerOutcome: null,
      exactAgreement: null
    }])),
    postSession: {
      specificationWindowDistinguishedFromFit: null,
      claimBoundaryReliablyDistinguished: null,
      technicalQuestionUsefulness: null,
      wouldUseInInternalPursuitReview: null,
      mostConfusingAreaDescriptor: null,
      mostImportantMissingInformationDescriptor: null,
      totalReviewDurationSeconds: null,
      credibleCurrentMethodBaselineSeconds: null,
      accessibilityOrInteractionFrictionDescriptor: null,
      additionalProductValueObservationDescriptor: null
    },
    findings: []
  };
}

function validateTask(task, taskId, reviewerId, complete) {
  const template = taskSkeleton(taskId);
  assertExactKeys(task, Object.keys(template), `$.taskResults.${taskId}`);
  if (task.taskId !== taskId) fail('SESSION_TASK_ID_INVALID', `$.taskResults.${taskId}.taskId`);
  assertExactArray(task.scenarioIds, HUMAN_VALIDATION_TASKS[taskId], `$.taskResults.${taskId}.scenarioIds`);
  assertEnum(task.outcome, TASK_OUTCOMES, `$.taskResults.${taskId}.outcome`, { nullable: !complete });
  assertInteger(task.timeToFirstCorrectInterpretationSeconds, `$.taskResults.${taskId}.timeToFirstCorrectInterpretationSeconds`, HUMAN_VALIDATION_LIMITS.maxTaskSeconds, { nullable: true });
  assertInteger(task.totalTimeSeconds, `$.taskResults.${taskId}.totalTimeSeconds`, HUMAN_VALIDATION_LIMITS.maxTaskSeconds, { nullable: !complete, minimum: 1 });
  assertEnum(task.helpLevel, HELP_LEVELS, `$.taskResults.${taskId}.helpLevel`, { nullable: !complete });
  assertFindingIdList(task.findingIds, reviewerId, `$.taskResults.${taskId}.findingIds`);

  if (task.outcome === 'COMPLETED_WITHOUT_HELP' && task.helpLevel !== 'NONE') {
    fail('SESSION_TASK_HELP_INCONSISTENT', `$.taskResults.${taskId}`);
  }
  if (task.outcome === 'COMPLETED_WITH_HELP'
    && !['CLARIFY_PROMPT_ONLY', 'SUBSTANTIVE_HELP'].includes(task.helpLevel)) {
    fail('SESSION_TASK_HELP_INCONSISTENT', `$.taskResults.${taskId}`);
  }
  if (task.outcome === 'NOT_COMPLETED' && task.timeToFirstCorrectInterpretationSeconds !== null) {
    fail('SESSION_TASK_TIMING_INCONSISTENT', `$.taskResults.${taskId}`);
  }
  if (task.outcome && task.outcome !== 'NOT_COMPLETED') {
    assertInteger(task.timeToFirstCorrectInterpretationSeconds, `$.taskResults.${taskId}.timeToFirstCorrectInterpretationSeconds`, HUMAN_VALIDATION_LIMITS.maxTaskSeconds, { minimum: 1 });
    if (task.timeToFirstCorrectInterpretationSeconds > task.totalTimeSeconds) {
      fail('SESSION_TASK_TIMING_INCONSISTENT', `$.taskResults.${taskId}`);
    }
  }
  if (task.outcome === 'NOT_COMPLETED' && task.findingIds.length === 0) {
    fail('SESSION_TASK_FINDING_REQUIRED', `$.taskResults.${taskId}.findingIds`);
  }

  if (taskId === 'T2') assertBoolean(task.fitTreatedAsCommercialApproval, `$.taskResults.${taskId}.fitTreatedAsCommercialApproval`, { nullable: !complete });
  if (taskId === 'T4') {
    assertBoolean(task.allowedClaimCheckPassed, `$.taskResults.${taskId}.allowedClaimCheckPassed`, { nullable: !complete });
    assertBoolean(task.blockedClaimCheckPassed, `$.taskResults.${taskId}.blockedClaimCheckPassed`, { nullable: !complete });
    assertBoolean(task.favorableConflictedValueSelected, `$.taskResults.${taskId}.favorableConflictedValueSelected`, { nullable: !complete });
  }
  if (taskId === 'T5') assertEnum(task.technicalQuestionUsefulness, USEFULNESS_VALUES, `$.taskResults.${taskId}.technicalQuestionUsefulness`, { nullable: !complete });
  if (taskId === 'T6') {
    assertBoolean(task.packetUnderstoodAsLocalNotSaved, `$.taskResults.${taskId}.packetUnderstoodAsLocalNotSaved`, { nullable: !complete });
    assertBoolean(task.packetUnderstoodAsNotSentOrApproved, `$.taskResults.${taskId}.packetUnderstoodAsNotSentOrApproved`, { nullable: !complete });
  }
}

function validateFinding(finding, reviewerId, path) {
  assertExactKeys(finding, [
    'findingId', 'reviewerId', 'taskId', 'scenarioId', 'severity', 'category',
    'observationType', 'reasonCode', 'observationDescriptor',
    'candidateCorrectionDescriptor', 'evidenceBackedP0P1FixCandidate',
    'requiresSeparateProductDecision', 'resolved'
  ], path);
  if (typeof finding.findingId !== 'string'
    || !new RegExp(`^HV-${reviewerId}-\\d{3}$`).test(finding.findingId)) fail('SESSION_FINDING_ID_INVALID', `${path}.findingId`);
  if (finding.reviewerId !== reviewerId) fail('SESSION_FINDING_REVIEWER_INVALID', `${path}.reviewerId`);
  assertEnum(finding.taskId, [...TASK_IDS, 'POST_SESSION'], `${path}.taskId`);
  assertEnum(finding.scenarioId, [...SCENARIO_IDS, 'MULTIPLE'], `${path}.scenarioId`);
  if (TASK_IDS.includes(finding.taskId) && finding.scenarioId !== 'MULTIPLE'
    && !HUMAN_VALIDATION_TASKS[finding.taskId].includes(finding.scenarioId)) {
    fail('SESSION_FINDING_SCENARIO_INCONSISTENT', `${path}.scenarioId`);
  }
  assertEnum(finding.severity, FINDING_SEVERITIES, `${path}.severity`);
  assertEnum(finding.category, FINDING_CATEGORIES, `${path}.category`);
  assertEnum(finding.observationType, OBSERVATION_TYPES, `${path}.observationType`);
  assertEnum(finding.reasonCode, REASON_CODES, `${path}.reasonCode`);
  assertDescriptor(finding.observationDescriptor, `${path}.observationDescriptor`);
  assertDescriptor(finding.candidateCorrectionDescriptor, `${path}.candidateCorrectionDescriptor`);
  assertBoolean(finding.evidenceBackedP0P1FixCandidate, `${path}.evidenceBackedP0P1FixCandidate`);
  assertBoolean(finding.requiresSeparateProductDecision, `${path}.requiresSeparateProductDecision`);
  assertBoolean(finding.resolved, `${path}.resolved`);
}

function validateFindingLinks(record) {
  const byId = new Map(record.findings.map((finding) => [finding.findingId, finding]));
  if (byId.size !== record.findings.length) fail('SESSION_FINDING_ID_DUPLICATE', '$.findings');
  const referenced = new Set();
  for (const taskId of TASK_IDS) {
    for (const findingId of record.taskResults[taskId].findingIds) {
      const finding = byId.get(findingId);
      if (!finding || finding.taskId !== taskId) fail('SESSION_FINDING_REFERENCE_INVALID', `$.taskResults.${taskId}.findingIds`);
      if (referenced.has(findingId)) fail('SESSION_FINDING_REFERENCE_DUPLICATE', `$.taskResults.${taskId}.findingIds`);
      referenced.add(findingId);
    }
  }
  for (const finding of record.findings) {
    if (finding.taskId !== 'POST_SESSION' && !referenced.has(finding.findingId)) {
      fail('SESSION_FINDING_ORPHANED', '$.findings');
    }
  }
}

function requireFinding(record, condition, taskId, reasonCodes) {
  if (!condition) return;
  const linked = new Set(record.taskResults[taskId].findingIds);
  if (!record.findings.some((finding) => linked.has(finding.findingId) && reasonCodes.includes(finding.reasonCode))) {
    fail('SESSION_NEGATIVE_OBSERVATION_FINDING_REQUIRED', `$.taskResults.${taskId}`);
  }
}

function recordIsBlank(record) {
  const blank = createHumanValidationSessionSkeleton(record.reviewer.reviewerId);
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  };
  return JSON.stringify(canonicalize(record)) === JSON.stringify(canonicalize(blank));
}

export function validateHumanValidationSession(record, { expectedReviewerId } = {}) {
  assertSafeStrings(record);
  assertExactKeys(record, [
    'schemaVersion', 'boundary', 'productionReady', 'productionReviewerWorkflowReady',
    'issue165Status', 'containsRealCustomerData', 'productRuntime', 'reviewer',
    'session', 'confirmations', 'taskResults', 'scenarioJudgments', 'postSession', 'findings'
  ], '$');
  if (record.schemaVersion !== HUMAN_VALIDATION_SESSION_SCHEMA_VERSION
    || record.boundary !== HUMAN_VALIDATION_BOUNDARY
    || record.productionReady !== false
    || record.productionReviewerWorkflowReady !== false
    || record.issue165Status !== 'HOLD'
    || record.containsRealCustomerData !== false) fail('SESSION_BOUNDARY_INVALID', '$');

  assertExactKeys(record.productRuntime, ['sha', 'artifactSha256'], '$.productRuntime');
  if (record.productRuntime.sha !== HUMAN_VALIDATION_RUNTIME_SHA) fail('SESSION_RUNTIME_SHA_INVALID', '$.productRuntime.sha');
  assertExactKeys(record.productRuntime.artifactSha256, Object.keys(HUMAN_VALIDATION_ARTIFACT_HASHES), '$.productRuntime.artifactSha256');
  for (const [artifact, digest] of Object.entries(HUMAN_VALIDATION_ARTIFACT_HASHES)) {
    if (record.productRuntime.artifactSha256[artifact] !== digest) fail('SESSION_ARTIFACT_HASH_INVALID', '$.productRuntime.artifactSha256');
  }

  assertExactKeys(record.reviewer, ['reviewerId', 'targetRole', 'actualRole', 'experienceBand', 'sessionDate', 'facilitatorId'], '$.reviewer');
  assertEnum(record.reviewer.reviewerId, REVIEWER_IDS, '$.reviewer.reviewerId');
  if (expectedReviewerId && record.reviewer.reviewerId !== expectedReviewerId) fail('SESSION_FILENAME_REVIEWER_MISMATCH', '$.reviewer.reviewerId');
  if (record.reviewer.targetRole !== HUMAN_VALIDATION_REVIEWER_ROSTER[record.reviewer.reviewerId]) fail('SESSION_TARGET_ROLE_INVALID', '$.reviewer.targetRole');
  assertEnum(record.reviewer.actualRole, ROLE_VALUES, '$.reviewer.actualRole', { nullable: true });
  assertEnum(record.reviewer.experienceBand, EXPERIENCE_VALUES, '$.reviewer.experienceBand', { nullable: true });
  assertDate(record.reviewer.sessionDate, '$.reviewer.sessionDate', { nullable: true });
  if (record.reviewer.facilitatorId !== 'F1') fail('SESSION_FACILITATOR_INVALID', '$.reviewer.facilitatorId');

  assertExactKeys(record.session, ['status', 'eligible', 'ineligibilityReason'], '$.session');
  assertEnum(record.session.status, SESSION_STATUS_VALUES, '$.session.status');
  assertBoolean(record.session.eligible, '$.session.eligible', { nullable: true });
  assertEnum(record.session.ineligibilityReason, INELIGIBILITY_REASONS, '$.session.ineligibilityReason', { nullable: true });
  const complete = record.session.status === 'COMPLETED';
  if (complete && (record.session.eligible !== true || record.session.ineligibilityReason !== null)) fail('SESSION_ELIGIBILITY_INCONSISTENT', '$.session');
  if (record.session.status === 'INELIGIBLE' && (record.session.eligible !== false || record.session.ineligibilityReason === null)) fail('SESSION_ELIGIBILITY_INCONSISTENT', '$.session');
  if (['NOT_STARTED', 'IN_PROGRESS'].includes(record.session.status)
    && (record.session.eligible !== null || record.session.ineligibilityReason !== null)) fail('SESSION_ELIGIBILITY_INCONSISTENT', '$.session');

  assertExactKeys(record.confirmations, [
    'runtimeShaConfirmed', 'artifactHashesConfirmed', 'cleanWorktreeConfirmed',
    'syntheticOnlyBoundaryConfirmed', 'productionOrRealDataActionPerformed'
  ], '$.confirmations');
  for (const [key, value] of Object.entries(record.confirmations)) assertBoolean(value, `$.confirmations.${key}`, { nullable: !complete });
  if (record.confirmations.productionOrRealDataActionPerformed === true) fail('SESSION_BOUNDARY_ACTION_REFUSED', '$.confirmations.productionOrRealDataActionPerformed');
  if (complete && (record.confirmations.runtimeShaConfirmed !== true
    || record.confirmations.artifactHashesConfirmed !== true
    || record.confirmations.cleanWorktreeConfirmed !== true
    || record.confirmations.syntheticOnlyBoundaryConfirmed !== true
    || record.confirmations.productionOrRealDataActionPerformed !== false)) {
    fail('SESSION_CONFIRMATION_INCOMPLETE', '$.confirmations');
  }

  assertExactKeys(record.taskResults, TASK_IDS, '$.taskResults');
  for (const taskId of TASK_IDS) validateTask(record.taskResults[taskId], taskId, record.reviewer.reviewerId, complete);

  assertExactKeys(record.scenarioJudgments, SCENARIO_IDS, '$.scenarioJudgments');
  for (const scenarioId of SCENARIO_IDS) {
    const judgment = record.scenarioJudgments[scenarioId];
    assertExactKeys(judgment, ['scenarioId', 'systemOutcome', 'reviewerOutcome', 'exactAgreement'], `$.scenarioJudgments.${scenarioId}`);
    if (judgment.scenarioId !== scenarioId || judgment.systemOutcome !== HUMAN_VALIDATION_SCENARIOS[scenarioId].systemOutcome) {
      fail('SESSION_SCENARIO_COVERAGE_INVALID', `$.scenarioJudgments.${scenarioId}`);
    }
    assertEnum(judgment.reviewerOutcome, FIT_RESULTS, `$.scenarioJudgments.${scenarioId}.reviewerOutcome`, { nullable: !complete });
    assertBoolean(judgment.exactAgreement, `$.scenarioJudgments.${scenarioId}.exactAgreement`, { nullable: !complete });
    if (judgment.reviewerOutcome !== null
      && judgment.exactAgreement !== (judgment.reviewerOutcome === judgment.systemOutcome)) {
      fail('SESSION_SCENARIO_AGREEMENT_INCONSISTENT', `$.scenarioJudgments.${scenarioId}`);
    }
  }

  assertExactKeys(record.postSession, [
    'specificationWindowDistinguishedFromFit', 'claimBoundaryReliablyDistinguished',
    'technicalQuestionUsefulness', 'wouldUseInInternalPursuitReview',
    'mostConfusingAreaDescriptor', 'mostImportantMissingInformationDescriptor',
    'totalReviewDurationSeconds', 'credibleCurrentMethodBaselineSeconds',
    'accessibilityOrInteractionFrictionDescriptor', 'additionalProductValueObservationDescriptor'
  ], '$.postSession');
  assertBoolean(record.postSession.specificationWindowDistinguishedFromFit, '$.postSession.specificationWindowDistinguishedFromFit', { nullable: !complete });
  assertBoolean(record.postSession.claimBoundaryReliablyDistinguished, '$.postSession.claimBoundaryReliablyDistinguished', { nullable: !complete });
  assertEnum(record.postSession.technicalQuestionUsefulness, USEFULNESS_VALUES, '$.postSession.technicalQuestionUsefulness', { nullable: !complete });
  assertEnum(record.postSession.wouldUseInInternalPursuitReview, INTERNAL_USE_VALUES, '$.postSession.wouldUseInInternalPursuitReview', { nullable: !complete });
  for (const key of ['mostConfusingAreaDescriptor', 'mostImportantMissingInformationDescriptor', 'accessibilityOrInteractionFrictionDescriptor', 'additionalProductValueObservationDescriptor']) {
    assertDescriptor(record.postSession[key], `$.postSession.${key}`);
  }
  assertInteger(record.postSession.totalReviewDurationSeconds, '$.postSession.totalReviewDurationSeconds', HUMAN_VALIDATION_LIMITS.maxReviewSeconds, { nullable: !complete, minimum: 1 });
  assertInteger(record.postSession.credibleCurrentMethodBaselineSeconds, '$.postSession.credibleCurrentMethodBaselineSeconds', HUMAN_VALIDATION_LIMITS.maxBaselineSeconds, { nullable: true, minimum: 1 });

  if (!Array.isArray(record.findings) || record.findings.length > HUMAN_VALIDATION_LIMITS.maxFindingsPerSession) fail('SESSION_FINDINGS_INVALID', '$.findings');
  record.findings.forEach((finding, index) => validateFinding(finding, record.reviewer.reviewerId, `$.findings[${index}]`));
  validateFindingLinks(record);

  if (record.session.status === 'NOT_STARTED' && !recordIsBlank(record)) fail('SESSION_NOT_STARTED_NOT_BLANK', '$');
  if (complete && (record.reviewer.actualRole !== record.reviewer.targetRole
    || record.reviewer.experienceBand === null || record.reviewer.sessionDate === null)) fail('SESSION_REVIEWER_COVERAGE_INVALID', '$.reviewer');

  if (complete) {
    if (record.taskResults.T2.outcome === 'COMPLETED_WITHOUT_HELP'
      && record.taskResults.T2.fitTreatedAsCommercialApproval === true) {
      fail('SESSION_TASK_OUTCOME_OBSERVATION_INCONSISTENT', '$.taskResults.T2');
    }
    if (record.taskResults.T4.outcome === 'COMPLETED_WITHOUT_HELP'
      && (record.taskResults.T4.allowedClaimCheckPassed === false
        || record.taskResults.T4.blockedClaimCheckPassed === false
        || record.taskResults.T4.favorableConflictedValueSelected === true)) {
      fail('SESSION_TASK_OUTCOME_OBSERVATION_INCONSISTENT', '$.taskResults.T4');
    }
    if (record.taskResults.T6.outcome === 'COMPLETED_WITHOUT_HELP'
      && (record.taskResults.T6.packetUnderstoodAsLocalNotSaved === false
        || record.taskResults.T6.packetUnderstoodAsNotSentOrApproved === false)) {
      fail('SESSION_TASK_OUTCOME_OBSERVATION_INCONSISTENT', '$.taskResults.T6');
    }
    requireFinding(record, record.taskResults.T2.fitTreatedAsCommercialApproval === true, 'T2', ['FIT_CONFUSED_WITH_COMMERCIAL_APPROVAL']);
    requireFinding(record, record.taskResults.T4.allowedClaimCheckPassed === false, 'T4', ['OTHER', 'BLOCKED_CLAIM_TREATED_AS_ALLOWED']);
    requireFinding(record, record.taskResults.T4.blockedClaimCheckPassed === false, 'T4', ['BLOCKED_CLAIM_TREATED_AS_ALLOWED']);
    requireFinding(record, record.taskResults.T4.favorableConflictedValueSelected === true, 'T4', ['CONFLICT_RESOLVED_WITHOUT_EVIDENCE']);
    requireFinding(record, record.taskResults.T6.packetUnderstoodAsLocalNotSaved === false
      || record.taskResults.T6.packetUnderstoodAsNotSentOrApproved === false, 'T6', ['REVIEW_PACKET_ASSUMED_PERSISTED_OR_SENT']);
  }
  return record;
}

function parseJsonValue(text, cursor, path) {
  const skip = () => { while (/\s/.test(text[cursor.index] || '')) cursor.index += 1; };
  const parseString = () => {
    const start = cursor.index;
    cursor.index += 1;
    let escaped = false;
    while (cursor.index < text.length) {
      const character = text[cursor.index++];
      if (!escaped && character === '"') {
        try { return JSON.parse(text.slice(start, cursor.index)); } catch { fail('SESSION_JSON_INVALID', path); }
      }
      if (!escaped && character === '\\') escaped = true;
      else escaped = false;
    }
    fail('SESSION_JSON_INVALID', path);
  };
  skip();
  const character = text[cursor.index];
  if (character === '"') return parseString();
  if (character === '{') {
    cursor.index += 1;
    const object = Object.create(null);
    const keys = new Set();
    skip();
    if (text[cursor.index] === '}') { cursor.index += 1; return object; }
    while (cursor.index < text.length) {
      skip();
      if (text[cursor.index] !== '"') fail('SESSION_JSON_INVALID', path);
      const key = parseString();
      if (keys.has(key)) fail('SESSION_JSON_DUPLICATE_KEY', path);
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('SESSION_PROTOTYPE_KEY_REFUSED', path);
      keys.add(key);
      skip();
      if (text[cursor.index++] !== ':') fail('SESSION_JSON_INVALID', path);
      object[key] = parseJsonValue(text, cursor, `${path}.${key}`);
      skip();
      const delimiter = text[cursor.index++];
      if (delimiter === '}') return object;
      if (delimiter !== ',') fail('SESSION_JSON_INVALID', path);
    }
    fail('SESSION_JSON_INVALID', path);
  }
  if (character === '[') {
    cursor.index += 1;
    const array = [];
    skip();
    if (text[cursor.index] === ']') { cursor.index += 1; return array; }
    while (cursor.index < text.length) {
      array.push(parseJsonValue(text, cursor, `${path}[${array.length}]`));
      skip();
      const delimiter = text[cursor.index++];
      if (delimiter === ']') return array;
      if (delimiter !== ',') fail('SESSION_JSON_INVALID', path);
    }
    fail('SESSION_JSON_INVALID', path);
  }
  const remainder = text.slice(cursor.index);
  const literal = /^(true|false|null)/.exec(remainder);
  if (literal) {
    cursor.index += literal[0].length;
    return literal[0] === 'true' ? true : literal[0] === 'false' ? false : null;
  }
  const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(remainder);
  if (number) {
    cursor.index += number[0].length;
    const value = Number(number[0]);
    if (!Number.isFinite(value)) fail('SESSION_JSON_INVALID', path);
    return value;
  }
  fail('SESSION_JSON_INVALID', path);
}

export function parseHumanValidationSessionJson(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > HUMAN_VALIDATION_LIMITS.maxFileBytes) fail('SESSION_FILE_SIZE_INVALID', '$');
  const cursor = { index: 0 };
  const value = parseJsonValue(text, cursor, '$');
  while (/\s/.test(text[cursor.index] || '')) cursor.index += 1;
  if (cursor.index !== text.length) fail('SESSION_JSON_INVALID', '$');
  return value;
}

function roundRate(value) {
  return Number(value.toFixed(4));
}

function rate(numerator, denominator) {
  return denominator === 0 ? null : roundRate(numerator / denominator);
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : roundRate((sorted[middle - 1] + sorted[middle]) / 2);
}

function thresholdState(complete, condition) {
  return complete ? (condition ? 'MET' : 'NOT_MET') : 'INCOMPLETE';
}

export function aggregateHumanValidationSessions(records) {
  if (!Array.isArray(records) || records.length !== REVIEWER_IDS.length) fail('SESSION_RECORD_COVERAGE_INVALID', '$.records');
  const validated = records.map((record) => validateHumanValidationSession(record));
  const reviewerIds = validated.map((record) => record.reviewer.reviewerId);
  if (new Set(reviewerIds).size !== REVIEWER_IDS.length
    || REVIEWER_IDS.some((reviewerId) => !reviewerIds.includes(reviewerId))) fail('SESSION_RECORD_COVERAGE_INVALID', '$.records');
  const allFindingIds = validated.flatMap((record) => record.findings.map((finding) => finding.findingId));
  if (new Set(allFindingIds).size !== allFindingIds.length) fail('SESSION_CROSS_RECORD_FINDING_DUPLICATE', '$.records');

  const ordered = REVIEWER_IDS.map((reviewerId) => validated.find((record) => record.reviewer.reviewerId === reviewerId));
  const eligible = ordered.filter((record) => record.session.status === 'COMPLETED' && record.session.eligible === true);
  const complete = eligible.length === HUMAN_VALIDATION_THRESHOLDS.eligibleReviewerCount;
  const tasks = eligible.flatMap((record) => TASK_IDS.map((taskId) => record.taskResults[taskId]));
  const judgments = eligible.flatMap((record) => SCENARIO_IDS.map((scenarioId) => record.scenarioJudgments[scenarioId]));
  const findings = eligible.flatMap((record) => record.findings);
  const independentCount = tasks.filter((task) => task.outcome === 'COMPLETED_WITHOUT_HELP').length;
  const assistedCount = tasks.filter((task) => task.outcome !== 'NOT_COMPLETED').length;
  const agreementCount = judgments.filter((judgment) => judgment.exactAgreement === true).length;
  const claimChecks = eligible.flatMap((record) => [record.taskResults.T4.allowedClaimCheckPassed, record.taskResults.T4.blockedClaimCheckPassed]);
  const claimSuccessCount = claimChecks.filter(Boolean).length;
  const severityCounts = Object.fromEntries(FINDING_SEVERITIES.map((severity) => [severity, findings.filter((finding) => finding.severity === severity).length]));
  const unresolvedP0 = findings.filter((finding) => finding.severity === 'P0' && !finding.resolved).length;
  const unresolvedP1 = findings.filter((finding) => finding.severity === 'P1' && !finding.resolved).length;
  const seriousMisunderstandingCount = findings.filter((finding) => ['P0', 'P1'].includes(finding.severity) && SERIOUS_REASON_CODES.has(finding.reasonCode)).length;
  const usefulReviewerCount = eligible.filter((record) => record.postSession.wouldUseInInternalPursuitReview === 'YES').length;
  const durations = eligible.map((record) => record.postSession.totalReviewDurationSeconds);
  const pairedReductions = eligible
    .filter((record) => record.postSession.credibleCurrentMethodBaselineSeconds !== null)
    .map((record) => roundRate((record.postSession.credibleCurrentMethodBaselineSeconds - record.postSession.totalReviewDurationSeconds)
      / record.postSession.credibleCurrentMethodBaselineSeconds));
  const independentRate = rate(independentCount, tasks.length);
  const agreementRate = rate(agreementCount, judgments.length);
  const claimRate = rate(claimSuccessCount, claimChecks.length);
  const medianDuration = median(durations);
  const medianReduction = median(pairedReductions);
  const durationMet = complete && medianDuration <= HUMAN_VALIDATION_THRESHOLDS.medianReviewDurationSecondsMaximum;
  const reductionMet = complete
    && pairedReductions.length >= HUMAN_VALIDATION_THRESHOLDS.pairedBaselineCountMinimum
    && medianReduction >= HUMAN_VALIDATION_THRESHOLDS.medianTimeReductionRateMinimum;
  const timingMet = durationMet || reductionMet;
  const allThresholdsMet = complete
    && independentRate >= HUMAN_VALIDATION_THRESHOLDS.independentTaskCompletionRateMinimum
    && agreementRate >= HUMAN_VALIDATION_THRESHOLDS.fitAgreementRateMinimum
    && claimRate >= HUMAN_VALIDATION_THRESHOLDS.claimBoundarySuccessRateMinimum
    && seriousMisunderstandingCount === 0
    && usefulReviewerCount >= HUMAN_VALIDATION_THRESHOLDS.internalPursuitUsefulReviewerCountMinimum
    && timingMet && unresolvedP0 === 0 && unresolvedP1 === 0;

  return {
    schemaVersion: HUMAN_VALIDATION_AGGREGATE_SCHEMA_VERSION,
    boundary: HUMAN_VALIDATION_BOUNDARY,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    status: complete ? 'COMPLETE_FOR_HUMAN_DECISION' : 'INCOMPLETE',
    decision: complete ? 'HUMAN_DECISION_REQUIRED' : 'INCOMPLETE',
    recordIds: REVIEWER_IDS,
    counts: {
      recordCount: ordered.length,
      eligibleReviewerCount: eligible.length,
      taskResultCount: tasks.length,
      independentTaskCompletionCount: independentCount,
      assistedTaskCompletionCount: assistedCount,
      scenarioJudgmentCount: judgments.length,
      exactScenarioAgreementCount: agreementCount,
      claimBoundaryCheckCount: claimChecks.length,
      claimBoundarySuccessCount: claimSuccessCount,
      seriousMisunderstandingCount,
      internalPursuitUsefulReviewerCount: usefulReviewerCount,
      pairedBaselineCount: pairedReductions.length,
      unresolvedP0Count: unresolvedP0,
      unresolvedP1Count: unresolvedP1
    },
    rates: {
      independentTaskCompletionRate: independentRate,
      assistedTaskCompletionRate: rate(assistedCount, tasks.length),
      fitAgreementRate: agreementRate,
      claimBoundarySuccessRate: claimRate,
      medianTimeReductionRate: medianReduction
    },
    durations: { medianReviewDurationSeconds: medianDuration },
    findingSeverityCounts: severityCounts,
    thresholds: {
      independentTaskCompletion: thresholdState(complete, independentRate >= HUMAN_VALIDATION_THRESHOLDS.independentTaskCompletionRateMinimum),
      fitAgreement: thresholdState(complete, agreementRate >= HUMAN_VALIDATION_THRESHOLDS.fitAgreementRateMinimum),
      claimBoundary: thresholdState(complete, claimRate >= HUMAN_VALIDATION_THRESHOLDS.claimBoundarySuccessRateMinimum),
      seriousMisunderstandings: thresholdState(complete, seriousMisunderstandingCount === 0),
      internalPursuitUsefulness: thresholdState(complete, usefulReviewerCount >= HUMAN_VALIDATION_THRESHOLDS.internalPursuitUsefulReviewerCountMinimum),
      durationAlternative: thresholdState(complete, durationMet),
      pairedReductionAlternative: complete
        ? (pairedReductions.length < HUMAN_VALIDATION_THRESHOLDS.pairedBaselineCountMinimum ? 'NOT_APPLICABLE' : (reductionMet ? 'MET' : 'NOT_MET'))
        : 'INCOMPLETE',
      timingGate: thresholdState(complete, timingMet),
      unresolvedP0: thresholdState(complete, unresolvedP0 === 0),
      unresolvedP1: thresholdState(complete, unresolvedP1 === 0),
      summary: complete ? (allThresholdsMet ? 'MERGE_THRESHOLDS_MET' : 'MERGE_THRESHOLDS_NOT_MET') : 'INCOMPLETE'
    }
  };
}

export function serializeHumanValidationSession(record) {
  return `${JSON.stringify(record, null, 2)}\n`;
}
