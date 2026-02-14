export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    // API 라우팅 — 인증 필요 경로
    const apiPaths = ['/api/leads', '/api/leads/batch-enrich', '/api/ppt', '/api/roleplay', '/api/history', '/api/dashboard', '/api/export/csv'];
    if (apiPaths.includes(url.pathname) || url.pathname.startsWith('/api/leads/')) {
      const authErr = await verifyAuth(request, env);
      if (authErr) return addCorsHeaders(authErr, origin, env);
    }

    // 셀프서비스 API — 인증 불필요, rate limit만 적용
    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      const rlErr = await checkSelfServiceRateLimit(request, env);
      if (rlErr) return addCorsHeaders(rlErr, origin, env);
      return addCorsHeaders(await handleSelfServiceAnalyze(request, env), origin, env);
    }

    // /trigger는 Bearer token 또는 body password 허용 (하위 호환)
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const rlErr = await checkRateLimit(request, env);
      if (rlErr) return rlErr;
      return await handleTrigger(request, env);
    }
    if (url.pathname === '/api/leads' && request.method === 'GET') {
      const profile = resolveProfileId(url.searchParams.get('profile'), env);
      return addCorsHeaders(await fetchLeads(env, profile), origin, env);
    }
    if (url.pathname === '/api/ppt' && request.method === 'POST') {
      return addCorsHeaders(await generatePPT(request, env), origin, env);
    }
    if (url.pathname === '/api/roleplay' && request.method === 'POST') {
      return addCorsHeaders(await handleRoleplay(request, env), origin, env);
    }
    if (url.pathname === '/api/history' && request.method === 'GET') {
      const profile = resolveProfileId(url.searchParams.get('profile'), env);
      return addCorsHeaders(await fetchHistory(env, profile), origin, env);
    }
    // POST /api/leads/batch-enrich — 일괄 심층 분석
    if (url.pathname === '/api/leads/batch-enrich' && request.method === 'POST') {
      return addCorsHeaders(await handleBatchEnrich(request, env), origin, env);
    }
    // POST /api/leads/:id/enrich — 단일 리드 심층 분석
    const enrichMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/enrich$/);
    if (enrichMatch && request.method === 'POST') {
      const leadId = decodeURIComponent(enrichMatch[1]);
      return addCorsHeaders(await handleEnrichLead(request, env, leadId), origin, env);
    }
    // PATCH /api/leads/:id — 리드 상태/메모 업데이트
    const leadPatchMatch = url.pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (leadPatchMatch && request.method === 'PATCH') {
      const leadId = decodeURIComponent(leadPatchMatch[1]);
      return addCorsHeaders(await handleUpdateLead(request, env, leadId), origin, env);
    }
    if (url.pathname === '/api/dashboard' && request.method === 'GET') {
      return addCorsHeaders(await handleDashboard(request, env), origin, env);
    }
    if (url.pathname === '/api/export/csv' && request.method === 'GET') {
      return addCorsHeaders(await handleExportCSV(request, env), origin, env);
    }
    // PWA
    if (url.pathname === '/manifest.json') {
      return new Response(JSON.stringify(getPWAManifest(env)), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    if (url.pathname === '/sw.js') {
      return new Response(getServiceWorkerJS(), {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }
      });
    }

    // 페이지 라우팅
    // /leads/:id 상세 페이지 (API가 아닌 HTML 페이지)
    const leadDetailMatch = url.pathname.match(/^\/leads\/([^/]+)$/);
    if (leadDetailMatch && !url.pathname.startsWith('/api/')) {
      const leadId = decodeURIComponent(leadDetailMatch[1]);
      const authErr = await verifyAuth(request, env);
      if (authErr) return addCorsHeaders(authErr, origin, env);
      if (!env.DB) {
        return new Response('시스템 설정이 필요합니다. 관리자에게 문의하세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      const lead = await getLeadById(env.DB, leadId);
      if (!lead) return new Response('리드를 찾을 수 없습니다.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      const statusLogs = await getStatusLogByLead(env.DB, leadId);
      return new Response(getLeadDetailPage(lead, statusLogs), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/leads') {
      return new Response(getLeadsPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/ppt') {
      return new Response(getPPTPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/roleplay') {
      return new Response(getRoleplayPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/history') {
      return new Response(getHistoryPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/dashboard') {
      return new Response(getDashboardPage(env), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response(getMainPage(env), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};

// ===== CORS =====

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = [env.WORKER_ORIGIN, 'http://localhost:8787'].filter(Boolean);
  return allowed.includes(origin);
}

function addCorsHeaders(response, origin, env) {
  if (!isAllowedOrigin(origin, env)) return response;
  const h = new Response(response.body, response);
  h.headers.set('Access-Control-Allow-Origin', origin);
  h.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  h.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  h.headers.set('Access-Control-Max-Age', '86400');
  h.headers.set('Vary', 'Origin');
  return h;
}

function handleOptions(request, env) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin, env)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// ===== Rate Limiting =====

async function checkRateLimit(request, env) {
  if (!env.RATE_LIMIT) return null; // KV 미설정 시 스킵
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const key = `rl:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowSec = 60;
  // IP 미식별 시 더 보수적 제한 (3회)
  const maxReqs = ip === 'unknown' ? 3 : 10;
  const stored = await env.RATE_LIMIT.get(key, 'json').catch(() => null);
  const record = stored && stored.ts > (now - windowSec) ? stored : { ts: now, c: 0 };
  record.c++;
  await env.RATE_LIMIT.put(key, JSON.stringify(record), { expirationTtl: windowSec });
  if (record.c > maxReqs) {
    return new Response(JSON.stringify({ success: false, message: '요청 한도 초과. 잠시 후 다시 시도하세요.' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(windowSec) }
    });
  }
  return null;
}

// ===== 인증 =====

async function verifyAuth(request, env) {
  const token = env.API_TOKEN || env.TRIGGER_PASSWORD;
  if (!token) {
    return jsonResponse({ success: false, message: '서버 인증 설정이 필요합니다.' }, 503);
  }
  const auth = request.headers.get('Authorization') || '';
  let bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  // CSV 다운로드 등 window.open용 쿼리 파라미터 토큰 fallback
  if (!bearer) {
    const url = new URL(request.url);
    bearer = url.searchParams.get('token') || '';
  }
  if (!bearer) return jsonResponse({ success: false, message: '인증이 필요합니다.' }, 401);
  const enc = new TextEncoder();
  const a = enc.encode(bearer);
  const b = enc.encode(token);
  if (a.byteLength !== b.byteLength) return jsonResponse({ success: false, message: '인증 실패' }, 401);
  const match = await crypto.subtle.timingSafeEqual(a, b);
  if (!match) return jsonResponse({ success: false, message: '인증 실패' }, 401);
  return null; // 인증 성공
}

// ===== API 핸들러 =====

async function handleTrigger(request, env) {
  const body = await request.json().catch(() => ({}));
  // Bearer token 또는 body password 허용
  const bearerAuth = await verifyAuth(request, env);
  const passwordOk = body.password && body.password === env.TRIGGER_PASSWORD;
  if (bearerAuth && !passwordOk) {
    return jsonResponse({ success: false, message: '비밀번호가 올바르지 않습니다.' }, 401);
  }
  const requestedProfile = typeof body.profile === 'string' ? body.profile.trim() : '';
  const profile = resolveProfileId(requestedProfile, env);
  if (requestedProfile && requestedProfile !== profile) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
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
      body: JSON.stringify({
        event_type: 'generate-report',
        client_payload: { profile }
      })
    }
  );

  if (response.status === 204) {
    return jsonResponse({ success: true, message: `[${profile}] 보고서 생성이 시작되었습니다. 1~2분 후 이메일을 확인하세요.` });
  }
  return jsonResponse({ success: false, message: `오류: ${response.status}` }, 500);
}

async function fetchLeads(env, profile) {
  try {
    // D1 우선 조회
    if (env.DB) {
      const dbLeads = await getLeadsByProfile(env.DB, profile);
      if (dbLeads.length > 0) return jsonResponse({ leads: dbLeads, profile, source: 'd1' });
    }

    // GitHub CDN fallback + lazy migration
    const response = await fetch(
      `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/${profile}/latest_leads.json?t=${Date.now()}`,
      { headers: { 'User-Agent': 'B2B-Lead-Worker', 'Cache-Control': 'no-cache' } }
    );
    if (!response.ok) return jsonResponse({ leads: [], message: '아직 생성된 리드가 없습니다.' });
    const leads = await response.json();

    // Lazy migration: GitHub → D1
    if (env.DB && leads.length > 0) {
      try { await saveLeadsBatch(env.DB, leads, profile, 'managed'); } catch { /* ignore migration errors */ }
    }

    return jsonResponse({ leads, profile, source: 'github' });
  } catch (e) {
    return jsonResponse({ leads: [], message: e.message }, 500);
  }
}

async function fetchHistory(env, profile) {
  try {
    // D1 우선 조회
    if (env.DB) {
      const dbHistory = await getLeadsByProfile(env.DB, profile, { limit: 500 });
      if (dbHistory.length > 0) return jsonResponse({ history: dbHistory, profile, source: 'd1' });
    }

    // GitHub CDN fallback + lazy migration
    const response = await fetch(
      `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/${profile}/lead_history.json?t=${Date.now()}`,
      { headers: { 'User-Agent': 'B2B-Lead-Worker', 'Cache-Control': 'no-cache' } }
    );
    if (!response.ok) return jsonResponse({ history: [], message: '아직 히스토리가 없습니다.' });
    const history = await response.json();

    // Lazy migration
    if (env.DB && history.length > 0) {
      try { await saveLeadsBatch(env.DB, history, profile, 'managed'); } catch { /* ignore */ }
    }

    return jsonResponse({ history, profile, source: 'github' });
  } catch (e) {
    return jsonResponse({ history: [], message: e.message }, 500);
  }
}

async function generatePPT(request, env) {
  const body = await request.json().catch(() => ({}));
  const { lead } = body;
  if (!lead) return jsonResponse({ success: false, message: '리드 데이터가 없습니다.' }, 400);

  const prompt = `당신은 B2B 기술 영업 전문가입니다.
아래 리드 정보를 바탕으로 고객사에 전달할 **5슬라이드 기술 영업 제안서** 구성안을 작성하세요.

[리드 정보]
- 기업: ${lead.company}
- 프로젝트: ${lead.summary}
- 추천 제품: ${lead.product}
- 예상 ROI: ${lead.roi}
- 글로벌 트렌드: ${lead.globalContext}

[슬라이드 구성 지시]
슬라이드 1 - 도입부: 고객사의 최근 성과(수주/착공 등)를 축하하며, 당면한 과제(에너지 효율, 규제 대응 등)를 언급
슬라이드 2 - 솔루션: ${lead.product}의 기술적 강점과 차별점을 구체적으로 설명
슬라이드 3 - 경제적 가치: ROI 수치를 시각화 제안 (Before/After 비교표, 절감액 그래프 등)
슬라이드 4 - 규제 대응: 관련 글로벌 규제(${lead.globalContext}) 준수 로드맵 제시
슬라이드 5 - Next Step: 파일럿 테스트 제안, 기술 미팅 일정 등 구체적 후속 조치

각 슬라이드에 대해 [제목], [핵심 메시지 2~3줄], [추천 시각자료]를 포함해서 작성하세요.
마크다운 형식으로 출력하세요.`;

  try {
    const result = await callGemini(prompt, env);
    return jsonResponse({ success: true, content: result });
  } catch (e) {
    return jsonResponse({ success: false, message: 'AI 분석 중 오류가 발생했습니다:' + e.message }, 500);
  }
}

async function handleRoleplay(request, env) {
  const body = await request.json().catch(() => ({}));
  const { lead, history, userMessage } = body;
  if (!lead) return jsonResponse({ success: false, message: '리드 데이터가 없습니다.' }, 400);

  const conversationHistory = (history || []).map(h =>
    `${h.role === 'user' ? '영업사원' : '고객'}: ${h.content}`
  ).join('\n');

  const prompt = `당신은 ${lead.company}의 구매 담당 임원입니다. 까다롭고 가격에 민감하며, 경쟁사 제품과 항상 비교합니다.

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
${userMessage || '안녕하세요. 귀사의 프로젝트에 대해 제안드리고 싶습니다.'}

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
    return jsonResponse({ success: false, message: 'AI 분석 중 오류가 발생했습니다:' + e.message }, 500);
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
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
}

// ===== D1 DB 헬퍼 =====

let d1SchemaReadyPromise = null;

async function ensureD1Schema(db) {
  if (!db) return;
  if (!d1SchemaReadyPromise) {
    d1SchemaReadyPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL DEFAULT 'self-service',
        source TEXT NOT NULL DEFAULT 'managed',
        status TEXT NOT NULL DEFAULT 'NEW',
        company TEXT NOT NULL,
        summary TEXT,
        product TEXT,
        score INTEGER DEFAULT 0,
        grade TEXT DEFAULT 'B',
        roi TEXT,
        sales_pitch TEXT,
        global_context TEXT,
        sources TEXT DEFAULT '[]',
        notes TEXT DEFAULT '',
        enriched INTEGER DEFAULT 0,
        article_body TEXT DEFAULT '',
        action_items TEXT DEFAULT '[]',
        key_figures TEXT DEFAULT '[]',
        pain_points TEXT DEFAULT '[]',
        enriched_at TEXT,
        follow_up_date TEXT DEFAULT '',
        estimated_value INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        profile_id TEXT,
        company TEXT,
        industry TEXT,
        leads_count INTEGER DEFAULT 0,
        articles_count INTEGER DEFAULT 0,
        elapsed_sec INTEGER DEFAULT 0,
        ip_hash TEXT,
        created_at TEXT NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at DESC)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS status_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT NOT NULL,
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        changed_at TEXT NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_status_log_lead ON status_log(lead_id)')
    ]).then(async () => {
      const alterCols = [
        "ALTER TABLE leads ADD COLUMN enriched INTEGER DEFAULT 0",
        "ALTER TABLE leads ADD COLUMN article_body TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN action_items TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN key_figures TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN pain_points TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN enriched_at TEXT",
        "ALTER TABLE leads ADD COLUMN follow_up_date TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN estimated_value INTEGER DEFAULT 0"
      ];
      for (const sql of alterCols) {
        try { await db.prepare(sql).run(); } catch { /* column already exists */ }
      }
    }).catch((err) => {
      d1SchemaReadyPromise = null;
      throw err;
    });
  }
  await d1SchemaReadyPromise;
}

function rowToLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    profileId: row.profile_id,
    source: row.source,
    status: row.status,
    company: row.company,
    summary: row.summary,
    product: row.product,
    score: Number(row.score) || 0,
    grade: row.grade,
    roi: row.roi,
    salesPitch: row.sales_pitch,
    globalContext: row.global_context,
    sources: (() => { try { return JSON.parse(row.sources || '[]'); } catch { return []; } })(),
    notes: row.notes || '',
    enriched: Number(row.enriched) || 0,
    articleBody: row.article_body || '',
    actionItems: (() => { try { return JSON.parse(row.action_items || '[]'); } catch { return []; } })(),
    keyFigures: (() => { try { return JSON.parse(row.key_figures || '[]'); } catch { return []; } })(),
    painPoints: (() => { try { return JSON.parse(row.pain_points || '[]'); } catch { return []; } })(),
    enrichedAt: row.enriched_at || null,
    followUpDate: row.follow_up_date || '',
    estimatedValue: Number(row.estimated_value) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function leadToRow(lead, profileId, source) {
  const now = new Date().toISOString();
  const id = lead.id || `${(lead.company || 'unknown').replace(/\s+/g, '_')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    profile_id: profileId,
    source: source || 'managed',
    status: lead.status || 'NEW',
    company: lead.company || '',
    summary: lead.summary || '',
    product: lead.product || '',
    score: Number(lead.score) || 0,
    grade: lead.grade || 'B',
    roi: lead.roi || '',
    sales_pitch: lead.salesPitch || '',
    global_context: lead.globalContext || '',
    sources: JSON.stringify(Array.isArray(lead.sources) ? lead.sources : []),
    notes: lead.notes || '',
    created_at: lead.createdAt || now,
    updated_at: lead.updatedAt || now
  };
}

async function saveLeadsBatch(db, leads, profileId, source) {
  if (!db || !leads || leads.length === 0) return;
  await ensureD1Schema(db);
  const stmt = db.prepare(
    `INSERT INTO leads (id, profile_id, source, status, company, summary, product, score, grade, roi, sales_pitch, global_context, sources, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       summary=excluded.summary, product=excluded.product, score=excluded.score,
       grade=excluded.grade, roi=excluded.roi, sales_pitch=excluded.sales_pitch,
       global_context=excluded.global_context, sources=excluded.sources, updated_at=excluded.updated_at`
  );
  const batch = leads.map(lead => {
    const r = leadToRow(lead, profileId, source);
    return stmt.bind(r.id, r.profile_id, r.source, r.status, r.company, r.summary, r.product, r.score, r.grade, r.roi, r.sales_pitch, r.global_context, r.sources, r.notes, r.created_at, r.updated_at);
  });
  await db.batch(batch);
}

async function getLeadsByProfile(db, profileId, options = {}) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { status, limit = 100, offset = 0 } = options;
  let sql = 'SELECT * FROM leads WHERE profile_id = ?';
  const params = [profileId];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const { results } = await db.prepare(sql).bind(...params).all();
  return (results || []).map(rowToLead);
}

async function getAllLeads(db, options = {}) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { status, limit = 500, offset = 0 } = options;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const { results } = await db.prepare(sql).bind(...params).all();
  return (results || []).map(rowToLead);
}

async function getLeadById(db, id) {
  if (!db) return null;
  await ensureD1Schema(db);
  const row = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  return rowToLead(row);
}

const VALID_TRANSITIONS = {
  NEW: ['CONTACTED'],
  CONTACTED: ['MEETING'],
  MEETING: ['PROPOSAL'],
  PROPOSAL: ['NEGOTIATION'],
  NEGOTIATION: ['WON', 'LOST'],
  LOST: ['NEW'],
  WON: []
};

async function updateLeadStatus(db, id, newStatus, fromStatus) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').bind(newStatus, now, id),
    db.prepare('INSERT INTO status_log (lead_id, from_status, to_status, changed_at) VALUES (?, ?, ?, ?)').bind(id, fromStatus, newStatus, now)
  ]);
  return true;
}

async function updateLeadNotes(db, id, notes) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare('UPDATE leads SET notes = ?, updated_at = ? WHERE id = ?').bind(notes, now, id).run();
  return true;
}

async function getStatusLogByLead(db, leadId) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { results } = await db.prepare(
    'SELECT * FROM status_log WHERE lead_id = ? ORDER BY changed_at ASC'
  ).bind(leadId).all();
  return (results || []).map(r => ({
    fromStatus: r.from_status, toStatus: r.to_status, changedAt: r.changed_at
  }));
}

// ===== 리드 심층 분석 (Enrichment) =====

function pickBestSourceUrl(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const direct = sources.find(s => s.url && !/news\.google\.com/i.test(s.url));
  return (direct || sources[0])?.url || null;
}

async function fetchArticleBodyWorker(url) {
  if (!url) return '';
  let timer = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2BLeadBot/1.0)' }
    });
    if (!res.ok) return '';
    const html = await res.text();
    return extractBodyFromHTML(html);
  } catch {
    return '';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractBodyFromHTML(html) {
  if (!html) return '';
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<nav[\s\S]*?<\/nav>/gi, '').replace(/<footer[\s\S]*?<\/footer>/gi, '').replace(/<header[\s\S]*?<\/header>/gi, '');

  // og:description 추출
  const ogMatch = text.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  const ogDesc = ogMatch ? ogMatch[1] : '';

  // article 태그 내 p 태그 수집
  const articleMatch = text.match(/<article[\s\S]*?<\/article>/i);
  const zone = articleMatch ? articleMatch[0] : text;
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(zone)) !== null) {
    const clean = m[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 30) paragraphs.push(clean);
  }

  const body = paragraphs.join('\n');
  const combined = ogDesc ? ogDesc + '\n\n' + body : body;
  return combined.slice(0, 3000);
}

async function callGeminiEnrich(lead, articleBody, env) {
  const hasBody = articleBody && articleBody.length > 50;
  const prompt = `You are a B2B sales intelligence analyst. Analyze this lead and provide deep enrichment.

## Lead Info
- Company: ${lead.company}
- Summary: ${lead.summary || 'N/A'}
- Product: ${lead.product || 'N/A'}
- Current ROI: ${lead.roi || 'N/A'}
- Current Sales Pitch: ${lead.salesPitch || 'N/A'}

${hasBody ? `## Article Body (source material)\n${articleBody}` : '## Note: No article body available. Analyze based on the lead title/summary only, but clearly indicate this limitation.'}

## Task (Chain-of-Thought)
1. Extract key figures (numbers, percentages, financial data, capacity, timeline)
2. Identify pain points (challenges, problems, needs mentioned or implied)
3. Connect to recommended product — how specifically does it solve the pain points?
4. Calculate realistic ROI with concrete numbers (not generic)
5. Generate actionable next steps for the sales team

## Output JSON (strict format, Korean)
{
  "summary": "개선된 1-2문장 요약 (구체적 수치 포함)",
  "roi": "구체적 ROI 분석 (숫자 기반, 예: '연간 15억원 에너지 비용 중 20% 절감 가능 → 3억원')",
  "salesPitch": "고객 과제를 먼저 언급하고, 정량적 해결 방안과 레퍼런스를 포함한 3문장 영업 제안",
  "globalContext": "글로벌 시장/기술 트렌드와의 연결 (구체적 사례나 수치)",
  "actionItems": ["1주 내 실행 가능한 후속 조치 (담당 부서/직급 포함)", "...", "..."],
  "keyFigures": ["수치1: 설명", "수치2: 설명"],
  "painPoints": ["비용/규제/경쟁/기술 관점의 구체적 과제 (정량 수치 포함)", "..."]
}

Return ONLY valid JSON, no markdown fences.`;

  const raw = await callGemini(prompt, env);
  const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Enrichment JSON 파싱 실패');
  }
}

function normalizeStringArray(value, maxLen = 10) {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, maxLen);
}

function clampText(value, fallback = '', maxLen = 800) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw) return raw.slice(0, maxLen);
  const fb = typeof fallback === 'string' ? fallback.trim() : '';
  return fb.slice(0, maxLen);
}

function normalizeEnrichData(enrichData, lead) {
  const data = enrichData && typeof enrichData === 'object' ? enrichData : {};
  return {
    summary: clampText(data.summary, lead.summary, 500),
    roi: clampText(data.roi, lead.roi, 500),
    salesPitch: clampText(data.salesPitch, lead.salesPitch, 700),
    globalContext: clampText(data.globalContext, lead.globalContext, 700),
    actionItems: normalizeStringArray(data.actionItems, 10),
    keyFigures: normalizeStringArray(data.keyFigures, 10),
    painPoints: normalizeStringArray(data.painPoints, 10)
  };
}

async function updateLeadEnrichment(db, id, enrichData, articleBody) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE leads SET
      enriched = 1,
      summary = ?, roi = ?, sales_pitch = ?, global_context = ?,
      article_body = ?, action_items = ?, key_figures = ?, pain_points = ?,
      enriched_at = ?, updated_at = ?
    WHERE id = ?`
  ).bind(
    enrichData.summary || '', enrichData.roi || '', enrichData.salesPitch || '', enrichData.globalContext || '',
    articleBody || '', JSON.stringify(enrichData.actionItems || []), JSON.stringify(enrichData.keyFigures || []), JSON.stringify(enrichData.painPoints || []),
    now, now, id
  ).run();
  return true;
}

async function logAnalyticsRun(db, data) {
  if (!db) return;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO analytics (type, profile_id, company, industry, leads_count, articles_count, elapsed_sec, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(data.type, data.profileId || null, data.company || null, data.industry || null, data.leadsCount || 0, data.articlesCount || 0, data.elapsedSec || 0, data.ipHash || null, now).run();
}

async function getDashboardMetrics(db, profileId) {
  if (!db) return null;
  await ensureD1Schema(db);
  const isAll = !profileId || profileId === 'all';
  const where = isAll ? '' : ' WHERE profile_id = ?';
  const bind = isAll ? [] : [profileId];

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [total, gradeA, statusCounts, wonCount, recentActivity, analyticsCounts, allLogs, pipelineValue, followUpLeads] = await db.batch([
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where}`).bind(...bind),
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} grade = 'A'`).bind(...bind),
    db.prepare(`SELECT status, COUNT(*) as cnt FROM leads${where} GROUP BY status`).bind(...bind),
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} status = 'WON'`).bind(...bind),
    db.prepare(`SELECT sl.from_status, sl.to_status, sl.changed_at, l.company FROM status_log sl JOIN leads l ON sl.lead_id = l.id${isAll ? '' : ' WHERE l.profile_id = ?'} ORDER BY sl.changed_at DESC LIMIT 10`).bind(...bind),
    db.prepare(`SELECT type, COUNT(*) as cnt, SUM(leads_count) as total_leads FROM analytics${where ? ' WHERE profile_id = ?' : ''} GROUP BY type`).bind(...(isAll ? [] : [profileId])),
    db.prepare(`SELECT sl.lead_id, sl.from_status, sl.to_status, sl.changed_at FROM status_log sl JOIN leads l ON sl.lead_id = l.id${isAll ? '' : ' WHERE l.profile_id = ?'} ORDER BY sl.changed_at ASC`).bind(...bind),
    db.prepare(`SELECT status, SUM(estimated_value) as total_value FROM leads${where} GROUP BY status`).bind(...bind),
    db.prepare(`SELECT id, company, follow_up_date, status FROM leads${where ? where + ' AND' : ' WHERE'} follow_up_date != '' AND follow_up_date <= ? AND status NOT IN ('WON','LOST') ORDER BY follow_up_date ASC LIMIT 20`).bind(...bind, tomorrow)
  ]);

  const totalCount = total.results?.[0]?.cnt || 0;
  const gradeACount = gradeA.results?.[0]?.cnt || 0;
  const wonCountVal = wonCount.results?.[0]?.cnt || 0;
  const statusDist = {};
  (statusCounts.results || []).forEach(r => { statusDist[r.status] = r.cnt; });
  const active = totalCount - (statusDist.WON || 0) - (statusDist.LOST || 0);

  // 단계별 전환율 계산
  const stageOrder = ['NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON'];
  const transitionCounts = {};
  (allLogs.results || []).forEach(r => {
    const key = `${r.from_status}→${r.to_status}`;
    transitionCounts[key] = (transitionCounts[key] || 0) + 1;
  });
  const stageConversions = [];
  for (let i = 0; i < stageOrder.length - 1; i++) {
    const from = stageOrder[i];
    const to = stageOrder[i + 1];
    const key = `${from}→${to}`;
    const fromCount = statusDist[from] || 0;
    const transitioned = transitionCounts[key] || 0;
    const denominator = fromCount + transitioned;
    stageConversions.push({
      from, to,
      rate: denominator > 0 ? Math.round((transitioned / denominator) * 100) : 0,
      count: transitioned
    });
  }

  // 평균 체류 시간 계산
  const logList = allLogs.results || [];
  const dwellTimes = {};
  const dwellCounts = {};
  for (let i = 0; i < logList.length; i++) {
    const log = logList[i];
    const from = log.from_status;
    // 같은 리드의 이전 진입 시점 찾기
    let entryTime = null;
    for (let j = i - 1; j >= 0; j--) {
      if (logList[j].lead_id === log.lead_id && logList[j].to_status === from) {
        entryTime = logList[j].changed_at;
        break;
      }
    }
    if (entryTime) {
      const days = Math.max(0, (new Date(log.changed_at) - new Date(entryTime)) / (1000 * 60 * 60 * 24));
      dwellTimes[from] = (dwellTimes[from] || 0) + days;
      dwellCounts[from] = (dwellCounts[from] || 0) + 1;
    }
  }
  const avgDwellDays = {};
  Object.keys(dwellTimes).forEach(s => {
    avgDwellDays[s] = dwellCounts[s] > 0 ? Math.round(dwellTimes[s] / dwellCounts[s] * 10) / 10 : 0;
  });

  // 진행 중 거래 총액
  const pipelineValueByStatus = {};
  let totalPipelineValue = 0;
  (pipelineValue.results || []).forEach(r => {
    const v = Number(r.total_value) || 0;
    pipelineValueByStatus[r.status] = v;
    if (r.status !== 'LOST') totalPipelineValue += v;
  });

  // 후속 조치 알림
  const followUpAlerts = (followUpLeads.results || []).map(r => ({
    id: r.id, company: r.company, followUpDate: r.follow_up_date, status: r.status,
    isOverdue: r.follow_up_date < today,
    isToday: r.follow_up_date === today
  }));

  return {
    total: totalCount,
    gradeA: gradeACount,
    won: wonCountVal,
    conversionRate: totalCount > 0 ? Math.round((wonCountVal / totalCount) * 100) : 0,
    active,
    statusDistribution: statusDist,
    stageConversions,
    avgDwellDays,
    totalPipelineValue,
    pipelineValueByStatus,
    followUpAlerts,
    recentActivity: (recentActivity.results || []).map(r => ({
      company: r.company, fromStatus: r.from_status, toStatus: r.to_status, changedAt: r.changed_at
    })),
    analyticsByType: (analyticsCounts.results || []).reduce((acc, r) => {
      acc[r.type] = { runs: r.cnt, totalLeads: r.total_leads }; return acc;
    }, {})
  };
}

// ===== Enrichment API 핸들러 =====

async function handleEnrichLead(request, env, leadId) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  if (!env.GEMINI_API_KEY) return jsonResponse({ success: false, message: '서버 설정 오류: GEMINI_API_KEY가 설정되지 않았습니다.' }, 503);
  const lead = await getLeadById(env.DB, leadId);
  if (!lead) return jsonResponse({ success: false, message: '리드를 찾을 수 없습니다.' }, 404);

  const url = new URL(request.url);
  if (lead.enriched && !url.searchParams.get('force')) {
    return jsonResponse({ success: false, message: '이미 분석된 리드입니다. 재분석 버튼을 이용하세요.', lead }, 409);
  }

  try {
    const sourceUrl = pickBestSourceUrl(lead.sources);
    const articleBody = await fetchArticleBodyWorker(sourceUrl);
    const enrichData = normalizeEnrichData(await callGeminiEnrich(lead, articleBody, env), lead);
    await updateLeadEnrichment(env.DB, leadId, enrichData, articleBody);

    const updated = await getLeadById(env.DB, leadId);
    return jsonResponse({ success: true, lead: updated, hadArticle: articleBody.length > 50 });
  } catch (e) {
    return jsonResponse({ success: false, message: '심층 분석 실패: ' + (e?.message || 'unknown error') }, 502);
  }
}

async function handleBatchEnrich(request, env) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  if (!env.GEMINI_API_KEY) return jsonResponse({ success: false, message: '서버 설정 오류: GEMINI_API_KEY가 설정되지 않았습니다.' }, 503);
  const body = await request.json().catch(() => ({}));
  const requestedProfile = typeof body.profile === 'string' ? body.profile.trim() : '';
  const profileId = resolveProfileId(requestedProfile, env);
  if (requestedProfile && requestedProfile !== profileId) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }

  await ensureD1Schema(env.DB);
  const { results } = await env.DB.prepare(
    'SELECT * FROM leads WHERE profile_id = ? AND (enriched IS NULL OR enriched = 0) ORDER BY score DESC LIMIT 3'
  ).bind(profileId).all();

  if (!results || results.length === 0) {
    const { results: remaining } = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM leads WHERE profile_id = ? AND (enriched IS NULL OR enriched = 0)'
    ).bind(profileId).all();
    return jsonResponse({ success: true, enriched: 0, remaining: remaining?.[0]?.cnt || 0, message: '분석할 리드가 없습니다.' });
  }

  const enrichedResults = [];
  for (const row of results) {
    const lead = rowToLead(row);
    try {
      const sourceUrl = pickBestSourceUrl(lead.sources);
      const articleBody = await fetchArticleBodyWorker(sourceUrl);
      const enrichData = normalizeEnrichData(await callGeminiEnrich(lead, articleBody, env), lead);
      await updateLeadEnrichment(env.DB, lead.id, enrichData, articleBody);
      enrichedResults.push({ id: lead.id, company: lead.company, success: true });
    } catch (err) {
      enrichedResults.push({ id: lead.id, company: lead.company, success: false, error: err.message });
    }
  }

  const { results: remainingRows } = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM leads WHERE profile_id = ? AND (enriched IS NULL OR enriched = 0)'
  ).bind(profileId).all();
  const remaining = remainingRows?.[0]?.cnt || 0;

  return jsonResponse({
    success: true,
    enriched: enrichedResults.filter(r => r.success).length,
    failed: enrichedResults.filter(r => !r.success).length,
    remaining,
    results: enrichedResults
  });
}

// ===== 새 API 핸들러 =====

async function handleUpdateLead(request, env, leadId) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const body = await request.json().catch(() => ({}));
  const lead = await getLeadById(env.DB, leadId);
  if (!lead) return jsonResponse({ success: false, message: '리드를 찾을 수 없습니다.' }, 404);

  if (body.status && body.status !== lead.status) {
    const allowed = VALID_TRANSITIONS[lead.status] || [];
    if (!allowed.includes(body.status)) {
      return jsonResponse({
        success: false,
        message: `상태 전환 불가: ${lead.status} → ${body.status}. 허용: ${allowed.join(', ') || '없음'}`
      }, 400);
    }
    await updateLeadStatus(env.DB, leadId, body.status, lead.status);
  }

  if (typeof body.notes === 'string') {
    await updateLeadNotes(env.DB, leadId, body.notes.slice(0, 2000));
  }

  // follow_up_date 업데이트
  if (typeof body.follow_up_date === 'string') {
    const dateVal = body.follow_up_date.trim();
    if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      return jsonResponse({ success: false, message: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)' }, 400);
    }
    if (dateVal) {
      const parsed = new Date(`${dateVal}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateVal) {
        return jsonResponse({ success: false, message: '유효하지 않은 날짜입니다.' }, 400);
      }
    }
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE leads SET follow_up_date = ?, updated_at = ? WHERE id = ?').bind(dateVal, now, leadId).run();
  }

  // estimated_value 업데이트
  if (body.estimated_value !== undefined) {
    const parsed = Number(body.estimated_value);
    const val = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE leads SET estimated_value = ?, updated_at = ? WHERE id = ?').bind(val, now, leadId).run();
  }

  const updated = await getLeadById(env.DB, leadId);
  return jsonResponse({ success: true, lead: updated });
}

async function handleDashboard(request, env) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const url = new URL(request.url);
  const requestedProfile = (url.searchParams.get('profile') || 'all').trim();
  if (requestedProfile !== 'all' && requestedProfile !== resolveProfileId(requestedProfile, env)) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }
  const profileId = requestedProfile;
  const metrics = await getDashboardMetrics(env.DB, profileId);
  return jsonResponse({ success: true, metrics, profile: profileId });
}

async function handleExportCSV(request, env) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const url = new URL(request.url);
  const requestedProfile = (url.searchParams.get('profile') || 'all').trim();
  if (requestedProfile !== 'all' && requestedProfile !== resolveProfileId(requestedProfile, env)) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }
  const profileId = requestedProfile;
  const leads = profileId === 'all'
    ? await getAllLeads(env.DB, { limit: 1000 })
    : await getLeadsByProfile(env.DB, profileId, { limit: 1000 });

  const BOM = '\uFEFF';
  const header = '회사명,프로젝트,추천제품,점수,등급,ROI,상태,메모,생성일';
  const rows = leads.map(l => {
    const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
    return [esc(l.company), esc(l.summary), esc(l.product), l.score, l.grade, esc(l.roi), l.status, esc(l.notes), l.createdAt?.split('T')[0] || ''].join(',');
  });
  const csv = BOM + header + '\n' + rows.join('\n');
  const filename = `leads_${profileId}_${new Date().toISOString().split('T')[0]}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

// ===== PWA =====

function getPWAManifest(env) {
  return {
    name: 'B2B Sales Intelligence',
    short_name: 'B2B Leads',
    description: 'AI 기반 영업 인텔리전스 플랫폼',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1a2e',
    theme_color: '#e94560',
    icons: [
      { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>', sizes: '512x512', type: 'image/svg+xml' }
    ]
  };
}

function getServiceWorkerJS() {
  return `const CACHE = 'b2b-leads-v1';
