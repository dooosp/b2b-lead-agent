import {
  validatePursuitValuePilotCaseCatalog,
  validatePursuitValuePilotProtocol,
  validatePursuitValuePilotSession,
} from '../../verticals/datacenter/pursuit-value-pilot-v0.mjs';

export const PURSUIT_VALUE_PILOT_RESPONSE_SCHEMA_VERSION =
  'pursuit-value-pilot-session-response-v0';

const REVIEWER_ID_PATTERN = /^PV-R([1-5])$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const PRESENTATION_ORDERS = new Set(['BASELINE_FIRST', 'TWIN_FIRST']);

const OPTIONS = Object.freeze({
  role: Object.freeze([
    ['TECHNICAL_SALES', '기술영업'],
    ['APPLICATION_ENGINEER', '응용 엔지니어링'],
    ['TENDER_SPEC_DESIGN', '입찰·사양·설계 지원'],
  ]),
  experienceBand: Object.freeze([
    ['LT_2_YEARS', '2년 미만'],
    ['Y2_TO_5', '2년 이상 5년 이하'],
    ['Y6_TO_10', '6년 이상 10년 이하'],
    ['GT_10_YEARS', '10년 초과'],
    ['PREFER_NOT_TO_SAY', '응답하지 않음'],
  ]),
  yesNo: Object.freeze([
    ['YES', '예'],
    ['NO', '아니오'],
  ]),
  yesNoUnsure: Object.freeze([
    ['YES', '예'],
    ['NO', '아니오'],
    ['UNSURE', '모르겠음'],
  ]),
  humanDecision: Object.freeze([
    ['PURSUE', 'PURSUE'],
    ['HOLD', 'HOLD'],
    ['NO_GO', 'NO_GO'],
    ['NO_BID', 'NO_BID'],
  ]),
  technicalStateDisposition: Object.freeze([
    ['ACCEPTED_AS_WRITTEN', '기술 상태를 그대로 수용'],
    ['MODIFIED', '기술 상태를 수정해 수용'],
    ['REJECTED', '기술 상태를 수용하지 않음'],
  ]),
  materiality: Object.freeze([
    ['', '이 공백을 기록하지 않음'],
    ['KEY', '핵심 공백 (KEY)'],
    ['NON_KEY', '비핵심 공백 (NON_KEY)'],
    ['NOT_A_GAP', '공백이 아님 (NOT_A_GAP)'],
  ]),
  priorAwareness: Object.freeze([
    ['', '선택'],
    ['YES', '검토 전에 알고 있었음'],
    ['NO', '검토 전에 모르고 있었음'],
    ['UNSURE', '모르겠음'],
  ]),
  discoveredBeforeDecision: Object.freeze([
    ['', '선택'],
    ['YES', '최종 판단 전에 발견'],
    ['NO', '최종 판단 후에 발견'],
  ]),
  decisionImpact: Object.freeze([
    ['IMPROVED', '판단이 더 명확해짐'],
    ['NO_CHANGE', '판단에 변화 없음'],
    ['WORSE', '판단이 더 어려워짐'],
    ['UNSURE', '모르겠음'],
  ]),
  finalDisposition: Object.freeze([
    ['ADVANCE', '다음 파일럿으로 진행'],
    ['ITERATE', '수정 후 다시 검토'],
    ['STOP', '파일럿 중단'],
    ['UNSURE', '모르겠음'],
  ]),
});

export class PursuitValuePilotOfflineHtmlError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'PursuitValuePilotOfflineHtmlError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, path) {
  throw new PursuitValuePilotOfflineHtmlError(code, path);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapePursuitValuePilotHtml(value) {
  return escapeHtml(value);
}

export function serializePursuitValuePilotScriptData(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function requireHash(value, path) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) fail('HASH_REQUIRED', path);
  return value;
}

function requireString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') fail('STRING_REQUIRED', path);
  return value;
}

function firstDefined(object, keys) {
  if (!isPlainObject(object)) return undefined;
  for (const key of keys) {
    if (object[key] !== undefined) return object[key];
  }
  return undefined;
}

function arrayAt(object, keys, path) {
  const value = firstDefined(object, keys);
  if (!Array.isArray(value)) fail('ARRAY_REQUIRED', path);
  return value;
}

function assertNull(value, path) {
  if (value !== null) fail('BLANK_HUMAN_INPUT_REQUIRED', path);
}

function assertBlankTrial(trial, expectedCaseId, path) {
  if (!isPlainObject(trial)) fail('BLANK_TRIAL_REQUIRED', path);
  if (trial.caseId !== expectedCaseId) fail('ASSIGNED_CASE_MISMATCH', `${path}.caseId`);
  for (const field of [
    'startedAt',
    'completedAt',
    'elapsedSeconds',
    'humanDecision',
    'evidenceTraceAttestation',
  ]) assertNull(trial[field], `${path}.${field}`);
  if (!Array.isArray(trial.selectedDecisionTraceRefs) || trial.selectedDecisionTraceRefs.length !== 0) {
    fail('BLANK_HUMAN_INPUT_REQUIRED', `${path}.selectedDecisionTraceRefs`);
  }
  if (!Array.isArray(trial.gapAssessments) || trial.gapAssessments.length !== 0) {
    fail('BLANK_HUMAN_INPUT_REQUIRED', `${path}.gapAssessments`);
  }
}

function assertBlankSession(session, assignment) {
  const humanInput = session.humanInput;
  if (!isPlainObject(humanInput)) fail('HUMAN_INPUT_REQUIRED', '$.blankSession.humanInput');
  for (const field of [
    'role',
    'experienceBand',
    'eligibilityConfirmed',
    'syntheticOnlyConfirmed',
    'technicalStateDisposition',
    'unsupportedCustomerUseClaimObserved',
    'unsupportedCustomerUseClaimCount',
    'wouldUseAgain',
    'weeklyUseIntent',
    'willingnessToPay',
    'decisionImpact',
    'finalDisposition',
  ]) assertNull(humanInput[field], `$.blankSession.humanInput.${field}`);
  assertBlankTrial(
    humanInput.baseline,
    assignment.assignedBaselineCaseId,
    '$.blankSession.humanInput.baseline',
  );
  assertBlankTrial(
    humanInput.twin,
    assignment.assignedTwinCaseId,
    '$.blankSession.humanInput.twin',
  );
}

