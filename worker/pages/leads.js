import { getCommonStyles } from './common-styles.js';
import { getEscScript, getProfileScript, getSafeUrlScript, getStoredTokenScript } from './script-snippets.js';

export function getLeadsPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드 상세 보기</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .leads-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin:12px 0 18px; }
    .summary-card { background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:14px; text-align:left; }
    .summary-card .label { color:#8fa4b8; font-size:11px; display:block; margin-bottom:6px; }
    .summary-card .value { color:#f4f7fb; font-size:22px; font-weight:700; display:block; }
    .summary-card .meta { color:#9fb0c0; font-size:12px; margin-top:6px; }
    .lead-card { background: linear-gradient(180deg, #182433 0%, #121b27 100%); border-radius: 14px; padding: 18px; margin: 16px 0; border: 1px solid #26384c; }
    .lead-card.grade-a { box-shadow: 0 12px 28px rgba(233,69,96,0.14); border-color:#e94560; }
    .lead-card.grade-b { border-color: #f39c12; box-shadow: 0 10px 24px rgba(243,156,18,0.12); }
    .lead-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:12px; }
    .lead-title h3 { color: #f4f7fb; margin: 0 0 8px 0; font-size: 19px; line-height:1.4; }
    .lead-subtitle { color:#a9b9c8; font-size:13px; line-height:1.6; }
    .lead-badges { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .lead-status-row { margin:8px 0 0; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .lead-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:14px 0; }
    .lead-metric { background:#121a24; border:1px solid #223447; border-radius:10px; padding:10px 12px; }
    .lead-metric .metric-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:4px; }
    .lead-metric .metric-value { display:block; color:#f4f7fb; font-size:14px; font-weight:700; line-height:1.5; }
    .lead-sections { display:grid; gap:10px; }
    .lead-block { background:#121a24; border:1px solid #223447; border-radius:10px; padding:12px; }
    .lead-block .block-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em; }
    .lead-block .block-value { color:#d4deea; font-size:13px; line-height:1.7; }
    .lead-sources { margin-top: 12px; padding-top: 12px; border-top: 1px solid #2a3a4a; }
    .lead-sources summary { color: #aaa; font-size: 13px; cursor: pointer; }
    .lead-sources summary:hover { color: #fff; }
    .lead-sources ul { list-style: none; padding: 8px 0 0 0; margin: 0; }
    .lead-sources li { margin: 4px 0; }
    .lead-sources a { color: #3498db; text-decoration: none; font-size: 13px; }
    .lead-sources a:hover { color: #5dade2; text-decoration: underline; }
    .lead-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .lead-actions a { font-size: 12px; padding: 6px 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .badge-status { background: #3498db; color: #fff; margin-left: 8px; }
    .badge-status.contacted { background: #9b59b6; }
    .badge-status.meeting { background: #e67e22; }
    .badge-status.proposal { background: #1abc9c; }
    .badge-status.negotiation { background: #2980b9; }
    .badge-status.won { background: #27ae60; }
    .badge-status.lost { background: #7f8c8d; }
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
    .lead-review-meta { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; align-items:center; }
    .select-label { color:#8fa4b8; font-size:11px; font-weight:700; }
    .lead-block.data-gap-summary { border-color:#6f5525; background:#171d25; }
    .lead-block.data-gap-clear { border-color:#2e7d4f; background:#141f1b; }
    .lead-review-gate { background:#101925; border:1px solid #223447; border-radius:10px; display:grid; gap:8px; padding:12px; text-align:left; }
    .lead-review-gate .block-label { color:#8fa4b8; display:block; font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
    .lead-review-gate strong { color:#f4f7fb; font-size:14px; line-height:1.4; }
    .lead-review-gate-items { display:flex; flex-wrap:wrap; gap:6px; }
    .lead-review-gate-items span { background:#162338; border:1px solid #2e4157; border-radius:6px; color:#cbd8e6; font-size:11px; line-height:1.4; padding:4px 7px; }
    .lead-review-gate p { color:#9fb0c0; font-size:11px; line-height:1.5; margin:0; }
    .lead-review-gate.gate-ready { border-color:#2e7d4f; background:#101f1a; }
    .lead-review-gate.gate-ready strong { color:#a8efc0; }
    .lead-review-gate.gate-blocked { border-color:#8a3b3b; background:#211719; }
    .lead-review-gate.gate-blocked strong { color:#ffc4c4; }
    .lead-review-gate.gate-hold, .lead-review-gate.gate-review { border-color:#806718; background:#1f1c12; }
    .lead-review-gate.gate-hold strong, .lead-review-gate.gate-review strong { color:#ffe58a; }
    .review-filter-bar { background:#121a24; border:1px solid #26384c; border-radius:10px; display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(128px,1fr)); margin:0 0 14px; padding:12px; text-align:left; }
    .review-filter-bar label { color:#8fa4b8; display:grid; gap:5px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0; }
    .review-filter-bar select { background:#16213e; border:1px solid #36506c; border-radius:7px; color:#f4f7fb; font-size:12px; padding:7px 8px; width:100%; }
    .review-filter-actions { align-self:end; display:flex; gap:8px; justify-content:flex-end; }
    .review-filter-actions button { min-height:33px; padding:6px 12px; white-space:nowrap; }
    .filter-empty-state { background:#121a24; border:1px dashed #566273; border-radius:10px; color:#9fb0c0; margin:14px 0; padding:18px; text-align:center; }
    .review-slice-band { background:#121a24; border:1px solid #26384c; border-radius:8px; display:grid; gap:10px; margin:0 0 16px; padding:12px; text-align:left; }
    .review-slice-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap; }
    .review-slice-head strong { color:#f4f7fb; font-size:13px; line-height:1.4; }
    .review-slice-head span { color:#8fa4b8; font-size:11px; line-height:1.5; }
    .review-slice-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .review-slice { border:1px solid #223447; border-radius:8px; background:#101925; min-width:0; padding:10px; }
    .review-slice strong { color:#f4f7fb; display:block; font-size:13px; line-height:1.4; }
    .review-slice span { color:#9fb0c0; display:block; font-size:11px; line-height:1.5; margin-top:4px; }
    .review-slice-risk strong { color:#ffe58a; }
    .review-slice-ready strong { color:#a8efc0; }
    .review-slice-caveat { border-top:1px solid #223447; color:#9fb0c0; font-size:12px; line-height:1.6; padding-top:10px; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .top-nav-links { display: flex; gap: 8px; }
    .status-select { padding: 4px 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 12px; cursor: pointer; }
    .notes-section { margin-top: 10px; }
    .notes-section summary { color: #aaa; font-size: 13px; cursor: pointer; }
    .notes-textarea { width: 100%; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #ccc; font-size: 13px; resize: vertical; margin-top: 6px; font-family: inherit; }
    .notes-saved { color: #27ae60; font-size: 11px; margin-left: 8px; opacity: 0; transition: opacity 0.3s; }
    .notes-saved.show { opacity: 1; }
    .csv-btn { margin-left: auto; }
    .view-tabs { display: flex; gap: 0; margin-bottom: 16px; }
    .view-tab { flex: 1; padding: 10px; text-align: center; font-size: 13px; font-weight: bold; color: #aaa; background: #1e2a3a; border: 1px solid #2a3a4a; cursor: pointer; transition: all 0.2s; }
    .view-tab:first-child { border-radius: 8px 0 0 8px; }
    .view-tab:last-child { border-radius: 0 8px 8px 0; }
    .view-tab.active { color: #fff; background: #e94560; border-color: #e94560; }
    .kanban-board { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 12px; min-height: 300px; }
    .kanban-col { min-width: 180px; flex: 1; background: #1a2332; border-radius: 10px; padding: 10px; }
    .kanban-col-header { font-size: 12px; font-weight: bold; color: #fff; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; text-align: center; }
    .kanban-col-count { font-size: 10px; color: rgba(255,255,255,0.7); margin-left: 4px; }
    .kanban-card { background: #1e2a3a; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; border-left: 3px solid transparent; }
    .kanban-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .kanban-card .k-company { font-size: 13px; font-weight: bold; color: #fff; margin-bottom: 4px; }
    .kanban-card .k-product { font-size: 11px; color: #aaa; margin-bottom: 6px; }
    .kanban-card .k-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
    .kanban-card .k-score { color: #e94560; font-weight: bold; }
    .kanban-card .k-followup { color: #aaa; font-size: 10px; }
    .kanban-card .k-review { color:#b7c6d8; font-size:10px; margin-top:6px; line-height:1.4; }
    .kanban-card.followup-warn { border-left-color: #e74c3c; }
    .kanban-card.followup-warn .k-followup { color: #e74c3c; font-weight: bold; }
    .kanban-card .k-value { color: #27ae60; font-size: 11px; }
    @media (max-width: 720px) {
      .lead-head { flex-direction:column; }
      .lead-badges { justify-content:flex-start; }
      .lead-metrics, .leads-summary { grid-template-columns:1fr; }
      .review-slice-grid { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <main class="container" style="max-width:700px;">
    <nav class="top-nav" aria-label="상단 이동">
      <a href="/" class="back-link">← 메인</a>
      <div class="top-nav-links">
        <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
        <a id="historyLink" href="/history" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">전체 히스토리</a>
        <button class="btn btn-secondary csv-btn" style="font-size:12px;padding:6px 12px;" onclick="downloadCSV()">CSV 내보내기</button>
      </div>
    </nav>
    <h1 style="font-size:22px;">리드 상세 보기</h1>
    <p class="subtitle">최근 분석된 영업 기회 목록</p>

    <div class="view-tabs">
      <div class="view-tab active" onclick="switchView('list')">리스트</div>
      <div class="view-tab" onclick="switchView('kanban')">칸반 보드</div>
    </div>

    <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;margin-bottom:12px;" onclick="window.print()">PDF 인쇄</button>

    <div class="batch-enrich-bar">
      <span>미분석 리드를 AI로 심층 분석합니다 (최대 3건/회)</span>
      <button class="btn-enrich" onclick="batchEnrich(this)">일괄 상세 분석</button>
    </div>
    <div id="batchStatus" style="font-size:12px;margin-bottom:12px;min-height:16px;"></div>

    <div id="reviewQueueFilters" class="review-filter-bar" aria-label="리드 검토 필터">
      <label>검토 상태
        <select data-filter-key="reviewStatus" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="NEW">새 검토</option>
          <option value="NEEDS_REVIEW">검토 필요</option>
          <option value="APPROVED">승인</option>
          <option value="REJECTED">반려</option>
          <option value="DEFERRED">보류</option>
        </select>
      </label>
      <label>검증 상태
        <select data-filter-key="verificationStatus" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="verified">검증됨</option>
          <option value="needs_review">검증 필요</option>
          <option value="draft">초안</option>
          <option value="unverified">미검증</option>
        </select>
      </label>
      <label>생성 방식
        <select data-filter-key="generationMode" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="llm">LLM 생성</option>
          <option value="heuristic">휴리스틱 생성</option>
          <option value="demo">데모</option>
          <option value="unavailable">생성 불가</option>
        </select>
      </label>
      <label>신뢰도
        <select data-filter-key="confidence" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
      </label>
      <label>데이터 공백
        <select data-filter-key="dataGaps" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="has">공백 있음</option>
          <option value="none">공백 없음</option>
        </select>
      </label>
      <div class="review-filter-actions">
        <button class="btn btn-secondary" type="button" onclick="resetReviewQueueFilters()">초기화</button>
      </div>
    </div>
    <div id="leadsSummary"></div>
    <div id="leadsList"><p style="color:#aaa;">로딩 중...</p></div>
    <div id="kanbanView" style="display:none;"></div>
  </main>

  <script>
    ${getEscScript()}
    ${getSafeUrlScript()}
    ${getStoredTokenScript()}
    function detailLink(leadId) {
      return '/leads/' + encodeURIComponent(leadId);
    }
    async function openLeadDetail(leadId, event) {
      if (!leadId) return;
      if (event) event.preventDefault();
      try {
        const href = detailLink(leadId);
        const res = await fetch(href, { headers: authHeaders() });
        const html = await res.text();
        if (!res.ok) { document.open(); document.write(html); document.close(); return; }
        history.pushState(null, '', href);
        document.open(); document.write(html); document.close();
      } catch(e) { window.location.href = detailLink(leadId); }
    }
    ${getProfileScript('danfoss')}

    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };
    const statusColors = { NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' };
    const transitions = { NEW: ['CONTACTED'], CONTACTED: ['MEETING'], MEETING: ['PROPOSAL'], PROPOSAL: ['NEGOTIATION'], NEGOTIATION: ['WON','LOST'], LOST: ['NEW'], WON: [] };
    const reviewStatusLabels = { NEW: '새 검토', NEEDS_REVIEW: '검토 필요', APPROVED: '승인', REJECTED: '반려', DEFERRED: '보류' };
    const reviewStatuses = Object.keys(reviewStatusLabels);
    const verificationStatusLabels = { verified: '검증됨', needs_review: '검증 필요', draft: '초안', unverified: '미검증' };
    const generationModeLabels = { llm: 'LLM 생성', heuristic: '휴리스틱 생성', demo: '데모', unavailable: '생성 불가' };
    const confidenceLabels = { HIGH: '신뢰도 HIGH', MEDIUM: '신뢰도 MEDIUM', LOW: '신뢰도 LOW' };
    const reviewQueueFilters = {
      reviewStatus: 'all',
      verificationStatus: 'all',
      generationMode: 'all',
      confidence: 'all',
      dataGaps: 'all'
    };

    function renderStatusSelect(lead) {
      if (!lead.id) return '';
      const current = lead.status || 'NEW';
      const allowed = transitions[current] || [];
      if (allowed.length === 0) return \`<span class="badge badge-status \${current.toLowerCase()}">\${esc(statusLabels[current])}</span>\`;
      const opts = [current, ...allowed].map(s =>
        \`<option value="\${s}" \${s === current ? 'selected' : ''}>\${esc(statusLabels[s] || s)}</option>\`
      ).join('');
      return \`<select class="status-select" onchange="updateStatus('\${esc(lead.id)}', this.value, '\${current}')">\${opts}</select>\`;
    }

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
      return \`<span class="badge badge-review \${current.toLowerCase()}">검토 \${esc(reviewStatusLabels[current])}</span>\`;
    }

    function renderVerificationBadge(lead) {
      const status = getVerificationStatus(lead);
      return \`<span class="badge badge-verification \${status}">\${esc(verificationStatusLabels[status])}</span>\`;
    }

    function renderGenerationBadge(lead) {
      const mode = getGenerationMode(lead);
      return \`<span class="badge badge-generation \${mode}">\${esc(generationModeLabels[mode])}</span>\`;
    }

    function renderConfidenceBadge(lead) {
      const confidence = getConfidence(lead);
      return \`<span class="badge badge-confidence \${confidence.toLowerCase()}">\${esc(confidenceLabels[confidence])}</span>\`;
    }

    function renderEvidenceSummary(lead) {
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const label = evidenceCount > 0 ? \`근거 \${evidenceCount}개\` : '직접 인용 없음';
      const evidenceClass = evidenceCount > 0 ? 'has_evidence' : 'missing_evidence';
      return \`<span class="badge badge-evidence \${evidenceClass}">\${esc(label)} / 출처 \${sourceCount}개</span>\`;
    }

    function renderReviewTrustBadges(lead) {
      return \`
        <span class="lead-review-meta">
          \${renderVerificationBadge(lead)}
          \${renderGenerationBadge(lead)}
          \${renderConfidenceBadge(lead)}
          \${renderEvidenceSummary(lead)}
        </span>
      \`;
    }

    function renderDataGapSummary(lead) {
      const gaps = getDataGaps(lead);
      if (gaps.length === 0) {
        return '<div class="lead-block data-gap-clear"><span class="block-label">데이터 공백</span><div class="block-value">확인된 데이터 공백 없음</div></div>';
      }
      const shown = gaps.slice(0, 2).map((gap) => esc(gap)).join(', ');
      const extra = gaps.length > 2 ? ' 외 ' + (gaps.length - 2) + '건' : '';
      return \`<div class="lead-block data-gap-summary"><span class="block-label">데이터 공백 \${gaps.length}건</span><div class="block-value">\${shown}\${extra}</div></div>\`;
    }

    function buildLeadListReviewGate(lead) {
      const reviewStatus = getReviewStatus(lead);
      const verificationStatus = getVerificationStatus(lead);
      const confidence = getConfidence(lead);
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const dataGapCount = getDataGaps(lead).length;
      let state = 'review';
      let label = '목록 게이트 보강 필요';

      if (reviewStatus === 'REJECTED') {
        state = 'blocked';
        label = '목록 게이트 차단';
      } else if (reviewStatus === 'DEFERRED') {
        state = 'hold';
        label = '목록 게이트 보류';
      } else if (
        reviewStatus === 'APPROVED'
        && verificationStatus === 'verified'
        && confidence !== 'LOW'
        && evidenceCount > 0
        && sourceCount > 0
        && dataGapCount === 0
      ) {
        state = 'ready';
        label = '목록 게이트 통과';
      }

      return {
        state,
        label,
        items: [
          '검토 ' + (reviewStatusLabels[reviewStatus] || reviewStatus),
          verificationStatusLabels[verificationStatus] || verificationStatus,
          confidenceLabels[confidence] || ('신뢰도 ' + confidence),
          evidenceCount > 0 ? '근거 ' + evidenceCount + '개 / 출처 ' + sourceCount + '개' : '직접 인용 없음 / 출처 ' + sourceCount + '개',
          dataGapCount === 0 ? '데이터 공백 없음' : '데이터 공백 ' + dataGapCount + '건',
        ],
      };
    }

    function renderLeadListReviewGate(lead) {
      const gate = buildLeadListReviewGate(lead);
      return \`
        <div class="lead-review-gate gate-\${gate.state}" aria-label="목록 품질 게이트">
          <span class="block-label">목록 품질 게이트</span>
          <strong>\${esc(gate.label)}</strong>
          <div class="lead-review-gate-items">
            \${gate.items.map((item) => \`<span>\${esc(item)}</span>\`).join('')}
          </div>
          <p>This list gate does not approve outreach; it only prioritizes human review.</p>
        </div>
      \`;
    }

    function renderReviewStatusSelect(lead) {
      const current = getReviewStatus(lead);
      const opts = reviewStatuses.map(s =>
        \`<option value="\${s}" \${s === current ? 'selected' : ''}>\${esc(reviewStatusLabels[s])}</option>\`
      ).join('');
      if (!lead.id) return \`<span class="badge badge-review \${current.toLowerCase()}">\${esc(reviewStatusLabels[current])}</span>\`;
      return \`<select class="status-select" aria-label="검토 상태" onchange="updateReviewStatus('\${esc(lead.id)}', this.value, '\${current}')">\${opts}</select>\`;
    }

    function buildReviewEvidenceSlices(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const missingEvidence = list.filter((lead) => getEvidenceItems(lead).length === 0 || getSources(lead).length === 0).length;
      const dataGapLeads = list.filter((lead) => getDataGaps(lead).length > 0).length;
      const reviewReady = list.filter((lead) => (
        getEvidenceItems(lead).length > 0
        && getSources(lead).length > 0
        && getDataGaps(lead).length === 0
        && getVerificationStatus(lead) === 'verified'
        && getConfidence(lead) !== 'LOW'
      )).length;
      const guidance = missingEvidence > 0 || dataGapLeads > 0
        ? '직접 근거와 데이터 공백이 있는 리드를 먼저 보강하세요.'
        : '근거와 데이터 공백 기준으로 검토 가능한 상태입니다.';

      return {
        missingEvidence,
        dataGapLeads,
        reviewReady,
        guidance,
      };
    }

    function renderReviewEvidenceSlices(leads) {
      const slices = buildReviewEvidenceSlices(leads);
      return \`
        <section class="review-slice-band" aria-label="검토 리스크">
          <div class="review-slice-head">
            <strong>검토 리스크</strong>
            <span>\${esc(slices.guidance)}</span>
          </div>
          <div class="review-slice-grid">
            <div class="review-slice review-slice-risk"><strong>근거 누락 \${slices.missingEvidence}건</strong><span>직접 인용 또는 출처 보강 필요</span></div>
            <div class="review-slice review-slice-risk"><strong>데이터 공백 리드 \${slices.dataGapLeads}건</strong><span>의사결정자, 예산, 일정 등 확인 필요</span></div>
            <div class="review-slice review-slice-ready"><strong>검토 가능 \${slices.reviewReady}건</strong><span>근거와 검증 상태가 정리된 리드</span></div>
          </div>
          <div class="review-slice-caveat">This slice does not approve outreach; it only prioritizes human review.</div>
        </section>
      \`;
    }

    function applyReviewQueueFilters(leads) {
      return (Array.isArray(leads) ? leads : []).filter((lead) => {
        if (reviewQueueFilters.reviewStatus !== 'all' && getReviewStatus(lead) !== reviewQueueFilters.reviewStatus) return false;
        if (reviewQueueFilters.verificationStatus !== 'all' && getVerificationStatus(lead) !== reviewQueueFilters.verificationStatus) return false;
        if (reviewQueueFilters.generationMode !== 'all' && getGenerationMode(lead) !== reviewQueueFilters.generationMode) return false;
        if (reviewQueueFilters.confidence !== 'all' && getConfidence(lead) !== reviewQueueFilters.confidence) return false;
        const gapCount = getDataGaps(lead).length;
        if (reviewQueueFilters.dataGaps === 'has' && gapCount === 0) return false;
        if (reviewQueueFilters.dataGaps === 'none' && gapCount > 0) return false;
        return true;
      });
    }

    function getFilteredLeads() {
      return applyReviewQueueFilters(cachedLeads);
    }

    function setReviewQueueFilter(select) {
      const key = select && select.dataset ? select.dataset.filterKey : '';
      if (!Object.prototype.hasOwnProperty.call(reviewQueueFilters, key)) return;
      reviewQueueFilters[key] = select.value || 'all';
      renderCurrentLeads();
    }

    function resetReviewQueueFilters() {
      Object.keys(reviewQueueFilters).forEach((key) => { reviewQueueFilters[key] = 'all'; });
      document.querySelectorAll('#reviewQueueFilters [data-filter-key]').forEach((select) => { select.value = 'all'; });
      renderCurrentLeads();
    }

    async function updateStatus(leadId, newStatus, fromStatus) {
      if (newStatus === fromStatus) return;
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); loadLeads(); return; }
        loadLeads();
      } catch(e) { alert('상태 변경 실패: ' + e.message); }
    }

    async function updateReviewStatus(leadId, newStatus, fromStatus) {
      if (newStatus === fromStatus) return;
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ reviewStatus: newStatus })
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); loadLeads(); return; }
        loadLeads();
      } catch(e) { alert('검토 상태 변경 실패: ' + e.message); }
    }

    let saveTimers = {};
    function scheduleNoteSave(leadId, textarea) {
      clearTimeout(saveTimers[leadId]);
      saveTimers[leadId] = setTimeout(() => saveNotes(leadId, textarea), 800);
    }

    async function saveNotes(leadId, textarea) {
      const indicator = textarea.parentElement.querySelector('.notes-saved');
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ notes: textarea.value })
        });
        const data = await res.json();
        if (data.success && indicator) {
          indicator.classList.add('show');
          setTimeout(() => indicator.classList.remove('show'), 2000);
        }
      } catch { /* silent */ }
    }

    async function downloadCSV() {
      try {
        const res = await fetch('/api/export/csv?profile=' + encodeURIComponent(getProfile()), { headers: authHeaders() });
        if (!res.ok) { alert('CSV 다운로드 실패'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leads-' + getProfile() + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch(e) { alert('CSV 다운로드 실패: ' + e.message); }
    }

    async function enrichLead(leadId, btn, force) {
      if (!leadId) return;
      btn.disabled = true;
      btn.textContent = '분석 중...';
      try {
        const forceParam = force ? '?force=true' : '';
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId) + '/enrich' + forceParam, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() }
        });
        const data = await res.json();
        if (!data.success) { alert(data.message || '분석 실패'); btn.disabled = false; btn.textContent = '상세 분석'; return; }
        loadLeads();
      } catch(e) { alert('분석 실패: ' + e.message); btn.disabled = false; btn.textContent = '상세 분석'; }
    }

    async function batchEnrich(btn) {
      btn.disabled = true;
      btn.textContent = '일괄 분석 중...';
      const statusEl = document.getElementById('batchStatus');
      statusEl.textContent = 'AI가 리드를 심층 분석하고 있습니다...';
      statusEl.style.color = '#3498db';
      try {
        const res = await fetch('/api/leads/batch-enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ profile: getProfile() })
        });
        const data = await res.json();
        if (data.success) {
          statusEl.textContent = '완료: ' + data.enriched + '건 분석, ' + (data.failed || 0) + '건 실패, 잔여 ' + data.remaining + '건';
          statusEl.style.color = '#27ae60';
        } else {
          statusEl.textContent = data.message || '분석 실패';
          statusEl.style.color = '#e74c3c';
        }
        loadLeads();
      } catch(e) {
        statusEl.textContent = '오류: ' + e.message;
        statusEl.style.color = '#e74c3c';
      }
      btn.disabled = false;
      btn.textContent = '일괄 상세 분석';
    }

    async function loadLeads() {
      try {
        const res = await fetch('/api/leads?profile=' + getProfile(), {headers:authHeaders()});
        const data = await res.json();
        const container = document.getElementById('leadsList');
        const summaryContainer = document.getElementById('leadsSummary');

        if (!data.leads || data.leads.length === 0) {
          summaryContainer.innerHTML = '';
          container.innerHTML = '<p style="color:#aaa;">아직 생성된 리드가 없습니다. 메인 페이지에서 보고서를 먼저 생성하세요.</p>';
          cachedLeads = [];
          if (currentView === 'kanban') renderKanban([]);
          return;
        }

        cachedLeads = data.leads;
        renderCurrentLeads();
      } catch(e) {
        document.getElementById('leadsList').innerHTML = '<p style="color:#e74c3c;">데이터 로드 실패: ' + esc(e.message) + '</p>';
      }
    }
    let currentView = 'list';
    let cachedLeads = [];

    function renderCurrentLeads() {
      const container = document.getElementById('leadsList');
      const summaryContainer = document.getElementById('leadsSummary');
      const filteredLeads = getFilteredLeads();
      summaryContainer.innerHTML = renderLeadsSummary(filteredLeads, cachedLeads.length) + renderReviewEvidenceSlices(filteredLeads);
      if (currentView === 'kanban') renderKanban(filteredLeads);

      if (filteredLeads.length === 0) {
        container.innerHTML = '<div class="filter-empty-state">필터 결과가 없습니다. 필터를 초기화하거나 다른 조건을 선택하세요.</div>';
        return;
      }

      container.innerHTML = filteredLeads.map((lead, i) => \`
          <div class="lead-card \${lead.grade === 'A' ? 'grade-a' : lead.grade === 'B' ? 'grade-b' : ''}">
            <div class="lead-head">
              <div class="lead-title">
                <h3>\${lead.id ? \`<a href="\${detailLink(lead.id)}" onclick="openLeadDetail('\${esc(lead.id)}', event)" style="color:inherit;text-decoration:none;">\${esc(lead.company)}</a>\` : esc(lead.company)}</h3>
                <div class="lead-subtitle">\${esc(lead.signal || lead.summary || '-')}</div>
                <div class="lead-status-row">
                  <span class="badge \${lead.grade === 'A' ? 'badge-a' : 'badge-b'}">\${esc(lead.grade)}등급</span>
                  \${renderReviewBadge(lead)}
                  <span class="select-label">검토 변경</span>
                  \${renderReviewStatusSelect(lead)}
                  <span class="select-label">영업 상태</span>
                  \${renderStatusSelect(lead)}
                  \${lead.enriched ? '<span class="badge-enriched">심층 분석 완료</span>' : ''}
                </div>
                \${renderReviewTrustBadges(lead)}
              </div>
              <div class="lead-badges">
                <span class="badge badge-a" style="background:#3498db;">\${parseInt(lead.score) || 0}점</span>
                \${lead.urgency ? \`<span class="badge" style="background:\${lead.urgency === 'HIGH' ? '#e74c3c' : '#f39c12'};color:#fff;">\${lead.urgency === 'HIGH' ? '긴급' : '보통'}</span>\` : ''}
                \${lead.eventType ? \`<span class="badge" style="background:#243547;color:#c5d5e6;">\${esc(lead.eventType)}</span>\` : ''}
              </div>
            </div>
            <div class="lead-metrics">
              <div class="lead-metric"><span class="metric-label">추천 제품</span><span class="metric-value">\${esc(lead.product || '-')}</span></div>
              <div class="lead-metric"><span class="metric-label">예상 ROI</span><span class="metric-value">\${esc(lead.roi) || '-'}</span></div>
              \${lead.buyerRole ? \`<div class="lead-metric"><span class="metric-label">예상 키맨</span><span class="metric-value">\${esc(lead.buyerRole)}</span></div>\` : ''}
              \${lead.followUpDate ? \`<div class="lead-metric"><span class="metric-label">후속 일정</span><span class="metric-value">\${esc(lead.followUpDate)}</span></div>\` : ''}
            </div>
            <div class="lead-sections">
              \${lead.whyNow ? \`<div class="lead-block"><span class="block-label">왜 지금</span><div class="block-value">\${esc(lead.whyNow)}</div></div>\` : ''}
              \${lead.urgencyReason ? \`<div class="lead-block"><span class="block-label">우선순위 근거</span><div class="block-value">\${esc(lead.urgencyReason)}</div></div>\` : ''}
              \${lead.confidenceReason ? \`<div class="lead-block"><span class="block-label">신뢰도 근거</span><div class="block-value">\${esc(lead.confidenceReason)}</div></div>\` : ''}
              \${renderLeadListReviewGate(lead)}
              \${renderDataGapSummary(lead)}
              \${lead.assumptions && lead.assumptions.length > 0 ? \`<div class="lead-block"><span class="block-label">가정</span><div class="block-value">\${esc(lead.assumptions.join(', '))}</div></div>\` : ''}
              \${lead.scoreReason ? \`<div class="lead-block"><span class="block-label">점수 해설</span><div class="block-value">\${esc(lead.scoreReason)}</div></div>\` : ''}
              <div class="lead-block"><span class="block-label">추천 메시지</span><div class="block-value">\${esc(lead.recommendedMessage || lead.salesPitch)}</div></div>
              <div class="lead-block"><span class="block-label">시장 트렌드</span><div class="block-value">\${esc(lead.globalContext) || '-'}</div></div>
            </div>
            \${lead.enriched ? \`
            <div class="enriched-details">
              <details>
                <summary>심층 분석 상세 보기</summary>
                <div class="enriched-content">
                  \${lead.keyFigures && lead.keyFigures.length > 0 ? \`<div class="enriched-block"><h4>핵심 수치</h4><ul>\${lead.keyFigures.map(f => \`<li>\${esc(f)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.painPoints && lead.painPoints.length > 0 ? \`<div class="enriched-block"><h4>고객 과제 (정량)</h4><ul>\${lead.painPoints.map(p => \`<li>\${esc(p)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.actionItems && lead.actionItems.length > 0 ? \`<div class="enriched-block"><h4>후속 실행 항목</h4><ul>\${lead.actionItems.map(a => \`<li>\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.meddic && Object.keys(lead.meddic).length > 0 ? \`<div class="enriched-block"><h4>MEDDIC 분석</h4><ul>
                    \${lead.meddic.budget ? \`<li><strong>예산:</strong> \${esc(lead.meddic.budget)}</li>\` : ''}
                    \${lead.meddic.authority ? \`<li><strong>의사결정:</strong> \${esc(lead.meddic.authority)}</li>\` : ''}
                    \${lead.meddic.need ? \`<li><strong>핵심 니즈:</strong> \${esc(lead.meddic.need)}</li>\` : ''}
                    \${lead.meddic.timeline ? \`<li><strong>타임라인:</strong> \${esc(lead.meddic.timeline)}</li>\` : ''}
                    \${lead.meddic.decisionProcess ? \`<li><strong>구매 프로세스:</strong> \${esc(lead.meddic.decisionProcess)}</li>\` : ''}
                    \${lead.meddic.champion ? \`<li><strong>챔피언:</strong> \${esc(lead.meddic.champion)}</li>\` : ''}
                  </ul></div>\` : ''}
                  \${lead.competitive && Object.keys(lead.competitive).length > 0 ? \`<div class="enriched-block"><h4>경쟁 인텔리전스</h4><ul>
                    \${lead.competitive.currentVendor ? \`<li><strong>현재 벤더:</strong> \${esc(lead.competitive.currentVendor)}</li>\` : ''}
                    \${lead.competitive.competitors ? \`<li><strong>경쟁사:</strong> \${esc(lead.competitive.competitors)}</li>\` : ''}
                    \${lead.competitive.ourAdvantage ? \`<li><strong>우리 차별점:</strong> \${esc(lead.competitive.ourAdvantage)}</li>\` : ''}
                    \${lead.competitive.switchBarrier ? \`<li><strong>전환 장벽:</strong> \${esc(lead.competitive.switchBarrier)}</li>\` : ''}
                  </ul></div>\` : ''}
                  \${lead.buyingSignals && lead.buyingSignals.length > 0 ? \`<div class="enriched-block"><h4>구매 신호</h4><ul>\${lead.buyingSignals.map(s => \`<li>\${esc(s)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.evidence && lead.evidence.length > 0 ? \`<div class="enriched-block"><h4>근거 (Evidence)</h4><ul>\${lead.evidence.map(e => \`<li><strong>[\${esc(e.field)}]</strong> "\${esc(e.quote)}" \${e.sourceUrl ? \`<a href="\${safeUrl(e.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#3498db;font-size:11px;">출처</a>\` : ''}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.assumptions && lead.assumptions.length > 0 ? \`<div class="enriched-block" style="background:#fff3cd;border-left:3px solid #f39c12;padding:8px 12px;"><h4 style="color:#856404;">가정 (Assumptions)</h4><ul>\${lead.assumptions.map(a => \`<li style="color:#856404;">\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.enrichedAt ? \`<p style="color:#666;font-size:11px;margin-top:8px;">분석일: \${esc(lead.enrichedAt.split('T')[0])}</p>\` : ''}
                </div>
              </details>
            </div>\` : ''}
            \${lead.sources && lead.sources.length > 0 ? \`
            <div class="lead-sources">
              <details>
                <summary>출처 보기 (\${lead.sources.length}건)</summary>
                <ul>
                  \${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}
                </ul>
              </details>
            </div>\` : ''}
            \${lead.id ? \`
            <div class="notes-section">
              <details>
                <summary>메모 \${lead.notes ? '(작성됨)' : ''}<span class="notes-saved">저장됨</span></summary>
                <textarea class="notes-textarea" placeholder="메모를 입력하세요..."
                  oninput="scheduleNoteSave('\${esc(lead.id)}', this)"
                  onblur="saveNotes('\${esc(lead.id)}', this)">\${esc(lead.notes || '')}</textarea>
              </details>
            </div>\` : ''}
            <div class="lead-actions">
              <a href="/ppt?profile=\${encodeURIComponent(getProfile())}&lead=\${i}" class="btn btn-secondary">PPT 생성</a>
              <a href="/roleplay?profile=\${encodeURIComponent(getProfile())}&lead=\${i}" class="btn btn-secondary">영업 연습</a>
              \${lead.id && !lead.enriched ? \`<button class="btn-enrich" onclick="enrichLead('\${esc(lead.id)}', this)">상세 분석</button>\` : ''}
              \${lead.id && lead.enriched ? \`<button class="btn-enrich" style="opacity:0.6" onclick="enrichLead('\${esc(lead.id)}', this, true)" title="재분석">재분석</button>\` : ''}
            </div>
          </div>
        \`).join('');
    }

    function switchView(view) {
      currentView = view;
      document.querySelectorAll('.view-tab').forEach((t, i) => {
        t.classList.toggle('active', (i === 0 && view === 'list') || (i === 1 && view === 'kanban'));
      });
      document.getElementById('leadsList').style.display = view === 'list' ? '' : 'none';
      document.getElementById('kanbanView').style.display = view === 'kanban' ? '' : 'none';
      const container = document.querySelector('.container');
      container.style.maxWidth = view === 'kanban' ? '1400px' : '700px';
      if (view === 'kanban') renderKanban(getFilteredLeads());
    }

    function renderKanban(leads) {
      const order = ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON','LOST'];
      const groups = {};
      order.forEach(s => groups[s] = []);
      leads.forEach(l => { const s = l.status || 'NEW'; if (groups[s]) groups[s].push(l); });

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      let html = '<div class="kanban-board" style="max-width:100%;overflow-x:auto;">';
      order.forEach(s => {
        const cards = groups[s];
        html += '<div class="kanban-col">';
        html += '<div class="kanban-col-header" style="background:' + statusColors[s] + '">' + esc(statusLabels[s]) + '<span class="kanban-col-count">(' + cards.length + ')</span></div>';
        cards.forEach(l => {
          const fu = l.followUpDate || '';
          const isWarn = fu && fu <= today;
          html += '<div class="kanban-card' + (isWarn ? ' followup-warn' : '') + '" onclick="openLeadDetail(\\'' + esc(l.id) + '\\', event)">';
          html += '<div class="k-company">' + esc(l.company) + '</div>';
          html += '<div class="k-product">' + esc(l.product || l.summary || '-') + '</div>';
          html += '<div class="k-meta">';
          html += '<span class="k-score">' + esc(l.grade) + ' ' + l.score + '점</span>';
          if (l.estimatedValue) html += '<span class="k-value">' + l.estimatedValue.toLocaleString() + '만</span>';
          html += '</div>';
          if (fu) {
            html += '<div class="k-followup">' + (isWarn ? '⚠ ' : '') + esc(fu) + '</div>';
          }
          html += '<div class="k-review">' + esc(reviewStatusLabels[getReviewStatus(l)]) + ' / ' + esc(verificationStatusLabels[getVerificationStatus(l)]) + '</div>';
          html += '</div>';
        });
        if (cards.length === 0) html += '<p style="color:#555;font-size:11px;text-align:center;padding:20px 0;">없음</p>';
        html += '</div>';
      });
      html += '</div>';
      document.getElementById('kanbanView').innerHTML = html;
    }

    function renderLeadsSummary(leads, totalBeforeFilter = leads.length) {
      const total = leads.length;
      const gradeA = leads.filter(l => l.grade === 'A').length;
      const enriched = leads.filter(l => l.enriched).length;
      const needsReview = leads.filter(l => getReviewStatus(l) === 'NEEDS_REVIEW').length;
      const verified = leads.filter(l => getVerificationStatus(l) === 'verified').length;
      const dataGapCount = leads.reduce((sum, lead) => sum + getDataGaps(lead).length, 0);
      const avgScore = Math.round(leads.reduce((sum, lead) => sum + (parseInt(lead.score, 10) || 0), 0) / Math.max(1, total));
      return \`
        <div class="leads-summary">
          <div class="summary-card"><span class="label">필터 결과</span><span class="value">\${total}</span><div class="meta">전체 \${totalBeforeFilter}건 중 표시</div></div>
          <div class="summary-card"><span class="label">검토 필요</span><span class="value">\${needsReview}</span><div class="meta">사람 검토 전 상태</div></div>
          <div class="summary-card"><span class="label">검증됨</span><span class="value">\${verified}</span><div class="meta">공개 근거 확인 리드</div></div>
          <div class="summary-card"><span class="label">A등급</span><span class="value">\${gradeA}</span><div class="meta">우선 검토 후보</div></div>
          <div class="summary-card"><span class="label">평균 점수</span><span class="value">\${avgScore}</span><div class="meta">기사 신호 기준 평균</div></div>
          <div class="summary-card"><span class="label">데이터 공백</span><span class="value">\${dataGapCount}</span><div class="meta">검토 중 확인할 항목</div></div>
          <div class="summary-card"><span class="label">심층 분석 완료</span><span class="value">\${enriched}</span><div class="meta">추가 근거가 확보된 리드</div></div>
        </div>
      \`;
    }

    document.getElementById('historyLink').href = '/history?profile=' + encodeURIComponent(getProfile());
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    window.setReviewQueueFilter = setReviewQueueFilter;
    window.resetReviewQueueFilters = resetReviewQueueFilters;

    loadLeads();
  </script>
</body>
</html>`;
}
