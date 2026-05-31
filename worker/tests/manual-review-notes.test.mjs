import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchHistory, fetchLeads, handleExportCSV, handleUpdateLead } from '../api/leads.js';
import { getLeadById, saveLeadsBatch } from '../db/leads.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLead, createLeadRow } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

const LOCAL_TEST_ROLE_STUB_ENV = Object.freeze({
  MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled',
});

const LEVEL1_STOP_WRITE_ENV = Object.freeze({
  ...LOCAL_TEST_ROLE_STUB_ENV,
  LEVEL1_MANUAL_REVIEW_NOTES_STOP_WRITE: 'enabled',
});

const LOCAL_TEST_ROLE_HEADER = 'X-Manual-Review-Notes-Local-Test-Role';

const PROTECTED_MANUAL_NOTE_FIELDS = Object.freeze([
  'notes',
  'manualReviewNotes',
  'manual_review_notes',
  'manualReviewNotesProvenance',
  'manual_review_notes_provenance',
  'manualReviewNotesAuthorLabel',
  'manual_review_notes_author_label',
  'manualReviewNotesUpdatedAt',
  'manual_review_notes_updated_at',
  'manualReviewNotesHistoryEventCount',
  'manual_review_notes_history_event_count',
  'manualReviewNotesHistoryLastEventType',
  'manual_review_notes_history_last_event_type',
  'manualReviewNotesHistoryLastEventAt',
  'manual_review_notes_history_last_event_at',
  'manualReviewNotesHistoryLastAuthorLabel',
  'manual_review_notes_history_last_author_label',
]);

async function patchLead(db, payload, leadId = 'lead-1', options = {}) {
  const request = createWorkerRequest(`/api/leads/${leadId}`, {
    method: 'PATCH',
    headers: options.headers || {},
    json: payload,
  });
  return handleUpdateLead(request, { DB: db, ...(options.env || {}) }, leadId);
}

function assertParseableIsoTimestamp(value) {
  assert.equal(typeof value, 'string');
  assert.ok(value.length > 0);
  assert.equal(new Date(value).toISOString(), value);
}

function pickManualNoteEvent(event) {
  return {
    lead_id: event.lead_id,
    event_type: event.event_type,
    changed_at: event.changed_at,
    author_label: event.author_label,
  };
}

function assertManualNoteHistoryDoesNotRetainText(db, forbiddenText) {
  const serializedEvents = JSON.stringify(db.manualReviewNoteEvents);
  for (const text of Array.isArray(forbiddenText) ? forbiddenText : [forbiddenText]) {
    assert.equal(serializedEvents.includes(text), false);
  }
}

function assertProtectedManualNoteFieldsOmitted(lead) {
  for (const field of PROTECTED_MANUAL_NOTE_FIELDS) {
    assert.equal(Object.hasOwn(lead, field), false, `${field} should be omitted`);
  }
}

function assertSerializedPayloadDoesNotContain(payload, forbiddenText) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const text of Array.isArray(forbiddenText) ? forbiddenText : [forbiddenText]) {
    assert.equal(serialized.includes(text), false, `${text} should not be present`);
  }
}

function assertLocalTestAccessMetadata(metadata, role, canUseManualNotes) {
  assert.deepEqual(metadata, {
    mode: 'local_test_role_stub',
    approvalRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4495568414',
    role,
    manualNotesRead: canUseManualNotes,
    manualNotesWrite: canUseManualNotes,
    metadataHistorySummaryRead: canUseManualNotes,
    realAuthImplemented: false,
    productionReady: false,
  });
}

