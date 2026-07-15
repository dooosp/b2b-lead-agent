import { createHash } from 'node:crypto';

import { ensureD1Schema } from './schema.js';
import {
  withManualReviewNotesHistorySummary,
  withReviewerFeedbackSummary,
} from './leads.js';
import { leadToRow, rowToLead, sanitizeLeadText } from './transform.js';

export const PUBLISHED_ARTIFACT_KINDS = Object.freeze({
  latest: 'latest',
  history: 'history',
});

export const DEFAULT_PUBLISHED_SNAPSHOT_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_PUBLISHED_SNAPSHOT_MAX_STALE_MS = 24 * 60 * 60 * 1000;
export const PUBLISHED_SNAPSHOT_MAX_LEADS = Object.freeze({
  [PUBLISHED_ARTIFACT_KINDS.latest]: 90,
  [PUBLISHED_ARTIFACT_KINDS.history]: 500,
});
export const D1_MAX_STRING_OR_BLOB_BYTES = 2_000_000;
export const PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES = 1_900_000;
export const PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES = 1_950_000;
export const PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES = 8_000_000;
export const PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES = 64_000;
export const PUBLISHED_SNAPSHOT_MUTABLE_RAW_AGGREGATE_MAX_UTF8_BYTES = 1_000_000;
export const PUBLISHED_SNAPSHOT_MUTABLE_JSON_MAX_UTF8_BYTES = 512_000;
export const PUBLISHED_SNAPSHOT_MUTABLE_AGGREGATE_MAX_UTF8_BYTES = 4_000_000;
export const PUBLISHED_SNAPSHOT_CORRUPT_CODE = 'ERR_PUBLISHED_SNAPSHOT_CORRUPT';
export const PUBLISHED_SNAPSHOT_OVERLAY_LIMIT_CODE = 'ERR_PUBLISHED_SNAPSHOT_OVERLAY_LIMIT';

const D1_MAX_BIND_PARAMS = 100;
const LEAD_BIND_PARAMS = 30;
const ENTRY_BIND_PARAMS = 6;
const SNAPSHOT_ENTRY_ROW_FIXED_OVERHEAD_BYTES = 1024;
const PUBLISHED_SNAPSHOT_ID_MAX_UTF8_BYTES = 256;
const PUBLISHED_SNAPSHOT_PROFILE_ID_MAX_UTF8_BYTES = 256;
const PUBLISHED_SNAPSHOT_PROFILE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const UTF8_ENCODER = new TextEncoder();

const SNAPSHOT_PAYLOAD_FIELDS = Object.freeze([
  'id',
  'identityKey',
  'profileId',
  'source',
  'company',
  'signal',
  'summary',
  'product',
  'score',
  'grade',
  'roi',
  'salesPitch',
  'recommendedMessage',
  'globalContext',
  'whyNow',
  'sources',
  'scoreReason',
  'urgency',
  'urgencyReason',
  'buyerRole',
  'evidence',
  'confidence',
  'confidenceReason',
  'assumptions',
  'generationMode',
  'verificationStatus',
  'dataGaps',
  'eventType',
  'createdAt',
  'updatedAt',
]);

const SNAPSHOT_SOURCE_FIELDS = Object.freeze([
  'sourceId',
  'title',
  'url',
  'source',
  'query',
  'publishedAt',
  'originUrl',
  'resolution',
  'contentAvailable',
]);

const SNAPSHOT_EVIDENCE_FIELDS = Object.freeze(['field', 'quote', 'sourceUrl']);

const MUTABLE_LEAD_FIELDS = Object.freeze([
  'status',
  'reviewStatus',
  'notes',
  'manualReviewNotes',
  'manualReviewNotesProvenance',
  'manualReviewNotesAuthorLabel',
  'manualReviewNotesUpdatedAt',
  'manualReviewNotesHistoryEventCount',
  'manualReviewNotesHistoryLastEventType',
  'manualReviewNotesHistoryLastEventAt',
  'manualReviewNotesHistoryLastAuthorLabel',
  'reviewerFeedback',
  'followUpDate',
  'estimatedValue',
]);

const CURRENT_MUTABLE_LEAD_FIELDS = Object.freeze(['updatedAt', 'version']);

const CURRENT_ENRICHMENT_FIELDS = Object.freeze([
  'summary',
  'roi',
  'salesPitch',
  'recommendedMessage',
  'globalContext',
  'whyNow',
  'evidence',
  'assumptions',
  'enriched',
  'articleBody',
  'actionItems',
  'keyFigures',
  'painPoints',
  'meddic',
  'competitive',
  'buyingSignals',
  'enrichedAt',
]);

const LEAD_COLUMNS = Object.freeze([
  'id',
  'identity_key',
  'profile_id',
  'source',
  'status',
  'review_status',
  'company',
  'summary',
  'product',
  'score',
  'grade',
  'roi',
  'sales_pitch',
  'global_context',
  'sources',
  'notes',
  'score_reason',
  'urgency',
  'urgency_reason',
  'buyer_role',
  'evidence',
  'confidence',
  'confidence_reason',
  'assumptions',
  'generation_mode',
  'verification_status',
  'data_gaps',
  'event_type',
  'created_at',
  'updated_at',
]);

const LATEST_LEAD_CONFLICT_SQL = `ON CONFLICT(id) DO UPDATE SET
  identity_key=excluded.identity_key,
  profile_id=CASE
    WHEN leads.profile_id = excluded.profile_id THEN excluded.profile_id
    ELSE NULL
  END,
  source=excluded.source,
  company=excluded.company,
  summary=CASE WHEN COALESCE(leads.enriched, 0) = 1 THEN leads.summary ELSE excluded.summary END,
  product=excluded.product,
  score=excluded.score,
  grade=excluded.grade,
  roi=CASE WHEN COALESCE(leads.enriched, 0) = 1 THEN leads.roi ELSE excluded.roi END,
  sales_pitch=CASE WHEN COALESCE(leads.enriched, 0) = 1 THEN leads.sales_pitch ELSE excluded.sales_pitch END,
  global_context=CASE WHEN COALESCE(leads.enriched, 0) = 1 THEN leads.global_context ELSE excluded.global_context END,
  sources=excluded.sources,
  score_reason=excluded.score_reason,
  urgency=excluded.urgency,
  urgency_reason=excluded.urgency_reason,
  buyer_role=excluded.buyer_role,
  evidence=CASE WHEN COALESCE(leads.enriched, 0) = 1 THEN leads.evidence ELSE excluded.evidence END,
  confidence=excluded.confidence,
  confidence_reason=excluded.confidence_reason,
  assumptions=CASE WHEN COALESCE(leads.enriched, 0) = 1 THEN leads.assumptions ELSE excluded.assumptions END,
  generation_mode=excluded.generation_mode,
  verification_status=excluded.verification_status,
  data_gaps=excluded.data_gaps,
  event_type=excluded.event_type,
  version=leads.version+1`;

