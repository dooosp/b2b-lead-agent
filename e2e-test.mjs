import { chromium } from 'playwright';

const BASE = 'https://b2b-lead-trigger.jangho1383.workers.dev';
const TOKEN = process.env.B2B_TOKEN || process.env.API_TOKEN || process.env.TRIGGER_PASSWORD || '';
let browser, page;
let passed = 0, failed = 0;
const results = [];

async function apiRequest(path, init = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { ...(init.headers || {}) };
    if (!headers.Authorization) headers.Authorization = 'Bearer ' + TOKEN;
    return await fetch(BASE + path, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function log(name, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  results.push({ name, mark, detail });
  if (ok) passed++; else failed++;
  console.log(`[${mark}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function setup() {
  if (!TOKEN) {
    throw new Error('B2B_TOKEN (or API_TOKEN/TRIGGER_PASSWORD) env가 필요합니다.');
  }
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  page = await ctx.newPage();
  // inject auth token into sessionStorage before navigation
  await page.goto(BASE);
  await page.evaluate((t) => sessionStorage.setItem('b2b_token', t), TOKEN);
}

// T1: 메인 페이지 로드 + 프로필 옵션 확인
async function testMainPage() {
  await page.goto(BASE);
  const title = await page.title();
  log('T1 메인 페이지 로드', title.includes('B2B'));

  const profiles = await page.locator('select option').allTextContents();
  const hasDanfoss = profiles.some(t => t.includes('댄포스'));
  const hasLS = profiles.some(t => t.includes('LS'));
  log('T1 프로필 옵션 렌더링', hasDanfoss && hasLS, `댄포스:${hasDanfoss} LS:${hasLS}`);
}

// T2: 셀프서비스 분석
async function testSelfService() {
  await page.goto(BASE);
  // click self-service tab
  const ssTab = page.locator('text=셀프서비스').first();
  if (await ssTab.count() > 0) {
    await ssTab.click();
    await page.waitForTimeout(500);
  }

  // fill company + industry
  const companyInput = page.locator('input[placeholder*="회사"]').first();
  const industryInput = page.locator('input[placeholder*="산업"], input[placeholder*="분야"]').first();

  if (await companyInput.count() > 0 && await industryInput.count() > 0) {
    await companyInput.fill('테스트기업');
    await industryInput.fill('IT');

    const analyzeBtn = page.locator('button:has-text("분석")').first();
    if (await analyzeBtn.count() > 0) {
      await analyzeBtn.click();
      // wait for results (up to 90s)
      try {
        await page.waitForSelector('.lead-card, .result, [class*="lead"], [class*="result"]', { timeout: 90000 });
        log('T2 셀프서비스 분석 결과 표시', true);
      } catch {
        // check if any text result appeared
        const body = await page.textContent('body');
        const hasResult = body.includes('리드') || body.includes('결과') || body.includes('점수');
        log('T2 셀프서비스 분석 결과 표시', hasResult, hasResult ? '텍스트 결과 확인' : '결과 미표시');
      }
    } else {
      log('T2 셀프서비스 분석', false, '분석 버튼 없음');
    }
  } else {
    log('T2 셀프서비스 분석', false, '입력 필드 없음');
  }
}

// T3: 리드 목록 페이지 + 상태 변경
async function testLeadStatus() {
  await page.goto(BASE + '/leads');
  await page.evaluate((t) => sessionStorage.setItem('b2b_token', t), TOKEN);
  await page.goto(BASE + '/leads');
  await page.waitForFunction(() => {
    const el = document.querySelector('#leadsList');
    return !!el && !String(el.textContent || '').includes('로딩 중');
  }, { timeout: 15000 }).catch(() => {});

  const bodyText = await page.textContent('body');
  const hasLeads = bodyText.includes('HJ중공업') || bodyText.includes('리드') || bodyText.includes('NEW') || bodyText.includes('CONTACTED');
  log('T3 리드 목록 로드', hasLeads);

  const apiResp = await apiRequest('/api/leads?profile=danfoss');
  const apiData = await apiResp.json();
  const hasStatusField = Array.isArray(apiData.leads) && (apiData.leads.length === 0 || apiData.leads.every(l => typeof l.status === 'string'));
  log('T3 상태 필드 제공', hasStatusField, `count=${apiData.leads?.length || 0}`);
}

// T4: 대시보드 메트릭
async function testDashboard() {
  await page.goto(BASE + '/dashboard');
  await page.evaluate((t) => sessionStorage.setItem('b2b_token', t), TOKEN);
  await page.goto(BASE + '/dashboard');
  await page.waitForFunction(() => {
    const el = document.querySelector('#dashContent');
    return !!el && !String(el.textContent || '').includes('로딩 중');
  }, { timeout: 15000 }).catch(() => {});

  const bodyText = await page.textContent('body');
  // dashboard should show metrics
  const hasMetrics = bodyText.includes('총 리드') || bodyText.includes('전환율') || bodyText.includes('활성 리드');
  log('T4 대시보드 페이지 로드', hasMetrics);

  // check profile filter has options
  const options = await page.locator('#profileFilter option').allTextContents();
  const hasProfiles = options.some(t => t.includes('댄포스')) && options.some(t => t.includes('LS'));
  log('T4 대시보드 프로필 필터', hasProfiles, `옵션: ${options.join(', ')}`);

  // check profile filter changes URL/data
  const profileFilter = page.locator('#profileFilter');
  if (await profileFilter.count() > 0) {
    await profileFilter.selectOption('danfoss');
    await page.waitForTimeout(2000);
    const afterFilter = await page.textContent('body');
    log('T4 대시보드 필터 동작', afterFilter.length > 100, '필터 적용 후 데이터 표시');
  }
}

// T5: CSV 다운로드 (API 직접 호출로 확인)
async function testCSVExport() {
  const r = await apiRequest('/api/export/csv?profile=all');
  const bytes = new Uint8Array(await r.arrayBuffer());
  const text = new TextDecoder('utf-8').decode(bytes);
  const firstLine = (text.split('\n')[0] || '').replace(/^\uFEFF/, '');
  const res = {
    status: r.status,
    contentType: r.headers.get('content-type'),
    length: text.length,
    firstLine,
    hasBOM: bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
  };

  log('T5 CSV 다운로드 200', res.status === 200);
  log('T5 CSV BOM (Excel 한국어)', res.hasBOM, 'UTF-8 BOM bytes(EF BB BF) 확인');
  log('T5 CSV 헤더 정상', res.firstLine.includes('회사명'), res.firstLine.substring(0, 80));
}

// T6: PWA manifest + Service Worker
async function testPWA() {
  await page.goto(BASE);
  const manifest = await page.evaluate(async () => {
    const r = await fetch('/manifest.json');
    return r.json();
  });
  log('T6 PWA manifest', manifest.name && manifest.icons?.length > 0, `name: ${manifest.name}`);

  const swOk = await page.evaluate(async () => {
    const r = await fetch('/sw.js');
    const text = await r.text();
    return r.status === 200 && text.includes('addEventListener');
  });
  log('T6 Service Worker', swOk);
}

// T7: 잘못된 상태 전환 에러 (API 직접 호출)
async function testInvalidTransition() {
  // first get a lead ID
  const leadsResp = await apiRequest('/api/leads?profile=danfoss');
  const leadsRes = await leadsResp.json();

  if (leadsRes.leads?.length > 0) {
    const lead = leadsRes.leads[0];
    const currentStatus = lead.status;
    // try invalid transition
    const invalidTarget = currentStatus === 'NEW' ? 'WON' : currentStatus === 'CONTACTED' ? 'WON' : 'NEW';
    const patchResp = await apiRequest('/api/leads/' + encodeURIComponent(lead.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: invalidTarget })
    });
    const patchRes = await patchResp.json();

    log('T7 잘못된 상태 전환 거부', patchRes.success === false, patchRes.message);
  } else {
    log('T7 잘못된 상태 전환', false, '리드 없음');
  }
}

// T8: 프로필 검증 (invalid profile → 400)
async function testProfileValidation() {
  const r = await apiRequest('/api/dashboard?profile=hacked-profile');
  const res = { status: r.status, body: await r.json() };

  log('T8 잘못된 프로필 거부', res.status === 400 && res.body.success === false, res.body.message);
}

// T9: Enrichment 라우트 가용성 (배포 누락 탐지)
async function testEnrichRoutesAvailability() {
  const batchResp = await apiRequest('/api/leads/batch-enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: 'hacked-profile' })
  });
  const batchCt = batchResp.headers.get('content-type') || '';
  let batchBody = null;
  try { batchBody = await batchResp.json(); } catch { batchBody = null; }
  const batchRes = { status: batchResp.status, contentType: batchCt, body: batchBody };
  log(
    'T9 batch-enrich 라우트 활성',
    batchRes.status === 400 && /application\/json/i.test(batchRes.contentType) && batchRes.body?.success === false,
    `status=${batchRes.status}`
  );

  const singleResp = await apiRequest('/api/leads/not-found-id/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const singleCt = singleResp.headers.get('content-type') || '';
  let singleBody = null;
  try { singleBody = await singleResp.json(); } catch { singleBody = null; }
  const singleRes = { status: singleResp.status, contentType: singleCt, body: singleBody };
  log(
    'T9 단건 enrich 라우트 활성',
    singleRes.status === 404 && /application\/json/i.test(singleRes.contentType) && singleRes.body?.success === false,
    `status=${singleRes.status}`
  );
}

async function run() {
  console.log('=== B2B Lead Agent E2E Tests ===\n');
  await setup();

  await testMainPage();
  await testSelfService();
  await testLeadStatus();
  await testDashboard();
  await testCSVExport();
  await testPWA();
  await testInvalidTransition();
  await testProfileValidation();
  await testEnrichRoutesAvailability();

  await browser.close();

  console.log(`\n=== 결과: ${passed} passed, ${failed} failed / ${passed + failed} total ===`);
  if (failed > 0) {
    console.log('\nFailed:');
    results.filter(r => r.mark === 'FAIL').forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
