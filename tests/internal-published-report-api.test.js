const test = require('node:test');
const assert = require('node:assert/strict');
const contractFixture = require('../docs/exec-plans/internal-api-contract-freeze.fixture.json');

const workerModulePromise = import('../worker/index.js');

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

function createEnv(overrides = {}) {
  return {
    API_TOKEN: 'api-secret',
    TRIGGER_PASSWORD: 'legacy-secret',
    GITHUB_REPO: 'dooosp/b2b-lead-agent',
    PROFILES: JSON.stringify([
      { id: 'danfoss', name: 'Danfoss' },
      { id: 'ls-electric', name: 'LS Electric' }
    ]),
    ...overrides
  };
}

function createRequest(path, { headers = {}, method = 'GET' } = {}) {
  return new Request(`https://b2b-lead-trigger.example.workers.dev${path}`, {
    method,
    headers
  });
}

function jsonFixtureResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function createLeadRow(overrides = {}) {
  return {
    id: 'lead-db-1',
    identity_key: 'identity-1',
    profile_id: 'danfoss',
    source: 'managed',
    status: 'CONTACTED',
    company: 'Mutable DB Lead',
    summary: 'Mutable cache row',
    product: 'Turbocor 컴프레서',
    score: 20,
    grade: 'B',
    roi: 'Mutable ROI',
    sales_pitch: 'Mutable pitch',
    global_context: 'Mutable context',
    sources: JSON.stringify([{ title: 'DB Source', url: 'https://example.com/db-source' }]),
    notes: 'mutated',
    score_reason: '',
    urgency: '',
    urgency_reason: '',
    buyer_role: '',
    evidence: '[]',
    confidence: '',
    confidence_reason: '',
    assumptions: '[]',
    event_type: '',
    created_at: '2026-04-07T12:34:56.000Z',
    updated_at: '2026-04-08T12:34:56.000Z',
    ...overrides
  };
}

test('internal published-report route requires explicit header auth', async () => {
  const { default: worker } = await workerModulePromise;
  const response = await worker.fetch(
    createRequest('/api/internal/profiles/danfoss/latest-published'),
    createEnv(),
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
    createRequest('/api/internal/profiles/danfoss/latest-published?token=api-secret'),
    createEnv(),
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
    createRequest('/api/internal/profiles/danfoss/latest-published', {
      headers: { Authorization: 'Bearer legacy-secret' }
    }),
    createEnv({ API_TOKEN: '' }),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.success, false);
  assert.equal(payload.message, '서버 인증 설정이 필요합니다.');
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
      createRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createEnv({
        DB: new FakeInternalReportDb({
          leadRows: [createLeadRow()]
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

test('GET /api/internal/profiles/:profileId/latest-published returns 409 queued when no latest snapshot is ready but an active job exists', async () => {
  const { default: worker } = await workerModulePromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonFixtureResponse({ message: 'not found' }, 404);

  try {
    const response = await worker.fetch(
      createRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createEnv({
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
      createRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createEnv(),
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
      createRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createEnv({
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
      createRequest('/api/internal/profiles/not-a-real-profile/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createEnv(),
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
      createRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createEnv(),
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
      createRequest('/api/internal/profiles/danfoss/latest-published', {
        headers: { Authorization: 'Bearer api-secret' }
      }),
      createEnv(),
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
