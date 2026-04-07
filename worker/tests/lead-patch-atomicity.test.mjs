import test from 'node:test';
import assert from 'node:assert/strict';

import { handleUpdateLead } from '../api/leads.js';
import { getLeadById, getStatusLogByLead } from '../db/leads.js';

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
    return this.db.execute(this.sql, this.params);
  }

  async first() {
    return this.db.execute(this.sql, this.params, 'first');
  }

  async all() {
    const results = await this.db.execute(this.sql, this.params, 'all');
    return { results };
  }
}

class FakeD1Database {
  constructor(rows = []) {
    this.leads = new Map(rows.map((row) => [row.id, { ...row }]));
    this.statusLog = [];
  }

  prepare(sql) {
    return new FakeD1Statement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      if (typeof statement.run === 'function') {
        results.push(await statement.run());
      } else {
        results.push(statement);
      }
    }
    return results;
  }

  async execute(sql, params, mode = 'run') {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (
      normalized.startsWith('CREATE TABLE') ||
      normalized.startsWith('CREATE INDEX') ||
      normalized.startsWith('ALTER TABLE')
    ) {
      return mode === 'all' ? [] : null;
    }

    if (normalized === 'SELECT * FROM leads WHERE id = ?') {
      const row = this.leads.get(params[0]);
      return row ? { ...row } : null;
    }

    if (normalized === 'SELECT * FROM status_log WHERE lead_id = ? ORDER BY changed_at ASC') {
      return this.statusLog
        .filter((row) => row.lead_id === params[0])
        .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
        .map((row) => ({ ...row }));
    }

    if (normalized.startsWith('UPDATE leads SET ') && normalized.endsWith(' WHERE id = ?')) {
      const id = params.at(-1);
      const row = this.leads.get(id);
      if (!row) return { success: false };

      const setClause = normalized.slice('UPDATE leads SET '.length, normalized.lastIndexOf(' WHERE id = ?'));
      const columns = setClause.split(',').map((part) => part.trim().split(' = ')[0]);
      columns.forEach((column, index) => {
        row[column] = params[index];
      });
      this.leads.set(id, row);
      return { success: true };
    }

    if (normalized === 'INSERT INTO status_log (lead_id, from_status, to_status, changed_at) VALUES (?, ?, ?, ?)') {
      this.statusLog.push({
        id: this.statusLog.length + 1,
        lead_id: params[0],
        from_status: params[1],
        to_status: params[2],
        changed_at: params[3],
      });
      return { success: true };
    }

    throw new Error(`Unsupported SQL in test fake: ${normalized}`);
  }
}

function createLeadRow(overrides = {}) {
  const timestamp = '2026-04-07T00:00:00.000Z';
  return {
    id: 'lead-1',
    profile_id: 'danfoss',
    source: 'managed',
    status: 'NEW',
    company: 'Acme Corp',
    summary: 'Existing summary',
    product: 'Control',
    score: 80,
    grade: 'A',
    roi: 'Existing ROI',
    sales_pitch: 'Existing pitch',
    global_context: 'Existing context',
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
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

async function patchLead(db, payload, leadId = 'lead-1') {
  const request = new Request(`https://example.com/api/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleUpdateLead(request, { DB: db }, leadId);
}

test('mixed valid status and notes with invalid follow_up_date leaves the lead unchanged', async () => {
  const db = new FakeD1Database([createLeadRow()]);

  const response = await patchLead(db, {
    status: 'CONTACTED',
    notes: 'Call scheduled',
    follow_up_date: '2026-02-30',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');
  const statusLog = await getStatusLogByLead(db, 'lead-1');

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(lead.status, 'NEW');
  assert.equal(lead.notes, '');
  assert.equal(lead.followUpDate, '');
  assert.deepEqual(statusLog, []);
});

test('invalid status transition with valid notes leaves the lead unchanged', async () => {
  const db = new FakeD1Database([createLeadRow({ notes: 'Original note' })]);

  const response = await patchLead(db, {
    status: 'WON',
    notes: 'Should not persist',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');
  const statusLog = await getStatusLogByLead(db, 'lead-1');

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(lead.status, 'NEW');
  assert.equal(lead.notes, 'Original note');
  assert.deepEqual(statusLog, []);
});

test('fully valid payload persists all requested fields and reports changedFields', async () => {
  const db = new FakeD1Database([createLeadRow()]);

  const response = await patchLead(db, {
    status: 'CONTACTED',
    notes: 'Ready for outreach',
    follow_up_date: '2026-04-20',
    estimated_value: 125,
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');
  const statusLog = await getStatusLogByLead(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['status', 'notes', 'follow_up_date', 'estimated_value']);
  assert.equal(lead.status, 'CONTACTED');
  assert.equal(lead.notes, 'Ready for outreach');
  assert.equal(lead.followUpDate, '2026-04-20');
  assert.equal(lead.estimatedValue, 125);
  assert.deepEqual(statusLog, [{
    fromStatus: 'NEW',
    toStatus: 'CONTACTED',
    changedAt: statusLog[0].changedAt,
  }]);
});
