import { getCommonStyles } from './common-styles.js';
import { getEscScript, getPasswordTokenScript } from './script-snippets.js';

export function getProposalPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>기술제안서 자동 생성</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .proposal-output { background: #1e2a3a; border-radius: 12px; padding: 24px; margin-top: 20px; text-align: left; white-space: pre-wrap; font-size: 14px; line-height: 1.8; color: #ddd; display: none; max-height: 70vh; overflow-y: auto; }
    .estimate-box { display:none; margin-top:12px; background:#121a24; border:1px solid #2a3a4a; border-radius:10px; padding:12px; text-align:left; font-size:12px; color:#c8d5e2; line-height:1.7; }
    .proposal-output h1, .proposal-output h2, .proposal-output h3 { color: #e94560; }
    select, .form-input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; margin-bottom: 12px; }
    .form-row { display: flex; gap: 12px; }
    .form-row > * { flex: 1; }
    label { display: block; font-size: 12px; color: #aaa; margin-bottom: 4px; text-align: left; }
    .form-group { margin-bottom: 4px; text-align: left; }
    .system-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; margin:8px 0 12px; }
    .system-grid label { display:flex; align-items:center; gap:8px; margin:0; font-size:12px; color:#ccc; }
    .system-grid input { margin:0; }
  </style>
</head>
<body>
  <main class="container" style="max-width:700px;">
    <a href="/" class="back-link">← 메인으로</a>
    <h1 style="font-size:22px;">기술제안서 자동 생성</h1>
    <p class="subtitle">빌딩 정보를 입력하면 Desigo CC 기반 7섹션 제안서를 생성합니다</p>

    <div class="form-group"><label>빌딩 유형</label>
    <select id="buildingType">
      <option value="office">오피스 빌딩</option>
      <option value="datacenter">데이터센터</option>
      <option value="hospital">병원/의료시설</option>
      <option value="hotel">호텔/리조트</option>
      <option value="factory">공장/생산시설</option>
      <option value="school">학교/교육시설</option>
      <option value="apartment">아파트/주거</option>
      <option value="commercial">상업시설/몰</option>
    </select></div>

    <div class="form-row">
      <div class="form-group"><label>연면적 (㎡)</label>
      <input type="number" class="form-input" id="area" placeholder="예: 30000" min="100"></div>
      <div class="form-group"><label>층수</label>
      <input type="number" class="form-input" id="floors" placeholder="예: 20" min="1"></div>
    </div>

    <div class="form-group"><label>현재 BMS (선택)</label>
    <input type="text" class="form-input" id="currentBMS" placeholder="예: Honeywell EBI, 없음"></div>

    <div class="form-group"><label>월 에너지 비용 (만원, 선택)</label>
    <input type="number" class="form-input" id="monthlyEnergyCost" placeholder="예: 5000" min="0"></div>

    <div class="form-group">
      <label>시스템 범위</label>
      <div class="system-grid">
        <label><input type="checkbox" id="sys-hvac" checked> HVAC</label>
        <label><input type="checkbox" id="sys-lighting" checked> 조명</label>
        <label><input type="checkbox" id="sys-power" checked> 전력</label>
        <label><input type="checkbox" id="sys-fire" checked> 방재</label>
        <label><input type="checkbox" id="sys-extra" checked> 기타 설비</label>
      </div>
    </div>

    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" id="genBtn" onclick="generateProposal()">제안서 생성</button>
    <div class="status" id="status"></div>
    <div class="estimate-box" id="estimateBox"></div>
    <div class="proposal-output" id="output"></div>
  </main>

  <script>
    ${getEscScript()}
    ${getPasswordTokenScript('password')}

    async function generateProposal() {
      const password = getToken();
      const status = document.getElementById('status');
      const output = document.getElementById('output');
      const estimateBox = document.getElementById('estimateBox');
      const btn = document.getElementById('genBtn');

      if (!password) { status.className='status error'; status.textContent='비밀번호를 입력하세요.'; return; }

      const area = document.getElementById('area').value;
      const floors = document.getElementById('floors').value;
      if (!area || !floors) { status.className='status error'; status.textContent='면적과 층수는 필수입니다.'; return; }

      btn.disabled = true;
      btn.textContent = 'AI 생성 중...';
      status.className = 'status loading';
      status.textContent = 'AI가 기술제안서를 작성하고 있습니다... (15~25초)';
      output.style.display = 'none';
      estimateBox.style.display = 'none';
      estimateBox.innerHTML = '';

      try {
        const res = await fetch('/api/proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            buildingType: document.getElementById('buildingType').value,
            area, floors,
            currentBMS: document.getElementById('currentBMS').value,
            monthlyEnergyCost: document.getElementById('monthlyEnergyCost').value,
            systemFlags: {
              hvac: document.getElementById('sys-hvac').checked,
              lighting: document.getElementById('sys-lighting').checked,
              power: document.getElementById('sys-power').checked,
              fire: document.getElementById('sys-fire').checked,
              extra: document.getElementById('sys-extra').checked
            }
          })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = '제안서 생성 완료!';
          if (data.estimation) {
            estimateBox.innerHTML = renderEstimation(data.estimation);
            estimateBox.style.display = 'block';
          }
          output.style.display = 'block';
          output.innerHTML = formatMarkdown(data.content);
        } else {
          status.className = 'status error';
          status.textContent = data.message;
        }
      } catch(e) {
        status.className = 'status error';
        status.textContent = '오류: ' + e.message;
      }

      btn.disabled = false;
      btn.textContent = '제안서 생성';
    }

    function renderEstimation(est) {
      const ps = est.pointsBySystem || {};
      const ctr = est.controllers || {};
      const range = est.pointRange || {};
      return [
        '<strong>산정 엔진 결과(고정)</strong>',
        'HVAC ' + (ps.hvac || 0) + ' | 조명 ' + (ps.lighting || 0) + ' | 전력 ' + (ps.power || 0) + ' | 방재 ' + (ps.fire || 0) + ' | 기타 ' + (ps.extra || 0),
        '총 포인트: ' + (est.totalPoints || 0) + ' (범위 ' + (range.min || 0) + '~' + (range.max || 0) + ')',
        '컨트롤러: 최소 ' + (ctr.min || 0) + '대 / 권장 ' + (ctr.recommended || 0) + '대 / 최대 ' + (ctr.max || 0) + '대'
      ].join('<br>');
    }

    function formatMarkdown(text) {
      return esc(text)
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/## (.*)/g, '<h2>$1</h2>')
        .replace(/# (.*)/g, '<h1>$1</h1>')
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
        .replace(/- (.*)/g, '<li>$1</li>')
        .replace(/\\n/g, '<br>');
    }
  </script>
</body>
</html>`;
}
