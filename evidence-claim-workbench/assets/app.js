import { copyPatchText, downloadPatchText } from './browser-effects.mjs';

const CAPABILITY_OPTIONS = Object.freeze({
  medium_voltage_switchgear: Object.freeze({
    rated_voltage: { label: '정격 전압', types: ['QUANTITY'], units: ['V', 'kV'] },
    rated_current: { label: '정격 전류', types: ['QUANTITY'], units: ['A', 'kA'] },
    short_circuit_rating: { label: '단락 정격', types: ['QUANTITY'], units: ['A', 'kA'] },
    frequency: { label: '주파수', types: ['QUANTITY'], units: ['Hz'] },
    insulation_medium: { label: '절연 매체', types: ['ENUM'], units: [''] },
    indoor_outdoor_use: { label: '옥내/옥외', types: ['STRING_SET'], units: [''] },
    ingress_protection: { label: '보호 등급', types: ['ENUM'], units: [''] },
    ambient_temperature: { label: '주위 온도', types: ['RANGE'], units: ['degC'] },
    altitude: { label: '표고', types: ['QUANTITY'], units: ['m'] },
    applicable_standard: { label: '적용 표준', types: ['STRING_SET'], units: [''] },
    certification: { label: '인증', types: ['STRING_SET'], units: [''] },
    communication_protocol: { label: '통신 프로토콜', types: ['STRING_SET'], units: [''] },
    installation_condition: { label: '설치 조건', types: ['STRING_SET'], units: [''] }
  }),
  transformer: Object.freeze({
    transformer_capacity: { label: '변압기 용량', types: ['QUANTITY'], units: ['VA', 'kVA', 'MVA'] },
    primary_voltage: { label: '1차 전압', types: ['QUANTITY'], units: ['V', 'kV'] },
    secondary_voltage: { label: '2차 전압', types: ['QUANTITY'], units: ['V', 'kV'] },
    frequency: { label: '주파수', types: ['QUANTITY'], units: ['Hz'] },
    vector_group: { label: '결선 그룹', types: ['ENUM'], units: [''] },
    cooling_method: { label: '냉각 방식', types: ['ENUM'], units: [''] },
    efficiency_class: { label: '효율 등급', types: ['ENUM'], units: [''] },
    ambient_temperature: { label: '주위 온도', types: ['RANGE'], units: ['degC'] },
    altitude: { label: '표고', types: ['QUANTITY'], units: ['m'] },
    applicable_standard: { label: '적용 표준', types: ['STRING_SET'], units: [''] },
    certification: { label: '인증', types: ['STRING_SET'], units: [''] },
    communication_protocol: { label: '통신 프로토콜', types: ['STRING_SET'], units: [''] },
    installation_condition: { label: '설치 조건', types: ['STRING_SET'], units: [''] }
  })
});

const REASONS = Object.freeze({
  APPROVE_FOR_REPOSITORY_REVIEW: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED', 'CONDITIONS_CONFIRMED'],
  REJECT: ['NOT_A_CAPABILITY', 'MARKETING_LANGUAGE_ONLY', 'DUPLICATE_CANDIDATE', 'COPYRIGHT_OR_USE_RESTRICTED'],
  DEFER_MISSING_CONTEXT: ['VALUE_MISSING', 'UNIT_AMBIGUOUS', 'PRODUCT_SCOPE_AMBIGUOUS', 'CONDITION_MISSING', 'REVISION_UNCLEAR', 'COPYRIGHT_OR_USE_RESTRICTED'],
  FLAG_CONFLICT: ['CONFLICTING_DOCUMENT'],
  FLAG_SUPERSEDED: ['SUPERSEDED_DOCUMENT'],
  FLAG_SOURCE_AUTHENTICITY: ['SOURCE_AUTHENTICITY_UNCLEAR']
});

const REASON_LABELS = Object.freeze({
  EVIDENCE_QUOTE_CONFIRMED: '직접 인용 확인',
  STRUCTURED_MEANING_CONFIRMED: '정형 의미 확인',
  CONDITIONS_CONFIRMED: '적용 조건 확인',
  NOT_A_CAPABILITY: '제품 기능 주장이 아님',
  MARKETING_LANGUAGE_ONLY: '마케팅 표현만 있음',
  VALUE_MISSING: '값이 누락됨',
  UNIT_AMBIGUOUS: '단위가 모호함',
  PRODUCT_SCOPE_AMBIGUOUS: '제품 범위가 모호함',
  CONDITION_MISSING: '적용 조건이 누락됨',
  REVISION_UNCLEAR: '개정 정보가 불명확함',
  DUPLICATE_CANDIDATE: '중복 후보',
  SUPERSEDED_DOCUMENT: '신규 개정본으로 대체됨',
  CONFLICTING_DOCUMENT: '다른 문서와 충돌함',
  COPYRIGHT_OR_USE_RESTRICTED: '저작권/이용 범위가 제한됨',
  SOURCE_AUTHENTICITY_UNCLEAR: '출처 진위성이 불명확함'
});

