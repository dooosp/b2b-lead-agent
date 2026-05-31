import test from 'node:test';
import assert from 'node:assert/strict';

import { handleWorkerRequest } from '../routes/dispatcher.js';
import { apiRoutes } from '../routes/api.js';
import { pageRoutes } from '../routes/pages.js';
import {
  AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV,
  AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV,
  createStaticAuthProviderSessionScaffoldProvider,
} from '../lib/auth-provider-session-scaffold.js';
import {
  LEVEL1_AUTH_ROUTE_AUDIT_NON_PRODUCTION,
  auditLevel1AuthRouteCoverage,
} from '../lib/level1-auth-route-audit.js';
import { createLeadRow, createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

const API_HEADERS = Object.freeze({ Authorization: 'Bearer api-secret' });
const PROTECTED_NOTE = 'Synthetic protected manual note body for route audit.';
const GENERATED_SUGGESTION_FRAGMENT = 'Follow-up check:';

function createAuditEnv(session) {
  const env = createWorkerEnv({
    [AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV]: 'enabled',
    [AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV]: createStaticAuthProviderSessionScaffoldProvider(session),
  });
  env.DB.leads.set('lead-1', createLeadRow({
    enriched: 1,
    notes: PROTECTED_NOTE,
    manual_review_notes_author_label: 'manual_reviewer',
    manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
    review_status: 'APPROVED',
    verification_status: 'verified',
    confidence: 'HIGH',
    urgency_reason: 'Synthetic route audit urgency.',
    evidence: JSON.stringify([
      {
        field: 'summary',
        quote: 'Synthetic route audit evidence',
        sourceUrl: 'https://example.test/source',
      },
    ]),
    sources: JSON.stringify([
      {
        title: 'Synthetic route audit source',
        url: 'https://example.test/source',
      },
    ]),
  }));
  return env;
}

async function json(response) {
  return response.json();
}

async function text(response) {
  return response.text();
}

function assertDoesNotLeakProtectedText(payload, { allowStaticAuthorLabelCode = false } = {}) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  assert.equal(serialized.includes(PROTECTED_NOTE), false);
  if (!allowStaticAuthorLabelCode) {
    assert.equal(serialized.includes('manual_reviewer'), false);
  }
  assert.equal(serialized.includes('"manualReviewNotesAuthorLabel":"manual_reviewer"'), false);
  assert.equal(serialized.includes('"manual_review_notes_author_label":"manual_reviewer"'), false);
}

function assertDoesNotLeakGeneratedSuggestion(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  assert.equal(serialized.includes(GENERATED_SUGGESTION_FRAGMENT), false);
  assert.equal(serialized.includes('reviewNoteSuggestion'), false);
  assert.equal(serialized.includes('reviewNoteTemplates'), false);
}

test('Level 1 auth route audit inventory maps current protected route ids', () => {
  const coverage = auditLevel1AuthRouteCoverage({ apiRoutes, pageRoutes });

  assert.deepEqual(coverage.missingRouteIds, []);
  assert.deepEqual(
    LEVEL1_AUTH_ROUTE_AUDIT_NON_PRODUCTION.map((surface) => surface.routeId),
    [
      'api.leads.list',
      'api.history',
      'api.exportCsv',
      'api.leads.enrich',
      'api.leads.patch',
      'page.leads',
      'page.leadDetail',
    ]
  );
  assert.ok(LEVEL1_AUTH_ROUTE_AUDIT_NON_PRODUCTION.every((surface) => surface.productionReady === false));
  assert.equal(
    LEVEL1_AUTH_ROUTE_AUDIT_NON_PRODUCTION.find((surface) => surface.routeId === 'api.exportCsv').manualNoteBody,
    'never_export'
  );
});

test('synthetic reviewer can read and write protected manual notes but export still omits note bodies', async () => {
  const env = createAuditEnv({ role: 'reviewer' });

  const listPayload = await json(await handleWorkerRequest(
    createWorkerRequest('/api/leads?profile=danfoss', { headers: API_HEADERS }),
    env,
    {}
  ));
  const historyPayload = await json(await handleWorkerRequest(
    createWorkerRequest('/api/history?profile=danfoss', { headers: API_HEADERS }),
    env,
    {}
  ));
  const detailHtml = await text(await handleWorkerRequest(
    createWorkerRequest('/leads/lead-1', { headers: API_HEADERS }),
    env,
    {}
  ));
  const leadsPageHtml = await text(await handleWorkerRequest(
    createWorkerRequest('/leads', { headers: API_HEADERS }),
    env,
    {}
  ));
  const exportCsv = await text(await handleWorkerRequest(
    createWorkerRequest('/api/export/csv?profile=danfoss', { headers: API_HEADERS }),
    env,
    {}
  ));
  const writePayload = await json(await handleWorkerRequest(
    createWorkerRequest('/api/leads/lead-1', {
      method: 'PATCH',
      headers: API_HEADERS,
      json: { manualReviewNotes: 'Synthetic reviewer route audit write.' },
    }),
    env,
    {}
  ));

  assert.equal(listPayload.leads[0].manualReviewNotes, PROTECTED_NOTE);
  assert.equal(historyPayload.history[0].manualReviewNotes, PROTECTED_NOTE);
  assert.equal(detailHtml.includes(PROTECTED_NOTE), true);
  assert.equal(detailHtml.includes(GENERATED_SUGGESTION_FRAGMENT), true);
  assert.equal(detailHtml.includes('생성된 검토 메모 제안'), true);
  assert.equal(leadsPageHtml.includes(GENERATED_SUGGESTION_FRAGMENT), true);
  assert.equal(leadsPageHtml.includes('생성된 검토 메모 제안'), true);
  assert.equal(listPayload.reviewerActionQueue.items[0].reviewNoteSuggestion.text.includes(GENERATED_SUGGESTION_FRAGMENT), true);
  assert.equal(writePayload.success, true);
  assert.equal(writePayload.lead.manualReviewNotes, 'Synthetic reviewer route audit write.');
  assert.equal(exportCsv.includes(PROTECTED_NOTE), false);
  assert.equal(exportCsv.includes('Synthetic reviewer route audit write.'), false);
  assert.equal(exportCsv.includes('reviewNoteSuggestion'), false);
});

