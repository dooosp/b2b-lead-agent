import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalizeLeadProductForProfile,
  resolveLeadProfileForQuery,
} from '../lib/profile.js';
import { fetchHistory, fetchLeads } from '../api/leads.js';

class FakeD1Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new FakeD1Statement(this.db, this.sql, params);
  }

  async run() {
    return this.db.execute(this.sql, this.params, 'run');
  }

  async all() {
    const results = await this.db.execute(this.sql, this.params, 'all');
    return { results };
  }
}

class FakeLeadLookupDb {
  constructor(rows = []) {
    this.rows = rows.map((row) => ({ ...row }));
  }

  prepare(sql) {
    return new FakeD1Statement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  async execute(sql, params, mode) {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (
      normalized.startsWith('CREATE TABLE') ||
      normalized.startsWith('CREATE UNIQUE INDEX') ||
      normalized.startsWith('CREATE INDEX') ||
      normalized.startsWith('ALTER TABLE')
    ) {
      return mode === 'all' ? [] : { meta: { changes: 0 } };
    }

    if (normalized === 'SELECT * FROM leads WHERE profile_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?') {
      const [profileId, limit, offset] = params;
      return this.rows
        .filter((row) => row.profile_id === profileId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(offset, offset + limit)
        .map((row) => ({ ...row }));
    }

    throw new Error(`Unsupported SQL for fake DB: ${normalized}`);
  }
}

function createLeadRow(overrides = {}) {
  return {
    id: 'lead-1',
    profile_id: 'danfoss',
    source: 'managed',
    status: 'NEW',
    company: 'Acme Corp',
    summary: 'Legacy lead',
    product: 'Desigo CC',
    score: 75,
    grade: 'B',
    roi: '',
    sales_pitch: '',
    global_context: '',
    sources: '[]',
    notes: '',
    enriched: 0,
    article_body: '',
    action_items: '[]',
    key_figures: '[]',
    pain_points: '[]',
    meddic: '{}',
    competitive: '{}',
    buying_signals: '[]',
    score_reason: '',
    urgency: '',
    urgency_reason: '',
    buyer_role: '',
    evidence: '[]',
    confidence: '',
    confidence_reason: '',
    assumptions: '[]',
    event_type: '',
    enriched_at: null,
    follow_up_date: '',
    estimated_value: 0,
    created_at: '2026-04-07T00:00:00.000Z',
    updated_at: '2026-04-07T00:00:00.000Z',
    ...overrides,
  };
}

function createJsonResponse(body) {
  return {
    ok: true,
    async json() {
      return body;
    }
  };
}

test('resolveLeadProfileForQuery keeps valid self-service profiles explicit', () => {
  const result = resolveLeadProfileForQuery(' self-service:acme-co ', {
    PROFILES: JSON.stringify([{ id: 'danfoss', name: '댄포스 코리아' }]),
  });

  assert.deepEqual(result, {
    ok: true,
    profileId: 'self-service:acme-co',
    profileType: 'self-service',
  });
});

test('canonicalizeLeadProductForProfile normalizes legacy managed aliases', () => {
  const result = canonicalizeLeadProductForProfile('siemens', 'Desigo CC');

  assert.equal(result.product, 'Desigo CC 통합 빌딩관리');
  assert.equal(result.resolution, 'normalized');
  assert.equal(result.reason, 'alias-match');
});

test('canonicalizeLeadProductForProfile downgrades cross-profile mismatches and orphans', () => {
  const mismatch = canonicalizeLeadProductForProfile('danfoss', 'Desigo CC');
  const orphan = canonicalizeLeadProductForProfile('ls-electric', 'Unknown Widget');

  assert.equal(mismatch.product, 'iC7 Marine 드라이브');
  assert.equal(mismatch.resolution, 'fallback');
  assert.equal(mismatch.reason, 'profile-mismatch:siemens');
  assert.equal(orphan.product, 'GSIS 가스절연개폐장치');
  assert.equal(orphan.resolution, 'fallback');
  assert.equal(orphan.reason, 'orphan-product');
});

test('fetchLeads canonicalizes managed DB lead products and profile IDs', async () => {
  const db = new FakeLeadLookupDb([
    createLeadRow({
      profile_id: 'danfoss',
      product: 'Desigo CC',
    })
  ]);

  const response = await fetchLeads({ DB: db }, 'danfoss');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.profile, 'danfoss');
  assert.equal(payload.source, 'd1');
  assert.equal(payload.leads[0].profileId, 'danfoss');
  assert.equal(payload.leads[0].product, 'iC7 Marine 드라이브');
  assert.notEqual(payload.leads[0].product, 'Desigo CC');
});

test('fetchHistory canonicalizes managed GitHub history products before returning them', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => createJsonResponse([
    {
      id: 'lead-2',
      company: 'Beta Corp',
      product: 'VLT Drive',
      summary: 'Drive refresh',
      score: 80,
      grade: 'A'
    }
  ]);

  try {
    const response = await fetchHistory({ GITHUB_REPO: 'acme/repo' }, 'danfoss');
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.profile, 'danfoss');
    assert.equal(payload.source, 'github');
    assert.equal(payload.history[0].profileId, 'danfoss');
    assert.equal(payload.history[0].product, 'VLT AutomationDrive');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchLeads preserves self-service products while keeping canonical profile IDs', async () => {
  const db = new FakeLeadLookupDb([
    createLeadRow({
      profile_id: 'self-service:acme',
      source: 'self-service',
      product: 'Custom Analytics Studio',
    })
  ]);

  const response = await fetchLeads({ DB: db }, 'self-service:acme');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.profile, 'self-service:acme');
  assert.equal(payload.leads[0].profileId, 'self-service:acme');
  assert.equal(payload.leads[0].product, 'Custom Analytics Studio');
});
