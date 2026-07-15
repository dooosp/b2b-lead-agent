import { ensureD1Schema } from './schema.js';
import { MANUAL_REVIEW_NOTES_AUTHOR_LABEL, VALID_TRANSITIONS, rowToLead, leadToRow } from './transform.js';
import { REVIEW_STATUSES, normalizeReviewStatus } from '../lib/leadbrief-v1.js';

const GENERATED_REVIEW_NOTE_PATCH_FIELDS = Object.freeze([
  'reviewNoteSuggestion',
  'review_note_suggestion',
  'reviewerNoteSuggestion',
  'reviewer_note_suggestion',
  'reviewerNoteTemplates',
  'reviewer_note_templates',
  'reviewNoteTemplates',
  'review_note_templates',
  'generatedReviewerNoteSuggestion',
  'generated_reviewer_note_suggestion',
  'generatedReviewNoteSuggestion',
  'generated_review_note_suggestion',
  'generatedSuggestionSnapshot',
  'generated_suggestion_snapshot',
]);

const MANUAL_REVIEW_NOTE_EVENT_TYPES = Object.freeze(['create', 'edit', 'clear']);
const REVIEWER_FEEDBACK_EVENT_TYPES = Object.freeze(['create', 'edit', 'clear']);
const REVIEWER_FEEDBACK_PATCH_FIELDS = Object.freeze([
  'actionUsefulness',
  'outcomeLabel',
  'dataGapPriority',
  'evidenceConfidenceAdjustment',
  'feedbackText',
  'nextReviewerAction',
]);
const REVIEWER_FEEDBACK_COLUMN_BY_FIELD = Object.freeze({
  actionUsefulness: 'action_usefulness',
  outcomeLabel: 'outcome_label',
  dataGapPriority: 'data_gap_priority',
  evidenceConfidenceAdjustment: 'evidence_confidence_adjustment',
  feedbackText: 'feedback_text',
  nextReviewerAction: 'next_reviewer_action',
});
const REVIEWER_FEEDBACK_FIELD_ALIASES = Object.freeze({
  actionUsefulness: ['actionUsefulness', 'action_usefulness'],
  outcomeLabel: ['outcomeLabel', 'outcome_label'],
  dataGapPriority: ['dataGapPriority', 'data_gap_priority'],
  evidenceConfidenceAdjustment: ['evidenceConfidenceAdjustment', 'evidence_confidence_adjustment'],
  feedbackText: ['feedbackText', 'feedback_text'],
  nextReviewerAction: ['nextReviewerAction', 'next_reviewer_action'],
});
const REVIEWER_FEEDBACK_ENUMS = Object.freeze({
  actionUsefulness: Object.freeze(['useful', 'partially_useful', 'not_useful', 'unclear']),
  outcomeLabel: Object.freeze(['interested', 'not_fit', 'no_response', 'needs_more_research', 'duplicate', 'deferred', 'unknown']),
  dataGapPriority: Object.freeze(['none', 'low', 'medium', 'high', 'blocking']),
  evidenceConfidenceAdjustment: Object.freeze(['increase', 'decrease', 'unchanged', 'unknown']),
});
const REVIEWER_FEEDBACK_DEFAULTS = Object.freeze({
  actionUsefulness: 'unclear',
  outcomeLabel: 'unknown',
  dataGapPriority: 'none',
  evidenceConfidenceAdjustment: 'unknown',
  feedbackText: '',
  nextReviewerAction: '',
});

export const LEAD_VERSION_CONFLICT_CODE = 'LEAD_VERSION_CONFLICT';

