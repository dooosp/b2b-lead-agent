import { getCommonStyles } from './common-styles.js';
import { renderProfileOptions } from '../lib/profile.js';
import { getEscScript, getPasswordTokenScript, getSafeUrlScript } from './script-snippets.js';
import { PURSUIT_TWIN_SUMMARY_SAMPLE, renderPursuitTwinSummary } from './pursuit-twin-summary.js';

export function getMainPage(env) {
  const profileOptions = renderProfileOptions(env);
  const pursuitTwinSummary = renderPursuitTwinSummary(PURSUIT_TWIN_SUMMARY_SAMPLE);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pursuit Twin KR</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    select.profile-select { width: 200px; margin: 0 auto 16px; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; text-align: center; display: block; }
    .product-kicker { color:#7cc4ff; font-size:11px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:10px; }
    .product-subtitle { color:#d5e1ec; font-size:15px; font-weight:700; margin-bottom:10px; }
    .hero-copy { max-width:680px; margin:0 auto 18px; color:#9fb0c0; font-size:13px; line-height:1.7; }
    .brand-mark { width:58px; height:58px; margin:0 auto 12px; display:grid; place-items:center; border:1px solid rgba(124,196,255,0.35); border-radius:18px; background:linear-gradient(145deg,rgba(52,152,219,0.22),rgba(233,69,96,0.16)); color:#fff; font-size:20px; font-weight:900; letter-spacing:-0.04em; box-shadow:0 14px 34px rgba(0,0,0,0.2); }
    .scope-chips { display:flex; justify-content:center; flex-wrap:wrap; gap:7px; margin-bottom:24px; }
    .scope-chip { display:inline-flex; align-items:center; padding:5px 10px; border:1px solid #30455d; border-radius:999px; background:#111b28; color:#bad0e4; font-size:11px; font-weight:700; }
    .tabs { display: flex; justify-content: center; gap: 0; margin-bottom: 24px; }
    .tab-btn { flex: 1; max-width: 240px; padding: 12px 14px; font-size: 13px; font-weight: bold; color: #8798a8; background: rgba(10,18,28,0.45); border: 1px solid #354657; cursor: pointer; transition: all 0.3s; }
    .tab-btn:first-child { border-radius: 8px 0 0 8px; }
    .tab-btn:last-child { border-radius: 0 8px 8px 0; }
    .tab-btn.active { color: #fff; background: rgba(233,69,96,0.2); border-color: #e94560; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .pursuit-panel { text-align:left; padding:22px; border:1px solid #2b4056; border-radius:16px; background:linear-gradient(180deg,rgba(18,31,45,0.96),rgba(12,22,33,0.96)); box-shadow:0 18px 42px rgba(0,0,0,0.18); }
    .pursuit-panel h2 { color:#fff; font-size:20px; margin:0 0 8px; }
    .pursuit-panel-intro { color:#aebdcb; font-size:13px; line-height:1.7; margin-bottom:18px; }
    .pursuit-flow { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin:16px 0; }
    .pursuit-flow-card { min-height:112px; padding:13px; border:1px solid #263a50; border-radius:12px; background:#101b28; }
    .pursuit-flow-step { display:block; color:#75bfff; font-size:10px; font-weight:800; letter-spacing:0.08em; margin-bottom:7px; }
    .pursuit-flow-card strong { display:block; color:#f4f7fb; font-size:13px; margin-bottom:6px; }
    .pursuit-flow-card span:last-child { display:block; color:#91a4b7; font-size:11px; line-height:1.55; }
    .pursuit-foundation { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:16px 0; }
    .pursuit-foundation-item { padding:10px; border-radius:10px; background:rgba(52,152,219,0.09); border:1px solid rgba(52,152,219,0.22); }
    .pursuit-foundation-item strong { display:block; color:#dceeff; font-size:11px; margin-bottom:4px; }
    .pursuit-foundation-item span { color:#8fa4b8; font-size:10px; line-height:1.45; }
    .pursuit-boundary { margin-top:14px; padding:12px 14px; border:1px solid rgba(241,196,15,0.28); border-radius:10px; background:rgba(241,196,15,0.07); color:#efd998; font-size:11px; line-height:1.65; }
    .next-priority { margin-top:10px; padding:12px 14px; border:1px solid #344b63; border-radius:10px; background:#111d2a; color:#aebdcb; font-size:12px; line-height:1.6; }
    .next-priority strong { color:#fff; }
    .pursuit-twin-summary { margin-top:14px; padding:16px; border:1px solid rgba(124,196,255,0.34); border-radius:14px; background:#0d1824; }
    .pursuit-twin-summary-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
    .pursuit-twin-summary-head h3 { margin:4px 0 5px; color:#f4f7fb; font-size:15px; line-height:1.45; }
    .pursuit-twin-summary-head p { margin:0; color:#8fa4b8; font-size:11px; }
    .pursuit-twin-label { color:#7cc4ff; font-size:9px; font-weight:900; letter-spacing:0.09em; }
    .pursuit-twin-state { flex:0 0 auto; padding:4px 8px; border:1px solid rgba(241,196,15,0.32); border-radius:999px; background:rgba(241,196,15,0.1); color:#ffe58a; font-size:9px; font-weight:800; }
    .pursuit-twin-delta { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); gap:9px; align-items:center; margin-top:14px; }
    .pursuit-twin-revision { height:100%; padding:11px; border:1px solid #263a50; border-radius:10px; background:#101b28; }
    .pursuit-twin-revision > span { color:#7cc4ff; font-size:9px; font-weight:800; letter-spacing:0.08em; }
    .pursuit-twin-revision > strong { display:block; margin:5px 0 8px; color:#fff; font-size:12px; }
    .pursuit-twin-revision dl { margin:0; }
    .pursuit-twin-revision dl div { display:grid; grid-template-columns:76px minmax(0,1fr); gap:6px; padding:3px 0; }
    .pursuit-twin-revision dt { color:#7f92a5; font-size:9px; }
    .pursuit-twin-revision dd { margin:0; color:#dce6ef; font-size:10px; overflow-wrap:anywhere; }
    .pursuit-twin-arrow { color:#7cc4ff; font-size:19px; font-weight:900; }
    .pursuit-twin-review-state { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:10px; padding:10px; border-radius:9px; background:rgba(233,69,96,0.09); color:#d6e0ea; font-size:10px; line-height:1.5; }
    .pursuit-twin-review-state strong { color:#ffbdc8; }
    .pursuit-twin-evidence { margin-top:12px; }
    .pursuit-twin-evidence h4 { margin:0 0 8px; color:#fff; font-size:12px; }
    .pursuit-twin-evidence ol { display:grid; gap:7px; margin:0; padding:0; list-style:none; }
    .pursuit-twin-evidence li { display:flex; gap:9px; align-items:flex-start; padding:9px 10px; border:1px solid #263a50; border-radius:9px; background:#111d2a; }
    .pursuit-twin-evidence-order { flex:0 0 20px; height:20px; display:grid; place-items:center; border-radius:999px; background:#23425e; color:#dff1ff; font-size:9px; font-weight:900; }
    .pursuit-twin-evidence li div { min-width:0; }
    .pursuit-twin-evidence li strong, .pursuit-twin-evidence li span { display:block; }
    .pursuit-twin-evidence li strong { color:#e8eef5; font-size:10px; line-height:1.5; }
    .pursuit-twin-evidence li span:not(.pursuit-twin-evidence-order) { color:#8fa4b8; font-size:9px; line-height:1.5; }
    .pursuit-twin-evidence > p { margin:8px 0 0; color:#efd998; font-size:10px; line-height:1.6; }
    .pursuit-twin-contract-boundary { display:flex; justify-content:space-between; gap:9px; flex-wrap:wrap; margin-top:11px; padding-top:10px; border-top:1px solid #2a4055; color:#91a4b7; font-size:9px; line-height:1.5; }
    .pursuit-twin-contract-boundary strong { color:#ffe58a; }
    .pursuit-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
    .pursuit-actions .btn { font-size:12px; padding:9px 14px; }
    .secondary-intro { color:#9fb0c0; font-size:13px; line-height:1.7; margin-bottom:16px; }
    .secondary-tools { margin-top:16px; border:1px solid #2f4052; border-radius:10px; background:#111b28; text-align:left; }
    .secondary-tools summary { cursor:pointer; color:#b7c6d4; font-size:12px; font-weight:700; padding:12px 14px; }
    .secondary-tools .nav-buttons { margin:0; padding:0 12px 12px; }
    .ss-input { display: block; width: 280px; margin: 0 auto 12px; padding: 12px 16px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; text-align: center; }
    .ss-input::placeholder { color: #666; }
    .progress-bar { width: 100%; height: 4px; background: #333; border-radius: 2px; margin-top: 12px; overflow: hidden; display: none; }
    .progress-bar.active { display: block; }
    .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #e94560, #3498db); border-radius: 2px; transition: width 0.5s ease; }
    .ss-results { margin-top: 20px; text-align: left; }
    .ss-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin:16px 0 18px; }
    .ss-summary-card { background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:12px 14px; }
    .ss-summary-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:6px; }
    .ss-summary-value { display:block; color:#f4f7fb; font-size:18px; font-weight:700; }
    .ss-summary-meta { color:#9fb0c0; font-size:12px; margin-top:6px; line-height:1.5; }
    .ss-summary-note { background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:14px; color:#d2dbe5; font-size:13px; line-height:1.7; margin-bottom:14px; }
    .ss-lead-card { background: linear-gradient(180deg, #182433 0%, #121b27 100%); border-radius: 14px; padding: 16px; margin: 12px 0; border: 1px solid #26384c; }
    .ss-lead-card.grade-a { box-shadow: 0 12px 28px rgba(233,69,96,0.14); border-color:#e94560; }
    .ss-lead-card.grade-b { border-color: #f39c12; box-shadow: 0 10px 24px rgba(243,156,18,0.12); }
    .ss-lead-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
    .ss-lead-title { min-width:0; }
    .ss-lead-title h3 { color: #f4f7fb; margin: 0 0 6px 0; font-size: 17px; }
    .ss-lead-project { color:#aebdcb; font-size:13px; line-height:1.6; }
    .ss-badges { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .ss-badge { display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; font-size:11px; font-weight:700; }
    .ss-badge.grade-a { background:rgba(233,69,96,0.16); color:#ffb5c1; border:1px solid rgba(233,69,96,0.28); }
    .ss-badge.grade-b { background:rgba(243,156,18,0.16); color:#ffd399; border:1px solid rgba(243,156,18,0.28); }
    .ss-badge.score { background:rgba(52,152,219,0.14); color:#9edcff; border:1px solid rgba(52,152,219,0.28); }
    .ss-badge.trust-verified { background:rgba(46,204,113,0.14); color:#a8efc0; border:1px solid rgba(46,204,113,0.28); }
    .ss-badge.trust-review { background:rgba(241,196,15,0.14); color:#ffe58a; border:1px solid rgba(241,196,15,0.3); }
    .ss-badge.trust-unverified { background:rgba(149,165,166,0.16); color:#d7dee0; border:1px solid rgba(149,165,166,0.3); }
    .ss-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:12px 0; }
    .ss-metric { background:#121a24; border:1px solid #223447; border-radius:10px; padding:10px 12px; }
    .ss-metric-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:4px; }
    .ss-metric-value { display:block; color:#f4f7fb; font-size:14px; font-weight:700; }
    .ss-copy { margin-top:12px; color:#d2dbe5; font-size:13px; line-height:1.7; }
    .ss-trust-note { background:rgba(241,196,15,0.08); border:1px solid rgba(241,196,15,0.24); color:#f6dda0; border-radius:10px; padding:10px 12px; font-size:12px; line-height:1.6; margin-bottom:14px; }
    .ss-trust-list { margin-top:8px; color:#b9c5cf; font-size:12px; line-height:1.6; }
    .ss-section-label { color:#8fa4b8; font-size:11px; margin-bottom:4px; display:block; text-transform:uppercase; letter-spacing:0.04em; }
    .ss-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: center; }
    .ss-stats { font-size: 12px; color: #888; margin-top: 8px; }
    .ss-sources { margin-top: 10px; padding-top: 10px; border-top: 1px solid #2a3a4a; }
    .ss-sources summary { color: #aaa; font-size: 12px; cursor: pointer; }
    .ss-sources a { color: #3498db; text-decoration: none; font-size: 12px; }
    .ss-sources a:hover { text-decoration: underline; }
    .ss-sources li { margin: 3px 0; list-style: none; }
    @media (max-width: 720px) {
      .ss-metrics, .ss-summary { grid-template-columns:1fr; }
      .ss-lead-head { flex-direction:column; }
      .ss-badges { justify-content:flex-start; }
      .pursuit-flow { grid-template-columns:1fr; }
      .pursuit-foundation { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .pursuit-twin-summary-head { flex-direction:column; }
      .pursuit-twin-delta { grid-template-columns:1fr; }
      .pursuit-twin-arrow { transform:rotate(90deg); justify-self:center; }
      .tab-btn { padding:10px 8px; font-size:11px; }
    }
  </style>
</head>
<body>
  <main class="container" style="max-width:820px;">
    <div class="logo brand-mark" aria-hidden="true">PT</div>
    <p class="product-kicker">Industrial Pursuit Copilot · Korea</p>
    <h1>Pursuit Twin KR</h1>
    <p class="subtitle product-subtitle">산업 프로젝트 사양 추적 및 기술영업 의사결정 시스템</p>
    <p class="hero-copy">공식 근거와 검증된 제품 능력을 프로젝트 요구사양에 대조해, 사람이 입찰 전 기술 검토 범위와 다음 증거를 판단하도록 돕습니다.</p>
    <div class="scope-chips" aria-label="현재 제품 범위">
      <span class="scope-chip">KR</span>
      <span class="scope-chip">데이터센터 인프라</span>
      <span class="scope-chip">MV Switchgear + Transformer focus</span>
      <span class="scope-chip">Evidence-first</span>
      <span class="scope-chip">Human-gated</span>
    </div>

    <div class="tabs" role="tablist" aria-label="기능 탭">
      <button id="tab-btn-pursuit" class="tab-btn active" role="tab" aria-selected="true" aria-controls="tab-pursuit" onclick="switchTab('pursuit')">Project Pursuit</button>
      <button id="tab-btn-self-service" class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-self-service" onclick="switchTab('self-service')">신호 탐색</button>
      <button id="tab-btn-managed" class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-managed" onclick="switchTab('managed')">운영 도구</button>
    </div>

    <div class="tab-content active" id="tab-pursuit" role="tabpanel" aria-labelledby="tab-btn-pursuit">
      <section class="pursuit-panel" aria-labelledby="pursuit-heading">
        <h2 id="pursuit-heading">Project Pursuit</h2>
        <p class="pursuit-panel-intro">한 회사를 점수화하는 대신, 프로젝트 기회 × 제품군 × 사양 영향 구간 × 근거 집합을 하나의 검토 단위로 다룹니다.</p>
        <div class="pursuit-flow" aria-label="Project Pursuit 판단 흐름">
          <div class="pursuit-flow-card">
            <span class="pursuit-flow-step">01 · EVIDENCE</span>
            <strong>공식 근거와 요구사양</strong>
            <span>검토된 claim만 기술 판단에 사용하고 가정·충돌·만료 근거를 분리합니다.</span>
          </div>
          <div class="pursuit-flow-card">
            <span class="pursuit-flow-step">02 · FIT</span>
            <strong>Requirement × Capability</strong>
            <span>제품군별 FIT, CONDITIONAL_FIT, NOT_FIT, INSUFFICIENT_EVIDENCE를 결정적으로 계산합니다.</span>
          </div>
          <div class="pursuit-flow-card">
            <span class="pursuit-flow-step">03 · WINDOW</span>
            <strong>Specification Window</strong>
            <span>현재 프로젝트 단계에서 사양 영향 가능 구간이 열려 있는지 별도로 평가합니다.</span>
          </div>
          <div class="pursuit-flow-card">
            <span class="pursuit-flow-step">04 · DOSSIER</span>
            <strong>Pursuit Dossier</strong>
            <span>근거, 기술 적합성, 충돌, 누락 요구사항과 다음 기술 질문을 추적 가능한 패킷으로 묶습니다.</span>
          </div>
          <div class="pursuit-flow-card">
            <span class="pursuit-flow-step">05 · HUMAN GATE</span>
            <strong>Pursue · Hold · No-Bid</strong>
            <span>시스템은 기술 검토 상태만 제시하며 최종 pursuit 결정은 사람이 내립니다.</span>
          </div>
          <div class="pursuit-flow-card">
            <span class="pursuit-flow-step">UPSTREAM</span>
            <strong>LeadBrief 신호 탐색</strong>
            <span>뉴스·회사 분석은 Project Pursuit 후보를 찾는 보조 신호 계층으로 유지합니다.</span>
          </div>
        </div>
        <div class="pursuit-foundation" aria-label="현재 구현된 기반">
          <div class="pursuit-foundation-item"><strong>Claim Registry</strong><span>구조화 근거·출처·검증 상태</span></div>
          <div class="pursuit-foundation-item"><strong>Spec Fit Engine</strong><span>결정적 제약조건 평가</span></div>
          <div class="pursuit-foundation-item"><strong>Spec Window</strong><span>프로젝트 단계별 영향 구간</span></div>
          <div class="pursuit-foundation-item"><strong>Pursuit Dossier</strong><span>사람 검토용 추적 패킷</span></div>
          <div class="pursuit-foundation-item"><strong>Spec Delta</strong><span>revision·requirement·FIT·window 변화</span></div>
          <div class="pursuit-foundation-item"><strong>Minimum Evidence</strong><span>재평가에 필요한 최소 증거 순서</span></div>
        </div>
        <div class="pursuit-boundary">
          현재 기반과 아래 v0 요약은 local/test 및 합성 근거 검증 범위입니다. 실제 공식문서 자동 수집, 실제 고객 적합성, 최종 Pursue/Hold/No-Bid 자동 결정, 프로덕션 준비 상태를 주장하지 않습니다.
        </div>
        <div class="next-priority">
          <strong>현재 구현 계약:</strong> Spec Delta와 Minimum Evidence to Advance의 결정적 로컬/합성 검증 표면입니다. 아래 값은 hash-bound 합성 예시이며 live production data가 아닙니다.
        </div>
        ${pursuitTwinSummary}
        <div class="pursuit-actions">
          <a href="/leads" class="btn btn-secondary">프로젝트 신호 검토 큐 열기</a>
        </div>
      </section>
    </div>

    <div class="tab-content" id="tab-self-service" role="tabpanel" aria-labelledby="tab-btn-self-service">
      <p class="secondary-intro">회사·산업 뉴스 분석은 Project Pursuit 후보를 찾는 보조 신호입니다. 이 결과만으로 기술 적합성이나 최종 pursuit 결정을 내리지 않습니다.</p>
      <input type="text" class="ss-input" id="ssCompany" placeholder="회사명 (예: 삼성전자)" aria-label="회사명 (예: 삼성전자)" maxlength="50">
      <input type="text" class="ss-input" id="ssIndustry" placeholder="산업 분야 (예: 반도체 제조)" aria-label="산업 분야 (예: 반도체 제조)" maxlength="50">
      <button class="btn btn-primary" id="ssBtn" onclick="selfServiceAnalyze()">보조 신호 분석</button>
      <div class="progress-bar" id="ssProgress"><div class="progress-fill" id="ssProgressFill"></div></div>
      <div class="status" id="ssStatus"></div>
      <div class="ss-results" id="ssResults"></div>
    </div>

    <div class="tab-content" id="tab-managed" role="tabpanel" aria-labelledby="tab-btn-managed">
      <p class="secondary-intro">기존 관리 프로필 리포트와 리뷰 화면은 신호 운영 계층입니다. 제안 산출물과 역할극은 기술 판단의 source of truth가 아닙니다.</p>
      <select class="profile-select" id="profileSelect" aria-label="프로필 선택">
        ${profileOptions}
      </select>
      <input type="password" id="password" placeholder="비밀번호 입력" aria-label="비밀번호 입력" class="input-field">
      <button class="btn btn-primary" id="generateBtn" onclick="generate()">보고서 생성</button>
      <div class="status" id="status"></div>
      <nav class="nav-buttons top-nav" aria-label="주요 페이지 이동">
        <a href="/leads" class="btn btn-secondary">프로젝트 신호 검토</a>
        <a href="/dashboard" class="btn btn-secondary">신호 대시보드</a>
      </nav>
      <details class="secondary-tools">
        <summary>제안·연습 보조 도구</summary>
        <nav class="nav-buttons" aria-label="제안 및 연습 보조 도구">
          <a href="/ppt" class="btn btn-secondary">PPT 제안서</a>
          <a href="/proposal" class="btn btn-secondary">기술제안서</a>
          <a href="/cpa" class="btn btn-secondary">CPA 견적서</a>
          <a href="/roleplay" class="btn btn-secondary">영업 역량 시뮬레이션</a>
        </nav>
      </details>
      <div class="info">
        뉴스 기반 후보 신호 분석 후 리포트를 발송합니다<br>
        처리에 1~2분 정도 소요됩니다.
      </div>
    </div>
  </main>

  <script>
    ${getEscScript()}
    ${getSafeUrlScript()}

    function switchTab(tab) {
      ['pursuit', 'self-service', 'managed'].forEach((name) => {
        const active = tab === name;
        const button = document.getElementById('tab-btn-' + name);
        const panel = document.getElementById('tab-' + name);
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        panel.classList.toggle('active', active);
      });
    }

    // ===== 셀프서비스 =====
    async function selfServiceAnalyze() {
      const company = document.getElementById('ssCompany').value.trim();
      const industry = document.getElementById('ssIndustry').value.trim();
      const btn = document.getElementById('ssBtn');
      const status = document.getElementById('ssStatus');
      const results = document.getElementById('ssResults');
      const progress = document.getElementById('ssProgress');
      const fill = document.getElementById('ssProgressFill');

      if (!company || !industry) {
        status.className = 'status error'; status.textContent = '회사명과 산업 분야를 모두 입력하세요.'; return;
      }

      btn.disabled = true; btn.textContent = '분석 중...';
      status.className = 'status loading';
      status.textContent = '프로필 생성 및 뉴스 분석 중입니다... (15~25초)';
      results.innerHTML = '';
      progress.classList.add('active');
      fill.style.width = '0%';

      // 프로그레스 애니메이션
      let pct = 0;
      const progressInterval = setInterval(() => {
        pct = Math.min(pct + 2, 90);
        fill.style.width = pct + '%';
      }, 500);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ company, industry })
        });
        const data = await res.json();
        clearInterval(progressInterval);
        fill.style.width = '100%';

        if (!data.success) {
          status.className = 'status error'; status.textContent = data.error || data.message || '분석에 실패했습니다.';
          results.innerHTML = '';
        } else if (!data.leads || data.leads.length === 0) {
          status.className = 'status success';
          status.textContent = '분석 완료했지만 유효한 리드를 찾지 못했습니다.';
          results.innerHTML = '';
        } else {
          status.className = 'status success';
          status.textContent = data.leads.length + '개 리드 발견!';
          renderSelfServiceResults(data.leads, { name: company }, data.summary);
        }
      } catch (e) {
        clearInterval(progressInterval);
        status.className = 'status error'; status.textContent = '오류: ' + e.message;
      }

      setTimeout(() => { progress.classList.remove('active'); }, 1000);
      btn.disabled = false; btn.textContent = '보조 신호 분석';
    }

    function normalizeSelfServiceLead(lead) {
      const score = Math.max(0, Math.min(100, parseInt(lead?.score, 10) || 0));
      const grade = ['A', 'B', 'C', 'D'].includes(String(lead?.grade || '')) ? String(lead.grade) : (score >= 80 ? 'A' : score >= 50 ? 'B' : 'C');
      const projectTitle = String(lead?.project_title || lead?.project || lead?.summary || '').trim();
      const product = String(lead?.recommended_product || lead?.product || '').trim();
      const roi = String(lead?.expected_roi || lead?.roi || '').trim();
      const salesPitch = String(lead?.sales_pitch || lead?.salesPitch || lead?.pitch || '').trim();
      const trend = String(lead?.trend || lead?.trends || lead?.globalContext || '').trim();
      const generationMode = normalizeGenerationModeForUi(lead?.generationMode || lead?.generation_mode);
      const confidence = normalizeConfidenceForUi(lead?.confidence);
      const verificationStatus = normalizeVerificationStatusForUi(lead?.verificationStatus || lead?.verification_status, generationMode);
      const reviewStatus = normalizeReviewStatusForUi(lead?.reviewStatus || lead?.review_status);
      const dataGaps = normalizeStringArrayForUi(lead?.dataGaps || lead?.data_gaps);
      const assumptions = normalizeStringArrayForUi(lead?.assumptions);
      return {
        company: String(lead?.company || '').trim(),
        score,
        grade,
        project_title: projectTitle,
        recommended_product: product,
        expected_roi: roi,
        sales_pitch: salesPitch,
        trend,
        signal: String(lead?.signal || projectTitle).trim(),
        whyNow: String(lead?.whyNow || lead?.why_now || trend).trim(),
        recommendedMessage: String(lead?.recommendedMessage || lead?.recommended_message || salesPitch).trim(),
        sources: Array.isArray(lead?.sources) ? lead.sources.filter(s => s && s.title && s.url) : [],
        generationMode,
        verificationStatus,
        reviewStatus,
        confidence,
        confidenceReason: String(lead?.confidenceReason || lead?.confidence_reason || defaultConfidenceReason(generationMode)).trim(),
        assumptions,
        dataGaps
      };
    }

    function normalizeGenerationModeForUi(value) {
      const mode = String(value || '').toLowerCase();
      return ['llm', 'heuristic', 'demo', 'unavailable'].includes(mode) ? mode : 'unavailable';
    }

    function normalizeVerificationStatusForUi(value, generationMode) {
      const status = String(value || '').toLowerCase();
      if (['verified', 'needs_review', 'draft', 'unverified'].includes(status)) return status;
      if (generationMode === 'llm') return 'needs_review';
      if (generationMode === 'heuristic') return 'needs_review';
      if (generationMode === 'demo') return 'draft';
      return 'unverified';
    }

    function normalizeReviewStatusForUi(value) {
      const status = String(value || '').toUpperCase();
      return ['NEW', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'DEFERRED'].includes(status) ? status : 'NEEDS_REVIEW';
    }

    function reviewStatusLabelForUi(value) {
      return ({
        NEW: '새 검토',
        NEEDS_REVIEW: '검토 필요',
        APPROVED: '승인',
        REJECTED: '반려',
        DEFERRED: '보류'
      })[normalizeReviewStatusForUi(value)] || '검토 필요';
    }

    function normalizeConfidenceForUi(value) {
      const confidence = String(value || '').toUpperCase();
      return ['HIGH', 'MEDIUM', 'LOW'].includes(confidence) ? confidence : 'LOW';
    }

    function normalizeStringArrayForUi(values) {
      return (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .slice(0, 8);
    }

    function defaultConfidenceReason(generationMode) {
      if (generationMode === 'llm') return 'LLM 분석 결과이나 최종 영업 사용 전 검토가 필요합니다.';
      if (generationMode === 'heuristic') return '규칙 기반 fallback 결과로 사람 검토가 필요합니다.';
      if (generationMode === 'demo') return '데모 데이터로 실제 검증 근거가 없습니다.';
      return '분석을 완료하지 못해 검증 근거가 없습니다.';
    }

    function trustLabelForLead(lead) {
      if (lead.generationMode === 'llm' && lead.verificationStatus === 'verified') return '검증됨';
      if (lead.generationMode === 'heuristic' && lead.verificationStatus === 'needs_review') return '검토 필요 / 규칙 기반';
      if (lead.generationMode === 'unavailable' || lead.verificationStatus === 'unverified') return '분석 불가 / 미검증';
      if (lead.generationMode === 'demo' || lead.verificationStatus === 'draft') return '데모 / 미검증';
      return '검토 필요';
    }

    function trustClassForLead(lead) {
      if (lead.generationMode === 'llm' && lead.verificationStatus === 'verified') return 'trust-verified';
      if (lead.generationMode === 'unavailable' || lead.verificationStatus === 'unverified') return 'trust-unverified';
      return 'trust-review';
    }

    function renderSelfServiceResults(leads, profile, summary) {
      const normalizedLeads = (Array.isArray(leads) ? leads : []).map(normalizeSelfServiceLead);
      const validLeads = normalizedLeads.filter(l =>
        l.company && (l.project_title || l.recommended_product || l.expected_roi || l.sales_pitch || l.trend)
      );
      const container = document.getElementById('ssResults');
      if (validLeads.length === 0) {
        const status = document.getElementById('ssStatus');
        status.className = 'status error';
        status.textContent = '분석 결과 파싱에 실패했습니다. 잠시 후 다시 시도해주세요.';
        container.innerHTML = '';
        return;
      }
      const avgScore = Math.round(validLeads.reduce((sum, lead) => sum + lead.score, 0) / validLeads.length);
      const topLead = validLeads[0];
      const gradeACount = validLeads.filter((lead) => lead.grade === 'A').length;
      const needsReviewCount = validLeads.filter((lead) => lead.verificationStatus !== 'verified').length;
      container.innerHTML = [
        renderSelfServiceSummary(validLeads.length, avgScore, gradeACount, topLead, summary, needsReviewCount),
        validLeads.map(renderSelfServiceLeadCard).join('')
      ].join('');

      // 복사/다운로드 버튼
      container.innerHTML += \`
        <div class="ss-actions">
          <button class="btn btn-secondary" onclick="copySelfServiceResults()">클립보드 복사</button>
          <button class="btn btn-secondary" onclick="downloadSelfServiceResults()">JSON 다운로드</button>
        </div>
      \`;

      // 결과 데이터 저장
      window._ssLeads = validLeads;
      window._ssSummary = typeof summary === 'string' ? summary : '';
      window._ssProfile = profile;
    }

    function renderSelfServiceSummary(count, avgScore, gradeACount, topLead, summary, needsReviewCount) {
      return \`
        <div class="ss-summary">
          <div class="ss-summary-card">
            <span class="ss-summary-label">분석 리드 수</span>
            <span class="ss-summary-value">\${count}건</span>
            <div class="ss-summary-meta">검토 대상 후보를 추렸습니다.</div>
          </div>
          <div class="ss-summary-card">
            <span class="ss-summary-label">평균 점수</span>
            <span class="ss-summary-value">\${avgScore}점</span>
            <div class="ss-summary-meta">기사 최신성과 키워드 적합도 기준</div>
          </div>
          <div class="ss-summary-card">
            <span class="ss-summary-label">A등급 비중</span>
            <span class="ss-summary-value">\${gradeACount}건</span>
            <div class="ss-summary-meta">우선 제안 후보 수</div>
          </div>
          <div class="ss-summary-card">
            <span class="ss-summary-label">대표 제안 제품</span>
            <span class="ss-summary-value">\${esc((topLead && topLead.recommended_product) || '-')}</span>
            <div class="ss-summary-meta">\${topLead ? esc(topLead.company + ' 기준') : '추천 제품 없음'}</div>
          </div>
        </div>
        \${needsReviewCount > 0 ? \`<div class="ss-trust-note">\${needsReviewCount}건은 검증 완료 전 결과입니다. 규칙 기반/미검증 항목은 사람 검토 후 사용하세요.</div>\` : ''}
        <div class="ss-summary-note">\${esc(String(summary || '').trim() || (count + '개 프로젝트 후보 신호를 분석했습니다.'))}</div>
      \`;
    }

    function renderSelfServiceLeadCard(lead) {
      const gradeClass = lead.grade === 'A' ? 'grade-a' : (lead.grade === 'B' ? 'grade-b' : '');
      return \`
        <article class="ss-lead-card \${gradeClass}">
          <div class="ss-lead-head">
            <div class="ss-lead-title">
              <h3>\${esc(lead.company)}</h3>
              <div class="ss-lead-project">\${esc(lead.project_title)}</div>
            </div>
            <div class="ss-badges">
              <span class="ss-badge \${lead.grade === 'A' ? 'grade-a' : 'grade-b'}">\${esc(lead.grade)}등급</span>
              <span class="ss-badge score">\${parseInt(lead.score, 10) || 0}점</span>
              <span class="ss-badge \${trustClassForLead(lead)}">\${esc(trustLabelForLead(lead))}</span>
            </div>
          </div>
          <div class="ss-metrics">
            <div class="ss-metric">
              <span class="ss-metric-label">추천 제품</span>
              <span class="ss-metric-value">\${esc(lead.recommended_product)}</span>
            </div>
            <div class="ss-metric">
              <span class="ss-metric-label">예상 ROI</span>
              <span class="ss-metric-value">\${esc(lead.expected_roi)}</span>
            </div>
          </div>
          <div class="ss-copy">
            <span class="ss-section-label">영업 제안</span>
            \${esc(lead.sales_pitch)}
          </div>
          <div class="ss-copy">
            <span class="ss-section-label">시장 트렌드</span>
            \${esc(lead.trend)}
          </div>
          <div class="ss-copy">
            <span class="ss-section-label">신뢰 상태</span>
            \${esc(lead.confidence)} · 검토 상태 \${esc(reviewStatusLabelForUi(lead.reviewStatus))} · \${esc(lead.confidenceReason)}
            \${lead.dataGaps.length > 0 ? \`<div class="ss-trust-list">데이터 공백: \${esc(lead.dataGaps.join(', '))}</div>\` : ''}
          </div>
          \${lead.sources && lead.sources.length > 0 ? \`
          <div class="ss-sources">
            <details>
              <summary>출처 (\${lead.sources.length}건)</summary>
              <ul>\${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}</ul>
            </details>
          </div>\` : ''}
        </article>
      \`;
    }

    function copySelfServiceResults() {
      if (!window._ssLeads) return;
      const text = window._ssLeads.map(l =>
        \`[\${l.grade}] \${l.company} (\${l.score}점)\\n신뢰 상태: \${trustLabelForLead(l)} / \${l.generationMode} / \${l.verificationStatus} / \${l.confidence}\\n검토 상태: \${reviewStatusLabelForUi(l.reviewStatus)} (\${l.reviewStatus})\\n신뢰 근거: \${l.confidenceReason}\\n가정: \${l.assumptions.length ? l.assumptions.join(', ') : '-'}\\n데이터 공백: \${l.dataGaps.length ? l.dataGaps.join(', ') : '-'}\\n프로젝트: \${l.signal || l.project_title}\\n제품: \${l.recommended_product}\\nROI: \${l.expected_roi}\\nPitch: \${l.recommendedMessage || l.sales_pitch}\\n트렌드: \${l.whyNow || l.trend}\`
      ).join('\\n\\n---\\n\\n');
      return navigator.clipboard.writeText(text).then(() => {
        const status = document.getElementById('ssStatus');
        status.className = 'status success'; status.textContent = '클립보드에 복사되었습니다!';
      });
    }

    function downloadSelfServiceResults() {
      if (!window._ssLeads) return;
      const payload = {
        leads: window._ssLeads.map(normalizeSelfServiceLead),
        summary: String(window._ssSummary || '').trim() || (window._ssLeads.length + '개 프로젝트 후보 신호를 분석했습니다.')
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = (window._ssProfile?.name || 'leads') + '_' + new Date().toISOString().split('T')[0] + '.json';
      a.click(); URL.revokeObjectURL(a.href);
    }

    // ===== 관리 프로필 =====
    ${getPasswordTokenScript('password')}
    async function generate() {
      const btn = document.getElementById('generateBtn');
      const status = document.getElementById('status');
      const password = getToken();
      const profile = document.getElementById('profileSelect').value || 'danfoss';

      if (!password) {
        status.className = 'status error';
        status.textContent = '비밀번호를 입력하세요.';
        return;
      }

      btn.disabled = true;
      btn.textContent = '처리 중...';
      status.className = 'status loading';
      status.textContent = '보고서 생성을 요청하고 있습니다...';

      try {
        const res = await fetch('/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + password },
          body: JSON.stringify({ profile })
        });
        const data = await res.json();
        status.className = data.success ? 'status success' : 'status error';
        status.textContent = data.message + (data.requestId ? ' (requestId: ' + data.requestId + ')' : '');
      } catch (e) {
        status.className = 'status error';
        status.textContent = '요청 실패: ' + e.message;
      }

      btn.disabled = false;
      btn.textContent = '보고서 생성';
    }

    document.querySelectorAll('.nav-buttons a').forEach((a) => {
      a.addEventListener('click', function (e) {
        const profile = document.getElementById('profileSelect').value || 'danfoss';
        e.preventDefault();
        window.location.href = this.getAttribute('href') + '?profile=' + encodeURIComponent(profile);
      });
    });
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  </script>
</body>
</html>`;
}

export const getHomePage = getMainPage;