test('manualReviewNotes PATCH persists human-entered notes with manual provenance', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });

  const response = await patchLead(db, {
    manualReviewNotes: 'Human-entered review note: confirm buyer before outreach.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['manualReviewNotes']);
  assert.equal(payload.lead.manualReviewNotes, 'Human-entered review note: confirm buyer before outreach.');
  assert.equal(payload.lead.notes, 'Human-entered review note: confirm buyer before outreach.');
  assert.equal(payload.lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(payload.lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assertParseableIsoTimestamp(payload.lead.manualReviewNotesUpdatedAt);
  assert.equal(lead.manualReviewNotes, 'Human-entered review note: confirm buyer before outreach.');
  assert.equal(lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(lead.manualReviewNotesUpdatedAt, payload.lead.manualReviewNotesUpdatedAt);
  assert.equal(db.leads.get('lead-1').notes, 'Human-entered review note: confirm buyer before outreach.');
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, 'manual_reviewer');
  assert.equal(db.leads.get('lead-1').manual_review_notes_updated_at, payload.lead.manualReviewNotesUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents.map(pickManualNoteEvent), [
    {
      lead_id: 'lead-1',
      event_type: 'create',
      changed_at: payload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
  ]);
  assert.equal(payload.lead.manualReviewNotesHistoryEventCount, 1);
  assert.equal(payload.lead.manualReviewNotesHistoryLastEventType, 'create');
  assert.equal(payload.lead.manualReviewNotesHistoryLastEventAt, payload.lead.manualReviewNotesUpdatedAt);
  assert.equal(payload.lead.manualReviewNotesHistoryLastAuthorLabel, 'manual_reviewer');
  assertManualNoteHistoryDoesNotRetainText(db, 'Human-entered review note: confirm buyer before outreach.');
});

test('manualReviewNotes PATCH edits an existing human-entered note', async () => {
  const originalManualNoteUpdatedAt = '2026-04-07T00:00:00.000Z';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Initial human review note.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: originalManualNoteUpdatedAt,
      }),
    ],
  });

  const response = await patchLead(db, {
    manualReviewNotes: 'Updated human review note after second pass.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['manualReviewNotes']);
  assert.equal(payload.lead.manualReviewNotes, 'Updated human review note after second pass.');
  assert.equal(payload.lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(payload.lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assertParseableIsoTimestamp(payload.lead.manualReviewNotesUpdatedAt);
  assert.notEqual(payload.lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.equal(lead.manualReviewNotes, 'Updated human review note after second pass.');
  assert.equal(lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(lead.manualReviewNotesUpdatedAt, payload.lead.manualReviewNotesUpdatedAt);
  assert.equal(db.leads.get('lead-1').notes, 'Updated human review note after second pass.');
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, 'manual_reviewer');
  assert.equal(db.leads.get('lead-1').manual_review_notes_updated_at, payload.lead.manualReviewNotesUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents.map(pickManualNoteEvent), [
    {
      lead_id: 'lead-1',
      event_type: 'edit',
      changed_at: payload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
  ]);
  assert.equal(payload.lead.manualReviewNotesHistoryEventCount, 1);
  assert.equal(payload.lead.manualReviewNotesHistoryLastEventType, 'edit');
  assertManualNoteHistoryDoesNotRetainText(db, [
    'Initial human review note.',
    'Updated human review note after second pass.',
  ]);
});

test('updatedAt is lead-level and can change without a manual note save', async () => {
  const originalUpdatedAt = '2026-04-07T00:00:00.000Z';
  const originalManualNoteUpdatedAt = '2026-04-06T00:00:00.000Z';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Existing human review note.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: originalManualNoteUpdatedAt,
        review_status: 'NEEDS_REVIEW',
        updated_at: originalUpdatedAt,
      }),
    ],
  });

  const response = await patchLead(db, {
    reviewStatus: 'APPROVED',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['reviewStatus']);
  assert.equal(payload.lead.manualReviewNotes, 'Existing human review note.');
  assert.equal(payload.lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(payload.lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.notEqual(payload.lead.updatedAt, originalUpdatedAt);
  assert.equal(payload.lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.equal(lead.updatedAt, payload.lead.updatedAt);
  assert.equal(lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.equal(db.leads.get('lead-1').notes, 'Existing human review note.');
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, 'manual_reviewer');
  assert.equal(db.leads.get('lead-1').manual_review_notes_updated_at, originalManualNoteUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents, []);
});

test('manualReviewNotes PATCH clears an existing human-entered note', async () => {
  const originalManualNoteUpdatedAt = '2026-04-07T00:00:00.000Z';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Saved note to clear.',
        manual_review_notes_updated_at: originalManualNoteUpdatedAt,
      }),
    ],
  });

  const response = await patchLead(db, {
    manualReviewNotes: '',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['manualReviewNotes']);
  assert.equal(payload.lead.manualReviewNotes, '');
  assert.equal(payload.lead.notes, '');
  assert.equal(payload.lead.manualReviewNotesProvenance, '');
  assert.equal(payload.lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assertParseableIsoTimestamp(payload.lead.manualReviewNotesUpdatedAt);
  assert.notEqual(payload.lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.equal(lead.manualReviewNotes, '');
  assert.equal(lead.manualReviewNotesProvenance, '');
  assert.equal(lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(lead.manualReviewNotesUpdatedAt, payload.lead.manualReviewNotesUpdatedAt);
  assert.equal(db.leads.get('lead-1').notes, '');
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, 'manual_reviewer');
  assert.equal(db.leads.get('lead-1').manual_review_notes_updated_at, payload.lead.manualReviewNotesUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents.map(pickManualNoteEvent), [
    {
      lead_id: 'lead-1',
      event_type: 'clear',
      changed_at: payload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
  ]);
  assert.equal(payload.lead.manualReviewNotesHistoryEventCount, 1);
  assert.equal(payload.lead.manualReviewNotesHistoryLastEventType, 'clear');
  assertManualNoteHistoryDoesNotRetainText(db, 'Saved note to clear.');
});

test('manualReviewNotes PATCH remains warning-only for sensitive-looking local test text', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const sensitiveLookingLocalTestNote = 'Local test note: buyer@example.test, 010-0000-0000, internal deal context.';

  const response = await patchLead(db, {
    manualReviewNotes: sensitiveLookingLocalTestNote,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.lead.manualReviewNotes, sensitiveLookingLocalTestNote);
  assert.equal(payload.lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(db.leads.get('lead-1').notes, sensitiveLookingLocalTestNote);
  assert.equal(Object.hasOwn(payload.lead, 'manualReviewNotesSensitiveContentWarning'), false);
  assert.equal(Object.hasOwn(payload.lead, 'manualReviewNotesSensitiveContentDetected'), false);
  assert.equal(Object.hasOwn(payload.lead, 'manualReviewNotesRedacted'), false);
  assertManualNoteHistoryDoesNotRetainText(db, sensitiveLookingLocalTestNote);
});

test('unchanged manualReviewNotes PATCH does not update note-specific timestamp', async () => {
  const originalManualNoteUpdatedAt = '2026-04-07T00:00:00.000Z';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Existing human review note.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: originalManualNoteUpdatedAt,
      }),
    ],
  });

  const response = await patchLead(db, {
    manualReviewNotes: 'Existing human review note.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, []);
  assert.equal(payload.lead.manualReviewNotes, 'Existing human review note.');
  assert.equal(payload.lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(payload.lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.equal(lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, 'manual_reviewer');
  assert.equal(db.leads.get('lead-1').manual_review_notes_updated_at, originalManualNoteUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents, []);
});

test('unchanged manualReviewNotes PATCH does not invent a generic author label', async () => {
  const originalManualNoteUpdatedAt = '2026-04-07T00:00:00.000Z';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Existing human review note from before labels.',
        manual_review_notes_updated_at: originalManualNoteUpdatedAt,
      }),
    ],
  });

  const response = await patchLead(db, {
    manualReviewNotes: 'Existing human review note from before labels.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, []);
  assert.equal(payload.lead.manualReviewNotesAuthorLabel, '');
  assert.equal(lead.manualReviewNotesAuthorLabel, '');
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, undefined);
  assert.equal(payload.lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents, []);
});