function leadVersionConflict(currentVersion) {
  return Object.assign(
    new Error('리드가 다른 요청에서 변경되었습니다. 최신 데이터를 새로고침한 뒤 다시 시도하세요.'),
    {
      status: 409,
      code: LEAD_VERSION_CONFLICT_CODE,
      currentVersion: Number.isSafeInteger(currentVersion) ? currentVersion : null,
    }
  );
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function rejectGeneratedReviewNotePersistence(patch = {}) {
  const attemptedField = GENERATED_REVIEW_NOTE_PATCH_FIELDS.find((field) => hasOwn(patch, field));
  if (!attemptedField) return;
  throw Object.assign(
    new Error(
      `Generated reviewer note suggestions are copy-only and cannot be saved through ${attemptedField}. Use manualReviewNotes for human-entered notes.`
    ),
    { status: 400 }
  );
}

function emptyManualReviewNotesHistorySummary() {
  return {
    manualReviewNotesHistoryEventCount: 0,
    manualReviewNotesHistoryLastEventType: '',
    manualReviewNotesHistoryLastEventAt: null,
    manualReviewNotesHistoryLastAuthorLabel: '',
  };
}

export function withManualReviewNotesHistorySummary(lead, summary = {}) {
  if (!lead) return lead;
  const eventCount = Number(summary.eventCount || 0);
  const eventType = MANUAL_REVIEW_NOTE_EVENT_TYPES.includes(summary.lastEventType) ? summary.lastEventType : '';
  const authorLabel = summary.lastAuthorLabel === MANUAL_REVIEW_NOTES_AUTHOR_LABEL
    ? MANUAL_REVIEW_NOTES_AUTHOR_LABEL
    : '';
  return {
    ...lead,
    manualReviewNotesHistoryEventCount: Number.isFinite(eventCount) ? Math.max(0, eventCount) : 0,
    manualReviewNotesHistoryLastEventType: eventType,
    manualReviewNotesHistoryLastEventAt: summary.lastEventAt || null,
    manualReviewNotesHistoryLastAuthorLabel: authorLabel,
  };
}

function emptyReviewerFeedbackHistorySummary() {
  return {
    eventCount: 0,
    lastEventType: '',
    lastEventAt: null,
    lastAuthorLabel: '',
  };
}

function normalizeReviewerFeedbackRecord(record = {}) {
  const hasFeedback = Boolean(record && record.hasFeedback)
    || Boolean(record && record.lead_id)
    || Boolean(record && record.updatedAt)
    || Boolean(record && record.updated_at);
  const actionUsefulness = REVIEWER_FEEDBACK_ENUMS.actionUsefulness.includes(record.actionUsefulness || record.action_usefulness)
    ? (record.actionUsefulness || record.action_usefulness)
    : REVIEWER_FEEDBACK_DEFAULTS.actionUsefulness;
  const outcomeLabel = REVIEWER_FEEDBACK_ENUMS.outcomeLabel.includes(record.outcomeLabel || record.outcome_label)
    ? (record.outcomeLabel || record.outcome_label)
    : REVIEWER_FEEDBACK_DEFAULTS.outcomeLabel;
  const dataGapPriority = REVIEWER_FEEDBACK_ENUMS.dataGapPriority.includes(record.dataGapPriority || record.data_gap_priority)
    ? (record.dataGapPriority || record.data_gap_priority)
    : REVIEWER_FEEDBACK_DEFAULTS.dataGapPriority;
  const evidenceConfidenceAdjustment = REVIEWER_FEEDBACK_ENUMS.evidenceConfidenceAdjustment.includes(
    record.evidenceConfidenceAdjustment || record.evidence_confidence_adjustment
  )
    ? (record.evidenceConfidenceAdjustment || record.evidence_confidence_adjustment)
    : REVIEWER_FEEDBACK_DEFAULTS.evidenceConfidenceAdjustment;
  const authorLabel = (record.authorLabel || record.author_label) === MANUAL_REVIEW_NOTES_AUTHOR_LABEL
    ? MANUAL_REVIEW_NOTES_AUTHOR_LABEL
    : '';

  return {
    hasFeedback,
    actionUsefulness,
    outcomeLabel,
    dataGapPriority,
    evidenceConfidenceAdjustment,
    feedbackText: typeof (record.feedbackText ?? record.feedback_text) === 'string'
      ? (record.feedbackText ?? record.feedback_text)
      : '',
    nextReviewerAction: typeof (record.nextReviewerAction ?? record.next_reviewer_action) === 'string'
      ? (record.nextReviewerAction ?? record.next_reviewer_action)
      : '',
    authorLabel,
    updatedAt: record.updatedAt || record.updated_at || null,
  };
}

export function withReviewerFeedbackSummary(lead, feedbackRecord = null, historySummary = emptyReviewerFeedbackHistorySummary()) {
  if (!lead) return lead;
  const feedback = normalizeReviewerFeedbackRecord(feedbackRecord || {});
  const eventCount = Number(historySummary.eventCount || 0);
  const eventType = REVIEWER_FEEDBACK_EVENT_TYPES.includes(historySummary.lastEventType)
    ? historySummary.lastEventType
    : '';
  const authorLabel = historySummary.lastAuthorLabel === MANUAL_REVIEW_NOTES_AUTHOR_LABEL
    ? MANUAL_REVIEW_NOTES_AUTHOR_LABEL
    : '';

  return {
    ...lead,
    reviewerFeedback: {
      ...feedback,
      authorLabel: feedback.authorLabel || authorLabel,
      historyEventCount: Number.isFinite(eventCount) ? Math.max(0, eventCount) : 0,
      historyLastEventType: eventType,
      historyLastEventAt: historySummary.lastEventAt || null,
      historyLastAuthorLabel: authorLabel,
    },
  };
}

function classifyManualReviewNoteEvent(previousNotes, nextNotes) {
  const previousHasText = String(previousNotes || '').trim().length > 0;
  const nextHasText = String(nextNotes || '').trim().length > 0;
  if (!nextHasText) return 'clear';
  return previousHasText ? 'edit' : 'create';
}

function reviewerFeedbackHasMeaningfulSignal(feedback = {}) {
  const normalized = normalizeReviewerFeedbackRecord(feedback);
  return normalized.actionUsefulness !== REVIEWER_FEEDBACK_DEFAULTS.actionUsefulness
    || normalized.outcomeLabel !== REVIEWER_FEEDBACK_DEFAULTS.outcomeLabel
    || normalized.dataGapPriority !== REVIEWER_FEEDBACK_DEFAULTS.dataGapPriority
    || normalized.evidenceConfidenceAdjustment !== REVIEWER_FEEDBACK_DEFAULTS.evidenceConfidenceAdjustment
    || String(normalized.feedbackText || '').trim().length > 0
    || String(normalized.nextReviewerAction || '').trim().length > 0;
}

async function getManualReviewNotesHistorySummary(db, leadId) {
  if (!db || !leadId) return emptyManualReviewNotesHistorySummary();
  const countRow = await db.prepare(
    'SELECT COUNT(*) as event_count FROM manual_review_note_events WHERE lead_id = ?'
  ).bind(leadId).first();
  const lastRow = await db.prepare(
    'SELECT event_type, changed_at, author_label FROM manual_review_note_events WHERE lead_id = ? ORDER BY changed_at DESC, id DESC LIMIT 1'
  ).bind(leadId).first();
  return {
    eventCount: Number(countRow?.event_count || 0),
    lastEventType: lastRow?.event_type || '',
    lastEventAt: lastRow?.changed_at || null,
    lastAuthorLabel: lastRow?.author_label || '',
  };
}

async function getReviewerFeedbackHistorySummary(db, leadId) {
  if (!db || !leadId) return emptyReviewerFeedbackHistorySummary();
  const countRow = await db.prepare(
    'SELECT COUNT(*) as event_count FROM reviewer_feedback_events WHERE lead_id = ?'
  ).bind(leadId).first();
  const lastRow = await db.prepare(
    'SELECT event_type, changed_at, author_label FROM reviewer_feedback_events WHERE lead_id = ? ORDER BY changed_at DESC, id DESC LIMIT 1'
  ).bind(leadId).first();
  return {
    eventCount: Number(countRow?.event_count || 0),
    lastEventType: lastRow?.event_type || '',
    lastEventAt: lastRow?.changed_at || null,
    lastAuthorLabel: lastRow?.author_label || '',
  };
}

async function getReviewerFeedbackRecord(db, leadId) {
  if (!db || !leadId) return null;
  return db.prepare('SELECT * FROM reviewer_feedback WHERE lead_id = ?').bind(leadId).first();
}

async function attachManualReviewNotesHistorySummaries(db, leads) {
  const list = Array.isArray(leads) ? leads : [];
  const decorated = [];
  for (const lead of list) {
    const summary = await getManualReviewNotesHistorySummary(db, lead?.id);
    decorated.push(withManualReviewNotesHistorySummary(lead, summary));
  }
  return decorated;
}

async function attachReviewerFeedbackSummaries(db, leads) {
  const list = Array.isArray(leads) ? leads : [];
  const decorated = [];
  for (const lead of list) {
    const feedback = await getReviewerFeedbackRecord(db, lead?.id);
    const history = await getReviewerFeedbackHistorySummary(db, lead?.id);
    decorated.push(withReviewerFeedbackSummary(lead, feedback, history));
  }
  return decorated;
}

export async function saveLeadsBatch(db, leads, profileId, source) {
  if (!db || !leads || leads.length === 0) return;
  await ensureD1Schema(db);
  const stmt = db.prepare(
    `INSERT INTO leads (id, identity_key, profile_id, source, status, review_status, company, summary, product, score, grade, roi, sales_pitch, global_context, sources, notes, score_reason, urgency, urgency_reason, buyer_role, evidence, confidence, confidence_reason, assumptions, generation_mode, verification_status, data_gaps, event_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       identity_key=excluded.identity_key,
       summary=excluded.summary, product=excluded.product, score=excluded.score,
       grade=excluded.grade, roi=excluded.roi, sales_pitch=excluded.sales_pitch,
       global_context=excluded.global_context, sources=excluded.sources,
       score_reason=excluded.score_reason, urgency=excluded.urgency,
       urgency_reason=excluded.urgency_reason, buyer_role=excluded.buyer_role,
       evidence=excluded.evidence, confidence=excluded.confidence,
       confidence_reason=excluded.confidence_reason, assumptions=excluded.assumptions,
       generation_mode=excluded.generation_mode,
       verification_status=excluded.verification_status,
       data_gaps=excluded.data_gaps,
       event_type=excluded.event_type, updated_at=excluded.updated_at,
       version=leads.version+1`
  );
  const batch = leads.map(lead => {
    const r = leadToRow(lead, profileId, source);
    // Batch saves are generated/cache refresh paths; manual notes are written by explicit patch helpers.
    r.notes = '';
    return stmt.bind(r.id, r.identity_key, r.profile_id, r.source, r.status, r.review_status, r.company, r.summary, r.product, r.score, r.grade, r.roi, r.sales_pitch, r.global_context, r.sources, r.notes, r.score_reason, r.urgency, r.urgency_reason, r.buyer_role, r.evidence, r.confidence, r.confidence_reason, r.assumptions, r.generation_mode, r.verification_status, r.data_gaps, r.event_type, r.created_at, r.updated_at);
  });
  await db.batch(batch);
}

export async function getLeadsByProfile(db, profileId, options = {}) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { status, limit = 100, offset = 0 } = options;
  let sql = 'SELECT * FROM leads WHERE profile_id = ?';
  const params = [profileId];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const { results } = await db.prepare(sql).bind(...params).all();
  const withManualHistory = await attachManualReviewNotesHistorySummaries(db, (results || []).map(rowToLead));
  return attachReviewerFeedbackSummaries(db, withManualHistory);
}

