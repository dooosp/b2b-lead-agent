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
const PROTECTED_REVIEWER_FEEDBACK = 'Synthetic protected reviewer feedback body for route audit.';
const PROTECTED_REVIEWER_NEXT_ACTION = 'Synthetic protected reviewer next action for route audit.';
const GENERATED_SUGGESTION_FRAGMENT = 'Follow-up check:';
const DENIED_RENDERED_HTML_FORBIDDEN_FRAGMENTS = Object.freeze([
  PROTECTED_NOTE,
  PROTECTED_REVIEWER_FEEDBACK,
  PROTECTED_REVIEWER_NEXT_ACTION,
  GENERATED_SUGGESTION_FRAGMENT,
  '생성된 검토 메모 제안',
  'reviewNoteSuggestion',
  'reviewNoteTemplates',
  'providerInput',
  'rawSessionClaims',
  'rawAuth',
  'raw_auth',
  '"authHeader"',
  "'authHeader'",
  'authHeader:',
]);
const RAW_AUTH_API_FORBIDDEN_FRAGMENTS = Object.freeze([
  'providerInput',
  'rawSessionClaims',
  'rawAuth',
  'raw_auth',
  '"authHeader"',
  "'authHeader'",
  'authHeader:',
  'Authorization=Bearer',
  'Cookie=',
]);

function createAuditEnv(session) {
  const provider = session && typeof session.resolveSession === 'function'
    ? session
    : createStaticAuthProviderSessionScaffoldProvider(session);
  const env = createWorkerEnv({
    [AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV]: 'enabled',
    [AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV]: provider,
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
  env.DB.reviewerFeedback.set('lead-1', {
    lead_id: 'lead-1',
    action_usefulness: 'useful',
    outcome_label: 'needs_more_research',
    data_gap_priority: 'blocking',
    evidence_confidence_adjustment: 'decrease',
    feedback_text: PROTECTED_REVIEWER_FEEDBACK,
    next_reviewer_action: PROTECTED_REVIEWER_NEXT_ACTION,
    author_label: 'manual_reviewer',
    updated_at: '2026-05-31T00:00:00.000Z',
  });
  env.DB.reviewerFeedbackEvents.push({
    id: 1,
    lead_id: 'lead-1',
    event_type: 'create',
    changed_at: '2026-05-31T00:00:00.000Z',
    author_label: 'manual_reviewer',
    changed_fields: JSON.stringify(['feedbackText', 'nextReviewerAction']),
  });
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
  assert.equal(serialized.includes(PROTECTED_REVIEWER_FEEDBACK), false);
  assert.equal(serialized.includes(PROTECTED_REVIEWER_NEXT_ACTION), false);
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

function assertDoesNotLeakRawAuthFields(payload, surface) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const fragment of RAW_AUTH_API_FORBIDDEN_FRAGMENTS) {
    assert.equal(
      serialized.includes(fragment),
      false,
      `${surface} leaked forbidden raw auth/provider fragment: ${fragment}`
    );
  }
}

function assertDeniedRenderedHtmlDoesNotLeakProtectedFields(html, surface) {
  assert.equal(typeof html, 'string');
  for (const fragment of DENIED_RENDERED_HTML_FORBIDDEN_FRAGMENTS) {
    assert.equal(
      html.includes(fragment),
      false,
      `${surface} leaked forbidden Level 1 fragment: ${fragment}`
    );
  }
  assertDoesNotLeakProtectedText(html, { allowStaticAuthorLabelCode: true });
  assertDoesNotLeakGeneratedSuggestion(html);
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
      'api.leads.batchEnrich',
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
  assert.equal(listPayload.leads[0].reviewerFeedback.feedbackText, PROTECTED_REVIEWER_FEEDBACK);
  assert.equal(listPayload.leads[0].reviewerFeedback.nextReviewerAction, PROTECTED_REVIEWER_NEXT_ACTION);
  assert.equal(historyPayload.history[0].manualReviewNotes, PROTECTED_NOTE);
  assert.equal(historyPayload.history[0].reviewerFeedback.feedbackText, PROTECTED_REVIEWER_FEEDBACK);
  assert.equal(historyPayload.history[0].reviewerFeedback.nextReviewerAction, PROTECTED_REVIEWER_NEXT_ACTION);
  assert.equal(detailHtml.includes(PROTECTED_NOTE), true);
  assert.equal(detailHtml.includes(PROTECTED_REVIEWER_FEEDBACK), true);
  assert.equal(detailHtml.includes(PROTECTED_REVIEWER_NEXT_ACTION), true);
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
  { name: 'api client hyphen alias', session: { role: 'api-client' } },
  { name: 'api alias', session: { role: 'api' } },
  { name: 'missing role', session: { role: '' } },
  { name: 'unknown role', session: { role: 'auditor' } },
  { name: 'mixed roles', session: { role: ['reviewer', 'manager'] } },
  { name: 'single-item role array', session: { role: ['reviewer'] } },
  { name: 'expired reviewer', session: { role: 'reviewer', expiresAt: '2000-01-01T00:00:00.000Z' } },
  { name: 'wrong audience reviewer', session: { role: 'reviewer', audience: 'wrong-audience' } },
  { name: 'malformed audience array reviewer', session: { role: 'reviewer', audience: ['b2b-lead-agent-level1-local-proof'] } },
  {
    name: 'malformed provider claim payload',
    session: {
      async resolveSession() {
        return 'role=reviewer;Authorization=Bearer synthetic-route-token';
      },
    },
  },
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
    const batchEnrichResponse = await handleWorkerRequest(
      createWorkerRequest('/api/leads/batch-enrich', {
        method: 'POST',
        headers: API_HEADERS,
        json: { profile: 'danfoss' },
      }),
      {
        ...env,
        GEMINI_API_KEY: 'synthetic-local-key',
      },
      {}
    );
    const batchEnrichPayload = await json(batchEnrichResponse);
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
    const nonManualPatchResponse = await handleWorkerRequest(
      createWorkerRequest('/api/leads/lead-1', {
        method: 'PATCH',
        headers: API_HEADERS,
        json: { reviewStatus: 'APPROVED' },
      }),
      env,
      {}
    );
    const nonManualPatchPayload = await json(nonManualPatchResponse);

    assert.equal(writeResponse.status, 403);
    assert.equal(enrichResponse.status, 409);
    assert.equal(batchEnrichResponse.status, 200);
    assert.equal(nonManualPatchResponse.status, 200);
    assert.equal(writePayload.success, false);
    assert.equal(listPayload.reviewerActionQueue.items.length, 1);
    assertDoesNotLeakProtectedText(listPayload);
    assertDoesNotLeakProtectedText(historyPayload);
    assertDeniedRenderedHtmlDoesNotLeakProtectedFields(detailHtml, `${scenario.name} detail HTML`);
    assertDeniedRenderedHtmlDoesNotLeakProtectedFields(leadsPageHtml, `${scenario.name} leads HTML`);
    assertDoesNotLeakProtectedText(exportCsv);
    assertDoesNotLeakProtectedText(enrichPayload);
    assertDoesNotLeakProtectedText(batchEnrichPayload);
    assertDoesNotLeakProtectedText(nonManualPatchPayload);
    assertDoesNotLeakGeneratedSuggestion(listPayload);
    assertDoesNotLeakGeneratedSuggestion(historyPayload);
    assertDoesNotLeakGeneratedSuggestion(exportCsv);
    assertDoesNotLeakGeneratedSuggestion(enrichPayload);
    assertDoesNotLeakGeneratedSuggestion(batchEnrichPayload);
    assertDoesNotLeakGeneratedSuggestion(nonManualPatchPayload);
    assertDoesNotLeakRawAuthFields(listPayload, `${scenario.name} list payload`);
    assertDoesNotLeakRawAuthFields(historyPayload, `${scenario.name} history payload`);
    assertDoesNotLeakRawAuthFields(exportCsv, `${scenario.name} export CSV`);
    assertDoesNotLeakRawAuthFields(enrichPayload, `${scenario.name} enrich payload`);
    assertDoesNotLeakRawAuthFields(batchEnrichPayload, `${scenario.name} batch enrich payload`);
    assertDoesNotLeakRawAuthFields(writePayload, `${scenario.name} write payload`);
    assertDoesNotLeakRawAuthFields(nonManualPatchPayload, `${scenario.name} non-manual patch payload`);
    assert.equal(JSON.stringify(writePayload).includes(`Denied ${scenario.name} write.`), false);
    assert.equal(JSON.stringify(listPayload).includes('synthetic-route-token'), false);
    assert.equal(detailHtml.includes('synthetic-route-token'), false);
    assert.equal(leadsPageHtml.includes('synthetic-route-token'), false);
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
  assertDeniedRenderedHtmlDoesNotLeakProtectedFields(detailHtml, 'provider-error detail HTML');
  assertDeniedRenderedHtmlDoesNotLeakProtectedFields(leadsPageHtml, 'provider-error leads HTML');
  assertDoesNotLeakGeneratedSuggestion(listPayload);
  assert.equal(JSON.stringify(listPayload).includes(providerSecret), false);
  assert.equal(detailHtml.includes(providerSecret), false);
  assert.equal(leadsPageHtml.includes(providerSecret), false);
  assert.equal(listPayload.manualReviewNotesAccess.providerStatus, 'provider_error');
  assert.equal(listPayload.manualReviewNotesAccess.productionReady, false);
});