test('manualReviewNotes is exposed on local read paths without saving generated suggestions', async () => {
  const historyChangedAt = '2026-05-19T01:10:00.000Z';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Saved by a human reviewer.',
        manual_review_notes_author_label: 'manual_reviewer',
        review_status: 'APPROVED',
        verification_status: 'verified',
        confidence: 'HIGH',
        sources: JSON.stringify([{ title: 'Fixture source', url: 'https://example.com/fixture' }]),
        sales_pitch: 'Prepare the human-reviewed follow-up.',
        urgency_reason: 'Procurement review is active now.',
        evidence: JSON.stringify([{ field: 'summary', quote: 'Approved evidence quote', sourceUrl: 'https://example.com/fixture' }]),
      }),
    ],
    manualReviewNoteEvents: [
      {
        lead_id: 'lead-1',
        event_type: 'create',
        changed_at: historyChangedAt,
        author_label: 'manual_reviewer',
      },
    ],
  });

  const response = await fetchLeads(
    {
      DB: db,
      GITHUB_REPO: 'dooosp/b2b-lead-agent',
    },
    'danfoss'
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.source, 'd1');
  assert.equal(payload.leads[0].manualReviewNotes, 'Saved by a human reviewer.');
  assert.equal(payload.leads[0].manualReviewNotesProvenance, 'human_entered');
  assert.equal(payload.leads[0].manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(payload.leads[0].manualReviewNotesUpdatedAt, null);
  assert.equal(payload.leads[0].manualReviewNotesHistoryEventCount, 1);
  assert.equal(payload.leads[0].manualReviewNotesHistoryLastEventType, 'create');
  assert.equal(payload.leads[0].manualReviewNotesHistoryLastEventAt, historyChangedAt);
  assert.equal(payload.leads[0].manualReviewNotesHistoryLastAuthorLabel, 'manual_reviewer');
  assert.equal(payload.leads[0].reviewNoteSuggestion, undefined);
  assert.equal(payload.reviewerActionQueue.items[0].reviewNoteSuggestion.state, 'APPROVED');
  assert.match(payload.reviewerActionQueue.items[0].reviewNoteSuggestion.text, /Decision: APPROVED/);
  assert.equal(db.leads.get('lead-1').notes, 'Saved by a human reviewer.');
});