const RELATIONSHIP_LABELS = Object.freeze({
  EXACT_DUPLICATE_EVIDENCE: '같은 근거 중복',
  MATERIAL_CONFLICT: '값이 실질적으로 충돌',
  CONDITION_RESOLVED: '적용 조건이 달라 충돌 아님',
  SUPERSEDES: '신규 개정본이 기존 문서를 대체'
});

const state = {
  catalog: null,
  document: null,
  page: null,
  candidate: null,
  reviews: new Map(),
  patch: null
};

const get = (id) => document.getElementById(id);
const capabilityMeta = document.querySelector('meta[name="workbench-capability"]');
const capability = capabilityMeta?.content || '';
capabilityMeta?.remove();

function element(tag, { className = '', text = '', attributes = {} } = {}, children = []) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  value.textContent = text;
  for (const [name, attributeValue] of Object.entries(attributes)) value.setAttribute(name, String(attributeValue));
  value.append(...children);
  return value;
}

function announce(message) {
  get('workbench-status').textContent = '';
  window.requestAnimationFrame(() => { get('workbench-status').textContent = message; });
}

function showErrors(containerId, messages) {
  const container = get(containerId);
  container.replaceChildren();
  if (!messages.length) {
    container.hidden = true;
    return;
  }
  const heading = element('p', { text: '다음 항목을 확인하세요.' });
  const list = element('ul');
  messages.forEach((message) => list.append(element('li', { text: message })));
  container.append(heading, list);
  container.hidden = false;
  container.focus();
}

function addDefinition(list, term, description, { code = false } = {}) {
  const row = element('div');
  const dt = element('dt', { text: term });
  const dd = element('dd');
  dd.append(element(code ? 'code' : 'span', { text: String(description ?? '—') }));
  row.append(dt, dd);
  list.append(row);
}

function documentById(id) {
  return state.catalog?.documents.find((candidate) => candidate.documentId === id) || null;
}

function candidateLocation(id) {
  for (const documentRecord of state.catalog?.documents || []) {
    for (const page of documentRecord.pages) {
      const candidate = page.candidates.find((record) => record.candidateId === id);
      if (candidate) return { documentRecord, page, candidate };
    }
  }
  return null;
}

function formatTypedValue(value) {
  if (!value) return '값 없음';
  if (value.type === 'RANGE') return `${value.minimum}–${value.maximum} ${value.unit}`;
  if (Array.isArray(value.value)) return `${value.value.join(', ')} (${value.type})`;
  return `${value.value}${value.unit ? ` ${value.unit}` : ''} (${value.type})`;
}

function renderDocumentQueue() {
  const list = get('document-list') || element('ol', { className: 'document-list', attributes: { id: 'document-list' } });
  list.replaceChildren();
  for (const documentRecord of state.catalog.documents) {
    const button = element('button', { className: 'document-card', attributes: { type: 'button' } });
    button.dataset.documentId = documentRecord.documentId;
    if (documentRecord.documentId === state.document?.documentId) button.setAttribute('aria-current', 'true');
    button.append(
      element('span', { className: 'document-title', text: documentRecord.title }),
      element('span', { text: `${documentRecord.publisher} · ${documentRecord.documentNumber} · ${documentRecord.revision}` }),
      element('span', { text: `${documentRecord.language.toUpperCase()} · ${documentRecord.productFamilies.join(', ')}` }),
      element('span', { text: documentRecord.synthetic ? 'SYNTHETIC_FIXTURE' : 'REAL_MANIFEST_BOUND' }),
      element('span', { className: 'document-state', text: documentRecord.relationshipMarkers.length ? documentRecord.relationshipMarkers.join(' · ') : 'REVIEW_REQUIRED' })
    );
    button.addEventListener('click', () => selectDocument(documentRecord.documentId));
    list.append(element('li', {}, [button]));
  }
  const current = get('document-list');
  if (!current) get('document-empty')?.replaceWith(list);
}

