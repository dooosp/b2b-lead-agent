const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { qualifyLeads } = require('../lead-qualifier');
const { prepareLeadSnapshotRecords } = require('../lead-report-publisher');
const { createRootArticle, createRootProfile } = require('./helpers/root-fixtures');

const FIXED_NOW = '2026-07-10T00:00:00.000Z';
const FAKE_NESTED_TOKEN = 'FAKE_TEST_TOKEN_DO_NOT_USE';

function createMaliciousModelLead(overrides = {}) {
  return {
    company: 'DL이앤씨',
    summary: '합성 투자 신호',
    signal: 'MODEL_SUPPLIED_SIGNAL',
    product: 'E-Manager',
    score: 88,
    grade: 'A',
    roi: '합성 추정치',
    salesPitch: 'DL이앤씨 운영팀에 합성 제안을 검토해 달라고 요청합니다.',
    recommendedMessage: 'MODEL_SUPPLIED_RECOMMENDED_MESSAGE',
    globalContext: '합성 시장 신호',
    urgencyReason: 'MODEL_SUPPLIED_URGENCY_REASON',
    whyNow: 'MODEL_SUPPLIED_WHY_NOW',
    sourceIds: [],
    sources: [{
      title: 'Unbound synthetic source',
      url: 'javascript:alert(1)',
      publishedAt: '',
      credentials: { token: FAKE_NESTED_TOKEN },
    }],
    evidence: [{
      field: 'summary',
      quote: 'Unbound synthetic evidence',
      sourceUrl: 'data:text/plain,not-a-source',
      credentials: { token: FAKE_NESTED_TOKEN },
    }],
    confidence: 'HIGH',
    confidenceReason: 'Model supplied confidence claim.',
    verificationStatus: 'verified',
    reviewStatus: 'APPROVED',
    generationMode: 'demo',
    dataGaps: ['Model supplied gap must not become authoritative.'],
    id: 'model-supplied-id',
    profileId: 'model-supplied-profile',
    status: 'CONTACTED',
    timestamp: 'MODEL_SUPPLIED_TIMESTAMP',
    createdAt: '1999-01-01T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z',
    token: 'FAKE_TOP_LEVEL_TOKEN_DO_NOT_USE',
    modelMetadata: { credentials: { token: FAKE_NESTED_TOKEN } },
    ...overrides,
  };
}

async function qualifyModelLead(modelLead, article = createRootArticle(), options = {}) {
  const llm = { async chatJSON() { return [modelLead]; } };
  return qualifyLeads([article], createRootProfile(), {
    llm,
    now: FIXED_NOW,
    ...options,
  });
}