test('C2 local/test reviewer role stub can read and write manual review notes without real auth identity', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const headers = { [LOCAL_TEST_ROLE_HEADER]: 'reviewer' };

  const writeResponse = await patchLead(
    db,
    { manualReviewNotes: 'Reviewer role stub note.' },
    'lead-1',
    { env: LOCAL_TEST_ROLE_STUB_ENV, headers }
  );
  const writePayload = await writeResponse.json();

  assert.equal(writeResponse.status, 200);
  assert.equal(writePayload.success, true);
  assert.equal(writePayload.lead.manualReviewNotes, 'Reviewer role stub note.');
  assert.equal(writePayload.lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(writePayload.lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.deepEqual(writePayload.manualReviewNotesAccess, {
    mode: 'local_test_role_stub',
    approvalRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4495568414',
    role: 'reviewer',
    manualNotesRead: true,
    manualNotesWrite: true,
    metadataHistorySummaryRead: true,
    realAuthImplemented: false,
    productionReady: false,
  });

  const readRequest = createWorkerRequest('/api/leads', { headers });
  const readResponse = await fetchLeads(
    { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...LOCAL_TEST_ROLE_STUB_ENV },
    'danfoss',
    readRequest
  );
  const readPayload = await readResponse.json();

  assert.equal(readResponse.status, 200);
  assert.equal(readPayload.leads[0].manualReviewNotes, 'Reviewer role stub note.');
  assert.equal(readPayload.leads[0].manualReviewNotesHistoryEventCount, 1);
  assert.equal(readPayload.manualReviewNotesAccess.role, 'reviewer');
  assert.equal(readPayload.manualReviewNotesAccess.realAuthImplemented, false);
});

test('C2 local/test reviewer role stub can save edit and clear current manual notes only', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const headers = { [LOCAL_TEST_ROLE_HEADER]: 'reviewer' };

  const createResponse = await patchLead(
    db,
    { manualReviewNotes: 'Reviewer role stub saved current note.' },
    'lead-1',
    { env: LOCAL_TEST_ROLE_STUB_ENV, headers }
  );
  const createPayload = await createResponse.json();
  const editResponse = await patchLead(
    db,
    { manualReviewNotes: 'Reviewer role stub edited current note.' },
    'lead-1',
    { env: LOCAL_TEST_ROLE_STUB_ENV, headers }
  );
  const editPayload = await editResponse.json();
  const clearResponse = await patchLead(
    db,
    { manualReviewNotes: '' },
    'lead-1',
    { env: LOCAL_TEST_ROLE_STUB_ENV, headers }
  );
  const clearPayload = await clearResponse.json();
  const persistedLead = await getLeadById(db, 'lead-1');

  assert.equal(createResponse.status, 200);
  assert.equal(editResponse.status, 200);
  assert.equal(clearResponse.status, 200);
  assert.deepEqual(createPayload.changedFields, ['manualReviewNotes']);
  assert.deepEqual(editPayload.changedFields, ['manualReviewNotes']);
  assert.deepEqual(clearPayload.changedFields, ['manualReviewNotes']);
  assert.equal(clearPayload.lead.manualReviewNotes, '');
  assert.equal(clearPayload.lead.manualReviewNotesProvenance, '');
  assert.equal(clearPayload.lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(clearPayload.lead.manualReviewNotesHistoryEventCount, 3);
  assert.equal(clearPayload.lead.manualReviewNotesHistoryLastEventType, 'clear');
  assert.equal(persistedLead.manualReviewNotes, '');
  assert.equal(persistedLead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.deepEqual(db.manualReviewNoteEvents.map(pickManualNoteEvent), [
    {
      lead_id: 'lead-1',
      event_type: 'create',
      changed_at: createPayload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
    {
      lead_id: 'lead-1',
      event_type: 'edit',
      changed_at: editPayload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
    {
      lead_id: 'lead-1',
      event_type: 'clear',
      changed_at: clearPayload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
  ]);
  assertLocalTestAccessMetadata(clearPayload.manualReviewNotesAccess, 'reviewer', true);
  assertManualNoteHistoryDoesNotRetainText(db, [
    'Reviewer role stub saved current note.',
    'Reviewer role stub edited current note.',
  ]);
});

test('C2 local/test manager role stub cannot write or read protected manual note fields', async () => {
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Manager must not receive this manual note.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: '2026-05-19T01:10:00.000Z',
      }),
    ],
    manualReviewNoteEvents: [
      {
        lead_id: 'lead-1',
        event_type: 'create',
        changed_at: '2026-05-19T01:10:00.000Z',
        author_label: 'manual_reviewer',
      },
    ],
  });
  const headers = { [LOCAL_TEST_ROLE_HEADER]: 'manager' };

  const writeResponse = await patchLead(
    db,
    { manualReviewNotes: 'Manager write attempt should be denied.' },
    'lead-1',
    { env: LOCAL_TEST_ROLE_STUB_ENV, headers }
  );
  const writePayload = await writeResponse.json();
  const persistedLead = await getLeadById(db, 'lead-1');

  assert.equal(writeResponse.status, 403);
  assert.equal(writePayload.success, false);
  assert.match(writePayload.message, /local\/test role stub/);
  assert.equal(persistedLead.manualReviewNotes, 'Manager must not receive this manual note.');
  assert.equal(db.leads.get('lead-1').notes, 'Manager must not receive this manual note.');
  assert.equal(db.manualReviewNoteEvents.length, 1);

  const readRequest = createWorkerRequest('/api/leads', { headers });
  const readResponse = await fetchLeads(
    { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...LOCAL_TEST_ROLE_STUB_ENV },
    'danfoss',
    readRequest
  );
  const readPayload = await readResponse.json();
  const managerLead = readPayload.leads[0];

  assert.equal(readResponse.status, 200);
  assert.equal(Object.hasOwn(managerLead, 'manualReviewNotes'), false);
  assert.equal(Object.hasOwn(managerLead, 'notes'), false);
  assert.equal(Object.hasOwn(managerLead, 'manualReviewNotesProvenance'), false);
  assert.equal(Object.hasOwn(managerLead, 'manualReviewNotesAuthorLabel'), false);
  assert.equal(Object.hasOwn(managerLead, 'manualReviewNotesUpdatedAt'), false);
  assert.equal(Object.hasOwn(managerLead, 'manualReviewNotesHistoryEventCount'), false);
  assert.deepEqual(readPayload.manualReviewNotesAccess, {
    mode: 'local_test_role_stub',
    approvalRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4495568414',
    role: 'manager',
    manualNotesRead: false,
    manualNotesWrite: false,
    metadataHistorySummaryRead: false,
    realAuthImplemented: false,
    productionReady: false,
  });
});

