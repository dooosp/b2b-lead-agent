import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JOB_STATES,
  JOB_TARGETS,
  createAcceptedJobRun,
  getJobRunByRequestId,
  updateJobRunState
} from '../db/job-runs.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';

test('createAcceptedJobRun coalesces duplicate active runs by profile', async () => {
  const db = new FakeD1Database();

  const first = await createAcceptedJobRun(db, {
    requestId: 'req_first',
    profileId: 'danfoss',
    target: JOB_TARGETS.GITHUB_ACTIONS
  });
  const second = await createAcceptedJobRun(db, {
    requestId: 'req_second',
    profileId: 'danfoss',
    target: JOB_TARGETS.GITHUB_ACTIONS
  });

  assert.equal(first.outcome, 'created');
  assert.equal(second.outcome, 'existing-active');
  assert.equal(second.job.requestId, 'req_first');
  assert.equal(second.job.state, JOB_STATES.ACCEPTED);
});

test('createAcceptedJobRun honors Idempotency-Key even after terminal completion', async () => {
  const db = new FakeD1Database();

  const first = await createAcceptedJobRun(db, {
    requestId: 'req_first',
    profileId: 'siemens',
    target: JOB_TARGETS.GITHUB_ACTIONS,
    idempotencyKey: 'idem-123'
  });
  await updateJobRunState(db, 'req_first', { state: JOB_STATES.SUCCEEDED });

  const second = await createAcceptedJobRun(db, {
    requestId: 'req_second',
    profileId: 'siemens',
    target: JOB_TARGETS.GITHUB_ACTIONS,
    idempotencyKey: 'idem-123'
  });

  assert.equal(second.outcome, 'existing-idempotency');
  assert.equal(second.job.requestId, 'req_first');
  assert.equal(second.job.state, JOB_STATES.SUCCEEDED);
});

test('createAcceptedJobRun expires stale active rows before retrying the insert', async () => {
  const db = new FakeD1Database();

  const first = await createAcceptedJobRun(db, {
    requestId: 'req_stale_1',
    profileId: 'danfoss',
    target: JOB_TARGETS.GITHUB_ACTIONS,
    acceptedAt: '2026-03-26T00:00:00.000Z',
    activeTtlMs: 0
  });
  const second = await createAcceptedJobRun(db, {
    requestId: 'req_stale_2',
    profileId: 'danfoss',
    target: JOB_TARGETS.GITHUB_ACTIONS,
    acceptedAt: '2026-03-26T00:10:00.000Z',
    activeTtlMs: 0
  });

  const stale = await getJobRunByRequestId(db, first.job.requestId);
  assert.equal(second.outcome, 'created');
  assert.equal(second.job.requestId, 'req_stale_2');
  assert.equal(stale.state, JOB_STATES.FAILED);
  assert.match(stale.lastError || '', /expired/i);
});

test('updateJobRunState keeps correlation metadata for both GitHub and Cloud Run targets', async () => {
  const db = new FakeD1Database();

  await createAcceptedJobRun(db, {
    requestId: 'req_github',
    profileId: 'danfoss',
    target: JOB_TARGETS.GITHUB_ACTIONS
  });
  await updateJobRunState(db, 'req_github', {
    state: JOB_STATES.RUNNING,
    githubRunId: 42,
    githubRunAttempt: 3,
    githubRunUrl: 'https://github.example/runs/42',
    githubWorkflow: 'Generate B2B Lead Report',
    githubSha: 'abc123'
  });

  const githubJob = await getJobRunByRequestId(db, 'req_github');
  assert.equal(githubJob.state, JOB_STATES.RUNNING);
  assert.equal(githubJob.run.id, 42);
  assert.equal(githubJob.run.attempt, 3);
  assert.equal(githubJob.run.url, 'https://github.example/runs/42');
  assert.equal(githubJob.run.workflow, 'Generate B2B Lead Report');

  await updateJobRunState(db, 'req_github', { state: JOB_STATES.SUCCEEDED });

  const secondDb = new FakeD1Database();
  await createAcceptedJobRun(secondDb, {
    requestId: 'req_cloud',
    profileId: 'ls-electric',
    target: JOB_TARGETS.CLOUD_RUN
  });
  await updateJobRunState(secondDb, 'req_cloud', {
    state: JOB_STATES.RUNNING,
    cloudRunOperation: 'operations/123',
    cloudRunExecution: 'executions/456'
  });
  await updateJobRunState(secondDb, 'req_cloud', {
    state: JOB_STATES.SUCCEEDED,
    cloudRunOperation: 'operations/123',
    cloudRunExecution: 'executions/456'
  });

  const cloudJob = await getJobRunByRequestId(secondDb, 'req_cloud');
  assert.equal(cloudJob.state, JOB_STATES.SUCCEEDED);
  assert.equal(cloudJob.operation, 'operations/123');
  assert.equal(cloudJob.execution, 'executions/456');
});
