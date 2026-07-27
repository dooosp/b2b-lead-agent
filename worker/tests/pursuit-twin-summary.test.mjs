import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  PURSUIT_TWIN_SUMMARY_CANONICAL_SHA256,
  PURSUIT_TWIN_SUMMARY_SAMPLE,
  canonicalizePursuitTwinSummary,
  escapePursuitTwinHtml,
  renderPursuitTwinSummary,
  validatePursuitTwinSummary,
} from '../pages/pursuit-twin-summary.js';

function cloneSample() {
  return structuredClone(PURSUIT_TWIN_SUMMARY_SAMPLE);
}

test('checked-in Pursuit Twin summary is canonical hash-bound and renders both v0 contracts', () => {
  const { canonicalSha256, ...body } = PURSUIT_TWIN_SUMMARY_SAMPLE;
  const recomputed = createHash('sha256')
    .update(canonicalizePursuitTwinSummary(body))
    .digest('hex');

  assert.equal(canonicalSha256, PURSUIT_TWIN_SUMMARY_CANONICAL_SHA256);
  assert.equal(recomputed, PURSUIT_TWIN_SUMMARY_CANONICAL_SHA256);
  assert.equal(validatePursuitTwinSummary(PURSUIT_TWIN_SUMMARY_SAMPLE), PURSUIT_TWIN_SUMMARY_SAMPLE);

  const html = renderPursuitTwinSummary(PURSUIT_TWIN_SUMMARY_SAMPLE);
  assert.match(html, /data-testid="pursuit-twin-v0-summary"/);
  assert.match(html, /data-testid="spec-delta-summary"/);
  assert.match(html, /SPEC-R1 · BASIC_DESIGN/);
  assert.match(html, /SPEC-R2 · TENDER/);
  assert.match(html, /FIT[\s\S]*INSUFFICIENT_EVIDENCE/);
  assert.match(html, /OPEN[\s\S]*CLOSING/);
  assert.match(html, /PURSUE → REVIEW_REQUIRED/);
  assert.match(html, /carry-forward: false/);
  assert.match(html, /data-testid="minimum-evidence-summary"/);
  assert.match(html, /담당 side: PROJECT/);
  assert.doesNotMatch(html, /담당 side: PRODUCT/);
  assert.match(html, /재평가를 가능하게 할 뿐, FIT를 보장하지 않습니다/);
  assert.match(html, /SYNTHETIC · NOT_PRODUCTION_EVIDENCE/);
  assert.match(html, /Issue #165 production proof: HOLD/);
  assert.match(html, /final decision: NOT_MADE/);
});

test('Pursuit Twin summary renderer escapes every view-model text boundary', () => {
  assert.equal(
    escapePursuitTwinHtml(`<img src=x onerror="alert('x')"> &`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;',
  );
  const html = renderPursuitTwinSummary(PURSUIT_TWIN_SUMMARY_SAMPLE);
  assert.doesNotMatch(html, /<script|onerror=/i);
});

test('Pursuit Twin summary fails closed for non-local boundaries and unsafe authority claims', () => {
  const productionBoundary = cloneSample();
  productionBoundary.boundary = 'PRODUCTION_EVIDENCE';
  assert.throws(
    () => renderPursuitTwinSummary(productionBoundary),
    /boundary must be local\/test-only/,
  );

  const notSynthetic = cloneSample();
  notSynthetic.synthetic = false;
  assert.throws(() => renderPursuitTwinSummary(notSynthetic), /explicitly synthetic/);

  const productionReady = cloneSample();
  productionReady.productionReady = true;
  assert.throws(() => renderPursuitTwinSummary(productionReady), /cannot claim production readiness/);

  const finalDecision = cloneSample();
  finalDecision.finalHumanPursuitDecision = 'PURSUE';
  assert.throws(() => renderPursuitTwinSummary(finalDecision), /cannot carry a final human pursuit decision/);

  const carriedDecision = cloneSample();
  carriedDecision.specDelta.priorDecisionReview.carryForwardAllowed = true;
  assert.throws(() => renderPursuitTwinSummary(carriedDecision), /refuse decision carry-forward/);
});

test('Pursuit Twin summary rejects drift even when a caller reuses the checked-in hash', () => {
  const drifted = cloneSample();
  drifted.opportunity.label = 'tampered local sample';
  assert.equal(drifted.canonicalSha256, PURSUIT_TWIN_SUMMARY_CANONICAL_SHA256);
  assert.throws(
    () => renderPursuitTwinSummary(drifted),
    /does not match the hash-bound checked-in view model/,
  );

  const outOfOrder = cloneSample();
  outOfOrder.minimumEvidenceToAdvance.items[0].order = 2;
  assert.throws(() => renderPursuitTwinSummary(outOfOrder), /contiguous review order/);
});