for (const scenario of [
  {
    name: 'manager',
    headers: { [LOCAL_TEST_ROLE_HEADER]: 'manager' },
    expectedRole: 'manager',
  },
  {
    name: 'api',
    headers: { [LOCAL_TEST_ROLE_HEADER]: 'api' },
    expectedRole: 'api',
  },
  {
    name: 'missing',
    headers: {},
    expectedRole: 'none',
  },
  {
    name: 'unknown',
    headers: { [LOCAL_TEST_ROLE_HEADER]: 'auditor' },
    expectedRole: 'none',
  },
]) {
  test(`C2 local/test ${scenario.name} role stub denies manual note writes through all aliases`, async () => {
    const originalManualNote = `Original protected manual note for ${scenario.name} role.`;
    const originalManualNoteUpdatedAt = '2026-05-19T01:10:00.000Z';
    const db = new FakeD1Database({
      leads: [
        createLeadRow({
          notes: originalManualNote,
          manual_review_notes_author_label: 'manual_reviewer',
          manual_review_notes_updated_at: originalManualNoteUpdatedAt,
        }),
      ],
      manualReviewNoteEvents: [
        {
          lead_id: 'lead-1',
          event_type: 'create',
          changed_at: originalManualNoteUpdatedAt,
          author_label: 'manual_reviewer',
        },
      ],
    });
    const attemptedWrites = [
      { manualReviewNotes: `Denied ${scenario.name} manualReviewNotes write.` },
      { manual_review_notes: `Denied ${scenario.name} manual_review_notes write.` },
      { notes: `Denied ${scenario.name} legacy notes write.` },
    ];

    for (const attemptedWrite of attemptedWrites) {
      const attemptedText = Object.values(attemptedWrite)[0];
      const response = await patchLead(
        db,
        attemptedWrite,
        'lead-1',
        { env: LOCAL_TEST_ROLE_STUB_ENV, headers: scenario.headers }
      );
      const payload = await response.json();
      const persistedLead = await getLeadById(db, 'lead-1');

      assert.equal(response.status, 403);
      assert.equal(payload.success, false);
      assert.match(payload.message, /local\/test role stub/);
      assert.equal(payload.message.includes(attemptedText), false);
      assert.equal(persistedLead.manualReviewNotes, originalManualNote);
      assert.equal(persistedLead.manualReviewNotesAuthorLabel, 'manual_reviewer');
      assert.equal(persistedLead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
      assert.equal(db.leads.get('lead-1').notes, originalManualNote);
      assert.equal(db.manualReviewNoteEvents.length, 1);
      assertManualNoteHistoryDoesNotRetainText(db, attemptedText);
    }
  });

  test(`C2 local/test ${scenario.name} role stub omits protected fields from list history and CSV`, async () => {
    const originalManualNote = `Protected manual note hidden from ${scenario.name} role.`;
    const originalManualNoteUpdatedAt = '2026-05-19T01:10:00.000Z';
    const db = new FakeD1Database({
      leads: [
        createLeadRow({
          notes: originalManualNote,
          manual_review_notes_author_label: 'manual_reviewer',
          manual_review_notes_updated_at: originalManualNoteUpdatedAt,
        }),
      ],
      manualReviewNoteEvents: [
        {
          lead_id: 'lead-1',
          event_type: 'create',
          changed_at: originalManualNoteUpdatedAt,
          author_label: 'manual_reviewer',
        },
      ],
    });
    const readRequest = createWorkerRequest('/api/leads', { headers: scenario.headers });
    const listResponse = await fetchLeads(
      { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...LOCAL_TEST_ROLE_STUB_ENV },
      'danfoss',
      readRequest
    );
    const listPayload = await listResponse.json();
    const historyRequest = createWorkerRequest('/api/history', { headers: scenario.headers });
    const historyResponse = await fetchHistory(
      { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...LOCAL_TEST_ROLE_STUB_ENV },
      'danfoss',
      historyRequest
    );
    const historyPayload = await historyResponse.json();
    const exportRequest = createWorkerRequest('/api/export/csv?profile=danfoss', { headers: scenario.headers });
    const exportResponse = await handleExportCSV(exportRequest, { DB: db, ...LOCAL_TEST_ROLE_STUB_ENV });
    const csv = await exportResponse.text();

    assert.equal(listResponse.status, 200);
    assert.equal(historyResponse.status, 200);
    assert.equal(exportResponse.status, 200);
    assertProtectedManualNoteFieldsOmitted(listPayload.leads[0]);
    assertProtectedManualNoteFieldsOmitted(historyPayload.history[0]);
    assertLocalTestAccessMetadata(listPayload.manualReviewNotesAccess, scenario.expectedRole, false);
    assertLocalTestAccessMetadata(historyPayload.manualReviewNotesAccess, scenario.expectedRole, false);
    assertSerializedPayloadDoesNotContain(listPayload, originalManualNote);
    assertSerializedPayloadDoesNotContain(historyPayload, originalManualNote);
    assertSerializedPayloadDoesNotContain(csv, [
      originalManualNote,
      'manualReviewNotesUpdatedAt',
      'manualReviewNotesHistoryEventCount',
      'reviewNoteSuggestion',
    ]);
  });
}

test('C2 local/test role stub keeps CSV export from expanding manual note visibility for managers', async () => {
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Manager export must not include this manual note.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: '2026-05-19T01:10:00.000Z',
      }),
    ],
  });
  const request = createWorkerRequest('/api/export/csv?profile=danfoss', {
    headers: { [LOCAL_TEST_ROLE_HEADER]: 'manager' },
  });

  const response = await handleExportCSV(request, { DB: db, ...LOCAL_TEST_ROLE_STUB_ENV });
  const csv = await response.text();

  assert.equal(response.status, 200);
  assert.equal(csv.includes('Manager export must not include this manual note.'), false);
  assert.equal(csv.includes('manualReviewNotesUpdatedAt'), false);
  assert.equal(csv.includes('manualReviewNotesHistoryEventCount'), false);
  assert.equal(csv.includes('reviewNoteSuggestion'), false);
});

