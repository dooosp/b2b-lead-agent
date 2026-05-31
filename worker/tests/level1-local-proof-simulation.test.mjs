import test from 'node:test';
import assert from 'node:assert/strict';

import { handleWorkerRequest } from '../routes/dispatcher.js';
import {
  AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV,
  AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV,
  createStaticAuthProviderSessionScaffoldProvider
} from '../lib/auth-provider-session-scaffold.js';
import { createLeadRow, createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

const SYNTHETIC_MANUAL_NOTE = 'Synthetic local-only reviewer note body.';
const SYNTHETIC_GENERATED_SUGGESTION = 'Synthetic generated helper text must stay copy-only.';

function authHeaders() {
  return { Authorization: 'Bearer api-secret' };
}

function createProofEnv(role = 'reviewer') {
  const env = createWorkerEnv();
  env.DB.leads.set('lead-1', createLeadRow({
    notes: SYNTHETIC_MANUAL_NOTE,
    manual_review_notes_author_label: 'manual_reviewer',
    manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
    review_status: 'APPROVED',
    verification_status: 'verified',
    confidence: 'HIGH',
    urgency: 'high',
    urgency_reason: 'Synthetic buying committee review is active.',
    evidence: JSON.stringify([
      {
        field: 'summary',
        quote: 'Synthetic local fixture quote',
        sourceUrl: 'https://example.test/synthetic-source',
      },
    ]),
    sources: JSON.stringify([
      {
        title: 'Synthetic local fixture source',
        url: 'https://example.test/synthetic-source',
      },
    ]),
  }));
  return {
    ...env,
    [AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV]: 'enabled',
    [AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV]: createStaticAuthProviderSessionScaffoldProvider({ role }),
  };
}

async function readJson(response) {
  return response.json();
}

test('Level 1 local proof simulation covers /leads page, reviewer API queue, detail, notes, and generated suggestion exclusion', async () => {
  const env = createProofEnv('reviewer');

  const leadsPageResponse = await handleWorkerRequest(createWorkerRequest('/leads'), env, {});
  const leadsPageHtml = await leadsPageResponse.text();
  assert.equal(leadsPageResponse.status, 200);
  assert.match(leadsPageHtml, /리드 리뷰 큐/);

  const apiLeadsResponse = await handleWorkerRequest(
    createWorkerRequest('/api/leads?profile=danfoss', { headers: authHeaders() }),
    env,
    {}
  );
  const apiLeadsPayload = await readJson(apiLeadsResponse);

  assert.equal(apiLeadsResponse.status, 200);
  assert.equal(apiLeadsPayload.source, 'd1');
  assert.equal(apiLeadsPayload.leads[0].manualReviewNotes, SYNTHETIC_MANUAL_NOTE);
  assert.equal(apiLeadsPayload.leads[0].manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(apiLeadsPayload.leads[0].reviewNoteSuggestion, undefined);
  assert.equal(apiLeadsPayload.reviewerActionQueue.items.length, 1);
  assert.equal(typeof apiLeadsPayload.reviewerActionQueue.items[0].reviewNoteSuggestion.text, 'string');
  assert.equal(apiLeadsPayload.manualReviewNotesAccess.mode, 'auth_provider_session_scaffold_non_production');
  assert.equal(apiLeadsPayload.manualReviewNotesAccess.realAuthImplemented, false);
  assert.equal(apiLeadsPayload.manualReviewNotesAccess.productionReady, false);

  const detailResponse = await handleWorkerRequest(
    createWorkerRequest('/leads/lead-1', { headers: authHeaders() }),
    env,
    {}
  );
  const detailHtml = await detailResponse.text();
  assert.equal(detailResponse.status, 200);
  assert.match(detailHtml, /Acme Corp/);
  assert.match(detailHtml, /Synthetic local-only reviewer note body/);

  const generatedSuggestionResponse = await handleWorkerRequest(
    createWorkerRequest('/api/leads/lead-1', {
      method: 'PATCH',
      headers: authHeaders(),
      json: {
        manualReviewNotes: 'Human note bundled with generated helper must not save.',
        reviewNoteSuggestion: {
          state: 'APPROVED',
          text: SYNTHETIC_GENERATED_SUGGESTION,
        },
      },
    }),
    env,
    {}
  );
  const generatedSuggestionPayload = await readJson(generatedSuggestionResponse);

  assert.equal(generatedSuggestionResponse.status, 400);
  assert.equal(generatedSuggestionPayload.success, false);
  assert.match(generatedSuggestionPayload.message, /copy-only/);
  assert.equal(env.DB.leads.get('lead-1').notes, SYNTHETIC_MANUAL_NOTE);
  assert.equal(env.DB.manualReviewNoteEvents.length, 0);
});

test('Level 1 local proof simulation omits protected notes for manager role while preserving queue metadata', async () => {
  const env = createProofEnv('manager');

  const apiLeadsResponse = await handleWorkerRequest(
    createWorkerRequest('/api/leads?profile=danfoss', { headers: authHeaders() }),
    env,
    {}
  );
  const apiLeadsPayload = await readJson(apiLeadsResponse);
  const csvResponse = await handleWorkerRequest(
    createWorkerRequest('/api/export/csv?profile=danfoss', { headers: authHeaders() }),
    env,
    {}
  );
  const csv = await csvResponse.text();

  assert.equal(apiLeadsResponse.status, 200);
  assert.equal(apiLeadsPayload.reviewerActionQueue.items.length, 1);
  assert.equal(Object.hasOwn(apiLeadsPayload.leads[0], 'manualReviewNotes'), false);
  assert.equal(Object.hasOwn(apiLeadsPayload.leads[0], 'manualReviewNotesUpdatedAt'), false);
  assert.equal(JSON.stringify(apiLeadsPayload).includes(SYNTHETIC_MANUAL_NOTE), false);
  assert.equal(csvResponse.status, 200);
  assert.equal(csv.includes(SYNTHETIC_MANUAL_NOTE), false);
  assert.equal(csv.includes('reviewNoteSuggestion'), false);
  assert.equal(apiLeadsPayload.manualReviewNotesAccess.role, 'manager');
  assert.equal(apiLeadsPayload.manualReviewNotesAccess.manualNotesRead, false);
});