test('desired contract: untrusted model fields are projected before LeadBrief publication', async () => {
  const [candidate] = await qualifyModelLead(createMaliciousModelLead());

  assert.equal(candidate.generationMode, 'llm');
  assert.equal(candidate.verificationStatus, 'needs_review');
  assert.equal(candidate.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(candidate.score, 88);
  assert.equal(candidate.signal, '합성 투자 신호');
  assert.equal(candidate.recommendedMessage, 'DL이앤씨 운영팀에 합성 제안을 검토해 달라고 요청합니다.');
  assert.equal(candidate.whyNow, '합성 시장 신호');
  assert.deepEqual(candidate.sources, []);
  assert.deepEqual(candidate.evidence, []);
  for (const field of ['id', 'profileId', 'status', 'timestamp', 'createdAt', 'updatedAt', 'token', 'modelMetadata']) {
    assert.equal(Object.hasOwn(candidate, field), false, `${field} must not survive model projection`);
  }

  const [published] = prepareLeadSnapshotRecords([candidate], {
    now: FIXED_NOW,
    profileId: 'fixture-profile',
    idFactory: () => 'system-owned-id',
  });

  assert.equal(published.id, 'system-owned-id');
  assert.equal(published.profileId, 'fixture-profile');
  assert.equal(published.status, 'NEW');
  assert.equal(published.createdAt, FIXED_NOW);
  assert.equal(published.updatedAt, FIXED_NOW);
  assert.equal(published.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(published.verificationStatus, 'needs_review');
  assert.deepEqual(published.sources, []);
  assert.deepEqual(published.evidence, []);
  assert.match(published.dataGaps.join('\n'), /source|evidence|fresh/i);
  for (const field of ['timestamp', 'sourceIds', 'token', 'modelMetadata']) {
    assert.equal(Object.hasOwn(published, field), false, `${field} must not publish`);
  }
  assert.doesNotMatch(JSON.stringify(published), /FAKE_TEST_TOKEN|FAKE_TOP_LEVEL_TOKEN|MODEL_SUPPLIED/);
});

test('desired contract: invalid model scores are rejected at qualification and publication boundaries', async () => {
  const qualified = await qualifyModelLead(createMaliciousModelLead({ score: 999 }));
  assert.deepEqual(qualified, []);

  assert.throws(
    () => prepareLeadSnapshotRecords([createMaliciousModelLead({ score: 999 })], {
      now: FIXED_NOW,
      profileId: 'fixture-profile',
    }),
    (error) => {
      assert.equal(error.code, 'ERR_LEAD_SCORE_INVALID');
      assert.doesNotMatch(error.message, /999/);
      return true;
    },
  );
});

test('desired contract: only fresh article-bound sources and evidence can produce verified output', async () => {
  const article = createRootArticle({
    link: 'https://example.com/news/fresh-bound-signal#fragment',
    pubDate: 'Thu, 09 Jul 2026 09:00:00 GMT',
  });
  const [candidate] = await qualifyModelLead(createMaliciousModelLead({
    score: 90,
    sourceIds: ['A1'],
    sources: [{
      title: 'Wrong model title',
      url: 'https://invalid.example/wrong',
      credentials: { token: FAKE_NESTED_TOKEN },
    }],
    evidence: [{
      field: 'summary',
      quote: 'Fresh bound synthetic evidence',
      sourceUrl: 'https://example.com/news/fresh-bound-signal#fragment',
      credentials: { token: FAKE_NESTED_TOKEN },
    }],
    verificationStatus: 'unverified',
    generationMode: 'demo',
    reviewStatus: 'APPROVED',
  }), article);

  assert.equal(candidate.generationMode, 'llm');
  assert.equal(candidate.verificationStatus, 'verified');
  assert.equal(candidate.reviewStatus, 'NEEDS_REVIEW');
  assert.deepEqual(candidate.sourceIds, ['A1']);
  assert.equal(candidate.sources[0].url, 'https://example.com/news/fresh-bound-signal');
  assert.equal(candidate.evidence[0].sourceUrl, 'https://example.com/news/fresh-bound-signal');

  const [published] = prepareLeadSnapshotRecords([candidate], {
    now: FIXED_NOW,
    profileId: 'fixture-profile',
    idFactory: () => 'fresh-bound-id',
  });
  assert.equal(published.verificationStatus, 'verified');
  assert.equal(Object.hasOwn(published, 'sourceIds'), false);
  assert.deepEqual(Object.keys(published.sources[0]).sort(), [
    'contentAvailable',
    'originUrl',
    'publishedAt',
    'query',
    'resolution',
    'source',
    'sourceId',
    'title',
    'url',
  ]);
  assert.deepEqual(Object.keys(published.evidence[0]).sort(), ['field', 'quote', 'sourceUrl']);
  assert.doesNotMatch(JSON.stringify(published), /FAKE_TEST_TOKEN/);
});

test('desired contract: missing, unbound, and stale evidence cannot remain verified', () => {
  const cases = [
    {
      label: 'missing freshness',
      sources: [{ title: 'Synthetic source', url: 'https://example.test/missing-date' }],
      evidence: [{ field: 'summary', quote: 'Synthetic quote', sourceUrl: 'https://example.test/missing-date' }],
      expectedGap: /fresh|date/i,
    },
    {
      label: 'unbound evidence',
      sources: [{ title: 'Synthetic source', url: 'https://example.test/bound', publishedAt: '2026-07-09T00:00:00.000Z' }],
      evidence: [{ field: 'summary', quote: 'Synthetic quote', sourceUrl: 'https://example.test/different' }],
      expectedGap: /bound|evidence/i,
    },
    {
      label: 'stale source',
      sources: [{ title: 'Synthetic source', url: 'https://example.test/stale', publishedAt: '2025-01-01T00:00:00.000Z' }],
      evidence: [{ field: 'summary', quote: 'Synthetic quote', sourceUrl: 'https://example.test/stale' }],
      expectedGap: /stale|fresh/i,
    },
  ];

  for (const fixture of cases) {
    const [published] = prepareLeadSnapshotRecords([{
      company: 'Fixture Corp',
      summary: fixture.label,
      product: 'Fixture Product',
      score: 80,
      grade: 'A',
      confidence: 'HIGH',
      generationMode: 'llm',
      verificationStatus: 'verified',
      sources: fixture.sources,
      evidence: fixture.evidence,
    }], {
      now: FIXED_NOW,
      profileId: 'fixture-profile',
      idFactory: () => `fixture-${fixture.label}`,
    });

    assert.equal(published.verificationStatus, 'needs_review', fixture.label);
    assert.match(published.dataGaps.join('\n'), fixture.expectedGap, fixture.label);
  }
});

function loadIsolatedPublisher(t) {
  const repoRoot = path.resolve(__dirname, '..');
  const isolatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'b2b-lead-publisher-contract-'));
  t.after(() => fs.rmSync(isolatedRoot, { recursive: true, force: true }));

  for (const filename of ['lead-report-publisher.js', 'lead-identity.js']) {
    fs.copyFileSync(path.join(repoRoot, filename), path.join(isolatedRoot, filename));
  }

  return {
    isolatedRoot,
    publisher: require(path.join(isolatedRoot, 'lead-report-publisher.js')),
  };
}

