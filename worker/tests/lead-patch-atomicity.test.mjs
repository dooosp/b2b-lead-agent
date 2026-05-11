import test from 'node:test';
import assert from 'node:assert/strict';

import { handleUpdateLead } from '../api/leads.js';
import { getLeadById, getStatusLogByLead } from '../db/leads.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLeadRow } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

async function patchLead(db, payload, leadId = 'lead-1') {
  const request = createWorkerRequest(`/api/leads/${leadId}`, { method: 'PATCH', json: payload });
  return handleUpdateLead(request, { DB: db }, leadId);
}

test('mixed valid status and notes with invalid follow_up_date leaves the lead unchanged', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });

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
  const db = new FakeD1Database({ leads: [createLeadRow({ notes: 'Original note' })] });

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
  const db = new FakeD1Database({ leads: [createLeadRow()] });

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