for (const scenario of [
  { name: 'manager', session: { role: 'manager' } },
  { name: 'admin', session: { role: 'admin' } },
  { name: 'api client', session: { role: 'api_client' } },
  { name: 'missing role', session: { role: '' } },
  { name: 'unknown role', session: { role: 'auditor' } },
  { name: 'expired reviewer', session: { role: 'reviewer', expiresAt: '2000-01-01T00:00:00.000Z' } },
  { name: 'wrong audience reviewer', session: { role: 'reviewer', audience: 'wrong-audience' } },
]) {
  test(`Level 1 route audit fails closed for ${scenario.name}`, async () => {
    const env = createAuditEnv(scenario.session);

    const listPayload = await json(await handleWorkerRequest(
      createWorkerRequest('/api/leads?profile=danfoss', { headers: API_HEADERS }),
      env,
      {}
    ));
    const historyPayload = await json(await handleWorkerRequest(
      createWorkerRequest('/api/history?profile=danfoss', { headers: API_HEADERS }),
      env,
      {}
    ));
    const detailHtml = await text(await handleWorkerRequest(
      createWorkerRequest('/leads/lead-1', { headers: API_HEADERS }),
      env,
      {}
    ));
    const leadsPageHtml = await text(await handleWorkerRequest(
      createWorkerRequest('/leads', { headers: API_HEADERS }),
      env,
      {}
    ));
    const exportCsv = await text(await handleWorkerRequest(
      createWorkerRequest('/api/export/csv?profile=danfoss', { headers: API_HEADERS }),
      env,
      {}
    ));
    const enrichResponse = await handleWorkerRequest(
      createWorkerRequest('/api/leads/lead-1/enrich', {
        method: 'POST',
        headers: API_HEADERS,
      }),
      {
        ...env,
        GEMINI_API_KEY: 'synthetic-local-key',
      },
      {}
    );
    const enrichPayload = await json(enrichResponse);
    const writeResponse = await handleWorkerRequest(
      createWorkerRequest('/api/leads/lead-1', {
        method: 'PATCH',
        headers: API_HEADERS,
        json: { manualReviewNotes: `Denied ${scenario.name} write.` },
      }),
      env,
      {}
    );
    const writePayload = await json(writeResponse);

    assert.equal(writeResponse.status, 403);
    assert.equal(enrichResponse.status, 409);
    assert.equal(writePayload.success, false);
    assert.equal(listPayload.reviewerActionQueue.items.length, 1);
    assertDoesNotLeakProtectedText(listPayload);
    assertDoesNotLeakProtectedText(historyPayload);
    assertDoesNotLeakProtectedText(detailHtml, { allowStaticAuthorLabelCode: true });
    assertDoesNotLeakProtectedText(leadsPageHtml, { allowStaticAuthorLabelCode: true });
    assertDoesNotLeakProtectedText(exportCsv);
    assertDoesNotLeakProtectedText(enrichPayload);
    assertDoesNotLeakGeneratedSuggestion(listPayload);
    assertDoesNotLeakGeneratedSuggestion(historyPayload);
    assertDoesNotLeakGeneratedSuggestion(detailHtml);
    assertDoesNotLeakGeneratedSuggestion(leadsPageHtml);
    assertDoesNotLeakGeneratedSuggestion(exportCsv);
    assertDoesNotLeakGeneratedSuggestion(enrichPayload);
    assert.equal(JSON.stringify(writePayload).includes(`Denied ${scenario.name} write.`), false);
    assert.equal(env.DB.leads.get('lead-1').notes, PROTECTED_NOTE);
  });
}

test('Level 1 route audit fails closed and redacts provider-error details', async () => {
  const providerSecret = 'provider-secret-route-audit-detail';
  const env = createAuditEnv({ role: 'reviewer' });
  env[AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV] = {
    async resolveSession() {
      throw new Error(providerSecret);
    },
  };

  const listPayload = await json(await handleWorkerRequest(
    createWorkerRequest('/api/leads?profile=danfoss', { headers: API_HEADERS }),
    env,
    {}
  ));
  const detailHtml = await text(await handleWorkerRequest(
    createWorkerRequest('/leads/lead-1', { headers: API_HEADERS }),
    env,
    {}
  ));
  const leadsPageHtml = await text(await handleWorkerRequest(
    createWorkerRequest('/leads', { headers: API_HEADERS }),
    env,
    {}
  ));

  assertDoesNotLeakProtectedText(listPayload);
  assertDoesNotLeakProtectedText(detailHtml, { allowStaticAuthorLabelCode: true });
  assertDoesNotLeakProtectedText(leadsPageHtml, { allowStaticAuthorLabelCode: true });
  assertDoesNotLeakGeneratedSuggestion(listPayload);
  assertDoesNotLeakGeneratedSuggestion(detailHtml);
  assertDoesNotLeakGeneratedSuggestion(leadsPageHtml);
  assert.equal(JSON.stringify(listPayload).includes(providerSecret), false);
  assert.equal(detailHtml.includes(providerSecret), false);
  assert.equal(leadsPageHtml.includes(providerSecret), false);
  assert.equal(listPayload.manualReviewNotesAccess.providerStatus, 'provider_error');
  assert.equal(listPayload.manualReviewNotesAccess.productionReady, false);
});
