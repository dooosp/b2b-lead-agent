import {
  D1_MAX_STRING_OR_BLOB_BYTES,
  PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_MUTABLE_AGGREGATE_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_MUTABLE_JSON_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_MUTABLE_RAW_AGGREGATE_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES,
  computePublishedSnapshotId,
  publishedSnapshotEntryRowUtf8Bytes,
  toSafePublishedSnapshotLead,
} from '../../db/published-snapshots.js';
import {
  CANONICAL_D1_CRITICAL_COLUMN_SPECS,
  CANONICAL_D1_INDEX_SPECS,
  CANONICAL_D1_TABLE_COLUMN_NAMES,
  CREATE_CANONICAL_JOB_RUNS_TABLE_SQL,
  CREATE_CANONICAL_LEADS_TABLE_SQL,
  CREATE_MIGRATION_LEDGER_SQL,
  D1_MIGRATION_MANIFEST,
  LATEST_D1_SCHEMA_VERSION,
  V1_CREATE_TABLE_STATEMENTS,
  V2_CREATE_TABLE_STATEMENTS,
  V3_CREATE_TABLE_STATEMENTS,
} from '../../db/migration-manifest.js';
import { rowToLead } from '../../db/transform.js';

export function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function uniqueConstraintError(message) {
  const error = new Error(message);
  error.name = 'D1_ERROR';
  return error;
}

function constraintError(message) {
  const error = new Error(message);
  error.name = 'D1_ERROR';
  return error;
}

const MANUAL_REVIEW_NOTE_EVENT_TYPES = new Set(['create', 'edit', 'clear']);
const MANUAL_REVIEW_NOTES_AUTHOR_LABEL = 'manual_reviewer';
const REVIEWER_FEEDBACK_EVENT_TYPES = new Set(['create', 'edit', 'clear']);
const REVIEWER_FEEDBACK_AUTHOR_LABEL = 'manual_reviewer';
const REVIEWER_FEEDBACK_ACTION_USEFULNESS = new Set(['useful', 'partially_useful', 'not_useful', 'unclear']);
const REVIEWER_FEEDBACK_OUTCOME_LABELS = new Set(['interested', 'not_fit', 'no_response', 'needs_more_research', 'duplicate', 'deferred', 'unknown']);
const REVIEWER_FEEDBACK_DATA_GAP_PRIORITIES = new Set(['none', 'low', 'medium', 'high', 'blocking']);
const REVIEWER_FEEDBACK_CONFIDENCE_ADJUSTMENTS = new Set(['increase', 'decrease', 'unchanged', 'unknown']);
const UTF8_ENCODER = new TextEncoder();

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async run() {
    this.db.recordQuery(this.sql, this.args);
    return this.db.executeRun(this.sql, this.args);
  }

  async first() {
    this.db.recordQuery(this.sql, this.args);
    return this.db.executeFirst(this.sql, this.args);
  }

  async all() {
    this.db.recordQuery(this.sql, this.args);
    return { results: await this.db.executeAll(this.sql, this.args) };
  }
}

function clone(row) {
  return row ? { ...row } : null;
}

function snapshotKey(profileId, artifactKind) {
  return `${profileId}\u0000${artifactKind}`;
}

function toPublishedFixtureLead(lead) {
  const normalized = lead && (lead.profile_id || lead.identity_key || lead.created_at)
    ? rowToLead(lead)
    : lead;
  return toSafePublishedSnapshotLead(normalized || {});
}

function canonicalSchemaIntrospectionRows() {
  return Object.entries(CANONICAL_D1_TABLE_COLUMN_NAMES).flatMap(([tableName, columnNames]) => (
    columnNames.map((name, cid) => {
      const spec = CANONICAL_D1_CRITICAL_COLUMN_SPECS[tableName]?.[name] || {};
      return {
        table_name: tableName,
        cid,
        name,
        type: spec.type || 'TEXT',
        not_null: spec.notNull || 0,
        dflt_value: spec.defaultValue ?? null,
        pk: spec.pk || 0,
      };
    })
  ));
}

function canonicalSchemaObjectRows() {
  const tableRows = [
    CREATE_MIGRATION_LEDGER_SQL,
    CREATE_CANONICAL_LEADS_TABLE_SQL,
    CREATE_CANONICAL_JOB_RUNS_TABLE_SQL,
    ...V1_CREATE_TABLE_STATEMENTS.filter((sql) => !/CREATE TABLE IF NOT EXISTS (?:leads|job_runs)\b/i.test(sql)),
    ...V2_CREATE_TABLE_STATEMENTS,
    ...V3_CREATE_TABLE_STATEMENTS,
  ].map((sql) => {
    const match = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
    if (!match) throw new Error(`Invalid canonical fake-D1 table SQL: ${sql}`);
    return { type: 'table', name: match[1], table_name: match[1], sql };
  });
  const indexRows = CANONICAL_D1_INDEX_SPECS.map((index) => ({
    type: 'index',
    name: index.name,
    table_name: index.tableName,
    sql: index.normalizedSql,
  }));
  return [...tableRows, ...indexRows];
}

export function seedPublishedSnapshotFixtures(
  db,
  leads,
  { profileId = 'danfoss', artifactKinds = ['latest', 'history'] } = {}
) {
  for (const artifactKind of artifactKinds) {
    db.seedPublishedSnapshot({ profileId, artifactKind, leads });
  }
  return db;
}

function validateManualReviewNoteEvent(row) {
  if (!MANUAL_REVIEW_NOTE_EVENT_TYPES.has(row.event_type)) {
    throw constraintError('CHECK constraint failed: manual_review_note_events.event_type');
  }
  if ((row.author_label || MANUAL_REVIEW_NOTES_AUTHOR_LABEL) !== MANUAL_REVIEW_NOTES_AUTHOR_LABEL) {
    throw constraintError('CHECK constraint failed: manual_review_note_events.author_label');
  }
}

function validateReviewerFeedbackRow(row) {
  if (!REVIEWER_FEEDBACK_ACTION_USEFULNESS.has(row.action_usefulness || 'unclear')) {
    throw constraintError('CHECK constraint failed: reviewer_feedback.action_usefulness');
  }
  if (!REVIEWER_FEEDBACK_OUTCOME_LABELS.has(row.outcome_label || 'unknown')) {
    throw constraintError('CHECK constraint failed: reviewer_feedback.outcome_label');
  }
  if (!REVIEWER_FEEDBACK_DATA_GAP_PRIORITIES.has(row.data_gap_priority || 'none')) {
    throw constraintError('CHECK constraint failed: reviewer_feedback.data_gap_priority');
  }
  if (!REVIEWER_FEEDBACK_CONFIDENCE_ADJUSTMENTS.has(row.evidence_confidence_adjustment || 'unknown')) {
    throw constraintError('CHECK constraint failed: reviewer_feedback.evidence_confidence_adjustment');
  }
  if ((row.author_label || REVIEWER_FEEDBACK_AUTHOR_LABEL) !== REVIEWER_FEEDBACK_AUTHOR_LABEL) {
    throw constraintError('CHECK constraint failed: reviewer_feedback.author_label');
  }
}

function validateReviewerFeedbackEvent(row) {
  if (!REVIEWER_FEEDBACK_EVENT_TYPES.has(row.event_type)) {
    throw constraintError('CHECK constraint failed: reviewer_feedback_events.event_type');
  }
  if ((row.author_label || REVIEWER_FEEDBACK_AUTHOR_LABEL) !== REVIEWER_FEEDBACK_AUTHOR_LABEL) {
    throw constraintError('CHECK constraint failed: reviewer_feedback_events.author_label');
  }
}