export async function getAllLeads(db, options = {}) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { status, limit = 500, offset = 0 } = options;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const { results } = await db.prepare(sql).bind(...params).all();
  const withManualHistory = await attachManualReviewNotesHistorySummaries(db, (results || []).map(rowToLead));
  return attachReviewerFeedbackSummaries(db, withManualHistory);
}

export async function getLeadById(db, id) {
  if (!db) return null;
  await ensureD1Schema(db);
  const row = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  const lead = rowToLead(row);
  if (!lead) return null;
  const manualSummary = await getManualReviewNotesHistorySummary(db, lead.id);
  const withManualSummary = withManualReviewNotesHistorySummary(lead, manualSummary);
  const feedback = await getReviewerFeedbackRecord(db, lead.id);
  const feedbackSummary = await getReviewerFeedbackHistorySummary(db, lead.id);
  return withReviewerFeedbackSummary(withManualSummary, feedback, feedbackSummary);
}

export async function updateLeadStatus(db, id, newStatus, fromStatus) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE leads SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?').bind(newStatus, now, id),
    db.prepare('INSERT INTO status_log (lead_id, from_status, to_status, changed_at) VALUES (?, ?, ?, ?)').bind(id, fromStatus, newStatus, now)
  ]);
  return true;
}

export async function updateLeadNotes(db, id, notes) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  const existingRow = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  const existingLead = rowToLead(existingRow);
  const eventType = existingLead && notes !== (existingLead.notes || '')
    ? classifyManualReviewNoteEvent(existingLead.notes, notes)
    : null;
  const statements = [
    db.prepare('UPDATE leads SET notes = ?, manual_review_notes_author_label = ?, manual_review_notes_updated_at = ?, updated_at = ?, version = version + 1 WHERE id = ?')
      .bind(notes, MANUAL_REVIEW_NOTES_AUTHOR_LABEL, now, now, id),
  ];
  if (eventType) {
    statements.push(
      db.prepare('INSERT INTO manual_review_note_events (lead_id, event_type, changed_at, author_label) VALUES (?, ?, ?, ?)')
        .bind(id, eventType, now, MANUAL_REVIEW_NOTES_AUTHOR_LABEL)
    );
  }
  await db.batch(statements);
  return true;
}

function readAliasedPatchValue(payload, field) {
  const aliases = REVIEWER_FEEDBACK_FIELD_ALIASES[field] || [field];
  const present = aliases.filter((key) => hasOwn(payload, key));
  if (present.length === 0) return { present: false, value: undefined };
  const firstValue = payload[present[0]];
  for (const key of present.slice(1)) {
    if (payload[key] !== firstValue) {
      throw Object.assign(new Error(`reviewerFeedback.${field} aliases must match when provided together.`), { status: 400 });
    }
  }
  return { present: true, value: firstValue };
}

