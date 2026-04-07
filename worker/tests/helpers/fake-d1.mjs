function normalizeSql(sql) {
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
    const first = await this.first();
    return { results: first ? [first] : [] };
  }
}

export class FakeD1Database {
  constructor() {
    this.jobRuns = new Map();
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  async executeRun(sql, args) {
    const normalized = normalizeSql(sql);

    if (
      normalized.startsWith('create table') ||
      normalized.startsWith('create unique index') ||
      normalized.startsWith('create index') ||
      normalized.startsWith('alter table')
    ) {
      return { meta: { changes: 0 } };
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

    if (normalized === 'select * from job_runs where request_id = ? limit 1') {
      return this.clone(this.jobRuns.get(args[0]) || null);
    }

    if (normalized === 'select * from job_runs where idempotency_key = ? limit 1') {
      return this.clone(
        [...this.jobRuns.values()].find((row) => row.idempotency_key === args[0]) || null
      );
    }

    if (normalized === "select * from job_runs where profile_id = ? and state in ('accepted', 'running') order by accepted_at asc limit 1") {
      return this.clone(
        [...this.jobRuns.values()]
          .filter((row) => row.profile_id === args[0] && (row.state === 'accepted' || row.state === 'running'))
          .sort((a, b) => a.accepted_at.localeCompare(b.accepted_at))[0] || null
      );
    }

    throw new Error(`Unsupported fake D1 query SQL: ${sql}`);
  }

  clone(row) {
    return row ? { ...row } : null;
  }
}
