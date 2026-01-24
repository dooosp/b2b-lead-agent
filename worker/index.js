export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API 라우팅
    if (url.pathname === '/trigger' && request.method === 'POST') {
      return await handleTrigger(request, env);
    }
    if (url.pathname === '/api/leads' && request.method === 'GET') {
      return await fetchLeads(env);
    }
    if (url.pathname === '/api/ppt' && request.method === 'POST') {
      return await generatePPT(request, env);
    }
    if (url.pathname === '/api/roleplay' && request.method === 'POST') {
      return await handleRoleplay(request, env);
    }

    // 페이지 라우팅
    if (url.pathname === '/leads') {
      return new Response(getLeadsPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/ppt') {
      return new Response(getPPTPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/roleplay') {
      return new Response(getRoleplayPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response(getMainPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};

// ===== API 핸들러 =====

async function handleTrigger(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.password || body.password !== env.TRIGGER_PASSWORD) {
    return jsonResponse({ success: false, message: '비밀번호가 올바르지 않습니다.' }, 401);
  }

  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'B2B-Lead-Worker'
      },
      body: JSON.stringify({ event_type: 'generate-report' })
    }
  );

  if (response.status === 204) {
    return jsonResponse({ success: true, message: '보고서 생성이 시작되었습니다. 1~2분 후 이메일을 확인하세요.' });
  }
  return jsonResponse({ success: false, message: `오류: ${response.status}` }, 500);
}

