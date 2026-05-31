import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchHistory, fetchLeads, handleExportCSV, handleUpdateLead } from '../api/leads.js';
import { getLeadById } from '../db/leads.js';
import {
  AUTH_PROVIDER_SESSION_SCAFFOLD_EXPECTED_AUDIENCE,
  AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV,
  AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV,
  createStaticAuthProviderSessionScaffoldProvider
} from '../lib/auth-provider-session-scaffold.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLeadRow } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

const PROTECTED_MANUAL_NOTE_FIELDS = Object.freeze([
  'notes',
  'manualReviewNotes',
  'manualReviewNotesProvenance',
  'manualReviewNotesAuthorLabel',
  'manualReviewNotesUpdatedAt',
  'manualReviewNotesHistoryEventCount',
  'manualReviewNotesHistoryLastEventType',
  'manualReviewNotesHistoryLastEventAt',
  'manualReviewNotesHistoryLastAuthorLabel',
]);

function scaffoldEnv(provider, extra = {}) {
  return {
    [AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV]: 'enabled',
    [AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV]: provider,
    ...extra,
  };
}

async function patchLead(db, payload, env) {
  const request = createWorkerRequest('/api/leads/lead-1', {
    method: 'PATCH',
    json: payload,
  });
  return handleUpdateLead(request, { DB: db, ...env }, 'lead-1');
}

function assertProtectedManualNoteFieldsOmitted(lead) {
  for (const field of PROTECTED_MANUAL_NOTE_FIELDS) {
    assert.equal(Object.hasOwn(lead, field), false, `${field} should be omitted`);
  }
}

function assertScaffoldMetadata(metadata, {
  role,
  roleStatus = 'recognized',
  authenticated = true,
  canUseManualNotes = role === 'reviewer',
  providerStatus = 'resolved',
  claimStatus = 'valid',
} = {}) {
  assert.deepEqual(metadata, {
    mode: 'auth_provider_session_scaffold_non_production',
    approvalRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/162#issuecomment-4525315986',
    providerModel: 'cloudflare_access_zero_trust_planning_only',
    sessionModel: 'cloudflare_access_managed_session_planning_only',
    roleSource: 'cloudflare_access_groups_policies_planning_only',
    role,
    roleStatus,
    authenticated,
    providerStatus,
    claimStatus,
    expectedAudience: AUTH_PROVIDER_SESSION_SCAFFOLD_EXPECTED_AUDIENCE,
    manualNotesRead: canUseManualNotes,
    manualNotesWrite: canUseManualNotes,
    metadataHistorySummaryRead: canUseManualNotes,
    realAuthImplemented: false,
    productionReady: false,
  });
}

test('non-production auth provider/session scaffold lets reviewer read and write without real auth identity', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const env = scaffoldEnv(createStaticAuthProviderSessionScaffoldProvider({ role: 'reviewer' }));

  const writeResponse = await patchLead(db, {
    manualReviewNotes: 'Synthetic reviewer note for scaffold test.',
  }, env);
  const writePayload = await writeResponse.json();
  const persistedLead = await getLeadById(db, 'lead-1');

  assert.equal(writeResponse.status, 200);
  assert.equal(writePayload.success, true);
  assert.equal(writePayload.lead.manualReviewNotes, 'Synthetic reviewer note for scaffold test.');
  assert.equal(writePayload.lead.manualReviewNotesAuthorLabel, 'manual_reviewer');
  assert.equal(persistedLead.manualReviewNotes, 'Synthetic reviewer note for scaffold test.');
  assertScaffoldMetadata(writePayload.manualReviewNotesAccess, { role: 'reviewer' });

  const readResponse = await fetchLeads(
    { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...env },
    'danfoss',
    createWorkerRequest('/api/leads')
  );
  const readPayload = await readResponse.json();

  assert.equal(readResponse.status, 200);
  assert.equal(readPayload.leads[0].manualReviewNotes, 'Synthetic reviewer note for scaffold test.');
  assert.equal(readPayload.leads[0].manualReviewNotesAuthorLabel, 'manual_reviewer');
  assertScaffoldMetadata(readPayload.manualReviewNotesAccess, { role: 'reviewer' });
});

