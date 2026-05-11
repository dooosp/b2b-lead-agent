import { toLeadBriefV1 } from '../lib/leadbrief-v1.js';

const REVIEW_STATUS_LABELS = Object.freeze({
  NEW: '새 검토',
  NEEDS_REVIEW: '검토 필요',
  APPROVED: '승인',
  REJECTED: '반려',
  DEFERRED: '보류',
});

const VERIFICATION_STATUS_LABELS = Object.freeze({
  verified: '검증됨',
  needs_review: '검증 필요',
  draft: '초안',
  unverified: '미검증',
});

const GENERATION_MODE_LABELS = Object.freeze({
  llm: 'LLM 생성',
  heuristic: '휴리스틱 생성',
  demo: '데모',
  unavailable: '생성 불가',
});

const CONFIDENCE_LABELS = Object.freeze({
  HIGH: '신뢰도 HIGH',
  MEDIUM: '신뢰도 MEDIUM',
  LOW: '신뢰도 LOW',
});

function cleanText(value, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeStringArray(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function normalizeReviewStatus(value) {
  const status = cleanText(value).toUpperCase();
  return REVIEW_STATUS_LABELS[status] ? status : 'NEEDS_REVIEW';
}

function normalizeVerificationStatus(value) {
  const status = cleanText(value).toLowerCase();
  return VERIFICATION_STATUS_LABELS[status] ? status : 'needs_review';
}

function normalizeGenerationMode(value) {
  const mode = cleanText(value).toLowerCase();
  return GENERATION_MODE_LABELS[mode] ? mode : 'llm';
}

function normalizeConfidence(value) {
  const confidence = cleanText(value).toUpperCase();
  return CONFIDENCE_LABELS[confidence] ? confidence : 'LOW';
}

function normalizeEvidenceItems(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const quote = cleanText(item.quote);
      if (!quote) return null;
      return {
        field: cleanText(item.field, 'evidence'),
        quote,
        sourceUrl: cleanText(item.sourceUrl || item.source_url),
      };
    })
    .filter(Boolean);
}

function normalizeSources(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const title = cleanText(item.title);
      const url = cleanText(item.url);
      if (!title && !url) return null;
      return { title: title || url, url };
    })
    .filter(Boolean);
}