const MUTABLE_OVERLAY_SQL_FIELDS = Object.freeze([
  ['id', 'l.id', 'mutable_id'],
  ['profile_id', 'l.profile_id', 'mutable_profile_id'],
  ['status', 'l.status', 'mutable_status'],
  ['review_status', 'l.review_status', 'mutable_review_status'],
  ['notes', 'l.notes', 'mutable_notes'],
  ['manual_review_notes_author_label', 'l.manual_review_notes_author_label', 'mutable_manual_author'],
  ['manual_review_notes_updated_at', 'l.manual_review_notes_updated_at', 'mutable_manual_updated_at'],
  ['follow_up_date', 'l.follow_up_date', 'mutable_follow_up_date'],
  ['estimated_value', 'l.estimated_value', 'mutable_estimated_value'],
  ['version', "CASE WHEN e.artifact_kind = 'latest' THEN l.version ELSE NULL END", 'mutable_version'],
  ['updated_at', "CASE WHEN e.artifact_kind = 'latest' THEN l.updated_at ELSE NULL END", 'mutable_updated_at'],
  ['enriched', "CASE WHEN e.artifact_kind = 'latest' THEN l.enriched ELSE NULL END", 'mutable_enriched'],
  ['summary', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.summary ELSE NULL END", 'mutable_summary'],
  ['roi', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.roi ELSE NULL END", 'mutable_roi'],
  ['sales_pitch', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.sales_pitch ELSE NULL END", 'mutable_sales_pitch'],
  ['global_context', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.global_context ELSE NULL END", 'mutable_global_context'],
  ['urgency_reason', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.urgency_reason ELSE NULL END", 'mutable_urgency_reason'],
  ['evidence', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.evidence ELSE NULL END", 'mutable_evidence'],
  ['assumptions', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.assumptions ELSE NULL END", 'mutable_assumptions'],
  ['article_body', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.article_body ELSE NULL END", 'mutable_article_body'],
  ['action_items', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.action_items ELSE NULL END", 'mutable_action_items'],
  ['key_figures', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.key_figures ELSE NULL END", 'mutable_key_figures'],
  ['pain_points', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.pain_points ELSE NULL END", 'mutable_pain_points'],
  ['meddic', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.meddic ELSE NULL END", 'mutable_meddic'],
  ['competitive', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.competitive ELSE NULL END", 'mutable_competitive'],
  ['buying_signals', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.buying_signals ELSE NULL END", 'mutable_buying_signals'],
  ['enriched_at', "CASE WHEN e.artifact_kind = 'latest' AND COALESCE(l.enriched, 0) = 1 THEN l.enriched_at ELSE NULL END", 'mutable_enriched_at'],
  ['snapshot_feedback_lead_id', 'rf.lead_id', 'mutable_feedback_lead_id'],
  ['snapshot_feedback_action_usefulness', 'rf.action_usefulness', 'mutable_feedback_action_usefulness'],
  ['snapshot_feedback_outcome_label', 'rf.outcome_label', 'mutable_feedback_outcome_label'],
  ['snapshot_feedback_data_gap_priority', 'rf.data_gap_priority', 'mutable_feedback_data_gap_priority'],
  ['snapshot_feedback_confidence_adjustment', 'rf.evidence_confidence_adjustment', 'mutable_feedback_confidence_adjustment'],
  ['snapshot_feedback_text', 'rf.feedback_text', 'mutable_feedback_text'],
  ['snapshot_feedback_next_action', 'rf.next_reviewer_action', 'mutable_feedback_next_action'],
  ['snapshot_feedback_author_label', 'rf.author_label', 'mutable_feedback_author_label'],
  ['snapshot_feedback_updated_at', 'rf.updated_at', 'mutable_feedback_updated_at'],
  ['snapshot_manual_event_count', '(SELECT COUNT(*) FROM manual_review_note_events mn_count WHERE mn_count.lead_id = l.id)', 'mutable_manual_event_count'],
  ['snapshot_manual_last_event_type', '(SELECT mn_last.event_type FROM manual_review_note_events mn_last WHERE mn_last.lead_id = l.id ORDER BY mn_last.changed_at DESC, mn_last.id DESC LIMIT 1)', 'mutable_manual_last_event_type'],
  ['snapshot_manual_last_event_at', '(SELECT mn_last.changed_at FROM manual_review_note_events mn_last WHERE mn_last.lead_id = l.id ORDER BY mn_last.changed_at DESC, mn_last.id DESC LIMIT 1)', 'mutable_manual_last_event_at'],
  ['snapshot_manual_last_author_label', '(SELECT mn_last.author_label FROM manual_review_note_events mn_last WHERE mn_last.lead_id = l.id ORDER BY mn_last.changed_at DESC, mn_last.id DESC LIMIT 1)', 'mutable_manual_last_author_label'],
  ['snapshot_feedback_event_count', '(SELECT COUNT(*) FROM reviewer_feedback_events rf_count WHERE rf_count.lead_id = l.id)', 'mutable_feedback_event_count'],
  ['snapshot_feedback_last_event_type', '(SELECT rf_last.event_type FROM reviewer_feedback_events rf_last WHERE rf_last.lead_id = l.id ORDER BY rf_last.changed_at DESC, rf_last.id DESC LIMIT 1)', 'mutable_feedback_last_event_type'],
  ['snapshot_feedback_last_event_at', '(SELECT rf_last.changed_at FROM reviewer_feedback_events rf_last WHERE rf_last.lead_id = l.id ORDER BY rf_last.changed_at DESC, rf_last.id DESC LIMIT 1)', 'mutable_feedback_last_event_at'],
  ['snapshot_feedback_last_author_label', '(SELECT rf_last.author_label FROM reviewer_feedback_events rf_last WHERE rf_last.lead_id = l.id ORDER BY rf_last.changed_at DESC, rf_last.id DESC LIMIT 1)', 'mutable_feedback_last_author_label'],
]);

const MUTABLE_OVERLAY_RAW_BYTES_SQL = MUTABLE_OVERLAY_SQL_FIELDS
  .map(([, expression]) => `length(CAST(COALESCE(${expression}, '') AS BLOB))`)
  .join(' + ');
const MUTABLE_OVERLAY_JSON_SQL = `json_object(${MUTABLE_OVERLAY_SQL_FIELDS
  .flatMap(([key, expression]) => [`'${key}'`, expression])
  .join(', ')})`;

const SNAPSHOT_READ_SQL = `WITH selected_head AS (
  SELECT profile_id, artifact_kind, snapshot_id, fetched_at
  FROM published_snapshot_heads
  WHERE profile_id = ? AND artifact_kind = ?
), entry_measurements AS (
  SELECT
    e.*,
    ? AS max_entries,
    length(CAST(e.payload_json AS BLOB)) AS payload_bytes,
    ${SNAPSHOT_ENTRY_ROW_FIXED_OVERHEAD_BYTES}
      + length(CAST(e.profile_id AS BLOB))
      + length(CAST(e.artifact_kind AS BLOB))
      + length(CAST(e.snapshot_id AS BLOB))
      + length(CAST(e.lead_id AS BLOB))
      + length(CAST(e.payload_json AS BLOB)) AS persisted_row_bytes
  FROM published_snapshot_entries e
  JOIN selected_head h
    ON h.profile_id = e.profile_id
    AND h.artifact_kind = e.artifact_kind
    AND h.snapshot_id = e.snapshot_id
), selected_entries AS (
  SELECT
    m.*,
    SUM(m.payload_bytes) OVER () AS aggregate_payload_bytes,
    COUNT(*) OVER () AS entry_count,
    MAX(m.payload_bytes) OVER () AS max_payload_bytes,
    MAX(m.persisted_row_bytes) OVER () AS max_persisted_row_bytes
  FROM entry_measurements m
  ORDER BY m.ordinal ASC
  LIMIT ?
), overlay_sizes AS (
  SELECT
    e.*,
    CASE WHEN collision_lead.id IS NULL THEN 0 ELSE 1 END AS profile_collision,
    CASE
      WHEN e.entry_count <= e.max_entries
        AND e.max_payload_bytes <= ${PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES}
        AND e.aggregate_payload_bytes <= ${PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES}
        AND e.max_persisted_row_bytes <= ${PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES}
      THEN ${MUTABLE_OVERLAY_RAW_BYTES_SQL}
      ELSE 0
    END AS mutable_raw_bytes
  FROM selected_entries e
  LEFT JOIN leads l ON l.id = e.lead_id AND l.profile_id = e.profile_id
  LEFT JOIN leads collision_lead
    ON collision_lead.id = e.lead_id AND collision_lead.profile_id <> e.profile_id
  LEFT JOIN reviewer_feedback rf ON rf.lead_id = l.id
), bounded_overlay_sizes AS (
  SELECT
    s.*,
    MAX(s.profile_collision) OVER () AS profile_collision_count,
    MAX(s.mutable_raw_bytes) OVER () AS max_mutable_raw_bytes,
    SUM(s.mutable_raw_bytes) OVER () AS aggregate_mutable_raw_bytes
  FROM overlay_sizes s
), overlay_candidates AS (
  SELECT
    e.*,
    CASE
      WHEN l.id IS NOT NULL
        AND e.entry_count <= e.max_entries
        AND e.max_payload_bytes <= ${PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES}
        AND e.aggregate_payload_bytes <= ${PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES}
        AND e.max_persisted_row_bytes <= ${PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES}
        AND e.profile_collision_count = 0
        AND e.max_mutable_raw_bytes <= ${PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES}
        AND e.aggregate_mutable_raw_bytes <= ${PUBLISHED_SNAPSHOT_MUTABLE_RAW_AGGREGATE_MAX_UTF8_BYTES}
      THEN ${MUTABLE_OVERLAY_JSON_SQL}
      ELSE NULL
    END AS mutable_json
  FROM bounded_overlay_sizes e
  LEFT JOIN leads l ON l.id = e.lead_id AND l.profile_id = e.profile_id
  LEFT JOIN reviewer_feedback rf ON rf.lead_id = l.id
), overlay_measurements AS (
  SELECT
    c.*,
    length(CAST(COALESCE(c.mutable_json, '') AS BLOB)) AS mutable_json_bytes
  FROM overlay_candidates c
), bounded_entries AS (
  SELECT
    m.*,
    MAX(m.mutable_json_bytes) OVER () AS max_mutable_json_bytes,
    SUM(m.mutable_json_bytes) OVER () AS aggregate_mutable_json_bytes
  FROM overlay_measurements m
)
SELECT
  h.snapshot_id AS snapshot_head_id,
  h.fetched_at AS snapshot_fetched_at,
  e.lead_id AS snapshot_entry_lead_id,
  CASE
    WHEN e.entry_count <= e.max_entries
      AND e.max_payload_bytes <= ${PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES}
      AND e.aggregate_payload_bytes <= ${PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES}
      AND e.max_persisted_row_bytes <= ${PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES}
      AND e.profile_collision_count = 0
    THEN e.payload_json
    ELSE NULL
  END AS snapshot_payload_json,
  e.payload_bytes AS snapshot_payload_bytes,
  e.max_payload_bytes AS snapshot_max_payload_bytes,
  e.persisted_row_bytes AS snapshot_persisted_row_bytes,
  e.max_persisted_row_bytes AS snapshot_max_persisted_row_bytes,
  e.aggregate_payload_bytes AS snapshot_aggregate_payload_bytes,
  e.entry_count AS snapshot_entry_count,
  e.ordinal AS snapshot_entry_ordinal,
  e.profile_collision_count AS snapshot_profile_collision_count,
  e.max_mutable_raw_bytes AS snapshot_max_mutable_raw_bytes,
  e.aggregate_mutable_raw_bytes AS snapshot_aggregate_mutable_raw_bytes,
  e.max_mutable_json_bytes AS snapshot_max_mutable_json_bytes,
  e.aggregate_mutable_json_bytes AS snapshot_aggregate_mutable_json_bytes,
  CASE
    WHEN e.entry_count <= e.max_entries
      AND e.max_payload_bytes <= ${PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES}
      AND e.aggregate_payload_bytes <= ${PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES}
      AND e.max_persisted_row_bytes <= ${PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES}
      AND e.profile_collision_count = 0
      AND e.max_mutable_raw_bytes <= ${PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES}
      AND e.aggregate_mutable_raw_bytes <= ${PUBLISHED_SNAPSHOT_MUTABLE_RAW_AGGREGATE_MAX_UTF8_BYTES}
      AND e.max_mutable_json_bytes <= ${PUBLISHED_SNAPSHOT_MUTABLE_JSON_MAX_UTF8_BYTES}
      AND e.aggregate_mutable_json_bytes <= ${PUBLISHED_SNAPSHOT_MUTABLE_AGGREGATE_MAX_UTF8_BYTES}
    THEN e.mutable_json
    ELSE NULL
  END AS snapshot_mutable_json,
  e.mutable_json_bytes AS snapshot_mutable_json_bytes
FROM selected_head h
LEFT JOIN bounded_entries e ON 1 = 1
ORDER BY e.ordinal ASC`;

function assertArtifactKind(artifactKind) {
  if (!Object.values(PUBLISHED_ARTIFACT_KINDS).includes(artifactKind)) {
    throw new TypeError(`Unsupported published artifact kind: ${artifactKind}`);
  }
}

export function assertPublishedSnapshotSize(artifactKind, leads) {
  assertArtifactKind(artifactKind);
  if (!Array.isArray(leads)) throw new TypeError('Published lead artifact must be a JSON array');
  const limit = PUBLISHED_SNAPSHOT_MAX_LEADS[artifactKind];
  if (leads.length > limit) {
    throw Object.assign(
      new RangeError(`Published ${artifactKind} artifact exceeds the supported ${limit}-lead limit`),
      { code: 'ERR_PUBLISHED_SNAPSHOT_LIMIT' }
    );
  }
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, stableJsonValue(value[key])])
  );
}

function stableStringify(value) {
  return JSON.stringify(stableJsonValue(value));
}

function utf8ByteLength(value) {
  return UTF8_ENCODER.encode(String(value || '')).byteLength;
}

function copyJsonValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isWellFormedUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function normalizePublishedProfileId(profileId) {
  if (typeof profileId !== 'string') {
    throw new TypeError('Published snapshot profile id must be a string');
  }
  const normalized = profileId.trim();
  const bytes = utf8ByteLength(normalized);
  if (
    !normalized
    || normalized !== profileId
    || normalized === '.'
    || normalized === '..'
    || !isWellFormedUnicode(normalized)
    || !PUBLISHED_SNAPSHOT_PROFILE_ID_RE.test(normalized)
    || /[\\/?#%]/u.test(normalized)
    || /[\u0000-\u001f\u007f]/u.test(normalized)
    || bytes > PUBLISHED_SNAPSHOT_PROFILE_ID_MAX_UTF8_BYTES
  ) {
    throw new TypeError(
      'Published snapshot profile id must be one safe non-dot report path segment and at most '
      + `${PUBLISHED_SNAPSHOT_PROFILE_ID_MAX_UTF8_BYTES} UTF-8 bytes`
    );
  }
  return normalized;
}

export function normalizePublishedLeadId(leadId) {
  if (typeof leadId !== 'string') {
    throw new TypeError('Published snapshot lead id must be a string');
  }
  const normalized = sanitizeLeadText(leadId, '');
  const bytes = utf8ByteLength(normalized);
  if (
    !normalized
    || normalized === '.'
    || normalized === '..'
    || !isWellFormedUnicode(normalized)
    || /[\\/?#%]/u.test(normalized)
    || /[\u0000-\u001f\u007f]/u.test(normalized)
    || bytes > PUBLISHED_SNAPSHOT_ID_MAX_UTF8_BYTES
  ) {
    throw new TypeError(
      'Published snapshot lead id must be one route-safe non-dot segment and at most '
      + `${PUBLISHED_SNAPSHOT_ID_MAX_UTF8_BYTES} UTF-8 bytes`
    );
  }
  return normalized;
}

function projectObjectFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const projected = {};
  for (const field of fields) {
    const item = value[field];
    if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) {
      projected[field] = item;
    }
  }
  return projected;
}

export function toSafePublishedSnapshotLead(lead = {}) {
  const payload = {};
  for (const field of SNAPSHOT_PAYLOAD_FIELDS) {
    const value = lead[field];
    if (field === 'sources') {
      payload.sources = (Array.isArray(value) ? value : [])
        .map((source) => projectObjectFields(source, SNAPSHOT_SOURCE_FIELDS))
        .filter(Boolean);
    } else if (field === 'evidence') {
      payload.evidence = (Array.isArray(value) ? value : [])
        .map((item) => projectObjectFields(item, SNAPSHOT_EVIDENCE_FIELDS))
        .filter(Boolean);
    } else if (field === 'assumptions' || field === 'dataGaps') {
      payload[field] = (Array.isArray(value) ? value : [])
        .filter((item) => typeof item === 'string');
    } else if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      payload[field] = value;
    }
  }
  return payload;
}

function projectSnapshotLeads(profileId, leads) {
  const normalizedProfileId = normalizePublishedProfileId(profileId);
  return leads.map((lead) => ({
    ...toSafePublishedSnapshotLead(lead),
    id: normalizePublishedLeadId(lead?.id),
    profileId: normalizedProfileId,
    source: 'managed',
  }));
}

export function publishedSnapshotEntryRowUtf8Bytes({
  profileId,
  artifactKind,
  snapshotId = '0'.repeat(64),
  leadId,
  payloadJson,
}) {
  return SNAPSHOT_ENTRY_ROW_FIXED_OVERHEAD_BYTES
    + utf8ByteLength(profileId)
    + utf8ByteLength(artifactKind)
    + utf8ByteLength(snapshotId)
    + utf8ByteLength(leadId)
    + utf8ByteLength(payloadJson);
}

function preparePublishedSnapshotPayloads(profileId, artifactKind, leads) {
  assertPublishedSnapshotSize(artifactKind, leads);
  const safeLeads = projectSnapshotLeads(profileId, leads);
  const uniqueLeadIds = new Set(safeLeads.map((lead) => lead.id));
  if (uniqueLeadIds.size !== safeLeads.length) {
    throw new TypeError('Published snapshot lead ids must be unique');
  }
  const serializedEntries = safeLeads.map((lead) => stableStringify(lead));
  const entryBytes = serializedEntries.map(utf8ByteLength);
  const oversizedIndex = entryBytes.findIndex(
    (bytes) => bytes > PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES
  );
  if (oversizedIndex >= 0) {
    throw Object.assign(
      new RangeError(
        `Published ${artifactKind} snapshot entry ${oversizedIndex} exceeds the `
        + `${PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES}-byte UTF-8 payload limit`
      ),
      { code: 'ERR_PUBLISHED_SNAPSHOT_ENTRY_BYTES' }
    );
  }

  const totalBytes = entryBytes.reduce((total, bytes) => total + bytes, 0);
  if (totalBytes > PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES) {
    throw Object.assign(
      new RangeError(
        `Published ${artifactKind} snapshot exceeds the `
        + `${PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES}-byte aggregate UTF-8 payload limit`
      ),
      { code: 'ERR_PUBLISHED_SNAPSHOT_ARTIFACT_BYTES' }
    );
  }

  const entryRowBytes = safeLeads.map((lead, index) => publishedSnapshotEntryRowUtf8Bytes({
    profileId: lead.profileId,
    artifactKind,
    leadId: lead.id,
    payloadJson: serializedEntries[index],
  }));
  const oversizedRowIndex = entryRowBytes.findIndex(
    (bytes) => bytes > PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES
  );
  if (oversizedRowIndex >= 0) {
    throw Object.assign(
      new RangeError(
        `Published ${artifactKind} snapshot entry row ${oversizedRowIndex} exceeds the `
        + `${PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES}-byte persisted-row budget`
      ),
      { code: 'ERR_PUBLISHED_SNAPSHOT_ENTRY_ROW_BYTES' }
    );
  }

  return {
    profileId: safeLeads[0]?.profileId || normalizePublishedProfileId(profileId),
    safeLeads,
    serializedEntries,
    entryBytes,
    entryRowBytes,
    totalBytes,
  };
}

export function publishedSnapshotPayloadUtf8Bytes(profileId, lead) {
  return utf8ByteLength(stableStringify(projectSnapshotLeads(profileId, [lead])[0]));
}

export function assertPublishedSnapshotPayloadBytes(profileId, artifactKind, leads) {
  const { entryBytes, entryRowBytes, totalBytes } = preparePublishedSnapshotPayloads(
    profileId,
    artifactKind,
    leads
  );
  return { entryBytes, entryRowBytes, totalBytes };
}

function computePublishedSnapshotIdFromSafeLeads(profileId, artifactKind, safeLeads) {
  const payload = {
    profileId: String(profileId || ''),
    artifactKind,
    leads: safeLeads,
  };
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export function computePublishedSnapshotId(profileId, artifactKind, leads = []) {
  const prepared = preparePublishedSnapshotPayloads(profileId, artifactKind, leads);
  return computePublishedSnapshotIdFromSafeLeads(
    prepared.profileId,
    artifactKind,
    prepared.safeLeads
  );
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function leadBindValues(row) {
  return [
    row.id,
    row.identity_key,
    row.profile_id,
    row.source,
    row.status,
    row.review_status,
    row.company,
    row.summary,
    row.product,
    row.score,
    row.grade,
    row.roi,
    row.sales_pitch,
    row.global_context,
    row.sources,
    '',
    row.score_reason,
    row.urgency,
    row.urgency_reason,
    row.buyer_role,
    row.evidence,
    row.confidence,
    row.confidence_reason,
    row.assumptions,
    row.generation_mode,
    row.verification_status,
    row.data_gaps,
    row.event_type,
    row.created_at,
    row.updated_at,
  ];
}

function buildLatestLeadUpsertStatements(db, leads, profileId) {
  const rows = leads.map((lead) => leadToRow(lead, profileId, 'managed'));
  const rowsPerStatement = Math.floor(D1_MAX_BIND_PARAMS / LEAD_BIND_PARAMS);
  const rowPlaceholder = `(${Array(LEAD_BIND_PARAMS).fill('?').join(', ')})`;
  return chunk(rows, rowsPerStatement).map((rowChunk) => db.prepare(
    `INSERT INTO leads (${LEAD_COLUMNS.join(', ')})
     VALUES ${rowChunk.map(() => rowPlaceholder).join(', ')}
     ${LATEST_LEAD_CONFLICT_SQL}`
  ).bind(...rowChunk.flatMap(leadBindValues)));
}

function buildProfileCollisionGuardStatements(db, leads, profileId) {
  const idsPerStatement = D1_MAX_BIND_PARAMS - 1;
  return chunk(leads.map((lead) => lead.id), idsPerStatement).map((leadIds) => db.prepare(
    `UPDATE leads SET profile_id = NULL
     WHERE profile_id <> ? AND id IN (${leadIds.map(() => '?').join(', ')})`
  ).bind(profileId, ...leadIds));
}

function buildSnapshotEntryStatements(
  db,
  safeLeads,
  serializedEntries,
  profileId,
  artifactKind,
  snapshotId
) {
  const entriesPerStatement = Math.floor(D1_MAX_BIND_PARAMS / ENTRY_BIND_PARAMS);
  const entryPlaceholder = `(${Array(ENTRY_BIND_PARAMS).fill('?').join(', ')})`;
  const entries = safeLeads.map((lead, ordinal) => [
    profileId,
    artifactKind,
    snapshotId,
    ordinal,
    lead.id,
    serializedEntries[ordinal],
  ]);
  return chunk(entries, entriesPerStatement).map((entryChunk) => db.prepare(
    `INSERT INTO published_snapshot_entries
     (profile_id, artifact_kind, snapshot_id, ordinal, lead_id, payload_json)
     VALUES ${entryChunk.map(() => entryPlaceholder).join(', ')}`
  ).bind(...entryChunk.flat()));
}

function parseSnapshotPayload(payloadJson) {
  let parsed;
  try {
    parsed = JSON.parse(String(payloadJson || ''));
  } catch (cause) {
    const error = new Error('Published snapshot entry payload is not valid JSON');
    error.code = PUBLISHED_SNAPSHOT_CORRUPT_CODE;
    error.cause = cause;
    throw error;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new Error('Published snapshot entry payload must be a JSON object');
    error.code = PUBLISHED_SNAPSHOT_CORRUPT_CODE;
    throw error;
  }
  return parsed;
}

function snapshotCorrupt(message, cause) {
  const error = new Error(message);
  error.code = PUBLISHED_SNAPSHOT_CORRUPT_CODE;
  if (cause) error.cause = cause;
  return error;
}

function snapshotOverlayLimit(message, cause) {
  const error = new Error(message);
  error.code = PUBLISHED_SNAPSHOT_OVERLAY_LIMIT_CODE;
  if (cause) error.cause = cause;
  return error;
}

function mutableLeadFromJoinedRow(row, profileId) {
  if (!row?.snapshot_mutable_json) return null;
  const rawMutableJson = String(row.snapshot_mutable_json);
  const mutableJsonBytes = utf8ByteLength(rawMutableJson);
  if (
    mutableJsonBytes !== Number(row.snapshot_mutable_json_bytes)
    || mutableJsonBytes > PUBLISHED_SNAPSHOT_MUTABLE_JSON_MAX_UTF8_BYTES
  ) {
    throw snapshotOverlayLimit('Published snapshot mutable overlay byte metadata is invalid');
  }
  let mutableRow;
  try {
    mutableRow = JSON.parse(rawMutableJson);
  } catch (cause) {
    throw snapshotOverlayLimit('Published snapshot mutable overlay is not valid JSON', cause);
  }
  if (!mutableRow || typeof mutableRow !== 'object' || Array.isArray(mutableRow)) {
    throw snapshotOverlayLimit('Published snapshot mutable overlay must be a JSON object');
  }
  if (!mutableRow.id || mutableRow.profile_id !== profileId) {
    throw snapshotOverlayLimit('Published snapshot mutable overlay ownership is invalid');
  }

  const baseLead = rowToLead(mutableRow);
  const withManualHistory = withManualReviewNotesHistorySummary(baseLead, {
    eventCount: mutableRow.snapshot_manual_event_count,
    lastEventType: mutableRow.snapshot_manual_last_event_type,
    lastEventAt: mutableRow.snapshot_manual_last_event_at,
    lastAuthorLabel: mutableRow.snapshot_manual_last_author_label,
  });
  const feedbackRecord = mutableRow.snapshot_feedback_lead_id
    ? {
      lead_id: mutableRow.snapshot_feedback_lead_id,
      action_usefulness: mutableRow.snapshot_feedback_action_usefulness,
      outcome_label: mutableRow.snapshot_feedback_outcome_label,
      data_gap_priority: mutableRow.snapshot_feedback_data_gap_priority,
      evidence_confidence_adjustment: mutableRow.snapshot_feedback_confidence_adjustment,
      feedback_text: mutableRow.snapshot_feedback_text,
      next_reviewer_action: mutableRow.snapshot_feedback_next_action,
      author_label: mutableRow.snapshot_feedback_author_label,
      updated_at: mutableRow.snapshot_feedback_updated_at,
    }
    : null;
  return withReviewerFeedbackSummary(withManualHistory, feedbackRecord, {
    eventCount: mutableRow.snapshot_feedback_event_count,
    lastEventType: mutableRow.snapshot_feedback_last_event_type,
    lastEventAt: mutableRow.snapshot_feedback_last_event_at,
    lastAuthorLabel: mutableRow.snapshot_feedback_last_author_label,
  });
}

function overlayMutableLeadState(snapshotLead, mutableLead, artifactKind) {
  const merged = {
    status: 'NEW',
    reviewStatus: 'NEEDS_REVIEW',
    notes: '',
    manualReviewNotes: '',
    manualReviewNotesProvenance: '',
    manualReviewNotesAuthorLabel: '',
    manualReviewNotesUpdatedAt: null,
    manualReviewNotesHistoryEventCount: 0,
    manualReviewNotesHistoryLastEventType: '',
    manualReviewNotesHistoryLastEventAt: null,
    manualReviewNotesHistoryLastAuthorLabel: '',
    reviewerFeedback: {
      hasFeedback: false,
      actionUsefulness: 'unclear',
      outcomeLabel: 'unknown',
      dataGapPriority: 'none',
      evidenceConfidenceAdjustment: 'unknown',
      feedbackText: '',
      nextReviewerAction: '',
      authorLabel: '',
      updatedAt: null,
      historyEventCount: 0,
      historyLastEventType: '',
      historyLastEventAt: null,
      historyLastAuthorLabel: '',
    },
    followUpDate: '',
    estimatedValue: 0,
    ...snapshotLead,
  };
  if (!mutableLead) return merged;
  for (const field of MUTABLE_LEAD_FIELDS) {
    if (mutableLead[field] !== undefined) merged[field] = copyJsonValue(mutableLead[field]);
  }
  if (artifactKind === PUBLISHED_ARTIFACT_KINDS.latest) {
    for (const field of CURRENT_MUTABLE_LEAD_FIELDS) {
      if (mutableLead[field] !== undefined) merged[field] = copyJsonValue(mutableLead[field]);
    }
  }
  if (artifactKind === PUBLISHED_ARTIFACT_KINDS.latest && mutableLead.enriched) {
    for (const field of CURRENT_ENRICHMENT_FIELDS) {
      if (mutableLead[field] !== undefined) merged[field] = copyJsonValue(mutableLead[field]);
    }
  }
  return merged;
}

export function toPublishedSnapshotResponseLead(lead, { profileId, artifactKind }) {
  const payload = projectSnapshotLeads(profileId, [lead])[0];
  return overlayMutableLeadState(payload, null, artifactKind);
}

export async function savePublishedSnapshot(
  db,
  { profileId, artifactKind, leads = [], fetchedAt = new Date().toISOString() }
) {
  if (!db) throw new TypeError('D1 database is required');
  const prepared = preparePublishedSnapshotPayloads(
    profileId,
    artifactKind,
    leads
  );
  const {
    profileId: normalizedProfileId,
    safeLeads,
    serializedEntries,
  } = prepared;
  await ensureD1Schema(db);

  const snapshotId = computePublishedSnapshotIdFromSafeLeads(
    normalizedProfileId,
    artifactKind,
    safeLeads
  );
  const statements = buildProfileCollisionGuardStatements(
    db,
    safeLeads,
    normalizedProfileId
  );
  if (artifactKind === PUBLISHED_ARTIFACT_KINDS.latest) {
    statements.push(...buildLatestLeadUpsertStatements(db, safeLeads, normalizedProfileId));
  }

  statements.push(
    db.prepare(
      'DELETE FROM published_snapshot_entries WHERE profile_id = ? AND artifact_kind = ?'
    ).bind(normalizedProfileId, artifactKind)
  );
  statements.push(...buildSnapshotEntryStatements(
    db,
    safeLeads,
    serializedEntries,
    normalizedProfileId,
    artifactKind,
    snapshotId
  ));

  // The head stays last so a successful batch publishes the replacement as a
  // single unit. Readers join the head and entries in one consistent statement.
  statements.push(
    db.prepare(
      `INSERT INTO published_snapshot_heads
       (profile_id, artifact_kind, snapshot_id, fetched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(profile_id, artifact_kind) DO UPDATE SET
         snapshot_id=excluded.snapshot_id,
         fetched_at=excluded.fetched_at`
    ).bind(normalizedProfileId, artifactKind, snapshotId, fetchedAt)
  );

  await db.batch(statements);
  return { snapshotId, fetchedAt, leads: safeLeads };
}

export async function getPublishedSnapshot(
  db,
  {
    profileId,
    artifactKind,
    now = Date.now(),
    ttlMs = DEFAULT_PUBLISHED_SNAPSHOT_TTL_MS,
    maxStaleMs = DEFAULT_PUBLISHED_SNAPSHOT_MAX_STALE_MS,
  }
) {
  if (!db) return null;
  assertArtifactKind(artifactKind);
  const normalizedProfileId = normalizePublishedProfileId(profileId);
  await ensureD1Schema(db);

  const { results } = await db.prepare(SNAPSHOT_READ_SQL)
    .bind(
      normalizedProfileId,
      artifactKind,
      PUBLISHED_SNAPSHOT_MAX_LEADS[artifactKind],
      PUBLISHED_SNAPSHOT_MAX_LEADS[artifactKind] + 1
    )
    .all();
  const rows = results || [];
  if (rows.length === 0) return null;

  const head = rows[0];
  const hasSnapshotEntry = (row) => (
    row.snapshot_entry_lead_id !== null && row.snapshot_entry_lead_id !== undefined
  );
  const entryRows = rows.filter(hasSnapshotEntry);
  const storedEntryCount = Number(head.snapshot_entry_count || 0);
  if (
    !Number.isInteger(storedEntryCount)
    || storedEntryCount < 0
    || storedEntryCount > PUBLISHED_SNAPSHOT_MAX_LEADS[artifactKind]
    || entryRows.length !== storedEntryCount
  ) {
    throw snapshotCorrupt('Published snapshot entry count exceeds its artifact-kind limit');
  }

  const profileCollisionCount = Number(head.snapshot_profile_collision_count || 0);
  if (!Number.isInteger(profileCollisionCount) || profileCollisionCount !== 0) {
    throw snapshotCorrupt('Published snapshot lead id collides with another profile');
  }
  const maxMutableRawBytes = Number(head.snapshot_max_mutable_raw_bytes || 0);
  const aggregateMutableRawBytes = Number(head.snapshot_aggregate_mutable_raw_bytes || 0);
  const maxMutableJsonBytes = Number(head.snapshot_max_mutable_json_bytes || 0);
  const aggregateMutableJsonBytes = Number(head.snapshot_aggregate_mutable_json_bytes || 0);
  if (
    !Number.isInteger(maxMutableRawBytes)
    || maxMutableRawBytes < 0
    || maxMutableRawBytes > PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES
    || !Number.isInteger(aggregateMutableRawBytes)
    || aggregateMutableRawBytes < 0
    || aggregateMutableRawBytes > PUBLISHED_SNAPSHOT_MUTABLE_RAW_AGGREGATE_MAX_UTF8_BYTES
    || !Number.isInteger(maxMutableJsonBytes)
    || maxMutableJsonBytes < 0
    || maxMutableJsonBytes > PUBLISHED_SNAPSHOT_MUTABLE_JSON_MAX_UTF8_BYTES
    || !Number.isInteger(aggregateMutableJsonBytes)
    || aggregateMutableJsonBytes < 0
    || aggregateMutableJsonBytes > PUBLISHED_SNAPSHOT_MUTABLE_AGGREGATE_MAX_UTF8_BYTES
  ) {
    throw snapshotOverlayLimit('Published snapshot mutable overlay exceeds its read budget');
  }

  const snapshotLeads = [];
  const mutableLeads = [];
  let aggregatePayloadBytes = 0;
  let observedMaxPayloadBytes = 0;
  let observedMaxPersistedRowBytes = 0;
  let observedAggregateMutableJsonBytes = 0;
  for (const row of rows) {
    if (!hasSnapshotEntry(row)) continue;
    if (Number(row.snapshot_entry_ordinal) !== snapshotLeads.length) {
      throw snapshotCorrupt('Published snapshot entry ordinals are not contiguous');
    }
    const sqlPayloadBytes = Number(row.snapshot_payload_bytes);
    const sqlAggregateBytes = Number(row.snapshot_aggregate_payload_bytes);
    const sqlPersistedRowBytes = Number(row.snapshot_persisted_row_bytes);
    if (
      !Number.isInteger(sqlPayloadBytes)
      || sqlPayloadBytes < 0
      || sqlPayloadBytes > PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES
      || !Number.isInteger(sqlAggregateBytes)
      || sqlAggregateBytes < 0
      || sqlAggregateBytes > PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES
      || !Number.isInteger(sqlPersistedRowBytes)
      || sqlPersistedRowBytes < 0
      || sqlPersistedRowBytes > PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES
      || row.snapshot_payload_json === null
      || row.snapshot_payload_json === undefined
    ) {
      throw snapshotCorrupt('Published snapshot payload exceeds its persisted byte limits');
    }
    const rawPayloadJson = String(row.snapshot_payload_json || '');
    const payloadBytes = utf8ByteLength(rawPayloadJson);
    if (
      payloadBytes !== sqlPayloadBytes
      || payloadBytes > PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES
    ) {
      throw snapshotCorrupt('Published snapshot entry exceeds its UTF-8 byte limit');
    }
    aggregatePayloadBytes += payloadBytes;
    observedMaxPayloadBytes = Math.max(observedMaxPayloadBytes, payloadBytes);
    if (aggregatePayloadBytes > PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES) {
      throw snapshotCorrupt('Published snapshot aggregate exceeds its UTF-8 byte limit');
    }

    let canonicalLeadId;
    try {
      canonicalLeadId = normalizePublishedLeadId(row.snapshot_entry_lead_id);
    } catch (cause) {
      throw snapshotCorrupt('Published snapshot entry lead id is invalid', cause);
    }
    if (canonicalLeadId !== row.snapshot_entry_lead_id) {
      throw snapshotCorrupt('Published snapshot entry lead id is not canonical');
    }
    const persistedRowBytes = publishedSnapshotEntryRowUtf8Bytes({
      profileId: normalizedProfileId,
      artifactKind,
      snapshotId: head.snapshot_head_id,
      leadId: canonicalLeadId,
      payloadJson: rawPayloadJson,
    });
    if (persistedRowBytes !== sqlPersistedRowBytes) {
      throw snapshotCorrupt('Published snapshot persisted-row byte metadata is inconsistent');
    }
    observedMaxPersistedRowBytes = Math.max(observedMaxPersistedRowBytes, persistedRowBytes);

    const payload = toSafePublishedSnapshotLead(parseSnapshotPayload(rawPayloadJson));
    if (payload.id !== canonicalLeadId) {
      throw snapshotCorrupt('Published snapshot entry lead id does not match its payload');
    }
    if (payload.profileId !== normalizedProfileId || payload.source !== 'managed') {
      throw snapshotCorrupt('Published snapshot entry ownership metadata is invalid');
    }
    payload.profileId = normalizedProfileId;
    payload.source = 'managed';
    snapshotLeads.push(payload);
    mutableLeads.push(mutableLeadFromJoinedRow(row, normalizedProfileId));
    observedAggregateMutableJsonBytes += Number(row.snapshot_mutable_json_bytes || 0);
  }
  if (aggregatePayloadBytes !== Number(head.snapshot_aggregate_payload_bytes || 0)) {
    throw snapshotCorrupt('Published snapshot aggregate byte metadata is inconsistent');
  }
  if (
    observedMaxPayloadBytes !== Number(head.snapshot_max_payload_bytes || 0)
    || observedMaxPersistedRowBytes !== Number(head.snapshot_max_persisted_row_bytes || 0)
  ) {
    throw snapshotCorrupt('Published snapshot maximum byte metadata is inconsistent');
  }
  if (observedAggregateMutableJsonBytes !== aggregateMutableJsonBytes) {
    throw snapshotOverlayLimit('Published snapshot mutable aggregate byte metadata is inconsistent');
  }

  let safeLeads;
  try {
    ({ safeLeads } = preparePublishedSnapshotPayloads(
      normalizedProfileId,
      artifactKind,
      snapshotLeads
    ));
  } catch (cause) {
    throw snapshotCorrupt('Published snapshot payload contract is invalid', cause);
  }
  const expectedSnapshotId = computePublishedSnapshotIdFromSafeLeads(
    normalizedProfileId,
    artifactKind,
    safeLeads
  );
  if (head.snapshot_head_id !== expectedSnapshotId) {
    throw snapshotCorrupt('Published snapshot content hash does not match its head');
  }
  const leads = safeLeads.map((lead, index) => (
    overlayMutableLeadState(lead, mutableLeads[index], artifactKind)
  ));

  const fetchedAtMs = Date.parse(head.snapshot_fetched_at);
  const normalizedNow = typeof now === 'number' ? now : Date.parse(now);
  const normalizedTtlMs = Number.isFinite(Number(ttlMs)) && Number(ttlMs) >= 0
    ? Number(ttlMs)
    : DEFAULT_PUBLISHED_SNAPSHOT_TTL_MS;
  const normalizedMaxStaleMs = Number.isFinite(Number(maxStaleMs)) && Number(maxStaleMs) >= 0
    ? Number(maxStaleMs)
    : DEFAULT_PUBLISHED_SNAPSHOT_MAX_STALE_MS;
  const ageMs = normalizedNow - fetchedAtMs;
  const timestampUsable = Number.isFinite(fetchedAtMs)
    && Number.isFinite(normalizedNow)
    && ageMs >= 0;
  const staleUsable = timestampUsable && ageMs <= normalizedMaxStaleMs;
  const fresh = staleUsable && ageMs <= normalizedTtlMs;

  return {
    snapshotId: head.snapshot_head_id,
    fetchedAt: head.snapshot_fetched_at,
    fresh,
    staleUsable,
    leads,
  };
}
