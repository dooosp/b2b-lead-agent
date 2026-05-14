import { getCommonStyles } from './common-styles.js';
import { buildOpportunityWorkbenchModel, getOpportunityWorkbenchStyles, renderOpportunityWorkbench } from './opportunity-workbench.js';
import { getEscScript, getSafeUrlScript, getStoredTokenScript } from './script-snippets.js';

export function getLeadDetailPage(lead, statusLogs) {
  const statusLabelsJS = JSON.stringify({ NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' });
  const statusColorsJS = JSON.stringify({ NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' });
  const transitionsJS = JSON.stringify({ NEW: ['CONTACTED'], CONTACTED: ['MEETING'], MEETING: ['PROPOSAL'], PROPOSAL: ['NEGOTIATION'], NEGOTIATION: ['WON','LOST'], LOST: ['NEW'], WON: [] });
  const reviewStatusLabelsJS = JSON.stringify({ NEW: '새 검토', NEEDS_REVIEW: '검토 필요', APPROVED: '승인', REJECTED: '반려', DEFERRED: '보류' });
  const opportunityWorkbenchHtml = renderOpportunityWorkbench(buildOpportunityWorkbenchModel(lead));
  const opportunityWorkbenchHtmlJS = JSON.stringify(opportunityWorkbenchHtml).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const leadJSON = JSON.stringify(lead).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const logsJSON = JSON.stringify(statusLogs || []).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${(lead.company || '리드').replace(/[<>"'&]/g, '')} - 리드 상세</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}${getOpportunityWorkbenchStyles()}
    .detail-section { background: #1e2a3a; border-radius: 12px; padding: 20px; margin: 16px 0; text-align: left; }
    .detail-section h3 { color: #e94560; font-size: 16px; margin: 0 0 14px 0; }
    .detail-row { display: flex; gap: 8px; margin: 8px 0; font-size: 14px; line-height: 1.6; }
    .detail-row .label { color: #888; min-width: 100px; flex-shrink: 0; }
    .detail-row .value { color: #ddd; word-break: break-word; }
    .timeline { list-style: none; padding: 0; margin: 0; position: relative; }
    .timeline::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 8px; width: 2px; background: #2a3a4a; }
    .timeline li { position: relative; padding: 8px 0 8px 30px; font-size: 13px; color: #ccc; }
    .timeline li::before { content: ''; position: absolute; left: 4px; top: 14px; width: 10px; height: 10px; border-radius: 50%; background: #3498db; border: 2px solid #1e2a3a; }
    .timeline li:last-child::before { background: #e94560; }
    .timeline .time { color: #666; font-size: 11px; display: block; }
    .field-group { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .field-group label { color: #aaa; font-size: 12px; display: block; margin-bottom: 4px; }
    .field-group input { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 14px; }
    .notes-area { width: 100%; min-height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #ccc; font-size: 13px; resize: vertical; font-family: inherit; margin-top: 8px; }
    .save-indicator { color: #27ae60; font-size: 11px; opacity: 0; transition: opacity 0.3s; margin-left: 8px; }
    .save-indicator.show { opacity: 1; }
    .status-select-lg { padding: 8px 12px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 14px; cursor: pointer; }
    .review-select-lg { padding: 8px 12px; border-radius: 6px; border: 1px solid #52667c; background: #172233; color: #fff; font-size: 14px; cursor: pointer; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .badge-review { background:#243547; color:#dbeafe; border:1px solid #36506c; }
    .badge-review.needs_review { background:#4a3a12; color:#ffe58a; border-color:#806718; }
    .badge-review.approved { background:#17462a; color:#a8efc0; border-color:#2e7d4f; }
    .badge-review.rejected { background:#4a1f1f; color:#ffc4c4; border-color:#8a3b3b; }
    .badge-review.deferred { background:#2f3542; color:#d7dee8; border-color:#566273; }
    .badge-verification { background:#27364a; color:#d8e8ff; border:1px solid #3a5575; }
    .badge-verification.verified { background:#17462a; color:#a8efc0; border-color:#2e7d4f; }
    .badge-verification.needs_review, .badge-verification.unverified { background:#4a3a12; color:#ffe58a; border-color:#806718; }
    .badge-verification.draft { background:#2f3542; color:#d7dee8; border-color:#566273; }
    .badge-generation { background:#203345; color:#cde7ff; border:1px solid #38536c; }
    .badge-generation.heuristic, .badge-generation.unavailable { background:#3e2f16; color:#ffdca3; border-color:#6f5525; }
    .badge-generation.demo { background:#3a294b; color:#e4c8ff; border-color:#6b4a88; }
    .badge-confidence { background:#29384a; color:#dbeafe; border:1px solid #3b536d; }
    .badge-confidence.high { background:#17462a; color:#a8efc0; border-color:#2e7d4f; }
    .badge-confidence.medium { background:#4a3a12; color:#ffe58a; border-color:#806718; }
    .badge-confidence.low { background:#4a1f1f; color:#ffc4c4; border-color:#8a3b3b; }
    .badge-evidence { background:#223142; color:#d4deea; border:1px solid #344b63; }
    .badge-evidence.missing_evidence { background:#4a1f1f; color:#ffc4c4; border-color:#8a3b3b; }
    .review-meta-row { display:flex; gap:7px; flex-wrap:wrap; align-items:center; margin:6px 0; }
    .muted-value { color:#8fa4b8; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .top-nav-links { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .detail-productivity-toolkit { border-color:#31506c; background:#101925; display:grid; gap:10px; }
    .detail-productivity-head { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; flex-wrap:wrap; }
    .detail-productivity-head strong { color:#f4f7fb; font-size:13px; line-height:1.4; }
    .detail-productivity-head span { color:#8fa4b8; display:block; font-size:11px; line-height:1.5; margin-top:2px; }
    .detail-productivity-head button { font-size:11px; padding:5px 9px; }
    .detail-productivity-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
    .detail-productivity-grid span { background:#162338; border:1px solid #2e4157; border-radius:6px; color:#cbd8e6; font-size:11px; line-height:1.4; padding:6px 7px; }
    .detail-productivity-last { color:#9fb0c0; font-size:11px; line-height:1.5; margin:0; }
    .detail-shortcut-help { background:#0d1520; border:1px solid #2e4157; border-radius:8px; color:#cbd8e6; display:grid; gap:5px; font-size:11px; line-height:1.5; padding:9px; }
    .detail-shortcut-help.is-hidden { display:none; }
    .detail-shortcut-help kbd { background:#223447; border:1px solid #36506c; border-radius:4px; color:#f4f7fb; display:inline-block; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:10px; margin-right:4px; padding:1px 5px; }
    .detail-shortcut-help p { margin:0; }
    .detail-productivity-status { border-radius:8px; color:#9fb0c0; font-size:12px; line-height:1.5; min-height:18px; padding:8px 10px; }
    .detail-productivity-status.is-idle { padding:0; }
    .detail-productivity-status.is-pending { background:#172338; color:#cde7ff; }
    .detail-productivity-status.is-success { background:#101f1a; color:#a8efc0; }
    .detail-productivity-status.is-error { background:#211719; color:#ffc4c4; }
    .detail-section:focus, .detail-productivity-head button:focus-visible, .detail-productivity-status:focus-visible, .opportunity-workbench-note-copy-actions button:focus-visible, .status-select-lg:focus-visible, .review-select-lg:focus-visible, .field-group input:focus-visible, .notes-area:focus-visible { outline:2px solid #8fbfe8; outline-offset:3px; }
    @media (max-width: 720px) {
      .top-nav { align-items:flex-start; }
      .top-nav-links { justify-content:flex-start; width:100%; }
      .top-nav-links .btn { flex:1 1 auto; min-width:0; }
      .field-group { grid-template-columns:1fr; }
      .detail-row { align-items:flex-start; flex-direction:column; gap:4px; }
      .detail-row .label { min-width:0; }
      .detail-productivity-grid { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <main class="container" style="max-width:700px;">
    <nav class="top-nav" aria-label="상단 이동">
      <a href="/leads" class="back-link" id="backLink">← 리드 목록</a>
      <div class="top-nav-links">
        <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
      </div>
    </nav>
    <h1 style="font-size:22px;" id="leadCompany"></h1>
    <p class="subtitle" id="leadSummary"></p>

    <div id="detailContent"><p style="color:#aaa;">로딩 중...</p></div>
  </main>

  <script>
    (() => {
    const lead = ${leadJSON};
    const statusLogs = ${logsJSON};
    const statusLabels = ${statusLabelsJS};
    const statusColors = ${statusColorsJS};
    const transitions = ${transitionsJS};
    const reviewStatusLabels = ${reviewStatusLabelsJS};
    const reviewStatuses = Object.keys(reviewStatusLabels);
    const opportunityWorkbenchHtml = ${opportunityWorkbenchHtmlJS};
    const verificationStatusLabels = { verified: '검증됨', needs_review: '검증 필요', draft: '초안', unverified: '미검증' };
    const generationModeLabels = { llm: 'LLM 생성', heuristic: '휴리스틱 생성', demo: '데모', unavailable: '생성 불가' };
    const confidenceLabels = { HIGH: '신뢰도 HIGH', MEDIUM: '신뢰도 MEDIUM', LOW: '신뢰도 LOW' };

    ${getEscScript()}
    ${getSafeUrlScript()}
    ${getStoredTokenScript()}
    function getProfile() { return lead.profileId || 'danfoss'; }
    const detailActivityDefaults = {
      copiedNotes: 0,
      manualCopies: 0,
      focusMoves: 0,
      statusUpdates: 0,
      lastAction: '세션 시작됨'
    };
    const detailActivity = window.__detailProductivityActivity && typeof window.__detailProductivityActivity === 'object'
      ? window.__detailProductivityActivity
      : { ...detailActivityDefaults };
    Object.keys(detailActivityDefaults).forEach((key) => {
      if (typeof detailActivity[key] === 'undefined') detailActivity[key] = detailActivityDefaults[key];
    });
    window.__detailProductivityActivity = detailActivity;
    let detailShortcutHelpOpen = Boolean(window.__detailShortcutHelpOpen);
    let detailProductivityNotice = window.__detailProductivityNotice && typeof window.__detailProductivityNotice === 'object'
      ? window.__detailProductivityNotice
      : { message: '', tone: 'idle' };
    window.__detailProductivityNotice = detailProductivityNotice;

    function normalizeReviewStatus(value) {
      const status = String(value || '').toUpperCase();
      return reviewStatuses.includes(status) ? status : 'NEEDS_REVIEW';
    }

    function getReviewStatus(lead) {
      return normalizeReviewStatus(lead.reviewStatus || lead.review_status);
    }

    function normalizeVerificationStatus(value) {
      const status = String(value || '').toLowerCase();
      return verificationStatusLabels[status] ? status : 'needs_review';
    }

    function getVerificationStatus(lead) {
      return normalizeVerificationStatus(lead.verificationStatus || lead.verification_status);
    }

    function normalizeGenerationMode(value) {
      const mode = String(value || '').toLowerCase();
      return generationModeLabels[mode] ? mode : 'llm';
    }

    function getGenerationMode(lead) {
      return normalizeGenerationMode(lead.generationMode || lead.generation_mode);
    }

    function getConfidence(lead) {
      const confidence = String(lead.confidence || '').toUpperCase();
      return confidenceLabels[confidence] ? confidence : 'LOW';
    }

    function getArrayField(lead, camelKey, snakeKey) {
      const value = lead[camelKey];
      if (Array.isArray(value)) return value.filter(Boolean);
      const legacyValue = lead[snakeKey];
      if (Array.isArray(legacyValue)) return legacyValue.filter(Boolean);
      return [];
    }

    function getDataGaps(lead) {
      return getArrayField(lead, 'dataGaps', 'data_gaps');
    }

    function getEvidenceItems(lead) {
      return getArrayField(lead, 'evidence', 'evidence');
    }

    function getSources(lead) {
      return getArrayField(lead, 'sources', 'sources');
    }

    function renderReviewBadge(lead) {
      const current = getReviewStatus(lead);
      return '<span class="badge badge-review ' + current.toLowerCase() + '">검토 ' + esc(reviewStatusLabels[current]) + '</span>';
    }

    function renderVerificationBadge(lead) {
      const status = getVerificationStatus(lead);
      return '<span class="badge badge-verification ' + status + '">' + esc(verificationStatusLabels[status]) + '</span>';
    }

    function renderGenerationBadge(lead) {
      const mode = getGenerationMode(lead);
      return '<span class="badge badge-generation ' + mode + '">' + esc(generationModeLabels[mode]) + '</span>';
    }

    function renderConfidenceBadge(lead) {
      const confidence = getConfidence(lead);
      return '<span class="badge badge-confidence ' + confidence.toLowerCase() + '">' + esc(confidenceLabels[confidence]) + '</span>';
    }

    function renderEvidenceSummary(lead) {
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const label = evidenceCount > 0 ? '근거 ' + evidenceCount + '개' : '직접 인용 없음';
      const evidenceClass = evidenceCount > 0 ? 'has_evidence' : 'missing_evidence';
      return '<span class="badge badge-evidence ' + evidenceClass + '">' + esc(label) + ' / 출처 ' + sourceCount + '개</span>';
    }

    function renderReviewTrustBadges(lead) {
      return '<span class="review-meta-row">' +
        renderVerificationBadge(lead) +
        renderGenerationBadge(lead) +
        renderConfidenceBadge(lead) +
        renderEvidenceSummary(lead) +
        '</span>';
    }

    function renderDataGapSummary(lead) {
      const gaps = getDataGaps(lead);
      if (gaps.length === 0) {
        return '<div class="detail-row"><span class="label">데이터 공백</span><span class="value muted-value">확인된 데이터 공백 없음</span></div>';
      }
      const shown = gaps.slice(0, 3).map((gap) => esc(gap)).join('<br>');
      const extra = gaps.length > 3 ? '<br>외 ' + (gaps.length - 3) + '건' : '';
      return '<div class="detail-row"><span class="label">데이터 공백</span><span class="value">' + shown + extra + '</span></div>';
    }

    // Back link에 프로필 쿼리 추가
    document.getElementById('backLink').href = '/leads?profile=' + encodeURIComponent(getProfile());
    document.getElementById('leadCompany').textContent = lead.company || '리드 상세';
    document.getElementById('leadSummary').textContent = lead.summary || '';

    function renderDetailProductivityToolkit() {
      const helpHidden = detailShortcutHelpOpen ? '' : ' hidden';
      const helpClass = detailShortcutHelpOpen ? '' : ' is-hidden';
      const noticeTone = detailProductivityNotice.tone || 'idle';
      const noticeMessage = detailProductivityNotice.message || '';
      return '<section id="detailProductivityToolkit" class="detail-section detail-productivity-toolkit" aria-label="Workbench Productivity Toolkit">' +
        '<div class="detail-productivity-head"><div>' +
        '<strong>Workbench Productivity Toolkit</strong>' +
        '<span>복사, 포커스, 명시적 상태 피드백만 현재 브라우저 세션에서 집계</span>' +
        '</div><button class="btn btn-secondary" type="button" data-detail-shortcut-action="toggle-help" aria-expanded="' + (detailShortcutHelpOpen ? 'true' : 'false') + '" aria-controls="detailShortcutHelp">단축키 도움말</button></div>' +
        '<div id="detailProductivityCounts" class="detail-productivity-grid">' +
        '<span>노트 복사 ' + detailActivity.copiedNotes + '건</span>' +
        '<span>수동 복사 ' + detailActivity.manualCopies + '건</span>' +
        '<span>포커스 이동 ' + detailActivity.focusMoves + '건</span>' +
        '<span>상태 피드백 ' + detailActivity.statusUpdates + '건</span>' +
        '</div>' +
        '<p id="detailProductivityLastAction" class="detail-productivity-last">마지막 작업: ' + esc(detailActivity.lastAction || '세션 활동 없음') + '</p>' +
        '<div id="detailShortcutHelp" class="detail-shortcut-help' + helpClass + '"' + helpHidden + ' role="region" aria-label="단축키 도움말">' +
        '<p><kbd>c</kbd> 보이는 Workbench 리뷰 노트 복사</p>' +
        '<p><kbd>w</kbd> Opportunity Workbench로 포커스</p>' +
        '<p><kbd>n</kbd>/<kbd>j</kbd> 다음 상세 섹션으로 포커스</p>' +
        '<p><kbd>?</kbd> 단축키 도움말 열기/닫기</p>' +
        '<p>Shortcut keys do not change reviewStatus. 승인/반려/보류 변경은 선택 상자에서만 실행됩니다.</p>' +
        '</div>' +
        '<div id="detailProductivityStatus" class="detail-productivity-status is-' + esc(noticeTone) + '" role="status" aria-live="polite" aria-atomic="true">' + esc(noticeMessage) + '</div>' +
        '</section>';
    }

    function updateDetailActivitySummary() {
      const counts = document.getElementById('detailProductivityCounts');
      if (counts) {
        counts.innerHTML = [
          '<span>노트 복사 ' + detailActivity.copiedNotes + '건</span>',
          '<span>수동 복사 ' + detailActivity.manualCopies + '건</span>',
          '<span>포커스 이동 ' + detailActivity.focusMoves + '건</span>',
          '<span>상태 피드백 ' + detailActivity.statusUpdates + '건</span>'
        ].join('');
      }
      const last = document.getElementById('detailProductivityLastAction');
      if (last) last.textContent = '마지막 작업: ' + (detailActivity.lastAction || '세션 활동 없음');
    }

    function setDetailProductivityStatus(message, tone = 'idle') {
      detailProductivityNotice = { message: message || '', tone };
      window.__detailProductivityNotice = detailProductivityNotice;
      const el = document.getElementById('detailProductivityStatus');
      if (!el) return;
      el.className = 'detail-productivity-status is-' + tone;
      el.textContent = message || '';
    }

    function recordDetailActivity(type, message) {
      if (type === 'noteCopied') detailActivity.copiedNotes += 1;
      if (type === 'manualCopyReady') detailActivity.manualCopies += 1;
      if (type === 'workbenchFocused' || type === 'sectionFocused') detailActivity.focusMoves += 1;
      if (type === 'statusUpdateSucceeded' || type === 'statusUpdateFailed') detailActivity.statusUpdates += 1;
      detailActivity.lastAction = message || '세션 활동 업데이트';
      window.__detailProductivityActivity = detailActivity;
      updateDetailActivitySummary();
    }

    function getWorkbenchNoteTextElement(source) {
      const root = source && source.closest
        ? source.closest('.opportunity-workbench-note-variant, .opportunity-workbench-review-note') || document
        : document;
      return root.querySelector('[data-workbench-note-text]');
    }

    function getActiveWorkbenchNoteTextElement() {
      const active = document.activeElement;
      const activeNote = active && active.closest
        ? active.closest('.opportunity-workbench-note-variant, .opportunity-workbench-review-note')
        : null;
      if (activeNote) {
        const activeText = activeNote.querySelector('[data-workbench-note-text]');
        if (activeText) return activeText;
      }
      return document.querySelector('#opportunity-workbench .opportunity-workbench-review-note [data-workbench-note-text]');
    }

    function selectWorkbenchNoteForManualCopy(target) {
      if (!target || !window.getSelection || !document.createRange) return false;
      document.querySelectorAll('.opportunity-workbench-note-copy-target.is-manual-copy').forEach((item) => item.classList.remove('is-manual-copy'));
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      target.classList.add('is-manual-copy');
      target.focus({ preventScroll: true });
      return true;
    }

    function showWorkbenchCopyButtonFeedback(button, label) {
      if (!button) return;
      const original = button.dataset.originalLabel || button.textContent;
      button.dataset.originalLabel = original;
      button.textContent = label;
      clearTimeout(button._copyFeedbackTimer);
      button._copyFeedbackTimer = setTimeout(() => {
        button.textContent = button.dataset.originalLabel || original;
      }, 1600);
    }

    async function copyWorkbenchReviewNote(source) {
      const button = source && source.closest ? source.closest('[data-workbench-note-copy-action]') : null;
      const target = getWorkbenchNoteTextElement(button || source) || getActiveWorkbenchNoteTextElement();
      const text = target ? String(target.textContent || '').trim() : '';
      if (!text) {
        recordDetailActivity('copyUnavailable', '복사할 Workbench 리뷰 노트를 찾지 못했습니다.');
        setDetailProductivityStatus('복사할 Workbench 리뷰 노트를 찾지 못했습니다.', 'error');
        return false;
      }

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          recordDetailActivity('noteCopied', 'Workbench 리뷰 노트를 클립보드에 복사했습니다.');
          setDetailProductivityStatus('Workbench 리뷰 노트를 복사했습니다. 저장하거나 전송하지 않았습니다.', 'success');
          showWorkbenchCopyButtonFeedback(button, '복사됨');
          return true;
        }
      } catch {
        // Fall through to manual copy selection.
      }

      if (selectWorkbenchNoteForManualCopy(target)) {
        recordDetailActivity('manualCopyReady', 'Clipboard API를 사용할 수 없어 수동 복사 상태로 전환했습니다.');
        setDetailProductivityStatus('Clipboard API를 사용할 수 없어 노트 텍스트를 선택했습니다. 직접 복사하세요.', 'pending');
        showWorkbenchCopyButtonFeedback(button, '직접 복사');
        return false;
      }

      recordDetailActivity('copyFailed', 'Workbench 리뷰 노트를 복사하지 못했습니다.');
      setDetailProductivityStatus('Workbench 리뷰 노트를 복사하지 못했습니다. 노트 텍스트를 직접 선택해 복사하세요.', 'error');
      return false;
    }

    function copyActiveWorkbenchReviewNote() {
      return copyWorkbenchReviewNote(getActiveWorkbenchNoteTextElement());
    }

    function getDetailFocusableSections() {
      return [...document.querySelectorAll('#detailContent > .detail-section')].filter((section) => section.offsetParent !== null);
    }

    function prepareDetailSectionNavigation() {
      getDetailFocusableSections().forEach((section) => {
        if (!section.hasAttribute('tabindex')) section.tabIndex = -1;
      });
    }

    function focusOpportunityWorkbench() {
      const workbench = document.getElementById('opportunity-workbench');
      if (!workbench) {
        recordDetailActivity('focusUnavailable', 'Opportunity Workbench를 찾지 못했습니다.');
        setDetailProductivityStatus('Opportunity Workbench를 찾지 못했습니다.', 'error');
        return;
      }
      workbench.focus({ preventScroll: true });
      workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
      recordDetailActivity('workbenchFocused', 'Opportunity Workbench로 이동했습니다.');
      setDetailProductivityStatus('Opportunity Workbench로 이동했습니다.', 'success');
    }

    function focusNextDetailSection() {
      const sections = getDetailFocusableSections();
      if (sections.length === 0) {
        recordDetailActivity('focusUnavailable', '이동할 상세 섹션이 없습니다.');
        setDetailProductivityStatus('이동할 상세 섹션이 없습니다.', 'error');
        return;
      }
      const active = document.activeElement;
      const currentSection = active && active.closest ? active.closest('#detailContent > .detail-section') : null;
      const currentIndex = currentSection ? sections.indexOf(currentSection) : -1;
      const next = sections[(currentIndex + 1) % sections.length];
      next.focus({ preventScroll: true });
      next.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const heading = next.querySelector('h3, strong');
      const label = heading ? String(heading.textContent || '').trim() : '다음 상세 섹션';
      recordDetailActivity('sectionFocused', label + ' 섹션으로 이동했습니다.');
      setDetailProductivityStatus(label + ' 섹션으로 이동했습니다.', 'success');
    }

    function updateDetailShortcutHelpVisibility() {
      window.__detailShortcutHelpOpen = detailShortcutHelpOpen;
      const help = document.getElementById('detailShortcutHelp');
      if (help) {
        help.hidden = !detailShortcutHelpOpen;
        help.classList.toggle('is-hidden', !detailShortcutHelpOpen);
      }
      document.querySelectorAll('[data-detail-shortcut-action="toggle-help"]').forEach((button) => {
        button.setAttribute('aria-expanded', detailShortcutHelpOpen ? 'true' : 'false');
      });
    }

    function toggleDetailShortcutHelp() {
      detailShortcutHelpOpen = !detailShortcutHelpOpen;
      updateDetailShortcutHelpVisibility();
      recordDetailActivity('shortcutHelp', detailShortcutHelpOpen ? '단축키 도움말을 열었습니다.' : '단축키 도움말을 닫았습니다.');
      setDetailProductivityStatus(detailShortcutHelpOpen ? '단축키 도움말을 열었습니다.' : '단축키 도움말을 닫았습니다.', 'success');
    }

    function isInteractiveDetailShortcutTarget(target) {
      if (!target) return false;
      const tagName = String(target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea', 'button', 'a', 'summary'].includes(tagName)) return true;
      if (target.isContentEditable || (target.closest && target.closest('[contenteditable="true"]'))) return true;
      return !!(target.closest && target.closest('[role="button"], [role="tab"], [role="menuitem"]'));
    }

    function shouldIgnoreDetailShortcut(event) {
      if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
      return isInteractiveDetailShortcutTarget(event.target);
    }

    function handleDetailShortcut(event) {
      if (shouldIgnoreDetailShortcut(event)) return;
      const key = String(event.key || '').toLowerCase();
      if (key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        toggleDetailShortcutHelp();
        return;
      }
      if (key === 'c') {
        event.preventDefault();
        copyActiveWorkbenchReviewNote();
        return;
      }
      if (key === 'w') {
        event.preventDefault();
        focusOpportunityWorkbench();
        return;
      }
      if (key === 'n' || key === 'j') {
        event.preventDefault();
        focusNextDetailSection();
      }
    }

    function renderDetail() {
      const c = document.getElementById('detailContent');
      let html = '';

      // 기본 정보 + 상태 섹션
      const currentStatus = lead.status || 'NEW';
      const allowed = transitions[currentStatus] || [];
      const statusOpts = [currentStatus, ...allowed].map(s =>
        '<option value="' + s + '"' + (s === currentStatus ? ' selected' : '') + '>' + esc(statusLabels[s] || s) + '</option>'
      ).join('');

      html += opportunityWorkbenchHtml;
      html += renderDetailProductivityToolkit();

      html += '<div class="detail-section">';
      html += '<h3>기본 정보</h3>';
      html += '<div class="detail-row"><span class="label">상태</span><span class="value">';
      if (allowed.length > 0) {
        html += '<select class="status-select-lg" aria-label="영업 상태 변경" onchange="updateField(\\'status\\', this.value)">' + statusOpts + '</select>';
      } else {
        html += '<span style="color:' + (statusColors[currentStatus] || '#fff') + ';font-weight:bold;">' + esc(statusLabels[currentStatus]) + '</span>';
      }
      html += '</span></div>';
      html += '<div class="detail-row"><span class="label">등급</span><span class="value"><span class="badge ' + (lead.grade === 'A' ? 'badge-a' : 'badge-b') + '">' + esc(lead.grade) + '</span> (' + lead.score + '점)' + (lead.urgency ? ' <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:bold;color:#fff;background:' + (lead.urgency === 'HIGH' ? '#e74c3c' : '#f39c12') + ';">' + (lead.urgency === 'HIGH' ? '긴급' : '보통') + '</span>' : '') + '</span></div>';
      if (lead.scoreReason) html += '<div class="detail-row"><span class="label">등급 근거</span><span class="value">' + esc(lead.scoreReason) + '</span></div>';
      if (lead.urgencyReason) html += '<div class="detail-row"><span class="label">긴급도 근거</span><span class="value">' + esc(lead.urgencyReason) + '</span></div>';
      if (lead.buyerRole) html += '<div class="detail-row"><span class="label">예상 키맨</span><span class="value">' + esc(lead.buyerRole) + '</span></div>';
      html += '<div class="detail-row"><span class="label">신뢰도</span><span class="value">' + renderConfidenceBadge(lead) + (lead.confidenceReason ? ' <span style="color:#aaa;font-size:11px;">' + esc(lead.confidenceReason) + '</span>' : '') + '</span></div>';
      if (lead.eventType) html += '<div class="detail-row"><span class="label">이벤트 유형</span><span class="value">' + esc(lead.eventType) + '</span></div>';
      html += '<div class="detail-row"><span class="label">신호</span><span class="value">' + esc(lead.signal || lead.summary || '-') + '</span></div>';
      if (lead.whyNow) html += '<div class="detail-row"><span class="label">왜 지금</span><span class="value">' + esc(lead.whyNow) + '</span></div>';
      html += '<div class="detail-row"><span class="label">추천 제품</span><span class="value">' + esc(lead.product) + '</span></div>';
      html += '<div class="detail-row"><span class="label">예상 ROI</span><span class="value">' + esc(lead.roi || '-') + '</span></div>';
      html += '<div class="detail-row"><span class="label">추천 메시지</span><span class="value">' + esc(lead.recommendedMessage || lead.salesPitch) + '</span></div>';
      html += '<div class="detail-row"><span class="label">글로벌 트렌드</span><span class="value">' + esc(lead.globalContext || '-') + '</span></div>';
      html += '<div class="detail-row"><span class="label">프로필</span><span class="value">' + esc(lead.profileId) + '</span></div>';
      html += '<div class="detail-row"><span class="label">생성일</span><span class="value">' + esc((lead.createdAt || '').split('T')[0]) + '</span></div>';
      html += '</div>';

      const currentReviewStatus = getReviewStatus(lead);
      const reviewOpts = reviewStatuses.map(s =>
        '<option value="' + s + '"' + (s === currentReviewStatus ? ' selected' : '') + '>' + esc(reviewStatusLabels[s]) + '</option>'
      ).join('');
      html += '<div class="detail-section">';
      html += '<h3>사람 검토</h3>';
      html += '<div class="detail-row"><span class="label">검토 상태</span><span class="value"><span class="review-meta-row">' + renderReviewBadge(lead) + '<select class="review-select-lg" aria-label="사람 검토 상태 변경" onchange="updateField(\\'reviewStatus\\', this.value)">' + reviewOpts + '</select></span></span></div>';
      html += '<div class="detail-row"><span class="label">검증/생성</span><span class="value">' + renderReviewTrustBadges(lead) + '</span></div>';
      html += renderDataGapSummary(lead);
      const evidenceItems = getEvidenceItems(lead);
      if (evidenceItems.length) {
        html += '<div class="detail-row"><span class="label">근거 인용</span><span class="value">' + evidenceItems.slice(0, 3).map(e => '<strong style="color:#a8efc0;">[' + esc(e.field || 'evidence') + ']</strong> "' + esc(e.quote || '') + '"').join('<br>') + '</span></div>';
      } else {
        html += '<div class="detail-row"><span class="label">근거 인용</span><span class="value muted-value">직접 인용 없음</span></div>';
      }
      if (lead.assumptions && lead.assumptions.length) html += '<div class="detail-row"><span class="label">가정</span><span class="value">' + esc(lead.assumptions.join(', ')) + '</span></div>';
      html += '<span class="save-indicator" id="reviewSaveIndicator">저장됨</span>';
      html += '</div>';

      // 후속 조치 + 예상 계약액 섹션
      html += '<div class="detail-section">';
      html += '<h3>영업 관리</h3>';
      html += '<div class="field-group">';
      html += '<div><label for="followUpDate">다음 후속 조치일</label><input type="date" id="followUpDate" aria-label="다음 후속 조치일" value="' + esc(lead.followUpDate || '') + '" onchange="updateField(\\'follow_up_date\\', this.value)"></div>';
      html += '<div><label for="estimatedValue">예상 계약액 (만원)</label><input type="number" id="estimatedValue" aria-label="예상 계약액 만원" value="' + (lead.estimatedValue || 0) + '" min="0" onchange="updateField(\\'estimated_value\\', parseInt(this.value)||0)"></div>';
      html += '</div>';
      html += '<span class="save-indicator" id="saveIndicator">저장됨</span>';
      html += '</div>';

      // Enrichment 섹션
      if (lead.enriched) {
        const listItem = (text) => '<li style="color:#ccc;font-size:13px;padding:2px 0 2px 12px;position:relative;"><span style="position:absolute;left:0;color:#8e44ad;">→</span>' + esc(text) + '</li>';
        const sectionLabel = (text) => '<p style="color:#ce93d8;font-size:13px;font-weight:bold;margin-bottom:6px;">' + text + '</p>';
        const ulWrap = (items) => '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">' + items + '</ul>';
        const meddicItem = (label, val) => val ? '<li style="color:#ccc;font-size:13px;padding:3px 0;"><strong style="color:#ce93d8;">' + label + ':</strong> ' + esc(val) + '</li>' : '';

        html += '<div class="detail-section">';
        html += '<h3>심층 분석 결과</h3>';
        if (lead.keyFigures && lead.keyFigures.length) {
          html += sectionLabel('핵심 수치');
          html += ulWrap(lead.keyFigures.map(f => listItem(f)).join(''));
        }
        if (lead.painPoints && lead.painPoints.length) {
          html += sectionLabel('고객 과제 (정량)');
          html += ulWrap(lead.painPoints.map(p => listItem(p)).join(''));
        }
        if (lead.actionItems && lead.actionItems.length) {
          html += sectionLabel('후속 실행 항목');
          html += ulWrap(lead.actionItems.map(a => listItem(a)).join(''));
        }

        // MEDDIC 분석
        if (lead.meddic && Object.values(lead.meddic).some(v => v)) {
          html += sectionLabel('MEDDIC 분석');
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">';
          html += meddicItem('예산 규모', lead.meddic.budget);
          html += meddicItem('의사결정 구조', lead.meddic.authority);
          html += meddicItem('핵심 니즈', lead.meddic.need);
          html += meddicItem('구매 타임라인', lead.meddic.timeline);
          html += meddicItem('구매 프로세스', lead.meddic.decisionProcess);
          html += meddicItem('내부 챔피언', lead.meddic.champion);
          html += '</ul>';
        }

        // 경쟁 인텔리전스
        if (lead.competitive && Object.values(lead.competitive).some(v => v)) {
          html += sectionLabel('경쟁 인텔리전스');
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">';
          html += meddicItem('현재 벤더', lead.competitive.currentVendor);
          html += meddicItem('경쟁사', lead.competitive.competitors);
          html += meddicItem('우리 차별점', lead.competitive.ourAdvantage);
          html += meddicItem('전환 장벽/극복', lead.competitive.switchBarrier);
          html += '</ul>';
        }

        // 구매 신호
        if (lead.buyingSignals && lead.buyingSignals.length) {
          html += sectionLabel('구매 신호');
          html += ulWrap(lead.buyingSignals.map(s => listItem(s)).join(''));
        }

        // 근거 (Evidence)
        if (lead.evidence && lead.evidence.length) {
          html += sectionLabel('근거 (Evidence)');
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">';
          lead.evidence.forEach(e => {
            html += '<li style="color:#ccc;font-size:13px;padding:3px 0;border-left:2px solid #27ae60;padding-left:10px;margin:4px 0;"><strong style="color:#27ae60;">[' + esc(e.field || '') + ']</strong> "' + esc(e.quote || '') + '"';
            if (e.sourceUrl) html += ' <a href="' + safeUrl(e.sourceUrl) + '" target="_blank" rel="noopener noreferrer" style="color:#3498db;font-size:11px;">출처</a>';
            html += '</li>';
          });
          html += '</ul>';
        }

        // 가정 (Assumptions)
        if (lead.assumptions && lead.assumptions.length) {
          html += '<div style="background:#332b00;border-left:3px solid #f39c12;padding:8px 12px;border-radius:4px;margin-bottom:12px;">';
          html += '<p style="color:#f39c12;font-size:13px;font-weight:bold;margin-bottom:6px;">가정 (Assumptions)</p>';
          html += '<ul style="list-style:none;padding:0;margin:0;">';
          lead.assumptions.forEach(a => {
            html += '<li style="color:#e6c200;font-size:12px;padding:2px 0;">⚠ ' + esc(a) + '</li>';
          });
          html += '</ul></div>';
        }

        if (lead.enrichedAt) html += '<p style="color:#666;font-size:11px;">분석일: ' + esc(lead.enrichedAt.split('T')[0]) + '</p>';
        html += '</div>';
      }

      // 출처 섹션
      if (lead.sources && lead.sources.length > 0) {
        html += '<div class="detail-section">';
        html += '<h3>출처 (' + lead.sources.length + '건)</h3>';
        html += '<ul style="list-style:none;padding:0;">';
        lead.sources.forEach(s => {
          html += '<li style="margin:6px 0;"><a href="' + safeUrl(s.url) + '" target="_blank" rel="noopener noreferrer" style="color:#3498db;text-decoration:none;font-size:13px;">' + esc(s.title) + '</a></li>';
        });
        html += '</ul></div>';
      }

      // 메모 섹션
      html += '<div class="detail-section">';
      html += '<h3>메모</h3>';
      html += '<textarea class="notes-area" id="notesArea" aria-label="메모를 입력하세요" placeholder="메모를 입력하세요..." oninput="scheduleNoteSave()">' + esc(lead.notes || '') + '</textarea>';
      html += '</div>';

      // 타임라인 섹션
      html += '<div class="detail-section">';
      html += '<h3>상태 변경 타임라인</h3>';
      if (statusLogs.length === 0) {
        html += '<p style="color:#666;font-size:13px;">아직 상태 변경 이력이 없습니다.</p>';
      } else {
        html += '<ul class="timeline">';
        statusLogs.forEach(log => {
          const time = log.changedAt ? new Date(log.changedAt).toLocaleString('ko-KR') : '';
          html += '<li><span class="time">' + esc(time) + '</span>' +
            '<span style="color:' + (statusColors[log.fromStatus] || '#aaa') + '">' + esc(statusLabels[log.fromStatus] || log.fromStatus) + '</span>' +
            ' → <span style="color:' + (statusColors[log.toStatus] || '#aaa') + '">' + esc(statusLabels[log.toStatus] || log.toStatus) + '</span></li>';
        });
        html += '</ul>';
      }
      html += '</div>';

      c.innerHTML = html;
      prepareDetailSectionNavigation();
      updateDetailActivitySummary();
      updateDetailShortcutHelpVisibility();
    }

    async function updateField(field, value) {
      try {
        const body = {};
        body[field] = value;
        if (field === 'status') body.status = value;
        const res = await fetch('/api/leads/' + encodeURIComponent(lead.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.success) {
          if (field === 'reviewStatus' || field === 'status') {
            const label = field === 'reviewStatus' ? '검토 상태' : '영업 상태';
            recordDetailActivity('statusUpdateFailed', label + ' 업데이트 실패');
            setDetailProductivityStatus(label + '를 저장하지 못했습니다. 선택 상태를 확인한 뒤 다시 시도하세요.', 'error');
            renderDetail();
            return;
          }
          alert(data.message);
          if (field === 'status') renderDetail();
          return;
        }
        // 로컬 lead 객체 업데이트
        if (data.lead) Object.assign(lead, data.lead);
        showSaved();
        if (field === 'status' || field === 'reviewStatus') {
          const label = field === 'reviewStatus' ? '검토 상태' : '영업 상태';
          const nextLabel = field === 'reviewStatus'
            ? (reviewStatusLabels[getReviewStatus(lead)] || getReviewStatus(lead))
            : (statusLabels[lead.status || 'NEW'] || lead.status || 'NEW');
          recordDetailActivity('statusUpdateSucceeded', label + ' 업데이트: ' + nextLabel);
          setDetailProductivityStatus(label + '를 ' + nextLabel + '(으)로 저장했습니다. 명시적 UI 작업만 반영했습니다.', 'success');
          await refreshDetailPage();
        }
      } catch(e) {
        if (field === 'reviewStatus' || field === 'status') {
          const label = field === 'reviewStatus' ? '검토 상태' : '영업 상태';
          recordDetailActivity('statusUpdateFailed', label + ' 업데이트 실패');
          setDetailProductivityStatus(label + '를 저장하지 못했습니다. 네트워크 또는 로컬 저장소를 확인한 뒤 다시 시도하세요.', 'error');
          renderDetail();
          return;
        }
        alert('업데이트 실패: ' + e.message);
      }
    }

    async function refreshDetailPage() {
      const res = await fetch(window.location.pathname + window.location.search, { headers: authHeaders() });
      const html = await res.text();
      document.open();
      document.write(html);
      document.close();
    }

    let noteTimer;
    function scheduleNoteSave() {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(async () => {
        const val = document.getElementById('notesArea').value;
        await updateField('notes', val);
      }, 800);
    }

    function showSaved() {
      ['saveIndicator', 'reviewSaveIndicator'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2000); }
      });
    }

    window.updateField = updateField;
    window.scheduleNoteSave = scheduleNoteSave;
    window.copyWorkbenchReviewNote = copyWorkbenchReviewNote;
    window.handleDetailShortcut = handleDetailShortcut;
    window.focusOpportunityWorkbench = focusOpportunityWorkbench;
    window.focusNextDetailSection = focusNextDetailSection;
    document.addEventListener('click', (event) => {
      const copyButton = event.target.closest('[data-workbench-note-copy-action]');
      if (copyButton) {
        event.preventDefault();
        copyWorkbenchReviewNote(copyButton);
        return;
      }
      const shortcutButton = event.target.closest('[data-detail-shortcut-action="toggle-help"]');
      if (shortcutButton) {
        event.preventDefault();
        toggleDetailShortcutHelp();
      }
    });
    document.addEventListener('keydown', handleDetailShortcut);
    renderDetail();
    })();
  </script>
</body>
</html>`;
}