const PRECACHE = ['/', '/leads', '/dashboard', '/history'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});`;
}

// ===== 셀프서비스: XML 파싱 유틸 =====

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? decodeXmlEntities(m[1].trim()) : '';
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title').replace(/<[^>]*>/g, '');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    if (title && link) {
      items.push({ title, link, pubDate, source: 'Google News' });
    }
  }
  return items;
}

// ===== 셀프서비스: 뉴스 수집 =====

async function fetchGoogleNewsWorker(query) {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}+when:3d&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2BLeadBot/1.0)' }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSItems(xml).slice(0, 5).map(item => ({ ...item, query }));
  } catch {
    return [];
  }
}

async function fetchAllNewsWorker(queries) {
  const results = await Promise.allSettled(
    queries.map(q => fetchGoogleNewsWorker(q))
  );
  const allArticles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
  return removeDuplicatesWorker(allArticles);
}

function removeDuplicatesWorker(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.replace(/\s+/g, '').toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    // Jaccard-like check against existing keys
    for (const existing of seen) {
      const set1 = new Set(key);
      const set2 = new Set(existing);
      const intersection = [...set1].filter(c => set2.has(c)).length;
      const union = new Set([...set1, ...set2]).size;
      if (union > 0 && intersection / union > 0.8) return false;
    }
    seen.add(key);
    return true;
  });
}

function extractCompanyNameWorker(title = '') {
  const cleaned = String(title)
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/["'""'']/g, '')
    .trim();
  const m = cleaned.match(/^([A-Za-z0-9가-힣&(). -]{2,30}?)(?:,|\s|-|…)/);
  return m ? m[1].trim() : '잠재 고객사';
}

function detectCategoryWorker(article, profile) {
  const rules = profile.categoryRules && typeof profile.categoryRules === 'object' ? profile.categoryRules : {};
  const categories = Object.keys(rules);
  if (categories.length === 0) return '';

  const text = `${article.title || ''} ${article.query || ''}`.toLowerCase();
  for (const category of categories) {
    const keywords = Array.isArray(rules[category]) ? rules[category] : [];
    if (keywords.some(k => String(k).toLowerCase() && text.includes(String(k).toLowerCase()))) {
      return category;
    }
  }
  return categories[0];
}

function generateQuickLeadsWorker(articles, profile) {
  const configs = profile.categoryConfig && typeof profile.categoryConfig === 'object' ? profile.categoryConfig : {};
  const fallbackCategory = Object.keys(configs)[0];
  const companySeen = new Set();
  const leads = [];

  for (const article of articles) {
    const category = detectCategoryWorker(article, profile) || fallbackCategory;
    const cfg = configs[category] || configs[fallbackCategory];
    if (!cfg) continue;

    const company = extractCompanyNameWorker(article.title);
    if (companySeen.has(company)) continue;
    companySeen.add(company);

    const pitchTemplate = typeof cfg.pitch === 'string' && cfg.pitch.trim()
      ? cfg.pitch
      : '{company}에 {product}를 제안합니다.';
    const summary = String(article.title || '')
      .replace(/<[^>]*>/g, '')
      .replace(/^\[.*?\]\s*/g, '')
      .trim()
      .slice(0, 140);

    leads.push({
      company,
      summary: summary || '프로젝트 관련 신규 동향 포착',
      product: cfg.product || '맞춤 솔루션',
      score: Number(cfg.score) || 70,
      grade: cfg.grade || 'B',
      roi: cfg.roi || '운영 효율 개선 예상',
      salesPitch: pitchTemplate
        .replace(/\{company\}/g, company)
        .replace(/\{product\}/g, cfg.product || '맞춤 솔루션'),
      globalContext: cfg.policy || '산업 규제 및 효율화 트렌드 대응',
      sources: article.title && article.link ? [{ title: article.title, url: article.link }] : []
    });

    if (leads.length >= 5) break;
  }

  return leads;
}

// ===== 셀프서비스: 프로필 자동 생성 =====

async function generateProfileFromGemini(company, industry, env) {
  const prompt = `당신은 B2B 영업 전략 전문가입니다.
