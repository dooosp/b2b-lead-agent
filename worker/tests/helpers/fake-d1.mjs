export function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function uniqueConstraintError(message) {
  const error = new Error(message);
  error.name = 'D1_ERROR';
  return error;
}

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

export class FakeD1Database {
  constructor({ leads = [], jobRuns = [], statusLog = [], failOnSql } = {}) {
    this.leads = new Map(leads.map((row) => [row.id, { ...row }]));
    this.jobRuns = new Map(jobRuns.map((row) => [row.request_id, { ...row }]));
    this.statusLog = statusLog.map((row, index) => ({ id: index + 1, ...row }));
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
      results.push(await statement.run());
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
