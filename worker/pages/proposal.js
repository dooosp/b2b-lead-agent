import { getCommonStyles } from './common-styles.js';

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
    .proposal-output h1, .proposal-output h2, .proposal-output h3 { color: #e94560; }
    select, .form-input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; margin-bottom: 12px; }
    .form-row { display: flex; gap: 12px; }
    .form-row > * { flex: 1; }
    label { display: block; font-size: 12px; color: #aaa; margin-bottom: 4px; text-align: left; }
    .form-group { margin-bottom: 4px; text-align: left; }
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

    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" id="genBtn" onclick="generateProposal()">제안서 생성</button>
    <div class="status" id="status"></div>
    <div class="proposal-output" id="output"></div>
  </main>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getToken() { const p=document.getElementById('password').value; if(p) sessionStorage.setItem('b2b_token',p); return p; }
    (function(){ const s=sessionStorage.getItem('b2b_token'); if(s) document.getElementById('password').value=s; })();

    async function generateProposal() {
      const password = getToken();
      const status = document.getElementById('status');
      const output = document.getElementById('output');
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

      try {
        const res = await fetch('/api/proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            buildingType: document.getElementById('buildingType').value,
            area, floors,
            currentBMS: document.getElementById('currentBMS').value,
            monthlyEnergyCost: document.getElementById('monthlyEnergyCost').value
          })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = '제안서 생성 완료!';
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
