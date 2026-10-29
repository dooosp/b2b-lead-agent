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

test('portfolio presentation compares all revisions and renders applicability from each claim', async () => {
  const { buildPortfolioDemo } = await import('../scripts/lib/portfolio-v1.mjs');
  const { renderPortfolioPage } = await import('../scripts/lib/portfolio-v1-page.mjs');
  const demo = structuredClone(buildPortfolioDemo());
  const capability = demo.claims.find(claim => claim.claimId === demo.candidate.claimId);
  capability.applicability = { ...capability.applicability, jurisdictions: ['TEST_COUNTRY'], productFamilyIds: ['test_family'], projectStages: ['TEST_STAGE'], conditions: [{ id: 'requiredCooling', value: 'TEST_CONDITION' }] };
  const html = renderPortfolioPage(demo);
  assert.match(html, /aria-label="세 개정본 한눈에 비교"/);
  assert.match(html, /VERIFIED[\s\S]*ALLOWED[\s\S]*FIT/);
  assert.match(html, /TEST_COUNTRY/);
  assert.match(html, /test_family/);
  assert.match(html, /TEST_STAGE/);
  assert.match(html, /requiredCooling[\s\S]*TEST_CONDITION/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
});
