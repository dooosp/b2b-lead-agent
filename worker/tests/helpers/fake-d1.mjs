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
    return this.db.executeRun(this.sql, this.args);
  }

  async first() {
    return this.db.executeFirst(this.sql, this.args);
  }

  async all() {
    return { results: await this.db.executeAll(this.sql, this.args) };
  }
}

function clone(row) {
  return row ? { ...row } : null;
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
    failOnSql
  } = {}) {
    this.leads = new Map(leads.map((row) => [row.id, { ...row }]));
    this.jobRuns = new Map(jobRuns.map((row) => [row.request_id, { ...row }]));
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
    this.schemaStatements = [];
    this.failOnSql = failOnSql;
  }

  prepare(sql) {
    if (this.shouldFail(sql)) {
      throw new Error('fake D1 forced failure');
    }
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      const normalized = normalizeSql(statement.sql);
      if (normalized.startsWith('select ')) {
        results.push({ results: await this.executeAll(statement.sql, statement.args) });
      } else {
        results.push(await statement.run());
      }
    }
    return results;
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

  upsertLead(row) {
    const existing = this.leads.get(row.id);
    if (!existing) {
      this.leads.set(row.id, row);
      return { meta: { changes: 1 } };
    }

    Object.assign(existing, {
      identity_key: row.identity_key,
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
      updated_at: row.updated_at,
    });
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
      return this.upsertLead(toLeadInsertRow(args));
    }

    if (normalized.startsWith('update leads set ') && normalized.endsWith(' where id = ?')) {
      const id = args.at(-1);
      const row = this.leads.get(id);
      if (!row) return { meta: { changes: 0 }, success: false };

      const setClause = normalized.slice('update leads set '.length, normalized.lastIndexOf(' where id = ?'));
      const columns = setClause.split(',').map((part) => part.trim().split(' = ')[0]);
      columns.forEach((column, index) => {
        row[column] = args[index];
      });
      this.leads.set(id, row);
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

    if (normalized === 'delete from reviewer_feedback where lead_id = ?') {
      const deleted = this.reviewerFeedback.delete(args[0]);
      return { meta: { changes: deleted ? 1 : 0 }, success: true };
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
      if (!row) {
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

    if (normalized === 'select * from leads where id = ?') {
      return clone(this.leads.get(args[0]) || null);
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