function findAssignment(protocol, reviewerId) {
  const assignments = arrayAt(
    protocol,
    ['reviewerAssignments', 'assignments'],
    '$.protocol.reviewerAssignments',
  );
  const matches = assignments.filter((item) => (
    item?.reviewerId === reviewerId || item?.reviewerSlotId === reviewerId
  ));
  if (matches.length !== 1) fail('REVIEWER_ASSIGNMENT_MISMATCH', '$.protocol.reviewerAssignments');
  const raw = matches[0];
  return {
    reviewerId: raw.reviewerId ?? raw.reviewerSlotId,
    assignedRole: raw.reviewerRoleSlot ?? raw.assignedRole,
    presentationOrder: raw.reviewOrder ?? raw.presentationOrder,
    assignedBaselineCaseId: raw.baselineCaseId ?? raw.assignedBaselineCaseId,
    assignedTwinCaseId: raw.twinCaseId ?? raw.assignedTwinCaseId,
    canonicalSha256: raw.canonicalSha256,
  };
}

function findCase(caseCatalog, caseId) {
  const cases = Array.isArray(caseCatalog)
    ? caseCatalog
    : arrayAt(caseCatalog, ['cases', 'caseRecords'], '$.caseCatalog.cases');
  const matches = cases.filter((item) => item?.caseId === caseId);
  if (matches.length !== 1) fail('ASSIGNED_CASE_NOT_FOUND', '$.caseCatalog.cases');
  return matches[0];
}

function findBinding(protocol, reviewerId, condition, caseId) {
  const bindings = arrayAt(protocol, ['caseBindings'], '$.protocol.caseBindings');
  const matches = bindings.filter((item) => (
    item?.caseId === caseId
    && (item?.reviewerId === undefined || item.reviewerId === reviewerId)
    && (item?.condition === undefined || item.condition === condition)
  ));
  if (matches.length !== 1) fail('CASE_BINDING_NOT_FOUND', '$.protocol.caseBindings');
  return matches[0];
}

function requireAssignmentAgreement(session, assignment, protocol) {
  const sessionReviewerId = requireString(
    session.reviewerId ?? session.reviewer?.reviewerId ?? session.reviewer?.reviewerSlotId,
    '$.blankSession.reviewerId',
  );
  if (!REVIEWER_ID_PATTERN.test(sessionReviewerId)) fail('REVIEWER_ID_INVALID', '$.blankSession.reviewerId');
  const assignmentReviewerId = assignment.reviewerId ?? assignment.reviewerSlotId;
  if (assignmentReviewerId !== sessionReviewerId) {
    fail('REVIEWER_ASSIGNMENT_MISMATCH', '$.blankSession.reviewerId');
  }
  const sessionAssignment = {
    assignedRole: session.reviewerRoleSlot ?? session.assignedRole,
    presentationOrder: session.reviewOrder ?? session.presentationOrder,
    assignedBaselineCaseId: session.baselineCaseId ?? session.assignedBaselineCaseId,
    assignedTwinCaseId: session.twinCaseId ?? session.assignedTwinCaseId,
  };
  for (const field of Object.keys(sessionAssignment)) {
    if (sessionAssignment[field] !== assignment[field]) {
      fail('SESSION_ASSIGNMENT_MISMATCH', `$.blankSession.${field}`);
    }
  }
  if (!PRESENTATION_ORDERS.has(assignment.presentationOrder)) {
    fail('PRESENTATION_ORDER_INVALID', '$.assignment.presentationOrder');
  }
  if (assignment.assignedBaselineCaseId === assignment.assignedTwinCaseId) {
    fail('SAME_CASE_REUSE_REFUSED', '$.assignment');
  }
  const protocolHash = requireHash(protocol.canonicalSha256, '$.protocol.canonicalSha256');
  if (session.protocolCanonicalSha256 !== protocolHash) {
    fail('PROTOCOL_HASH_MISMATCH', '$.blankSession.protocolCanonicalSha256');
  }
  if (
    session.assignmentCanonicalSha256 !== undefined
    && assignment.canonicalSha256 !== undefined
    && session.assignmentCanonicalSha256 !== assignment.canonicalSha256
  ) fail('ASSIGNMENT_HASH_MISMATCH', '$.blankSession.assignmentCanonicalSha256');
  return sessionReviewerId;
}

function assertBoundary(protocol, session, caseCatalog) {
  const values = [protocol, session, caseCatalog];
  for (const [index, value] of values.entries()) {
    if (!isPlainObject(value)) fail('PLAIN_OBJECT_REQUIRED', `$[${index}]`);
    if (value.productionReady !== false) fail('PRODUCTION_READY_REFUSED', `$[${index}].productionReady`);
    if (value.issue165Status !== 'HOLD') fail('ISSUE_165_HOLD_REQUIRED', `$[${index}].issue165Status`);
  }
  const boundaryText = JSON.stringify({
    protocol: protocol.boundary,
    session: session.boundary,
    catalog: caseCatalog.boundary,
    protocolDataClass: protocol.dataClass,
    sessionDataClass: session.dataClass,
    catalogDataClass: caseCatalog.dataClass,
    protocolExecutionBoundary: protocol.executionBoundary,
    sessionExecutionBoundary: session.executionBoundary,
    catalogExecutionBoundary: caseCatalog.executionBoundary,
  });
  if (!boundaryText.includes('LOCAL_TEST_SYNTHETIC_ONLY')) {
    fail('LOCAL_TEST_SYNTHETIC_BOUNDARY_REQUIRED', '$.boundary');
  }
  if (!boundaryText.includes('NOT_PRODUCTION_EVIDENCE')) {
    fail('NOT_PRODUCTION_EVIDENCE_REQUIRED', '$.boundary');
  }
  if (!JSON.stringify(session).includes('NOT_COLLECTED')) {
    fail('REVIEWER_IDENTITY_BOUNDARY_REQUIRED', '$.blankSession.reviewerIdentity');
  }
  if (session.finalHumanDecision !== undefined && session.finalHumanDecision !== 'NOT_MADE') {
    fail('PREFILLED_FINAL_DECISION_REFUSED', '$.blankSession.finalHumanDecision');
  }
  if (session.pilotDisposition !== undefined && session.pilotDisposition !== 'NOT_MADE') {
    fail('PREFILLED_FINAL_DECISION_REFUSED', '$.blankSession.pilotDisposition');
  }
}

