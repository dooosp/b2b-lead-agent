export const WORKBENCH_HTML_MAX_BYTES = 512 * 1024;

const CLAIM_TYPES = Object.freeze([
  'PRODUCT_CAPABILITY',
  'PERFORMANCE',
  'CERTIFICATION',
  'TECHNICAL_REQUIREMENT'
]);

const VALUE_TYPES = Object.freeze(['QUANTITY', 'RANGE', 'ENUM', 'STRING_SET']);

const DECISIONS = Object.freeze([
  ['APPROVE_FOR_REPOSITORY_REVIEW', '저장소 검토 요청으로 승인'],
  ['REJECT', '거부'],
  ['DEFER_MISSING_CONTEXT', '문맥 부족으로 보류'],
  ['FLAG_CONFLICT', '충돌로 표시'],
  ['FLAG_SUPERSEDED', '신규 개정본 존재로 표시'],
  ['FLAG_SOURCE_AUTHENTICITY', '출처 진위성 검토로 표시']
]);

export function escapeWorkbenchHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function text(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function renderOptions(values, selected = '') {
  return values.map((value) => `<option value="${escapeWorkbenchHtml(value)}"${value === selected ? ' selected' : ''}>${escapeWorkbenchHtml(value)}</option>`).join('');
}

function renderDocumentQueue(documents) {
  if (!documents.length) {
    return '<p id="document-empty" class="empty-state">검토할 문서가 없습니다. 입력 번들 감사를 먼저 실행하세요.</p>';
  }
  return `<ol id="document-list" class="document-list">${documents.map((document, index) => {
    const id = text(document.documentId ?? document.id, `document-${index + 1}`);
    const title = text(document.title, '제목 없음');
    const publisher = text(document.publisher, '발행자 미상');
    const revision = text(document.revision, '개정 미상');
    return `<li><button class="document-card" type="button" data-document-id="${escapeWorkbenchHtml(id)}"${index === 0 ? ' aria-current="true"' : ''}>
      <span class="document-title">${escapeWorkbenchHtml(title)}</span>
      <span>${escapeWorkbenchHtml(publisher)} · ${escapeWorkbenchHtml(revision)}</span>
      <span>${document.synthetic === false ? 'REAL_MANIFEST_BOUND' : 'SYNTHETIC_FIXTURE'}</span>
      <span class="document-state">REVIEW_REQUIRED</span>
    </button></li>`;
  }).join('')}</ol>`;
}

function renderDecisionChoices() {
  return DECISIONS.map(([value, label]) => `<label class="choice-card"><input type="radio" name="review-decision" value="${value}"><span>${escapeWorkbenchHtml(label)}<br><code>${value}</code></span></label>`).join('');
}

function renderPageShell({ title, capabilityToken, documents, body, loadError = false }) {
  const token = typeof capabilityToken === 'string' ? capabilityToken : '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw new TypeError('WORKBENCH_CAPABILITY_TOKEN_INVALID');
  const html = `<!doctype html>
<html lang="ko"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="workbench-capability" content="${escapeWorkbenchHtml(token)}">
  <title>${escapeWorkbenchHtml(title)}</title>
  <link rel="stylesheet" href="/assets/styles.css">
  <script type="module" src="/assets/app.js"></script>
</head><body${loadError ? ' data-load-error="true"' : ''}>
  <a class="skip-link" href="#workbench-main">본문으로 건너뛰기</a>
  <header class="site-header">
    <div><p class="eyebrow">LOCAL / REVIEW-ONLY / SOUTH KOREA</p><p class="site-title">Official Evidence Claim Review Workbench v0</p></div>
    <p class="header-boundary">Issue #165: HOLD · productionReady: false · 자동 검증: 금지</p>
  </header>
  <section class="boundary-banner" aria-label="비생산 검토 경계">
    <strong>NOT_PRODUCTION_EVIDENCE</strong>
    <span>이 화면은 저장소 검토 패치만 만듭니다. 결과는 항상 <code>UNVERIFIED</code> / <code>BLOCKED</code>입니다.</span>
  </section>
  ${body({ documents })}
  <div id="workbench-status" class="sr-status" role="status" aria-live="polite" aria-atomic="true"></div>
</body></html>`;
  if (Buffer.byteLength(html, 'utf8') > WORKBENCH_HTML_MAX_BYTES) throw new TypeError('WORKBENCH_HTML_TOO_LARGE');
  return html;
}

function renderMain({ documents }) {
  return `<main id="workbench-main" aria-labelledby="workbench-heading">
    <section class="intro" aria-labelledby="workbench-heading">
      <p class="eyebrow">데이터센터 · 전기 전력 · KR · KO/EN</p>
      <h1 id="workbench-heading" tabindex="-1">공식 문서에서 검토 가능한 Claim으로</h1>
      <p>원문을 확인하고 정확한 인용문을 고른 다음, 정형 필드와 사람의 결정을 패치로 남깁니다. PDF 바이너리는 표시하지 않습니다.</p>
    </section>
    <div class="workbench-layout">
      <nav class="panel document-panel" aria-labelledby="document-queue-heading">
        <div class="panel-heading"><p class="step">1</p><div><h2 id="document-queue-heading">문서 큐</h2><p>버전과 해시를 먼저 확인하세요.</p></div></div>
        ${renderDocumentQueue(documents)}
      </nav>

      <section class="panel evidence-panel" aria-labelledby="evidence-heading">
        <div class="panel-heading"><p class="step">2</p><div><h2 id="evidence-heading" tabindex="-1">페이지 근거</h2><p>정확히 일치하는 직접 인용만 선택하세요.</p></div></div>
        <div id="evidence-errors" class="error-summary" role="alert" tabindex="-1" hidden></div>
        <div class="page-controls">
          <label for="page-select">페이지</label>
          <select id="page-select" autocomplete="off" disabled><option>문서를 선택하세요</option></select>
        </div>
        <section aria-labelledby="source-heading"><h3 id="source-heading">출처 메타데이터</h3><dl id="source-metadata" class="metadata-grid"><div><dt>상태</dt><dd>REVIEW_REQUIRED</dd></div></dl></section>
        <section aria-labelledby="page-text-heading"><h3 id="page-text-heading">정규화된 페이지 텍스트</h3><pre id="page-text" class="page-text" tabindex="0">문서와 페이지를 선택하면 읽기 전용 텍스트가 표시됩니다.</pre></section>
        <section aria-labelledby="candidate-suggestions-heading"><h3 id="candidate-suggestions-heading">결정적 후보 제안</h3><div id="candidate-list" class="candidate-list"><p class="empty-state">선택한 페이지의 제안이 여기에 표시됩니다.</p></div></section>
      </section>

      <section class="panel review-panel" aria-labelledby="review-heading">
        <div class="panel-heading"><p class="step">3</p><div><h2 id="review-heading" tabindex="-1">정형 검토</h2><p>자동 승인 없이 사람의 결정을 기록합니다.</p></div></div>
        <aside class="source-rail" aria-labelledby="source-rail-heading">
          <h3 id="source-rail-heading">선택한 출처 · 개정 · 페이지 · 인용</h3>
          <dl><div><dt>발행자</dt><dd id="rail-publisher">선택 안 됨</dd></div><div><dt>문서 제목</dt><dd id="rail-document">선택 안 됨</dd></div><div><dt>문서 번호</dt><dd id="rail-document-number">—</dd></div><div><dt>개정</dt><dd id="rail-revision">—</dd></div><div><dt>추출 페이지</dt><dd id="rail-page">—</dd></div><div><dt>인쇄 페이지/섹션</dt><dd id="rail-locator">미입력 — 차단</dd></div><div><dt>앞 문맥</dt><dd id="rail-context-before">—</dd></div><div><dt>직접 인용</dt><dd><q id="rail-quote">선택 안 됨</q></dd></div><div><dt>뒤 문맥</dt><dd id="rail-context-after">—</dd></div><div><dt>코드 포인트 범위</dt><dd id="rail-offsets">—</dd></div><div><dt>인용 출현</dt><dd id="rail-occurrence">—</dd></div></dl>
        </aside>
        <form id="candidate-form" autocomplete="off" novalidate>
          <div id="review-errors" class="error-summary" role="alert" tabindex="-1" hidden></div>
          <fieldset><legend>Claim 정형 필드</legend>
            <div class="form-grid">
              <label>Claim 유형<select id="claim-type" required>${renderOptions(CLAIM_TYPES)}</select></label>
              <label>제품 군<select id="product-family" required><option value="medium_voltage_switchgear">medium_voltage_switchgear</option><option value="transformer">transformer</option></select></label>
              <label>기능 항목 <span class="secondary">(코드는 보조 표시)</span><select id="capability-key" required><option value="rated_voltage">정격 전압 — rated_voltage</option><option value="rated_current">정격 전류 — rated_current</option><option value="short_circuit_rating">단락 정격 — short_circuit_rating</option><option value="frequency">주파수 — frequency</option><option value="insulation_medium">절연 매체 — insulation_medium</option><option value="indoor_outdoor_use">옥내/옥외 — indoor_outdoor_use</option><option value="ingress_protection">보호 등급 — ingress_protection</option><option value="ambient_temperature">주위 온도 — ambient_temperature</option><option value="altitude">표고 — altitude</option><option value="applicable_standard">적용 표준 — applicable_standard</option><option value="certification">인증 — certification</option><option value="communication_protocol">통신 프로토콜 — communication_protocol</option><option value="installation_condition">설치 조건 — installation_condition</option></select></label>
              <label>값 유형<select id="value-type" required>${renderOptions(VALUE_TYPES)}</select></label>
              <label id="value-field">값<input id="candidate-value" type="text" maxlength="160" required></label>
              <label id="minimum-field" hidden>최솟값<input id="candidate-minimum" type="number" step="any"></label>
              <label id="maximum-field" hidden>최댓값<input id="candidate-maximum" type="number" step="any"></label>
              <label>단위<select id="candidate-unit"><option value="">UNIT_NOT_APPLICABLE</option><optgroup label="전압"><option value="V">V</option><option value="kV">kV</option></optgroup><optgroup label="전류"><option value="A">A</option><option value="kA">kA</option></optgroup><optgroup label="용량"><option value="kVA">kVA</option><option value="MVA">MVA</option></optgroup><optgroup label="주파수"><option value="Hz">Hz</option></optgroup><optgroup label="온도"><option value="degC">degC</option></optgroup><optgroup label="길이/표고"><option value="m">m</option><option value="mm">mm</option></optgroup><optgroup label="비율"><option value="%">%</option></optgroup></select></label>
              <label>적용 조건 항목<select id="condition-key"><option value="">NONE</option><option value="altitude">altitude</option><option value="ambient_temperature">ambient_temperature</option><option value="configuration">configuration</option><option value="cooling_method">cooling_method</option><option value="frequency">frequency</option><option value="installation">installation</option><option value="installation_condition">installation_condition</option><option value="insulation_medium">insulation_medium</option><option value="operating_condition">operating_condition</option><option value="product_variant">product_variant</option><option value="standard_edition">standard_edition</option></select></label>
              <label>적용 조건 값<select id="condition-value"><option value="">NONE</option><option value="50_HZ">50_HZ</option><option value="60_HZ">60_HZ</option><option value="INDOOR">INDOOR</option><option value="OUTDOOR">OUTDOOR</option><option value="indoor_only">indoor_only</option><option value="outdoor_only">outdoor_only</option><option value="maximum_1000_m">maximum_1000_m</option><option value="document_stated_range">document_stated_range</option><option value="AT_RATED_LOAD">AT_RATED_LOAD</option><option value="AT_50_PERCENT_LOAD">AT_50_PERCENT_LOAD</option><option value="ONAN">ONAN</option><option value="ONAF">ONAF</option><option value="STANDARD_SERVICE_CONDITIONS">STANDARD_SERVICE_CONDITIONS</option></select></label>
              <label>관할<select id="jurisdiction" required><option value="KR">KR</option></select></label>
              <label>단계<select id="project-stage" required><option value="UNKNOWN">UNKNOWN</option><option value="SIGNAL">SIGNAL</option><option value="ANNOUNCED">ANNOUNCED</option><option value="FEASIBILITY">FEASIBILITY</option><option value="BASIC_DESIGN">BASIC_DESIGN</option><option value="DETAILED_DESIGN">DETAILED_DESIGN</option><option value="SPECIFICATION">SPECIFICATION</option><option value="TENDER">TENDER</option><option value="AWARD">AWARD</option><option value="CONSTRUCTION">CONSTRUCTION</option><option value="COMMISSIONING">COMMISSIONING</option><option value="OPERATION">OPERATION</option><option value="RETROFIT">RETROFIT</option><option value="CANCELLED">CANCELLED</option></select></label>
              <label>유효 기간 종료<input id="valid-until" type="date"></label>
            </div>
          </fieldset>
          <section aria-labelledby="related-heading"><h3 id="related-heading">관련 Claim 비교</h3><div id="related-claims"><p class="empty-state">후보를 선택하면 동일 기능 키의 충돌/대체 후보를 비교합니다.</p></div></section>
          <fieldset id="decision-fieldset"><legend>구조화된 사람 결정</legend><div class="decision-grid">${renderDecisionChoices()}</div></fieldset>
          <label>결정 사유 코드<select id="review-reason" required><option value="">결정을 먼저 선택하세요</option></select></label>
          <label class="choice-card acknowledgement"><input id="review-acknowledgement" type="checkbox" required><span>이 결정이 검증, 고객 사용 허용, 상용 승인이 아니며 별도의 저장소 검토가 필요함을 확인합니다.</span></label>
          <div class="action-row"><button id="record-review" type="submit" disabled>결정 기록</button><button id="reset-review" type="button">현재 편집 초기화</button></div>
        </form>
        <section class="trust-preview" aria-labelledby="trust-heading"><h3 id="trust-heading">신뢰 미리보기</h3><dl>
          <div><dt>후보 완전성</dt><dd id="trust-candidate">REVIEW_REQUIRED</dd></div>
          <div><dt>출처 완전성</dt><dd id="trust-source">REVIEW_REQUIRED</dd></div>
          <div><dt>근거 결합</dt><dd id="trust-binding">REVIEW_REQUIRED</dd></div>
          <div><dt>시점/개정</dt><dd id="trust-chronology">REVIEW_REQUIRED</dd></div>
          <div><dt>충돌 상태</dt><dd id="trust-conflict">UNRESOLVED</dd></div>
          <div><dt>저장소 코드 리뷰 준비 (신뢰 검증 아님)</dt><dd id="trust-readiness">BLOCKED · 요건 충족 시 READY_FOR_CODE_REVIEW</dd></div>
          <div><dt>예상 Claim Registry 상태</dt><dd id="trust-registry"><strong>UNVERIFIED</strong></dd></div>
          <div><dt>고객 사용</dt><dd id="trust-customer"><strong>BLOCKED</strong></dd></div>
        </dl></section>
        <section class="patch-panel" aria-labelledby="patch-heading"><h3 id="patch-heading">검토 패치 미리보기</h3>
          <dl class="patch-summary"><div><dt>패치 ID</dt><dd><code id="patch-id">아직 없음</code></dd></div><div><dt>후보</dt><dd id="patch-candidate-count">0</dd></div><div><dt>문서</dt><dd id="patch-document-count">0</dd></div><div><dt>충돌</dt><dd id="patch-conflict-count">0</dd></div></dl>
          <textarea id="patch-preview" rows="18" readonly aria-label="결정적 검토 패치 JSON"></textarea>
          <div class="action-row"><button id="copy-patch" type="button" disabled>패치 복사</button><button id="download-patch" type="button" disabled>패치 다운로드</button><button id="clear-decisions" class="secondary-button" type="button">페이지 메모리 결정 모두 지우기</button></div>
          <p id="copy-fallback" class="copy-fallback" hidden>자동 복사가 차단되었습니다. 미리보기를 직접 선택해 복사하세요.</p>
        </section>
      </section>
    </div>
  </main>`;
}

export function renderOfficialEvidenceWorkbenchPage({ capabilityToken, documents = [] } = {}) {
  if (!Array.isArray(documents) || documents.length > 100) throw new TypeError('WORKBENCH_DOCUMENT_SUMMARY_INVALID');
  return renderPageShell({
    title: 'Official Evidence Claim Review Workbench v0',
    capabilityToken,
    documents,
    body: renderMain
  });
}

export function renderOfficialEvidenceWorkbenchErrorPage({ capabilityToken, statusCode = 500 } = {}) {
  const boundedStatus = [400, 403, 404, 405, 413, 415, 421, 500, 503].includes(statusCode) ? statusCode : 500;
  return renderPageShell({
    title: '워크벤치 사용 불가',
    capabilityToken,
    documents: [],
    loadError: true,
    body: () => `<main id="workbench-main" aria-labelledby="workbench-error-heading"><section class="error-page"><h1 id="workbench-error-heading" tabindex="-1">워크벤치 데이터를 안전하게 불러오지 못했습니다</h1><div class="error-summary" role="alert">기존 데이터나 편집 상태는 사용하지 않았습니다. 입력 번들 검증 결과를 확인하세요.</div><p>Status: ${boundedStatus}</p></section></main>`
  });
}
