const test = require('node:test');
const assert = require('node:assert/strict');
const contractFixture = require('../docs/exec-plans/internal-api-contract-freeze.fixture.json');
const { prepareLeadSnapshotRecords } = require('../lead-report-publisher');
const {
  createRootLeadRow,
  createWorkerApiEnv,
  createWorkerApiRequest,
  jsonFixtureResponse,
} = require('./helpers/root-fixtures');

const workerModulePromise = import('../worker/index.js');
const migrationManifestPromise = import('../worker/db/migration-manifest.js');

class FakeStatement {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }

  bind(...args) {
    return new FakeStatement(this.db, this.sql, args);
  }

  async run() {
    return this.db.execute(this.sql, this.args, 'run');
  }

  async first() {
    return this.db.execute(this.sql, this.args, 'first');
  }

  async all() {
    const results = await this.db.execute(this.sql, this.args, 'all');
    return { results };
  }
}

class FakeInternalReportDb {
  constructor({ leadRows = [], jobRuns = [] } = {}) {
    this.leadRows = leadRows.map((row) => ({ ...row }));
    this.jobRuns = jobRuns.map((row) => ({ ...row }));
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  async execute(sql, args, mode) {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (/^SELECT version, name FROM d1_schema_migrations ORDER BY version ASC LIMIT \d+$/.test(normalized)) {
      const { D1_MIGRATION_MANIFEST } = await migrationManifestPromise;
      assert.equal(
        normalized,
        `SELECT version, name FROM d1_schema_migrations ORDER BY version ASC LIMIT ${D1_MIGRATION_MANIFEST.length + 1}`
      );
      const rows = D1_MIGRATION_MANIFEST.map(({ version, name }) => ({ version, name }));
      return mode === 'all' ? rows : rows[0] || null;
    }

    if (normalized.startsWith("SELECT 'd1_schema_migrations' AS table_name") && normalized.includes('pragma_table_info')) {
      const {
        CANONICAL_D1_CRITICAL_COLUMN_SPECS,
        CANONICAL_D1_TABLE_COLUMN_NAMES,
      } = await migrationManifestPromise;
      const rows = Object.entries(CANONICAL_D1_TABLE_COLUMN_NAMES).flatMap(([tableName, columnNames]) => (
        columnNames.map((name, cid) => {
          const spec = CANONICAL_D1_CRITICAL_COLUMN_SPECS[tableName]?.[name] || {};
          return {
            table_name: tableName,
            cid,
            name,
            type: spec.type || 'TEXT',
            not_null: spec.notNull || 0,
            dflt_value: spec.defaultValue ?? null,
            pk: spec.pk || 0,
          };
        })
      ));
      return mode === 'all' ? rows : rows[0] || null;
    }

    if (normalized.startsWith('SELECT type, name, tbl_name AS table_name, sql FROM sqlite_schema')) {
      const {
        CREATE_CANONICAL_JOB_RUNS_TABLE_SQL,
        CREATE_CANONICAL_LEADS_TABLE_SQL,
        CREATE_MIGRATION_LEDGER_SQL,
        V1_CREATE_TABLE_STATEMENTS,
        V1_INDEX_STATEMENTS,
        V2_CREATE_TABLE_STATEMENTS,
        V2_INDEX_STATEMENTS,
        V3_CREATE_TABLE_STATEMENTS,
        V3_INDEX_STATEMENTS,
      } = await migrationManifestPromise;
      const tableStatements = [
        CREATE_MIGRATION_LEDGER_SQL,
        CREATE_CANONICAL_LEADS_TABLE_SQL,
        CREATE_CANONICAL_JOB_RUNS_TABLE_SQL,
        ...V1_CREATE_TABLE_STATEMENTS.filter((statement) => (
          !/CREATE TABLE IF NOT EXISTS (?:leads|job_runs)\b/i.test(statement)
        )),
        ...V2_CREATE_TABLE_STATEMENTS,
        ...V3_CREATE_TABLE_STATEMENTS,
      ];
      const rows = [
        ...tableStatements.map((statement) => {
          const [, name] = /CREATE TABLE IF NOT EXISTS ([A-Za-z_][A-Za-z0-9_]*)/i.exec(statement);
          return { type: 'table', name, table_name: name, sql: statement };
        }),
        ...[...V1_INDEX_STATEMENTS, ...V2_INDEX_STATEMENTS, ...V3_INDEX_STATEMENTS].map((statement) => {
          const [, name, tableName] = /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ([A-Za-z_][A-Za-z0-9_]*) ON ([A-Za-z_][A-Za-z0-9_]*)/i.exec(statement);
          return { type: 'index', name, table_name: tableName, sql: statement };
        }),
      ];
      return mode === 'all' ? rows : rows[0] || null;
    }

    if (
      normalized.startsWith('CREATE TABLE') ||
      normalized.startsWith('CREATE UNIQUE INDEX') ||
      normalized.startsWith('CREATE INDEX') ||
      normalized.startsWith('ALTER TABLE')
    ) {
      if (mode === 'all') return [];
      if (mode === 'first') return null;
      return { meta: { changes: 0 } };
    }

    if (normalized === 'SELECT * FROM leads WHERE profile_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?') {
      const [profileId, limit, offset] = args;
      const rows = this.leadRows
        .filter((row) => row.profile_id === profileId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(offset, offset + limit)
        .map((row) => ({ ...row }));
      if (mode === 'first') return rows[0] || null;
      if (mode === 'all') return rows;
      return { results: rows };
    }

    if (normalized === "SELECT * FROM job_runs WHERE profile_id = ? AND state IN ('accepted', 'running') ORDER BY accepted_at ASC LIMIT 1") {
      const [profileId] = args;
      const row = this.jobRuns
        .filter((job) => job.profile_id === profileId && (job.state === 'accepted' || job.state === 'running'))
        .sort((a, b) => a.accepted_at.localeCompare(b.accepted_at))[0] || null;
      if (mode === 'all') return row ? [{ ...row }] : [];
      return row ? { ...row } : null;
    }

    throw new Error(`Unsupported fake DB SQL: ${normalized}`);
  }
}

class ThrowingJobRunDb extends FakeInternalReportDb {
  prepare(sql) {
    if (sql.includes('FROM job_runs')) {
      throw new Error('job run lookup unavailable');
    }
    return super.prepare(sql);
  }
}

test('internal published-report route requires explicit header auth', async () => {
  const { default: worker } = await workerModulePromise;
  const response = await worker.fetch(
    createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published'),
    createWorkerApiEnv(),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.equal(payload.message, '인증이 필요합니다.');
});

test('internal published-report route rejects query-string token auth', async () => {
  const { default: worker } = await workerModulePromise;
  const response = await worker.fetch(
    createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published?token=api-secret'),
    createWorkerApiEnv(),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.equal(payload.message, '인증이 필요합니다.');
});

test('internal published-report route does not fall back to TRIGGER_PASSWORD when API_TOKEN is unset', async () => {
  const { default: worker } = await workerModulePromise;
  const response = await worker.fetch(
    createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
      headers: { Authorization: 'Bearer legacy-secret' }
    }),
    createWorkerApiEnv({ API_TOKEN: '' }),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.success, false);
  assert.equal(payload.message, '서버 인증 설정이 필요합니다.');
});

test('internal published-report route rejects TRIGGER_PASSWORD when API_TOKEN is different', async () => {
  const { default: worker } = await workerModulePromise;
  const response = await worker.fetch(
    createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
      headers: { Authorization: 'Bearer legacy-secret' }
    }),
    createWorkerApiEnv({ API_TOKEN: 'api-secret', TRIGGER_PASSWORD: 'legacy-secret' }),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.equal(payload.message, '인증 실패');
});

test('GET /api/internal/profiles/:profileId/latest-published uses the GitHub published snapshot and ignores mutable DB cache rows', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url));
    return jsonFixtureResponse(contractFixture.leads);
  };

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv({
        DB: new FakeInternalReportDb({
          leadRows: [createRootLeadRow()]
        })
      }),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(payload, contractFixture);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('internal published-report rejects compact JSON amplification before JSON.parse', async () => {
  const { default: worker } = await workerModulePromise;
  const rawArtifactText = `[${Array.from({ length: 91 }, () => '{}').join(',')}]`;
  const originalFetch = globalThis.fetch;
  const originalJsonParse = JSON.parse;
  let rawArtifactParseCalls = 0;
  let response;
  globalThis.fetch = async () => new Response(rawArtifactText, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  JSON.parse = function countedJsonParse(value, ...args) {
    if (value === rawArtifactText) rawArtifactParseCalls += 1;
    return originalJsonParse(value, ...args);
  };

  try {
    response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv(),
      {}
    );
  } finally {
    JSON.parse = originalJsonParse;
    globalThis.fetch = originalFetch;
  }

  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'readiness_unavailable');
  assert.equal(rawArtifactParseCalls, 0);
});

