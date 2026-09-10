const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const cheerio = require('cheerio');

const REPO_ROOT = path.resolve(__dirname, '..');
const RENDERER_URL = pathToFileURL(
  path.join(REPO_ROOT, 'scripts/lib/pursuit-value-pilot-offline-html.mjs'),
).href;
const FILE_HELPER_URL = pathToFileURL(
  path.join(REPO_ROOT, 'scripts/lib/pursuit-value-pilot-files.mjs'),
).href;

let fixturePromise;

async function fixture() {
  if (!fixturePromise) {
    fixturePromise = Promise.all([
      import(RENDERER_URL),
      import(FILE_HELPER_URL),
    ]).then(async ([renderer, files]) => ({
      renderer,
      context: await files.buildRepositoryPursuitValuePilotContext(),
    }));
  }
  return fixturePromise;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runtimeConfig(html) {
  const match = html.match(/<script id="pilot-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'embedded runtime config must exist');
  return JSON.parse(match[1]);
}

test('offline HTML is deterministic and follows both fixed counterbalanced orders', async () => {
  const { renderer, context } = await fixture();
  const observedOrders = new Set();

  for (const session of context.sessions) {
    const first = renderer.renderPursuitValuePilotOfflineHtml(
      context.protocol,
      session,
      context.cases,
    );
    const second = renderer.renderPursuitValuePilotOfflineHtml(
      context.protocol,
      session,
      context.cases,
    );
    assert.equal(first, second);

    const config = runtimeConfig(first);
    observedOrders.add(config.phaseOrder.join(','));
    assert.deepEqual(
      config.phaseOrder,
      config.phaseOrder[0] === 'baseline' ? ['baseline', 'twin'] : ['twin', 'baseline'],
    );
    assert.notEqual(session.humanInput.baseline.caseId, session.humanInput.twin.caseId);
    assert.ok(first.indexOf(`id="phase-${config.phaseOrder[0]}"`) < first.indexOf(`id="phase-${config.phaseOrder[1]}"`));
    assert.match(first, /id="phase-baseline"[^>]* hidden/);
    assert.match(first, /id="phase-twin"[^>]* hidden/);
    assert.match(first, /id="baseline-material" hidden/);
    assert.match(first, /id="twin-material" hidden/);
    assert.match(first, /id="baseline-answers" class="phase-answers" hidden disabled/);
    assert.match(first, /id="twin-answers" class="phase-answers" hidden disabled/);
  }

  assert.deepEqual(
    [...observedOrders].sort(),
    ['baseline,twin', 'twin,baseline'],
  );
});

test('page visibly freezes local synthetic authority boundaries and refresh-loss warning', async () => {
  const { renderer, context } = await fixture();
  const html = renderer.renderPursuitValuePilotOfflineHtml(
    context.protocol,
    context.sessions[0],
    context.cases,
  );

  for (const text of [
    'LOCAL/TEST SYNTHETIC ONLY',
    'NOT_PRODUCTION_EVIDENCE',
    'productionReady:false',
    'Issue #165 HOLD',
    'reviewer identity: NOT_COLLECTED',
    '어떤 데이터도 전송하지 않습니다',
    '새로고침·탭 닫기 경고',
    '입력과 측정 시간이 손실됩니다',
    '자동 판단이 없습니다',
  ]) assert.equal(html.includes(text), true, text);

  assert.match(html, /Baseline raw artifact/);
  assert.match(html, /Twin Spec Delta/);
  assert.match(html, /Minimum Evidence to Advance/);
  assert.match(html, /판단 trace ID 목록/);
  assert.match(html, /증거가 채워져도 재평가만 가능하며 FIT은 보장되지 않습니다/);
  assert.doesNotMatch(html, /human evidence (?:complete|passed)|productionReady:true/i);
});

test('standalone page has no external, network, persistence, cookie, or arbitrary-text surface', async () => {
  const { renderer, context } = await fixture();
  const html = renderer.renderPursuitValuePilotOfflineHtml(
    context.protocol,
    context.sessions[0],
    context.cases,
  );

  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /@import|@font-face|\burl\s*\(/i);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/i);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/i);
  assert.doesNotMatch(html, /<form\b[^>]*\baction\s*=/i);
  assert.doesNotMatch(html, /<textarea\b|contenteditable|<input\b[^>]*type="(?:text|email|url|tel|search|password)"/i);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /new Blob\(\[serialized\]/);
  assert.match(html, /URL\.createObjectURL\(blob\)/);
});