function normalizeReviewerFeedbackEnum(field, value) {
  const text = String(value ?? '').trim().toLowerCase();
  const allowed = REVIEWER_FEEDBACK_ENUMS[field] || [];
  if (!allowed.includes(text)) {
    throw Object.assign(
      new Error(`reviewerFeedback.${field} must be one of: ${allowed.join(', ')}`),
      { status: 400 }
    );
  }
  return text;
}

function normalizeReviewerFeedbackText(field, value) {
  if (typeof value !== 'string') {
    throw Object.assign(new Error(`reviewerFeedback.${field} must be a string.`), { status: 400 });
  }
  const limit = field === 'feedbackText' ? 2000 : 500;
  return value.slice(0, limit);
}

function normalizeReviewerFeedbackPatch(lead, patch = {}) {
  const hasReviewerFeedback = hasOwn(patch, 'reviewerFeedback') || hasOwn(patch, 'reviewer_feedback');
  if (!hasReviewerFeedback) return null;

  const rawPayload = hasOwn(patch, 'reviewerFeedback') ? patch.reviewerFeedback : patch.reviewer_feedback;
  const current = normalizeReviewerFeedbackRecord(lead.reviewerFeedback || {});
  if (rawPayload === null) {
    return current.hasFeedback
      ? { changed: true, clear: true, eventType: 'clear', changedFields: ['clear'] }
      : { changed: false };
  }
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw Object.assign(new Error('reviewerFeedback must be an object or null.'), { status: 400 });
  }

  const nestedGeneratedField = GENERATED_REVIEW_NOTE_PATCH_FIELDS.find((field) => hasOwn(rawPayload, field));
  if (nestedGeneratedField) {
    throw Object.assign(
      new Error(`Generated reviewer note suggestions are copy-only and cannot be saved through reviewerFeedback.${nestedGeneratedField}.`),
      { status: 400 }
    );
  }

  const allowedKeys = new Set([
    'clear',
    ...Object.values(REVIEWER_FEEDBACK_FIELD_ALIASES).flat(),
  ]);
  const unknownKey = Object.keys(rawPayload).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    throw Object.assign(new Error(`reviewerFeedback.${unknownKey} is not supported.`), { status: 400 });
  }

  if (hasOwn(rawPayload, 'clear')) {
    if (rawPayload.clear !== true && rawPayload.clear !== false) {
      throw Object.assign(new Error('reviewerFeedback.clear must be true or false.'), { status: 400 });
    }
    if (rawPayload.clear === true) {
      return current.hasFeedback
        ? { changed: true, clear: true, eventType: 'clear', changedFields: ['clear'] }
        : { changed: false };
    }
  }

  const next = { ...REVIEWER_FEEDBACK_DEFAULTS, ...current };
  const changedFields = [];

  for (const field of REVIEWER_FEEDBACK_PATCH_FIELDS) {
    const { present, value } = readAliasedPatchValue(rawPayload, field);
    if (!present) continue;
    const normalizedValue = REVIEWER_FEEDBACK_ENUMS[field]
      ? normalizeReviewerFeedbackEnum(field, value)
      : normalizeReviewerFeedbackText(field, value);
    if (normalizedValue !== next[field]) {
      next[field] = normalizedValue;
      changedFields.push(field);
    }
  }

  if (changedFields.length === 0) return { changed: false };
  if (!reviewerFeedbackHasMeaningfulSignal(next) && !current.hasFeedback) return { changed: false };

  return {
    changed: true,
    clear: false,
    eventType: current.hasFeedback ? 'edit' : 'create',
    changedFields,
    feedback: {
      action_usefulness: next.actionUsefulness,
      outcome_label: next.outcomeLabel,
      data_gap_priority: next.dataGapPriority,
      evidence_confidence_adjustment: next.evidenceConfidenceAdjustment,
      feedback_text: next.feedbackText,
      next_reviewer_action: next.nextReviewerAction,
    },
  };
}