function safeUrl(value) {
  try {
    const parsed = new URL(cleanText(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function buildStatus(value, labels, fallback) {
  const normalized = labels[value] ? value : fallback;
  return {
    value: normalized,
    label: labels[normalized],
  };
}

function addUnique(items, value) {
  const text = cleanText(value);
  if (text && !items.includes(text)) items.push(text);
}

function addDataGapChecklist(checklist, dataGaps) {
  for (const gap of dataGaps.items.slice(0, 2)) {
    addUnique(checklist, `데이터 공백 확인: ${gap}`);
  }
}

function buildActionDetails({ reviewStatus, verificationStatus, generationMode, confidence, evidence, sources, dataGaps }) {
  const reasons = [];
  const checklist = [];

  if (reviewStatus.value === 'APPROVED') addUnique(reasons, '사람 검토 승인');
  if (reviewStatus.value === 'REJECTED') addUnique(reasons, '사람 검토 반려');
  if (reviewStatus.value === 'DEFERRED') addUnique(reasons, '보류 상태');
  addUnique(reasons, verificationStatus.value === 'verified' ? '검증됨' : '검증 필요');
  addUnique(reasons, `신뢰도 ${confidence.value}`);
  if (generationMode.value !== 'llm') addUnique(reasons, generationMode.label);
  if (evidence.count === 0 || sources.count === 0) addUnique(reasons, '직접 근거 부족');
  if (dataGaps.count > 0) addUnique(reasons, `데이터 공백 ${dataGaps.count}건`);

  if (reviewStatus.value === 'REJECTED') {
    addUnique(checklist, '반려 사유를 메모로 남기세요.');
    addUnique(checklist, '새 공개 근거가 생기기 전까지 접촉을 만들지 마세요.');
    return { reasons, checklist };
  }

  if (confidence.value === 'LOW' || generationMode.value === 'heuristic' || generationMode.value === 'unavailable') {
    addUnique(checklist, '직접 인용과 출처를 보강하세요.');
    addDataGapChecklist(checklist, dataGaps);
    addUnique(checklist, '신뢰도 근거를 다시 확인하세요.');
    return { reasons, checklist };
  }

  if (evidence.count === 0 || sources.count === 0 || dataGaps.count > 0) {
    addUnique(checklist, '직접 인용과 출처를 보강하세요.');
    addDataGapChecklist(checklist, dataGaps);
    addUnique(checklist, '보강 후 승인, 반려, 보류 중 하나로 검토 상태를 결정하세요.');
    return { reasons, checklist };
  }

  if (reviewStatus.value === 'DEFERRED') {
    addUnique(checklist, '보류 사유와 재검토 조건을 메모로 남기세요.');
    addUnique(checklist, '재검토 날짜나 필요한 추가 근거를 정하세요.');
    return { reasons, checklist };
  }

  if (reviewStatus.value === 'APPROVED') {
    addUnique(checklist, '추천 메시지를 사람 검토 후 개인화하세요.');
    addUnique(checklist, '후속 조치일과 담당 메모를 남기세요.');
    return { reasons, checklist };
  }

  if (verificationStatus.value !== 'verified') {
    addUnique(checklist, '검증 상태를 확인하고 reviewStatus를 결정하세요.');
    addUnique(checklist, '승인 전 직접 근거와 출처를 다시 대조하세요.');
    return { reasons, checklist };
  }

  addUnique(checklist, '핵심 근거를 확인하고 검토 상태를 결정하세요.');
  addUnique(checklist, '필요하면 추천 메시지를 사람 검토 후 다듬으세요.');
  return { reasons, checklist };
}

function buildNextAction({ reviewStatus, verificationStatus, generationMode, confidence, evidence, sources, dataGaps }) {
  const details = buildActionDetails({
    reviewStatus,
    verificationStatus,
    generationMode,
    confidence,
    evidence,
    sources,
    dataGaps,
  });

  if (reviewStatus.value === 'REJECTED') {
    return {
      tone: 'blocked',
      label: '우선순위 제외',
      summary: '반려된 리드입니다. 새 공개 근거가 들어오기 전에는 영업 액션을 만들지 않습니다.',
      ...details,
    };
  }

  if (confidence.value === 'LOW' || generationMode.value === 'heuristic' || generationMode.value === 'unavailable') {
    return {
      tone: 'warning',
      label: '데이터 보강 후 재검토',
      summary: '신뢰도나 생성 방식이 보수적입니다. 직접 인용, 출처, 의사결정 맥락을 먼저 보강하세요.',
      ...details,
    };
  }

  if (evidence.count === 0 || sources.count === 0 || dataGaps.count > 0) {
    return {
      tone: 'review',
      label: '근거 보강 후 재검토',
      summary: '검토 결정을 내리기 전에 누락된 근거와 데이터 공백을 정리하세요.',
      ...details,
    };
  }

  if (reviewStatus.value === 'DEFERRED') {
    return {
      tone: 'hold',
      label: '보류 사유 확인',
      summary: '보류 상태입니다. 재검토 조건이나 후속 확인 항목을 먼저 정리하세요.',
      ...details,
    };
  }

  if (reviewStatus.value === 'APPROVED') {
    return {
      tone: 'ready',
      label: '영업 액션 준비',
      summary: '근거와 신뢰도가 충분합니다. 추천 메시지를 바탕으로 첫 접촉 준비가 가능합니다.',
      ...details,
    };
  }

  if (verificationStatus.value !== 'verified') {
    return {
      tone: 'review',
      label: '검증 상태 확인',
      summary: '리드 자체는 검토 가능하지만 검증 상태가 확정되지 않았습니다.',
      ...details,
    };
  }

  return {
    tone: 'ready',
    label: '검토 상태 결정',
    summary: '핵심 근거를 확인하고 승인, 반려, 보류 중 하나로 검토 상태를 결정하세요.',
    ...details,
  };
}

function buildSolutionTranslation({ brief, reviewStatus, verificationStatus, confidence, evidence, dataGaps }) {
  const solution = cleanText(
    brief.product || brief.solution || brief.recommendedProduct || brief.productName,
    '추천 솔루션 확인 필요'
  );
  const signal = cleanText(brief.signal || brief.summary, 'current lead signal');
  const whyThisSolution = solution === '추천 솔루션 확인 필요'
    ? `No candidate solution is explicit yet; review ${signal} before shaping outreach.`
    : `${solution} is the candidate solution to review against ${signal}.`;
  const whyNow = cleanText(brief.whyNow, 'Timing rationale needs review before outreach.');
  const isReadyForHumanOutreach = reviewStatus.value === 'APPROVED'
    && verificationStatus.value === 'verified'
    && confidence.value === 'HIGH'
    && evidence.count > 0
    && dataGaps.count === 0;
  const reviewCaveat = isReadyForHumanOutreach
    ? 'Approved and verified context is ready for human-personalized outreach, not automatic sending.'
    : 'Use only as an internal review note until evidence, data gaps, and human review state are resolved.';

  return {
    solution,
    whyThisSolution,
    whyNow,
    reviewCaveat,
  };
}

function pickBriefText(brief, keys, fallback = '') {
  for (const key of keys) {
    const text = cleanText(brief[key]);
    if (text) return text;
  }
  return fallback;
}

function pickBriefArray(brief, keys) {
  for (const key of keys) {
    const items = normalizeStringArray(brief[key]);
    if (items.length > 0) return items;
  }
  return [];
}

function addPrefixedSignals(signals, prefix, items, limit = 2) {
  for (const item of items.slice(0, limit)) {
    addUnique(signals, `${prefix}: ${item}`);
  }
}

function buildProductContext({ brief, confidence, evidence, dataGaps }) {
  const productFallback = '제품 맥락 확인 필요';
  const eventFallback = '신호 유형 미확인';
  const buyerFallback = '구매자 맥락 확인 필요';
  const product = pickBriefText(brief, ['product', 'recommendedProduct', 'recommended_product', 'productName'], productFallback);
  const eventType = pickBriefText(brief, ['eventType', 'event_type'], eventFallback);
  const buyerContext = pickBriefText(brief, ['buyerRole', 'buyer_role'], buyerFallback);
  const buyingSignals = pickBriefArray(brief, ['buyingSignals', 'buying_signals']);
  const painPoints = pickBriefArray(brief, ['painPoints', 'pain_points']);
  const keyFigures = pickBriefArray(brief, ['keyFigures', 'key_figures']);
  const fusionSignals = [];

  addPrefixedSignals(fusionSignals, 'Buying signal', buyingSignals);
  addPrefixedSignals(fusionSignals, 'Pain point', painPoints);
  addPrefixedSignals(fusionSignals, 'Key figure', keyFigures);
  if (fusionSignals.length === 0) {
    addUnique(fusionSignals, `Primary signal: ${cleanText(brief.signal || brief.summary, '리드 신호 확인 필요')}`);
  }

  const hasStrongContext = product !== productFallback
    && eventType !== eventFallback
    && buyerContext !== buyerFallback
    && confidence.value === 'HIGH'
    && evidence.count > 0
    && dataGaps.count === 0;
  const reviewGuidance = hasStrongContext
    ? 'Use these fused signals to personalize the reviewed message; they are context for a human reviewer, not automatic approval.'
    : 'Treat this context as tentative until product fit, buyer role, and evidence are confirmed.';

  return {
    product,
    eventType,
    buyerContext,
    fusionSignals,
    reviewGuidance,
  };
}

export function buildOpportunityWorkbenchModel(lead = {}) {
  const brief = toLeadBriefV1(lead);
  const reviewStatus = buildStatus(normalizeReviewStatus(brief.reviewStatus), REVIEW_STATUS_LABELS, 'NEEDS_REVIEW');
  const verificationStatus = buildStatus(normalizeVerificationStatus(brief.verificationStatus), VERIFICATION_STATUS_LABELS, 'needs_review');
  const generationMode = buildStatus(normalizeGenerationMode(brief.generationMode), GENERATION_MODE_LABELS, 'llm');
  const confidence = buildStatus(normalizeConfidence(brief.confidence), CONFIDENCE_LABELS, 'LOW');
  const evidenceItems = normalizeEvidenceItems(brief.evidence);
  const sourceItems = normalizeSources(brief.sources);
  const dataGapItems = normalizeStringArray(brief.dataGaps);
  const assumptions = normalizeStringArray(brief.assumptions);
  const evidence = { count: evidenceItems.length, items: evidenceItems };
  const sources = { count: sourceItems.length, items: sourceItems };
  const dataGaps = { count: dataGapItems.length, items: dataGapItems };
  const nextAction = buildNextAction({
    reviewStatus,
    verificationStatus,
    generationMode,
    confidence,
    evidence,
    sources,
    dataGaps,
  });
  const solutionTranslation = buildSolutionTranslation({
    brief,
    reviewStatus,
    verificationStatus,
    confidence,
    evidence,
    dataGaps,
  });
  const productContext = buildProductContext({
    brief,
    confidence,
    evidence,
    dataGaps,
  });

  return {
    id: cleanText(brief.id),
    company: cleanText(brief.company, '리드'),
    signal: cleanText(brief.signal || brief.summary, '리드 신호 없음'),
    whyNow: cleanText(brief.whyNow, '왜 지금인지 확인이 필요합니다.'),
    recommendedMessage: cleanText(brief.recommendedMessage, '추천 메시지 확인이 필요합니다.'),
    confidenceReason: cleanText(brief.confidenceReason || brief.confidence_reason, '신뢰도 근거 확인이 필요합니다.'),
    score: Number.isFinite(Number(brief.score)) ? Number(brief.score) : null,
    grade: cleanText(brief.grade),
    reviewStatus,
    verificationStatus,
    generationMode,
    confidence,
    evidence,
    sources,
    dataGaps,
    assumptions,
    nextAction,
    solutionTranslation,
    productContext,
  };
}

function renderPill(kind, status) {
  return `<span class="opportunity-workbench-pill ${kind}-${escapeHtml(status.value).toLowerCase()}">${escapeHtml(status.label)}</span>`;
}

function renderEvidenceItem(item) {
  const href = safeUrl(item.sourceUrl);
  const sourceLink = href
    ? ` <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">출처</a>`
    : '';
  return `<li><strong>[${escapeHtml(item.field)}]</strong> "${escapeHtml(item.quote)}"${sourceLink}</li>`;
}

function renderTextItems(items, emptyLabel) {
  if (items.length === 0) return `<li class="opportunity-workbench-empty">${escapeHtml(emptyLabel)}</li>`;
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

export function renderOpportunityWorkbench(model) {
  const workbench = model && model.nextAction && model.solutionTranslation && model.productContext ? model : buildOpportunityWorkbenchModel(model);
  const scoreLabel = workbench.score === null ? '점수 미확인' : `${workbench.score}점`;
  const gradeLabel = workbench.grade ? `${workbench.grade}등급` : '등급 미확인';
  const dataGapTitle = workbench.dataGaps.count > 0 ? `데이터 공백 ${workbench.dataGaps.count}건` : '데이터 공백 없음';
  const evidenceTitle = workbench.evidence.count > 0 ? `직접 인용 ${workbench.evidence.count}개` : '직접 인용 없음';

  return `
      <section id="opportunity-workbench" class="detail-section opportunity-workbench" aria-label="Opportunity Workbench">
        <div class="opportunity-workbench-header">
          <div>
            <div class="opportunity-workbench-kicker">Opportunity Workbench</div>
            <h3>리드 품질 검토</h3>
            <p>${escapeHtml(workbench.signal)}</p>
          </div>
          <div class="opportunity-workbench-action tone-${escapeHtml(workbench.nextAction.tone)}">
            <span>다음 검토 액션</span>
            <strong>${escapeHtml(workbench.nextAction.label)}</strong>
          </div>
        </div>
        <div class="opportunity-workbench-summary">
          <strong>${escapeHtml(workbench.nextAction.summary)}</strong>
          <span>${escapeHtml(workbench.whyNow)}</span>
        </div>
        <div class="opportunity-workbench-grid">
          <div class="opportunity-workbench-panel opportunity-workbench-wide opportunity-workbench-solution">
            <span class="panel-label">솔루션 번역</span>
            <div class="opportunity-workbench-solution-grid">
              <div>
                <strong>추천 솔루션</strong>
                <p>${escapeHtml(workbench.solutionTranslation.solution)}</p>
              </div>
              <div>
                <strong>왜 이 솔루션</strong>
                <p>${escapeHtml(workbench.solutionTranslation.whyThisSolution)}</p>
              </div>
              <div>
                <strong>왜 지금</strong>
                <p>${escapeHtml(workbench.solutionTranslation.whyNow)}</p>
              </div>
            </div>
            <p class="opportunity-workbench-caveat">${escapeHtml(workbench.solutionTranslation.reviewCaveat)}</p>
          </div>
          <div class="opportunity-workbench-panel opportunity-workbench-wide opportunity-workbench-context">
            <span class="panel-label">제품/신호 맥락</span>
            <div class="opportunity-workbench-context-grid">
              <div>
                <strong>제품 맥락</strong>
                <p>${escapeHtml(workbench.productContext.product)}</p>
              </div>
              <div>
                <strong>신호 유형</strong>
                <p>${escapeHtml(workbench.productContext.eventType)}</p>
              </div>
              <div>
                <strong>구매자 맥락</strong>
                <p>${escapeHtml(workbench.productContext.buyerContext)}</p>
              </div>
            </div>
            <ul class="opportunity-workbench-list opportunity-workbench-context-list">
              ${renderTextItems(workbench.productContext.fusionSignals, '결합된 신호 없음')}
            </ul>
            <p class="opportunity-workbench-caveat">${escapeHtml(workbench.productContext.reviewGuidance)}</p>
          </div>
          <div class="opportunity-workbench-panel">
            <span class="panel-label">검토 상태</span>
            <div class="opportunity-workbench-pill-row">
              ${renderPill('review', workbench.reviewStatus)}
              ${renderPill('verification', workbench.verificationStatus)}
              ${renderPill('generation', workbench.generationMode)}
            </div>
            <p>${escapeHtml(gradeLabel)} / ${escapeHtml(scoreLabel)}</p>
          </div>
          <div class="opportunity-workbench-panel">
            <span class="panel-label">신뢰도</span>
            <div class="opportunity-workbench-pill-row">
              ${renderPill('confidence', workbench.confidence)}
            </div>
            <p>${escapeHtml(workbench.confidenceReason)}</p>
          </div>
          <div class="opportunity-workbench-panel">
            <span class="panel-label">${escapeHtml(evidenceTitle)} / 출처 ${workbench.sources.count}개</span>
            <ul class="opportunity-workbench-evidence-list">
              ${workbench.evidence.items.length > 0
                ? workbench.evidence.items.map(renderEvidenceItem).join('')
                : '<li class="opportunity-workbench-empty">직접 인용 없음</li>'}
            </ul>
          </div>
          <div class="opportunity-workbench-panel">
            <span class="panel-label">${escapeHtml(dataGapTitle)}</span>
            <ul class="opportunity-workbench-list">
              ${renderTextItems(workbench.dataGaps.items, '확인된 데이터 공백 없음')}
            </ul>
          </div>
          <div class="opportunity-workbench-panel opportunity-workbench-wide">
            <span class="panel-label">검토 체크리스트</span>
            <ul class="opportunity-workbench-list">
              ${renderTextItems(workbench.nextAction.checklist, '검토 체크리스트 없음')}
            </ul>
          </div>
          <div class="opportunity-workbench-panel opportunity-workbench-wide">
            <span class="panel-label">추천 메시지</span>
            <p>${escapeHtml(workbench.recommendedMessage)}</p>
          </div>
          <div class="opportunity-workbench-panel opportunity-workbench-wide">
            <span class="panel-label">가정</span>
            <ul class="opportunity-workbench-list">
              ${renderTextItems(workbench.assumptions, '명시된 가정 없음')}
            </ul>
          </div>
        </div>
      </section>`;
}

export function getOpportunityWorkbenchStyles() {
  return `
    .detail-section.opportunity-workbench { border:1px solid #31506c; border-radius:8px; background:linear-gradient(180deg,#162435 0%,#101925 100%); }
    .opportunity-workbench-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; }
    .opportunity-workbench-kicker { color:#8fbfe8; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px; }
    .detail-section.opportunity-workbench h3 { color:#f4f7fb; margin:0 0 6px; }
    .opportunity-workbench p { color:#cbd8e6; font-size:13px; line-height:1.6; margin:0; }
    .opportunity-workbench-action { min-width:170px; border-radius:8px; border:1px solid #344b63; padding:10px 12px; text-align:left; background:#101925; }
    .opportunity-workbench-action span, .panel-label { color:#8fa4b8; display:block; font-size:11px; font-weight:700; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em; }
    .opportunity-workbench-action strong { color:#f4f7fb; display:block; font-size:14px; line-height:1.4; }
    .opportunity-workbench-action.tone-ready { border-color:#2e7d4f; }
    .opportunity-workbench-action.tone-review, .opportunity-workbench-action.tone-warning { border-color:#806718; }
    .opportunity-workbench-action.tone-hold { border-color:#566273; }
    .opportunity-workbench-action.tone-blocked { border-color:#8a3b3b; }
    .opportunity-workbench-summary { background:#101925; border:1px solid #26384c; border-radius:8px; display:grid; gap:4px; margin-bottom:12px; padding:12px; }
    .opportunity-workbench-summary strong { color:#f4f7fb; font-size:13px; line-height:1.5; }
    .opportunity-workbench-summary span { color:#9fb0c0; font-size:12px; line-height:1.6; }
    .opportunity-workbench-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .opportunity-workbench-panel { border:1px solid #26384c; border-radius:8px; padding:12px; background:#121a24; min-width:0; }
    .opportunity-workbench-wide { grid-column:span 2; }
    .opportunity-workbench-solution-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .opportunity-workbench-solution-grid div { border:1px solid #223447; border-radius:8px; padding:10px; background:#101925; min-width:0; }
    .opportunity-workbench-solution-grid strong { color:#a8efc0; display:block; font-size:12px; margin-bottom:5px; }
    .opportunity-workbench-context-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:10px; }
    .opportunity-workbench-context-grid div { border:1px solid #223447; border-radius:8px; padding:10px; background:#101925; min-width:0; }
    .opportunity-workbench-context-grid strong { color:#a8efc0; display:block; font-size:12px; margin-bottom:5px; }
    .opportunity-workbench-context-list { border:1px solid #223447; border-radius:8px; background:#101925; padding:10px !important; }
    .opportunity-workbench-caveat { border-top:1px solid #223447; color:#9fb0c0 !important; margin-top:10px !important; padding-top:10px; }
    .opportunity-workbench-pill-row { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
    .opportunity-workbench-pill { border:1px solid #3a5575; border-radius:999px; color:#dbeafe; display:inline-flex; font-size:11px; font-weight:700; line-height:1; padding:5px 8px; }
    .review-needs_review, .verification-needs_review, .confidence-medium, .generation-heuristic, .generation-unavailable { background:#4a3a12; border-color:#806718; color:#ffe58a; }
    .review-approved, .verification-verified, .confidence-high { background:#17462a; border-color:#2e7d4f; color:#a8efc0; }
    .review-rejected, .confidence-low { background:#4a1f1f; border-color:#8a3b3b; color:#ffc4c4; }
    .review-deferred, .verification-draft, .verification-unverified { background:#2f3542; border-color:#566273; color:#d7dee8; }
    .generation-llm { background:#203345; border-color:#38536c; color:#cde7ff; }
    .generation-demo { background:#3a294b; border-color:#6b4a88; color:#e4c8ff; }
    .opportunity-workbench-list, .opportunity-workbench-evidence-list { list-style:none; margin:0; padding:0; }
    .opportunity-workbench-list li, .opportunity-workbench-evidence-list li { border-top:1px solid #223447; color:#cbd8e6; font-size:12px; line-height:1.55; padding:7px 0; }
    .opportunity-workbench-list li:first-child, .opportunity-workbench-evidence-list li:first-child { border-top:0; padding-top:0; }
    .opportunity-workbench-evidence-list { max-height:150px; overflow:auto; }
    .opportunity-workbench-evidence-list strong { color:#a8efc0; }
    .opportunity-workbench-evidence-list a { color:#5dade2; text-decoration:none; }
    .opportunity-workbench-evidence-list a:hover { text-decoration:underline; }
    .opportunity-workbench-empty { color:#8fa4b8 !important; }
    @media (max-width: 720px) {
      .opportunity-workbench-header { flex-direction:column; }
      .opportunity-workbench-action { min-width:0; width:100%; }
      .opportunity-workbench-grid { grid-template-columns:1fr; }
      .opportunity-workbench-solution-grid { grid-template-columns:1fr; }
      .opportunity-workbench-context-grid { grid-template-columns:1fr; }
      .opportunity-workbench-wide { grid-column:auto; }
      .opportunity-workbench-evidence-list { max-height: none; }
    }
  `;
}