function sourceMetadata(documentRecord) {
  const list = get('source-metadata');
  list.replaceChildren();
  addDefinition(list, '발행자', documentRecord.publisher);
  addDefinition(list, '제목', documentRecord.title);
  addDefinition(list, '문서 번호', documentRecord.documentNumber);
  addDefinition(list, '문서 유형', documentRecord.documentType, { code: true });
  addDefinition(list, '입력 모드', documentRecord.synthetic ? 'SYNTHETIC_FIXTURE' : 'REAL_MANIFEST_BOUND', { code: true });
  addDefinition(list, '개정', `${documentRecord.revision} / sequence ${documentRecord.revisionSequence}`);
  addDefinition(list, '발행/효력/수집', `${documentRecord.publishedAt} / ${documentRecord.effectiveAt} / ${documentRecord.retrievedAt}`);
  addDefinition(list, '언어/관할/수직', `${documentRecord.language} / ${documentRecord.jurisdiction} / ${documentRecord.vertical}`);
  addDefinition(list, '제품 군', documentRecord.productFamilies.join(', '), { code: true });
  addDefinition(list, '원문 URL (열지 않음)', documentRecord.sourceUrl, { code: true });
  addDefinition(list, '파일 해시', documentRecord.fileSha256.slice(0, 16), { code: true });
  addDefinition(list, '재배포 경계', documentRecord.redistributionStatus, { code: true });
  addDefinition(list, '진위성/검토', `${documentRecord.authenticityStatus} / ${documentRecord.reviewState}`, { code: true });
  addDefinition(list, '충돌/대체', documentRecord.relationshipMarkers.join(', ') || 'NONE', { code: true });
}

function updateSourceRail() {
  get('rail-publisher').textContent = state.document?.publisher || '선택 안 됨';
  get('rail-document').textContent = state.document?.title || '선택 안 됨';
  get('rail-document-number').textContent = state.document?.documentNumber || '—';
  get('rail-revision').textContent = state.document?.revision || '—';
  get('rail-page').textContent = state.page ? String(state.page.pageNumber) : '—';
  get('rail-locator').textContent = state.page?.locator ? `${state.page.locator.type}: ${state.page.locator.value}` : '미입력 — 차단';
  get('rail-context-before').textContent = state.candidate?.contextBefore || '—';
  get('rail-quote').textContent = state.candidate?.exactQuote || '선택 안 됨';
  get('rail-context-after').textContent = state.candidate?.contextAfter || '—';
  get('rail-offsets').textContent = state.candidate
    ? `${state.candidate.startCodePoint}–${state.candidate.endCodePoint}`
    : '—';
  get('rail-occurrence').textContent = state.candidate
    ? `${state.candidate.occurrenceIndex} / ${state.candidate.occurrenceCount}`
    : '—';
}

function renderPageOptions() {
  const select = get('page-select');
  select.replaceChildren();
  for (const page of state.document.pages) {
    const option = element('option', { text: `추출 ${page.pageNumber} · ${page.locator.type} ${page.locator.value}`, attributes: { value: page.pageNumber } });
    select.append(option);
  }
  select.disabled = false;
  select.value = String(state.page.pageNumber);
}

function renderCandidateSuggestions() {
  const list = get('candidate-list');
  list.replaceChildren();
  if (!state.page.candidates.length) {
    list.append(element('p', { className: 'empty-state', text: '이 페이지에서 결정적 후보를 찾지 못했습니다. 정확한 문맥을 확인하고 문서 입력을 보완하세요.' }));
    return;
  }
  for (const candidate of state.page.candidates) {
    const button = element('button', { className: 'candidate-card', attributes: { type: 'button' } });
    button.dataset.candidateId = candidate.candidateId;
    if (candidate.candidateId === state.candidate?.candidateId) button.setAttribute('aria-current', 'true');
    const relation = candidate.relationships.length ? candidate.relationships.map(({ type }) => type).join(' · ') : 'NO_RELATIONSHIP_FLAG';
    button.append(
      element('strong', { text: candidate.statement }),
      element('q', { text: candidate.exactQuote }),
      element('span', { className: 'secondary', text: `${candidate.extractionRuleId} · ${relation}` })
    );
    button.addEventListener('click', () => selectCandidate(candidate.candidateId));
    list.append(button);
  }
}

function selectDocument(id) {
  const selected = documentById(id);
  if (!selected) return;
  state.document = selected;
  state.page = selected.pages[0] || null;
  state.candidate = null;
  resetReviewEditor({ clearCandidate: true });
  renderDocumentQueue();
  sourceMetadata(selected);
  if (state.page) {
    renderPageOptions();
    get('page-text').textContent = state.page.text;
    renderCandidateSuggestions();
  }
  updateSourceRail();
  get('evidence-heading').focus();
  announce(`${selected.title} 문서를 열었습니다. 현재 편집 상태는 초기화되었습니다.`);
}

function selectPage(pageNumber) {
  const page = state.document?.pages.find((candidate) => candidate.pageNumber === Number(pageNumber));
  if (!page) return;
  state.page = page;
  state.candidate = null;
  resetReviewEditor({ clearCandidate: true });
  get('page-text').textContent = page.text;
  renderCandidateSuggestions();
  updateSourceRail();
  get('evidence-heading').focus();
  announce(`추출 페이지 ${page.pageNumber}로 이동했습니다. 저장하지 않은 편집은 초기화되었습니다.`);
}