function artifactValue(caseRecord, kind) {
  if (kind === 'baseline') {
    return firstDefined(caseRecord, [
      'baselineArtifact',
      'baselineReviewArtifact',
      'rawBaselineArtifact',
      'rawArtifact',
    ]);
  }
  return firstDefined(caseRecord, [
    'pursuitTwinReviewPacket',
    'twinPacket',
    'pursuitTwinPacket',
    'assistedArtifact',
  ]);
}

function requireArtifactPart(object, keys, path) {
  const value = firstDefined(object, keys);
  if (value === undefined || value === null) fail('ASSIGNED_ARTIFACT_PART_MISSING', path);
  return value;
}

function refsFromBinding(binding) {
  const refs = firstDefined(binding, [
    'allowedDecisionTraceRefs',
    'decisionTraceRefs',
    'allowedTraceRefs',
  ]);
  if (!Array.isArray(refs) || refs.length === 0) {
    fail('DECISION_TRACE_REFS_REQUIRED', '$.protocol.caseBindings');
  }
  if (new Set(refs).size !== refs.length || refs.some((value) => typeof value !== 'string' || !value)) {
    fail('DECISION_TRACE_REFS_INVALID', '$.protocol.caseBindings');
  }
  return [...refs];
}

function gapsFromBinding(binding) {
  const gaps = firstDefined(binding, ['allowedGapIds', 'gapIds']);
  if (!Array.isArray(gaps) || gaps.length === 0) fail('GAP_IDS_REQUIRED', '$.protocol.caseBindings');
  if (new Set(gaps).size !== gaps.length || gaps.some((value) => typeof value !== 'string' || !value)) {
    fail('GAP_IDS_INVALID', '$.protocol.caseBindings');
  }
  return [...gaps];
}

function buildViewModel(protocol, blankSession, caseCatalog) {
  validatePursuitValuePilotProtocol(protocol);
  validatePursuitValuePilotSession(blankSession, protocol);
  if (!caseCatalog) fail('CASE_CATALOG_REQUIRED', '$.caseCatalog');
  validatePursuitValuePilotCaseCatalog(caseCatalog);
  assertBoundary(protocol, blankSession, caseCatalog);

  const reviewerId = blankSession.reviewerId
    ?? blankSession.reviewer?.reviewerId
    ?? blankSession.reviewer?.reviewerSlotId;
  const assignment = findAssignment(protocol, reviewerId);
  const safeReviewerId = requireAssignmentAgreement(blankSession, assignment, protocol);
  assertBlankSession(blankSession, assignment);

  const catalogHash = requireHash(caseCatalog.canonicalSha256, '$.caseCatalog.canonicalSha256');
  const pinnedCatalogHash = protocol.caseCatalogCanonicalSha256 ?? protocol.catalogCanonicalSha256;
  if (pinnedCatalogHash !== catalogHash) {
    fail('CASE_CATALOG_HASH_MISMATCH', '$.protocol.caseCatalogCanonicalSha256');
  }

  const baselineCase = findCase(caseCatalog, assignment.assignedBaselineCaseId);
  const twinCase = findCase(caseCatalog, assignment.assignedTwinCaseId);
  const baselineBinding = findBinding(
    protocol,
    safeReviewerId,
    'BASELINE',
    assignment.assignedBaselineCaseId,
  );
  const twinBinding = findBinding(
    protocol,
    safeReviewerId,
    'TWIN',
    assignment.assignedTwinCaseId,
  );
  const baselineArtifact = artifactValue(baselineCase, 'baseline');
  const twinPacket = artifactValue(twinCase, 'twin');
  if (baselineArtifact === undefined) {
    fail('BASELINE_ARTIFACT_REQUIRED', '$.caseCatalog.cases.baselineArtifact');
  }
  if (!isPlainObject(twinPacket)) fail('TWIN_PACKET_REQUIRED', '$.caseCatalog.cases.twinPacket');
  const specificationDelta = requireArtifactPart(
    twinPacket,
    ['specificationDelta', 'specDelta'],
    '$.caseCatalog.cases.twinPacket.specificationDelta',
  );
  const minimumEvidence = requireArtifactPart(
    twinPacket,
    ['minimumEvidenceToAdvance'],
    '$.caseCatalog.cases.twinPacket.minimumEvidenceToAdvance',
  );

  const reviewerNumber = REVIEWER_ID_PATTERN.exec(safeReviewerId)[1];
  return {
    reviewerId: safeReviewerId,
    sessionId: requireString(blankSession.sessionId, '$.blankSession.sessionId'),
    assignedRole: requireString(assignment.assignedRole, '$.assignment.assignedRole'),
    presentationOrder: assignment.presentationOrder,
    phaseOrder: assignment.presentationOrder === 'BASELINE_FIRST'
      ? ['baseline', 'twin']
      : ['twin', 'baseline'],
    downloadFilename: `session-pv-r${reviewerNumber}.json`,
    protocolCanonicalSha256: protocol.canonicalSha256,
    blankSessionCanonicalSha256: requireHash(
      blankSession.canonicalSha256,
      '$.blankSession.canonicalSha256',
    ),
    baseline: {
      caseId: assignment.assignedBaselineCaseId,
      binding: baselineBinding,
      artifact: baselineArtifact,
    },
    twin: {
      caseId: assignment.assignedTwinCaseId,
      binding: twinBinding,
      specificationDelta,
      minimumEvidence,
      traceRefs: refsFromBinding(twinBinding),
      gapIds: gapsFromBinding(twinBinding),
    },
    blankHumanInput: cloneJson(blankSession.humanInput),
  };
}

