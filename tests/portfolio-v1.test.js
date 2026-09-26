const test = require('node:test');
const assert = require('node:assert/strict');

test('one project keeps requirement gaps separate from verified hard mismatches', async () => {
  const { buildPortfolioDemo } = await import('../scripts/lib/portfolio-v1.mjs');
  const demo = buildPortfolioDemo();
  assert.deepEqual(demo.revisions.map(r => r.fit.result), ['FIT', 'INSUFFICIENT_EVIDENCE', 'NOT_FIT']);
  assert.equal(new Set(demo.revisions.map(r => r.snapshot.opportunity.opportunityId)).size, 1);
  assert.ok(demo.revisions[1].minimum.minimumEvidenceSet.length > 0);
  assert.equal(demo.revisions[2].minimum.minimumEvidenceSet.length, 0);
  assert.ok(demo.revisions[2].minimum.nonEvidenceGates.some(g => g.code === 'VERIFIED_HARD_REQUIREMENT_MISMATCH'));
  for (const delta of demo.deltas) {
    assert.equal(delta.evaluationInvalidated, true);
    assert.equal(delta.decisionReview.carryForwardAllowed, false);
    assert.equal(delta.decisionReview.priorHumanDecision, null);
    assert.equal(delta.decisionReview.replacementHumanDecision, 'NOT_MADE');
  }
  assert.equal(demo.productionReady, false);
  assert.equal(demo.humanEvidence.personalReproduction, 'NOT_RECORDED');
  assert.equal(demo.humanEvidence.otherUserTrial, 'NOT_RECORDED');
});

test('demo is deterministic and fixture evidence belongs to this project', async () => {
  const { buildPortfolioDemo } = await import('../scripts/lib/portfolio-v1.mjs');
  const first = buildPortfolioDemo();
  assert.deepEqual(first, buildPortfolioDemo());
  for (const claim of first.claims.filter(c => c.subject.type === 'PROJECT')) {
    assert.equal(claim.subject.id, first.revisions[0].snapshot.opportunity.opportunityId);
  }
  const third = first.revisions[2].fit;
  assert.ok(third.reasons.some(reason => reason.code === 'HARD_REQUIREMENT_MISMATCH'));
  assert.equal(first.candidate.voltage, 24);
  assert.equal(first.revisions[0].requirement.value.value, 22.9);
  assert.equal(first.revisions[2].requirement.value.value, 33);
});
