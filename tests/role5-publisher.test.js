const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  composeLeadReport,
  publishLeadReport,
} = require('../lead-report-publisher');

const repoRoot = path.resolve(__dirname, '..');
const reportsRoot = path.join(repoRoot, 'reports');

const silentLogger = {
  log() {},
  info() {},
  warn() {},
  error() {},
};

function createCaptureLogger() {
  const messages = [];

  function push(level, args) {
    messages.push([level, ...args].join(' '));
  }

  return {
    messages,
    log(...args) {
      push('log', args);
    },
    info(...args) {
      push('info', args);
    },
    warn(...args) {
      push('warn', args);
    },
    error(...args) {
      push('error', args);
    },
  };
}

function createProfile(label) {
  return {
    id: `role5-publisher-${process.pid}-${Date.now()}-${label}`,
    name: `Role 5 Publisher ${label}`,
    industry: 'test',
  };
}

function getReportsDir(profile) {
  return path.join(reportsRoot, profile.id);
}

function cleanupReportsDir(profile) {
  fs.rmSync(getReportsDir(profile), { recursive: true, force: true });
}

function buildLead(overrides = {}) {
  return {
    company: 'Acme Manufacturing',
    summary: '신규 공장 자동화 프로젝트',
    product: 'Automation Suite',
    score: 92,
    grade: 'A',
    roi: '에너지 18% 절감 예상',
    salesPitch: 'Acme Manufacturing의 자동화 프로젝트에 Automation Suite를 제안합니다.',
    globalContext: '산업 전환 정책 강화',
    sources: [{ title: 'Factory automation expansion approved', url: 'https://example.com/article-1' }],
    evidence: [],
    confidence: 'HIGH',
    confidenceReason: '본문 기반 분석',
    assumptions: [],
    eventType: '투자',
    ...overrides,
  };
}

