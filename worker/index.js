export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/trigger' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.password || body.password !== env.TRIGGER_PASSWORD) {
        return new Response(JSON.stringify({ success: false, message: '비밀번호가 올바르지 않습니다.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
      return await triggerReport(env);
    }

    return new Response(getHtml(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};

async function triggerReport(env) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'B2B-Lead-Worker'
        },
        body: JSON.stringify({
          event_type: 'generate-report'
        })
      }
    );

    if (response.status === 204) {
      return new Response(JSON.stringify({ success: true, message: '보고서 생성이 시작되었습니다. 이메일을 확인하세요.' }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    } else {
      const text = await response.text();
      return new Response(JSON.stringify({ success: false, message: `오류: ${response.status} ${text}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

function getHtml() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B2B 리드 에이전트 - Danfoss</title>
  <style>
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
    .container {
      text-align: center;
      padding: 40px;
      max-width: 500px;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: #e94560;
    }
    .subtitle {
      font-size: 14px;
      color: #aaa;
      margin-bottom: 40px;
    }
    .btn {
      display: inline-block;
      padding: 18px 48px;
      font-size: 18px;
      font-weight: bold;
      color: #fff;
      background: linear-gradient(135deg, #e94560, #c0392b);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 4px 20px rgba(233, 69, 96, 0.4);
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 30px rgba(233, 69, 96, 0.6);
    }
    .btn:active { transform: translateY(0); }
    .btn:disabled {
      background: #555;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }
    .status {
      margin-top: 24px;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    .status.success {
      display: block;
      background: rgba(39, 174, 96, 0.2);
      border: 1px solid #27ae60;
      color: #2ecc71;
    }
    .status.error {
      display: block;
      background: rgba(231, 76, 60, 0.2);
      border: 1px solid #e74c3c;
      color: #e74c3c;
    }
    .status.loading {
      display: block;
      background: rgba(52, 152, 219, 0.2);
      border: 1px solid #3498db;
      color: #3498db;
    }
    .info {
      margin-top: 40px;
      font-size: 12px;
      color: #666;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">📊</div>
    <h1>B2B 리드 에이전트</h1>
    <p class="subtitle">Danfoss 맞춤형 영업 기회 분석</p>

    <input type="password" id="password" placeholder="비밀번호 입력"
      style="padding:12px 16px; border-radius:8px; border:1px solid #444; background:#1a1a2e; color:#fff; font-size:14px; width:200px; text-align:center; margin-bottom:16px; display:block; margin-left:auto; margin-right:auto;">
    <button class="btn" id="generateBtn" onclick="generate()">보고서 생성</button>

    <div class="status" id="status"></div>

    <div class="info">
      산업 뉴스 수집 → Gemini AI 분석 → 리드 리포트 이메일 발송<br>
      처리에 1~2분 정도 소요됩니다.
    </div>
  </div>

  <script>
    async function generate() {
      const btn = document.getElementById('generateBtn');
      const status = document.getElementById('status');

      btn.disabled = true;
      btn.textContent = '처리 중...';
      status.className = 'status loading';
      status.textContent = '⏳ 보고서 생성을 요청하고 있습니다...';

      try {
        const password = document.getElementById('password').value;
        if (!password) {
          status.className = 'status error';
          status.textContent = '❌ 비밀번호를 입력하세요.';
          btn.disabled = false;
          btn.textContent = '보고서 생성';
          return;
        }
        const res = await fetch('/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = '✅ ' + data.message;
        } else {
          status.className = 'status error';
          status.textContent = '❌ ' + data.message;
        }
      } catch (e) {
        status.className = 'status error';
        status.textContent = '❌ 요청 실패: ' + e.message;
      }

      btn.disabled = false;
      btn.textContent = '보고서 생성';
    }
  </script>
</body>
</html>`;
}