function renderSelectOptions(select, entries, selected) {
  select.replaceChildren();
  for (const [value, label] of entries) select.append(element('option', { text: label, attributes: { value } }));
  if (entries.some(([value]) => value === selected)) select.value = selected;
}

function configureCapability(family, selectedKey) {
  const capabilities = CAPABILITY_OPTIONS[family] || {};
  renderSelectOptions(get('capability-key'), Object.entries(capabilities).map(([key, meta]) => [key, `${meta.label} — ${key}`]), selectedKey);
  configureValueControls();
}

function configureValueControls(selectedType, selectedUnit) {
  const family = get('product-family').value;
  const capabilityKey = get('capability-key').value;
  const meta = CAPABILITY_OPTIONS[family]?.[capabilityKey];
  if (!meta) return;
  renderSelectOptions(get('value-type'), meta.types.map((type) => [type, type]), selectedType || meta.types[0]);
  renderSelectOptions(get('candidate-unit'), meta.units.map((unit) => [unit, unit || 'UNIT_NOT_APPLICABLE']), selectedUnit ?? meta.units[0]);
  const range = get('value-type').value === 'RANGE';
  get('minimum-field').hidden = !range;
  get('maximum-field').hidden = !range;
  get('value-field').hidden = range;
  get('candidate-value').required = !range;
  get('candidate-minimum').required = range;
  get('candidate-maximum').required = range;
}

function setCandidateFields(candidate) {
  get('claim-type').value = candidate.claimType;
  get('product-family').value = candidate.productFamily;
  configureCapability(candidate.productFamily, candidate.capabilityKey);
  configureValueControls(candidate.value.type, candidate.value.unit || '');
  if (candidate.value.type === 'RANGE') {
    get('candidate-minimum').value = String(candidate.value.minimum);
    get('candidate-maximum').value = String(candidate.value.maximum);
    get('candidate-value').value = '';
  } else {
    get('candidate-value').value = Array.isArray(candidate.value.value) ? candidate.value.value.join(', ') : String(candidate.value.value);
    get('candidate-minimum').value = '';
    get('candidate-maximum').value = '';
  }
  const condition = candidate.applicability.conditions[0] || { id: '', value: '' };
  get('condition-key').value = [...get('condition-key').options].some(({ value }) => value === condition.id) ? condition.id : '';
  get('condition-value').value = [...get('condition-value').options].some(({ value }) => value === condition.value) ? condition.value : '';
  get('jurisdiction').value = candidate.applicability.jurisdiction;
  get('project-stage').value = candidate.applicability.projectStages[0];
  get('valid-until').value = candidate.validity.type === 'VALID_UNTIL' ? candidate.validity.validUntil.slice(0, 10) : '';
}

function setRecordedReviewFields(candidate, review) {
  const fields = review.fields;
  get('claim-type').value = fields.claimType;
  get('product-family').value = fields.productFamily;
  configureCapability(fields.productFamily, fields.capabilityKey);
  configureValueControls(fields.valueType, fields.unit);
  if (fields.valueType === 'RANGE') {
    get('candidate-minimum').value = fields.minimum;
    get('candidate-maximum').value = fields.maximum;
    get('candidate-value').value = '';
  } else {
    get('candidate-value').value = fields.value;
    get('candidate-minimum').value = '';
    get('candidate-maximum').value = '';
  }
  get('condition-key').value = fields.conditionKey;
  get('condition-value').value = fields.conditionValue;
  get('jurisdiction').value = fields.jurisdiction;
  get('project-stage').value = fields.projectStage;
  get('valid-until').value = fields.validUntil;
  const decision = document.querySelector(`input[name="review-decision"][value="${review.decision}"]`);
  if (decision) decision.checked = true;
  selectDecision(review.decision);
  get('review-reason').value = review.reasonCode;
  get('review-acknowledgement').checked = review.acknowledged === true;
}