test('non-production auth provider/session scaffold exposes stop-write rollback metadata', async () => {
  const originalManualNote = 'Existing note preserved by scaffold stop-write.';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: originalManualNote,
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
      }),
    ],
  });
  const env = scaffoldEnv(
    createStaticAuthProviderSessionScaffoldProvider({ role: 'reviewer' }),
    { LEVEL1_MANUAL_REVIEW_NOTES_STOP_WRITE: 'enabled' }
  );

  const writeResponse = await patchLead(db, {
    manualReviewNotes: 'Blocked by scaffold stop-write.',
  }, env);
  const writePayload = await writeResponse.json();
  const persistedLead = await getLeadById(db, 'lead-1');
  const listResponse = await fetchLeads(
    { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...env },
    'danfoss',
    createWorkerRequest('/api/leads')
  );
  const listPayload = await listResponse.json();

  assert.equal(writeResponse.status, 423);
  assert.equal(writePayload.success, false);
  assert.match(writePayload.message, /stop-write guard/);
  assert.equal(persistedLead.manualReviewNotes, originalManualNote);
  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.leads[0].manualReviewNotes, originalManualNote);
  assert.equal(listPayload.manualReviewNotesAccess.mode, 'auth_provider_session_scaffold_non_production');
  assert.equal(listPayload.manualReviewNotesAccess.role, 'reviewer');
  assert.equal(listPayload.manualReviewNotesAccess.manualNotesRead, true);
  assert.equal(listPayload.manualReviewNotesAccess.manualNotesWrite, false);
  assert.equal(listPayload.manualReviewNotesAccess.productionReady, false);
  assert.equal(listPayload.manualReviewNotesAccess.stopWrites, true);
  assert.deepEqual(listPayload.manualReviewNotesAccess.rollbackGuard, {
    trigger: 'manual_review_notes_stop_write',
    stopWrites: true,
    nonDestructiveBackoutFirst: true,
    preserveExistingData: true,
    preserveRedactedEvidenceOnly: true,
    productionActionApproved: false,
    destructiveDataActionApproved: false,
    rollbackExecutionApproved: false,
    nextAction: 'HOLD_FOR_OWNER_APPROVAL',
  });
});

for (const scenario of [
  { name: 'manager', role: 'manager', expectedRole: 'manager', roleStatus: 'recognized', authenticated: true },
  { name: 'admin', role: 'admin', expectedRole: 'admin', roleStatus: 'recognized', authenticated: true },
  { name: 'api client underscore', role: 'api_client', expectedRole: 'api_client', roleStatus: 'recognized', authenticated: true },
  { name: 'api client hyphen', role: 'api-client', expectedRole: 'api_client', roleStatus: 'recognized', authenticated: true },
  { name: 'api alias', role: 'api', expectedRole: 'api_client', roleStatus: 'recognized', authenticated: true },
  { name: 'missing role', role: '', expectedRole: 'none', roleStatus: 'missing', authenticated: true },
  { name: 'unknown role', role: 'auditor', expectedRole: 'none', roleStatus: 'unknown', authenticated: true },
  { name: 'unauthenticated reviewer', role: 'reviewer', expectedRole: 'reviewer', roleStatus: 'recognized', authenticated: false },
  {
    name: 'expired reviewer claim',
    role: 'reviewer',
    expectedRole: 'reviewer',
    roleStatus: 'recognized',
    authenticated: false,
    providerAuthenticated: true,
    session: { expiresAt: '2000-01-01T00:00:00.000Z' },
    claimStatus: 'expired',
  },
  {
    name: 'missing audience reviewer claim',
    role: 'reviewer',
    expectedRole: 'reviewer',
    roleStatus: 'recognized',
    authenticated: false,
    providerAuthenticated: true,
    providerFactory: () => ({
      async resolveSession() {
        return { role: 'reviewer', authenticated: true };
      },
    }),
    claimStatus: 'missing_audience',
  },
  {
    name: 'wrong audience reviewer claim',
    role: 'reviewer',
    expectedRole: 'reviewer',
    roleStatus: 'recognized',
    authenticated: false,
    providerAuthenticated: true,
    session: { audience: 'wrong-local-proof-audience' },
    claimStatus: 'wrong_audience',
  },
]) {
  test(`non-production auth provider/session scaffold fails closed for ${scenario.name}`, async () => {
    const originalManualNote = `Protected note hidden from ${scenario.name}.`;
    const db = new FakeD1Database({
      leads: [
        createLeadRow({
          notes: originalManualNote,
          manual_review_notes_author_label: 'manual_reviewer',
          manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
        }),
      ],
      manualReviewNoteEvents: [
        {
          lead_id: 'lead-1',
          event_type: 'create',
          changed_at: '2026-05-31T00:00:00.000Z',
          author_label: 'manual_reviewer',
        },
      ],
    });
    const provider = scenario.providerFactory
      ? scenario.providerFactory()
      : createStaticAuthProviderSessionScaffoldProvider({
        role: scenario.role,
        authenticated: scenario.providerAuthenticated ?? scenario.authenticated,
        ...(scenario.session || {}),
      });
    const env = scaffoldEnv(provider);
    const attemptedNote = `Denied scaffold note for ${scenario.name}.`;

    const writeResponse = await patchLead(db, { manualReviewNotes: attemptedNote }, env);
    const writePayload = await writeResponse.json();
    const persistedLead = await getLeadById(db, 'lead-1');

    assert.equal(writeResponse.status, 403);
    assert.equal(writePayload.success, false);
    assert.match(writePayload.message, /non-production auth provider\/session scaffold/);
    assert.equal(writePayload.message.includes(attemptedNote), false);
    assert.equal(persistedLead.manualReviewNotes, originalManualNote);
    assert.equal(db.manualReviewNoteEvents.length, 1);

    const listResponse = await fetchLeads(
      { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...env },
      'danfoss',
      createWorkerRequest('/api/leads')
    );
    const listPayload = await listResponse.json();
    const historyResponse = await fetchHistory(
      { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...env },
      'danfoss',
      createWorkerRequest('/api/history')
    );
    const historyPayload = await historyResponse.json();
    const exportResponse = await handleExportCSV(
      createWorkerRequest('/api/export/csv?profile=danfoss'),
      { DB: db, ...env }
    );
    const csv = await exportResponse.text();

    assert.equal(listResponse.status, 200);
    assert.equal(historyResponse.status, 200);
    assert.equal(exportResponse.status, 200);
    assertProtectedManualNoteFieldsOmitted(listPayload.leads[0]);
    assertProtectedManualNoteFieldsOmitted(historyPayload.history[0]);
    assert.equal(JSON.stringify(listPayload).includes(originalManualNote), false);
    assert.equal(JSON.stringify(historyPayload).includes(originalManualNote), false);
    assert.equal(csv.includes(originalManualNote), false);
    assertScaffoldMetadata(listPayload.manualReviewNotesAccess, {
      role: scenario.expectedRole,
      roleStatus: scenario.roleStatus,
      authenticated: scenario.authenticated,
      canUseManualNotes: false,
      claimStatus: scenario.claimStatus || 'valid',
    });
    assertScaffoldMetadata(historyPayload.manualReviewNotesAccess, {
      role: scenario.expectedRole,
      roleStatus: scenario.roleStatus,
      authenticated: scenario.authenticated,
      canUseManualNotes: false,
      claimStatus: scenario.claimStatus || 'valid',
    });
  });
}