function normalizeLeadPatch(lead, patch) {
  const changedFields = [];
  const leadUpdates = {};
  let statusLogEntry = null;
  let manualReviewNotesChanged = false;
  let reviewerFeedbackChange = null;

  rejectGeneratedReviewNotePersistence(patch);

  if (patch.status && patch.status !== lead.status) {
    const allowed = VALID_TRANSITIONS[lead.status] || [];
    if (!allowed.includes(patch.status)) {
      const message = `상태 전환 불가: ${lead.status} → ${patch.status}. 허용: ${allowed.join(', ') || '없음'}`;
      throw Object.assign(new Error(message), { status: 400 });
    }
    leadUpdates.status = patch.status;
    statusLogEntry = { fromStatus: lead.status, toStatus: patch.status };
    changedFields.push('status');
  }

  const hasReviewStatus = hasOwn(patch, 'reviewStatus') || hasOwn(patch, 'review_status');
  if (hasReviewStatus) {
    const rawReviewStatus = hasOwn(patch, 'reviewStatus')
      ? patch.reviewStatus
      : patch.review_status;
    const reviewStatus = normalizeReviewStatus(rawReviewStatus, { fallback: '' });
    if (!REVIEW_STATUSES.includes(reviewStatus)) {
      throw Object.assign(new Error(`reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}`), { status: 400 });
    }
    if (reviewStatus !== lead.reviewStatus) {
      leadUpdates.review_status = reviewStatus;
      changedFields.push('reviewStatus');
    }
  }

  const hasManualReviewNotes = hasOwn(patch, 'manualReviewNotes') || hasOwn(patch, 'manual_review_notes');
  const hasLegacyNotes = hasOwn(patch, 'notes');
  if (hasManualReviewNotes || typeof patch.notes === 'string') {
    const rawManualReviewNotes = hasOwn(patch, 'manualReviewNotes')
      ? patch.manualReviewNotes
      : patch.manual_review_notes;
    if (hasManualReviewNotes && typeof rawManualReviewNotes !== 'string') {
      throw Object.assign(new Error('manualReviewNotes must be a string.'), { status: 400 });
    }
    if (
      hasManualReviewNotes
      && hasLegacyNotes
      && typeof patch.notes === 'string'
      && patch.notes !== rawManualReviewNotes
    ) {
      throw Object.assign(new Error('manualReviewNotes and notes must match when both are provided.'), { status: 400 });
    }

    const notes = (hasManualReviewNotes ? rawManualReviewNotes : patch.notes).slice(0, 2000);
    if (notes !== (lead.notes || '')) {
      leadUpdates.notes = notes;
      manualReviewNotesChanged = true;
      changedFields.push(hasManualReviewNotes ? 'manualReviewNotes' : 'notes');
    }
  }

  if (typeof patch.follow_up_date === 'string') {
    const dateVal = patch.follow_up_date.trim();
    if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      throw Object.assign(new Error('날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)'), { status: 400 });
    }
    if (dateVal) {
      const parsed = new Date(`${dateVal}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateVal) {
        throw Object.assign(new Error('유효하지 않은 날짜입니다.'), { status: 400 });
      }
    }
    if (dateVal !== (lead.followUpDate || '')) {
      leadUpdates.follow_up_date = dateVal;
      changedFields.push('follow_up_date');
    }
  }

  if (patch.estimated_value !== undefined) {
    const parsed = Number(patch.estimated_value);
    const estimatedValue = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    if (estimatedValue !== (lead.estimatedValue || 0)) {
      leadUpdates.estimated_value = estimatedValue;
      changedFields.push('estimated_value');
    }
  }

  reviewerFeedbackChange = normalizeReviewerFeedbackPatch(lead, patch);
  if (reviewerFeedbackChange?.changed) {
    changedFields.push('reviewerFeedback');
  }

  return { leadUpdates, statusLogEntry, changedFields, manualReviewNotesChanged, reviewerFeedbackChange };
}

export async function updateLeadPatchAtomic(db, lead, patch, { expectedVersion } = {}) {
  if (!db || !lead) return { lead, changedFields: [] };
  await ensureD1Schema(db);

  if (lead.version !== expectedVersion) {
    throw leadVersionConflict(lead.version);
  }

  const {
    leadUpdates,
    statusLogEntry,
    changedFields,
    manualReviewNotesChanged,
    reviewerFeedbackChange,
  } = normalizeLeadPatch(lead, patch);
  if (changedFields.length === 0) {
    const [casResult] = await db.batch([
      db.prepare('UPDATE leads SET version = version WHERE id = ? AND version = ?')
        .bind(lead.id, expectedVersion),
    ]);
    if ((casResult?.meta?.changes ?? 0) === 0) {
      const current = await getLeadById(db, lead.id);
      throw leadVersionConflict(current?.version);
    }
    return { lead, changedFields };
  }

  const now = new Date().toISOString();
  const nextVersion = expectedVersion + 1;
  const mutationId = `lead_patch_${globalThis.crypto.randomUUID()}`;
  if (manualReviewNotesChanged) {
    leadUpdates.manual_review_notes_author_label = MANUAL_REVIEW_NOTES_AUTHOR_LABEL;
    leadUpdates.manual_review_notes_updated_at = now;
  }
  const manualReviewNoteEventType = manualReviewNotesChanged
    ? classifyManualReviewNoteEvent(lead.notes, leadUpdates.notes)
    : null;
  const updateFields = Object.keys(leadUpdates);
  const setClause = [
    ...updateFields.map((field) => `${field} = ?`),
    'updated_at = ?',
    'version = version + 1',
    'last_patch_mutation_id = ?',
  ].join(', ');
  const updateValues = [
    ...updateFields.map((field) => leadUpdates[field]),
    now,
    mutationId,
    lead.id,
    expectedVersion,
  ];

  const statements = [
    db.prepare(`UPDATE leads SET ${setClause} WHERE id = ? AND version = ?`).bind(...updateValues),
  ];

  if (statusLogEntry) {
    statements.push(
      db.prepare(
        `INSERT INTO status_log (lead_id, from_status, to_status, changed_at)
         SELECT ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM leads WHERE id = ? AND version = ? AND last_patch_mutation_id = ?
         )`
      ).bind(
        lead.id, statusLogEntry.fromStatus, statusLogEntry.toStatus, now,
        lead.id, nextVersion, mutationId
      )
    );
  }

  if (manualReviewNoteEventType) {
    statements.push(
      db.prepare(
        `INSERT INTO manual_review_note_events (lead_id, event_type, changed_at, author_label)
         SELECT ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM leads WHERE id = ? AND version = ? AND last_patch_mutation_id = ?
         )`
      ).bind(
        lead.id, manualReviewNoteEventType, now, MANUAL_REVIEW_NOTES_AUTHOR_LABEL,
        lead.id, nextVersion, mutationId
      )
    );
  }

  if (reviewerFeedbackChange?.changed) {
    if (reviewerFeedbackChange.clear) {
      statements.push(
        db.prepare(
          `DELETE FROM reviewer_feedback
           WHERE lead_id = ?
             AND EXISTS (
               SELECT 1 FROM leads WHERE id = ? AND version = ? AND last_patch_mutation_id = ?
             )`
        ).bind(lead.id, lead.id, nextVersion, mutationId)
      );
    } else {
      const feedback = reviewerFeedbackChange.feedback;
      statements.push(
        db.prepare(
          `INSERT INTO reviewer_feedback (lead_id, action_usefulness, outcome_label, data_gap_priority, evidence_confidence_adjustment, feedback_text, next_reviewer_action, author_label, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE EXISTS (
             SELECT 1 FROM leads WHERE id = ? AND version = ? AND last_patch_mutation_id = ?
           )
           ON CONFLICT(lead_id) DO UPDATE SET
             action_usefulness=excluded.action_usefulness,
             outcome_label=excluded.outcome_label,
             data_gap_priority=excluded.data_gap_priority,
             evidence_confidence_adjustment=excluded.evidence_confidence_adjustment,
             feedback_text=excluded.feedback_text,
             next_reviewer_action=excluded.next_reviewer_action,
             author_label=excluded.author_label,
             updated_at=excluded.updated_at`
        ).bind(
          lead.id,
          feedback.action_usefulness,
          feedback.outcome_label,
          feedback.data_gap_priority,
          feedback.evidence_confidence_adjustment,
          feedback.feedback_text,
          feedback.next_reviewer_action,
          MANUAL_REVIEW_NOTES_AUTHOR_LABEL,
          now,
          lead.id,
          nextVersion,
          mutationId
        )
      );
    }
    statements.push(
      db.prepare(
        `INSERT INTO reviewer_feedback_events (lead_id, event_type, changed_at, author_label, changed_fields)
         SELECT ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM leads WHERE id = ? AND version = ? AND last_patch_mutation_id = ?
         )`
      )
        .bind(
          lead.id,
          reviewerFeedbackChange.eventType,
          now,
          MANUAL_REVIEW_NOTES_AUTHOR_LABEL,
          JSON.stringify(reviewerFeedbackChange.changedFields || []),
          lead.id,
          nextVersion,
          mutationId
        )
    );
  }

  const [casResult] = await db.batch(statements);
  if ((casResult?.meta?.changes ?? 0) === 0) {
    const current = await getLeadById(db, lead.id);
    throw leadVersionConflict(current?.version);
  }
  const updatedLead = await getLeadById(db, lead.id);
  return { lead: updatedLead, changedFields };
}

export async function getStatusLogByLead(db, leadId) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { results } = await db.prepare(
    'SELECT * FROM status_log WHERE lead_id = ? ORDER BY changed_at ASC'
  ).bind(leadId).all();
  return (results || []).map(r => ({
    fromStatus: r.from_status, toStatus: r.to_status, changedAt: r.changed_at
  }));
}

export async function updateLeadEnrichment(db, id, enrichData, articleBody) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE leads SET
      enriched = 1,
      summary = ?, roi = ?, sales_pitch = ?, global_context = ?,
      article_body = ?, action_items = ?, key_figures = ?, pain_points = ?,
      meddic = ?, competitive = ?, buying_signals = ?,
      evidence = ?, assumptions = ?,
      enriched_at = ?, updated_at = ?, version = version + 1
    WHERE id = ?`
  ).bind(
    enrichData.summary || '', enrichData.roi || '', enrichData.salesPitch || '', enrichData.globalContext || '',
    articleBody || '', JSON.stringify(enrichData.actionItems || []), JSON.stringify(enrichData.keyFigures || []), JSON.stringify(enrichData.painPoints || []),
    JSON.stringify(enrichData.meddic || {}), JSON.stringify(enrichData.competitive || {}), JSON.stringify(enrichData.buyingSignals || []),
    JSON.stringify(enrichData.evidence || []), JSON.stringify(enrichData.assumptions || []),
    now, now, id
  ).run();
  return true;
}