function renderRadioGroup({ id, legend, name, options, hint = '' }) {
  const choices = options.map(([value, label]) => `
          <label class="choice" for="${escapeHtml(id)}-${escapeHtml(value.toLowerCase())}">
            <input id="${escapeHtml(id)}-${escapeHtml(value.toLowerCase())}" type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" required>
            <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(value)}</small></span>
          </label>`).join('');
  return `
      <fieldset class="question" id="${escapeHtml(id)}-group" tabindex="-1">
        <legend>${escapeHtml(legend)}</legend>
        ${hint ? `<p class="hint" id="${escapeHtml(id)}-hint">${escapeHtml(hint)}</p>` : ''}
        <div class="choice-grid"${hint ? ` aria-describedby="${escapeHtml(id)}-hint"` : ''}>${choices}
        </div>
      </fieldset>`;
}

function renderSelect({ id, label, options, required = true, hint = '' }) {
  return `
      <div class="question">
        <label for="${escapeHtml(id)}"><strong>${escapeHtml(label)}</strong></label>
        ${hint ? `<p class="hint" id="${escapeHtml(id)}-hint">${escapeHtml(hint)}</p>` : ''}
        <select id="${escapeHtml(id)}"${required ? ' required' : ''}${hint ? ` aria-describedby="${escapeHtml(id)}-hint"` : ''}>
          ${options.map(([value, text]) => `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`).join('')}
        </select>
      </div>`;
}