test('non-production auth provider/session scaffold fails closed on missing or failing provider without leaking provider details', async () => {
  const originalManualNote = 'Protected note must remain hidden after provider failure.';
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: originalManualNote,
        manual_review_notes_author_label: 'manual_reviewer',
        manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
      }),
    ],
  });
  const providerSecret = 'token-cookie-secret-session-provider-detail';
  const env = scaffoldEnv({
    async resolveSession() {
      throw new Error(providerSecret);
    },
  });

  const writeResponse = await patchLead(db, {
    manualReviewNotes: 'Provider failure must not write.',
  }, env);
  const writePayload = await writeResponse.json();
  const listResponse = await fetchLeads(
    { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...env },
    'danfoss',
    createWorkerRequest('/api/leads')
  );
  const listPayload = await listResponse.json();
  const historyResponse = await fetchHistory(
    { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...env },
    'danfoss',
    createWorkerRequest('/api/history')
  );
  const historyPayload = await historyResponse.json();
  const exportResponse = await handleExportCSV(
    createWorkerRequest('/api/export/csv?profile=danfoss'),
    { DB: db, ...env }
  );
  const csv = await exportResponse.text();

  assert.equal(writeResponse.status, 403);
  assert.equal(writePayload.success, false);
  assert.equal(JSON.stringify(writePayload).includes(providerSecret), false);
  assert.equal(listResponse.status, 200);
  assert.equal(historyResponse.status, 200);
  assert.equal(exportResponse.status, 200);
  assertProtectedManualNoteFieldsOmitted(listPayload.leads[0]);
  assertProtectedManualNoteFieldsOmitted(historyPayload.history[0]);
  assert.equal(JSON.stringify(listPayload).includes(originalManualNote), false);
  assert.equal(JSON.stringify(historyPayload).includes(originalManualNote), false);
  assert.equal(csv.includes(originalManualNote), false);
  assert.equal(JSON.stringify(listPayload).includes(providerSecret), false);
  assert.equal(JSON.stringify(historyPayload).includes(providerSecret), false);
  assert.equal(csv.includes(providerSecret), false);
  assertScaffoldMetadata(listPayload.manualReviewNotesAccess, {
    role: 'none',
    roleStatus: 'missing',
    authenticated: false,
    canUseManualNotes: false,
    providerStatus: 'provider_error',
    claimStatus: 'provider_error',
  });
  assertScaffoldMetadata(historyPayload.manualReviewNotesAccess, {
    role: 'none',
    roleStatus: 'missing',
    authenticated: false,
    canUseManualNotes: false,
    providerStatus: 'provider_error',
    claimStatus: 'provider_error',
  });
});