test('internal published-report fails closed for duplicate, colliding, or unsafe lead ids', async () => {
  const { default: worker } = await workerModulePromise;
  const fixtureLead = contractFixture.leads[0];
  const scenarios = [
    [fixtureLead, { ...fixtureLead }],
    [
      { ...fixtureLead, id: ` ${fixtureLead.id} ` },
      { ...fixtureLead, id: fixtureLead.id },
    ],
    [{ ...fixtureLead, id: '..' }],
  ];

  for (const leads of scenarios) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => jsonFixtureResponse(leads);
    try {
      const response = await worker.fetch(
        createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
          headers: { Authorization: 'Bearer api-secret' }
        }),
        createWorkerApiEnv(),
        {}
      );
      const payload = await response.json();
      assert.equal(response.status, 503);
      assert.equal(payload.syncReady, false);
      assert.equal(payload.error.code, 'readiness_unavailable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test('internal published-report returns the same normalized lead id projection as managed snapshots', async () => {
  const { default: worker } = await workerModulePromise;
  const fixtureLead = contractFixture.leads[0];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse([{
    ...fixtureLead,
    id: 'unsafe\ninternal',
  }]);

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv(),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.syncReady, true);
    assert.equal(payload.leads[0].id, 'unsafe internal');
    assert.equal(payload.leads[0].id.includes('\n'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('root-published LeadBrief records remain consumable by the internal latest-published contract', async () => {
  const { default: worker } = await workerModulePromise;
  const fixtureLead = contractFixture.leads[0];
  const [publishedLead] = prepareLeadSnapshotRecords([{
    company: fixtureLead.company,
    summary: fixtureLead.summary,
    product: fixtureLead.product,
    score: fixtureLead.score,
    grade: fixtureLead.grade,
    roi: fixtureLead.roi,
    salesPitch: fixtureLead.salesPitch,
    globalContext: fixtureLead.globalContext,
    sources: fixtureLead.sources,
    evidence: [{
      field: 'summary',
      quote: fixtureLead.summary,
      sourceUrl: fixtureLead.sources[0].url,
    }],
    confidence: 'MEDIUM',
    generationMode: 'llm',
    verificationStatus: 'verified',
  }], {
    now: contractFixture.publishedAt,
    profileId: contractFixture.profileId,
    idFactory: () => fixtureLead.id,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse([publishedLead]);

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv(),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, contractFixture);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /api/internal/profiles/:profileId/latest-published returns 409 queued when no latest snapshot is ready but an active job exists', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse({ message: 'not found' }, 404);

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv({
        DB: new FakeInternalReportDb({
          jobRuns: [
            {
              request_id: 'req-1',
              profile_id: 'danfoss',
              target: 'github-actions',
              state: 'accepted',
              accepted_at: '2026-04-07T12:00:00.000Z'
            }
          ]
        })
      }),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.schemaVersion, 'crm.published-report.v1');
    assert.equal(payload.syncReady, false);
    assert.equal(payload.readiness.reason, 'queued');
    assert.equal(payload.error.code, 'report_not_ready');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /api/internal/profiles/:profileId/latest-published returns 404 for a known profile with no latest published snapshot', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse({ message: 'not found' }, 404);

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv({
        DB: new FakeInternalReportDb()
      }),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.schemaVersion, 'crm.published-report.v1');
    assert.equal(payload.syncReady, false);
    assert.equal(payload.error.code, 'report_not_found');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /api/internal/profiles/:profileId/latest-published returns 503 when queued readiness cannot be verified safely', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse({ message: 'not found' }, 404);

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv({
        DB: new ThrowingJobRunDb()
      }),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.schemaVersion, 'crm.published-report.v1');
    assert.equal(payload.profileId, 'danfoss');
    assert.equal(payload.syncReady, false);
    assert.equal(payload.error.code, 'readiness_unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /api/internal/profiles/:profileId/latest-published returns 503 when the job ledger is unavailable entirely', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse({ message: 'not found' }, 404);

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv({ DB: undefined }),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.schemaVersion, 'crm.published-report.v1');
    assert.equal(payload.profileId, 'danfoss');
    assert.equal(payload.syncReady, false);
    assert.equal(payload.error.code, 'readiness_unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /api/internal/profiles/:profileId/latest-published does not fall back unknown profiles to the default profile', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return jsonFixtureResponse({ message: 'should not fetch' }, 500);
  };

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/not-a-real-profile/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv(),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.error.code, 'report_not_found');
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /api/internal/profiles/:profileId/latest-published returns 409 not_finalized for an empty published artifact', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse([]);

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv(),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.readiness.reason, 'not_finalized');
    assert.equal(payload.error.code, 'report_not_ready');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /api/internal/profiles/:profileId/latest-published returns 409 not_finalized when required lead fields are missing', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse([
    {
      id: 'lead-1',
      status: 'NEW',
      createdAt: '2026-04-07T12:34:56.000Z',
      updatedAt: '2026-04-07T12:34:56.000Z',
      company: 'DL이앤씨',
      summary: '데이터센터 영토 확장 가속',
      product: 'Turbocor 컴프레서',
      score: 84,
      grade: 'A',
      roi: '냉각 전력 35% 절감',
      globalContext: 'EU 데이터센터 에너지효율 지침',
      sources: [
        {
          title: 'DL이앤씨, 데이터센터 영토 확장 가속',
          url: 'https://www.example.com/article/dl-data-center'
        }
      ]
    }
  ]);

  try {
    const response = await worker.fetch(
      createWorkerApiRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createWorkerApiEnv(),
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.readiness.reason, 'not_finalized');
    assert.equal(payload.error.code, 'report_not_ready');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