function renderRelatedClaims() {
  const container = get('related-claims');
  container.replaceChildren();
  if (!state.candidate?.relationships.length) {
    container.append(element('p', { className: 'empty-state', text: '현재 후보와 같은 의미 범위의 충돌/대체 Claim이 없습니다.' }));
    return;
  }
  const list = element('ul', { className: 'related-list' });
  for (const relationship of state.candidate.relationships) {
    for (const relatedId of relationship.relatedCandidateIds) {
      const location = candidateLocation(relatedId);
      const related = location?.candidate;
      const item = element('li');
      const title = element('strong', { text: `${RELATIONSHIP_LABELS[relationship.type] || relationship.type} — ${relationship.type}` });
      const comparison = element('dl', { className: 'related-comparison' });
      addDefinition(comparison, '출처', location ? `${location.documentRecord.title} / ${location.documentRecord.documentNumber}` : '관련 출처 없음');
      addDefinition(comparison, '개정', location?.documentRecord.revision || '—');
      addDefinition(comparison, '페이지/섹션', location?.page.locator ? `${location.page.locator.type}: ${location.page.locator.value}` : '—');
      addDefinition(comparison, '직접 인용', related?.exactQuote || '—');
      addDefinition(comparison, '정형 값', formatTypedValue(related?.value));
      addDefinition(comparison, '적용 범위', related ? `${related.productFamily} / ${related.applicability.jurisdiction} / ${related.applicability.projectStages.join(', ')}` : '—');
      addDefinition(comparison, '조건', related?.applicability.conditions.length ? related.applicability.conditions.map(({ id, value }) => `${id}=${value}`).join(', ') : 'NONE');
      addDefinition(comparison, '후보 코드', relatedId, { code: true });
      item.append(title, element('span', { text: related?.statement || '관련 후보 세부 정보 없음' }), comparison);
      list.append(item);
    }
  }
  container.append(list);
}

function trustAssessment() {
  if (!state.candidate || !state.document || !state.page) return { complete: false, source: false, bound: false, chronology: false, blocking: true };
  const required = ['claimType', 'productFamily', 'capabilityKey'];
  const complete = required.every((key) => Boolean(state.candidate[key]));
  const source = Boolean(state.document.publisher && state.document.title && state.document.documentNumber && state.document.revision && state.page.locator?.value);
  const bound = state.candidate.exactQuote.length > 0 && state.page.text.includes(state.candidate.exactQuote) && state.candidate.exactQuote !== state.page.text;
  const chronology = Boolean(state.document.publishedAt && state.document.effectiveAt && state.document.retrievedAt && state.document.publishedAt <= state.document.effectiveAt && state.document.effectiveAt <= state.document.retrievedAt);
  const proposedDecision = document.querySelector('input[name="review-decision"]:checked')?.value
    || state.reviews.get(state.candidate.candidateId)?.decision
    || '';
  const blocking = state.candidate.relationships.some((relationship) => {
    if (!relationship.blocking) return false;
    const relatedReviews = relationship.relatedCandidateIds.map((candidateId) => state.reviews.get(candidateId));
    if (relationship.type === 'EXACT_DUPLICATE_EVIDENCE' || relationship.type === 'MATERIAL_CONFLICT') {
      return proposedDecision === 'APPROVE_FOR_REPOSITORY_REVIEW'
        ? relatedReviews.some((review) => review?.decision !== 'REJECT')
        : true;
    }
    if (relationship.type === 'SUPERSEDES') {
      if (relationship.successorCandidateId === state.candidate.candidateId && proposedDecision === 'APPROVE_FOR_REPOSITORY_REVIEW') {
        return relationship.relatedCandidateIds.some((candidateId) => state.reviews.get(candidateId)?.decision !== 'FLAG_SUPERSEDED');
      }
      return true;
    }
    return false;
  });
  return { complete, source, bound, chronology, blocking };
}

function updateTrustPreview() {
  const trust = trustAssessment();
  get('trust-candidate').textContent = trust.complete ? 'COMPLETE_FOR_HUMAN_REVIEW' : 'BLOCKED_MISSING_FIELDS';
  get('trust-source').textContent = trust.source ? 'METADATA_COMPLETE_UNREVIEWED' : 'BLOCKED_MISSING_REVISION_OR_LOCATOR';
  get('trust-binding').textContent = trust.bound ? 'EXACT_BOUNDED_QUOTE_BOUND' : 'BLOCKED_INVALID_OR_FULL_PAGE_QUOTE';
  get('trust-chronology').textContent = trust.chronology ? 'CHRONOLOGY_STRUCTURALLY_VALID' : 'BLOCKED_CHRONOLOGY';
  get('trust-conflict').textContent = trust.blocking ? 'UNRESOLVED_RELATIONSHIP' : 'NO_BLOCKING_RELATIONSHIP';
  const currentReview = state.candidate ? state.reviews.get(state.candidate.candidateId) : null;
  const patchContainsCurrentApproval = Boolean(state.patch && state.patch.approvedCandidates?.some(({ candidate }) => (
    candidate?.documentId === state.candidate?.documentId
      && candidate?.evidenceAnchorId === state.candidate?.evidenceAnchorId
      && candidate?.subject?.id === currentReview?.fields.productFamily
      && candidate?.value?.key === currentReview?.fields.capabilityKey
  )));
  const approved = currentReview?.decision === 'APPROVE_FOR_REPOSITORY_REVIEW' && patchContainsCurrentApproval;
  get('trust-readiness').textContent = trust.complete && trust.source && trust.bound && trust.chronology && !trust.blocking && approved ? 'READY_FOR_CODE_REVIEW' : 'BLOCKED_OR_REVIEW_DECISION_REQUIRED';
  get('trust-registry').textContent = 'UNVERIFIED';
  get('trust-customer').textContent = 'BLOCKED';
  const decision = document.querySelector('input[name="review-decision"]:checked')?.value;
  get('record-review').disabled = !state.candidate || !trust.complete || !trust.source || !trust.bound || !trust.chronology
    || (decision === 'APPROVE_FOR_REPOSITORY_REVIEW' && trust.blocking)
    || (decision === 'FLAG_CONFLICT' && !state.candidate.relationships.some(({ type }) => type === 'MATERIAL_CONFLICT'))
    || (decision === 'FLAG_SUPERSEDED' && !state.candidate.relationships.some(({ type }) => type === 'SUPERSEDES'));
}

