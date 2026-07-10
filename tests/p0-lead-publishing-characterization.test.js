const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { qualifyLeads } = require('../lead-qualifier');
const { prepareLeadSnapshotRecords } = require('../lead-report-publisher');
const { createRootArticle, createRootProfile } = require('./helpers/root-fixtures');

const FIXED_NOW = '2026-07-10T00:00:00.000Z';
const MODEL_CREATED_AT = '1999-01-01T00:00:00.000Z';
const MODEL_UPDATED_AT = '2099-01-01T00:00:00.000Z';
const FAKE_NESTED_TOKEN = 'FAKE_TEST_TOKEN_DO_NOT_USE';

function createMaliciousModelLead() {
  return {
    company: 'DL이앤씨',
    summary: '합성 투자 신호',
    product: 'E-Manager',
    score: 999,
    grade: 'A',
    roi: '합성 추정치',
    salesPitch: 'DL이앤씨 운영팀에 합성 제안을 검토해 달라고 요청합니다.',
    globalContext: '합성 시장 신호',
    whyNow: '합성 테스트 일정이 임박했다고 모델이 주장합니다.',
    sourceIds: [],
    sources: [
      {
        title: 'Unbound synthetic source',
        url: 'javascript:alert(1)',
        publishedAt: '',
      },
    ],
    evidence: [],
    confidence: 'HIGH',
    verificationStatus: 'verified',
    reviewStatus: 'APPROVED',
    generationMode: 'llm',
    id: 'model-supplied-id',
    status: 'CONTACTED',
    timestamp: 'MODEL_SUPPLIED_TIMESTAMP',
    createdAt: MODEL_CREATED_AT,
    updatedAt: MODEL_UPDATED_AT,
    token: 'FAKE_TOP_LEVEL_TOKEN_EXPECTED_TO_BE_REMOVED',
    modelMetadata: {
      credentials: {
        token: FAKE_NESTED_TOKEN,
      },
    },
  };
}

test('characterization: current behavior publishes unbound model fields and nested secrets', async () => {
  const maliciousLead = createMaliciousModelLead();
  const llm = {
    async chatJSON() {
      return [maliciousLead];
    },
  };

  const [qualified] = await qualifyLeads(
    [createRootArticle()],
    createRootProfile(),
    { llm },
  );

  assert.equal(qualified.verificationStatus, 'verified');
  assert.equal(qualified.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(qualified.score, 999);
  assert.equal(qualified.id, 'model-supplied-id');
  assert.equal(qualified.status, 'CONTACTED');
  assert.equal(qualified.timestamp, 'MODEL_SUPPLIED_TIMESTAMP');
  assert.equal(qualified.createdAt, MODEL_CREATED_AT);
  assert.equal(qualified.updatedAt, MODEL_UPDATED_AT);
  assert.equal(qualified.sources[0].url, 'javascript:alert(1)');
  assert.equal(qualified.sources[0].publishedAt, '');
  assert.equal(qualified.sources[0].resolution, 'unverified');
  assert.deepEqual(qualified.dataGaps, ['Direct evidence quote missing']);
  assert.equal(qualified.modelMetadata.credentials.token, FAKE_NESTED_TOKEN);

  const [published] = prepareLeadSnapshotRecords([qualified], {
    now: FIXED_NOW,
    profileId: 'fixture-profile',
    idFactory: () => 'system-owned-id',
  });

  // This assertion records the current audited behavior. It is not the desired
  // security contract and is expected to change in the remediation PR.
  assert.equal(published.id, 'model-supplied-id');
  assert.equal(published.status, 'CONTACTED');
  assert.equal(published.timestamp, 'MODEL_SUPPLIED_TIMESTAMP');
  assert.equal(published.createdAt, MODEL_CREATED_AT);
  assert.equal(published.updatedAt, MODEL_UPDATED_AT);
  assert.equal(published.score, 999);
  assert.equal(published.verificationStatus, 'verified');
  assert.equal(published.sources[0].url, 'javascript:alert(1)');
  assert.equal(published.sources[0].publishedAt, '');
  assert.deepEqual(published.dataGaps, ['Direct evidence quote missing']);
  assert.equal(published.modelMetadata.credentials.token, FAKE_NESTED_TOKEN);

  // The existing top-level denylist remains characterized separately from the
  // unsafe recursive behavior above.
  assert.equal(Object.hasOwn(published, 'token'), false);
  assert.equal(published.reviewStatus, 'NEEDS_REVIEW');
});

test('characterization: current behavior replaces corrupted lead history with a fresh array', (t) => {
  const repoRoot = path.resolve(__dirname, '..');
  const isolatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'b2b-lead-publisher-characterization-'));
  t.after(() => fs.rmSync(isolatedRoot, { recursive: true, force: true }));

  for (const filename of ['lead-report-publisher.js', 'lead-identity.js']) {
    fs.copyFileSync(path.join(repoRoot, filename), path.join(isolatedRoot, filename));
    assert.equal(
      fs.readFileSync(path.join(isolatedRoot, filename), 'utf8'),
      fs.readFileSync(path.join(repoRoot, filename), 'utf8'),
      `${filename} must be an exact production-module copy`,
    );
  }

  const isolatedPublisher = require(path.join(isolatedRoot, 'lead-report-publisher.js'));
  const profile = { id: 'fixture-profile' };
  const reportsDir = path.join(isolatedRoot, 'reports', profile.id);
  const historyPath = path.join(reportsDir, isolatedPublisher.ARTIFACT_NAMES.historyCanonical);
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(historyPath, '{"corrupted":', 'utf8');

  isolatedPublisher.saveLeadSnapshot([
    {
      company: 'Fixture Corp',
      summary: 'Synthetic current lead',
      product: 'Fixture Product',
      score: 75,
      grade: 'B',
      salesPitch: 'Synthetic first message',
      whyNow: 'Synthetic timing signal',
      generationMode: 'llm',
      verificationStatus: 'needs_review',
      confidence: 'LOW',
      sources: [{ title: 'Synthetic source', url: 'https://example.test/synthetic' }],
      evidence: [],
    },
  ], profile);

  const replacement = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

  // This assertion records the current audited behavior. It is not the desired
  // durability contract and is expected to change in the remediation PR.
  assert.equal(replacement.length, 1);
  assert.equal(replacement[0].company, 'Fixture Corp');
  assert.equal(fs.readFileSync(historyPath, 'utf8').includes('corrupted'), false);
  assert.ok(fs.existsSync(path.join(reportsDir, isolatedPublisher.ARTIFACT_NAMES.latestCanonical)));
});

test.todo('desired contract: allowlisted LeadCandidate to LeadBrief projection');
test.todo('desired contract: strict http and https source URL scheme validation');
test.todo('desired contract: score and range validation rejects out-of-range model values');
test.todo('desired contract: verification requires bound evidence, source, and freshness');
test.todo('desired contract: system-owned id, status, and timestamps are assigned after model projection');
test.todo('desired contract: recursive public-field projection excludes nested secrets');
test.todo('desired contract: corrupted history fails safely or is quarantined instead of replaced');
