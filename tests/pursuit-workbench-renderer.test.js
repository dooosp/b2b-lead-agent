const test = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const { loadWorkbenchDomain, loadWorkbenchViewModel } = require('./helpers/pursuit-workbench');

test('renderer emits a semantic decision-first page without inline executable content', async () => {
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const scenarios = await (await import('../pursuit-workbench/domain/scenarios.mjs')).listPursuitWorkbenchScenarios();
  const html = renderer.renderPursuitWorkbenchPage(await loadWorkbenchViewModel(), scenarios);
  const $ = cheerio.load(html);
  assert.equal($('h1').length, 1);
  assert.equal($('main[aria-labelledby="scenario-heading"]').length, 1);
  assert.equal($('nav[aria-label="Synthetic scenario control"]').length, 1);
  assert.equal($('ol.timeline-list').length, 1);
  assert.ok($('ol.timeline-list > li').length >= 1);
  assert.ok($('.timeline-event.state-evidence .event-class').toArray().every((element) => $(element).text() === 'Evidence'));
  assert.ok($('.timeline-event.state-derived .event-class').toArray().every((element) => $(element).text() === 'Derived'));
  assert.ok($('.timeline-event.state-derived').length >= 1);
  assert.equal($('table caption').text().includes('Specification Fit Matrix'), true);
  assert.equal($('thead th[scope="col"]').length, 8);
  assert.equal($('tbody th[scope="row"]').length, 1);
  assert.ok($('fieldset legend').length >= 4);
  assert.equal($('textarea:not([readonly]), [contenteditable]').length, 0);
  assert.equal($('script:not([src]), style, [onclick], [onchange], [onerror]').length, 0);
  assert.equal($('script[src="/assets/pursuit-workbench.js"][type="module"]').length, 1);
  assert.equal($('a[href^="http"], img, iframe, object').length, 0);
  const headingLevels = $('h1,h2,h3').map((_index, element) => Number(element.tagName.slice(1))).get();
  for (let index = 1; index < headingLevels.length; index += 1) assert.ok(headingLevels[index] - headingLevels[index - 1] <= 1);
  assert.ok(Buffer.byteLength(html, 'utf8') < renderer.WORKBENCH_HTML_MAX_BYTES);
});

test('review controls expose only family-supported dispositions and selection-scoped reasons', async () => {
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const scenarios = await (await import('../pursuit-workbench/domain/scenarios.mjs')).listPursuitWorkbenchScenarios();
  const missing = renderer.renderPursuitWorkbenchPage(await loadWorkbenchViewModel('missing_incoming_voltage'), scenarios);
  const $missing = cheerio.load(missing);
  assert.deepEqual($missing('input[name="disposition"]').map((_index, element) => $missing(element).val()).get().sort(), [
    'HOLD_FOR_PROJECT_EVIDENCE', 'HOLD_FOR_TECHNICAL_REQUIREMENTS'
  ]);
  assert.equal($missing('input[name="disposition"][value="REJECT_TECHNICAL_MISMATCH"]').length, 0);
  assert.equal($missing('input[name="reason"]:not([disabled])').length, 0);
  assert.equal($missing('#reason-empty:not([hidden])').length, 1);

  const multi = renderer.renderPursuitWorkbenchPage(await loadWorkbenchViewModel('multi_family_datacenter_opportunity'), scenarios);
  const $multi = cheerio.load(multi);
  const familyIds = new Set($multi('[data-review-family]').map((_index, element) => $multi(element).attr('data-review-family')).get());
  assert.deepEqual([...familyIds].sort(), ['building_management', 'medium_voltage_switchgear']);
  assert.ok($multi('[data-review-family][data-review-disposition]').length > 0);
});