function selectCandidate(id) {
  const candidate = state.page?.candidates.find((record) => record.candidateId === id);
  if (!candidate) return;
  state.candidate = candidate;
  document.querySelectorAll('input[name="review-decision"]').forEach((input) => { input.checked = false; });
  get('review-reason').replaceChildren(element('option', { text: '결정을 먼저 선택하세요', attributes: { value: '' } }));
  get('review-acknowledgement').checked = false;
  const recordedReview = state.reviews.get(candidate.candidateId);
  if (recordedReview) setRecordedReviewFields(candidate, recordedReview);
  else setCandidateFields(candidate);
  showErrors('review-errors', []);
  renderCandidateSuggestions();
  renderRelatedClaims();
  updateSourceRail();
  updateTrustPreview();
  get('review-heading').focus();
  announce('후보를 열었습니다. 정형 필드와 근거 결합을 확인하세요.');
}

function resetReviewEditor({ clearCandidate = false } = {}) {
  if (clearCandidate) state.candidate = null;
  const recordedReview = state.candidate ? state.reviews.get(state.candidate.candidateId) : null;
  if (state.candidate && recordedReview) {
    setRecordedReviewFields(state.candidate, recordedReview);
  } else if (state.candidate) {
    setCandidateFields(state.candidate);
    document.querySelectorAll('input[name="review-decision"]').forEach((input) => { input.checked = false; });
    get('review-reason').replaceChildren(element('option', { text: '결정을 먼저 선택하세요', attributes: { value: '' } }));
    get('review-acknowledgement').checked = false;
  } else {
    get('candidate-form').reset();
    configureCapability('medium_voltage_switchgear', 'rated_voltage');
    document.querySelectorAll('input[name="review-decision"]').forEach((input) => { input.checked = false; });
    get('review-reason').replaceChildren(element('option', { text: '결정을 먼저 선택하세요', attributes: { value: '' } }));
    get('review-acknowledgement').checked = false;
  }
  showErrors('review-errors', []);
  renderRelatedClaims();
  updateSourceRail();
  updateTrustPreview();
}

function selectDecision(decision) {
  const options = [['', '사유 코드를 선택하세요'], ...(REASONS[decision] || []).map((reason) => [reason, `${REASON_LABELS[reason] || reason} — ${reason}`])];
  renderSelectOptions(get('review-reason'), options, '');
  updateTrustPreview();
}

function invalidateCurrentRecordedReview() {
  if (!state.candidate || !state.reviews.has(state.candidate.candidateId)) return;
  state.reviews.delete(state.candidate.candidateId);
  clearPatch();
  updateTrustPreview();
  announce('정형 필드 또는 결정을 변경해 기존 현재 후보 결정과 패치를 무효화했습니다.');
}

function fieldsFromForm() {
  return {
    claimType: get('claim-type').value,
    productFamily: get('product-family').value,
    capabilityKey: get('capability-key').value,
    valueType: get('value-type').value,
    value: get('candidate-value').value,
    minimum: get('candidate-minimum').value,
    maximum: get('candidate-maximum').value,
    unit: get('candidate-unit').value,
    conditionKey: get('condition-key').value,
    conditionValue: get('condition-value').value,
    jurisdiction: get('jurisdiction').value,
    projectStage: get('project-stage').value,
    validUntil: get('valid-until').value
  };
}

async function requestPatch() {
  const body = {
    schemaVersion: 'official-evidence-workbench-review-request-v0',
    reviews: [...state.reviews.values()].sort((left, right) => left.candidateId < right.candidateId ? -1 : left.candidateId > right.candidateId ? 1 : 0)
  };
  const response = await fetch('/api/patch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workbench-Capability': capability
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.code || result.error || 'PATCH_REFUSED');
  return result;
}

