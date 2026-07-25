import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERFORMANCE_HEAP_DELTA_LIMIT_BYTES,
  PERFORMANCE_PHASE_LIMIT_MS,
  measureEvidenceClaimWorkbench
} from '../scripts/measure-evidence-claim-workbench.mjs';

test('synthetic Workbench performance covers required document, page, and candidate scales', async () => {
  const report = await measureEvidenceClaimWorkbench();
  assert.equal(report.status, 'OFFICIAL_EVIDENCE_WORKBENCH_PERFORMANCE_PASS');
  assert.equal(report.boundary, 'LOCAL_SYNTHETIC_MEASUREMENT');
  assert.equal(report.productionReady, false);
  assert.equal(report.productionReviewerWorkflowReady, false);
  assert.equal(report.issue165Status, 'HOLD');
  assert.deepEqual(
    report.measurements.filter(({ label }) => label === 'source_bundle_validation').map(({ scale }) => scale),
    [1, 10, 100]
  );
  assert.deepEqual(
    report.measurements.filter(({ label }) => label === 'page_validation_and_lookup').map(({ scale }) => scale),
    [100, 1_000]
  );
  assert.deepEqual(
    report.measurements.filter(({ label }) => label === 'candidate_generation').map(({ scale }) => scale),
    [10, 100, 1_000]
  );
  assert.deepEqual(
    report.measurements.filter(({ label }) => label === 'conflict_detection').map(({ scale }) => scale),
    [10, 100]
  );
  assert.deepEqual(
    report.measurements.filter(({ label }) => label === 'repeated_quote_occurrence_binding').map(({ scale }) => scale),
    [1, 10, 100]
  );
  assert.ok(report.measurements.some(({ label }) => label === 'inbox_manifest_audit'));
  assert.ok(report.measurements.some(({ label }) => label === 'quote_anchoring'));
  assert.ok(report.measurements.some(({ label }) => label === 'review_patch_generation'));
  assert.ok(report.measurements.some(({ label }) => label === 'workbench_page_rendering'));
  for (const measurement of report.measurements) {
    assert.ok(measurement.durationMs < PERFORMANCE_PHASE_LIMIT_MS, `${measurement.label}:${measurement.scale}`);
    assert.ok(measurement.heapDeltaBytes < PERFORMANCE_HEAP_DELTA_LIMIT_BYTES, `${measurement.label}:${measurement.scale}`);
  }
  assert.equal(report.measurements.find(({ label, scale }) => label === 'page_validation_and_lookup' && scale === 1_000).result.pageCount, 1_000);
  assert.equal(report.measurements.find(({ label, scale }) => label === 'candidate_generation' && scale === 1_000).result.candidateCount, 1_000);
  assert.deepEqual(
    report.measurements.find(({ label }) => label === 'conflict_detection_bounded_refusal').result,
    {
      refused: true,
      errorCode: 'TOO_MANY_RELATIONSHIPS',
      maxCandidates: 1_000,
      maxRelationships: 5_000
    }
  );
  assert.equal(report.limits.maxRelationshipCandidates, 1_000);
  assert.equal(report.limits.maxRelationships, 5_000);
  assert.ok(report.measurements.find(({ label }) => label === 'review_patch_generation').result.patchBytes <= report.limits.maxPatchBytes);
  assert.ok(report.measurements.find(({ label }) => label === 'workbench_page_rendering').result.htmlBytes <= report.limits.maxHtmlBytes);
  assert.equal(report.browserPageLoad.measuredBy, 'npm run test:evidence-claim-workbench:e2e');
  assert.deepEqual(report.violations, []);
});