test('desired contract: invalid history blocks publication without changing canonical artifacts', (t) => {
  const { isolatedRoot, publisher } = loadIsolatedPublisher(t);
  const profile = { id: 'fixture-profile' };
  const report = { dateStr: '2026-07-10', content: 'NEW REPORT MUST NOT BE WRITTEN' };
  const reportsDir = path.join(isolatedRoot, 'reports', profile.id);
  const reportPath = path.join(reportsDir, publisher.ARTIFACT_NAMES.markdownCanonical(report.dateStr));
  const latestPath = path.join(reportsDir, publisher.ARTIFACT_NAMES.latestCanonical);
  const historyPath = path.join(reportsDir, publisher.ARTIFACT_NAMES.historyCanonical);
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(reportPath, 'EXISTING REPORT', 'utf8');
  fs.writeFileSync(latestPath, '[{"id":"existing-latest"}]', 'utf8');
  fs.writeFileSync(historyPath, '{"corrupted":', 'utf8');
  const before = new Map([
    [reportPath, fs.readFileSync(reportPath)],
    [latestPath, fs.readFileSync(latestPath)],
    [historyPath, fs.readFileSync(historyPath)],
  ]);
  const entriesBefore = fs.readdirSync(reportsDir).sort();

  assert.throws(
    () => publisher.publishLeadReport(report, [{
      company: 'Fixture Corp',
      summary: 'Synthetic current lead',
      product: 'Fixture Product',
      score: 75,
      grade: 'B',
      salesPitch: 'Synthetic first message',
      globalContext: 'Synthetic timing signal',
      generationMode: 'llm',
      verificationStatus: 'needs_review',
      confidence: 'LOW',
      sources: [{
        title: 'Synthetic source',
        url: 'https://example.test/synthetic',
        publishedAt: '2026-07-09T00:00:00.000Z',
      }],
      evidence: [],
    }], profile),
    (error) => {
      assert.equal(error.code, 'ERR_LEAD_HISTORY_INVALID');
      assert.doesNotMatch(error.message, /\{"corrupted":/i);
      return true;
    },
  );

  for (const [filePath, contents] of before) {
    assert.deepEqual(fs.readFileSync(filePath), contents, `${path.basename(filePath)} changed`);
  }
  assert.deepEqual(fs.readdirSync(reportsDir).sort(), entriesBefore);
});

test('desired contract: a non-array history root is rejected without replacing latest or history', (t) => {
  const { isolatedRoot, publisher } = loadIsolatedPublisher(t);
  const profile = { id: 'fixture-profile' };
  const reportsDir = path.join(isolatedRoot, 'reports', profile.id);
  const latestPath = path.join(reportsDir, publisher.ARTIFACT_NAMES.latestCanonical);
  const historyPath = path.join(reportsDir, publisher.ARTIFACT_NAMES.historyCanonical);
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(latestPath, '[{"id":"existing-latest"}]', 'utf8');
  fs.writeFileSync(historyPath, '{}', 'utf8');

  assert.throws(
    () => publisher.saveLeadSnapshot([{
      company: 'Fixture Corp',
      summary: 'Synthetic current lead',
      product: 'Fixture Product',
      score: 75,
      grade: 'B',
      generationMode: 'llm',
      verificationStatus: 'needs_review',
      confidence: 'LOW',
      sources: [],
      evidence: [],
    }], profile),
    (error) => error.code === 'ERR_LEAD_HISTORY_INVALID',
  );

  assert.equal(fs.readFileSync(latestPath, 'utf8'), '[{"id":"existing-latest"}]');
  assert.equal(fs.readFileSync(historyPath, 'utf8'), '{}');
});

test('desired contract: ordinary history read failures remain distinguishable from invalid JSON', (t) => {
  const { isolatedRoot, publisher } = loadIsolatedPublisher(t);
  const profile = { id: 'fixture-profile' };
  const historyPath = path.join(
    isolatedRoot,
    'reports',
    profile.id,
    publisher.ARTIFACT_NAMES.historyCanonical,
  );
  const injectedError = Object.assign(new Error('synthetic filesystem denial'), { code: 'EACCES' });
  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
    if (path.basename(filePath) === path.basename(historyPath)) throw injectedError;
    return originalReadFileSync.call(this, filePath, ...args);
  };

  try {
    assert.throws(
      () => publisher.saveLeadSnapshot([], profile),
      (error) => error === injectedError && error.code === 'EACCES',
    );
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

test('desired contract: missing history remains a valid first-publication bootstrap', (t) => {
  const { isolatedRoot, publisher } = loadIsolatedPublisher(t);
  const profile = { id: 'fixture-profile' };
  const reportsDir = path.join(isolatedRoot, 'reports', profile.id);

  publisher.publishLeadReport({
    dateStr: '2026-07-10',
    content: 'SYNTHETIC FIRST REPORT',
  }, [{
    company: 'Fixture Corp',
    summary: 'Synthetic first lead',
    product: 'Fixture Product',
    score: 75,
    grade: 'B',
    generationMode: 'llm',
    verificationStatus: 'needs_review',
    confidence: 'LOW',
    sources: [{
      title: 'Synthetic source',
      url: 'https://example.test/synthetic',
      publishedAt: '2026-07-09T00:00:00.000Z',
    }],
    evidence: [],
  }], profile);

  assert.ok(fs.existsSync(path.join(reportsDir, publisher.ARTIFACT_NAMES.latestCanonical)));
  const history = JSON.parse(fs.readFileSync(path.join(reportsDir, publisher.ARTIFACT_NAMES.historyCanonical), 'utf8'));
  assert.equal(history.length, 1);
});
