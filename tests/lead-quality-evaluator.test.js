const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DIMENSION_IDS,
  assertSyntheticLeadSet,
  evaluateLeadQuality,
  evaluateLeadQualitySet,
} = require('../eval/lead-quality-evaluator');
const { syntheticLeadFixtures } = require('../eval/fixtures/synthetic-leads');
const { parseArgs, rejectUnsafeInputPath } = require('../scripts/evaluate-lead-quality');

const evaluationDate = '2026-05-11T00:00:00.000Z';

function byFixtureType(type) {
  const fixture = syntheticLeadFixtures.find((lead) => lead.fixtureType === type);
  assert.ok(fixture, `missing fixture: ${type}`);
  return fixture;
}

test('synthetic fixture inventory covers the lead quality scenarios without production URLs', () => {
  assert.deepEqual(
    syntheticLeadFixtures.map((lead) => lead.fixtureType),
    [
      'strong lead',
      'weak lead',
      'missing evidence',
      'conflicting evidence',
      'missing company/product',
      'stale signal',
    ]
  );

  for (const fixture of syntheticLeadFixtures) {
    assert.equal(fixture.synthetic, true);
    assert.match(fixture.id, /^synthetic-/);
    for (const source of fixture.sources) {
      assert.equal(new URL(source.url).hostname, 'synthetic.example');
    }
    for (const evidence of fixture.evidence) {
      assert.equal(new URL(evidence.sourceUrl).hostname, 'synthetic.example');
    }
  }
});

test('synthetic safety guard rejects non-synthetic leads and report artifact URLs', () => {
  assert.throws(
    () => assertSyntheticLeadSet([{ id: 'not-synthetic', synthetic: false, sources: [], evidence: [] }]),
    /synthetic: true/
  );

  assert.throws(
    () => assertSyntheticLeadSet([
      {
        id: 'bad-url',
        synthetic: true,
        sources: [{ title: 'Bad', url: 'https://example.com/reports/danfoss/latest-leads.json' }],
        evidence: [],
      },
    ]),
    /production-like URL/
  );
});

test('lead quality CLI stays local-only and can opt into hold failures', () => {
  const options = parseArgs(['--input', 'tmp/synthetic-leads.json', '--json', '--fail-on-hold', '--stale-after-days', '45']);

  assert.equal(options.useFixtures, false);
  assert.equal(options.inputPath, 'tmp/synthetic-leads.json');
  assert.equal(options.json, true);
  assert.equal(options.failOnHold, true);
  assert.equal(options.staleAfterDays, 45);

  assert.throws(
    () => rejectUnsafeInputPath('https://synthetic.example/leads.json'),
    /Remote URLs are not allowed/
  );
  assert.throws(
    () => rejectUnsafeInputPath('reports/danfoss/latest-leads.json'),
    /Production report artifacts/
  );
});

test('strong synthetic lead passes every dimension and is review-ready', () => {
  const result = evaluateLeadQuality(byFixtureType('strong lead'), { now: evaluationDate });

  assert.deepEqual(Object.keys(result.dimensions), DIMENSION_IDS);
  assert.equal(result.status, 'SHIP');
  assert.equal(result.reviewReady, true);
  assert.equal(result.score, 100);
  assert.equal(result.actions.length, 0);
  for (const dimension of Object.values(result.dimensions)) {
    assert.equal(dimension.status, 'pass', dimension.id);
  }
});

test('weak synthetic lead remains reviewable while surfacing low-confidence follow-up work', () => {
  const result = evaluateLeadQuality(byFixtureType('weak lead'), { now: evaluationDate });

  assert.equal(result.status, 'FOLLOW_UP');
  assert.equal(result.reviewReady, true);
  assert.equal(result.dimensions.confidenceClarity.status, 'warning');
  assert.equal(result.dimensions.dataGaps.status, 'warning');
  assert.match(result.actions.join('\n'), /Budget and technical scope are not confirmed/);
});

test('missing evidence blocks review readiness and contradicts verified status', () => {
  const result = evaluateLeadQuality(byFixtureType('missing evidence'), { now: evaluationDate });

  assert.equal(result.status, 'HOLD');
  assert.equal(result.reviewReady, false);
  assert.equal(result.dimensions.evidenceCompleteness.status, 'fail');
  assert.equal(result.dimensions.verificationStatus.status, 'fail');
  assert.match(result.actions.join('\n'), /Add at least one source/);
  assert.match(result.actions.join('\n'), /Do not mark verified/);
});

test('conflicting evidence is not review-ready even when evidence is present', () => {
  const result = evaluateLeadQuality(byFixtureType('conflicting evidence'), { now: evaluationDate });

  assert.equal(result.status, 'HOLD');
  assert.equal(result.reviewReady, false);
  assert.equal(result.dimensions.evidenceCompleteness.status, 'fail');
  assert.equal(result.dimensions.verificationStatus.status, 'fail');
  assert.match(result.actions.join('\n'), /Resolve conflicting evidence for signal/);
});

test('missing company and product block review readiness', () => {
  const result = evaluateLeadQuality(byFixtureType('missing company/product'), { now: evaluationDate });

  assert.equal(result.status, 'HOLD');
  assert.equal(result.reviewReady, false);
  assert.equal(result.dimensions.reviewReadiness.status, 'fail');
  assert.match(result.actions.join('\n'), /Add a target company/);
  assert.match(result.actions.join('\n'), /Add the recommended product/);
});

test('stale signals require revalidation before outreach', () => {
  const result = evaluateLeadQuality(byFixtureType('stale signal'), { now: evaluationDate, staleAfterDays: 90 });

  assert.equal(result.status, 'HOLD');
  assert.equal(result.reviewReady, false);
  assert.equal(result.dimensions.evidenceCompleteness.status, 'warning');
  assert.equal(result.dimensions.reviewReadiness.status, 'fail');
  assert.match(result.actions.join('\n'), /Refresh stale sources/);
});

test('fixture set summary counts ship, follow-up, and hold outcomes', () => {
  const report = evaluateLeadQualitySet(syntheticLeadFixtures, { now: evaluationDate });

  assert.deepEqual(report.summary, {
    total: 6,
    ship: 1,
    followUp: 1,
    hold: 4,
    averageScore: 63,
  });
});