test('manualReviewNotes PATCH accumulates metadata-only create/edit/clear history without note text', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });

  const createResponse = await patchLead(db, { manualReviewNotes: 'First human note body.' });
  const createPayload = await createResponse.json();
  const editResponse = await patchLead(db, { manualReviewNotes: 'Second human note body.' });
  const editPayload = await editResponse.json();
  const clearResponse = await patchLead(db, { manualReviewNotes: '' });
  const clearPayload = await clearResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(editResponse.status, 200);
  assert.equal(clearResponse.status, 200);
  assert.deepEqual(db.manualReviewNoteEvents.map(pickManualNoteEvent), [
    {
      lead_id: 'lead-1',
      event_type: 'create',
      changed_at: createPayload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
    {
      lead_id: 'lead-1',
      event_type: 'edit',
      changed_at: editPayload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
    {
      lead_id: 'lead-1',
      event_type: 'clear',
      changed_at: clearPayload.lead.manualReviewNotesUpdatedAt,
      author_label: 'manual_reviewer',
    },
  ]);
  assert.equal(clearPayload.lead.manualReviewNotes, '');
  assert.equal(clearPayload.lead.manualReviewNotesHistoryEventCount, 3);
  assert.equal(clearPayload.lead.manualReviewNotesHistoryLastEventType, 'clear');
  assert.equal(clearPayload.lead.manualReviewNotesHistoryLastEventAt, clearPayload.lead.manualReviewNotesUpdatedAt);
  assert.equal(clearPayload.lead.manualReviewNotesHistoryLastAuthorLabel, 'manual_reviewer');
  assertManualNoteHistoryDoesNotRetainText(db, [
    'First human note body.',
    'Second human note body.',
  ]);
});