test('composeLeadReport renders grade sections in score order and returns stable counts', () => {
  const profile = createProfile('compose-basic');
  const now = new Date('2026-03-20T03:04:05.000Z');
  const leads = [
    buildLead({ company: 'Beta Corp', score: 60, grade: 'A' }),
    buildLead({ company: 'Alpha Corp', score: 95, grade: 'A' }),
    buildLead({ company: 'Gamma Corp', score: 50, grade: 'B' }),
    buildLead({ company: 'Delta Corp', score: 12, grade: 'C' }),
  ];

  const report = composeLeadReport(leads, profile, { now, logger: silentLogger });

  assert.deepEqual(report.counts, {
    total: 4,
    gradeA: 2,
    gradeB: 1,
    other: 1,
  });
  assert.match(report.content, /## Grade A - 즉시 영업 가능 \(2건\)/);
  assert.match(report.content, /## Grade B - 파이프라인 관리 \(1건\)/);
  assert.match(report.content, /## 기타 - 검토 필요 \(1건\)/);
  assert.ok(report.content.indexOf('### Alpha Corp (95점)') < report.content.indexOf('### Beta Corp (60점)'));
});

test('composeLeadReport applies visible fallbacks and warns on confidence_reason drift without throwing', () => {
  const profile = createProfile('compose-fallbacks');
  const now = new Date('2026-03-20T03:04:05.000Z');
  const logger = createCaptureLogger();
  const leads = [
    buildLead({
      company: '   ',
      summary: '   ',
      product: null,
      score: 'not-a-number',
      grade: 'legacy',
      roi: '',
      salesPitch: undefined,
      globalContext: '',
      confidence: 'UNKNOWN',
      confidenceReason: '',
      confidence_reason: 'legacy snake-case reason',
      sources: [{ title: ' Example Source ', url: 'https://example.com/source' }],
    }),
  ];

  const report = composeLeadReport(leads, profile, { now, logger });

  assert.match(report.content, /### 미상 \(0점\)/);
  assert.match(report.content, /- \*\*프로젝트:\*\* -/);
  assert.match(report.content, /- \*\*추천 제품:\*\* -/);
  assert.match(report.content, /- \*\*예상 ROI:\*\* -/);
  assert.match(report.content, /- \*\*영업 Pitch:\*\* -/);
  assert.match(report.content, /- \*\*글로벌 트렌드:\*\* -/);
  assert.match(report.content, /- \*\*신뢰도:\*\* -/);
  assert.match(report.content, /- \*\*신뢰도 근거:\*\* legacy snake-case reason/);
  assert.match(report.content, /- \*\*대표 출처:\*\* Example Source \(https:\/\/example.com\/source\)/);
  assert.doesNotMatch(report.content, /undefined/);
  assert.match(logger.messages.join('\n'), /visible publish fallbacks applied/i);
  assert.match(logger.messages.join('\n'), /confidence_reason/i);
});

test('publishLeadReport writes markdown and JSON artifacts while keeping JSON artifact shape backward compatible', async () => {
  const profile = createProfile('publish-happy');
  const now = new Date('2026-03-20T03:04:05.000Z');
  const leads = [buildLead()];

  cleanupReportsDir(profile);

  try {
    const report = composeLeadReport(leads, profile, { now, logger: silentLogger });
    const artifacts = await publishLeadReport(report, leads, profile, { now, logger: silentLogger });

    assert.ok(fs.existsSync(artifacts.reportPath));
    assert.ok(fs.existsSync(artifacts.latestLeadsPath));
    assert.ok(fs.existsSync(artifacts.historyPath));

    const latest = JSON.parse(fs.readFileSync(artifacts.latestLeadsPath, 'utf-8'));
    const history = JSON.parse(fs.readFileSync(artifacts.historyPath, 'utf-8'));

    assert.equal(latest.length, 1);
    assert.equal(history.length, 1);
    assert.equal(latest[0].company, leads[0].company);
    assert.equal(latest[0].summary, leads[0].summary);
    assert.equal(latest[0].product, leads[0].product);
    assert.equal(latest[0].score, leads[0].score);
    assert.equal(latest[0].grade, leads[0].grade);
    assert.equal(latest[0].confidenceReason, leads[0].confidenceReason);
    assert.deepEqual(latest[0].sources, leads[0].sources);
    assert.equal(latest[0].status, 'NEW');
    assert.ok(latest[0].id);
    assert.ok(latest[0].dedupeKey);
    assert.equal(Object.hasOwn(latest[0], 'primarySource'), false);
    assert.equal(Object.hasOwn(latest[0], 'reportCompany'), false);
  } finally {
    cleanupReportsDir(profile);
  }
});

test('publishLeadReport synthesizes confidenceReason from confidence_reason for published artifacts', async () => {
  const profile = createProfile('publish-confidence-alias');
  const now = new Date('2026-03-20T03:04:05.000Z');
  const leads = [
    buildLead({
      confidenceReason: '',
      confidence_reason: 'legacy snake-case reason',
    }),
  ];

  cleanupReportsDir(profile);

  try {
    const report = composeLeadReport(leads, profile, { now, logger: silentLogger });
    const artifacts = await publishLeadReport(report, leads, profile, { now, logger: silentLogger });
    const latest = JSON.parse(fs.readFileSync(artifacts.latestLeadsPath, 'utf-8'));

    assert.equal(latest.length, 1);
    assert.equal(latest[0].confidenceReason, 'legacy snake-case reason');
    assert.equal(Object.hasOwn(latest[0], 'reportCompany'), false);
    assert.equal(Object.hasOwn(latest[0], 'primarySource'), false);
  } finally {
    cleanupReportsDir(profile);
  }
});

test('publishLeadReport preserves existing confidenceReason when camelCase and snake_case both exist', async () => {
  const profile = createProfile('publish-confidence-precedence');
  const now = new Date('2026-03-20T03:04:05.000Z');
  const leads = [
    buildLead({
      confidenceReason: 'camel-case reason',
      confidence_reason: 'legacy snake-case reason',
    }),
  ];

  cleanupReportsDir(profile);

  try {
    const report = composeLeadReport(leads, profile, { now, logger: silentLogger });
    const artifacts = await publishLeadReport(report, leads, profile, { now, logger: silentLogger });
    const latest = JSON.parse(fs.readFileSync(artifacts.latestLeadsPath, 'utf-8'));

    assert.equal(latest.length, 1);
    assert.equal(latest[0].confidenceReason, 'camel-case reason');
  } finally {
    cleanupReportsDir(profile);
  }
});

test('publishLeadReport throws when report counts disagree with the publish target', async () => {
  const profile = createProfile('publish-mismatch');
  const leadReport = {
    content: '# mismatch',
    counts: {
      total: 1,
      gradeA: 1,
      gradeB: 0,
      other: 0,
    },
  };

  await assert.rejects(
    () => publishLeadReport(leadReport, [], profile, { logger: silentLogger }),
    /불일치/
  );
});

test('publishLeadReport preserves current corrupted history behavior by backing up and throwing on invalid JSON', async () => {
  const profile = createProfile('publish-corrupt-history');
  const now = new Date('2026-03-20T03:04:05.000Z');
  const reportsDir = getReportsDir(profile);
  const historyPath = path.join(reportsDir, 'lead_history.json');
  const leads = [buildLead()];

  cleanupReportsDir(profile);
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(historyPath, '{invalid-json', 'utf-8');

  try {
    const report = composeLeadReport(leads, profile, { now, logger: silentLogger });

    await assert.rejects(
      () => publishLeadReport(report, leads, profile, { now, logger: silentLogger }),
      /JSON 파싱 실패/
    );

    const backupFiles = fs.readdirSync(reportsDir).filter((name) => name.startsWith('lead_history.json.corrupt-'));
    assert.ok(backupFiles.length >= 1);
  } finally {
    cleanupReportsDir(profile);
  }
});

test('publishLeadReport invokes additive storage adapters after local artifacts are written', async () => {
  const profile = createProfile('publish-storage-adapter');
  const now = new Date('2026-03-20T03:04:05.000Z');
  const leads = [buildLead()];
  const calls = [];
  const adapter = {
    name: 'capture-adapter',
    async publish(context) {
      calls.push(context);
      for (const artifact of context.artifacts) {
        assert.ok(fs.existsSync(artifact.localPath));
      }
    },
  };

  cleanupReportsDir(profile);

  try {
    const report = composeLeadReport(leads, profile, { now, logger: silentLogger });
    const artifacts = await publishLeadReport(report, leads, profile, {
      now,
      logger: silentLogger,
      storage: {
        adapters: [adapter],
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].profile.id, profile.id);
    assert.equal(calls[0].latestLeads.length, 1);
    assert.equal(calls[0].leadHistory.length, 1);
    assert.deepEqual(
      calls[0].artifacts.map((artifact) => artifact.remotePath),
      [
        `reports/${profile.id}/${path.basename(artifacts.reportPath)}`,
        `reports/${profile.id}/latest_leads.json`,
        `reports/${profile.id}/lead_history.json`,
      ]
    );
  } finally {
    cleanupReportsDir(profile);
  }
});

test('publishLeadReport keeps local publish successful when additive storage adapters fail', async () => {
  const profile = createProfile('publish-storage-adapter-failure');
  const now = new Date('2026-03-20T03:04:05.000Z');
  const leads = [buildLead()];
  const logger = createCaptureLogger();
  const adapter = {
    name: 'failing-adapter',
    async publish() {
      throw new Error('mirror down');
    },
  };

  cleanupReportsDir(profile);

  try {
    const report = composeLeadReport(leads, profile, { now, logger: silentLogger });
    const artifacts = await publishLeadReport(report, leads, profile, {
      now,
      logger,
      storage: {
        adapters: [adapter],
      },
    });

    assert.ok(fs.existsSync(artifacts.reportPath));
    assert.ok(fs.existsSync(artifacts.latestLeadsPath));
    assert.ok(fs.existsSync(artifacts.historyPath));
    assert.match(logger.messages.join('\n'), /storage mirror skipped/i);
  } finally {
    cleanupReportsDir(profile);
  }
});