아래 회사 정보를 바탕으로 B2B 리드 발굴용 프로필 JSON을 생성하세요.

회사명: ${company}
산업: ${industry}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

{
  "name": "회사 한글명",
  "industry": "산업 분야",
  "competitors": ["경쟁사1", "경쟁사2", "경쟁사3"],
  "products": {
    "category1": ["제품A", "제품B"],
    "category2": ["제품C", "제품D"]
  },
  "productKnowledge": {
    "대표 제품1": { "value": "핵심 가치", "roi": "ROI 근거" },
    "대표 제품2": { "value": "핵심 가치", "roi": "ROI 근거" }
  },
  "searchQueries": ["뉴스 검색 키워드1", "키워드2", "키워드3", "키워드4", "키워드5", "키워드6", "키워드7"],
  "categoryRules": {
    "category1": ["분류키워드1", "분류키워드2"],
    "category2": ["분류키워드3", "분류키워드4"]
  },
  "categoryConfig": {
    "category1": {
      "product": "기본 추천 제품",
      "score": 75,
      "grade": "B",
      "roi": "예상 ROI 설명",
      "policy": "관련 정책/규제",
      "pitch": "{company}에 {product}를 통한 효율 개선을 제안합니다."
    }
  }
}

주의사항:
- searchQueries는 한국어로 7개, 해당 산업의 실제 뉴스 키워드
- categoryConfig의 pitch는 반드시 {company}와 {product} 플레이스홀더 사용
- 실제 산업 지식 기반으로 현실적인 ROI 수치 제시
- competitors는 실제 경쟁사 3개`;

  const result = await callGemini(prompt, env);
  // 코드블록 제거 후 JSON 파싱
  let cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const searchQueries = (Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [])
    .map(q => (typeof q === 'string' ? q.trim() : ''))
    .filter(Boolean)
    .slice(0, 7);
  const categoryConfig = parsed.categoryConfig && typeof parsed.categoryConfig === 'object'
    ? parsed.categoryConfig
    : {};

  // 필수 필드 검증
  if (searchQueries.length === 0) {
    throw new Error('프로필 생성 실패: searchQueries 누락');
  }
  if (Object.keys(categoryConfig).length === 0) {
    throw new Error('프로필 생성 실패: categoryConfig 누락');
  }

  return {
    ...parsed,
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : company,
    industry: typeof parsed.industry === 'string' && parsed.industry.trim() ? parsed.industry.trim() : industry,
    competitors: Array.isArray(parsed.competitors)
      ? parsed.competitors
          .map(c => (typeof c === 'string' ? c.trim() : ''))
          .filter(Boolean)
          .slice(0, 5)
      : [],
    searchQueries,
    categoryConfig
  };
}

function generateHeuristicProfile(company, industry) {
  const coreProduct = `${industry} 최적화 솔루션`;
  return {
    name: company,
    industry,
    competitors: [],
    products: {
      core: [coreProduct]
    },
    productKnowledge: {
      [coreProduct]: {
        value: '운영 안정성 강화 및 에너지 효율 개선',
        roi: '운영비 10~20% 절감 가능'
      }
    },
    searchQueries: [
      `${company} ${industry} 투자`,
      `${company} ${industry} 증설`,
      `${industry} 신사업 수주`,
      `${industry} 설비 도입`,
      `${industry} 공장 착공`,
      `${industry} 자동화`,
      `${industry} 탄소중립`
    ],
    categoryRules: {
      core: [company, industry, '투자', '수주', '착공', '증설', '계약']
    },
    categoryConfig: {
      core: {
        product: coreProduct,
        score: 72,
        grade: 'B',
        roi: '운영비 10~20% 절감 예상',
        policy: '산업 전반의 에너지 효율화 및 탄소중립 정책 대응',
        pitch: '{company}의 신규 프로젝트에 {product} 기반 효율 개선을 제안합니다.'
      }
    }
  };
}

// ===== 셀프서비스: 리드 분석 =====

async function analyzeLeadsWorker(articles, profile, env) {
  if (articles.length === 0) return [];

  const newsList = articles.map((a, i) => {
    return `${i + 1}. [${a.source}] ${a.title} (URL: ${a.link}) (검색키워드: ${a.query})`;
  }).join('\n');

  const knowledgeBase = profile.productKnowledge
    ? Object.entries(profile.productKnowledge)
        .map(([name, info]) => `- ${name}: 핵심가치="${info.value}", ROI="${info.roi}"`)
        .join('\n')
    : '(자동 생성 프로필)';

  const productLineup = profile.products
    ? Object.entries(profile.products)
        .map(([cat, items]) => `- ${cat}: ${Array.isArray(items) ? items.join(', ') : items}`)
        .join('\n')
    : '(자동 생성 프로필)';

  const prompt = `[Role]