function prettyJson(value) {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function renderArtifactCard(title, description, value) {
  return `
      <section class="artifact" aria-label="${escapeHtml(title)}">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        <pre tabindex="0">${prettyJson(value)}</pre>
      </section>`;
}

function renderTraceRefs(refs) {
  return `
      <fieldset class="question" id="twin-trace-refs-group" tabindex="-1">
        <legend>이 판단을 역추적할 때 사용한 trace ID</legend>
        <p class="hint" id="twin-trace-refs-hint">패킷에 표시된 ID만 선택하세요. 확인하지 못했다면 선택하지 않아도 됩니다.</p>
        <div class="choice-grid" aria-describedby="twin-trace-refs-hint">
          ${refs.map((ref, index) => `
          <label class="choice" for="twin-trace-ref-${index}">
            <input id="twin-trace-ref-${index}" type="checkbox" name="twin-selectedDecisionTraceRefs" value="${escapeHtml(ref)}">
            <span><strong>${escapeHtml(ref)}</strong><small>ALLOWED_TRACE_REF</small></span>
          </label>`).join('')}
        </div>
      </fieldset>`;
}

function renderGapControls(gapIds) {
  return `
      <fieldset class="question gap-list" id="twin-gap-assessments-group" tabindex="-1">
        <legend>패킷에서 판단 전에 발견한 데이터 공백</legend>
        <p class="hint">패킷에 있는 gap ID만 구조화해 기록합니다. 임의 텍스트는 저장하지 않습니다.</p>
        ${gapIds.map((gapId, index) => `
        <fieldset class="gap" data-gap-id="${escapeHtml(gapId)}">
          <legend>${escapeHtml(gapId)}</legend>
          ${renderSelect({
            id: `twin-gap-${index}-materiality`,
            label: '공백 중요도',
            options: OPTIONS.materiality,
            required: false,
          })}
          ${renderSelect({
            id: `twin-gap-${index}-prior`,
            label: '검토 전 인지 여부',
            options: OPTIONS.priorAwareness,
            required: false,
          })}
          ${renderSelect({
            id: `twin-gap-${index}-before`,
            label: '판단 전 발견 여부',
            options: OPTIONS.discoveredBeforeDecision,
            required: false,
          })}
        </fieldset>`).join('')}
      </fieldset>`;
}

function renderPhase(view, phase, position) {
  const isTwin = phase === 'twin';
  const condition = isTwin ? 'Pursuit Twin 보조 검토' : 'Baseline 원본 검토';
  const caseId = view[phase].caseId;
  const artifact = isTwin
    ? `${renderArtifactCard(
      'Twin Spec Delta',
      '사양 revision 간 변경입니다. 이 표시는 상업적 최종 판단이 아닙니다.',
      view.twin.specificationDelta,
    )}${renderArtifactCard(
      'Minimum Evidence to Advance',
      '증거가 채워져도 재평가만 가능하며 FIT은 보장되지 않습니다.',
      view.twin.minimumEvidence,
    )}${renderArtifactCard(
      '판단 trace ID 목록',
      '판단 역추적 확인에 사용할 수 있는 정확한 ID입니다.',
      view.twin.traceRefs,
    )}`
    : renderArtifactCard(
      'Baseline raw artifact',
      '어떤 Pursuit Twin 해석도 추가하지 않은 배정된 synthetic 원본입니다.',
      view.baseline.artifact,
    );
  return `
    <section id="phase-${phase}" class="panel phase" data-phase="${phase}" hidden aria-labelledby="phase-${phase}-heading">
      <p class="step">배정 순서 ${position + 1}/2 · ${escapeHtml(view.presentationOrder)}</p>
      <h2 id="phase-${phase}-heading" tabindex="-1">${escapeHtml(condition)}</h2>
      <p class="case-id">배정 케이스: <code>${escapeHtml(caseId)}</code></p>
      <div id="${phase}-material" hidden>
        ${artifact}
      </div>
      <div class="timer-box" aria-label="${escapeHtml(condition)} 시간">
        <span class="state-label" id="${phase}-state">상태: 시작 전</span>
        <output id="${phase}-timer" aria-labelledby="${phase}-timer-label">0초</output>
        <span id="${phase}-timer-label" class="hint">브라우저 monotonic 경과 시간</span>
      </div>
      <button class="button primary" type="button" id="${phase}-start">이 단계 타이머 시작</button>
      <fieldset id="${phase}-answers" class="phase-answers" hidden disabled>
        <legend>${escapeHtml(condition)} 사람 판단</legend>
        ${renderRadioGroup({
          id: `${phase}-human-decision`,
          legend: '당신의 Pursuit / Hold / No-Go / No-Bid 판단',
          name: `${phase}-humanDecision`,
          options: OPTIONS.humanDecision,
          hint: '시스템이 아닌 검토자 본인의 판단입니다.',
        })}
        ${isTwin ? `${renderRadioGroup({
          id: 'twin-trace-attestation',
          legend: '선택한 판단을 패킷 trace ID로 역추적할 수 있습니까?',
          name: 'twin-evidenceTraceAttestation',
          options: OPTIONS.yesNo,
        })}${renderTraceRefs(view.twin.traceRefs)}${renderGapControls(view.twin.gapIds)}` : ''}
        <button class="button danger" type="button" id="${phase}-stop">현재 단계 타이머 정지 및 응답 잠금</button>
      </fieldset>
    </section>`;
}

function renderPostSession() {
  const countOptions = Array.from({ length: 101 }, (_, value) => [String(value), String(value)]);
  return `
    <section id="post-session" class="panel" hidden aria-labelledby="post-session-heading">
      <p class="step">두 검토 단계가 잠김 상태입니다.</p>
      <h2 id="post-session-heading" tabindex="-1">구조화된 후속 응답</h2>
      <p>응답은 서버로 전송되지 않으며, 결과는 승인·통과·제출을 의미하지 않습니다.</p>
      ${renderRadioGroup({
        id: 'technical-state-disposition',
        legend: 'Pursuit Twin 기술 상태에 대한 판단',
        name: 'technicalStateDisposition',
        options: OPTIONS.technicalStateDisposition,
      })}
      ${renderRadioGroup({
        id: 'unsupported-claim-observed',
        legend: '지원되지 않는 customer-use claim을 발견했습니까?',
        name: 'unsupportedCustomerUseClaimObserved',
        options: OPTIONS.yesNo,
      })}
      ${renderSelect({
        id: 'unsupported-claim-count',
        label: '발견한 unsupported customer-use claim 수 (0~100)',
        options: [['', '선택'], ...countOptions],
      })}
      ${renderRadioGroup({
        id: 'would-use-again',
        legend: '이 패킷을 다시 사용하겠습니까?',
        name: 'wouldUseAgain',
        options: OPTIONS.yesNo,
      })}
      ${renderRadioGroup({
        id: 'weekly-use-intent',
        legend: '주간 검토 패킷으로 사용하겠습니까?',
        name: 'weeklyUseIntent',
        options: OPTIONS.yesNoUnsure,
      })}
      ${renderRadioGroup({
        id: 'willingness-to-pay',
        legend: '현재 가치에 비용을 지불할 의향이 있습니까?',
        name: 'willingnessToPay',
        options: OPTIONS.yesNoUnsure,
      })}
      ${renderRadioGroup({
        id: 'decision-impact',
        legend: 'Pursuit Twin이 당신의 판단에 미친 영향',
        name: 'decisionImpact',
        options: OPTIONS.decisionImpact,
      })}
      ${renderRadioGroup({
        id: 'final-disposition',
        legend: '당신의 파일럿 최종 disposition',
        name: 'finalDisposition',
        options: OPTIONS.finalDisposition,
        hint: '이 응답은 오직 사람이 선택합니다. 자동 판단은 없습니다.',
      })}
      <div class="download-box">
        <p><strong>파일 저장 전 확인:</strong> 응답 JSON은 이 기기에만 내려받으며 자동 제출되지 않습니다.</p>
        <button class="button primary" type="button" id="download-response">응답 JSON 다운로드 — 서버로 전송되지 않음</button>
      </div>
    </section>`;
}

const OFFLINE_CSS = String.raw`
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; font-size: 100%; --ink:#17202a; --muted:#4b5563; --paper:#fff; --wash:#f4f7fb; --line:#263849; --accent:#0b5cad; --danger:#8b1e1e; }
    * { box-sizing: border-box; }
    body { margin:0; color:var(--ink); background:var(--wash); overflow-wrap:anywhere; }
    a { color:#064f96; }
    .skip-link { position:absolute; left:1rem; top:-8rem; background:#fff; color:#000; padding:.75rem; z-index:10; border:2px solid #000; }
    .skip-link:focus { top:1rem; }
    header, main, footer { width:min(72rem, calc(100% - 2rem)); margin-inline:auto; }
    header { padding:2rem 0 1rem; }
    h1, h2, h3, legend { line-height:1.25; }
    .eyebrow, .boundary-item, .state-label, .step, .case-id { font-weight:700; letter-spacing:.02em; }
    .boundary { border:3px solid var(--line); background:#fff8db; padding:1rem; margin:1rem 0; }
    .boundary ul { margin:.5rem 0 0; padding-left:1.5rem; }
    .panel { background:var(--paper); border:2px solid var(--line); border-radius:.5rem; padding:clamp(1rem, 3vw, 2rem); margin:1rem 0 2rem; }
    .panel[hidden] { display:none !important; }
    .question { border:1px solid #8794a1; border-radius:.35rem; padding:1rem; margin:1rem 0; min-inline-size:0; }
    .question > legend { font-weight:700; padding:0 .35rem; }
    .choice-grid { display:grid; gap:.65rem; grid-template-columns:repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); }
    .choice { display:flex; gap:.65rem; align-items:flex-start; min-height:3rem; padding:.7rem; border:2px solid #7b8794; border-radius:.35rem; background:#fff; cursor:pointer; }
    .choice input { inline-size:1.25rem; block-size:1.25rem; flex:0 0 auto; margin-top:.15rem; }
    .choice span { display:flex; flex-direction:column; }
    .choice small, .hint { color:var(--muted); }
    select { display:block; width:min(100%, 34rem); min-height:2.75rem; padding:.55rem; font:inherit; margin-top:.45rem; border:2px solid #596675; background:#fff; color:#111; }
    .button { min-height:2.75rem; padding:.7rem 1rem; border:2px solid #000; border-radius:.35rem; font:inherit; font-weight:700; cursor:pointer; margin:.5rem .5rem .5rem 0; }
    .button.primary { background:var(--accent); color:#fff; }
    .button.danger { background:#fff; color:var(--danger); border-color:var(--danger); }
    .button:disabled { cursor:not-allowed; opacity:.6; }
    :focus-visible { outline:4px solid #ffbf00; outline-offset:3px; }
    .artifact { margin:1rem 0; border-left:.5rem solid #536b7c; padding:.5rem 1rem; background:#f8fafc; }
    pre { white-space:pre-wrap; overflow:auto; max-height:24rem; padding:1rem; color:#101820; background:#edf2f7; border:1px solid #607080; font-size:.9rem; }
    code { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
    .timer-box { display:flex; flex-wrap:wrap; gap:.75rem 1.5rem; align-items:center; border:2px dashed #596675; padding:1rem; margin:1rem 0; }
    output { font-size:1.4rem; font-weight:800; }
    .gap { border:1px dashed #6b7785; margin:1rem 0; padding:.75rem; min-inline-size:0; }
    .download-box { border:3px solid var(--accent); padding:1rem; margin-top:1.5rem; }
    #error-summary { border:4px solid var(--danger); background:#fff4f4; padding:1rem; margin:1rem 0; }
    #error-summary:focus { outline:4px solid #ffbf00; }
    #status { position:fixed; inset:auto 1rem 1rem 1rem; max-width:42rem; margin:auto; background:#111; color:#fff; padding:.8rem 1rem; border:2px solid #fff; }
    #status:empty { display:none; }
    [aria-invalid="true"] { outline:3px solid var(--danger); outline-offset:2px; }
    footer { padding:1rem 0 3rem; color:var(--muted); }
    @media (max-width: 42rem) { header, main, footer { width:min(100% - 1rem, 72rem); } .panel { padding:1rem; } .choice-grid { grid-template-columns:1fr; } .button { width:100%; margin-right:0; } pre { max-height:none; } }
    @media (forced-colors: active) { .boundary, .artifact, .download-box { border:2px solid CanvasText; } }
    @media print { #status, .button, .skip-link { display:none !important; } .panel[hidden] { display:none !important; } }
`;

const OFFLINE_RUNTIME = String.raw`
(function () {
  'use strict';
  var configNode = document.getElementById('pilot-data');
  var config = JSON.parse(configNode.textContent);
  var response = {
    schemaVersion: config.responseSchemaVersion,
    protocolCanonicalSha256: config.protocolCanonicalSha256,
    blankSessionCanonicalSha256: config.blankSessionCanonicalSha256,
    sessionId: config.sessionId,
    reviewerId: config.reviewerId,
    humanInput: JSON.parse(JSON.stringify(config.blankHumanInput))
  };
  var phaseRuns = Object.create(null);
  var activePhase = null;
  var dirty = false;

  function byId(id) { return document.getElementById(id); }
  function checkedValue(name) {
    var node = document.querySelector('input[name="' + name + '"]:checked');
    return node ? node.value : null;
  }
  function checkedValues(name) {
    return Array.prototype.map.call(
      document.querySelectorAll('input[name="' + name + '"]:checked'),
      function (node) { return node.value; }
    );
  }
  function status(message) { byId('status').textContent = message; }
  function formatSeconds(seconds) { return String(Math.max(0, seconds)) + '초'; }
  function clearErrors() {
    var summary = byId('error-summary');
    summary.hidden = true;
    while (summary.querySelector('ul').firstChild) summary.querySelector('ul').firstChild.remove();
    Array.prototype.forEach.call(document.querySelectorAll('[aria-invalid="true"]'), function (node) {
      node.removeAttribute('aria-invalid');
    });
  }
  function showErrors(errors) {
    clearErrors();
    var summary = byId('error-summary');
    var list = summary.querySelector('ul');
    errors.forEach(function (error) {
      var target = byId(error.id);
      if (target) target.setAttribute('aria-invalid', 'true');
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.setAttribute('href', '#' + error.id);
      link.textContent = error.message;
      item.appendChild(link);
      list.appendChild(item);
    });
    summary.hidden = false;
    summary.focus();
  }
  function requireRadio(errors, name, id, message) {
    var value = checkedValue(name);
    if (!value) errors.push({ id: id, message: message });
    return value;
  }
  function reveal(id, message) {
    var section = byId(id);
    section.hidden = false;
    var heading = section.querySelector('h2');
    if (heading) heading.focus();
    status(message);
  }
  function hide(id) { byId(id).hidden = true; }
  function collectEligibility() {
    var errors = [];
    var role = byId('role').value;
    var experience = byId('experience-band').value;
    if (!role) errors.push({ id: 'role', message: '역할을 선택하세요.' });
    if (!experience) errors.push({ id: 'experience-band', message: '경력 구간을 선택하세요.' });
    var eligible = requireRadio(errors, 'eligibilityConfirmed', 'eligibility-confirmed-group', '파일럿 적격 확인에 응답하세요.');
    var synthetic = requireRadio(errors, 'syntheticOnlyConfirmed', 'synthetic-only-confirmed-group', 'synthetic-only 경계 확인에 응답하세요.');
    if (role && role !== config.assignedRole) errors.push({ id: 'role', message: '배정된 역할과 실제 역할이 일치해야 이 세션을 시작할 수 있습니다.' });
    if (eligible && eligible !== 'YES') errors.push({ id: 'eligibility-confirmed-group', message: '적격을 확인할 수 없으면 이 세션을 시작하지 마세요.' });
    if (synthetic && synthetic !== 'YES') errors.push({ id: 'synthetic-only-confirmed-group', message: 'synthetic-only 경계를 확인할 수 없으면 이 세션을 시작하지 마세요.' });
    if (errors.length) { showErrors(errors); return false; }
    clearErrors();
    response.humanInput.role = role;
    response.humanInput.experienceBand = experience;
    response.humanInput.eligibilityConfirmed = eligible;
    response.humanInput.syntheticOnlyConfirmed = synthetic;
    byId('eligibility-fieldset').disabled = true;
    hide('eligibility');
    reveal('phase-' + config.phaseOrder[0], '첫 검토 단계가 준비되었습니다. 준비가 되면 타이머를 시작하세요.');
    dirty = true;
    return true;
  }
  function startPhase(phase) {
    if (activePhase || phaseRuns[phase]) return;
    clearErrors();
    activePhase = phase;
    var run = { monotonicStarted: performance.now(), wallStartedAt: new Date().toISOString(), interval: null };
    phaseRuns[phase] = run;
    byId(phase + '-material').hidden = false;
    byId(phase + '-answers').hidden = false;
    byId(phase + '-answers').disabled = false;
    byId(phase + '-start').disabled = true;
    byId(phase + '-state').textContent = '상태: 측정 중';
    run.interval = window.setInterval(function () {
      var elapsed = Math.max(0, Math.floor((performance.now() - run.monotonicStarted) / 1000));
      byId(phase + '-timer').textContent = formatSeconds(elapsed);
    }, 250);
    status((phase === 'baseline' ? 'Baseline' : 'Pursuit Twin') + ' 검토 타이머가 시작됐습니다.');
    dirty = true;
  }
  function collectTwinDetails(errors) {
    var attestation = requireRadio(errors, 'twin-evidenceTraceAttestation', 'twin-trace-attestation-group', 'trace 역추적 확인에 응답하세요.');
    var selectedRefs = checkedValues('twin-selectedDecisionTraceRefs');
    if (attestation === 'YES' && selectedRefs.length === 0) {
      errors.push({ id: 'twin-trace-refs-group', message: 'trace 확인이 YES면 최소 1개의 trace ID를 선택하세요.' });
    }
    if (attestation === 'NO' && selectedRefs.length !== 0) {
      errors.push({ id: 'twin-trace-refs-group', message: 'trace 확인이 NO면 trace ID를 선택하지 마세요.' });
    }
    var assessments = [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-gap-id]'), function (gap, index) {
      var materiality = byId('twin-gap-' + index + '-materiality').value;
      var prior = byId('twin-gap-' + index + '-prior').value;
      var before = byId('twin-gap-' + index + '-before').value;
      if (!materiality) {
        if (prior || before) errors.push({ id: 'twin-gap-' + index + '-materiality', message: gap.dataset.gapId + ': 먼저 공백 중요도를 선택하세요.' });
        return;
      }
      if (!prior) errors.push({ id: 'twin-gap-' + index + '-prior', message: gap.dataset.gapId + ': 사전 인지 여부를 선택하세요.' });
      if (!before) errors.push({ id: 'twin-gap-' + index + '-before', message: gap.dataset.gapId + ': 판단 전 발견 여부를 선택하세요.' });
      if (prior && before) assessments.push({
        gapId: gap.dataset.gapId,
        materiality: materiality,
        priorAwareness: prior,
        discoveredBeforeDecision: before
      });
    });
    return { attestation: attestation, selectedRefs: selectedRefs, assessments: assessments };
  }
  function stopPhase(phase) {
    if (activePhase !== phase || !phaseRuns[phase]) return;
    var errors = [];
    var decision = requireRadio(errors, phase + '-humanDecision', phase + '-human-decision-group', '사람 Pursuit 판단을 선택하세요.');
    var twinDetails = phase === 'twin' ? collectTwinDetails(errors) : null;
    if (errors.length) { showErrors(errors); return; }
    clearErrors();
    var run = phaseRuns[phase];
    var ended = performance.now();
    window.clearInterval(run.interval);
    var elapsedSeconds = Math.max(1, Math.ceil((ended - run.monotonicStarted) / 1000));
    var trial = response.humanInput[phase];
    trial.startedAt = run.wallStartedAt;
    trial.completedAt = new Date().toISOString();
    trial.elapsedSeconds = elapsedSeconds;
    trial.humanDecision = decision;
    trial.evidenceTraceAttestation = phase === 'twin' ? twinDetails.attestation : null;
    trial.selectedDecisionTraceRefs = phase === 'twin' ? twinDetails.selectedRefs : [];
    trial.gapAssessments = phase === 'twin' ? twinDetails.assessments : [];
    byId(phase + '-timer').textContent = formatSeconds(elapsedSeconds);
    byId(phase + '-state').textContent = '상태: 응답 잠김 (다시 열 수 없음)';
    byId(phase + '-answers').disabled = true;
    activePhase = null;
    var position = config.phaseOrder.indexOf(phase);
    hide('phase-' + phase);
    if (position < config.phaseOrder.length - 1) {
      reveal('phase-' + config.phaseOrder[position + 1], (phase === 'baseline' ? 'Baseline' : 'Pursuit Twin') + ' 단계가 잠김 처리됐고 다음 단계가 준비됐습니다.');
    } else {
      reveal('post-session', '두 검토 단계가 모두 잠김 처리됐습니다. 후속 응답을 작성하세요.');
    }
  }
  function collectPostSession() {
    var errors = [];
    var technical = requireRadio(errors, 'technicalStateDisposition', 'technical-state-disposition-group', '기술 상태 disposition을 선택하세요.');
    var unsupportedObserved = requireRadio(errors, 'unsupportedCustomerUseClaimObserved', 'unsupported-claim-observed-group', 'unsupported claim 발견 여부를 선택하세요.');
    var countText = byId('unsupported-claim-count').value;
    var count = countText === '' ? null : Number(countText);
    if (count === null) errors.push({ id: 'unsupported-claim-count', message: 'unsupported claim 수를 선택하세요.' });
    if (unsupportedObserved === 'NO' && count !== null && count !== 0) errors.push({ id: 'unsupported-claim-count', message: '발견 여부가 NO면 수는 0이어야 합니다.' });
    if (unsupportedObserved === 'YES' && count !== null && count < 1) errors.push({ id: 'unsupported-claim-count', message: '발견 여부가 YES면 수는 1 이상이어야 합니다.' });
    var again = requireRadio(errors, 'wouldUseAgain', 'would-use-again-group', '다시 사용할지 선택하세요.');
    var weekly = requireRadio(errors, 'weeklyUseIntent', 'weekly-use-intent-group', '주간 사용 의향을 선택하세요.');
    var wtp = requireRadio(errors, 'willingnessToPay', 'willingness-to-pay-group', '지불 의향을 선택하세요.');
    var impact = requireRadio(errors, 'decisionImpact', 'decision-impact-group', '판단 영향을 선택하세요.');
    var disposition = requireRadio(errors, 'finalDisposition', 'final-disposition-group', '최종 disposition을 사람이 선택하세요.');
    if (errors.length) { showErrors(errors); return false; }
    clearErrors();
    response.humanInput.technicalStateDisposition = technical;
    response.humanInput.unsupportedCustomerUseClaimObserved = unsupportedObserved;
    response.humanInput.unsupportedCustomerUseClaimCount = count;
    response.humanInput.wouldUseAgain = again;
    response.humanInput.weeklyUseIntent = weekly;
    response.humanInput.willingnessToPay = wtp;
    response.humanInput.decisionImpact = impact;
    response.humanInput.finalDisposition = disposition;
    return true;
  }
  function downloadResponse() {
    if (!collectPostSession()) return;
    var serialized = JSON.stringify(response, null, 2) + '\n';
    var blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
    var objectUrl = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = objectUrl;
    link.download = config.downloadFilename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 0);
  }

  byId('begin-review').addEventListener('click', collectEligibility);
  ['baseline', 'twin'].forEach(function (phase) {
    byId(phase + '-start').addEventListener('click', function () { startPhase(phase); });
    byId(phase + '-stop').addEventListener('click', function () { stopPhase(phase); });
  });
  byId('download-response').addEventListener('click', downloadResponse);
  byId('pilot-form').addEventListener('change', function () { dirty = true; });
  window.addEventListener('beforeunload', function (event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}());
`;

export function renderPursuitValuePilotOfflineHtml(protocol, blankSession, caseCatalog) {
  const view = buildViewModel(protocol, blankSession, caseCatalog);
  const runtimeConfig = {
    responseSchemaVersion: PURSUIT_VALUE_PILOT_RESPONSE_SCHEMA_VERSION,
    protocolCanonicalSha256: view.protocolCanonicalSha256,
    blankSessionCanonicalSha256: view.blankSessionCanonicalSha256,
    sessionId: view.sessionId,
    reviewerId: view.reviewerId,
    assignedRole: view.assignedRole,
    phaseOrder: view.phaseOrder,
    downloadFilename: view.downloadFilename,
    blankHumanInput: view.blankHumanInput,
  };
  const phaseHtml = view.phaseOrder.map((phase, position) => renderPhase(view, phase, position)).join('');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; font-src 'none'; object-src 'none'; media-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
  <title>Pursuit Value Pilot v0 · ${escapeHtml(view.reviewerId)}</title>
  <style>${OFFLINE_CSS}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
  <header>
    <p class="eyebrow">LOCAL/TEST SYNTHETIC ONLY</p>
    <h1>Pursuit Value Pilot v0 · ${escapeHtml(view.reviewerId)}</h1>
    <p>배정 역할: <strong>${escapeHtml(view.assignedRole)}</strong> · 고정 순서: <strong>${escapeHtml(view.presentationOrder)}</strong></p>
    <aside class="boundary" aria-labelledby="boundary-heading">
      <h2 id="boundary-heading">경계를 먼저 확인하세요</h2>
      <ul>
        <li class="boundary-item">LOCAL/TEST SYNTHETIC ONLY</li>
        <li class="boundary-item">NOT_PRODUCTION_EVIDENCE</li>
        <li class="boundary-item">productionReady:false</li>
        <li class="boundary-item">Issue #165 HOLD</li>
        <li class="boundary-item">reviewer identity: NOT_COLLECTED</li>
        <li>최종 Pursuit 판단과 파일럿 disposition은 사람이 선택하며 자동 판단이 없습니다.</li>
        <li>이 페이지는 서버·API·D1·브라우저 저장소를 사용하지 않고 어떤 데이터도 전송하지 않습니다.</li>
      </ul>
    </aside>
    <p><strong>새로고침·탭 닫기 경고:</strong> 입력과 측정 시간이 손실됩니다. 두 단계를 끝낸 뒤 JSON을 내려받으세요.</p>
    <p class="hint">키보드: Tab으로 항목을 이동하고 Space로 선택하며 Enter로 버튼을 실행하세요. 라디오 선택만으로는 다음 단계로 이동하지 않습니다.</p>
  </header>
  <main id="main-content" tabindex="-1">
    <div id="error-summary" role="alert" tabindex="-1" hidden>
      <h2>확인할 응답이 있습니다</h2>
      <ul></ul>
    </div>
    <form id="pilot-form" novalidate>
      <section id="eligibility" class="panel" aria-labelledby="eligibility-heading">
        <h2 id="eligibility-heading">검토자 적격·경계 확인</h2>
        <p>이름·회사·이메일은 수집하지 않습니다. <code>${escapeHtml(view.reviewerId)}</code>는 인증된 신원이 아닙니다.</p>
        <fieldset id="eligibility-fieldset">
          <legend>구조화된 eligibility 응답</legend>
          ${renderSelect({ id: 'role', label: '실제 역할', options: [['', '선택'], ...OPTIONS.role] })}
          ${renderSelect({ id: 'experience-band', label: '관련 경력 구간', options: [['', '선택'], ...OPTIONS.experienceBand] })}
          ${renderRadioGroup({
            id: 'eligibility-confirmed',
            legend: '배정 역할의 기술 프로젝트 초기 검토를 수행할 수 있습니까?',
            name: 'eligibilityConfirmed',
            options: OPTIONS.yesNo,
          })}
          ${renderRadioGroup({
            id: 'synthetic-only-confirmed',
            legend: '모든 자료가 local/test synthetic이고 실제 고객·프로젝트 증거가 아님을 확인합니까?',
            name: 'syntheticOnlyConfirmed',
            options: OPTIONS.yesNo,
          })}
          <button class="button primary" type="button" id="begin-review">고정 순서로 검토 시작</button>
        </fieldset>
      </section>
      ${phaseHtml}
      ${renderPostSession()}
    </form>
  </main>
  <footer>
    <p>섹션이 잠김 처리되어도 승인·통과·제출을 의미하지 않습니다. 해시는 내용 일치만 표시하며 사람 신원이나 사실을 증명하지 않습니다.</p>
  </footer>
  <div id="status" role="status" aria-live="polite" aria-atomic="true"></div>
  <script id="pilot-data" type="application/json">${serializePursuitValuePilotScriptData(runtimeConfig)}</script>
  <script>${OFFLINE_RUNTIME}</script>
</body>
</html>
`;
}
