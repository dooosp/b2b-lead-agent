import { getCommonStyles } from './common-styles.js';

export function getRoleplayPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>영업 역량 시뮬레이션</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .chat-container { background: #1e2a3a; border-radius: 12px; padding: 16px; margin-top: 16px; max-height: 50vh; overflow-y: auto; display: none; }
    .chat-msg { margin: 12px 0; padding: 12px; border-radius: 8px; font-size: 14px; line-height: 1.6; }
    .chat-msg.customer { background: #2d1f3d; border-left: 3px solid #9b59b6; color: #ddd; }
    .chat-msg.user { background: #1f3d2d; border-left: 3px solid #27ae60; color: #ddd; }
    .chat-msg.coaching { background: #3d3a1f; border-left: 3px solid #f1c40f; color: #ddd; font-size: 13px; margin-top: 4px; }
    .chat-msg .label { font-weight: bold; font-size: 12px; margin-bottom: 4px; display: block; }
    .chat-msg.customer .label { color: #9b59b6; }
    .chat-msg.user .label { color: #27ae60; }
    .chat-msg.coaching .label { color: #f1c40f; }
    .chat-input { display: flex; gap: 8px; margin-top: 12px; }
    .chat-input input { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; }
    .chat-input button { white-space: nowrap; }
    select { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <a id="leadsBackLink" href="/leads" class="back-link">← 리드 목록</a>
    <h1 style="font-size:22px;">영업 역량 시뮬레이션</h1>
    <p class="subtitle">까다로운 고객과 영업 연습을 해보세요</p>

    <select id="leadSelect"><option value="">리드 로딩 중...</option></select>
    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" onclick="startSession()">시뮬레이션 시작</button>
    <div class="status" id="status"></div>

    <div class="chat-container" id="chatContainer"></div>

    <div class="chat-input" id="chatInput" style="display:none;">
      <input type="text" id="userMsg" placeholder="영업 메시지를 입력하세요..." onkeydown="if(event.key==='Enter')sendMessage()">
      <button class="btn btn-primary" onclick="sendMessage()" style="padding:12px 20px;">전송</button>
    </div>
  </div>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getToken() { const p=document.getElementById('password').value; if(p) sessionStorage.setItem('b2b_token',p); return p; }
    function getProfile() { return new URLSearchParams(window.location.search).get('profile') || 'danfoss'; }
    document.getElementById('leadsBackLink').href = '/leads?profile=' + encodeURIComponent(getProfile());
    (function(){ const s=sessionStorage.getItem('b2b_token'); if(s) document.getElementById('password').value=s; })();
    let leads = [];
    let history = [];
    let currentLead = null;

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
        \`<option value="\${i}" \${preselect == i ? 'selected' : ''}>\${esc(l.grade)} | \${esc(l.company)} - \${esc(l.product)}</option>\`
      ).join('');
    }

    async function startSession() {
      const idx = document.getElementById('leadSelect').value;
      const password = getToken();
      const status = document.getElementById('status');

      if (!password) { status.className = 'status error'; status.textContent = '비밀번호를 입력하세요.'; return; }
      if (idx === '' || !leads[idx]) { status.className = 'status error'; status.textContent = '리드를 선택하세요.'; return; }

      currentLead = leads[idx];
      history = [];

      status.className = 'status loading';
      status.textContent = '시뮬레이션을 시작합니다...';

      document.getElementById('chatContainer').style.display = 'block';
      document.getElementById('chatContainer').innerHTML = '';
      document.getElementById('chatInput').style.display = 'flex';

      // 첫 인사
      await sendMessage('안녕하세요. 귀사의 프로젝트에 대해 제안드리고 싶습니다.');
      status.className = 'status success';
      status.textContent = '시뮬레이션 진행 중 - 아래에 영업 메시지를 입력하세요.';
    }

    async function sendMessage(preset) {
      const msgInput = document.getElementById('userMsg');
      const message = preset || msgInput.value.trim();
      if (!message) return;

      if (!preset) msgInput.value = '';
      const password = document.getElementById('password').value;

      // 내 메시지 표시
      addChat('user', '나 (영업사원)', message);
      history.push({ role: 'user', content: message });

      // 로딩 표시
      const loadingId = addChat('customer', '고객', '응답 생성 중...');

      try {
        const res = await fetch('/api/roleplay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ lead: currentLead, history, userMessage: message })
        });
        const data = await res.json();

        if (data.success) {
          // 고객 응답과 코칭 분리
          const parts = data.content.split('---');
          const customerResponse = parts[0].replace(/\\[고객 응답\\]/g, '').trim();
          const coaching = parts[1] ? parts[1].replace(/\\[코칭 피드백\\]/g, '').trim() : '';

          removeChat(loadingId);
          addChat('customer', \`고객 (\${currentLead.company})\`, customerResponse);
          if (coaching) addChat('coaching', '코칭 피드백', coaching);

          history.push({ role: 'assistant', content: customerResponse });
        } else {
          removeChat(loadingId);
          addChat('customer', '시스템', '오류: ' + data.message);
        }
      } catch(e) {
        removeChat(loadingId);
        addChat('customer', '시스템', '오류: ' + e.message);
      }

      document.getElementById('chatContainer').scrollTop = 999999;
    }

    let chatIdCounter = 0;
    function addChat(type, label, content) {
      const id = 'chat-' + (chatIdCounter++);
      const container = document.getElementById('chatContainer');
      const div = document.createElement('div');
      div.id = id;
      div.className = 'chat-msg ' + type;
      div.innerHTML = \`<span class="label">\${esc(label)}</span>\${esc(content).replace(/\\n/g, '<br>')}\`;
      container.appendChild(div);
      container.scrollTop = 999999;
      return id;
    }

    function removeChat(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    loadLeads();
  </script>
</body>
</html>`;
}