당신은 ${profile.name}의 'AI 기술 영업 전략가'입니다.
아래 뉴스에서 영업 기회를 포착하고 분석하세요.

[제품 지식]
${knowledgeBase}

[제품 라인업]
${productLineup}

[경쟁사]
${(profile.competitors || []).join(', ')}

[스코어링]
- Grade A (80-100점): 구체적 착공/수주/예산 언급
- Grade B (50-79점): 산업 트렌드로 수요 예상
- Grade C (0-49점): 제외

[뉴스 목록]
${newsList}

[Format]
Grade C 제외, A와 B만 JSON 배열로 응답. 다른 텍스트 없이 JSON만.
[
  {
    "company": "타겟 기업명",
    "summary": "프로젝트 내용 1줄 요약",
    "product": "추천 ${profile.name} 제품 1개",
    "score": 75,
    "grade": "B",
    "roi": "예상 ROI",
    "salesPitch": "고객 담당자에게 보낼 메일 첫 문장",
    "globalContext": "관련 글로벌 정책/트렌드",
    "sources": [{"title": "기사 제목", "url": "기사 URL"}]
  }
]`;

  const result = await callGemini(prompt, env);
  let cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const leads = JSON.parse(cleaned);
  return (Array.isArray(leads) ? leads : []).filter(
    lead => lead && typeof lead.company === 'string' && typeof lead.score === 'number'
  ).map(lead => ({
    ...lead,
    sources: Array.isArray(lead.sources) ? lead.sources.filter(s => s && s.title && s.url) : []
  }));
}

// ===== 셀프서비스: Rate Limit =====

async function checkSelfServiceRateLimit(request, env) {
  const enabled = String(env.ENABLE_SELF_SERVICE_RATE_LIMIT || '').toLowerCase() === 'true';
  if (!enabled || !env.RATE_LIMIT) return null;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const key = `ss:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowSec = Number(env.SELF_SERVICE_RATE_LIMIT_WINDOW_SEC) || 3600; // 기본 1시간
  const maxReqs = Number(env.SELF_SERVICE_RATE_LIMIT_MAX) || 3;
  const stored = await env.RATE_LIMIT.get(key, 'json').catch(() => null);
  const record = stored && stored.ts > (now - windowSec) ? stored : { ts: now, c: 0 };
  record.c++;
  await env.RATE_LIMIT.put(key, JSON.stringify(record), { expirationTtl: windowSec });
  if (record.c > maxReqs) {
    return jsonResponse({
      success: false,
      message: `셀프서비스는 시간당 ${maxReqs}회까지 사용 가능합니다. 잠시 후 다시 시도하세요.`
    }, 429);
  }
  return null;
}

// ===== 셀프서비스: 핸들러 =====

async function handleSelfServiceAnalyze(request, env) {
  const softDeadlineMs = 28500;
  const profileTimeoutMs = 9000;
  const startTime = Date.now();
  const body = await request.json().catch(() => ({}));
  const company = (body.company || '').trim().slice(0, 50);
  const industry = (body.industry || '').trim().slice(0, 50);
  let profile = null;
  let profileMode = 'ai';
  let articles = [];
  const persistSelfServiceRun = (leads) => {
    if (!env.DB || !Array.isArray(leads) || leads.length === 0) return;
    const ssProfileId = `self-service:${company}`;
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    let ipHash = 'unknown';
    if (ip !== 'unknown') {
      try { ipHash = btoa(ip).slice(0, 12); } catch { ipHash = 'unknown'; }
    }
    Promise.all([
      saveLeadsBatch(env.DB, leads, ssProfileId, 'self-service'),
      logAnalyticsRun(env.DB, {
        type: 'self-service', profileId: ssProfileId, company, industry,
        leadsCount: leads.length, articlesCount: articles.length,
        elapsedSec: Math.round((Date.now() - startTime) / 1000), ipHash
      })
    ]).catch(() => {});
  };

  if (!company || !industry) {
    return jsonResponse({ success: false, message: '회사명과 산업 분야를 모두 입력하세요.' }, 400);
  }
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ success: false, message: '서버 설정 오류: GEMINI_API_KEY가 설정되지 않았습니다.' }, 503);
  }

  try {
    // Step 1: Gemini 프로필 생성
    try {
      profile = await Promise.race([
        generateProfileFromGemini(company, industry, env),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SELF_SERVICE_PROFILE_TIMEOUT')), profileTimeoutMs))
      ]);
    } catch (e) {
      profile = generateHeuristicProfile(company, industry);
      profileMode = 'heuristic-fallback';
    }

    const elapsed1 = Date.now() - startTime;
    if (elapsed1 > softDeadlineMs) {
      return jsonResponse({ success: false, message: '시간 초과: 프로필 생성에 시간이 오래 걸렸습니다. 다시 시도하세요.' }, 504);
    }

    // Step 2: 뉴스 수집
    articles = await fetchAllNewsWorker(profile.searchQueries);
    articles = articles.slice(0, 18);
    const elapsed2 = Date.now() - startTime;
    if (elapsed2 > softDeadlineMs) {
      return jsonResponse({ success: false, message: '시간 초과: 뉴스 수집에 시간이 오래 걸렸습니다. 다시 시도하세요.' }, 504);
    }

    if (articles.length === 0) {
      return jsonResponse({
        success: true,
        leads: [],
        profile: { name: profile.name, industry: profile.industry },
        message: '최근 3일간 관련 뉴스를 찾지 못했습니다. 다른 키워드로 시도해보세요.',
        stats: { articles: 0, elapsed: Math.round((Date.now() - startTime) / 1000) }
      });
    }

    const buildSuccessResponse = (leads, mode = 'ai', message = '') => {
      persistSelfServiceRun(leads);
      return jsonResponse({
        success: true,
        leads,
        profile: { name: profile.name, industry: profile.industry, competitors: profile.competitors },
        message,
        stats: {
          mode: profileMode === 'ai' ? mode : `${mode}+${profileMode}`,
          articles: articles.length,
          leads: leads.length,
          elapsed: Math.round((Date.now() - startTime) / 1000)
        }
      });
    };

    // Step 3: 리드 분석
    const remainingMs = softDeadlineMs - elapsed2;
    if (remainingMs < 1500) {
      const quickLeads = generateQuickLeadsWorker(articles, profile);
      return buildSuccessResponse(
        quickLeads,
        'quick-fallback',
        'AI 분석이 지연되어 빠른 분석 결과를 먼저 표시합니다.'
      );
    }
    const leads = await Promise.race([
      analyzeLeadsWorker(articles, profile, env),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SELF_SERVICE_ANALYZE_TIMEOUT')), remainingMs))
    ]);

    return buildSuccessResponse(leads, 'ai');
  } catch (e) {
    if (e && e.message === 'SELF_SERVICE_ANALYZE_TIMEOUT') {
      const fallbackLeads = generateQuickLeadsWorker(articles, profile || generateHeuristicProfile(company, industry));
      persistSelfServiceRun(fallbackLeads);
      return jsonResponse({
        success: true,
        leads: fallbackLeads,
        profile: {
          name: (profile && profile.name) || company,
          industry: (profile && profile.industry) || industry,
          competitors: (profile && profile.competitors) || []
        },
        message: 'AI 분석이 지연되어 빠른 분석 결과를 먼저 표시합니다.',
        stats: {
          mode: profileMode === 'ai' ? 'quick-fallback' : `quick-fallback+${profileMode}`,
          articles: articles.length,
          leads: fallbackLeads.length,
          elapsed: Math.round((Date.now() - startTime) / 1000)
        }
      });
    }

    if (articles.length > 0) {
      const fallbackLeads = generateQuickLeadsWorker(articles, profile || generateHeuristicProfile(company, industry));
      persistSelfServiceRun(fallbackLeads);
      return jsonResponse({
        success: true,
        leads: fallbackLeads,
        profile: {
          name: (profile && profile.name) || company,
          industry: (profile && profile.industry) || industry,
          competitors: (profile && profile.competitors) || []
        },
        message: 'AI 분석 응답이 불안정하여 빠른 분석 결과를 먼저 표시합니다.',
        stats: {
          mode: profileMode === 'ai' ? 'quick-fallback' : `quick-fallback+${profileMode}`,
          articles: articles.length,
          leads: fallbackLeads.length,
          elapsed: Math.round((Date.now() - startTime) / 1000)
        }
      });
    }
    return jsonResponse({ success: false, message: '분석 실패: ' + e.message }, 500);
  }
}

// ===== XSS 방어 =====

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeUrl(url) {
  if (!url) return '#';
  // 제어문자, 공백, 탭, 개행, null byte 제거 후 검사
  const u = String(url).replace(/[\x00-\x1f\x7f\s]+/g, '').toLowerCase();
  if (/^(javascript|data|vbscript|blob):/i.test(u)) return '#';
  // scheme-relative (//evil.com) 또는 backslash prefix 차단
  if (/^[/\\]{2}/.test(u)) return '#';
  return escapeHtml(url);
}

function getProfilesFromEnv(env) {
  const fallback = [{ id: 'danfoss', name: '댄포스 코리아' }];
  try {
    const parsed = JSON.parse(env.PROFILES || JSON.stringify(fallback));
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const sanitized = parsed
      .filter(p => p && typeof p.id === 'string' && p.id.trim())
      .map(p => ({ id: p.id.trim(), name: String(p.name || p.id).trim() }));
    return sanitized.length > 0 ? sanitized : fallback;
  } catch {
    return fallback;
  }
}

