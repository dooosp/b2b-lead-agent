import {
  authProviderSessionScaffoldMetadata,
  isAuthProviderSessionScaffoldRequested,
  resolveAuthProviderSessionScaffold
} from './auth-provider-session-scaffold.js';
import { buildLevel1RollbackStopWriteGuard } from './level1-readiness-guards.js';

export const MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB_APPROVAL_RECORD =
  'https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4495568414';

export const MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_HEADER =
  'x-manual-review-notes-local-test-role';

const LOCAL_TEST_ROLE_STUB_ENV = 'MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB';
const LEVEL1_MANUAL_REVIEW_NOTES_STOP_WRITE_ENV = 'LEVEL1_MANUAL_REVIEW_NOTES_STOP_WRITE';
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

function isLevel1ManualReviewNotesStopWriteEnabled(env = {}) {
  return ENABLED_VALUES.has(String(env[LEVEL1_MANUAL_REVIEW_NOTES_STOP_WRITE_ENV] || '').trim().toLowerCase());
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (role === ROLE_REVIEWER || role === ROLE_MANAGER || role === ROLE_API) return role;
  if (role === 'api_client' || role === 'api-client' || role === 'api client') return ROLE_API;
  return 'none';
}

export async function resolveManualReviewNotesAccess(request, env = {}) {
  const stopWrites = isLevel1ManualReviewNotesStopWriteEnabled(env);
  if (isAuthProviderSessionScaffoldRequested(env)) {
    const scaffoldAccess = await resolveAuthProviderSessionScaffold(request, env);
    return stopWrites
      ? {
        ...scaffoldAccess,
        manualNotesWrite: false,
        stopWrites: true,
        rollbackGuard: buildLevel1RollbackStopWriteGuard('manual_review_notes_stop_write'),
      }
      : scaffoldAccess;
  }

  const enabled = isLocalTestRoleStubEnabled(env) || stopWrites;
  const role = enabled
    ? normalizeRole(request?.headers?.get(MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_HEADER))
    : 'legacy_api_token';
  const canUseManualNotes = (!enabled || role === ROLE_REVIEWER) && !stopWrites;

  return {
    enabled,
    role,
    manualNotesRead: canUseManualNotes,
    manualNotesWrite: canUseManualNotes,
    metadataHistorySummaryRead: canUseManualNotes,
    stopWrites,
    rollbackGuard: stopWrites
      ? buildLevel1RollbackStopWriteGuard('manual_review_notes_stop_write')
      : undefined,
  };
}

export function manualReviewNotesAccessMetadata(access = {}) {
  const scaffoldMetadata = authProviderSessionScaffoldMetadata(access);
  if (scaffoldMetadata) return scaffoldMetadata;

  if (!access.enabled) return undefined;
  const metadata = {
    mode: 'local_test_role_stub',
    approvalRecord: MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB_APPROVAL_RECORD,
    role: access.role || 'none',
    manualNotesRead: access.manualNotesRead === true,
    manualNotesWrite: access.manualNotesWrite === true,
    metadataHistorySummaryRead: access.metadataHistorySummaryRead === true,
    realAuthImplemented: false,
    productionReady: false,
  };
  if (access.stopWrites) {
    metadata.stopWrites = true;
    metadata.rollbackGuard = access.rollbackGuard || buildLevel1RollbackStopWriteGuard('manual_review_notes_stop_write');
  }
  return metadata;
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
  if (access.stopWrites) {
    throw Object.assign(
      new Error('Manual review notes writes are stopped by the Level 1 rollback stop-write guard. Existing data must be preserved and owner approval is required before writes resume.'),
      { status: 423 }
    );
  }
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

export function filterManualReviewNotesForExport(leads) {
  return filterManualReviewNotesLeadCollection(leads, {
    enabled: true,
    manualNotesRead: false,
  });
}

function omitGeneratedSuggestionFields(item = {}) {
  if (!item || typeof item !== 'object') return item;
  const {
    reviewNoteSuggestion,
    reviewNoteTemplates,
    ...filtered
  } = item;
  return filtered;
}

export function filterManualReviewNotesReviewerQueue(queue, access = {}) {
  if (!queue || !access.enabled || access.manualNotesRead) return queue;
  const items = Array.isArray(queue.items)
    ? queue.items.map(omitGeneratedSuggestionFields)
    : [];
  return {
    ...queue,
    items,
    lanes: Array.isArray(queue.lanes)
      ? queue.lanes.map((lane) => ({
        ...lane,
        items: Array.isArray(lane.items)
          ? lane.items.map(omitGeneratedSuggestionFields)
          : [],
      }))
      : [],
  };
}

export function filterManualReviewNotesLeadReviewSession(session, access = {}) {
  if (!session || !access.enabled || access.manualNotesRead) return session;
  return {
    ...session,
    nextLead: session.nextLead ? omitGeneratedSuggestionFields(session.nextLead) : session.nextLead,
  };
}