test('generated reviewer note suggestion persistence attempts are rejected atomically', async () => {
  const originalManualNoteUpdatedAt = '2026-04-07T00:00:00.000Z';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Keep human note',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: originalManualNoteUpdatedAt,
      }),
    ],
  });

  const response = await patchLead(db, {
    reviewNoteSuggestion: {
      state: 'APPROVED',
      text: 'Decision: APPROVED. Generated helper text should not save.',
    },
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /copy-only/);
  assert.equal(lead.manualReviewNotes, 'Keep human note');
  assert.equal(lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.equal(db.leads.get('lead-1').notes, 'Keep human note');
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, 'manual_reviewer');
  assert.equal(db.leads.get('lead-1').manual_review_notes_updated_at, originalManualNoteUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents, []);

  const templatesResponse = await patchLead(db, {
    reviewNoteTemplates: [
      { state: 'APPROVED', text: 'Generated template text should not save.' },
    ],
  });
  const templatesPayload = await templatesResponse.json();

  assert.equal(templatesResponse.status, 400);
  assert.equal(templatesPayload.success, false);
  assert.match(templatesPayload.message, /copy-only/);
  assert.equal(db.leads.get('lead-1').notes, 'Keep human note');
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, 'manual_reviewer');
  assert.equal(db.leads.get('lead-1').manual_review_notes_updated_at, originalManualNoteUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents, []);
});

test('generated suggestion persistence attempts cannot clear manual review notes', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow({ notes: 'Keep this human-entered note.' })] });

  const response = await patchLead(db, {
    manualReviewNotes: '',
    generatedReviewerNoteSuggestion: 'Generated helper text cannot drive clearing.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /copy-only/);
  assert.equal(lead.manualReviewNotes, 'Keep this human-entered note.');
  assert.equal(lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(db.leads.get('lead-1').notes, 'Keep this human-entered note.');
  assert.deepEqual(db.manualReviewNoteEvents, []);
});

test('generated reviewer note suggestions stay out of manual note storage history attribution and exports', async () => {
  const originalManualNoteUpdatedAt = '2026-04-07T00:00:00.000Z';
  const generatedSuggestionText = 'Generated helper text must stay copy-only and unsaved.';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Existing saved human note.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: originalManualNoteUpdatedAt,
      }),
    ],
  });
  const reviewerHeaders = { [LOCAL_TEST_ROLE_HEADER]: 'reviewer' };

  const response = await patchLead(
    db,
    {
      manualReviewNotes: 'Human note bundled with generated helper must not save.',
      reviewNoteSuggestion: {
        state: 'APPROVED',
        text: generatedSuggestionText,
      },
    },
    'lead-1',
    { env: LOCAL_TEST_ROLE_STUB_ENV, headers: reviewerHeaders }
  );
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');
  const exportResponse = await handleExportCSV(
    createWorkerRequest('/api/export/csv?profile=danfoss', { headers: reviewerHeaders }),
    { DB: db, ...LOCAL_TEST_ROLE_STUB_ENV }
  );
  const csv = await exportResponse.text();

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /copy-only/);
  assert.equal(lead.manualReviewNotes, 'Existing saved human note.');
  assert.equal(lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(lead.manualReviewNotesUpdatedAt, originalManualNoteUpdatedAt);
  assert.equal(db.leads.get('lead-1').notes, 'Existing saved human note.');
  assert.equal(db.leads.get('lead-1').manual_review_notes_author_label, 'manual_reviewer');
  assert.equal(db.leads.get('lead-1').manual_review_notes_updated_at, originalManualNoteUpdatedAt);
  assert.deepEqual(db.manualReviewNoteEvents, []);
  assertManualNoteHistoryDoesNotRetainText(db, [
    generatedSuggestionText,
    'Human note bundled with generated helper must not save.',
  ]);
  assertSerializedPayloadDoesNotContain(csv, generatedSuggestionText);
});

test('Level 1 stop-write rollback guard blocks manual note create edit clear and preserves existing data', async () => {
  const cases = [
    {
      name: 'create',
      row: createLeadRow({ notes: '' }),
      payload: { manualReviewNotes: 'Blocked create note.' },
      expectedNote: '',
      events: [],
    },
    {
      name: 'edit',
      row: createLeadRow({
        notes: 'Existing note before stop-write.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
      }),
      payload: { manualReviewNotes: 'Blocked edit note.' },
      expectedNote: 'Existing note before stop-write.',
      events: [
        {
          lead_id: 'lead-1',
          event_type: 'create',
          changed_at: '2026-05-31T00:00:00.000Z',
          author_label: 'manual_reviewer',
        },
      ],
    },
    {
      name: 'clear',
      row: createLeadRow({
        notes: 'Existing note before blocked clear.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
      }),
      payload: { manualReviewNotes: '' },
      expectedNote: 'Existing note before blocked clear.',
      events: [
        {
          lead_id: 'lead-1',
          event_type: 'edit',
          changed_at: '2026-05-31T00:00:00.000Z',
          author_label: 'manual_reviewer',
        },
      ],
    },
  ];

  for (const scenario of cases) {
    const db = new FakeD1Database({
      leads: [scenario.row],
      manualReviewNoteEvents: scenario.events,
    });
    const response = await patchLead(db, scenario.payload, 'lead-1', {
      env: LEVEL1_STOP_WRITE_ENV,
      headers: { [LOCAL_TEST_ROLE_HEADER]: 'reviewer' },
    });
    const payload = await response.json();
    const lead = await getLeadById(db, 'lead-1');

    assert.equal(response.status, 423, scenario.name);
    assert.equal(payload.success, false);
    assert.match(payload.message, /stop-write guard/);
    assert.equal(lead.manualReviewNotes, scenario.expectedNote);
    assert.equal(db.leads.get('lead-1').notes, scenario.expectedNote);
    assert.deepEqual(db.manualReviewNoteEvents.map(pickManualNoteEvent), scenario.events);
  }
});

