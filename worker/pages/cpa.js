import { getCommonStyles } from './common-styles.js';

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
    .options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px; }
    .option-card { background: #1e2a3a; border-radius: 12px; padding: 20px; border: 2px solid #333; transition: all 0.3s; }
    .option-card.recommended { border-color: #e94560; box-shadow: 0 0 20px rgba(233,69,96,0.2); }
    .option-card h3 { color: #e94560; font-size: 16px; margin: 0 0 12px 0; }
    .option-card.recommended h3::after { content: ' ★ 추천'; font-size: 12px; color: #f39c12; }
    .option-label { font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 2px; }
    .option-value { font-size: 18px; font-weight: bold; color: #fff; margin-bottom: 12px; }
    .option-detail { font-size: 13px; color: #ccc; margin: 6px 0; display: flex; justify-content: space-between; }
    .option-detail span:last-child { color: #3498db; font-weight: bold; }
    .divider { border-top: 1px solid #2a3a4a; margin: 12px 0; }
    .sensitivity-section { background: #1e2a3a; border-radius: 12px; padding: 20px; margin-top: 20px; display: none; }
    .sensitivity-section h3 { color: #e94560; font-size: 16px; margin: 0 0 16px 0; }
    .sensitivity-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .sensitivity-table th { color: #aaa; text-align: left; padding: 8px 6px; border-bottom: 1px solid #333; }
    .sensitivity-table td { color: #ccc; padding: 8px 6px; border-bottom: 1px solid #222; }
    .sensitivity-table tr.current { background: rgba(233,69,96,0.1); }
    .sensitivity-table tr.current td { color: #fff; font-weight: bold; }
    .esco-note { background: rgba(52,152,219,0.1); border: 1px solid #3498db; border-radius: 8px; padding: 14px; margin-top: 16px; font-size: 13px; color: #3498db; display: none; text-align: left; }
    .range-container { text-align: left; margin-bottom: 12px; }
    .range-value { float: right; color: #e94560; font-weight: bold; font-size: 14px; }
    input[type=range] { width: 100%; -webkit-appearance: none; height: 6px; border-radius: 3px; background: #333; outline: none; margin-top: 6px; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #e94560; cursor: pointer; }
  </style>
</head>
<body>
  <main class="container" style="max-width:800px;">
    <a href="/" class="back-link">← 메인으로</a>
    <h1 style="font-size:22px;">CPA 견적서</h1>
    <p class="subtitle">변수를 조정하면 3가지 옵션의 견적이 즉시 재계산됩니다</p>

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
      <input type="range" id="area" min="500" max="200000" step="500" value="30000" oninput="updateAreaLabel(); debouncedRecalculate()">
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

    <div class="options-grid" id="optionsGrid"></div>
    <div class="sensitivity-section" id="sensitivitySection">
      <h3>민감도 분석 (BEMS 기준, 면적 변동)</h3>
      <table class="sensitivity-table">
        <thead><tr><th>면적 변동</th><th>면적</th><th>총 투자비</th><th>연간 절감</th><th>회수 기간</th></tr></thead>
        <tbody id="sensitivityBody"></tbody>
      </table>
    </div>
    <div class="esco-note" id="escoNote"></div>
  </main>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getToken() { const p=document.getElementById('password').value; if(p) sessionStorage.setItem('b2b_token',p); return p; }
    (function(){ const s=sessionStorage.getItem('b2b_token'); if(s) document.getElementById('password').value=s; })();

    function fmt(n) { return n.toLocaleString('ko-KR'); }
    function fmtWon(n) {
      if (n >= 100000000) return (n/100000000).toFixed(1) + '억원';
      if (n >= 10000) return (n/10000).toFixed(0) + '만원';
      return fmt(n) + '원';
    }

    function updateAreaLabel() {
      document.getElementById('areaValue').textContent = fmt(Number(document.getElementById('area').value));
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

      status.className = 'status loading';
      status.textContent = '계산 중...';

      try {
        const res = await fetch('/api/cpa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            area: document.getElementById('area').value,
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
          renderOptions(data.options);
          renderSensitivity(data.sensitivity);
          const esco = document.getElementById('escoNote');
          esco.textContent = data.escoNote;
          esco.style.display = 'block';
        } else {
          status.className = 'status error';
          status.textContent = data.message;
        }
      } catch(e) {
        status.className = 'status error';
        status.textContent = '오류: ' + e.message;
      }
    }

    function renderOptions(options) {
      const grid = document.getElementById('optionsGrid');
      grid.innerHTML = options.map((o, i) => \`
        <div class="option-card \${i === 1 ? 'recommended' : ''}">
          <h3>\${esc(o.label)}</h3>
          <div class="option-label">총 투자비</div>
          <div class="option-value">\${fmtWon(o.totalCost)}</div>
          <div class="option-detail"><span>단가</span><span>\${fmt(o.unitCost)}원/㎡</span></div>
          <div class="option-detail"><span>에너지 절감률</span><span>\${o.savingsRate}%</span></div>
          <div class="divider"></div>
          <div class="option-detail"><span>연간 절감액</span><span>\${fmtWon(o.annualSavings)}</span></div>
          <div class="option-detail"><span>연간 유지비</span><span>\${fmtWon(o.maintenanceCost)}</span></div>
          <div class="option-detail"><span>순 절감액</span><span>\${fmtWon(o.netAnnualSavings)}</span></div>
          <div class="divider"></div>
          <div class="option-detail"><span>투자 회수</span><span>\${o.paybackYears}년</span></div>
          <div class="option-detail"><span>5년 ROI</span><span>\${o.roi5y}%</span></div>
        </div>
      \`).join('');
    }

    function renderSensitivity(sensitivity) {
      const section = document.getElementById('sensitivitySection');
      const body = document.getElementById('sensitivityBody');
      body.innerHTML = sensitivity.map(s => \`
        <tr class="\${s.pct === 0 ? 'current' : ''}">
          <td>\${s.pct > 0 ? '+' : ''}\${s.pct}%</td>
          <td>\${fmt(s.area)}㎡</td>
          <td>\${fmtWon(s.totalCost)}</td>
          <td>\${fmtWon(s.annualSavings)}</td>
          <td>\${s.paybackYears}년</td>
        </tr>
      \`).join('');
      section.style.display = 'block';
    }
  </script>
</body>
</html>`;
}