function resolveProfileId(profileId, env) {
  const profiles = getProfilesFromEnv(env);
  const fallbackId = profiles[0]?.id || 'danfoss';
  const candidate = typeof profileId === 'string' ? profileId.trim() : '';
  if (!candidate) return fallbackId;
  return profiles.some(p => p.id === candidate) ? candidate : fallbackId;
}

function renderProfileOptions(env) {
  return getProfilesFromEnv(env)
    .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join('');
}

// ===== 페이지 HTML =====

function getMainPage(env) {
  const profileOptions = renderProfileOptions(env);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B2B Sales Intelligence</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    select.profile-select { width: 200px; margin: 0 auto 16px; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; text-align: center; display: block; }
    .tabs { display: flex; justify-content: center; gap: 0; margin-bottom: 24px; }
    .tab-btn { flex: 1; max-width: 200px; padding: 12px 16px; font-size: 14px; font-weight: bold; color: #aaa; background: transparent; border: 1px solid #444; cursor: pointer; transition: all 0.3s; }
    .tab-btn:first-child { border-radius: 8px 0 0 8px; }
    .tab-btn:last-child { border-radius: 0 8px 8px 0; }
    .tab-btn.active { color: #fff; background: rgba(233,69,96,0.2); border-color: #e94560; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .ss-input { display: block; width: 280px; margin: 0 auto 12px; padding: 12px 16px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; text-align: center; }
    .ss-input::placeholder { color: #666; }
    .progress-bar { width: 100%; height: 4px; background: #333; border-radius: 2px; margin-top: 12px; overflow: hidden; display: none; }
    .progress-bar.active { display: block; }
    .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #e94560, #3498db); border-radius: 2px; transition: width 0.5s ease; }
    .ss-results { margin-top: 20px; text-align: left; }
    .ss-lead-card { background: #1e2a3a; border-radius: 12px; padding: 16px; margin: 12px 0; border-left: 4px solid #e94560; }
    .ss-lead-card.grade-b { border-left-color: #f39c12; }
    .ss-lead-card h3 { color: #e94560; margin: 0 0 10px 0; font-size: 16px; }
    .ss-lead-card.grade-b h3 { color: #f39c12; }
    .ss-lead-card p { margin: 4px 0; font-size: 13px; color: #ccc; line-height: 1.6; }
    .ss-lead-card strong { color: #fff; }
    .ss-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: center; }
    .ss-stats { font-size: 12px; color: #888; margin-top: 8px; }
    .ss-sources { margin-top: 10px; padding-top: 10px; border-top: 1px solid #2a3a4a; }
    .ss-sources summary { color: #aaa; font-size: 12px; cursor: pointer; }
    .ss-sources a { color: #3498db; text-decoration: none; font-size: 12px; }
    .ss-sources a:hover { text-decoration: underline; }
    .ss-sources li { margin: 3px 0; list-style: none; }
  </style>
</head>
<body>
  <div class="container" style="max-width:600px;">
    <div class="logo">📊</div>
    <h1>B2B Sales Intelligence</h1>
    <p class="subtitle">AI 기반 영업 인텔리전스 플랫폼</p>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('self-service')">셀프서비스</button>
      <button class="tab-btn" onclick="switchTab('managed')">관리 프로필</button>
    </div>

    <!-- 셀프서비스 탭 -->
    <div class="tab-content active" id="tab-self-service">
      <p style="font-size:13px;color:#aaa;margin-bottom:16px;">회사명과 산업만 입력하면 AI가 즉시 리드를 분석합니다</p>
      <input type="text" class="ss-input" id="ssCompany" placeholder="회사명 (예: 삼성전자)" maxlength="50">
      <input type="text" class="ss-input" id="ssIndustry" placeholder="산업 분야 (예: 반도체 제조)" maxlength="50">
      <button class="btn btn-primary" id="ssBtn" onclick="selfServiceAnalyze()">즉시 분석</button>
      <div class="progress-bar" id="ssProgress"><div class="progress-fill" id="ssProgressFill"></div></div>
      <div class="status" id="ssStatus"></div>
      <div class="ss-results" id="ssResults"></div>
    </div>

    <!-- 관리 프로필 탭 -->
    <div class="tab-content" id="tab-managed">
      <select class="profile-select" id="profileSelect">
        ${profileOptions}
      </select>
      <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
      <button class="btn btn-primary" id="generateBtn" onclick="generate()">보고서 생성</button>
      <div class="status" id="status"></div>
      <div class="nav-buttons">
        <a href="/leads" class="btn btn-secondary">리드 상세 보기</a>
        <a href="/dashboard" class="btn btn-secondary">대시보드</a>
        <a href="/ppt" class="btn btn-secondary">PPT 제안서</a>
        <a href="/roleplay" class="btn btn-secondary">영업 역량 시뮬레이션</a>
      </div>
      <div class="info">
        뉴스 기반 영업 기회 분석 후 리포트를 발송합니다<br>
        처리에 1~2분 정도 소요됩니다.
      </div>
    </div>
  </div>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function safeUrl(u) { if(!u) return '#'; const c=String(u).replace(/[\\x00-\\x1f\\x7f\\s]+/g,'').toLowerCase(); if(/^(javascript|data|vbscript|blob):/i.test(c)||/^[/\\\\]{2}/.test(c)) return '#'; return esc(u); }

    function switchTab(tab) {
      document.querySelectorAll('.tab-btn').forEach((b, i) => {
        b.classList.toggle('active', (tab === 'self-service' ? i === 0 : i === 1));
      });
      document.getElementById('tab-self-service').classList.toggle('active', tab === 'self-service');
      document.getElementById('tab-managed').classList.toggle('active', tab === 'managed');
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company, industry })
        });
        const data = await res.json();
        clearInterval(progressInterval);
        fill.style.width = '100%';

        if (!data.success) {
          status.className = 'status error'; status.textContent = data.message;
          results.innerHTML = '';
        } else if (!data.leads || data.leads.length === 0) {
          status.className = 'status success';
          status.textContent = data.message || '분석 완료했지만 유효한 리드를 찾지 못했습니다.';
          if (data.stats) status.textContent += ' (' + data.stats.elapsed + '초)';
          results.innerHTML = '';
        } else {
          status.className = 'status success';
          status.textContent = data.leads.length + '개 리드 발견! (' + (data.stats ? data.stats.elapsed + '초, 뉴스 ' + data.stats.articles + '건 분석' : '') + ')';
          if (data.message) status.textContent += ' ' + data.message;
          renderSelfServiceResults(data.leads, data.profile);
        }
      } catch (e) {
        clearInterval(progressInterval);
        status.className = 'status error'; status.textContent = '오류: ' + e.message;
      }

      setTimeout(() => { progress.classList.remove('active'); }, 1000);
      btn.disabled = false; btn.textContent = '즉시 분석';
    }

    function renderSelfServiceResults(leads, profile) {
      const container = document.getElementById('ssResults');
      container.innerHTML = leads.map(lead => \`
        <div class="ss-lead-card \${lead.grade === 'B' ? 'grade-b' : ''}">
          <h3>\${esc(lead.grade)} | \${esc(lead.company)} (\${parseInt(lead.score)||0}점)</h3>
          <p><strong>프로젝트:</strong> \${esc(lead.summary)}</p>
          <p><strong>추천 제품:</strong> \${esc(lead.product)}</p>
          <p><strong>예상 ROI:</strong> \${esc(lead.roi)}</p>
          <p><strong>영업 제안:</strong> \${esc(lead.salesPitch)}</p>
          <p><strong>글로벌 트렌드:</strong> \${esc(lead.globalContext)}</p>
          \${lead.sources && lead.sources.length > 0 ? \`
          <div class="ss-sources">
            <details>
              <summary>출처 (\${lead.sources.length}건)</summary>
              <ul>\${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}</ul>
            </details>
          </div>\` : ''}
        </div>
      \`).join('');

      // 복사/다운로드 버튼
      container.innerHTML += \`
        <div class="ss-actions">
          <button class="btn btn-secondary" onclick="copySelfServiceResults()">클립보드 복사</button>
          <button class="btn btn-secondary" onclick="downloadSelfServiceResults()">JSON 다운로드</button>
        </div>
      \`;

      // 결과 데이터 저장
      window._ssLeads = leads;
      window._ssProfile = profile;
    }

    function copySelfServiceResults() {
      if (!window._ssLeads) return;
      const text = window._ssLeads.map(l =>
        \`[\${l.grade}] \${l.company} (\${l.score}점)\\n프로젝트: \${l.summary}\\n제품: \${l.product}\\nROI: \${l.roi}\\nPitch: \${l.salesPitch}\\n트렌드: \${l.globalContext}\`
      ).join('\\n\\n---\\n\\n');
      navigator.clipboard.writeText(text).then(() => {
        const status = document.getElementById('ssStatus');
        status.className = 'status success'; status.textContent = '클립보드에 복사되었습니다!';
      });
    }

    function downloadSelfServiceResults() {
      if (!window._ssLeads) return;
      const data = { profile: window._ssProfile, leads: window._ssLeads, generatedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = (window._ssProfile?.name || 'leads') + '_' + new Date().toISOString().split('T')[0] + '.json';
      a.click(); URL.revokeObjectURL(a.href);
    }

    // ===== 관리 프로필 =====
    (function(){ const s=sessionStorage.getItem('b2b_token'); if(s) document.getElementById('password').value=s; })();
    function getToken() { const p=document.getElementById('password').value; if(p) sessionStorage.setItem('b2b_token',p); return p; }
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
          body: JSON.stringify({ password, profile })
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

function getLeadsPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드 상세 보기</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .lead-card { background: #1e2a3a; border-radius: 12px; padding: 20px; margin: 16px 0; border-left: 4px solid #e94560; }
    .lead-card.grade-b { border-left-color: #f39c12; }
    .lead-card h3 { color: #e94560; margin: 0 0 12px 0; font-size: 18px; }
    .lead-card.grade-b h3 { color: #f39c12; }
    .lead-info { display: grid; gap: 8px; }
    .lead-info p { margin: 0; font-size: 14px; line-height: 1.6; color: #ccc; }
    .lead-info strong { color: #fff; }
    .lead-sources { margin-top: 12px; padding-top: 12px; border-top: 1px solid #2a3a4a; }
    .lead-sources summary { color: #aaa; font-size: 13px; cursor: pointer; }
    .lead-sources summary:hover { color: #fff; }
    .lead-sources ul { list-style: none; padding: 8px 0 0 0; margin: 0; }
    .lead-sources li { margin: 4px 0; }
    .lead-sources a { color: #3498db; text-decoration: none; font-size: 13px; }
    .lead-sources a:hover { color: #5dade2; text-decoration: underline; }
    .lead-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .lead-actions a { font-size: 12px; padding: 6px 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .badge-status { background: #3498db; color: #fff; margin-left: 8px; }
    .badge-status.contacted { background: #9b59b6; }
    .badge-status.meeting { background: #e67e22; }
    .badge-status.proposal { background: #1abc9c; }
    .badge-status.negotiation { background: #2980b9; }
    .badge-status.won { background: #27ae60; }
    .badge-status.lost { background: #7f8c8d; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .top-nav-links { display: flex; gap: 8px; }
    .status-select { padding: 4px 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 12px; cursor: pointer; }
    .notes-section { margin-top: 10px; }
    .notes-section summary { color: #aaa; font-size: 13px; cursor: pointer; }
    .notes-textarea { width: 100%; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #ccc; font-size: 13px; resize: vertical; margin-top: 6px; font-family: inherit; }
    .notes-saved { color: #27ae60; font-size: 11px; margin-left: 8px; opacity: 0; transition: opacity 0.3s; }
    .notes-saved.show { opacity: 1; }
    .csv-btn { margin-left: auto; }
    .view-tabs { display: flex; gap: 0; margin-bottom: 16px; }
    .view-tab { flex: 1; padding: 10px; text-align: center; font-size: 13px; font-weight: bold; color: #aaa; background: #1e2a3a; border: 1px solid #2a3a4a; cursor: pointer; transition: all 0.2s; }
    .view-tab:first-child { border-radius: 8px 0 0 8px; }
    .view-tab:last-child { border-radius: 0 8px 8px 0; }
    .view-tab.active { color: #fff; background: #e94560; border-color: #e94560; }
    .kanban-board { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 12px; min-height: 300px; }
    .kanban-col { min-width: 180px; flex: 1; background: #1a2332; border-radius: 10px; padding: 10px; }
    .kanban-col-header { font-size: 12px; font-weight: bold; color: #fff; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; text-align: center; }
    .kanban-col-count { font-size: 10px; color: rgba(255,255,255,0.7); margin-left: 4px; }
    .kanban-card { background: #1e2a3a; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; border-left: 3px solid transparent; }
    .kanban-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .kanban-card .k-company { font-size: 13px; font-weight: bold; color: #fff; margin-bottom: 4px; }
    .kanban-card .k-product { font-size: 11px; color: #aaa; margin-bottom: 6px; }
    .kanban-card .k-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
    .kanban-card .k-score { color: #e94560; font-weight: bold; }
    .kanban-card .k-followup { color: #aaa; font-size: 10px; }
    .kanban-card.followup-warn { border-left-color: #e74c3c; }
    .kanban-card.followup-warn .k-followup { color: #e74c3c; font-weight: bold; }
    .kanban-card .k-value { color: #27ae60; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <div class="top-nav">
      <a href="/" class="back-link">← 메인</a>
      <div class="top-nav-links">
        <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
        <a id="historyLink" href="/history" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">전체 히스토리</a>
        <button class="btn btn-secondary csv-btn" style="font-size:12px;padding:6px 12px;" onclick="downloadCSV()">CSV 내보내기</button>
      </div>
    </div>
    <h1 style="font-size:22px;">리드 상세 보기</h1>
    <p class="subtitle">최근 분석된 영업 기회 목록</p>

    <div class="view-tabs">
      <div class="view-tab active" onclick="switchView('list')">리스트</div>
      <div class="view-tab" onclick="switchView('kanban')">칸반 보드</div>
    </div>

    <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;margin-bottom:12px;" onclick="window.print()">PDF 인쇄</button>

    <div class="batch-enrich-bar">
      <span>미분석 리드를 AI로 심층 분석합니다 (최대 3건/회)</span>
      <button class="btn-enrich" onclick="batchEnrich(this)">일괄 상세 분석</button>
    </div>
    <div id="batchStatus" style="font-size:12px;margin-bottom:12px;min-height:16px;"></div>

    <div id="leadsList"><p style="color:#aaa;">로딩 중...</p></div>
    <div id="kanbanView" style="display:none;"></div>
  </div>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function safeUrl(u) { if(!u) return '#'; const c=String(u).replace(/[\x00-\x1f\x7f\s]+/g,'').toLowerCase(); if(/^(javascript|data|vbscript|blob):/i.test(c)||/^[/\\]{2}/.test(c)) return '#'; return esc(u); }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getToken() { return sessionStorage.getItem('b2b_token') || ''; }
    function detailLink(leadId) {
      const token = getToken();
      return '/leads/' + encodeURIComponent(leadId) + (token ? ('?token=' + encodeURIComponent(token)) : '');
    }
    function getProfile() { return new URLSearchParams(window.location.search).get('profile') || 'danfoss'; }

    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };
    const statusColors = { NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' };
    const transitions = { NEW: ['CONTACTED'], CONTACTED: ['MEETING'], MEETING: ['PROPOSAL'], PROPOSAL: ['NEGOTIATION'], NEGOTIATION: ['WON','LOST'], LOST: ['NEW'], WON: [] };

    function renderStatusSelect(lead) {
      if (!lead.id) return '';
      const current = lead.status || 'NEW';
      const allowed = transitions[current] || [];
      if (allowed.length === 0) return \`<span class="badge badge-status \${current.toLowerCase()}">\${esc(statusLabels[current])}</span>\`;
      const opts = [current, ...allowed].map(s =>
        \`<option value="\${s}" \${s === current ? 'selected' : ''}>\${esc(statusLabels[s] || s)}</option>\`
      ).join('');
      return \`<select class="status-select" onchange="updateStatus('\${esc(lead.id)}', this.value, '\${current}')">\${opts}</select>\`;
    }

    async function updateStatus(leadId, newStatus, fromStatus) {
      if (newStatus === fromStatus) return;
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); loadLeads(); return; }
        loadLeads();
      } catch(e) { alert('상태 변경 실패: ' + e.message); }
    }

    let saveTimers = {};
    function scheduleNoteSave(leadId, textarea) {
      clearTimeout(saveTimers[leadId]);
      saveTimers[leadId] = setTimeout(() => saveNotes(leadId, textarea), 800);
    }

    async function saveNotes(leadId, textarea) {
      const indicator = textarea.parentElement.querySelector('.notes-saved');
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ notes: textarea.value })
        });
        const data = await res.json();
        if (data.success && indicator) {
          indicator.classList.add('show');
          setTimeout(() => indicator.classList.remove('show'), 2000);
        }
      } catch { /* silent */ }
    }

    function downloadCSV() {
      const token = sessionStorage.getItem('b2b_token') || '';
      window.open('/api/export/csv?profile=' + encodeURIComponent(getProfile()) + '&token=' + encodeURIComponent(token));
    }

    async function enrichLead(leadId, btn, force) {
      if (!leadId) return;
      btn.disabled = true;
      btn.textContent = '분석 중...';
      try {
        const forceParam = force ? '?force=true' : '';
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId) + '/enrich' + forceParam, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() }
        });
        const data = await res.json();
        if (!data.success) { alert(data.message || '분석 실패'); btn.disabled = false; btn.textContent = '상세 분석'; return; }
        loadLeads();
      } catch(e) { alert('분석 실패: ' + e.message); btn.disabled = false; btn.textContent = '상세 분석'; }
    }

    async function batchEnrich(btn) {
      btn.disabled = true;
      btn.textContent = '일괄 분석 중...';
      const statusEl = document.getElementById('batchStatus');
      statusEl.textContent = 'AI가 리드를 심층 분석하고 있습니다...';
      statusEl.style.color = '#3498db';
      try {
        const res = await fetch('/api/leads/batch-enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ profile: getProfile() })
        });
        const data = await res.json();
        if (data.success) {
          statusEl.textContent = '완료: ' + data.enriched + '건 분석, ' + (data.failed || 0) + '건 실패, 잔여 ' + data.remaining + '건';
          statusEl.style.color = '#27ae60';
        } else {
          statusEl.textContent = data.message || '분석 실패';
          statusEl.style.color = '#e74c3c';
        }
        loadLeads();
      } catch(e) {
        statusEl.textContent = '오류: ' + e.message;
        statusEl.style.color = '#e74c3c';
      }
      btn.disabled = false;
      btn.textContent = '일괄 상세 분석';
    }

    async function loadLeads() {
      try {
        const res = await fetch('/api/leads?profile=' + getProfile(), {headers:authHeaders()});
        const data = await res.json();
        const container = document.getElementById('leadsList');

        if (!data.leads || data.leads.length === 0) {
          container.innerHTML = '<p style="color:#aaa;">아직 생성된 리드가 없습니다. 메인 페이지에서 보고서를 먼저 생성하세요.</p>';
          cachedLeads = [];
          if (currentView === 'kanban') renderKanban([]);
          return;
        }

        cachedLeads = data.leads;
        if (currentView === 'kanban') renderKanban(cachedLeads);

        container.innerHTML = data.leads.map((lead, i) => \`
          <div class="lead-card \${lead.grade === 'B' ? 'grade-b' : ''}">
            <h3>
              <span class="badge \${lead.grade === 'A' ? 'badge-a' : 'badge-b'}">\${esc(lead.grade)}</span>
              \${renderStatusSelect(lead)}
              \${lead.enriched ? '<span class="badge-enriched">심층 분석 완료</span>' : ''}
              \${lead.id ? \`<a href="\${detailLink(lead.id)}" style="color:inherit;text-decoration:none;">\${esc(lead.company)}</a>\` : esc(lead.company)} (\${parseInt(lead.score) || 0}점)
            </h3>
            <div class="lead-info">
              <p><strong>프로젝트:</strong> \${esc(lead.summary)}</p>
              <p><strong>추천 제품:</strong> \${esc(lead.product)}</p>
              <p><strong>예상 ROI:</strong> \${esc(lead.roi) || '-'}</p>
              <p><strong>영업 제안:</strong> \${esc(lead.salesPitch)}</p>
              <p><strong>글로벌 트렌드:</strong> \${esc(lead.globalContext) || '-'}</p>
            </div>
            \${lead.enriched ? \`
            <div class="enriched-details">
              <details>
                <summary>심층 분석 상세 보기</summary>
                <div class="enriched-content">
                  \${lead.keyFigures && lead.keyFigures.length > 0 ? \`<div class="enriched-block"><h4>핵심 수치</h4><ul>\${lead.keyFigures.map(f => \`<li>\${esc(f)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.painPoints && lead.painPoints.length > 0 ? \`<div class="enriched-block"><h4>고객 과제</h4><ul>\${lead.painPoints.map(p => \`<li>\${esc(p)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.actionItems && lead.actionItems.length > 0 ? \`<div class="enriched-block"><h4>후속 실행 항목</h4><ul>\${lead.actionItems.map(a => \`<li>\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.enrichedAt ? \`<p style="color:#666;font-size:11px;margin-top:8px;">분석일: \${esc(lead.enrichedAt.split('T')[0])}</p>\` : ''}
                </div>
              </details>
            </div>\` : ''}
            \${lead.sources && lead.sources.length > 0 ? \`
            <div class="lead-sources">
              <details>
                <summary>출처 보기 (\${lead.sources.length}건)</summary>
                <ul>
                  \${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}
                </ul>
              </details>
            </div>\` : ''}
            \${lead.id ? \`
            <div class="notes-section">
              <details>
                <summary>메모 \${lead.notes ? '(작성됨)' : ''}<span class="notes-saved">저장됨</span></summary>
                <textarea class="notes-textarea" placeholder="메모를 입력하세요..."
                  oninput="scheduleNoteSave('\${esc(lead.id)}', this)"
                  onblur="saveNotes('\${esc(lead.id)}', this)">\${esc(lead.notes || '')}</textarea>
              </details>
            </div>\` : ''}
            <div class="lead-actions">
              <a href="/ppt?profile=\${encodeURIComponent(getProfile())}&lead=\${i}" class="btn btn-secondary">PPT 생성</a>
              <a href="/roleplay?profile=\${encodeURIComponent(getProfile())}&lead=\${i}" class="btn btn-secondary">영업 연습</a>
              \${lead.id && !lead.enriched ? \`<button class="btn-enrich" onclick="enrichLead('\${esc(lead.id)}', this)">상세 분석</button>\` : ''}
              \${lead.id && lead.enriched ? \`<button class="btn-enrich" style="opacity:0.6" onclick="enrichLead('\${esc(lead.id)}', this, true)" title="재분석">재분석</button>\` : ''}
            </div>
          </div>
        \`).join('');
      } catch(e) {
        document.getElementById('leadsList').innerHTML = '<p style="color:#e74c3c;">데이터 로드 실패: ' + esc(e.message) + '</p>';
      }
    }
    let currentView = 'list';
    let cachedLeads = [];

    function switchView(view) {
      currentView = view;
      document.querySelectorAll('.view-tab').forEach((t, i) => {
        t.classList.toggle('active', (i === 0 && view === 'list') || (i === 1 && view === 'kanban'));
      });
      document.getElementById('leadsList').style.display = view === 'list' ? '' : 'none';
      document.getElementById('kanbanView').style.display = view === 'kanban' ? '' : 'none';
      const container = document.querySelector('.container');
      container.style.maxWidth = view === 'kanban' ? '1400px' : '700px';
      if (view === 'kanban') renderKanban(cachedLeads);
    }

    function renderKanban(leads) {
      const order = ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON','LOST'];
      const groups = {};
      order.forEach(s => groups[s] = []);
      leads.forEach(l => { const s = l.status || 'NEW'; if (groups[s]) groups[s].push(l); });

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      let html = '<div class="kanban-board" style="max-width:100%;overflow-x:auto;">';
      order.forEach(s => {
        const cards = groups[s];
        html += '<div class="kanban-col">';
        html += '<div class="kanban-col-header" style="background:' + statusColors[s] + '">' + esc(statusLabels[s]) + '<span class="kanban-col-count">(' + cards.length + ')</span></div>';
        cards.forEach(l => {
          const fu = l.followUpDate || '';
          const isWarn = fu && fu <= today;
          html += '<div class="kanban-card' + (isWarn ? ' followup-warn' : '') + '" onclick="location.href=\\'' + detailLink(l.id) + '\\'">';
          html += '<div class="k-company">' + esc(l.company) + '</div>';
          html += '<div class="k-product">' + esc(l.product || l.summary || '-') + '</div>';
          html += '<div class="k-meta">';
          html += '<span class="k-score">' + esc(l.grade) + ' ' + l.score + '점</span>';
          if (l.estimatedValue) html += '<span class="k-value">' + l.estimatedValue.toLocaleString() + '만</span>';
          html += '</div>';
          if (fu) {
            html += '<div class="k-followup">' + (isWarn ? '⚠ ' : '') + esc(fu) + '</div>';
          }
          html += '</div>';
        });
        if (cards.length === 0) html += '<p style="color:#555;font-size:11px;text-align:center;padding:20px 0;">없음</p>';
        html += '</div>';
      });
      html += '</div>';
      document.getElementById('kanbanView').innerHTML = html;
    }

    document.getElementById('historyLink').href = '/history?profile=' + encodeURIComponent(getProfile());
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

    loadLeads();
  </script>
</body>
</html>`;
}

function getLeadDetailPage(lead, statusLogs) {
  const statusLabelsJS = JSON.stringify({ NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' });
  const statusColorsJS = JSON.stringify({ NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' });
  const transitionsJS = JSON.stringify({ NEW: ['CONTACTED'], CONTACTED: ['MEETING'], MEETING: ['PROPOSAL'], PROPOSAL: ['NEGOTIATION'], NEGOTIATION: ['WON','LOST'], LOST: ['NEW'], WON: [] });
  const leadJSON = JSON.stringify(lead);
  const logsJSON = JSON.stringify(statusLogs || []);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${(lead.company || '리드').replace(/[<>"'&]/g, '')} - 리드 상세</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .detail-section { background: #1e2a3a; border-radius: 12px; padding: 20px; margin: 16px 0; text-align: left; }
    .detail-section h3 { color: #e94560; font-size: 16px; margin: 0 0 14px 0; }
    .detail-row { display: flex; gap: 8px; margin: 8px 0; font-size: 14px; line-height: 1.6; }
    .detail-row .label { color: #888; min-width: 100px; flex-shrink: 0; }
    .detail-row .value { color: #ddd; word-break: break-word; }
    .timeline { list-style: none; padding: 0; margin: 0; position: relative; }
    .timeline::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 8px; width: 2px; background: #2a3a4a; }
    .timeline li { position: relative; padding: 8px 0 8px 30px; font-size: 13px; color: #ccc; }
    .timeline li::before { content: ''; position: absolute; left: 4px; top: 14px; width: 10px; height: 10px; border-radius: 50%; background: #3498db; border: 2px solid #1e2a3a; }
    .timeline li:last-child::before { background: #e94560; }
    .timeline .time { color: #666; font-size: 11px; display: block; }
    .field-group { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .field-group label { color: #aaa; font-size: 12px; display: block; margin-bottom: 4px; }
    .field-group input { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 14px; }
    .notes-area { width: 100%; min-height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #ccc; font-size: 13px; resize: vertical; font-family: inherit; margin-top: 8px; }
    .save-indicator { color: #27ae60; font-size: 11px; opacity: 0; transition: opacity 0.3s; margin-left: 8px; }
    .save-indicator.show { opacity: 1; }
    .status-select-lg { padding: 8px 12px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 14px; cursor: pointer; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <div class="top-nav">
      <a href="/leads" class="back-link" id="backLink">← 리드 목록</a>
      <div style="display:flex;gap:8px;">
        <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
      </div>
    </div>
    <h1 style="font-size:22px;" id="leadCompany"></h1>
    <p class="subtitle" id="leadSummary"></p>

    <div id="detailContent"><p style="color:#aaa;">로딩 중...</p></div>
  </div>

  <script>
    const lead = ${leadJSON};
    const statusLogs = ${logsJSON};
    const statusLabels = ${statusLabelsJS};
    const statusColors = ${statusColorsJS};
    const transitions = ${transitionsJS};

    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function safeUrl(u) { if(!u) return '#'; const c=String(u).replace(/[\\x00-\\x1f\\x7f\\s]+/g,'').toLowerCase(); if(/^(javascript|data|vbscript|blob):/i.test(c)||/^[/\\\\]{2}/.test(c)) return '#'; return esc(u); }
    const urlState = new URL(window.location.href);
    const queryToken = urlState.searchParams.get('token') || '';
    if (queryToken) {
      sessionStorage.setItem('b2b_token', queryToken);
      urlState.searchParams.delete('token');
      const cleanQuery = urlState.searchParams.toString();
      history.replaceState(null, '', urlState.pathname + (cleanQuery ? ('?' + cleanQuery) : ''));
    }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getProfile() { return lead.profileId || 'danfoss'; }

    // Back link에 프로필 쿼리 추가
    document.getElementById('backLink').href = '/leads?profile=' + encodeURIComponent(getProfile());
    document.getElementById('leadCompany').textContent = lead.company || '리드 상세';
    document.getElementById('leadSummary').textContent = lead.summary || '';

    function renderDetail() {
      const c = document.getElementById('detailContent');
      let html = '';

      // 기본 정보 + 상태 섹션
      const currentStatus = lead.status || 'NEW';
      const allowed = transitions[currentStatus] || [];
      const statusOpts = [currentStatus, ...allowed].map(s =>
        '<option value="' + s + '"' + (s === currentStatus ? ' selected' : '') + '>' + esc(statusLabels[s] || s) + '</option>'
      ).join('');

      html += '<div class="detail-section">';
      html += '<h3>기본 정보</h3>';
      html += '<div class="detail-row"><span class="label">상태</span><span class="value">';
      if (allowed.length > 0) {
        html += '<select class="status-select-lg" onchange="updateField(\\'status\\', this.value)">' + statusOpts + '</select>';
      } else {
        html += '<span style="color:' + (statusColors[currentStatus] || '#fff') + ';font-weight:bold;">' + esc(statusLabels[currentStatus]) + '</span>';
      }
      html += '</span></div>';
      html += '<div class="detail-row"><span class="label">등급</span><span class="value"><span class="badge ' + (lead.grade === 'A' ? 'badge-a' : 'badge-b') + '">' + esc(lead.grade) + '</span> (' + lead.score + '점)</span></div>';
      html += '<div class="detail-row"><span class="label">추천 제품</span><span class="value">' + esc(lead.product) + '</span></div>';
      html += '<div class="detail-row"><span class="label">예상 ROI</span><span class="value">' + esc(lead.roi || '-') + '</span></div>';
      html += '<div class="detail-row"><span class="label">영업 제안</span><span class="value">' + esc(lead.salesPitch) + '</span></div>';
      html += '<div class="detail-row"><span class="label">글로벌 트렌드</span><span class="value">' + esc(lead.globalContext || '-') + '</span></div>';
      html += '<div class="detail-row"><span class="label">프로필</span><span class="value">' + esc(lead.profileId) + '</span></div>';
      html += '<div class="detail-row"><span class="label">생성일</span><span class="value">' + esc((lead.createdAt || '').split('T')[0]) + '</span></div>';
      html += '</div>';

      // 후속 조치 + 예상 계약액 섹션
      html += '<div class="detail-section">';
      html += '<h3>영업 관리</h3>';
      html += '<div class="field-group">';
      html += '<div><label>다음 후속 조치일</label><input type="date" id="followUpDate" value="' + esc(lead.followUpDate || '') + '" onchange="updateField(\\'follow_up_date\\', this.value)"></div>';
      html += '<div><label>예상 계약액 (만원)</label><input type="number" id="estimatedValue" value="' + (lead.estimatedValue || 0) + '" min="0" onchange="updateField(\\'estimated_value\\', parseInt(this.value)||0)"></div>';
      html += '</div>';
      html += '<span class="save-indicator" id="saveIndicator">저장됨</span>';
      html += '</div>';

      // Enrichment 섹션
      if (lead.enriched) {
        html += '<div class="detail-section">';
        html += '<h3>심층 분석 결과</h3>';
        if (lead.keyFigures && lead.keyFigures.length) {
          html += '<p style="color:#ce93d8;font-size:13px;font-weight:bold;margin-bottom:6px;">핵심 수치</p>';
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">' + lead.keyFigures.map(f => '<li style="color:#ccc;font-size:13px;padding:2px 0 2px 12px;position:relative;"><span style="position:absolute;left:0;color:#8e44ad;">→</span>' + esc(f) + '</li>').join('') + '</ul>';
        }
        if (lead.painPoints && lead.painPoints.length) {
          html += '<p style="color:#ce93d8;font-size:13px;font-weight:bold;margin-bottom:6px;">고객 과제</p>';
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">' + lead.painPoints.map(p => '<li style="color:#ccc;font-size:13px;padding:2px 0 2px 12px;position:relative;"><span style="position:absolute;left:0;color:#8e44ad;">→</span>' + esc(p) + '</li>').join('') + '</ul>';
        }
        if (lead.actionItems && lead.actionItems.length) {
          html += '<p style="color:#ce93d8;font-size:13px;font-weight:bold;margin-bottom:6px;">후속 실행 항목</p>';
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">' + lead.actionItems.map(a => '<li style="color:#ccc;font-size:13px;padding:2px 0 2px 12px;position:relative;"><span style="position:absolute;left:0;color:#8e44ad;">→</span>' + esc(a) + '</li>').join('') + '</ul>';
        }
        if (lead.enrichedAt) html += '<p style="color:#666;font-size:11px;">분석일: ' + esc(lead.enrichedAt.split('T')[0]) + '</p>';
        html += '</div>';
      }

      // 출처 섹션
      if (lead.sources && lead.sources.length > 0) {
        html += '<div class="detail-section">';
        html += '<h3>출처 (' + lead.sources.length + '건)</h3>';
        html += '<ul style="list-style:none;padding:0;">';
        lead.sources.forEach(s => {
          html += '<li style="margin:6px 0;"><a href="' + safeUrl(s.url) + '" target="_blank" rel="noopener noreferrer" style="color:#3498db;text-decoration:none;font-size:13px;">' + esc(s.title) + '</a></li>';
        });
        html += '</ul></div>';
      }

      // 메모 섹션
      html += '<div class="detail-section">';
      html += '<h3>메모</h3>';
      html += '<textarea class="notes-area" id="notesArea" placeholder="메모를 입력하세요..." oninput="scheduleNoteSave()">' + esc(lead.notes || '') + '</textarea>';
      html += '</div>';

      // 타임라인 섹션
      html += '<div class="detail-section">';
      html += '<h3>상태 변경 타임라인</h3>';
      if (statusLogs.length === 0) {
        html += '<p style="color:#666;font-size:13px;">아직 상태 변경 이력이 없습니다.</p>';
      } else {
        html += '<ul class="timeline">';
        statusLogs.forEach(log => {
          const time = log.changedAt ? new Date(log.changedAt).toLocaleString('ko-KR') : '';
          html += '<li><span class="time">' + esc(time) + '</span>' +
            '<span style="color:' + (statusColors[log.fromStatus] || '#aaa') + '">' + esc(statusLabels[log.fromStatus] || log.fromStatus) + '</span>' +
            ' → <span style="color:' + (statusColors[log.toStatus] || '#aaa') + '">' + esc(statusLabels[log.toStatus] || log.toStatus) + '</span></li>';
        });
        html += '</ul>';
      }
      html += '</div>';

      c.innerHTML = html;
    }

    async function updateField(field, value) {
      try {
        const body = {};
        body[field] = value;
        if (field === 'status') body.status = value;
        const res = await fetch('/api/leads/' + encodeURIComponent(lead.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); if (field === 'status') renderDetail(); return; }
        // 로컬 lead 객체 업데이트
        if (data.lead) Object.assign(lead, data.lead);
        showSaved();
        if (field === 'status') location.reload();
      } catch(e) { alert('업데이트 실패: ' + e.message); }
    }

    let noteTimer;
    function scheduleNoteSave() {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(async () => {
        const val = document.getElementById('notesArea').value;
        await updateField('notes', val);
      }, 800);
    }

    function showSaved() {
      const el = document.getElementById('saveIndicator');
      if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2000); }
    }

    renderDetail();
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
  <div class="container" style="max-width:700px;">
    <a id="leadsBackLink" href="/leads" class="back-link">← 리드 목록</a>
    <h1 style="font-size:22px;">PPT 제안서 생성</h1>
    <p class="subtitle">리드를 선택하면 5슬라이드 제안서 초안을 생성합니다</p>

    <select id="leadSelect"><option value="">리드 로딩 중...</option></select>
    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" id="genBtn" onclick="generatePPT()">제안서 생성</button>
    <div class="status" id="status"></div>
    <div class="ppt-output" id="output"></div>
  </div>

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

function getRoleplayPage() {
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

function getHistoryPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드 히스토리 - CRM</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .history-card { background: #1e2a3a; border-radius: 12px; padding: 16px; margin: 12px 0; border-left: 4px solid #3498db; }
    .history-card.won { border-left-color: #27ae60; }
    .history-card.lost { border-left-color: #7f8c8d; }
    .history-card h3 { color: #fff; margin: 0 0 8px 0; font-size: 16px; }
    .history-card p { margin: 4px 0; font-size: 13px; color: #aaa; }
    .history-card .meta { font-size: 11px; color: #666; margin-top: 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 6px; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .badge-status { background: #3498db; color: #fff; }
    .badge-status.new { background: #3498db; }
    .badge-status.contacted { background: #9b59b6; }
    .badge-status.meeting { background: #e67e22; }
    .badge-status.proposal { background: #1abc9c; }
    .badge-status.won { background: #27ae60; }
    .badge-status.lost { background: #7f8c8d; }
    .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; justify-content: center; }
    .filter-btn { padding: 6px 12px; font-size: 12px; border-radius: 6px; border: 1px solid #444; background: transparent; color: #aaa; cursor: pointer; }
    .filter-btn.active { background: #3498db; border-color: #3498db; color: #fff; }
    .stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 20px; flex-wrap: wrap; }
    .stat-item { text-align: center; }
    .stat-item .num { font-size: 24px; font-weight: bold; color: #e94560; }
    .stat-item .label { font-size: 11px; color: #aaa; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <a id="leadsBackLink" href="/leads" class="back-link" style="margin-bottom:0;">← 최신 리드</a>
      <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
    </div>
    <h1 style="font-size:22px;">리드 히스토리</h1>
    <p class="subtitle">발굴된 모든 리드를 추적하고 관리하세요</p>

    <div class="stats" id="stats"></div>
    <div class="filter-bar" id="filterBar"></div>
    <div id="historyList"><p style="color:#aaa;">로딩 중...</p></div>
  </div>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getProfile() { return new URLSearchParams(window.location.search).get('profile') || 'danfoss'; }
    document.getElementById('leadsBackLink').href = '/leads?profile=' + encodeURIComponent(getProfile());
    let allHistory = [];
    let currentFilter = 'ALL';
    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };

    async function loadHistory() {
      try {
        const res = await fetch('/api/history?profile=' + getProfile(), {headers:authHeaders()});
        const data = await res.json();
        allHistory = data.history || [];

        if (allHistory.length === 0) {
          document.getElementById('historyList').innerHTML = '<p style="color:#aaa;">아직 히스토리가 없습니다.</p>';
          return;
        }

        renderStats();
        renderFilters();
        renderHistory();
      } catch(e) {
        document.getElementById('historyList').innerHTML = '<p style="color:#e74c3c;">로드 실패: ' + esc(e.message) + '</p>';
      }
    }

    function renderStats() {
      const total = allHistory.length;
      const won = allHistory.filter(h => h.status === 'WON').length;
      const active = allHistory.filter(h => !['WON', 'LOST'].includes(h.status)).length;
      document.getElementById('stats').innerHTML = \`
        <div class="stat-item"><div class="num">\${total}</div><div class="label">총 리드</div></div>
        <div class="stat-item"><div class="num" style="color:#27ae60;">\${won}</div><div class="label">수주 성공</div></div>
        <div class="stat-item"><div class="num" style="color:#3498db;">\${active}</div><div class="label">진행 중</div></div>
      \`;
    }

    function renderFilters() {
      const statuses = ['ALL', ...Object.keys(statusLabels)];
      document.getElementById('filterBar').innerHTML = statuses.map(s =>
        \`<button class="filter-btn \${currentFilter === s ? 'active' : ''}" onclick="setFilter('\${s}')">\${s === 'ALL' ? '전체' : statusLabels[s]}</button>\`
      ).join('');
    }

    function setFilter(status) {
      currentFilter = status;
      renderFilters();
      renderHistory();
    }

    function renderHistory() {
      const filtered = currentFilter === 'ALL' ? allHistory : allHistory.filter(h => h.status === currentFilter);
      const sorted = filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      document.getElementById('historyList').innerHTML = sorted.map(lead => \`
        <div class="history-card \${lead.status ? esc(lead.status).toLowerCase() : ''}">
          <h3>
            <span class="badge \${lead.grade === 'A' ? 'badge-a' : 'badge-b'}">\${esc(lead.grade)}</span>
            <span class="badge badge-status \${(lead.status || 'new').toLowerCase()}">\${esc(statusLabels[lead.status]) || '신규'}</span>
            \${esc(lead.company)}
          </h3>
          <p>\${esc(lead.summary)}</p>
          <p><strong>제품:</strong> \${esc(lead.product)} | <strong>점수:</strong> \${parseInt(lead.score)||0}점</p>
          <div class="meta">
            생성: \${lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('ko-KR') : '-'}
            \${lead.updatedAt && lead.updatedAt !== lead.createdAt ? ' | 업데이트: ' + new Date(lead.updatedAt).toLocaleDateString('ko-KR') : ''}
          </div>
        </div>
      \`).join('');
    }

    loadHistory();
  </script>
</body>
</html>`;
}

function getDashboardPage(env) {
  const profileOptions = renderProfileOptions(env);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>대시보드 - B2B 리드</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .dash-card { background: #1e2a3a; border-radius: 12px; padding: 16px; text-align: center; }
    .dash-card .num { font-size: 28px; font-weight: bold; color: #e94560; }
    .dash-card .label { font-size: 12px; color: #aaa; margin-top: 4px; }
    .pipeline-bar { display: flex; height: 32px; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
    .pipeline-seg { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #fff; min-width: 30px; transition: width 0.5s; }
    .activity-feed { list-style: none; padding: 0; }
    .activity-feed li { padding: 10px 0; border-bottom: 1px solid #2a3a4a; font-size: 13px; color: #ccc; }
    .activity-feed .time { color: #666; font-size: 11px; }
    .activity-feed .company { color: #e94560; font-weight: bold; }
    .section-title { font-size: 16px; color: #fff; margin: 20px 0 12px; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .profile-filter { padding: 8px 12px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-status { background: #3498db; color: #fff; }
    .badge-status.contacted { background: #9b59b6; }
    .badge-status.meeting { background: #e67e22; }
    .badge-status.proposal { background: #1abc9c; }
    .badge-status.negotiation { background: #2980b9; }
    .badge-status.won { background: #27ae60; }
    .badge-status.lost { background: #7f8c8d; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <div class="top-nav">
      <a href="/" class="back-link">← 메인</a>
      <div style="display:flex;gap:8px;">
        <a id="dashboardLeadsLink" href="/leads" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">리드 목록</a>
        <a id="dashboardHistoryLink" href="/history" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">히스토리</a>
      </div>
    </div>
    <h1 style="font-size:22px;">대시보드</h1>
    <p class="subtitle">리드 파이프라인 현황</p>

    <select class="profile-filter" id="profileFilter" onchange="loadDashboard()">
      <option value="all">전체 프로필</option>
      ${profileOptions}
    </select>

    <div id="dashContent"><p style="color:#aaa;">로딩 중...</p></div>
  </div>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getToken() { return sessionStorage.getItem('b2b_token') || ''; }
    function detailLink(leadId) {
      const token = getToken();
      return '/leads/' + encodeURIComponent(leadId) + (token ? ('?token=' + encodeURIComponent(token)) : '');
    }
    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };
    const statusColors = { NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' };
    const profileFilter = document.getElementById('profileFilter');
    const initialProfile = new URLSearchParams(window.location.search).get('profile');
    if (initialProfile && Array.from(profileFilter.options).some(o => o.value === initialProfile)) {
      profileFilter.value = initialProfile;
    }

    function syncNavLinks(profile) {
      const p = profile && profile !== 'all' ? '?profile=' + encodeURIComponent(profile) : '';
      document.getElementById('dashboardLeadsLink').href = '/leads' + p;
      document.getElementById('dashboardHistoryLink').href = '/history' + p;
    }

    async function loadDashboard() {
      const profile = document.getElementById('profileFilter').value;
      syncNavLinks(profile);
      const container = document.getElementById('dashContent');
      try {
        const res = await fetch('/api/dashboard?profile=' + encodeURIComponent(profile), {headers:authHeaders()});
        const data = await res.json();
        if (!data.success) { container.innerHTML = '<p style="color:#e74c3c;">' + esc(data.message) + '</p>'; return; }
        const m = data.metrics;

        // 요약 카드
        let html = '<div class="dashboard-cards">';
        html += \`<div class="dash-card"><div class="num">\${m.total}</div><div class="label">총 리드</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#e94560;">\${m.gradeA}</div><div class="label">A등급</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#27ae60;">\${m.conversionRate}%</div><div class="label">전환율</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#3498db;">\${m.active}</div><div class="label">활성 리드</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#f39c12;">\${(m.totalPipelineValue || 0).toLocaleString()}</div><div class="label">진행 중 거래 총액(만원)</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#e74c3c;">\${(m.followUpAlerts || []).length}</div><div class="label">후속 조치 알림</div></div>\`;
        html += '</div>';

        // 파이프라인 바
        if (m.total > 0) {
          html += '<h3 class="section-title">파이프라인</h3>';
          html += '<div class="pipeline-bar">';
          const order = ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON','LOST'];
          order.forEach(s => {
            const cnt = m.statusDistribution[s] || 0;
            if (cnt === 0) return;
            const pct = Math.max((cnt / m.total) * 100, 5);
            html += \`<div class="pipeline-seg" style="width:\${pct}%;background:\${statusColors[s]}" title="\${statusLabels[s]}: \${cnt}건">\${cnt}</div>\`;
          });
          html += '</div>';

          // 범례
          html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
          order.forEach(s => {
            const cnt = m.statusDistribution[s] || 0;
            if (cnt === 0) return;
            html += \`<span style="font-size:11px;color:#aaa;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:\${statusColors[s]};margin-right:4px;"></span>\${statusLabels[s]} \${cnt}</span>\`;
          });
          html += '</div>';
        }

        // 후속 조치 알림
        if (m.followUpAlerts && m.followUpAlerts.length > 0) {
          html += '<h3 class="section-title" style="color:#e74c3c;">후속 조치 알림</h3>';
          html += '<ul class="activity-feed">';
          m.followUpAlerts.forEach(a => {
            const icon = a.isOverdue ? '🔴' : a.isToday ? '🟡' : '🔵';
            const label = a.isOverdue ? '기한 초과' : a.isToday ? '오늘' : '내일';
            html += \`<li style="border-left:3px solid \${a.isOverdue ? '#e74c3c' : '#f39c12'};padding-left:12px;">
              \${icon} <a href="\${detailLink(a.id)}" style="color:#e94560;text-decoration:none;font-weight:bold;">\${esc(a.company)}</a>
              <span style="color:#888;font-size:11px;margin-left:8px;">\${esc(a.followUpDate)} (\${label})</span>
              <span class="badge badge-status \${(a.status||'').toLowerCase()}" style="font-size:10px;padding:1px 6px;margin-left:6px;">\${esc(statusLabels[a.status] || a.status)}</span>
            </li>\`;
          });
          html += '</ul>';
        }

        // 단계별 전환율
        if (m.stageConversions && m.stageConversions.length > 0) {
          html += '<h3 class="section-title">단계별 전환율</h3>';
          html += '<div style="display:grid;gap:8px;margin-bottom:16px;">';
          m.stageConversions.forEach(sc => {
            const barWidth = Math.max(sc.rate, 2);
            html += \`<div style="font-size:12px;color:#ccc;">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span>\${esc(statusLabels[sc.from])} → \${esc(statusLabels[sc.to])}</span>
                <span style="color:\${sc.rate >= 50 ? '#27ae60' : sc.rate >= 25 ? '#f39c12' : '#e74c3c'};font-weight:bold;">\${sc.rate}% (\${sc.count}건)</span>
              </div>
              <div style="background:#2a3a4a;border-radius:4px;height:6px;overflow:hidden;">
                <div style="width:\${barWidth}%;background:\${sc.rate >= 50 ? '#27ae60' : sc.rate >= 25 ? '#f39c12' : '#e74c3c'};height:100%;border-radius:4px;transition:width 0.5s;"></div>
              </div>
            </div>\`;
          });
          html += '</div>';
        }

        // 평균 체류 시간
        if (m.avgDwellDays && Object.keys(m.avgDwellDays).length > 0) {
          html += '<h3 class="section-title">평균 체류 시간 (일)</h3>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">';
          ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION'].forEach(s => {
            if (m.avgDwellDays[s] !== undefined) {
              html += \`<div style="background:#1e2a3a;border-radius:8px;padding:10px 14px;text-align:center;min-width:80px;">
                <div style="font-size:18px;font-weight:bold;color:\${statusColors[s]}">\${m.avgDwellDays[s]}</div>
                <div style="font-size:11px;color:#aaa;">\${esc(statusLabels[s])}</div>
              </div>\`;
            }
          });
          html += '</div>';
        }

        // 진행 중 거래 총액 (단계별)
        if (m.pipelineValueByStatus && Object.values(m.pipelineValueByStatus).some(v => v > 0)) {
          html += '<h3 class="section-title">진행 중 거래 총액 (만원)</h3>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">';
          ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON'].forEach(s => {
            const v = m.pipelineValueByStatus[s] || 0;
            if (v > 0) {
              html += \`<div style="background:#1e2a3a;border-radius:8px;padding:10px 14px;text-align:center;min-width:90px;">
                <div style="font-size:16px;font-weight:bold;color:#27ae60;">\${v.toLocaleString()}</div>
                <div style="font-size:11px;color:#aaa;">\${esc(statusLabels[s])}</div>
              </div>\`;
            }
          });
          html += '</div>';
        }

        // 최근 활동
        if (m.recentActivity && m.recentActivity.length > 0) {
          html += '<h3 class="section-title">최근 활동</h3>';
          html += '<ul class="activity-feed">';
          m.recentActivity.forEach(a => {
            const time = a.changedAt ? new Date(a.changedAt).toLocaleString('ko-KR') : '';
            html += \`<li><span class="time">\${esc(time)}</span> <span class="company">\${esc(a.company)}</span> \${esc(statusLabels[a.fromStatus] || a.fromStatus)} → \${esc(statusLabels[a.toStatus] || a.toStatus)}</li>\`;
          });
          html += '</ul>';
        }

        // 분석 실행 통계
        if (m.analyticsByType && Object.keys(m.analyticsByType).length > 0) {
          html += '<h3 class="section-title">분석 실행</h3>';
          Object.entries(m.analyticsByType).forEach(([type, info]) => {
            html += \`<p style="font-size:13px;color:#ccc;">\${esc(type)}: \${info.runs}회 실행, 총 \${info.totalLeads || 0}건 리드 발굴</p>\`;
          });
        }

        container.innerHTML = html;
      } catch(e) {
        container.innerHTML = '<p style="color:#e74c3c;">대시보드 로드 실패: ' + esc(e.message) + '</p>';
      }
    }

    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    loadDashboard();
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
    .btn-enrich { background: linear-gradient(135deg, #8e44ad, #9b59b6); font-size: 12px; padding: 6px 14px; border: none; border-radius: 6px; color: #fff; cursor: pointer; transition: all 0.3s; }
    .btn-enrich:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(142,68,173,0.4); }
    .btn-enrich:disabled { background: #555; cursor: not-allowed; transform: none; box-shadow: none; }
    .badge-enriched { background: #8e44ad; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: 6px; }
    .enriched-details { margin-top: 12px; padding-top: 12px; border-top: 1px solid #2a3a4a; }
    .enriched-details summary { color: #b39ddb; font-size: 13px; cursor: pointer; font-weight: bold; }
    .enriched-details summary:hover { color: #ce93d8; }
    .enriched-content { padding: 12px 0 0 0; }
    .enriched-block { margin-bottom: 10px; }
    .enriched-block h4 { color: #ce93d8; font-size: 13px; margin: 0 0 4px 0; }
    .enriched-block ul { list-style: none; padding: 0; margin: 0; }
    .enriched-block li { color: #ccc; font-size: 13px; padding: 2px 0; padding-left: 12px; position: relative; }
    .enriched-block li::before { content: '→'; position: absolute; left: 0; color: #8e44ad; }
    .batch-enrich-bar { background: #1e2a3a; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .batch-enrich-bar span { color: #aaa; font-size: 13px; }
    .batch-enrich-bar .btn-enrich { font-size: 13px; padding: 8px 18px; }
    @media print {
      body { background: #fff !important; color: #000 !important; display: block; min-height: auto; }
      .container { max-width: 100% !important; padding: 10px; }
      .btn, .back-link, .top-nav, .tabs, .tab-btn, .nav-buttons, .chat-input, .input-field, .status-select, .notes-section, .profile-filter, select, button, .csv-btn { display: none !important; }
      .lead-card, .history-card, .dash-card, .ss-lead-card { background: #f9f9f9 !important; border: 1px solid #ddd !important; color: #000 !important; page-break-inside: avoid; }
      .lead-card h3, .history-card h3 { color: #333 !important; }
      .lead-info p, .lead-info strong, .history-card p { color: #333 !important; }
      .badge { border: 1px solid #999; }
      .pipeline-bar { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      a { color: #333 !important; text-decoration: none !important; }
    }
  `;
}