function pageMemoryPatchBlocker() {
  const reviews = [...state.reviews.values()];
  for (const review of reviews) {
    const location = candidateLocation(review.candidateId);
    if (!location) return 'CANDIDATE_NOT_ALLOWLISTED';
    for (const relationship of location.candidate.relationships) {
      if (!relationship.blocking) continue;
      if (relationship.relatedCandidateIds.some((candidateId) => !state.reviews.has(candidateId))) return 'RELATIONSHIP_REVIEW_REQUIRED';
    }
  }
  if (!reviews.some(({ decision }) => decision === 'APPROVE_FOR_REPOSITORY_REVIEW')) return 'NO_APPROVED_CANDIDATES';
  return '';
}

function renderPatch(patch) {
  state.patch = patch;
  const serialized = `${JSON.stringify(patch, null, 2)}\n`;
  get('patch-preview').value = serialized;
  get('patch-id').textContent = patch.patchId;
  get('patch-candidate-count').textContent = String(patch.metrics?.approvedCandidateCount ?? patch.approvedCandidates?.length ?? 0);
  get('patch-document-count').textContent = String(patch.metrics?.sourceDocumentCount ?? patch.sourceDocuments?.length ?? 0);
  get('patch-conflict-count').textContent = String([...state.reviews.values()].filter(({ decision }) => decision === 'FLAG_CONFLICT').length);
  get('copy-patch').disabled = false;
  get('download-patch').disabled = false;
}

function clearPatch() {
  state.patch = null;
  get('patch-preview').value = '';
  get('patch-id').textContent = '아직 없음';
  get('patch-candidate-count').textContent = '0';
  get('patch-document-count').textContent = '0';
  get('patch-conflict-count').textContent = String([...state.reviews.values()].filter(({ decision }) => decision === 'FLAG_CONFLICT').length);
  get('copy-patch').disabled = true;
  get('download-patch').disabled = true;
}

async function recordReview(event) {
  event.preventDefault();
  showErrors('review-errors', []);
  const decision = document.querySelector('input[name="review-decision"]:checked')?.value || '';
  const reasonCode = get('review-reason').value;
  const trust = trustAssessment();
  const errors = [];
  if (!state.candidate) errors.push('검토할 후보를 선택하세요.');
  if (!decision) errors.push('사람의 결정을 선택하세요.');
  if (!reasonCode) errors.push('정형 사유 코드를 선택하세요.');
  if (!get('review-acknowledgement').checked) errors.push('비검증/고객 사용 차단 경계를 확인하세요.');
  if (!trust.bound) errors.push('직접 인용이 정확하고 전체 페이지보다 작은지 확인하세요.');
  if (!trust.source || !trust.chronology) errors.push('문서 번호, 개정, 인쇄 페이지/섹션, 시점을 보완하세요.');
  if (decision === 'APPROVE_FOR_REPOSITORY_REVIEW' && trust.blocking) errors.push('미해결 충돌/대체 관계가 있어 승인할 수 없습니다.');
  if (decision === 'FLAG_CONFLICT' && !state.candidate.relationships.some(({ type }) => type === 'MATERIAL_CONFLICT')) errors.push('연결된 MATERIAL_CONFLICT가 없습니다.');
  if (decision === 'FLAG_SUPERSEDED' && !state.candidate.relationships.some(({ type }) => type === 'SUPERSEDES')) errors.push('연결된 SUPERSEDES가 없습니다.');
  if (!get('candidate-form').checkValidity()) errors.push('필수 정형 필드를 보완하세요.');
  if (errors.length) {
    showErrors('review-errors', errors);
    return;
  }
  state.reviews.set(state.candidate.candidateId, {
    candidateId: state.candidate.candidateId,
    decision,
    reasonCode,
    fields: fieldsFromForm(),
    acknowledged: true
  });
  clearPatch();
  try {
    const blocker = pageMemoryPatchBlocker();
    if (blocker) throw new Error(blocker);
    const patch = await requestPatch();
    renderPatch(patch);
    announce(`결정을 현재 페이지 메모리에 기록했습니다. ${patch.patchId}. 이 패치는 신뢰 검증이 아니라 코드 리뷰 요청입니다.`);
  } catch (error) {
    showErrors('review-errors', [`결정은 현재 페이지 메모리에 유지되었지만 코드 리뷰 패치는 차단되었습니다: ${error.message}`]);
    announce('미해결 검토 조건으로 패치 생성이 차단되었습니다.');
  }
  updateTrustPreview();
}