test('Level 1 route audit filters denied-role successful enrich response', async () => {
  const originalFetch = globalThis.fetch;
  const env = createAuditEnv({ role: 'manager' });
  env.DB.leads.set('lead-1', {
    ...env.DB.leads.get('lead-1'),
    enriched: 0,
  });
  globalThis.fetch = async (url) => {
    const rawUrl = String(url);
    if (rawUrl.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: 'Synthetic enriched summary.',
                    roi: '근거 없음(추정 불가) - synthetic',
                    salesPitch: 'Synthetic sales pitch.',
                    globalContext: 'Synthetic global context.',
                    actionItems: ['Synthetic action'],
                    keyFigures: [],
                    painPoints: ['Synthetic pain'],
                    meddic: {},
                    competitive: {},
                    buyingSignals: ['Synthetic signal'],
                    evidence: [],
                    assumptions: ['Synthetic assumption'],
                    dataGaps: ['Synthetic gap'],
                  }),
                },
              ],
            },
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('<article><p>Local synthetic article body with enough plain text to satisfy body extraction for this route audit fixture.</p></article>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  };

  try {
    const response = await handleWorkerRequest(
      createWorkerRequest('/api/leads/lead-1/enrich?force=1', {
        method: 'POST',
        headers: API_HEADERS,
      }),
      {
        ...env,
        GEMINI_API_KEY: 'synthetic-local-key',
      },
      {}
    );
    const payload = await json(response);

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assertDoesNotLeakProtectedText(payload);
    assertDoesNotLeakGeneratedSuggestion(payload);
    assertDoesNotLeakRawAuthFields(payload, 'successful denied-role enrich payload');
    assert.equal(JSON.stringify(payload).includes(PROTECTED_NOTE), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