for (const blockedEnv of [
  { key: 'WORKER_ENV', value: 'production' },
  { key: 'WORKER_ENV', value: 'staging' },
  { key: 'DEPLOYMENT_ENV', value: 'preview' },
  { key: 'NODE_ENV', value: 'production' },
  { key: 'WRANGLER_ENV', value: 'staging' },
  { key: 'CLOUDFLARE_ENV', value: 'preview' },
]) {
  test(`non-production auth provider/session scaffold fails closed in non-local env ${blockedEnv.key}=${blockedEnv.value}`, async () => {
    const originalManualNote = 'Production-like scaffold attempt must not expose this note.';
    const db = new FakeD1Database({
      leads: [
        createLeadRow({
          notes: originalManualNote,
          manual_review_notes_author_label: 'manual_reviewer',
          manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
        }),
      ],
    });
    const env = scaffoldEnv(
      createStaticAuthProviderSessionScaffoldProvider({ role: 'reviewer' }),
      { [blockedEnv.key]: blockedEnv.value }
    );

    const writeResponse = await patchLead(db, {
      manualReviewNotes: 'Production-like scaffold attempt must not write.',
    }, env);
    const writePayload = await writeResponse.json();
    const listResponse = await fetchLeads(
      { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...env },
      'danfoss',
      createWorkerRequest('/api/leads')
    );
    const listPayload = await listResponse.json();

    assert.equal(writeResponse.status, 403);
    assert.equal(writePayload.success, false);
    assert.equal(listResponse.status, 200);
    assertProtectedManualNoteFieldsOmitted(listPayload.leads[0]);
    assert.equal(JSON.stringify(listPayload).includes(originalManualNote), false);
    assertScaffoldMetadata(listPayload.manualReviewNotesAccess, {
      role: 'none',
      roleStatus: 'blocked_production_like_environment',
      authenticated: false,
      canUseManualNotes: false,
      providerStatus: 'blocked',
      claimStatus: 'blocked_production_like_environment',
    });
  });
}

for (const scenario of [
  { name: 'missing provider', provider: undefined, providerStatus: 'missing_provider' },
  { name: 'invalid provider object', provider: {}, providerStatus: 'missing_provider' },
]) {
  test(`non-production auth provider/session scaffold fails closed for ${scenario.name}`, async () => {
    const originalManualNote = `Protected note hidden for ${scenario.name}.`;
    const db = new FakeD1Database({
      leads: [
        createLeadRow({
          notes: originalManualNote,
          manual_review_notes_author_label: 'manual_reviewer',
          manual_review_notes_updated_at: '2026-05-31T00:00:00.000Z',
        }),
      ],
    });
    const env = scaffoldEnv(scenario.provider);

    const writeResponse = await patchLead(db, {
      manualReviewNotes: `Denied scaffold note for ${scenario.name}.`,
    }, env);
    const writePayload = await writeResponse.json();
    const listResponse = await fetchLeads(
      { DB: db, GITHUB_REPO: 'dooosp/b2b-lead-agent', ...env },
      'danfoss',
      createWorkerRequest('/api/leads')
    );
    const listPayload = await listResponse.json();

    assert.equal(writeResponse.status, 403);
    assert.equal(writePayload.success, false);
    assert.equal(listResponse.status, 200);
    assertProtectedManualNoteFieldsOmitted(listPayload.leads[0]);
    assert.equal(JSON.stringify(listPayload).includes(originalManualNote), false);
    assertScaffoldMetadata(listPayload.manualReviewNotesAccess, {
      role: 'none',
      roleStatus: 'missing',
      authenticated: false,
      canUseManualNotes: false,
      providerStatus: scenario.providerStatus,
      claimStatus: 'missing_session',
    });
  });
}