test('HTML and embedded JSON escaping refuse script termination and Unicode separators', async () => {
  const { renderer } = await fixture();
  const poison = '</script><script>globalThis.pwned=true</script>\u2028\u2029<&"\'';
  const escaped = renderer.escapePursuitValuePilotHtml(poison);
  assert.doesNotMatch(escaped, /<script>|<\/script>/);
  assert.match(escaped, /&lt;\/script&gt;/);
  assert.match(escaped, /&amp;/);
  assert.match(escaped, /&quot;/);
  assert.match(escaped, /&#39;/);

  const scriptData = renderer.serializePursuitValuePilotScriptData({ poison });
  assert.doesNotMatch(scriptData, /<\/script>|<script>/);
  assert.match(scriptData, /\\u003c\/script\\u003e/);
  assert.match(scriptData, /\\u2028/);
  assert.match(scriptData, /\\u2029/);
  assert.deepEqual(JSON.parse(scriptData), { poison });
});

test('renderer refuses prefilled human input, production claims, and wrong catalog pins', async () => {
  const { renderer, context } = await fixture();
  const prefilled = clone(context.sessions[0]);
  prefilled.humanInput.finalDisposition = 'ADVANCE';
  assert.throws(() => renderer.renderPursuitValuePilotOfflineHtml(
    context.protocol,
    prefilled,
    context.cases,
  ));

  const productionProtocol = clone(context.protocol);
  productionProtocol.productionReady = true;
  assert.throws(() => renderer.renderPursuitValuePilotOfflineHtml(
    productionProtocol,
    context.sessions[0],
    context.cases,
  ));

  const wrongCatalog = clone(context.cases);
  wrongCatalog.canonicalSha256 = '0'.repeat(64);
  assert.throws(() => renderer.renderPursuitValuePilotOfflineHtml(
    context.protocol,
    context.sessions[0],
    wrongCatalog,
  ));

  assert.throws(
    () => renderer.renderPursuitValuePilotOfflineHtml(
      context.protocol,
      context.sessions[0],
    ),
    (error) => error?.code === 'CASE_CATALOG_REQUIRED',
  );
});

test('accessibility structure provides legends, labels, keyboard controls, status, and linked errors', async () => {
  const { renderer, context } = await fixture();
  const html = renderer.renderPursuitValuePilotOfflineHtml(
    context.protocol,
    context.sessions[1],
    context.cases,
  );
  const $ = cheerio.load(html);

  assert.equal($('html').attr('lang'), 'ko');
  assert.equal($('meta[name="viewport"]').attr('content'), 'width=device-width, initial-scale=1');
  assert.equal($('fieldset').length > 10, true);
  $('fieldset').each((_index, fieldset) => {
    assert.equal($(fieldset).children('legend').length, 1);
  });
  $('input, select').each((_index, control) => {
    const id = $(control).attr('id');
    assert.ok(id, $.html(control));
    assert.equal(
      $(`label[for="${id}"]`).length > 0 || $(control).parents('label').length > 0,
      true,
      id,
    );
  });
  assert.equal($('button:not([type="button"])').length, 0);
  assert.equal($('#status[role="status"][aria-live="polite"][aria-atomic="true"]').length, 1);
  assert.equal($('#error-summary[role="alert"][tabindex="-1"]').length, 1);
  assert.equal($('#phase-baseline-heading[tabindex="-1"]').length, 1);
  assert.equal($('#phase-twin-heading[tabindex="-1"]').length, 1);
  assert.equal($('#post-session-heading[tabindex="-1"]').length, 1);
  assert.equal($('fieldset[tabindex="-1"]').length > 0, true);
  assert.equal($('.skip-link[href="#main-content"]').length, 1);
  assert.match(html, /Tab으로 항목을 이동하고 Space로 선택하며 Enter로 버튼을 실행/);
  assert.match(html, /라디오 선택만으로는 다음 단계로 이동하지 않습니다/);
  assert.match(html, /performance\.now\(\)/);
  assert.match(html, /byId\(phase \+ '-material'\)\.hidden = false/);
  assert.match(html, /byId\(phase \+ '-answers'\)\.hidden = false/);
  assert.match(html, /beforeunload/);
  assert.match(html, /@media \(max-width: 42rem\)/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /summary\.focus\(\)/);
  assert.match(html, /heading\.focus\(\)/);
});

test('download is a response envelope with the exact fixed filename and no authority hash claim', async () => {
  const { renderer, context } = await fixture();
  for (const [index, session] of context.sessions.entries()) {
    const html = renderer.renderPursuitValuePilotOfflineHtml(
      context.protocol,
      session,
      context.cases,
    );
    const config = runtimeConfig(html);
    assert.equal(config.responseSchemaVersion, 'pursuit-value-pilot-session-response-v0');
    assert.equal(config.protocolCanonicalSha256, context.protocol.canonicalSha256);
    assert.equal(config.blankSessionCanonicalSha256, session.canonicalSha256);
    assert.equal(config.sessionId, session.sessionId);
    assert.equal(config.reviewerId, session.reviewerId);
    assert.equal(config.assignedRole, session.assignedRole);
    assert.equal(config.downloadFilename, `session-pv-r${index + 1}.json`);
    assert.deepEqual(config.blankHumanInput, session.humanInput);

    assert.match(html, /schemaVersion: config\.responseSchemaVersion/);
    assert.match(html, /blankSessionCanonicalSha256: config\.blankSessionCanonicalSha256/);
    assert.match(html, /humanInput: JSON\.parse\(JSON\.stringify\(config\.blankHumanInput\)\)/);
    assert.match(html, /JSON\.stringify\(response, null, 2\)/);
    assert.match(html, /link\.download = config\.downloadFilename/);
    assert.match(html, /role !== config\.assignedRole/);
    assert.match(html, />응답 JSON 다운로드 — 서버로 전송되지 않음<\/button>/);
    assert.doesNotMatch(html, /response\.canonicalSha256\s*=/);
    assert.doesNotMatch(html, /제출 완료|승인 완료|통과했습니다/);
  }
});
