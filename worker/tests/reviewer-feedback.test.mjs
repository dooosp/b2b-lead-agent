import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchLeads, handleExportCSV, handleUpdateLead } from '../api/leads.js';
import { getLeadById } from '../db/leads.js';
import { FakeD1Database, seedPublishedSnapshotFixtures } from './helpers/fake-d1.mjs';
import { createLeadRow } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

const LOCAL_TEST_ROLE_STUB_ENV = Object.freeze({
  MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled',
});

const LOCAL_TEST_ROLE_HEADER = 'X-Manual-Review-Notes-Local-Test-Role';

async function patchLead(db, payload, leadId = 'lead-1', options = {}) {
  const request = createWorkerRequest(`/api/leads/${leadId}`, {
    method: 'PATCH',
    headers: options.headers || {},
    json: { expectedVersion: db.leads.get(leadId)?.version || 1, ...payload },
  });
  return handleUpdateLead(request, { DB: db, ...(options.env || {}) }, leadId);
}

function assertParseableIsoTimestamp(value) {
  assert.equal(typeof value, 'string');
  assert.ok(value.length > 0);
  assert.equal(new Date(value).toISOString(), value);
}

function pickFeedbackEvent(event) {
  return {
    lead_id: event.lead_id,
    event_type: event.event_type,
    changed_at: event.changed_at,
    author_label: event.author_label,
    changed_fields: event.changed_fields,
  };
}

function assertFeedbackHistoryDoesNotRetainText(db, forbiddenText) {
  const serializedEvents = JSON.stringify(db.reviewerFeedbackEvents || []);
  for (const text of Array.isArray(forbiddenText) ? forbiddenText : [forbiddenText]) {
    assert.equal(serializedEvents.includes(text), false, `${text} should not be retained in feedback history`);
  }
}

function assertSerializedPayloadDoesNotContain(payload, forbiddenText) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const text of Array.isArray(forbiddenText) ? forbiddenText : [forbiddenText]) {
    assert.equal(serialized.includes(text), false, `${text} should not be present`);
  }
}

test('reviewerFeedback PATCH persists current local/test feedback with fixed manual reviewer attribution', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const feedbackText = 'Human reviewer feedback: source was useful but buyer role needs more research.';
  const nextReviewerAction = 'Find a second public source and confirm the buyer role.';

  const response = await patchLead(db, {
    reviewerFeedback: {
      actionUsefulness: 'partially_useful',
      outcomeLabel: 'needs_more_research',
      dataGapPriority: 'blocking',
      evidenceConfidenceAdjustment: 'decrease',
      feedbackText,
      nextReviewerAction,
    },
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['reviewerFeedback']);
  assert.equal(payload.lead.reviewerFeedback.hasFeedback, true);
  assert.equal(payload.lead.reviewerFeedback.actionUsefulness, 'partially_useful');
  assert.equal(payload.lead.reviewerFeedback.outcomeLabel, 'needs_more_research');
  assert.equal(payload.lead.reviewerFeedback.dataGapPriority, 'blocking');
  assert.equal(payload.lead.reviewerFeedback.evidenceConfidenceAdjustment, 'decrease');
  assert.equal(payload.lead.reviewerFeedback.feedbackText, feedbackText);
  assert.equal(payload.lead.reviewerFeedback.nextReviewerAction, nextReviewerAction);
  assert.equal(payload.lead.reviewerFeedback.authorLabel, 'manual_reviewer');
  assertParseableIsoTimestamp(payload.lead.reviewerFeedback.updatedAt);
  assert.equal(payload.lead.reviewerFeedback.historyEventCount, 1);
  assert.equal(payload.lead.reviewerFeedback.historyLastEventType, 'create');
  assert.equal(payload.lead.reviewerFeedback.historyLastAuthorLabel, 'manual_reviewer');
  assert.equal(lead.reviewerFeedback.feedbackText, feedbackText);
  assert.equal(lead.reviewerFeedback.authorLabel, 'manual_reviewer');
  assert.equal(db.reviewerFeedback.get('lead-1').feedback_text, feedbackText);
  assert.equal(db.reviewerFeedback.get('lead-1').next_reviewer_action, nextReviewerAction);
  assert.deepEqual(db.reviewerFeedbackEvents.map(pickFeedbackEvent), [
    {
      lead_id: 'lead-1',
      event_type: 'create',
      changed_at: payload.lead.reviewerFeedback.updatedAt,
      author_label: 'manual_reviewer',
      changed_fields: JSON.stringify([
        'actionUsefulness',
        'outcomeLabel',
        'dataGapPriority',
        'evidenceConfidenceAdjustment',
        'feedbackText',
        'nextReviewerAction',
      ]),
    },
  ]);
  assertFeedbackHistoryDoesNotRetainText(db, [feedbackText, nextReviewerAction]);
});