test('Level 1 stop-write rollback guard blocks generated-suggestion bundled manual writes without mutation', async () => {
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Existing note before generated suggestion stop-write.',
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
      }),
    ],
  });

  const response = await patchLead(
    db,
    {
      manualReviewNotes: 'Blocked human note bundled with generated helper.',
      reviewNoteSuggestion: {
        state: 'APPROVED',
        text: 'Generated helper must not persist during stop-write.',
      },
    },
    'lead-1',
    {
      env: LEVEL1_STOP_WRITE_ENV,
      headers: { [LOCAL_TEST_ROLE_HEADER]: 'reviewer' },
    }
  );
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 423);
  assert.equal(payload.success, false);
  assert.match(payload.message, /stop-write guard/);
  assert.equal(lead.manualReviewNotes, 'Existing note before generated suggestion stop-write.');
  assert.equal(db.leads.get('lead-1').notes, 'Existing note before generated suggestion stop-write.');
  assert.deepEqual(db.manualReviewNoteEvents, []);
});

test('lead refresh preserves existing human-entered notes and ignores generated note fields', async () => {
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Do not overwrite this human-entered note.',
        confidence: 'MEDIUM',
      }),
    ],
  });

  await saveLeadsBatch(db, [
    createLead({
      id: 'lead-1',
      identityKey: 'identity-1',
      company: 'Acme Corp',
      summary: 'Updated generated lead signal',
      notes: 'Generated helper text must not overwrite the manual note.',
      reviewNoteSuggestion: {
        text: 'Generated helper text must not persist.',
      },
      confidence: 'HIGH',
      evidence: [{ field: 'summary', quote: 'Updated evidence quote' }],
    }),
  ], 'danfoss', 'managed');

  const lead = await getLeadById(db, 'lead-1');

  assert.equal(db.leads.size, 1);
  assert.equal(lead.manualReviewNotes, 'Do not overwrite this human-entered note.');
  assert.equal(lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(lead.reviewNoteSuggestion, undefined);
  assert.equal(db.leads.get('lead-1').notes, 'Do not overwrite this human-entered note.');
  assert.equal(db.leads.get('lead-1').confidence, 'HIGH');
});

test('generated batch inserts do not create saved manual review notes', async () => {
  const db = new FakeD1Database();

  await saveLeadsBatch(db, [
    createLead({
      id: 'generated-lead-1',
      identityKey: 'generated-identity-1',
      company: 'Generated Corp',
      summary: 'Generated lead signal',
      notes: 'Generated note-like text should not become a saved manual note.',
      manualReviewNotes: 'Generated manualReviewNotes-like text should not persist.',
      reviewNoteSuggestion: {
        text: 'Generated helper text should not persist.',
      },
    }),
  ], 'danfoss', 'managed');

  const lead = await getLeadById(db, 'generated-lead-1');

  assert.equal(db.leads.get('generated-lead-1').notes, '');
  assert.equal(lead.manualReviewNotesUpdatedAt, null);
  assert.equal(lead.manualReviewNotesAuthorLabel, '');
  assert.equal(db.leads.get('generated-lead-1').manual_review_notes_author_label, undefined);
  assert.equal(db.leads.get('generated-lead-1').manual_review_notes_updated_at, undefined);
  assert.deepEqual(db.manualReviewNoteEvents, []);
  assert.equal(lead.manualReviewNotes, '');
  assert.equal(lead.manualReviewNotesProvenance, '');
  assert.equal(lead.reviewNoteSuggestion, undefined);
});

test('conflicting manualReviewNotes and legacy notes payloads are rejected', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow({ notes: 'Original human note' })] });

  const response = await patchLead(db, {
    manualReviewNotes: 'Human note from explicit field.',
    notes: 'Different legacy note value.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /manualReviewNotes and notes must match/);
  assert.equal(lead.manualReviewNotes, 'Original human note');
});