async function copyPatch() {
  if (!state.patch) return;
  const preview = get('patch-preview');
  get('copy-fallback').hidden = true;
  await copyPatchText({
    text: preview.value,
    writeText: navigator.clipboard?.writeText?.bind(navigator.clipboard),
    onCopied() {
      announce('검토 패치 JSON을 복사했습니다. 자동 검증이나 송신은 수행하지 않았습니다.');
    },
    onFallback() {
      get('copy-fallback').hidden = false;
      preview.focus();
      preview.select();
      announce('자동 복사가 차단되어 미리보기 텍스트를 선택했습니다.');
    }
  });
}

function downloadPatch() {
  if (!state.patch) return;
  downloadPatchText({
    text: get('patch-preview').value,
    filename: `official-evidence-review-${state.patch.patchId.slice(0, 32)}.json`,
    BlobConstructor: Blob,
    createObjectUrl: URL.createObjectURL.bind(URL),
    revokeObjectUrl: URL.revokeObjectURL.bind(URL),
    createLink: () => document.createElement('a'),
    onStarted() {
      announce('검토 패치 JSON 다운로드를 시작했습니다. 원문 페이지와 이력 정보는 포함하지 않습니다.');
    },
    onBlocked() {
      announce('다운로드가 차단되었습니다. 패치 미리보기는 현재 페이지에만 남아 있습니다.');
    }
  });
}

async function loadCatalog() {
  try {
    const response = await fetch('/api/catalog', { headers: { 'X-Workbench-Capability': capability } });
    if (!response.ok) throw new Error('CATALOG_REFUSED');
    const catalog = await response.json();
    if (catalog.boundary !== 'NOT_PRODUCTION_EVIDENCE'
      || catalog.productionReady !== false
      || catalog.customerUseAllowed !== false
      || typeof catalog.synthetic !== 'boolean'
      || !Array.isArray(catalog.documents)
      || catalog.documents.some((documentRecord) => documentRecord.synthetic !== catalog.synthetic)
      || (catalog.synthetic === false && (
        catalog.intake?.mode !== 'REAL_MANIFEST_BOUND'
        || catalog.intake?.population !== 'LOADED_UNVERIFIED'
        || catalog.intake?.documentCount !== catalog.documents.length
        || catalog.intake?.verifiedClaimCount !== 0
        || catalog.intake?.customerUseAllowedCount !== 0
      ))) {
      throw new Error('CATALOG_BOUNDARY_INVALID');
    }
    state.catalog = catalog;
    renderDocumentQueue();
    if (catalog.documents[0]) selectDocument(catalog.documents[0].documentId);
    const mode = catalog.synthetic ? '합성 검토' : 'manifest-bound 실문서 검토';
    announce(`${catalog.documents.length}개의 ${mode} 문서를 불러왔습니다.`);
  } catch {
    showErrors('evidence-errors', ['문서 목록을 안전하게 불러오지 못했습니다. 이전 검토 상태는 사용하지 않습니다.']);
  }
}

get('page-select').addEventListener('change', (event) => selectPage(event.target.value));
get('product-family').addEventListener('change', (event) => {
  invalidateCurrentRecordedReview();
  configureCapability(event.target.value);
});
get('capability-key').addEventListener('change', () => {
  invalidateCurrentRecordedReview();
  configureValueControls();
});
get('value-type').addEventListener('change', () => {
  invalidateCurrentRecordedReview();
  configureValueControls(get('value-type').value, get('candidate-unit').value);
});
for (const id of ['claim-type', 'candidate-value', 'candidate-minimum', 'candidate-maximum', 'candidate-unit', 'condition-key', 'condition-value', 'jurisdiction', 'project-stage', 'valid-until', 'review-reason', 'review-acknowledgement']) {
  const control = get(id);
  control.addEventListener(control.matches('input[type="text"], input[type="number"]') ? 'input' : 'change', invalidateCurrentRecordedReview);
}
get('candidate-form').addEventListener('submit', recordReview);
get('reset-review').addEventListener('click', () => {
  resetReviewEditor();
  announce('현재 후보의 저장하지 않은 편집을 초기화했습니다.');
});
document.querySelectorAll('input[name="review-decision"]').forEach((input) => input.addEventListener('change', () => {
  invalidateCurrentRecordedReview();
  selectDecision(input.value);
}));
get('copy-patch').addEventListener('click', copyPatch);
get('download-patch').addEventListener('click', downloadPatch);
get('clear-decisions').addEventListener('click', () => {
  state.reviews.clear();
  clearPatch();
  resetReviewEditor();
  announce('현재 페이지 메모리의 모든 결정과 패치를 지웠습니다. 서버에는 저장된 내용이 없습니다.');
});

loadCatalog();