test('reviewerFeedback PATCH edits and clears current feedback with metadata-only history', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });

  const createResponse = await patchLead(db, {
    reviewerFeedback: {
      actionUsefulness: 'useful',
      outcomeLabel: 'interested',
      dataGapPriority: 'low',
      evidenceConfidenceAdjustment: 'increase',
      feedbackText: 'Initial human feedback.',
      nextReviewerAction: 'Prepare reviewed follow-up.',
    },
  });
  const createPayload = await createResponse.json();
  const editResponse = await patchLead(db, {
    reviewerFeedback: {
      outcomeLabel: 'deferred',
      dataGapPriority: 'medium',
      feedbackText: 'Updated human feedback after second pass.',
      nextReviewerAction: 'Recheck after next public filing.',
    },
  });
  const editPayload = await editResponse.json();
  const clearResponse = await patchLead(db, {
    reviewerFeedback: { clear: true },
  });
  const clearPayload = await clearResponse.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(createResponse.status, 200);
  assert.equal(editResponse.status, 200);
  assert.equal(clearResponse.status, 200);
  assert.deepEqual(createPayload.changedFields, ['reviewerFeedback']);
  assert.deepEqual(editPayload.changedFields, ['reviewerFeedback']);
  assert.deepEqual(clearPayload.changedFields, ['reviewerFeedback']);
  assert.equal(clearPayload.lead.reviewerFeedback.hasFeedback, false);
  assert.equal(clearPayload.lead.reviewerFeedback.feedbackText, '');
  assert.equal(clearPayload.lead.reviewerFeedback.nextReviewerAction, '');
  assert.equal(clearPayload.lead.reviewerFeedback.authorLabel, 'manual_reviewer');
  assert.equal(clearPayload.lead.reviewerFeedback.historyEventCount, 3);
  assert.equal(clearPayload.lead.reviewerFeedback.historyLastEventType, 'clear');
  assert.equal(lead.reviewerFeedback.hasFeedback, false);
  assert.equal(db.reviewerFeedback.has('lead-1'), false);
  assert.deepEqual(db.reviewerFeedbackEvents.map(pickFeedbackEvent).map((event) => event.event_type), [
    'create',
    'edit',
    'clear',
  ]);
  assertFeedbackHistoryDoesNotRetainText(db, [
    'Initial human feedback.',
    'Prepare reviewed follow-up.',
    'Updated human feedback after second pass.',
    'Recheck after next public filing.',
  ]);
});

test('reviewerFeedback rejects invalid enums and generated suggestion persistence atomically', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });

  const invalidResponse = await patchLead(db, {
    reviewerFeedback: {
      actionUsefulness: 'magic',
      feedbackText: 'This invalid payload must not save.',
    },
  });
  const invalidPayload = await invalidResponse.json();

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidPayload.success, false);
  assert.match(invalidPayload.message, /actionUsefulness/);
  assert.equal(db.reviewerFeedback.has('lead-1'), false);
  assert.deepEqual(db.reviewerFeedbackEvents, []);

  const generatedResponse = await patchLead(db, {
    reviewerFeedback: {
      actionUsefulness: 'useful',
      feedbackText: 'Human text bundled with generated suggestion must not save.',
      reviewNoteSuggestion: {
        text: 'Generated helper text must stay copy-only.',
      },
    },
  });
  const generatedPayload = await generatedResponse.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(generatedResponse.status, 400);
  assert.equal(generatedPayload.success, false);
  assert.match(generatedPayload.message, /copy-only|reviewerFeedback/);
  assert.equal(lead.reviewerFeedback.hasFeedback, false);
  assert.equal(db.reviewerFeedback.has('lead-1'), false);
  assert.deepEqual(db.reviewerFeedbackEvents, []);
  assertFeedbackHistoryDoesNotRetainText(db, [
    'Human text bundled with generated suggestion must not save.',
    'Generated helper text must stay copy-only.',
  ]);
});