export async function logAnalyticsRun(db, data) {
  if (!db) return;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO analytics (type, profile_id, company, industry, leads_count, articles_count, elapsed_sec, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(data.type, data.profileId || null, data.company || null, data.industry || null, data.leadsCount || 0, data.articlesCount || 0, data.elapsedSec || 0, data.ipHash || null, now).run();
}

function buildExecutiveSummary(metrics) {
  const { total, gradeA, active, won, conversionRate, totalPipelineValue, followUpAlerts,
    monthlyNewCount, pipelineVelocity, winLossAnalysis, businessCaseInsights } = metrics;
  const gradeARatio = total > 0 ? Math.round((gradeA / total) * 100) : 0;
  const overdueCount = (followUpAlerts || []).filter(a => a.isOverdue).length;

  const lines = [];
  lines.push(`총 ${total}건 리드 중 ${active}건 활성, A등급 비율 ${gradeARatio}%.`);
  if (monthlyNewCount > 0) lines.push(`이번 달 신규 ${monthlyNewCount}건 유입.`);
  if (totalPipelineValue > 0) lines.push(`파이프라인 총 가치 ${totalPipelineValue.toLocaleString()}만원.`);
  if (winLossAnalysis && (winLossAnalysis.wonCount + winLossAnalysis.lostCount) > 0) {
    lines.push(`수주율 ${winLossAnalysis.winRate}% (${winLossAnalysis.wonCount}건 수주 / ${winLossAnalysis.lostCount}건 실주).`);
  }
  if (pipelineVelocity && pipelineVelocity.avgDaysToClose > 0) {
    lines.push(`평균 수주 소요일 ${pipelineVelocity.avgDaysToClose}일.`);
  }

  const warnings = [];
  if (overdueCount > 0) warnings.push(`기한 초과 ${overdueCount}건`);
  if (pipelineVelocity && pipelineVelocity.bottleneckStage) {
    warnings.push(`${pipelineVelocity.bottleneckStage} 단계 병목 (${pipelineVelocity.bottleneckDays}일)`);
  }
  if (businessCaseInsights && businessCaseInsights.enrichmentRate < 50) {
    warnings.push(`Enrichment 커버리지 ${businessCaseInsights.enrichmentRate}%`);
  }
  if (warnings.length > 0) lines.push(`⚠ 주의: ${warnings.join(', ')}.`);

  return {
    text: lines.join(' '),
    highlights: { totalCount: total, active, gradeARatio, monthlyNewCount, totalPipelineValue, conversionRate, overdueCount }
  };
}

export async function getDashboardMetrics(db, profileId) {
  if (!db) return null;
  await ensureD1Schema(db);
  const isAll = !profileId || profileId === 'all';
  const where = isAll ? '' : ' WHERE profile_id = ?';
  const bind = isAll ? [] : [profileId];

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  const [total, gradeA, statusCounts, wonCount, recentActivity, analyticsCounts, allLogs, pipelineValue, followUpLeads,
    monthlyNew, wonDetails, lostDetails, enrichCoverage, activeEnriched] = await db.batch([
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where}`).bind(...bind),
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} grade = 'A'`).bind(...bind),
    db.prepare(`SELECT status, COUNT(*) as cnt FROM leads${where} GROUP BY status`).bind(...bind),
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} status = 'WON'`).bind(...bind),
    db.prepare(`SELECT sl.from_status, sl.to_status, sl.changed_at, l.company FROM status_log sl JOIN leads l ON sl.lead_id = l.id${isAll ? '' : ' WHERE l.profile_id = ?'} ORDER BY sl.changed_at DESC LIMIT 10`).bind(...bind),
    db.prepare(`SELECT type, COUNT(*) as cnt, SUM(leads_count) as total_leads FROM analytics${where ? ' WHERE profile_id = ?' : ''} GROUP BY type`).bind(...(isAll ? [] : [profileId])),
    db.prepare(`SELECT sl.lead_id, sl.from_status, sl.to_status, sl.changed_at FROM status_log sl JOIN leads l ON sl.lead_id = l.id${isAll ? '' : ' WHERE l.profile_id = ?'} ORDER BY sl.changed_at ASC`).bind(...bind),
    db.prepare(`SELECT status, SUM(estimated_value) as total_value FROM leads${where} GROUP BY status`).bind(...bind),
    db.prepare(`SELECT id, company, follow_up_date, status FROM leads${where ? where + ' AND' : ' WHERE'} follow_up_date != '' AND follow_up_date <= ? AND status NOT IN ('WON','LOST') ORDER BY follow_up_date ASC LIMIT 20`).bind(...bind, tomorrow),
    // Q10: 이번 달 신규 리드
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} created_at >= ?`).bind(...bind, monthStart),
    // Q11: WON 리드 상세
    db.prepare(`SELECT id, grade, estimated_value, created_at, (SELECT MAX(changed_at) FROM status_log WHERE lead_id=l.id AND to_status='WON') as won_at FROM leads l${where ? where + ' AND' : ' WHERE'} status='WON'`).bind(...bind),
    // Q12: LOST 리드 상세
    db.prepare(`SELECT id, grade, estimated_value, created_at, (SELECT MAX(changed_at) FROM status_log WHERE lead_id=l.id AND to_status='LOST') as lost_at FROM leads l${where ? where + ' AND' : ' WHERE'} status='LOST'`).bind(...bind),
    // Q13: Enrichment 커버리지
    db.prepare(`SELECT COUNT(*) as total_enriched, SUM(CASE WHEN meddic != '{}' AND meddic != '' AND meddic IS NOT NULL THEN 1 ELSE 0 END) as has_meddic FROM leads${where ? where + ' AND' : ' WHERE'} enriched=1`).bind(...bind),
    // Q14: 활성 enriched 리드
    db.prepare(`SELECT pain_points, competitive, estimated_value, meddic FROM leads${where ? where + ' AND' : ' WHERE'} enriched=1 AND status NOT IN ('WON','LOST') LIMIT 200`).bind(...bind)
  ]);

  const totalCount = total.results?.[0]?.cnt || 0;
  const gradeACount = gradeA.results?.[0]?.cnt || 0;
  const wonCountVal = wonCount.results?.[0]?.cnt || 0;
  const statusDist = {};
  (statusCounts.results || []).forEach(r => { statusDist[r.status] = r.cnt; });
  const active = totalCount - (statusDist.WON || 0) - (statusDist.LOST || 0);

  const stageOrder = ['NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON'];
  const transitionCounts = {};
  (allLogs.results || []).forEach(r => {
    const key = `${r.from_status}→${r.to_status}`;
    transitionCounts[key] = (transitionCounts[key] || 0) + 1;
  });
  const stageConversions = [];
  for (let i = 0; i < stageOrder.length - 1; i++) {
    const from = stageOrder[i];
    const to = stageOrder[i + 1];
    const key = `${from}→${to}`;
    const fromCount = statusDist[from] || 0;
    const transitioned = transitionCounts[key] || 0;
    const denominator = fromCount + transitioned;
    stageConversions.push({
      from, to,
      rate: denominator > 0 ? Math.round((transitioned / denominator) * 100) : 0,
      count: transitioned
    });
  }

  const logList = allLogs.results || [];
  const dwellTimes = {};
  const dwellCounts = {};
  const lastEntryByLead = new Map();
  for (const log of logList) {
    const key = `${log.lead_id}:${log.from_status}`;
    const entryTime = lastEntryByLead.get(key);
    if (entryTime) {
      const days = Math.max(0, (new Date(log.changed_at) - new Date(entryTime)) / 86400000);
      dwellTimes[log.from_status] = (dwellTimes[log.from_status] || 0) + days;
      dwellCounts[log.from_status] = (dwellCounts[log.from_status] || 0) + 1;
    }
    lastEntryByLead.set(`${log.lead_id}:${log.to_status}`, log.changed_at);
  }
  const avgDwellDays = {};
  Object.keys(dwellTimes).forEach(s => {
    avgDwellDays[s] = dwellCounts[s] > 0 ? Math.round(dwellTimes[s] / dwellCounts[s] * 10) / 10 : 0;
  });

  const pipelineValueByStatus = {};
  let totalPipelineValue = 0;
  (pipelineValue.results || []).forEach(r => {
    const v = Number(r.total_value) || 0;
    pipelineValueByStatus[r.status] = v;
    if (r.status !== 'LOST') totalPipelineValue += v;
  });

  const followUpAlerts = (followUpLeads.results || []).map(r => ({
    id: r.id, company: r.company, followUpDate: r.follow_up_date, status: r.status,
    isOverdue: r.follow_up_date < today,
    isToday: r.follow_up_date === today
  }));

  const monthlyNewCount = monthlyNew.results?.[0]?.cnt || 0;

  // Pipeline Velocity
  const wonRows = wonDetails.results || [];
  const lostRows = lostDetails.results || [];
  let avgDaysToClose = 0, avgDaysToLoss = 0;
  if (wonRows.length > 0) {
    const totalDays = wonRows.reduce((sum, r) => {
      if (!r.won_at || !r.created_at) return sum;
      return sum + Math.max(0, (new Date(r.won_at) - new Date(r.created_at)) / 86400000);
    }, 0);
    avgDaysToClose = Math.round(totalDays / wonRows.length * 10) / 10;
  }
  if (lostRows.length > 0) {
    const totalDays = lostRows.reduce((sum, r) => {
      if (!r.lost_at || !r.created_at) return sum;
      return sum + Math.max(0, (new Date(r.lost_at) - new Date(r.created_at)) / 86400000);
    }, 0);
    avgDaysToLoss = Math.round(totalDays / lostRows.length * 10) / 10;
  }
  let bottleneckStage = null, bottleneckDays = 0;
  Object.entries(avgDwellDays).forEach(([stage, days]) => {
    if (days > bottleneckDays) { bottleneckStage = stage; bottleneckDays = days; }
  });
  const pipelineVelocity = { avgDaysToClose, avgDaysToLoss, bottleneckStage, bottleneckDays, closedCount: wonRows.length, lostCycleCount: lostRows.length };

  // Win-Loss Analysis
  const wonTotalValue = wonRows.reduce((s, r) => s + (Number(r.estimated_value) || 0), 0);
  const lostTotalValue = lostRows.reduce((s, r) => s + (Number(r.estimated_value) || 0), 0);
  const decidedCount = wonRows.length + lostRows.length;
  const wonByGrade = {};
  wonRows.forEach(r => { const g = r.grade || 'N/A'; wonByGrade[g] = (wonByGrade[g] || 0) + 1; });
  const winLossAnalysis = {
    wonCount: wonRows.length, lostCount: lostRows.length,
    winRate: decidedCount > 0 ? Math.round((wonRows.length / decidedCount) * 100) : 0,
    lossRate: decidedCount > 0 ? Math.round((lostRows.length / decidedCount) * 100) : 0,
    avgDealSizeWon: wonRows.length > 0 ? Math.round(wonTotalValue / wonRows.length) : 0,
    avgDealSizeLost: lostRows.length > 0 ? Math.round(lostTotalValue / lostRows.length) : 0,
    wonTotalValue, lostTotalValue, wonByGrade
  };

  // Business Case Insights
  const enrichRes = enrichCoverage.results?.[0] || {};
  const totalEnriched = enrichRes.total_enriched || 0;
  const enrichmentRate = totalCount > 0 ? Math.round((totalEnriched / totalCount) * 100) : 0;
  const meddicWithData = enrichRes.has_meddic || 0;
  const activeEnrichedRows = activeEnriched.results || [];
  const meddicFields = ['budget', 'authority', 'need', 'timeline', 'decisionProcess', 'champion'];
  let meddicCompleteCount = 0;
  const painFreq = {}, vendorFreq = {}, competitorFreq = {};
  let totalAddressableROI = 0;
  activeEnrichedRows.forEach(r => {
    totalAddressableROI += Number(r.estimated_value) || 0;
    // MEDDIC completeness
    try {
      const m = typeof r.meddic === 'string' ? JSON.parse(r.meddic || '{}') : (r.meddic || {});
      const filled = meddicFields.filter(f => m[f] && String(m[f]).trim().length > 0).length;
      if (filled === meddicFields.length) meddicCompleteCount++;
    } catch {}
    // Pain points frequency
    try {
      const pp = typeof r.pain_points === 'string' ? JSON.parse(r.pain_points || '[]') : (r.pain_points || []);
      (Array.isArray(pp) ? pp : []).forEach(p => { const k = String(p).trim(); if (k) painFreq[k] = (painFreq[k] || 0) + 1; });
    } catch {}
    // Competitive: current_vendor / competitors
    try {
      const c = typeof r.competitive === 'string' ? JSON.parse(r.competitive || '{}') : (r.competitive || {});
      if (c.currentVendor) { const k = String(c.currentVendor).trim(); if (k) vendorFreq[k] = (vendorFreq[k] || 0) + 1; }
      (Array.isArray(c.competitors) ? c.competitors : []).forEach(x => { const k = String(x).trim(); if (k) competitorFreq[k] = (competitorFreq[k] || 0) + 1; });
    } catch {}
  });
  const topN = (freq, n) => Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  const businessCaseInsights = {
    totalEnriched, enrichmentRate, meddicWithData, meddicCompleteCount,
    meddicCompletenessRate: totalEnriched > 0 ? Math.round((meddicCompleteCount / totalEnriched) * 100) : 0,
    totalAddressableROI, topPainPoints: topN(painFreq, 5), topVendors: topN(vendorFreq, 5), topCompetitors: topN(competitorFreq, 5)
  };

  // Executive Summary (depends on computed metrics above)
  const summaryInput = { total: totalCount, gradeA: gradeACount, active, won: wonCountVal, conversionRate: totalCount > 0 ? Math.round((wonCountVal / totalCount) * 100) : 0,
    totalPipelineValue, followUpAlerts, monthlyNewCount, pipelineVelocity, winLossAnalysis, businessCaseInsights };
  const executiveSummary = buildExecutiveSummary(summaryInput);

  return {
    total: totalCount,
    gradeA: gradeACount,
    won: wonCountVal,
    conversionRate: totalCount > 0 ? Math.round((wonCountVal / totalCount) * 100) : 0,
    active,
    statusDistribution: statusDist,
    stageConversions,
    avgDwellDays,
    totalPipelineValue,
    pipelineValueByStatus,
    followUpAlerts,
    recentActivity: (recentActivity.results || []).map(r => ({
      company: r.company, fromStatus: r.from_status, toStatus: r.to_status, changedAt: r.changed_at
    })),
    analyticsByType: (analyticsCounts.results || []).reduce((acc, r) => {
      acc[r.type] = { runs: r.cnt, totalLeads: r.total_leads }; return acc;
    }, {}),
    executiveSummary,
    pipelineVelocity,
    winLossAnalysis,
    businessCaseInsights,
    monthlyNewCount
  };
}