test('hostile claim, source, product, scenario, and question text is escaped as inert content', async () => {
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const scenarioDomain = await import('../pursuit-workbench/domain/scenarios.mjs');
  const { inputs, catalog } = await loadWorkbenchDomain('strong_verified_electrical_fit');
  const hostileInputs = structuredClone(inputs);
  const payloads = {
    statement: '<script>globalThis.pwned=1</script>',
    title: '</script><img src=x onerror="globalThis.pwned=2">',
    quote: '**Markdown** & `code` <svg onload="globalThis.pwned=3">',
    product: '중전압 개폐장치 <img onerror="globalThis.pwned=4">',
    scenario: 'Scenario </style><script>globalThis.pwned=5</script>'
  };
  for (const key of ['stage_basic_design', 'req_voltage_22_9kv', 'cap_switchgear_24kv']) {
    const claim = hostileInputs.rawRegistry.claims.find((item) => item.claimKey === key);
    claim.statement = `${payloads.statement} ${key}`;
    claim.evidence[0].sourceTitle = `${payloads.title} ${key}`;
    claim.evidence[0].directQuote = `${payloads.quote} ${key}`;
  }
  hostileInputs.productFamilyMap.families.find((item) => item.id === 'medium_voltage_switchgear').displayNameKo = payloads.product;
  const hostileCatalog = structuredClone(catalog);
  const selected = hostileCatalog.scenarios.find((item) => item.id === 'strong_verified_electrical_fit');
  selected.title = payloads.scenario;
  selected.description = 'Quotes " ampersand & Korean 기술 검토 and </script> remain text.';
  const viewModel = await scenarioDomain.materializePursuitWorkbenchScenario('strong_verified_electrical_fit', { inputs: hostileInputs, catalog: hostileCatalog });
  const scenarios = await scenarioDomain.listPursuitWorkbenchScenarios({ inputs: hostileInputs, catalog: hostileCatalog });
  const html = renderer.renderPursuitWorkbenchPage(viewModel, scenarios);
  const $ = cheerio.load(html);
  assert.equal($('script:not([src]), style, img, svg, [onerror], [onload]').length, 0);
  assert.equal(globalThis.pwned, undefined);
  assert.ok($('main').text().includes('<script>globalThis.pwned=1</script>'));
  assert.ok($('main').text().includes('**Markdown** & `code`'));
  assert.ok($('main').text().includes('중전압 개폐장치'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('<svg onload'), false);
});

test('hostile technical question text and requested artifacts remain escaped', async () => {
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const scenarioDomain = await import('../pursuit-workbench/domain/scenarios.mjs');
  const { inputs, catalog } = await loadWorkbenchDomain('missing_incoming_voltage');
  const hostileInputs = structuredClone(inputs);
  hostileInputs.verticalPack.questionPolicies.incoming_voltage.text = 'What is </script><img onerror="questionPwned=1">?';
  hostileInputs.verticalPack.questionPolicies.incoming_voltage.requestedArtifact = '**diagram** <svg onload="questionPwned=2">';
  const viewModel = await scenarioDomain.materializePursuitWorkbenchScenario('missing_incoming_voltage', { inputs: hostileInputs, catalog });
  const scenarios = await scenarioDomain.listPursuitWorkbenchScenarios({ inputs: hostileInputs, catalog });
  const html = renderer.renderPursuitWorkbenchPage(viewModel, scenarios);
  const $ = cheerio.load(html);
  assert.equal($('img, svg, [onerror], [onload]').length, 0);
  assert.ok($('#question-fieldset').text().includes('What is </script><img onerror="questionPwned=1">?'));
  assert.ok($('#question-fieldset').text().includes('**diagram** <svg onload="questionPwned=2">'));
});

test('blocked claim statements, quotes, titles, and urls do not cross the HTML boundary', async () => {
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const scenarios = await (await import('../pursuit-workbench/domain/scenarios.mjs')).listPursuitWorkbenchScenarios();
  const { materialized } = await loadWorkbenchDomain('conflicting_capability_claims');
  const blockedClaim = materialized.registry.byKey.get('cap_fire_conflict_yes');
  const html = renderer.renderPursuitWorkbenchPage(await loadWorkbenchViewModel('conflicting_capability_claims'), scenarios);
  assert.equal(html.includes(blockedClaim.statement), false);
  assert.equal(html.includes(blockedClaim.evidence[0].sourceTitle), false);
  assert.equal(html.includes(blockedClaim.evidence[0].directQuote), false);
  assert.equal(html.includes(blockedClaim.evidence[0].sourceUrl), false);
  assert.ok(html.includes(blockedClaim.claimId));
  assert.match(html, /Statement, quote, source title, and URL intentionally withheld/);
});

test('every potentially executable token is escaped by the renderer primitive', async () => {
  const { escapeWorkbenchHtml } = await import('../pursuit-workbench/renderer.mjs');
  const inputs = [
    '<script>alert(1)</script>', '</script><script>alert(2)</script>', '<img src=x onerror=alert(3)>',
    '" onmouseover="alert(4)', "' autofocus onfocus='alert(5)", '&copy;', '**markdown**', '한국어 기술 검토'
  ];
  for (const input of inputs) {
    const escaped = escapeWorkbenchHtml(input);
    assert.equal(escaped.includes('<script'), false);
    assert.equal(escaped.includes('<img'), false);
    assert.equal(escaped.includes('"'), false);
    assert.equal(escaped.includes("'"), false);
    assert.equal(cheerio.load(`<p>${escaped}</p>`)('p').text(), input);
  }
});

test('error page contains no stale scenario, filesystem path, or packet controls', async () => {
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const scenarios = await (await import('../pursuit-workbench/domain/scenarios.mjs')).listPursuitWorkbenchScenarios();
  const html = renderer.renderPursuitWorkbenchErrorPage(scenarios, 503);
  const $ = cheerio.load(html);
  assert.equal($('#load-error[role="alert"][tabindex="-1"]').length, 1);
  assert.equal($('#packet-copy, #packet-download, #review-form').length, 0);
  assert.doesNotMatch(html, /\/Users\/|node:internal|Bearer|stack/i);
  assert.match($('#load-error').text(), /No prior scenario data or review packet/);
});

test('renderer output excludes manual notes, reviewer feedback, and sales approval language', async () => {
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const scenarios = await (await import('../pursuit-workbench/domain/scenarios.mjs')).listPursuitWorkbenchScenarios();
  const html = renderer.renderPursuitWorkbenchPage(await loadWorkbenchViewModel('missing_incoming_voltage'), scenarios);
  assert.doesNotMatch(html, /manualReviewNotes|reviewerFeedback|generatedSuggestion|APPROVED_FOR_OUTREACH|SEND_EMAIL|CREATE_CRM_OPPORTUNITY|COMMERCIAL_GO/);
  assert.match(html, /not saved, not sent, no reviewer identity collected/i);
});
