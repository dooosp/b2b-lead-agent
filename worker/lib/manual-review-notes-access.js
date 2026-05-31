import {
  authProviderSessionScaffoldMetadata,
  isAuthProviderSessionScaffoldRequested,
  resolveAuthProviderSessionScaffold
} from './auth-provider-session-scaffold.js';

export const MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB_APPROVAL_RECORD =
  'https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4495568414';

export const MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_HEADER =
  'x-manual-review-notes-local-test-role';

const LOCAL_TEST_ROLE_STUB_ENV = 'MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB';
const ENABLED_VALUES = new Set(['1', 'true', 'enabled', 'local_test', 'local-test']);
const ROLE_REVIEWER = 'reviewer';
const ROLE_MANAGER = 'manager';
const ROLE_API = 'api';

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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function isLocalTestRoleStubEnabled(env = {}) {
  return ENABLED_VALUES.has(String(env[LOCAL_TEST_ROLE_STUB_ENV] || '').trim().toLowerCase());
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (role === ROLE_REVIEWER || role === ROLE_MANAGER || role === ROLE_API) return role;
  return 'none';
}

export async function resolveManualReviewNotesAccess(request, env = {}) {
  if (isAuthProviderSessionScaffoldRequested(env)) {
    return resolveAuthProviderSessionScaffold(request, env);
  }

  const enabled = isLocalTestRoleStubEnabled(env);
  const role = enabled
    ? normalizeRole(request?.headers?.get(MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_HEADER))
    : 'legacy_api_token';
  const canUseManualNotes = !enabled || role === ROLE_REVIEWER;

  return {
    enabled,
    role,
    manualNotesRead: canUseManualNotes,
    manualNotesWrite: canUseManualNotes,
    metadataHistorySummaryRead: canUseManualNotes,
  };
}

export function manualReviewNotesAccessMetadata(access = {}) {
  const scaffoldMetadata = authProviderSessionScaffoldMetadata(access);
  if (scaffoldMetadata) return scaffoldMetadata;

  if (!access.enabled) return undefined;
  return {
    mode: 'local_test_role_stub',
    approvalRecord: MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB_APPROVAL_RECORD,
    role: access.role || 'none',
    manualNotesRead: access.manualNotesRead === true,
    manualNotesWrite: access.manualNotesWrite === true,
    metadataHistorySummaryRead: access.metadataHistorySummaryRead === true,
    realAuthImplemented: false,
    productionReady: false,
  };
}

export function withManualReviewNotesAccessMetadata(payload, access = {}) {
  const metadata = manualReviewNotesAccessMetadata(access);
  return metadata ? { ...payload, manualReviewNotesAccess: metadata } : payload;
}

export function patchTouchesManualReviewNotes(patch = {}) {
  return hasOwn(patch, 'manualReviewNotes')
    || hasOwn(patch, 'manual_review_notes')
    || typeof patch.notes === 'string';
}

export function assertManualReviewNotesWriteAllowed(access = {}) {
  if (!access.enabled || access.manualNotesWrite) return;
  throw Object.assign(
    new Error(access.denialMessage || 'Manual review notes are restricted by the C2 local/test role stub. Use role "reviewer" for local/test manual note writes; no real auth/session/identity is implemented.'),
    { status: 403 }
  );
}

export function filterManualReviewNotesProtectedFields(lead, access = {}) {
  if (!lead || !access.enabled || access.manualNotesRead) return lead;
  const filtered = { ...lead };
  for (const field of PROTECTED_MANUAL_NOTE_FIELDS) {
    delete filtered[field];
  }
  return filtered;
}

export function filterManualReviewNotesLeadCollection(leads, access = {}) {
  return Array.isArray(leads)
    ? leads.map((lead) => filterManualReviewNotesProtectedFields(lead, access))
    : [];
}
