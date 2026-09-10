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

function createProofEnv(sessionOptions = { role: 'reviewer' }) {
  const session = typeof sessionOptions === 'string'
    ? { role: sessionOptions }
    : sessionOptions;
  const env = createWorkerEnv();
  const lead = createLeadRow({
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
  });
  env.DB.leads.set('lead-1', lead);
  env.DB.seedPublishedSnapshot({ profileId: 'danfoss', artifactKind: 'latest', leads: [lead] });
  env.DB.seedPublishedSnapshot({ profileId: 'danfoss', artifactKind: 'history', leads: [lead] });
  return {
    ...env,
    [AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV]: 'enabled',
    [AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV]: createStaticAuthProviderSessionScaffoldProvider(session),
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
  assert.match(leadsPageHtml, /프로젝트 신호 검토 큐/);
  assert.match(leadsPageHtml, /Follow-up check:/);
  assert.match(leadsPageHtml, /생성된 검토 메모 제안/);

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
        expectedVersion: 1,
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

for (const scenario of [
  { name: 'manager', session: { role: 'manager' }, expectedRole: 'manager', claimStatus: 'valid' },
  { name: 'admin', session: { role: 'admin' }, expectedRole: 'admin', claimStatus: 'valid' },
  { name: 'api client', session: { role: 'api_client' }, expectedRole: 'api_client', claimStatus: 'valid' },
  { name: 'missing role', session: { role: '' }, expectedRole: 'none', claimStatus: 'valid' },
  { name: 'unknown role', session: { role: 'auditor' }, expectedRole: 'none', claimStatus: 'valid' },
  {
    name: 'expired reviewer claim',
    session: { role: 'reviewer', expiresAt: '2000-01-01T00:00:00.000Z' },
    expectedRole: 'reviewer',
    claimStatus: 'expired',
  },
  {
    name: 'missing audience reviewer claim',
    session: {
      role: 'reviewer',
      audience: '',
    },
    expectedRole: 'reviewer',
    claimStatus: 'missing_audience',
  },
  {
    name: 'wrong audience reviewer claim',
    session: { role: 'reviewer', audience: 'wrong-local-proof-audience' },
    expectedRole: 'reviewer',
    claimStatus: 'wrong_audience',
  },
]) {
  test(`Level 1 local proof simulation omits protected notes for ${scenario.name} while preserving queue metadata`, async () => {
    const env = createProofEnv(scenario.session);

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
    const detailResponse = await handleWorkerRequest(
      createWorkerRequest('/leads/lead-1', { headers: authHeaders() }),
      env,
      {}
    );
    const detailHtml = await detailResponse.text();
    const leadsPageResponse = await handleWorkerRequest(createWorkerRequest('/leads'), env, {});
    const leadsPageHtml = await leadsPageResponse.text();

    assert.equal(apiLeadsResponse.status, 200);
    assert.equal(apiLeadsPayload.reviewerActionQueue.items.length, 1);
    assert.equal(Object.hasOwn(apiLeadsPayload.leads[0], 'manualReviewNotes'), false);
    assert.equal(Object.hasOwn(apiLeadsPayload.leads[0], 'manualReviewNotesUpdatedAt'), false);
    assert.equal(JSON.stringify(apiLeadsPayload).includes(SYNTHETIC_MANUAL_NOTE), false);
    assert.equal(csvResponse.status, 200);
    assert.equal(csv.includes(SYNTHETIC_MANUAL_NOTE), false);
    assert.equal(csv.includes('reviewNoteSuggestion'), false);
    assert.equal(detailResponse.status, 200);
    assert.equal(detailHtml.includes(SYNTHETIC_MANUAL_NOTE), false);
    assert.equal(leadsPageResponse.status, 200);
    assert.equal(leadsPageHtml.includes(SYNTHETIC_MANUAL_NOTE), false);
    assert.equal(leadsPageHtml.includes('Follow-up check:'), false);
    assert.equal(leadsPageHtml.includes('reviewNoteSuggestion'), false);
    assert.equal(leadsPageHtml.includes('reviewNoteTemplates'), false);
    assert.equal(apiLeadsPayload.manualReviewNotesAccess.role, scenario.expectedRole);
    assert.equal(apiLeadsPayload.manualReviewNotesAccess.claimStatus, scenario.claimStatus);
    assert.equal(apiLeadsPayload.manualReviewNotesAccess.manualNotesRead, false);
  });
}

test('Level 1 local proof simulation omits protected notes on provider error', async () => {
  const env = {
    ...createProofEnv('reviewer'),
    [AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV]: {
      async resolveSession() {
        throw new Error('synthetic provider failure with secret text');
      },
    },
  };

  const apiLeadsResponse = await handleWorkerRequest(
    createWorkerRequest('/api/leads?profile=danfoss', { headers: authHeaders() }),
    env,
    {}
  );
  const apiLeadsPayload = await readJson(apiLeadsResponse);
  const detailResponse = await handleWorkerRequest(
    createWorkerRequest('/leads/lead-1', { headers: authHeaders() }),
    env,
    {}
  );
  const detailHtml = await detailResponse.text();
  const leadsPageResponse = await handleWorkerRequest(createWorkerRequest('/leads'), env, {});
  const leadsPageHtml = await leadsPageResponse.text();

  assert.equal(apiLeadsResponse.status, 200);
  assert.equal(Object.hasOwn(apiLeadsPayload.leads[0], 'manualReviewNotes'), false);
  assert.equal(JSON.stringify(apiLeadsPayload).includes(SYNTHETIC_MANUAL_NOTE), false);
  assert.equal(JSON.stringify(apiLeadsPayload).includes('secret text'), false);
  assert.equal(detailResponse.status, 200);
  assert.equal(detailHtml.includes(SYNTHETIC_MANUAL_NOTE), false);
  assert.equal(detailHtml.includes('secret text'), false);
  assert.equal(leadsPageResponse.status, 200);
  assert.equal(leadsPageHtml.includes(SYNTHETIC_MANUAL_NOTE), false);
  assert.equal(leadsPageHtml.includes('secret text'), false);
  assert.equal(leadsPageHtml.includes('Follow-up check:'), false);
  assert.equal(leadsPageHtml.includes('reviewNoteSuggestion'), false);
  assert.equal(leadsPageHtml.includes('reviewNoteTemplates'), false);
  assert.equal(apiLeadsPayload.manualReviewNotesAccess.providerStatus, 'provider_error');
  assert.equal(apiLeadsPayload.manualReviewNotesAccess.claimStatus, 'provider_error');
  assert.equal(apiLeadsPayload.manualReviewNotesAccess.productionReady, false);
});