function toLeadInsertRow(args) {
  const [
    id,
    identityKey,
    profileId,
    source,
    status,
    reviewStatus,
    company,
    summary,
    product,
    score,
    grade,
    roi,
    salesPitch,
    globalContext,
    sources,
    notes,
    scoreReason,
    urgency,
    urgencyReason,
    buyerRole,
    evidence,
    confidence,
    confidenceReason,
    assumptions,
    generationMode,
    verificationStatus,
    dataGaps,
    eventType,
    createdAt,
    updatedAt,
  ] = args;

  return {
    id,
    identity_key: identityKey,
    profile_id: profileId,
    source,
    status,
    review_status: reviewStatus,
    company,
    summary,
    product,
    score,
    grade,
    roi,
    sales_pitch: salesPitch,
    global_context: globalContext,
    sources,
    notes,
    score_reason: scoreReason,
    urgency,
    urgency_reason: urgencyReason,
    buyer_role: buyerRole,
    evidence,
    confidence,
    confidence_reason: confidenceReason,
    assumptions,
    generation_mode: generationMode,
    verification_status: verificationStatus,
    data_gaps: dataGaps,
    event_type: eventType,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function sortByCreatedDesc(rows) {
  return [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSameStatus(row, status) {
  return String(row.status || '').toUpperCase() === status;
}

function isTerminalStatus(row) {
  return isSameStatus(row, 'WON') || isSameStatus(row, 'LOST');
}

export class FakeD1Database {
  constructor({
    leads = [],
    jobRuns = [],
    statusLog = [],
    analytics = [],
    manualReviewNoteEvents = [],
    reviewerFeedback = [],
    reviewerFeedbackEvents = [],
    jobCallbackEvents = [],
    publishedSnapshots = [],
    publishedSnapshotHeads = [],
    publishedSnapshotEntries = [],
    schemaVersion = LATEST_D1_SCHEMA_VERSION,
    migrationLedgerRows = null,
    schemaIntrospectionRows = null,
    schemaObjectRows = null,
    failOnSql
  } = {}) {
    this.leads = new Map(leads.map((row) => [row.id, {
      version: 1,
      last_patch_mutation_id: '',
      ...row,
    }]));
    this.jobRuns = new Map(jobRuns.map((row) => [row.request_id, {
      provider_attempt: 0,
      last_callback_event_id: '',
      ...row,
    }]));
    this.statusLog = statusLog.map((row, index) => ({ id: index + 1, ...row }));
    this.analytics = analytics.map((row) => ({ ...row }));
    this.manualReviewNoteEvents = manualReviewNoteEvents.map((row, index) => {
      const event = {
        id: row.id || index + 1,
        ...row,
      };
      validateManualReviewNoteEvent(event);
      return event;
    });
    this.reviewerFeedback = new Map((Array.isArray(reviewerFeedback) ? reviewerFeedback : []).map((row) => {
      const feedback = {
        action_usefulness: 'unclear',
        outcome_label: 'unknown',
        data_gap_priority: 'none',
        evidence_confidence_adjustment: 'unknown',
        feedback_text: '',
        next_reviewer_action: '',
        author_label: REVIEWER_FEEDBACK_AUTHOR_LABEL,
        ...row,
      };
      validateReviewerFeedbackRow(feedback);
      return [feedback.lead_id, feedback];
    }));
    this.reviewerFeedbackEvents = reviewerFeedbackEvents.map((row, index) => {
      const event = {
        id: row.id || index + 1,
        ...row,
      };
      validateReviewerFeedbackEvent(event);
      return event;
    });
    this.jobCallbackEvents = jobCallbackEvents.map((row) => ({ ...row }));
    this.schemaVersion = schemaVersion;
    this.migrationLedgerRows = Array.isArray(migrationLedgerRows)
      ? migrationLedgerRows.map(clone)
      : D1_MIGRATION_MANIFEST
        .filter((migration) => migration.version <= Number(schemaVersion || 0))
        .map(({ version, name }) => ({ version, name }));
    this.schemaIntrospectionRows = Array.isArray(schemaIntrospectionRows)
      ? schemaIntrospectionRows.map(clone)
      : canonicalSchemaIntrospectionRows();
    this.schemaObjectRows = Array.isArray(schemaObjectRows)
      ? schemaObjectRows.map(clone)
      : canonicalSchemaObjectRows();
    this.publishedSnapshotHeads = new Map(
      publishedSnapshotHeads.map((head) => [
        snapshotKey(head.profile_id, head.artifact_kind),
        { ...head },
      ])
    );
    this.publishedSnapshotEntries = publishedSnapshotEntries.map((entry) => ({ ...entry }));
    publishedSnapshots.forEach((snapshot) => this.seedPublishedSnapshot(snapshot));
    this.schemaStatements = [];
    this.batches = [];
    this.queryCount = 0;
    this.executedQueries = [];
    this.batchSizes = [];
    this.maxBoundParams = 0;
    this.onPublishedSnapshotRead = null;
    this.failOnSql = failOnSql;
    this.batchTail = Promise.resolve();
  }

  seedPublishedSnapshot(snapshot) {
    const profileId = snapshot.profileId || snapshot.profile_id;
    const artifactKind = snapshot.artifactKind || snapshot.artifact_kind;
    const snapshotLeads = snapshot.leads || [];
    const projectedSnapshotLeads = snapshotLeads.map((lead) => ({
      ...toPublishedFixtureLead(lead),
      profileId,
      source: 'managed',
    }));
    const snapshotId = snapshot.snapshotId
      || snapshot.snapshot_id
      || computePublishedSnapshotId(profileId, artifactKind, projectedSnapshotLeads);
    const fetchedAt = snapshot.fetchedAt || snapshot.fetched_at || new Date().toISOString();
    this.publishedSnapshotHeads.set(snapshotKey(profileId, artifactKind), {
      profile_id: profileId,
      artifact_kind: artifactKind,
      snapshot_id: snapshotId,
      fetched_at: fetchedAt,
    });
    this.publishedSnapshotEntries = this.publishedSnapshotEntries.filter(
      (entry) => entry.profile_id !== profileId || entry.artifact_kind !== artifactKind
    );
    projectedSnapshotLeads.forEach((payload, ordinal) => {
      this.publishedSnapshotEntries.push({
        profile_id: profileId,
        artifact_kind: artifactKind,
        snapshot_id: snapshotId,
        ordinal,
        lead_id: payload.id,
        payload_json: JSON.stringify(payload),
      });
    });
    return snapshotId;
  }

  prepare(sql) {
    if (this.shouldFail(sql)) {
      throw new Error('fake D1 forced failure');
    }
    return new FakeStatement(this, sql);
  }

  recordQuery(sql, args = []) {
    this.queryCount += 1;
    this.maxBoundParams = Math.max(this.maxBoundParams, args.length);
    this.executedQueries.push({ sql: normalizeSql(sql), bindCount: args.length });
  }

  resetQueryMetrics() {
    this.queryCount = 0;
    this.executedQueries = [];
    this.batchSizes = [];
    this.maxBoundParams = 0;
  }

  async batch(statements) {
    let releaseBatch;
    const previousBatch = this.batchTail;
    this.batchTail = new Promise((resolve) => { releaseBatch = resolve; });
    await previousBatch;
    const snapshot = {
      leads: new Map([...this.leads].map(([key, row]) => [key, clone(row)])),
      jobRuns: new Map([...this.jobRuns].map(([key, row]) => [key, clone(row)])),
      statusLog: this.statusLog.map(clone),
      analytics: this.analytics.map(clone),
      manualReviewNoteEvents: this.manualReviewNoteEvents.map(clone),
      reviewerFeedback: new Map([...this.reviewerFeedback].map(([key, row]) => [key, clone(row)])),
      reviewerFeedbackEvents: this.reviewerFeedbackEvents.map(clone),
      jobCallbackEvents: this.jobCallbackEvents.map(clone),
      publishedSnapshotHeads: new Map([...this.publishedSnapshotHeads].map(([key, row]) => [key, clone(row)])),
      publishedSnapshotEntries: this.publishedSnapshotEntries.map(clone),
    };
    try {
      this.batches.push(statements.map((statement) => normalizeSql(statement.sql)));
      this.batchSizes.push(statements.length);
      const results = [];
      for (const statement of statements) {
        const normalized = normalizeSql(statement.sql);
        if (normalized.startsWith('select ')) {
          this.recordQuery(statement.sql, statement.args);
          results.push({ results: await this.executeAll(statement.sql, statement.args) });
        } else {
          results.push(await statement.run());
        }
      }
      return results;
    } catch (error) {
      Object.assign(this, snapshot);
      throw error;
    } finally {
      releaseBatch();
    }
  }

  shouldFail(sql) {
    if (!this.failOnSql) return false;
    if (typeof this.failOnSql === 'function') return this.failOnSql(sql);
    return this.failOnSql.some((matcher) => {
      if (matcher instanceof RegExp) return matcher.test(sql);
      return String(sql).includes(String(matcher));
    });
  }

  recordSchema(sql) {
    this.schemaStatements.push(sql);
    return { meta: { changes: 0 } };
  }

  upsertLead(row, { overwriteGeneratedFields = true, preserveEnrichment = false, incrementVersion = false } = {}) {
    const existing = this.leads.get(row.id);
    if (!existing) {
      this.leads.set(row.id, { version: 1, last_patch_mutation_id: '', ...row });
      return { meta: { changes: 1 } };
    }

    if (!overwriteGeneratedFields) return { meta: { changes: 0 } };

    const generatedUpdates = {
      identity_key: row.identity_key,
      profile_id: row.profile_id,
      source: row.source,
      company: row.company,
      summary: row.summary,
      product: row.product,
      score: row.score,
      grade: row.grade,
      roi: row.roi,
      sales_pitch: row.sales_pitch,
      global_context: row.global_context,
      sources: row.sources,
      score_reason: row.score_reason,
      urgency: row.urgency,
      urgency_reason: row.urgency_reason,
      buyer_role: row.buyer_role,
      evidence: row.evidence,
      confidence: row.confidence,
      confidence_reason: row.confidence_reason,
      assumptions: row.assumptions,
      generation_mode: row.generation_mode,
      verification_status: row.verification_status,
      data_gaps: row.data_gaps,
      event_type: row.event_type,
    };
    if (preserveEnrichment && toNumber(existing.enriched) === 1) {
      for (const field of ['summary', 'roi', 'sales_pitch', 'global_context', 'evidence', 'assumptions']) {
        delete generatedUpdates[field];
      }
    }
    Object.assign(existing, generatedUpdates);
    if (incrementVersion) existing.version = Number(existing.version || 1) + 1;
    return { meta: { changes: 1 } };
  }

  async executeRun(sql, args) {
    const normalized = normalizeSql(sql);

    if (
      normalized.startsWith('create table') ||
      normalized.startsWith('create unique index') ||
      normalized.startsWith('create index') ||
      normalized.startsWith('alter table')
    ) {
      return this.recordSchema(sql);
    }

    if (normalized.startsWith('insert into leads ')) {
      if (args.length % 30 !== 0) throw new Error('Fake D1 lead insert bind count must be divisible by 30');
      let changes = 0;
      for (let offset = 0; offset < args.length; offset += 30) {
        const row = toLeadInsertRow(args.slice(offset, offset + 30));
        const existing = this.leads.get(row.id);
        if (existing && normalized.includes('on conflict(id) do nothing')) continue;
        if (
          existing
          && normalized.includes('else null end')
          && existing.profile_id !== row.profile_id
        ) {
          throw constraintError('NOT NULL constraint failed: leads.profile_id');
        }
        changes += Number(this.upsertLead(row, {
          preserveEnrichment: normalized.includes('coalesce(leads.enriched, 0) = 1'),
          incrementVersion: normalized.includes('version=leads.version+1'),
        })?.meta?.changes || 0);
      }
      return { meta: { changes }, success: true };
    }

    if (
      normalized.startsWith('update leads set profile_id = null where profile_id <> ? and id in (')
    ) {
      const [profileId, ...leadIds] = args;
      const collision = leadIds.some((leadId) => {
        const existing = this.leads.get(leadId);
        return existing && existing.profile_id !== profileId;
      });
      if (collision) throw constraintError('NOT NULL constraint failed: leads.profile_id');
      return { meta: { changes: 0 }, success: true };
    }

    if (normalized === 'delete from published_snapshot_entries where profile_id = ? and artifact_kind = ?') {
      const before = this.publishedSnapshotEntries.length;
      this.publishedSnapshotEntries = this.publishedSnapshotEntries.filter(
        (entry) => entry.profile_id !== args[0] || entry.artifact_kind !== args[1]
      );
      return { meta: { changes: before - this.publishedSnapshotEntries.length }, success: true };
    }

    if (normalized.startsWith('insert into published_snapshot_entries ')) {
      if (args.length % 6 !== 0) throw new Error('Fake D1 snapshot entry bind count must be divisible by 6');
      let changes = 0;
      for (let offset = 0; offset < args.length; offset += 6) {
        const entry = {
          profile_id: args[offset],
          artifact_kind: args[offset + 1],
          snapshot_id: args[offset + 2],
          ordinal: args[offset + 3],
          lead_id: args[offset + 4],
          payload_json: args[offset + 5],
        };
        if (UTF8_ENCODER.encode(entry.payload_json).byteLength > D1_MAX_STRING_OR_BLOB_BYTES) {
          throw constraintError('D1 payload_json exceeds the maximum string/BLOB size');
        }
        if (publishedSnapshotEntryRowUtf8Bytes({
          profileId: entry.profile_id,
          artifactKind: entry.artifact_kind,
          snapshotId: entry.snapshot_id,
          leadId: entry.lead_id,
          payloadJson: entry.payload_json,
        }) > PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES) {
          throw constraintError('D1 published snapshot entry exceeds the persisted-row budget');
        }
        const duplicate = this.publishedSnapshotEntries.some((existing) => (
          existing.profile_id === entry.profile_id
          && existing.artifact_kind === entry.artifact_kind
          && existing.snapshot_id === entry.snapshot_id
          && (existing.ordinal === entry.ordinal || existing.lead_id === entry.lead_id)
        ));
        if (duplicate) throw uniqueConstraintError('UNIQUE constraint failed: published_snapshot_entries');
        this.publishedSnapshotEntries.push(entry);
        changes += 1;
      }
      return { meta: { changes }, success: true };
    }

    if (normalized.startsWith('insert into published_snapshot_heads ')) {
      const head = {
        profile_id: args[0],
        artifact_kind: args[1],
        snapshot_id: args[2],
        fetched_at: args[3],
      };
      this.publishedSnapshotHeads.set(snapshotKey(head.profile_id, head.artifact_kind), head);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('update leads set ') && normalized.endsWith(' where id = ? and version = ?')) {
      const id = args.at(-2);
      const expectedVersion = Number(args.at(-1));
      const row = this.leads.get(id);
      if (!row || Number(row.version || 1) !== expectedVersion) {
        return { meta: { changes: 0 }, success: true };
      }

      const setClause = normalized.slice(
        'update leads set '.length,
        normalized.lastIndexOf(' where id = ? and version = ?')
      );
      const assignments = setClause.split(',').map((part) => part.trim());
      let argIndex = 0;
      for (const assignment of assignments) {
        const [column, expression] = assignment.split(' = ').map((part) => part.trim());
        if (expression === 'version + 1') {
          row.version = Number(row.version || 1) + 1;
        } else if (expression === 'version') {
          row.version = Number(row.version || 1);
        } else if (expression === '?') {
          row[column] = args[argIndex];
          argIndex += 1;
        } else {
          throw new Error(`Unsupported fake D1 lead CAS assignment: ${assignment}`);
        }
      }
      this.leads.set(id, row);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('update leads set ') && normalized.endsWith(' where id = ?')) {
      const id = args.at(-1);
      const row = this.leads.get(id);
      if (!row) return { meta: { changes: 0 }, success: false };

      const setClause = normalized.slice('update leads set '.length, normalized.lastIndexOf(' where id = ?'));
      let argIndex = 0;
      for (const assignment of setClause.split(',').map((part) => part.trim())) {
        const [column, expression] = assignment.split(' = ').map((part) => part.trim());
        if (expression === 'version + 1') row.version = Number(row.version || 1) + 1;
        else {
          row[column] = args[argIndex];
          argIndex += 1;
        }
      }
      this.leads.set(id, row);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('insert into status_log (lead_id, from_status, to_status, changed_at) select ')) {
      const [leadId, fromStatus, toStatus, changedAt, guardLeadId, guardVersion, mutationId] = args;
      const guard = this.leads.get(guardLeadId);
      if (!guard || guard.id !== leadId || Number(guard.version) !== Number(guardVersion)
        || guard.last_patch_mutation_id !== mutationId) {
        return { meta: { changes: 0 }, success: true };
      }
      this.statusLog.push({
        id: this.statusLog.length + 1,
        lead_id: leadId,
        from_status: fromStatus,
        to_status: toStatus,
        changed_at: changedAt,
      });
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized === 'insert into status_log (lead_id, from_status, to_status, changed_at) values (?, ?, ?, ?)') {
      this.statusLog.push({
        id: this.statusLog.length + 1,
        lead_id: args[0],
        from_status: args[1],
        to_status: args[2],
        changed_at: args[3],
      });
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('insert into manual_review_note_events (lead_id, event_type, changed_at, author_label) select ')) {
      const [leadId, eventType, changedAt, authorLabel, guardLeadId, guardVersion, mutationId] = args;
      const guard = this.leads.get(guardLeadId);
      if (!guard || guard.id !== leadId || Number(guard.version) !== Number(guardVersion)
        || guard.last_patch_mutation_id !== mutationId) {
        return { meta: { changes: 0 }, success: true };
      }
      const event = {
        id: this.manualReviewNoteEvents.length + 1,
        lead_id: leadId,
        event_type: eventType,
        changed_at: changedAt,
        author_label: authorLabel,
      };
      validateManualReviewNoteEvent(event);
      this.manualReviewNoteEvents.push(event);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized === 'insert into manual_review_note_events (lead_id, event_type, changed_at, author_label) values (?, ?, ?, ?)') {
      const event = {
        id: this.manualReviewNoteEvents.length + 1,
        lead_id: args[0],
        event_type: args[1],
        changed_at: args[2],
        author_label: args[3],
      };
      validateManualReviewNoteEvent(event);
      this.manualReviewNoteEvents.push(event);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('insert into reviewer_feedback ')) {
      const guarded = normalized.includes(' where exists ( select 1 from leads where id = ? and version = ? and last_patch_mutation_id = ? )');
      if (guarded) {
        const guard = this.leads.get(args[9]);
        if (!guard || guard.id !== args[0] || Number(guard.version) !== Number(args[10])
          || guard.last_patch_mutation_id !== args[11]) {
          return { meta: { changes: 0 }, success: true };
        }
      }
      const row = {
        lead_id: args[0],
        action_usefulness: args[1],
        outcome_label: args[2],
        data_gap_priority: args[3],
        evidence_confidence_adjustment: args[4],
        feedback_text: args[5],
        next_reviewer_action: args[6],
        author_label: args[7],
        updated_at: args[8],
      };
      validateReviewerFeedbackRow(row);
      this.reviewerFeedback.set(row.lead_id, row);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('delete from reviewer_feedback where lead_id = ? and exists (')) {
      const guard = this.leads.get(args[1]);
      if (!guard || guard.id !== args[0] || Number(guard.version) !== Number(args[2])
        || guard.last_patch_mutation_id !== args[3]) {
        return { meta: { changes: 0 }, success: true };
      }
      const deleted = this.reviewerFeedback.delete(args[0]);
      return { meta: { changes: deleted ? 1 : 0 }, success: true };
    }

    if (normalized === 'delete from reviewer_feedback where lead_id = ?') {
      const deleted = this.reviewerFeedback.delete(args[0]);
      return { meta: { changes: deleted ? 1 : 0 }, success: true };
    }

    if (normalized.startsWith('insert into reviewer_feedback_events (lead_id, event_type, changed_at, author_label, changed_fields) select ')) {
      const guard = this.leads.get(args[5]);
      if (!guard || guard.id !== args[0] || Number(guard.version) !== Number(args[6])
        || guard.last_patch_mutation_id !== args[7]) {
        return { meta: { changes: 0 }, success: true };
      }
      const event = {
        id: this.reviewerFeedbackEvents.length + 1,
        lead_id: args[0],
        event_type: args[1],
        changed_at: args[2],
        author_label: args[3],
        changed_fields: args[4],
      };
      validateReviewerFeedbackEvent(event);
      this.reviewerFeedbackEvents.push(event);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized === 'insert into reviewer_feedback_events (lead_id, event_type, changed_at, author_label, changed_fields) values (?, ?, ?, ?, ?)') {
      const event = {
        id: this.reviewerFeedbackEvents.length + 1,
        lead_id: args[0],
        event_type: args[1],
        changed_at: args[2],
        author_label: args[3],
        changed_fields: args[4],
      };
      validateReviewerFeedbackEvent(event);
      this.reviewerFeedbackEvents.push(event);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('insert into job_runs')) {
      const [requestId, profileId, target, state, idempotencyKey, githubEventType, acceptedAt, updatedAt] = args;

      if (this.jobRuns.has(requestId)) {
        throw uniqueConstraintError('UNIQUE constraint failed: job_runs.request_id');
      }

      if (idempotencyKey) {
        for (const row of this.jobRuns.values()) {
          if (row.idempotency_key === idempotencyKey) {
            throw uniqueConstraintError('UNIQUE constraint failed: job_runs.idempotency_key');
          }
        }
      }

      if (state === 'accepted' || state === 'running') {
        for (const row of this.jobRuns.values()) {
          if (row.profile_id === profileId && (row.state === 'accepted' || row.state === 'running')) {
            throw uniqueConstraintError('UNIQUE constraint failed: job_runs.profile_id');
          }
        }
      }

      this.jobRuns.set(requestId, {
        request_id: requestId,
        profile_id: profileId,
        target,
        state,
        idempotency_key: idempotencyKey,
        github_event_type: githubEventType,
        github_run_id: null,
        github_run_attempt: null,
        github_run_url: '',
        github_workflow: '',
        github_sha: '',
        cloud_run_operation: '',
        cloud_run_execution: '',
        accepted_at: acceptedAt,
        started_at: null,
        completed_at: null,
        last_error: '',
        provider_attempt: 0,
        last_callback_event_id: '',
        updated_at: updatedAt
      });

      return { meta: { changes: 1 } };
    }

    if (normalized.startsWith('insert into analytics')) {
      const [type, profileId, company, industry, leadsCount, articlesCount, elapsedSec, ipHash, createdAt] = args;
      this.analytics.push({
        type,
        profile_id: profileId,
        company,
        industry,
        leads_count: leadsCount,
        articles_count: articlesCount,
        elapsed_sec: elapsedSec,
        ip_hash: ipHash,
        created_at: createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (normalized.startsWith('update job_runs set') && normalized.includes('last_callback_event_id = ?')) {
      const state = args[0];
      const providerAttempt = Number(args[21]);
      const eventId = args[22];
      const requestId = args[24];
      const row = this.jobRuns.get(requestId);
      const currentAttempt = Number(row?.provider_attempt || 0);
      const higherAttempt = providerAttempt > currentAttempt;
      const active = row && (row.state === 'accepted' || row.state === 'running');
      const sameAttemptIdentity = row?.target === 'github-actions'
        ? (row.github_run_id === null || row.github_run_id === undefined || row.github_run_id === args[30])
        : (!row?.cloud_run_execution || row.cloud_run_execution === args[31]);
      const sameAttemptAdvance = providerAttempt === currentAttempt && sameAttemptIdentity && (
        row?.state === 'accepted'
        || (row?.state === 'running' && ['succeeded', 'failed', 'cancelled'].includes(args[32]))
      );
      const existingEvent = this.jobCallbackEvents.find((event) => (
        event.request_id === args[26] && event.idempotency_key === args[27]
      ));
      if (!active || row.last_callback_event_id === eventId
        || existingEvent || !(higherAttempt || sameAttemptAdvance)) {
        return { meta: { changes: 0 }, success: true };
      }

      row.state = state;
      row.started_at = args[2] || row.started_at;
      row.completed_at = args[4] || null;
      row.last_error = args[5] || '';
      row.github_run_id = args[6] ?? row.github_run_id;
      row.github_run_attempt = args[7] ?? row.github_run_attempt;
      row.github_run_url = higherAttempt ? (args[9] || '') : (args[10] || row.github_run_url);
      row.github_workflow = higherAttempt ? (args[12] || '') : (args[13] || row.github_workflow);
      row.github_sha = higherAttempt ? (args[15] || '') : (args[16] || row.github_sha);
      row.cloud_run_operation = higherAttempt ? (args[18] || '') : (args[19] || row.cloud_run_operation);
      row.cloud_run_execution = args[20] || row.cloud_run_execution;
      row.provider_attempt = providerAttempt;
      row.last_callback_event_id = eventId;
      row.updated_at = args[23];
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('insert into job_callback_events ')) {
      const [
        eventId,
        requestId,
        idempotencyKey,
        payloadHash,
        target,
        providerAttempt,
        state,
        guardRequestId,
        guardEventId,
        receivedAt,
      ] = args;
      const job = this.jobRuns.get(guardRequestId);
      if (!job || guardRequestId !== requestId) {
        return { meta: { changes: 0 }, success: true };
      }
      const duplicate = this.jobCallbackEvents.find((event) => (
        event.event_id === eventId
        || (event.request_id === requestId && event.idempotency_key === idempotencyKey)
      ));
      if (duplicate) return { meta: { changes: 0 }, success: true };
      this.jobCallbackEvents.push({
        event_id: eventId,
        request_id: requestId,
        idempotency_key: idempotencyKey,
        payload_hash: payloadHash,
        target,
        provider_attempt: providerAttempt,
        state,
        outcome: job.last_callback_event_id === guardEventId ? 'applied' : 'rejected',
        received_at: receivedAt,
      });
      return { meta: { changes: 1 }, success: true };
    }

    if (normalized.startsWith('update job_runs set')) {
      const [
        state,
        startedAt,
        completedAt,
        lastError,
        githubRunId,
        githubRunAttempt,
        githubRunUrl,
        githubWorkflow,
        githubSha,
        cloudRunOperation,
        cloudRunExecution,
        updatedAt,
        requestId
      ] = args;

      const row = this.jobRuns.get(requestId);
      if (!row || (normalized.includes("state in ('accepted', 'running')")
        && row.state !== 'accepted' && row.state !== 'running')) {
        return { meta: { changes: 0 } };
      }

      row.state = state;
      row.started_at = startedAt || row.started_at;
      row.completed_at = completedAt || null;
      row.last_error = lastError || '';
      row.github_run_id = githubRunId ?? row.github_run_id;
      row.github_run_attempt = githubRunAttempt ?? row.github_run_attempt;
      row.github_run_url = githubRunUrl || row.github_run_url;
      row.github_workflow = githubWorkflow || row.github_workflow;
      row.github_sha = githubSha || row.github_sha;
      row.cloud_run_operation = cloudRunOperation || row.cloud_run_operation;
      row.cloud_run_execution = cloudRunExecution || row.cloud_run_execution;
      row.updated_at = updatedAt;

      return { meta: { changes: 1 } };
    }

    throw new Error(`Unsupported fake D1 run SQL: ${sql}`);
  }

  leadRowsForSql(normalized, args) {
    let rows = [...this.leads.values()];
    if (normalized.includes('profile_id = ?')) {
      rows = rows.filter((row) => row.profile_id === args[0]);
    }
    return rows;
  }

  joinedStatusLogsForSql(normalized, args) {
    const leadRows = this.leadRowsForSql(normalized, args);
    const leadsById = new Map(leadRows.map((row) => [row.id, row]));
    return this.statusLog
      .filter((row) => leadsById.has(row.lead_id))
      .map((row) => ({ log: row, lead: leadsById.get(row.lead_id) }));
  }

  maxStatusChangedAt(leadId, status) {
    return this.statusLog
      .filter((row) => row.lead_id === leadId && isSameStatus({ status: row.to_status }, status))
      .map((row) => row.changed_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  }

  groupRows(rows, keyFn, valueFn) {
    const grouped = new Map();
    for (const row of rows) {
      const key = keyFn(row);
      grouped.set(key, (grouped.get(key) || 0) + valueFn(row));
    }
    return grouped;
  }

  latestEventForLead(events, leadId) {
    return events
      .filter((event) => event.lead_id === leadId)
      .sort((a, b) => {
        const changedOrder = String(b.changed_at || '').localeCompare(String(a.changed_at || ''));
        if (changedOrder !== 0) return changedOrder;
        return Number(b.id || 0) - Number(a.id || 0);
      })[0] || null;
  }

  async publishedSnapshotJoinedRows(
    profileId,
    artifactKind,
    maxEntries = Number.MAX_SAFE_INTEGER,
    rowLimit = Number.MAX_SAFE_INTEGER
  ) {
    const head = clone(this.publishedSnapshotHeads.get(snapshotKey(profileId, artifactKind)) || null);
    if (!head) return [];

    const allEntries = this.publishedSnapshotEntries
      .filter((entry) => (
        entry.profile_id === profileId
        && entry.artifact_kind === artifactKind
        && entry.snapshot_id === head.snapshot_id
      ))
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(clone);
    const payloadBytesByEntry = allEntries.map(
      (entry) => UTF8_ENCODER.encode(String(entry.payload_json || '')).byteLength
    );
    const persistedRowBytesByEntry = allEntries.map((entry) => (
      publishedSnapshotEntryRowUtf8Bytes({
        profileId: entry.profile_id,
        artifactKind: entry.artifact_kind,
        snapshotId: entry.snapshot_id,
        leadId: entry.lead_id,
        payloadJson: entry.payload_json,
      })
    ));
    const aggregatePayloadBytes = payloadBytesByEntry.reduce((total, bytes) => total + bytes, 0);
    const maxPayloadBytes = Math.max(0, ...payloadBytesByEntry);
    const maxPersistedRowBytes = Math.max(0, ...persistedRowBytesByEntry);
    const entryCount = allEntries.length;
    const entries = allEntries.slice(0, Number(rowLimit));
    const leads = new Map([...this.leads.entries()].map(([id, row]) => [id, clone(row)]));
    const reviewerFeedback = new Map(
      [...this.reviewerFeedback.entries()].map(([id, row]) => [id, clone(row)])
    );
    const manualEvents = this.manualReviewNoteEvents.map(clone);
    const feedbackEvents = this.reviewerFeedbackEvents.map(clone);

    if (typeof this.onPublishedSnapshotRead === 'function') {
      await this.onPublishedSnapshotRead(this);
    }

    const snapshotWithinSqlReadLimits = entryCount <= Number(maxEntries)
      && maxPayloadBytes <= PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES
      && aggregatePayloadBytes <= PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES
      && maxPersistedRowBytes <= PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES;
    const overlayCandidates = entries.map((entry) => {
      const candidateLead = leads.get(entry.lead_id);
      const lead = candidateLead?.profile_id === profileId ? candidateLead : null;
      const profileCollision = Boolean(candidateLead && candidateLead.profile_id !== profileId);
      const feedback = lead ? reviewerFeedback.get(lead.id) : null;
      const manualForLead = lead
        ? manualEvents.filter((event) => event.lead_id === lead.id)
        : [];
      const feedbackForLead = lead
        ? feedbackEvents.filter((event) => event.lead_id === lead.id)
        : [];
      const lastManual = lead ? this.latestEventForLead(manualEvents, lead.id) : null;
      const lastFeedback = lead ? this.latestEventForLead(feedbackEvents, lead.id) : null;
      const latest = artifactKind === 'latest';
      const enriched = latest && toNumber(lead?.enriched) === 1;
      const mutable = lead ? {
        id: lead.id,
        profile_id: lead.profile_id,
        status: lead.status ?? null,
        review_status: lead.review_status ?? null,
        notes: lead.notes ?? null,
        manual_review_notes_author_label: lead.manual_review_notes_author_label ?? null,
        manual_review_notes_updated_at: lead.manual_review_notes_updated_at ?? null,
        follow_up_date: lead.follow_up_date ?? null,
        estimated_value: lead.estimated_value ?? null,
        version: latest ? (lead.version ?? 1) : null,
        updated_at: latest ? (lead.updated_at ?? null) : null,
        enriched: latest ? (lead.enriched ?? null) : null,
        summary: enriched ? (lead.summary ?? null) : null,
        roi: enriched ? (lead.roi ?? null) : null,
        sales_pitch: enriched ? (lead.sales_pitch ?? null) : null,
        global_context: enriched ? (lead.global_context ?? null) : null,
        urgency_reason: enriched ? (lead.urgency_reason ?? null) : null,
        evidence: enriched ? (lead.evidence ?? null) : null,
        assumptions: enriched ? (lead.assumptions ?? null) : null,
        article_body: enriched ? (lead.article_body ?? null) : null,
        action_items: enriched ? (lead.action_items ?? null) : null,
        key_figures: enriched ? (lead.key_figures ?? null) : null,
        pain_points: enriched ? (lead.pain_points ?? null) : null,
        meddic: enriched ? (lead.meddic ?? null) : null,
        competitive: enriched ? (lead.competitive ?? null) : null,
        buying_signals: enriched ? (lead.buying_signals ?? null) : null,
        enriched_at: enriched ? (lead.enriched_at ?? null) : null,
        snapshot_feedback_lead_id: feedback?.lead_id ?? null,
        snapshot_feedback_action_usefulness: feedback?.action_usefulness ?? null,
        snapshot_feedback_outcome_label: feedback?.outcome_label ?? null,
        snapshot_feedback_data_gap_priority: feedback?.data_gap_priority ?? null,
        snapshot_feedback_confidence_adjustment: feedback?.evidence_confidence_adjustment ?? null,
        snapshot_feedback_text: feedback?.feedback_text ?? null,
        snapshot_feedback_next_action: feedback?.next_reviewer_action ?? null,
        snapshot_feedback_author_label: feedback?.author_label ?? null,
        snapshot_feedback_updated_at: feedback?.updated_at ?? null,
        snapshot_manual_event_count: manualForLead.length,
        snapshot_manual_last_event_type: lastManual?.event_type ?? null,
        snapshot_manual_last_event_at: lastManual?.changed_at ?? null,
        snapshot_manual_last_author_label: lastManual?.author_label ?? null,
        snapshot_feedback_event_count: feedbackForLead.length,
        snapshot_feedback_last_event_type: lastFeedback?.event_type ?? null,
        snapshot_feedback_last_event_at: lastFeedback?.changed_at ?? null,
        snapshot_feedback_last_author_label: lastFeedback?.author_label ?? null,
      } : null;
      const mutableRawBytes = mutable && snapshotWithinSqlReadLimits
        ? Object.values(mutable).reduce(
          (total, value) => total + UTF8_ENCODER.encode(String(value ?? '')).byteLength,
          0
        )
        : 0;
      const mutableJson = mutable
        && snapshotWithinSqlReadLimits
        && mutableRawBytes <= PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES
        ? JSON.stringify(mutable)
        : null;
      const mutableJsonBytes = UTF8_ENCODER.encode(String(mutableJson || '')).byteLength;
      return {
        entry,
        profileCollision,
        mutableRawBytes,
        mutableJson,
        mutableJsonBytes,
      };
    });
    const profileCollisionCount = overlayCandidates.some(({ profileCollision }) => profileCollision)
      ? 1
      : 0;
    const maxMutableRawBytes = Math.max(0, ...overlayCandidates.map(({ mutableRawBytes }) => mutableRawBytes));
    const aggregateMutableRawBytes = overlayCandidates.reduce(
      (total, { mutableRawBytes }) => total + mutableRawBytes,
      0
    );
    if (profileCollisionCount > 0 || aggregateMutableRawBytes > PUBLISHED_SNAPSHOT_MUTABLE_RAW_AGGREGATE_MAX_UTF8_BYTES) {
      for (const candidate of overlayCandidates) {
        candidate.mutableJson = null;
        candidate.mutableJsonBytes = 0;
      }
    }
    const maxMutableJsonBytes = Math.max(0, ...overlayCandidates.map(({ mutableJsonBytes }) => mutableJsonBytes));
    const aggregateMutableJsonBytes = overlayCandidates.reduce(
      (total, { mutableJsonBytes }) => total + mutableJsonBytes,
      0
    );
    const mutableWithinSqlReadLimits = maxMutableRawBytes <= PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES
      && aggregateMutableRawBytes <= PUBLISHED_SNAPSHOT_MUTABLE_RAW_AGGREGATE_MAX_UTF8_BYTES
      && maxMutableJsonBytes <= PUBLISHED_SNAPSHOT_MUTABLE_JSON_MAX_UTF8_BYTES
      && aggregateMutableJsonBytes <= PUBLISHED_SNAPSHOT_MUTABLE_AGGREGATE_MAX_UTF8_BYTES;

    const joinedRow = (candidate) => {
      const entry = candidate?.entry || null;
      const payloadBytes = entry
        ? UTF8_ENCODER.encode(String(entry.payload_json || '')).byteLength
        : null;
      const persistedRowBytes = entry
        ? publishedSnapshotEntryRowUtf8Bytes({
          profileId: entry.profile_id,
          artifactKind: entry.artifact_kind,
          snapshotId: entry.snapshot_id,
          leadId: entry.lead_id,
          payloadJson: entry.payload_json,
        })
        : null;
      const payloadVisible = entry && snapshotWithinSqlReadLimits && profileCollisionCount === 0;
      const mutableVisible = payloadVisible && mutableWithinSqlReadLimits;
      return {
        snapshot_head_id: head.snapshot_id,
        snapshot_fetched_at: head.fetched_at,
        snapshot_entry_lead_id: entry?.lead_id ?? null,
        snapshot_payload_json: payloadVisible ? entry.payload_json : null,
        snapshot_payload_bytes: payloadBytes,
        snapshot_max_payload_bytes: entry ? maxPayloadBytes : 0,
        snapshot_persisted_row_bytes: persistedRowBytes,
        snapshot_max_persisted_row_bytes: entry ? maxPersistedRowBytes : 0,
        snapshot_aggregate_payload_bytes: entry ? aggregatePayloadBytes : 0,
        snapshot_entry_count: entryCount,
        snapshot_entry_ordinal: entry?.ordinal ?? null,
        snapshot_profile_collision_count: profileCollisionCount,
        snapshot_max_mutable_raw_bytes: maxMutableRawBytes,
        snapshot_aggregate_mutable_raw_bytes: aggregateMutableRawBytes,
        snapshot_max_mutable_json_bytes: maxMutableJsonBytes,
        snapshot_aggregate_mutable_json_bytes: aggregateMutableJsonBytes,
        snapshot_mutable_json: mutableVisible ? candidate.mutableJson : null,
        snapshot_mutable_json_bytes: candidate?.mutableJsonBytes || 0,
      };
    };

    return overlayCandidates.length > 0
      ? overlayCandidates.map(joinedRow)
      : [joinedRow(null)];
  }

  async executeFirst(sql, args) {
    const normalized = normalizeSql(sql);

    if (
      normalized.startsWith('create table') ||
      normalized.startsWith('create unique index') ||
      normalized.startsWith('create index') ||
      normalized.startsWith('alter table')
    ) {
      return null;
    }

    if (normalized === 'select version from d1_schema_migrations order by version desc limit 1') {
      return this.schemaVersion === null || this.schemaVersion === undefined
        ? null
        : { version: this.schemaVersion };
    }

    if (normalized === 'select snapshot_id, fetched_at from published_snapshot_heads where profile_id = ? and artifact_kind = ?') {
      return clone(this.publishedSnapshotHeads.get(snapshotKey(args[0], args[1])) || null);
    }

    if (normalized === 'select * from leads where id = ?') {
      return clone(this.leads.get(args[0]) || null);
    }

    if (normalized === 'select * from job_callback_events where request_id = ? and idempotency_key = ? limit 1') {
      return clone(this.jobCallbackEvents.find((event) => (
        event.request_id === args[0] && event.idempotency_key === args[1]
      )) || null);
    }

    if (normalized === 'select * from reviewer_feedback where lead_id = ?') {
      return clone(this.reviewerFeedback.get(args[0]) || null);
    }

    if (normalized === 'select count(*) as event_count from manual_review_note_events where lead_id = ?') {
      return {
        event_count: this.manualReviewNoteEvents.filter((row) => row.lead_id === args[0]).length,
      };
    }

    if (normalized === 'select count(*) as event_count from reviewer_feedback_events where lead_id = ?') {
      return {
        event_count: this.reviewerFeedbackEvents.filter((row) => row.lead_id === args[0]).length,
      };
    }

    if (normalized === 'select event_type, changed_at, author_label from reviewer_feedback_events where lead_id = ? order by changed_at desc, id desc limit 1') {
      const row = this.reviewerFeedbackEvents
        .filter((event) => event.lead_id === args[0])
        .sort((a, b) => {
          const changedOrder = String(b.changed_at || '').localeCompare(String(a.changed_at || ''));
          if (changedOrder !== 0) return changedOrder;
          return Number(b.id || 0) - Number(a.id || 0);
        })[0];
      if (!row) return null;
      return {
        event_type: row.event_type,
        changed_at: row.changed_at,
        author_label: row.author_label,
      };
    }

    if (normalized === 'select event_type, changed_at, author_label from manual_review_note_events where lead_id = ? order by changed_at desc, id desc limit 1') {
      const row = this.manualReviewNoteEvents
        .filter((event) => event.lead_id === args[0])
        .sort((a, b) => {
          const changedOrder = String(b.changed_at || '').localeCompare(String(a.changed_at || ''));
          if (changedOrder !== 0) return changedOrder;
          return Number(b.id || 0) - Number(a.id || 0);
        })[0];
      if (!row) return null;
      return {
        event_type: row.event_type,
        changed_at: row.changed_at,
        author_label: row.author_label,
      };
    }

    if (normalized === 'select * from job_runs where request_id = ? limit 1') {
      return clone(this.jobRuns.get(args[0]) || null);
    }

    if (normalized === 'select * from job_runs where idempotency_key = ? limit 1') {
      return clone(
        [...this.jobRuns.values()].find((row) => row.idempotency_key === args[0]) || null
      );
    }

    if (normalized === "select * from job_runs where profile_id = ? and state in ('accepted', 'running') order by accepted_at asc limit 1") {
      return clone(
        [...this.jobRuns.values()]
          .filter((row) => row.profile_id === args[0] && (row.state === 'accepted' || row.state === 'running'))
          .sort((a, b) => a.accepted_at.localeCompare(b.accepted_at))[0] || null
      );
    }

    throw new Error(`Unsupported fake D1 query SQL: ${sql}`);
  }

  async executeAll(sql, args) {
    const normalized = normalizeSql(sql);

    if (
      normalized.startsWith('create table') ||
      normalized.startsWith('create unique index') ||
      normalized.startsWith('create index') ||
      normalized.startsWith('alter table')
    ) {
      return [];
    }

    if (normalized.startsWith('select version, name from d1_schema_migrations order by version asc limit ')) {
      return this.migrationLedgerRows
        .slice(0, D1_MIGRATION_MANIFEST.length + 1)
        .map(clone);
    }

    if (
      normalized.startsWith("select 'd1_schema_migrations' as table_name")
      && normalized.includes('pragma_table_info')
      && normalized.includes(' union all ')
    ) {
      return this.schemaIntrospectionRows.map(clone);
    }

    if (
      normalized.startsWith('select type, name, tbl_name as table_name, sql from sqlite_schema')
      && normalized.includes("type = 'index' and name in")
    ) {
      return this.schemaObjectRows.map(clone);
    }

    if (
      normalized.startsWith('with selected_head as')
      && normalized.includes('from selected_head h')
    ) {
      return this.publishedSnapshotJoinedRows(args[0], args[1], args[2], args[3]);
    }

    if (normalized === 'select lead_id, payload_json from published_snapshot_entries where profile_id = ? and artifact_kind = ? and snapshot_id = ? order by ordinal asc') {
      return this.publishedSnapshotEntries
        .filter((entry) => (
          entry.profile_id === args[0]
          && entry.artifact_kind === args[1]
          && entry.snapshot_id === args[2]
        ))
        .sort((a, b) => a.ordinal - b.ordinal)
        .map(({ lead_id, payload_json }) => ({ lead_id, payload_json }));
    }

    if (normalized === 'select * from leads where profile_id = ? order by created_at desc limit ? offset ?') {
      const [profileId, limit, offset] = args;
      return sortByCreatedDesc([...this.leads.values()].filter((row) => row.profile_id === profileId))
        .slice(offset, offset + limit)
        .map(clone);
    }

    if (normalized === 'select * from leads where profile_id = ? and (enriched is null or enriched = 0) order by score desc limit 3') {
      const [profileId] = args;
      return [...this.leads.values()]
        .filter((row) => row.profile_id === profileId && toNumber(row.enriched) === 0)
        .sort((a, b) => toNumber(b.score) - toNumber(a.score))
        .slice(0, 3)
        .map(clone);
    }

    if (normalized === 'select * from leads where profile_id = ? and status = ? order by created_at desc limit ? offset ?') {
      const [profileId, status, limit, offset] = args;
      return sortByCreatedDesc([...this.leads.values()].filter((row) => row.profile_id === profileId && row.status === status))
        .slice(offset, offset + limit)
        .map(clone);
    }

    if (normalized === 'select * from leads where 1=1 order by created_at desc limit ? offset ?') {
      const [limit, offset] = args;
      return sortByCreatedDesc([...this.leads.values()])
        .slice(offset, offset + limit)
        .map(clone);
    }

    if (normalized === 'select * from leads where 1=1 and status = ? order by created_at desc limit ? offset ?') {
      const [status, limit, offset] = args;
      return sortByCreatedDesc([...this.leads.values()].filter((row) => row.status === status))
        .slice(offset, offset + limit)
        .map(clone);
    }

    if (normalized.startsWith('select count(*) as cnt from leads')) {
      let rows = this.leadRowsForSql(normalized, args);
      if (normalized.includes("grade = 'a'")) {
        rows = rows.filter((row) => String(row.grade || '').toUpperCase() === 'A');
      }
      if (normalized.includes("status = 'won'")) {
        rows = rows.filter((row) => isSameStatus(row, 'WON'));
      }
      if (normalized.includes('created_at >= ?')) {
        const cutoff = args.at(-1);
        rows = rows.filter((row) => String(row.created_at || '') >= cutoff);
      }
      return [{ cnt: rows.length }];
    }

    if (normalized.startsWith('select status, count(*) as cnt from leads')) {
      const grouped = this.groupRows(this.leadRowsForSql(normalized, args), (row) => row.status || '', () => 1);
      return [...grouped.entries()].map(([status, cnt]) => ({ status, cnt }));
    }

    if (normalized.startsWith('select sl.from_status, sl.to_status, sl.changed_at, l.company from status_log sl join leads l')) {
      return this.joinedStatusLogsForSql(normalized, args)
        .sort((a, b) => String(b.log.changed_at || '').localeCompare(String(a.log.changed_at || '')))
        .slice(0, 10)
        .map(({ log, lead }) => ({
          from_status: log.from_status,
          to_status: log.to_status,
          changed_at: log.changed_at,
          company: lead.company,
        }));
    }

    if (normalized.startsWith('select type, count(*) as cnt, sum(leads_count) as total_leads from analytics')) {
      const profileId = normalized.includes('where profile_id = ?') ? args[0] : null;
      const rows = profileId
        ? this.analytics.filter((row) => row.profile_id === profileId)
        : this.analytics;
      const grouped = new Map();
      for (const row of rows) {
        const current = grouped.get(row.type) || { type: row.type, cnt: 0, total_leads: 0 };
        current.cnt += 1;
        current.total_leads += toNumber(row.leads_count);
        grouped.set(row.type, current);
      }
      return [...grouped.values()];
    }

    if (normalized.startsWith('select sl.lead_id, sl.from_status, sl.to_status, sl.changed_at from status_log sl join leads l')) {
      return this.joinedStatusLogsForSql(normalized, args)
        .sort((a, b) => String(a.log.changed_at || '').localeCompare(String(b.log.changed_at || '')))
        .map(({ log }) => ({
          lead_id: log.lead_id,
          from_status: log.from_status,
          to_status: log.to_status,
          changed_at: log.changed_at,
        }));
    }

    if (normalized.startsWith('select status, sum(estimated_value) as total_value from leads')) {
      const grouped = this.groupRows(
        this.leadRowsForSql(normalized, args),
        (row) => row.status || '',
        (row) => toNumber(row.estimated_value)
      );
      return [...grouped.entries()].map(([status, total_value]) => ({ status, total_value }));
    }

    if (normalized.startsWith('select id, company, follow_up_date, status from leads')) {
      const cutoff = args.at(-1);
      return this.leadRowsForSql(normalized, args)
        .filter((row) => row.follow_up_date && row.follow_up_date <= cutoff && !isTerminalStatus(row))
        .sort((a, b) => String(a.follow_up_date || '').localeCompare(String(b.follow_up_date || '')))
        .slice(0, 20)
        .map((row) => ({
          id: row.id,
          company: row.company,
          follow_up_date: row.follow_up_date,
          status: row.status,
        }));
    }

    if (normalized.startsWith("select id, grade, estimated_value, created_at, (select max(changed_at) from status_log where lead_id=l.id and to_status='won') as won_at from leads l")) {
      return this.leadRowsForSql(normalized, args)
        .filter((row) => isSameStatus(row, 'WON'))
        .map((row) => ({
          id: row.id,
          grade: row.grade,
          estimated_value: row.estimated_value,
          created_at: row.created_at,
          won_at: this.maxStatusChangedAt(row.id, 'WON'),
        }));
    }

    if (normalized.startsWith("select id, grade, estimated_value, created_at, (select max(changed_at) from status_log where lead_id=l.id and to_status='lost') as lost_at from leads l")) {
      return this.leadRowsForSql(normalized, args)
        .filter((row) => isSameStatus(row, 'LOST'))
        .map((row) => ({
          id: row.id,
          grade: row.grade,
          estimated_value: row.estimated_value,
          created_at: row.created_at,
          lost_at: this.maxStatusChangedAt(row.id, 'LOST'),
        }));
    }

    if (normalized.startsWith('select count(*) as total_enriched, sum(case when meddic')) {
      const rows = this.leadRowsForSql(normalized, args).filter((row) => toNumber(row.enriched) === 1);
      const hasMeddic = rows.filter((row) => {
        const meddic = row.meddic;
        return meddic !== undefined && meddic !== null && meddic !== '' && meddic !== '{}';
      }).length;
      return [{ total_enriched: rows.length, has_meddic: hasMeddic }];
    }

    if (normalized.startsWith('select pain_points, competitive, estimated_value, meddic from leads')) {
      return this.leadRowsForSql(normalized, args)
        .filter((row) => toNumber(row.enriched) === 1 && !isTerminalStatus(row))
        .slice(0, 200)
        .map((row) => ({
          pain_points: row.pain_points,
          competitive: row.competitive,
          estimated_value: row.estimated_value,
          meddic: row.meddic,
        }));
    }

    if (normalized === 'select * from status_log where lead_id = ? order by changed_at asc') {
      return this.statusLog
        .filter((row) => row.lead_id === args[0])
        .sort((a, b) => String(a.changed_at || '').localeCompare(String(b.changed_at || '')))
        .map(clone);
    }

    const job = await this.executeFirst(sql, args);
    return job ? [job] : [];
  }
}
