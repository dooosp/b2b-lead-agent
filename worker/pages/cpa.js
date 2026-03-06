import { getCommonStyles } from './common-styles.js';
import { getEscScript, getPasswordTokenScript } from './script-snippets.js';

export function getCPAPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CPA 견적서</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    select, .form-input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; margin-bottom: 12px; }
    .form-row { display: flex; gap: 12px; }
    .form-row > * { flex: 1; }
    label { display: block; font-size: 12px; color: #aaa; margin-bottom: 4px; text-align: left; }
    .form-group { margin-bottom: 4px; text-align: left; }
    .summary-strip { display:none; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-top:18px; }
    .summary-card { background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:14px; text-align:left; }
    .summary-label { color:#8fa4b8; font-size:11px; margin-bottom:6px; display:block; }
    .summary-value { color:#f4f7fb; font-size:17px; font-weight:700; display:block; }
    .summary-meta { color:#9fb0c0; font-size:12px; margin-top:6px; line-height:1.5; }
    .options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 20px; }
    .option-card { background: linear-gradient(180deg, #182433 0%, #121b27 100%); border-radius: 14px; padding: 18px; border: 1px solid #26384c; transition: all 0.3s; text-align:left; }
    .option-card.recommended { border-color: #e94560; box-shadow: 0 12px 30px rgba(233,69,96,0.16); transform: translateY(-2px); }
    .option-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .option-card h3 { color: #f4f7fb; font-size: 17px; margin: 0; }
    .option-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:11px; color:#ffd399; background:rgba(243,156,18,0.12); border:1px solid rgba(243,156,18,0.28); }
    .option-label { font-size: 11px; color: #8fa4b8; text-transform: uppercase; margin-bottom: 4px; }
    .option-value { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 14px; letter-spacing:-0.02em; }
    .option-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:12px 0; }
    .option-stat { background:#121a24; border:1px solid #223447; border-radius:10px; padding:10px; }
    .option-stat-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:4px; }
    .option-stat-value { display:block; color:#f4f7fb; font-size:14px; font-weight:700; }
    .option-detail { font-size: 13px; color: #ccd6e0; margin: 6px 0; display: flex; justify-content: space-between; gap:12px; }
    .option-detail span:last-child { color: #8fd6ff; font-weight: 700; text-align:right; }
    .divider { border-top: 1px solid #253445; margin: 12px 0; }
    .option-footnote { margin-top:10px; color:#9fb0c0; font-size:12px; line-height:1.6; }
    .sensitivity-section { background: #121a24; border-radius: 14px; padding: 18px; margin-top: 20px; display: none; border:1px solid #26384c; text-align:left; }
    .sensitivity-section h3 { color: #f4f7fb; font-size: 16px; margin: 0 0 6px 0; }
    .sensitivity-subtitle { color:#8fa4b8; font-size:12px; margin-bottom:14px; }
    .sensitivity-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
    .sensitivity-card { background:#182433; border:1px solid #223447; border-radius:12px; padding:12px; }
    .sensitivity-card.current { border-color:#e94560; box-shadow:0 8px 24px rgba(233,69,96,0.14); }
    .sensitivity-pct { color:#f4f7fb; font-size:16px; font-weight:700; margin-bottom:8px; }
    .sensitivity-line { display:flex; justify-content:space-between; gap:12px; color:#cdd8e4; font-size:12px; margin:6px 0; }
    .sensitivity-line span:last-child { text-align:right; color:#8fd6ff; font-weight:700; }
    .negative { color: #e74c3c !important; }
    .warning-badge { display: inline-block; background: rgba(231,76,60,0.2); border: 1px solid #e74c3c; color: #e74c3c; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: 6px; }
    .esco-inline { background: rgba(52,152,219,0.08); border: 1px dashed #3498db; border-radius: 8px; padding: 10px 14px; margin-top: 10px; font-size: 12px; color: #3498db; text-align: left; line-height: 1.6; }
    .esco-note { background: rgba(52,152,219,0.1); border: 1px solid #3498db; border-radius: 12px; padding: 14px; margin-top: 16px; font-size: 13px; color: #3498db; display: none; text-align: left; }
    .esco-note h3 { margin:0 0 10px 0; color:#8fd6ff; font-size:15px; }
    .esco-note ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
    .esco-note li { position:relative; padding-left:14px; line-height:1.6; }
    .esco-note li::before { content:'•'; position:absolute; left:0; color:#8fd6ff; }
    .assumption-card { background: #121a24; border: 1px solid #2a3a4a; border-radius: 10px; padding: 14px; margin-top: 16px; display: none; text-align: left; }
    .assumption-card h3 { color: #e94560; font-size: 15px; margin: 0 0 10px 0; }
    .assumption-card p { margin: 6px 0; font-size: 13px; color: #c8d5e2; line-height: 1.6; }
    .range-container { text-align: left; margin-bottom: 12px; }
    .range-value { float: right; color: #e94560; font-weight: bold; font-size: 14px; }
    input[type=range] { width: 100%; -webkit-appearance: none; height: 6px; border-radius: 3px; background: #333; outline: none; margin-top: 6px; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #e94560; cursor: pointer; }
    @media (max-width: 720px) {
      .option-metrics { grid-template-columns:1fr; }
      .summary-strip, .sensitivity-grid { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <main class="container" style="max-width:800px;">
    <a href="/" class="back-link">← 메인으로</a>
    <h1 style="font-size:22px;">CPA 견적서</h1>
    <p class="subtitle">변수를 조정하면 3가지 옵션의 견적이 즉시 재계산됩니다</p>
    <p style="font-size:11px; color:#f39c12; background:rgba(243,156,18,0.1); border:1px solid rgba(243,156,18,0.3); border-radius:6px; padding:8px 12px; margin-bottom:12px;">⚠ 업계 평균 기준 추정 단가입니다. 실제 견적은 별도 확인이 필요합니다.</p>

    <div class="form-row">
      <div class="form-group"><label>빌딩 유형</label>
      <select id="buildingType" onchange="recalculate()">
        <option value="office">오피스 빌딩</option>
        <option value="datacenter">데이터센터</option>
        <option value="hospital">병원/의료시설</option>
        <option value="hotel">호텔/리조트</option>
        <option value="factory">공장/생산시설</option>
        <option value="school">학교/교육시설</option>
        <option value="apartment">아파트/주거</option>
        <option value="commercial">상업시설/몰</option>
      </select></div>
      <div class="form-group"><label>지역</label>
      <select id="region" onchange="recalculate()">
        <option value="seoul">서울/수도권</option>
        <option value="metropolitan">광역시</option>
        <option value="local">지방</option>
        <option value="jeju">제주</option>
      </select></div>
    </div>

    <div class="range-container">
      <label>연면적 (㎡) <span class="range-value" id="areaValue">30,000</span></label>
      <input type="range" id="area" min="500" max="200000" step="500" value="30000" oninput="syncAreaFromSlider()">
    </div>

    <div class="form-row">
      <div class="form-group"><label>연면적 직접 입력 (㎡)</label>
      <input type="number" class="form-input" id="areaInput" value="30000" min="500" max="200000" step="100" oninput="syncAreaFromInput()"></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>층수</label>
      <input type="number" class="form-input" id="floors" value="20" min="1" max="200" onchange="recalculate()"></div>
      <div class="form-group"><label>월 에너지 비용 (만원)</label>
      <input type="number" class="form-input" id="monthlyEnergyCost" placeholder="미입력 시 자동 추정" min="0" onchange="recalculate()"></div>
    </div>

    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" id="calcBtn" onclick="recalculate()">견적 계산</button>
    <div class="status" id="status"></div>

    <div class="assumption-card" id="assumptionCard"></div>
    <div class="summary-strip" id="summaryStrip"></div>
    <div class="options-grid" id="optionsGrid"></div>
    <div class="sensitivity-section" id="sensitivitySection">
      <h3>민감도 분석 (BEMS 기준, 면적 변동)</h3>
      <div class="sensitivity-subtitle">기준안 대비 면적이 변할 때 투자비와 회수기간이 어떻게 움직이는지 바로 비교합니다.</div>
      <div class="sensitivity-grid" id="sensitivityBody"></div>
    </div>
    <div class="esco-note" id="escoNote"></div>
  </main>

  <script>
    ${getEscScript()}
    ${getPasswordTokenScript('password')}

    function fmt(n) { return n.toLocaleString('ko-KR'); }
    function fmtWon(n) {
      if (n >= 100000000) return (n/100000000).toFixed(1) + '억원';
      if (n >= 10000) return (n/10000).toFixed(0) + '만원';
      return fmt(n) + '원';
    }
    function labelForBuildingType(value) {
      const labels = {
        office: '오피스 빌딩',
        datacenter: '데이터센터',
        hospital: '병원/의료시설',
        hotel: '호텔/리조트',
        factory: '공장/생산시설',
        school: '학교/교육시설',
        apartment: '아파트/주거',
        commercial: '상업시설/몰'
      };
      return labels[value] || value;
    }
    function labelForRegion(value) {
      const labels = { seoul: '서울/수도권', metropolitan: '광역시', local: '지방', jeju: '제주' };
      return labels[value] || value;
    }
    function getRecommendedOption(options) {
      return (options || []).find((o) => o.scope === 'BEMS') || (options || [])[1] || (options || [])[0] || null;
    }

    function clampAreaValue(v) {
      const n = Math.round(Number(v) || 0);
      if (n < 500) return 500;
      if (n > 200000) return 200000;
      return n;
    }

    function setAreaValue(v) {
      const area = clampAreaValue(v);
      document.getElementById('area').value = area;
      document.getElementById('areaInput').value = area;
      document.getElementById('areaValue').textContent = fmt(area);
    }

    function updateAreaLabel() {
      setAreaValue(document.getElementById('area').value);
    }

    function syncAreaFromSlider() {
      setAreaValue(document.getElementById('area').value);
      debouncedRecalculate();
    }

    function syncAreaFromInput() {
      setAreaValue(document.getElementById('areaInput').value);
      debouncedRecalculate();
    }

    let debounceTimer;
    function debouncedRecalculate() {
      updateAreaLabel();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(recalculate, 500);
    }

    async function recalculate() {
      const password = getToken();
      const status = document.getElementById('status');
      if (!password) { status.className='status error'; status.textContent='비밀번호를 입력하세요.'; return; }
      document.getElementById('assumptionCard').style.display = 'none';

      status.className = 'status loading';
      status.textContent = '계산 중...';

      try {
        const res = await fetch('/api/cpa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            area: document.getElementById('areaInput').value || document.getElementById('area').value,
            floors: document.getElementById('floors').value,
            buildingType: document.getElementById('buildingType').value,
            region: document.getElementById('region').value,
            monthlyEnergyCost: document.getElementById('monthlyEnergyCost').value
          })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = '견적 계산 완료!';
          renderAssumptions(data.input);
          renderSummary(data);
          renderOptions(data.options);
          renderSensitivity(data.sensitivity);
          const esco = document.getElementById('escoNote');
          esco.innerHTML = renderEscoNote(data.escoNote);
          esco.style.display = 'block';
        } else {
          status.className = 'status error';
          status.textContent = data.error || data.message || '견적 계산에 실패했습니다.';
        }
      } catch(e) {
        status.className = 'status error';
        status.textContent = '오류: ' + e.message;
      }
    }

    function fmtPayback(years) {
      if (years < 0) return '회수불가';
      return years + '년';
    }
    function renderAssumptions(input) {
      const card = document.getElementById('assumptionCard');
      const monthlyCostText = input.monthlyEnergyCost > 0
        ? fmt(input.monthlyEnergyCost) + '만원/월 입력값 사용'
        : '월 에너지 비용 미입력 → 면적 기준 자동추정';
      card.innerHTML = [
        '<h3>전제 요약</h3>',
        '<p>빌딩 유형: ' + esc(labelForBuildingType(input.buildingType)) + ' / 지역: ' + esc(labelForRegion(input.region)) + ' / 연면적: ' + fmt(input.area) + '㎡ / 층수: ' + fmt(input.floors) + '층</p>',
        '<p>에너지 기준선: ' + monthlyCostText + '</p>',
        '<p>해석 기준: 업계 평균 단가와 절감률을 사용한 개략 검토이며, 실제 계약 전에는 기준선 검증과 정산식 합의가 필요합니다.</p>'
      ].join('');
      card.style.display = 'block';
    }
    function renderSummary(data) {
      const strip = document.getElementById('summaryStrip');
      const recommended = getRecommendedOption(data.options);
      if (!recommended) {
        strip.style.display = 'none';
        strip.innerHTML = '';
        return;
      }
      strip.innerHTML = [
        renderSummaryCard('권장안', esc(recommended.label), '표준 비교안 기준'),
        renderSummaryCard('총 투자비', fmtWon(recommended.totalCost), '권장안 기준 총 CAPEX'),
        renderSummaryCard('순연간 절감', fmtWon(recommended.netAnnualSavings), '유지비 반영 후'),
        renderSummaryCard('투자 회수', fmtPayback(recommended.paybackYears), '기준선 입력값 반영')
      ].join('');
      strip.style.display = 'grid';
    }
    function renderSummaryCard(label, value, meta) {
      return '<div class="summary-card"><span class="summary-label">' + label + '</span><span class="summary-value">' + value + '</span><div class="summary-meta">' + meta + '</div></div>';
    }
    function renderOptions(options) {
      const grid = document.getElementById('optionsGrid');
      grid.innerHTML = options.map((o, i) => {
        const isNeg = o.netAnnualSavings < 0;
        const netClass = isNeg ? ' negative' : '';
        const paybackStr = fmtPayback(o.paybackYears);
        const warningHtml = isNeg ? '<span class="warning-badge">유지비 초과</span>' : '';
        const escoHtml = isNeg ? '<div class="esco-inline">샘플 계약 구조: 초기 투자 0원 가정을 전제로 검토할 수 있으나, 상세 성과보장 조건은 기준선 검증 후 확정해야 합니다.</div>' : '';
        return \`
        <div class="option-card \${i === 1 ? 'recommended' : ''}">
          <div class="option-head">
            <div><h3>\${esc(o.label)}</h3><div class="option-label">\${esc(o.scope)} / \${esc(o.tier)}</div></div>
            \${i === 1 ? '<span class="option-badge">권장안</span>' : ''}
          </div>
          <div class="option-label">총 투자비</div>
          <div class="option-value">\${fmtWon(o.totalCost)}</div>
          <div class="option-metrics">
            <div class="option-stat"><span class="option-stat-label">단가</span><span class="option-stat-value">\${fmt(o.unitCost)}원/㎡</span></div>
            <div class="option-stat"><span class="option-stat-label">에너지 절감률</span><span class="option-stat-value">\${o.savingsRate}%</span></div>
            <div class="option-stat"><span class="option-stat-label">연간 절감액</span><span class="option-stat-value">\${fmtWon(o.annualSavings)}</span></div>
            <div class="option-stat"><span class="option-stat-label">순 절감액</span><span class="option-stat-value \${netClass}">\${fmtWon(Math.abs(o.netAnnualSavings))}\${isNeg ? ' (적자)' : ''}</span></div>
          </div>
          <div class="divider"></div>
          <div class="option-detail"><span>연간 유지비</span><span>\${fmtWon(o.maintenanceCost)}</span></div>
          <div class="option-detail"><span>5년 총소유비용</span><span>\${fmtWon(o.tco5y)}</span></div>
          <div class="option-detail"><span>5년 누적 절감액</span><span>\${fmtWon(o.savings5y)}</span></div>
          <div class="option-detail"><span>투자 회수</span><span class="\${o.paybackYears < 0 ? 'negative' : ''}">\${paybackStr}</span></div>
          <div class="option-detail"><span>5년 ROI</span><span class="\${o.roi5y < 0 ? 'negative' : ''}">\${o.roi5y}%</span></div>
          \${warningHtml ? '<div class="option-footnote">' + warningHtml + ' 현재 입력 조건에서는 유지비 반영 후 순절감이 음수입니다.</div>' : ''}
          \${escoHtml}
        </div>\`;
      }).join('');
    }

    function renderSensitivity(sensitivity) {
      const section = document.getElementById('sensitivitySection');
      const body = document.getElementById('sensitivityBody');
      body.innerHTML = sensitivity.map(s => {
        const netVal = s.netAnnualSavings != null ? s.netAnnualSavings : (s.annualSavings - s.totalCost * 0.018);
        const isNeg = netVal < 0;
        return \`
        <div class="sensitivity-card \${s.pct === 0 ? 'current' : ''}">
          <div class="sensitivity-pct">\${s.pct > 0 ? '+' : ''}\${s.pct}%</div>
          <div class="sensitivity-line"><span>면적</span><span>\${fmt(s.area)}㎡</span></div>
          <div class="sensitivity-line"><span>총 투자비</span><span>\${fmtWon(s.totalCost)}</span></div>
          <div class="sensitivity-line"><span>연간 절감</span><span>\${fmtWon(s.annualSavings)}</span></div>
          <div class="sensitivity-line"><span>순 절감</span><span class="\${isNeg ? 'negative' : ''}">\${fmtWon(Math.abs(netVal))}\${isNeg ? ' (적자)' : ''}</span></div>
          <div class="sensitivity-line"><span>회수 기간</span><span class="\${s.paybackYears < 0 ? 'negative' : ''}">\${fmtPayback(s.paybackYears)}</span></div>
        </div>\`;
      }).join('');
      section.style.display = 'block';
    }
    function renderEscoNote(note) {
      const bullets = String(note || '')
        .split(/\\.\\s+/)
        .map((line) => line.trim())
        .filter(Boolean);
      return '<h3>ESCO 검토 메모</h3><ul>' + bullets.map((line) => '<li>' + esc(line.replace(/\\.$/, '')) + '</li>').join('') + '</ul>';
    }

    // 초기 상태 동기화
    setAreaValue(document.getElementById('area').value);
  </script>
</body>
</html>`;
}