async function fetchLeads(env) {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/latest_leads.json`,
      { headers: { 'User-Agent': 'B2B-Lead-Worker' } }
    );
    if (!response.ok) return jsonResponse({ leads: [], message: '아직 생성된 리드가 없습니다.' });
    const leads = await response.json();
    return jsonResponse({ leads });
  } catch (e) {
    return jsonResponse({ leads: [], message: e.message }, 500);
  }
}

async function generatePPT(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.password || body.password !== env.TRIGGER_PASSWORD) {
    return jsonResponse({ success: false, message: '비밀번호가 올바르지 않습니다.' }, 401);
  }

  const { lead } = body;
  if (!lead) return jsonResponse({ success: false, message: '리드 데이터가 없습니다.' }, 400);

  const prompt = `당신은 댄포스 코리아의 기술 영업 전문가입니다.
아래 리드 정보를 바탕으로 고객사에 전달할 **5슬라이드 기술 영업 제안서** 구성안을 작성하세요.

[리드 정보]
- 기업: ${lead.company}
- 프로젝트: ${lead.summary}
- 추천 제품: ${lead.product}
- 예상 ROI: ${lead.roi}
- 글로벌 트렌드: ${lead.globalContext}

[슬라이드 구성 지시]
슬라이드 1 - 도입부: 고객사의 최근 성과(수주/착공 등)를 축하하며, 당면한 과제(에너지 효율, 규제 대응 등)를 언급
슬라이드 2 - 댄포스 솔루션: ${lead.product}의 기술적 강점과 차별점을 구체적으로 설명
슬라이드 3 - 경제적 가치: ROI 수치를 시각화 제안 (Before/After 비교표, 절감액 그래프 등)
슬라이드 4 - 규제 대응: 관련 글로벌 규제(${lead.globalContext}) 준수 로드맵 제시
슬라이드 5 - Next Step: 파일럿 테스트 제안, 기술 미팅 일정 등 구체적 후속 조치

각 슬라이드에 대해 [제목], [핵심 메시지 2~3줄], [추천 시각자료]를 포함해서 작성하세요.
마크다운 형식으로 출력하세요.`;

  try {
    const result = await callGemini(prompt, env);
    return jsonResponse({ success: true, content: result });
  } catch (e) {
    return jsonResponse({ success: false, message: 'Gemini API 오류: ' + e.message }, 500);
  }
}

async function handleRoleplay(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.password || body.password !== env.TRIGGER_PASSWORD) {
    return jsonResponse({ success: false, message: '비밀번호가 올바르지 않습니다.' }, 401);
  }

  const { lead, history, userMessage } = body;
  if (!lead) return jsonResponse({ success: false, message: '리드 데이터가 없습니다.' }, 400);

  const conversationHistory = (history || []).map(h =>
    `${h.role === 'user' ? '영업사원' : '고객'}: ${h.content}`
  ).join('\n');

  const prompt = `당신은 ${lead.company}의 구매 담당 임원입니다. 까다롭고 가격에 민감하며, 경쟁사(ABB, Siemens, Schneider Electric)와 항상 비교합니다.

[상황 설정]
- 귀사 프로젝트: ${lead.summary}
- 제안받은 제품: ${lead.product}
- 제안된 ROI: ${lead.roi}

[당신의 성격]
- 구체적인 수치와 레퍼런스를 요구함
- "왜 경쟁사보다 비싼가?" 류의 압박 질문을 자주 함
- 납기, A/S, 로컬 지원 체계에 관심이 많음
- 쉽게 설득되지 않지만, 논리적이고 구체적인 답변에는 긍정적으로 반응

${conversationHistory ? `[이전 대화]\n${conversationHistory}\n` : ''}
[영업사원의 최신 발언]
${userMessage || '안녕하세요, 댄포스 코리아입니다. 귀사의 프로젝트에 대해 제안드리고 싶습니다.'}

위 발언에 대해 까다로운 구매 담당자로서 응답하세요. 응답 후 줄바꿈하고 "---" 아래에 [코칭 피드백]을 작성하세요:
- 영업사원의 답변에서 잘한 점
- 부족한 점 (Value Selling 관점)
- 더 나은 대응 제안

형식:
[고객 응답]
(까다로운 구매 담당자의 응답)

---
[코칭 피드백]
- 잘한 점: ...
- 개선점: ...
- 제안: ...`;

  try {
    const result = await callGemini(prompt, env);
    return jsonResponse({ success: true, content: result });
  } catch (e) {
    return jsonResponse({ success: false, message: 'Gemini API 오류: ' + e.message }, 500);
  }
}

// ===== Gemini API 호출 =====

async function callGemini(prompt, env) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    return data.candidates[0].content.parts[0].text;
  }
  throw new Error('응답 형식 오류: ' + JSON.stringify(data).slice(0, 200));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// ===== 페이지 HTML =====

function getMainPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B2B 리드 에이전트 - Danfoss</title>
  <style>${getCommonStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="logo">📊</div>
    <h1>B2B 리드 에이전트</h1>
    <p class="subtitle">Danfoss 맞춤형 영업 기회 분석</p>

    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" id="generateBtn" onclick="generate()">보고서 생성</button>

    <div class="status" id="status"></div>

    <div class="nav-buttons">
      <a href="/leads" class="btn btn-secondary">리드 상세 보기</a>
      <a href="/ppt" class="btn btn-secondary">PPT 제안서</a>
      <a href="/roleplay" class="btn btn-secondary">영업 시뮬레이터</a>
    </div>

    <div class="info">
      산업 뉴스 수집 → Gemini AI 분석 → 리드 리포트 이메일 발송<br>
      처리에 1~2분 정도 소요됩니다.
    </div>
  </div>

  <script>
    async function generate() {
      const btn = document.getElementById('generateBtn');
      const status = document.getElementById('status');
      const password = document.getElementById('password').value;

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        status.className = data.success ? 'status success' : 'status error';
        status.textContent = data.message;
      } catch (e) {
        status.className = 'status error';
        status.textContent = '요청 실패: ' + e.message;
      }

      btn.disabled = false;
      btn.textContent = '보고서 생성';
    }
  </script>
</body>
</html>`;
}

function getLeadsPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드 상세 보기 - Danfoss</title>
  <style>${getCommonStyles()}
    .lead-card { background: #1e2a3a; border-radius: 12px; padding: 20px; margin: 16px 0; border-left: 4px solid #e94560; }
    .lead-card.grade-b { border-left-color: #f39c12; }
    .lead-card h3 { color: #e94560; margin: 0 0 12px 0; font-size: 18px; }
    .lead-card.grade-b h3 { color: #f39c12; }
    .lead-info { display: grid; gap: 8px; }
    .lead-info p { margin: 0; font-size: 14px; line-height: 1.6; color: #ccc; }
    .lead-info strong { color: #fff; }
    .lead-actions { margin-top: 12px; display: flex; gap: 8px; }
    .lead-actions a { font-size: 12px; padding: 6px 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <a href="/" class="back-link">← 메인</a>
    <h1 style="font-size:22px;">리드 상세 보기</h1>
    <p class="subtitle">최근 분석된 영업 기회 목록</p>

    <div id="leadsList"><p style="color:#aaa;">로딩 중...</p></div>
  </div>

  <script>
    async function loadLeads() {
      try {
        const res = await fetch('/api/leads');
        const data = await res.json();
        const container = document.getElementById('leadsList');

        if (!data.leads || data.leads.length === 0) {
          container.innerHTML = '<p style="color:#aaa;">아직 생성된 리드가 없습니다. 메인 페이지에서 보고서를 먼저 생성하세요.</p>';
          return;
        }

        container.innerHTML = data.leads.map((lead, i) => \`
          <div class="lead-card \${lead.grade === 'B' ? 'grade-b' : ''}">
            <h3><span class="badge \${lead.grade === 'A' ? 'badge-a' : 'badge-b'}">\${lead.grade}</span> \${lead.company} (\${lead.score}점)</h3>
            <div class="lead-info">
              <p><strong>프로젝트:</strong> \${lead.summary}</p>
              <p><strong>추천 제품:</strong> \${lead.product}</p>
              <p><strong>예상 ROI:</strong> \${lead.roi || '-'}</p>
              <p><strong>영업 Pitch:</strong> \${lead.salesPitch}</p>
              <p><strong>글로벌 트렌드:</strong> \${lead.globalContext || '-'}</p>
            </div>
            <div class="lead-actions">
              <a href="/ppt?lead=\${i}" class="btn btn-secondary">PPT 생성</a>
              <a href="/roleplay?lead=\${i}" class="btn btn-secondary">영업 연습</a>
            </div>
          </div>
        \`).join('');
      } catch(e) {
        document.getElementById('leadsList').innerHTML = '<p style="color:#e74c3c;">데이터 로드 실패: ' + e.message + '</p>';
      }
    }
    loadLeads();
  </script>
</body>
</html>`;
}

function getPPTPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PPT 제안서 생성 - Danfoss</title>
  <style>${getCommonStyles()}
    .ppt-output { background: #1e2a3a; border-radius: 12px; padding: 24px; margin-top: 20px; text-align: left; white-space: pre-wrap; font-size: 14px; line-height: 1.8; color: #ddd; display: none; max-height: 70vh; overflow-y: auto; }
    .ppt-output h1, .ppt-output h2, .ppt-output h3 { color: #e94560; }
    select { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <a href="/leads" class="back-link">← 리드 목록</a>
    <h1 style="font-size:22px;">PPT 제안서 생성</h1>
    <p class="subtitle">리드를 선택하면 5슬라이드 제안서 초안을 생성합니다</p>

    <select id="leadSelect"><option value="">리드 로딩 중...</option></select>
    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" id="genBtn" onclick="generatePPT()">제안서 생성</button>
    <div class="status" id="status"></div>
    <div class="ppt-output" id="output"></div>
  </div>

  <script>
    let leads = [];

    async function loadLeads() {
      const res = await fetch('/api/leads');
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
        \`<option value="\${i}" \${preselect == i ? 'selected' : ''}>\${l.grade} | \${l.company} - \${l.product} (\${l.score}점)</option>\`
      ).join('');
    }

    async function generatePPT() {
      const idx = document.getElementById('leadSelect').value;
      const password = document.getElementById('password').value;
      const status = document.getElementById('status');
      const output = document.getElementById('output');
      const btn = document.getElementById('genBtn');

      if (!password) { status.className = 'status error'; status.textContent = '비밀번호를 입력하세요.'; return; }
      if (idx === '' || !leads[idx]) { status.className = 'status error'; status.textContent = '리드를 선택하세요.'; return; }

      btn.disabled = true;
      btn.textContent = 'AI 생성 중...';
      status.className = 'status loading';
      status.textContent = 'Gemini AI가 제안서를 작성하고 있습니다...';
      output.style.display = 'none';

      try {
        const res = await fetch('/api/ppt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, lead: leads[idx] })
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
      return text
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

function getRoleplayPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>영업 시뮬레이터 - Danfoss</title>
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
    <a href="/leads" class="back-link">← 리드 목록</a>
    <h1 style="font-size:22px;">영업 시뮬레이터</h1>
    <p class="subtitle">까다로운 고객과 영업 연습을 해보세요</p>

    <select id="leadSelect"><option value="">리드 로딩 중...</option></select>
    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" onclick="startSession()">시뮬레이션 시작</button>
    <div class="status" id="status"></div>

    <div class="chat-container" id="chatContainer"></div>

    <div class="chat-input" id="chatInput" style="display:none;">
      <input type="text" id="userMsg" placeholder="영업 멘트를 입력하세요..." onkeydown="if(event.key==='Enter')sendMessage()">
      <button class="btn btn-primary" onclick="sendMessage()" style="padding:12px 20px;">전송</button>
    </div>
  </div>

  <script>
    let leads = [];
    let history = [];
    let currentLead = null;

    async function loadLeads() {
      const res = await fetch('/api/leads');
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
        \`<option value="\${i}" \${preselect == i ? 'selected' : ''}>\${l.grade} | \${l.company} - \${l.product}</option>\`
      ).join('');
    }

    async function startSession() {
      const idx = document.getElementById('leadSelect').value;
      const password = document.getElementById('password').value;
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
      await sendMessage('안녕하세요, 댄포스 코리아입니다. 귀사의 프로젝트에 대해 제안드리고 싶습니다.');
      status.className = 'status success';
      status.textContent = '시뮬레이션 진행 중 - 아래에 영업 멘트를 입력하세요.';
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, lead: currentLead, history, userMessage: message })
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
      div.innerHTML = \`<span class="label">\${label}</span>\${content.replace(/\\n/g, '<br>')}\`;
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

function getCommonStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Malgun Gothic', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container { text-align: center; padding: 30px; width: 100%; max-width: 500px; }
    .logo { font-size: 48px; margin-bottom: 10px; }
    h1 { font-size: 24px; margin-bottom: 8px; color: #e94560; }
    .subtitle { font-size: 14px; color: #aaa; margin-bottom: 24px; }
    .input-field { display: block; width: 200px; margin: 0 auto 16px; padding: 12px 16px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; text-align: center; }
    .btn { display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: bold; color: #fff; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s; text-decoration: none; }
    .btn-primary { background: linear-gradient(135deg, #e94560, #c0392b); box-shadow: 0 4px 15px rgba(233,69,96,0.3); }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(233,69,96,0.5); }
    .btn-primary:disabled { background: #555; cursor: not-allowed; box-shadow: none; transform: none; }
    .btn-secondary { background: rgba(255,255,255,0.1); border: 1px solid #444; font-size: 13px; padding: 10px 16px; }
    .btn-secondary:hover { background: rgba(255,255,255,0.2); }
    .nav-buttons { margin-top: 30px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .status { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: 13px; display: none; }
    .status.success { display: block; background: rgba(39,174,96,0.2); border: 1px solid #27ae60; color: #2ecc71; }
    .status.error { display: block; background: rgba(231,76,60,0.2); border: 1px solid #e74c3c; color: #e74c3c; }
    .status.loading { display: block; background: rgba(52,152,219,0.2); border: 1px solid #3498db; color: #3498db; }
    .info { margin-top: 30px; font-size: 12px; color: #666; line-height: 1.8; }
    .back-link { color: #aaa; text-decoration: none; font-size: 13px; display: inline-block; margin-bottom: 16px; }
    .back-link:hover { color: #fff; }
  `;
}