test('C2 local/test reviewer role can read and write feedback while manager cannot read write or export feedback text', async () => {
  const feedbackText = 'Protected reviewer feedback visible only to reviewer role.';
  const nextReviewerAction = 'Reviewer-only next action.';
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const reviewerHeaders = { [LOCAL_TEST_ROLE_HEADER]: 'reviewer' };
  const managerHeaders = { [LOCAL_TEST_ROLE_HEADER]: 'manager' };

  const writeResponse = await patchLead(
    db,
    {
      reviewerFeedback: {
        actionUsefulness: 'useful',
        outcomeLabel: 'interested',
        dataGapPriority: 'none',
        evidenceConfidenceAdjustment: 'increase',
        feedbackText,
        nextReviewerAction,
      },
    },
    'lead-1',
    { env: LOCAL_TEST_ROLE_STUB_ENV, headers: reviewerHeaders }
  );
  const writePayload = await writeResponse.json();

  assert.equal(writeResponse.status, 200);
  assert.equal(writePayload.success, true);
  assert.equal(writePayload.lead.reviewerFeedback.feedbackText, feedbackText);
  assert.equal(writePayload.manualReviewNotesAccess.role, 'reviewer');
  assert.equal(writePayload.manualReviewNotesAccess.manualNotesRead, true);
  assert.equal(writePayload.manualReviewNotesAccess.manualNotesWrite, true);

  const managerWriteResponse = await patchLead(
    db,
    {
      reviewerFeedback: {
        actionUsefulness: 'not_useful',
        feedbackText: 'Manager write attempt must not save.',
      },
    },
    'lead-1',
    { env: LOCAL_TEST_ROLE_STUB_ENV, headers: managerHeaders }
  );
  const managerWritePayload = await managerWriteResponse.json();

  assert.equal(managerWriteResponse.status, 403);
  assert.equal(managerWritePayload.success, false);
  assert.match(managerWritePayload.message, /local\/test role stub/);
  assert.equal(db.reviewerFeedback.get('lead-1').feedback_text, feedbackText);
  seedPublishedSnapshotFixtures(db, [...db.leads.values()]);

  const managerListResponse = await fetchLeads(
    { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...LOCAL_TEST_ROLE_STUB_ENV },
    'danfoss',
    createWorkerRequest('/api/leads', { headers: managerHeaders })
  );
  const managerListPayload = await managerListResponse.json();
  const managerExportResponse = await handleExportCSV(
    createWorkerRequest('/api/export/csv?profile=danfoss', { headers: managerHeaders }),
    { DB: db, ...LOCAL_TEST_ROLE_STUB_ENV }
  );
  const managerCsv = await managerExportResponse.text();

  assert.equal(managerListResponse.status, 200);
  assert.equal(Object.hasOwn(managerListPayload.leads[0], 'reviewerFeedback'), false);
  assert.equal(managerListPayload.reviewerWorkflowSummary.withReviewerFeedback, 0);
  assert.equal(managerListPayload.manualReviewNotesAccess.role, 'manager');
  assertSerializedPayloadDoesNotContain(managerListPayload, [feedbackText, nextReviewerAction]);
  assertSerializedPayloadDoesNotContain(managerCsv, [
    feedbackText,
    nextReviewerAction,
    'reviewerFeedback',
    'reviewer_feedback',
  ]);
});
