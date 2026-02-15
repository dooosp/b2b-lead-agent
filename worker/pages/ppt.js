import { getCommonStyles } from './common-styles.js';

export function getPPTPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PPT 제안서 생성</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .ppt-output { background: #1e2a3a; border-radius: 12px; padding: 24px; margin-top: 20px; text-align: left; white-space: pre-wrap; font-size: 14px; line-height: 1.8; color: #ddd; display: none; max-height: 70vh; overflow-y: auto; }
    .ppt-output h1, .ppt-output h2, .ppt-output h3 { color: #e94560; }
    select { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <main class="container" style="max-width:700px;">
    <a id="leadsBackLink" href="/leads" class="back-link">← 리드 목록</a>
    <h1 style="font-size:22px;">PPT 제안서 생성</h1>
    <p class="subtitle">리드를 선택하면 5슬라이드 제안서 초안을 생성합니다</p>

    <select id="leadSelect" aria-label="리드 선택"><option value="">리드 로딩 중...</option></select>
    <input type="password" id="password" placeholder="비밀번호 입력" aria-label="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" id="genBtn" onclick="generatePPT()">제안서 생성</button>
    <div class="status" id="status"></div>
    <div class="ppt-output" id="output"></div>
  </main>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getToken() { const p=document.getElementById('password').value; if(p) sessionStorage.setItem('b2b_token',p); return p; }
    function getProfile() { return new URLSearchParams(window.location.search).get('profile') || 'danfoss'; }
    document.getElementById('leadsBackLink').href = '/leads?profile=' + encodeURIComponent(getProfile());
    (function(){ const s=sessionStorage.getItem('b2b_token'); if(s) document.getElementById('password').value=s; })();
    let leads = [];

    async function loadLeads() {
      const res = await fetch('/api/leads?profile=' + getProfile(), {headers:authHeaders()});
      const data = await res.json();
      leads = data.leads || [];
      const select = document.getElementById('leadSelect');

      if (leads.length === 0) {
        select.innerHTML = '<option value="">리드 없음 - 보고서를 먼저 생성하세요</option>';
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const preselect = params.get('lead');

      select.innerHTML = leads.map((l, i) =>
        \`<option value="\${i}" \${preselect == i ? 'selected' : ''}>\${esc(l.grade)} | \${esc(l.company)} - \${esc(l.product)} (\${parseInt(l.score)||0}점)</option>\`
      ).join('');
    }

    async function generatePPT() {
      const idx = document.getElementById('leadSelect').value;
      const password = getToken();
      const status = document.getElementById('status');
      const output = document.getElementById('output');
      const btn = document.getElementById('genBtn');

      if (!password) { status.className = 'status error'; status.textContent = '비밀번호를 입력하세요.'; return; }
      if (idx === '' || !leads[idx]) { status.className = 'status error'; status.textContent = '리드를 선택하세요.'; return; }

      btn.disabled = true;
      btn.textContent = 'AI 생성 중...';
      status.className = 'status loading';
      status.textContent = 'AI가 제안서를 작성하고 있습니다...';
      output.style.display = 'none';

      try {
        const res = await fetch('/api/ppt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ lead: leads[idx] })
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

    loadLeads();
  </script>
</body>
</html>`;
}
