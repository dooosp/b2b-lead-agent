const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const SESSION_RELATIVE_DIRECTORY = 'tmp/pursuit-workbench-human-validation';
const SESSION_FILES = ['session-r1.json', 'session-r2.json', 'session-r3.json', 'session-r4.json', 'session-r5.json'];
const HARNESS_FILES = [
  'pursuit-workbench/domain/human-validation.mjs',
  'scripts/lib/pursuit-workbench-human-validation-files.mjs',
  'scripts/prepare-pursuit-workbench-human-validation.mjs',
  'scripts/validate-pursuit-workbench-human-validation.mjs',
  'package-lock.json',
  'pursuit-workbench/fixtures/datacenter-workbench-v0.json',
  'docs/product/datacenter-pursuit-workbench-v0-review-guide.md'
];

function createHarness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pursuit-human-validation-'));
  for (const relativePath of HARNESS_FILES) {
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, relativePath), destination);
  }
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runCli(root, script, args = []) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: process.env.PATH || '' }
  });
}

function prepare(root) {
  const result = runCli(root, 'prepare-pursuit-workbench-human-validation.mjs');
  assert.equal(result.status, 0, result.stdout || result.stderr);
  return JSON.parse(result.stdout);
}

function sessionPath(root, reviewerNumber) {
  return path.join(root, SESSION_RELATIVE_DIRECTORY, `session-r${reviewerNumber}.json`);
}

function readSession(root, reviewerNumber) {
  return JSON.parse(fs.readFileSync(sessionPath(root, reviewerNumber), 'utf8'));
}

function writeSession(root, reviewerNumber, record) {
  const target = sessionPath(root, reviewerNumber);
  fs.writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(target, 0o600);
}

function completeSession(record, index) {
  record.reviewer.actualRole = record.reviewer.targetRole;
  record.reviewer.experienceBand = index % 2 ? '5_9_YEARS' : '10_PLUS_YEARS';
  record.reviewer.sessionDate = `2026-07-${String(10 + index).padStart(2, '0')}`;
  record.session.status = 'COMPLETED';
  record.session.eligible = true;
  record.confirmations.runtimeShaConfirmed = true;
  record.confirmations.artifactHashesConfirmed = true;
  record.confirmations.cleanWorktreeConfirmed = true;
  record.confirmations.syntheticOnlyBoundaryConfirmed = true;
  record.confirmations.productionOrRealDataActionPerformed = false;
  for (const task of Object.values(record.taskResults)) {
    task.outcome = 'COMPLETED_WITHOUT_HELP';
    task.timeToFirstCorrectInterpretationSeconds = 30;
    task.totalTimeSeconds = 60;
    task.helpLevel = 'NONE';
  }
  record.taskResults.T2.fitTreatedAsCommercialApproval = false;
  record.taskResults.T4.allowedClaimCheckPassed = true;
  record.taskResults.T4.blockedClaimCheckPassed = true;
  record.taskResults.T4.favorableConflictedValueSelected = false;
  record.taskResults.T5.technicalQuestionUsefulness = 'YES';
  record.taskResults.T6.packetUnderstoodAsLocalNotSaved = true;
  record.taskResults.T6.packetUnderstoodAsNotSentOrApproved = true;
  for (const judgment of Object.values(record.scenarioJudgments)) {
    judgment.reviewerOutcome = judgment.systemOutcome;
    judgment.exactAgreement = true;
  }
  record.postSession.specificationWindowDistinguishedFromFit = true;
  record.postSession.claimBoundaryReliablyDistinguished = true;
  record.postSession.technicalQuestionUsefulness = 'YES';
  record.postSession.wouldUseInInternalPursuitReview = 'YES';
  record.postSession.totalReviewDurationSeconds = 600;
  record.postSession.credibleCurrentMethodBaselineSeconds = 1_200;
  return record;
}

function completeAll(root) {
  for (let index = 1; index <= 5; index += 1) writeSession(root, index, completeSession(readSession(root, index), index));
}

function validate(root) {
  return runCli(root, 'validate-pursuit-workbench-human-validation.mjs');
}

test('prepare creates only the exact R1-R5 files privately and refuses overwrite or path arguments', (t) => {
  const root = createHarness(t);
  const report = prepare(root);
  assert.equal(report.status, 'PREPARED');
  assert.equal(report.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(report.productionReady, false);
  assert.equal(report.productionReviewerWorkflowReady, false);
  assert.equal(report.issue165Status, 'HOLD');
  assert.equal(report.decision, 'INCOMPLETE');
  assert.deepEqual(report.recordIds, ['R1', 'R2', 'R3', 'R4', 'R5']);
  const directory = path.join(root, SESSION_RELATIVE_DIRECTORY);
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
  assert.deepEqual(fs.readdirSync(directory).sort(), SESSION_FILES);
  for (const filename of SESSION_FILES) assert.equal(fs.statSync(path.join(directory, filename)).mode & 0o777, 0o600);

  const second = runCli(root, 'prepare-pursuit-workbench-human-validation.mjs');
  assert.equal(second.status, 1);
  assert.deepEqual(JSON.parse(second.stdout).failureCodes, ['SESSION_PREPARE_REFUSES_OVERWRITE']);
  const alternate = runCli(root, 'prepare-pursuit-workbench-human-validation.mjs', ['--output', path.join(root, 'other')]);
  assert.equal(alternate.status, 1);
  assert.deepEqual(JSON.parse(alternate.stdout).failureCodes, ['SESSION_CLI_ARGUMENT_REFUSED']);
});

test('untouched truthful skeletons validate as INCOMPLETE without fabricated eligibility', (t) => {
  const root = createHarness(t);
  prepare(root);
  const result = validate(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'INCOMPLETE');
  assert.equal(report.decision, 'INCOMPLETE');
  assert.equal(report.productionReady, false);
  assert.equal(report.productionReviewerWorkflowReady, false);
  assert.equal(report.issue165Status, 'HOLD');
  assert.equal(report.counts.eligibleReviewerCount, 0);
  assert.equal(report.counts.taskResultCount, 0);
  assert.equal(report.thresholds.summary, 'INCOMPLETE');
});

test('blank skeleton validation is independent of JSON object key order', (t) => {
  const root = createHarness(t);
  prepare(root);
  const record = readSession(root, 1);
  writeSession(root, 1, Object.fromEntries(Object.entries(record).reverse()));
  const result = validate(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'INCOMPLETE');
});

test('five eligible completed synthetic-local records produce aggregate metrics but require a human decision', (t) => {
  const root = createHarness(t);
  prepare(root);
  completeAll(root);
  const result = validate(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'COMPLETE_FOR_HUMAN_DECISION');
  assert.equal(report.decision, 'HUMAN_DECISION_REQUIRED');
  assert.equal(report.counts.eligibleReviewerCount, 5);
  assert.equal(report.counts.independentTaskCompletionCount, 30);
  assert.equal(report.counts.exactScenarioAgreementCount, 15);
  assert.equal(report.counts.claimBoundarySuccessCount, 10);
  assert.equal(report.rates.independentTaskCompletionRate, 1);
  assert.equal(report.rates.medianTimeReductionRate, 0.5);
  assert.equal(report.durations.medianReviewDurationSeconds, 600);
  assert.equal(report.thresholds.timingGate, 'MET');
  assert.equal(report.thresholds.summary, 'MERGE_THRESHOLDS_MET');
  assert.doesNotMatch(result.stdout, /"decision"\s*:\s*"(?:PASS|MERGE|REVISE|PIVOT)"/);
});

test('unknown fields, duplicate JSON keys, and unsafe descriptor content fail closed without echo', async (t) => {
  await t.test('unknown schema field', () => {
    const root = createHarness(t);
    prepare(root);
    const record = readSession(root, 1);
    record.untrackedNotes = 'benign';
    writeSession(root, 1, record);
    const result = validate(root);
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_SCHEMA_KEYS_INVALID']);
  });
  await t.test('duplicate JSON key', () => {
    const root = createHarness(t);
    prepare(root);
    const target = sessionPath(root, 1);
    const text = fs.readFileSync(target, 'utf8').replace(
      '"schemaVersion": "datacenter-pursuit-workbench-human-validation-session-v1",',
      '"schemaVersion": "datacenter-pursuit-workbench-human-validation-session-v1",\n  "schemaVersion": "datacenter-pursuit-workbench-human-validation-session-v1",'
    );
    fs.writeFileSync(target, text);
    const result = validate(root);
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_JSON_DUPLICATE_KEY']);
  });
  await t.test('identity, URL, phone, and secret shapes never echo', () => {
    const poisons = [
      'person@example.test',
      'https://private.example.test/review',
      '010-1234-5678',
      'Authorization: Bearer human-validation-secret-value'
    ];
    for (const poison of poisons) {
      const root = createHarness(t);
      prepare(root);
      const record = readSession(root, 1);
      record.session.status = 'IN_PROGRESS';
      record.postSession.mostConfusingAreaDescriptor = poison;
      writeSession(root, 1, record);
      const result = validate(root);
      assert.equal(result.status, 1);
      assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_PROTECTED_CONTENT_REFUSED']);
      assert.equal(result.stdout.includes(poison), false);
      assert.equal(result.stderr.includes(poison), false);
    }
  });
});

test('fixed directory rejects extra, symlink, non-regular, and unsafe-permission files', async (t) => {
  await t.test('extra file', () => {
    const root = createHarness(t);
    prepare(root);
    fs.writeFileSync(path.join(root, SESSION_RELATIVE_DIRECTORY, 'extra.json'), '{}', { mode: 0o600 });
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_FILE_SET_INVALID']);
  });
  await t.test('symlink', () => {
    const root = createHarness(t);
    prepare(root);
    const target = sessionPath(root, 1);
    fs.unlinkSync(target);
    fs.symlinkSync(sessionPath(root, 2), target);
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_FILE_SYMLINK_REFUSED']);
  });
  await t.test('non-regular file', () => {
    const root = createHarness(t);
    prepare(root);
    const target = sessionPath(root, 1);
    fs.unlinkSync(target);
    fs.mkdirSync(target, { mode: 0o700 });
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_FILE_NON_REGULAR']);
  });
  await t.test('unsafe permissions', () => {
    const root = createHarness(t);
    prepare(root);
    fs.chmodSync(sessionPath(root, 1), 0o644);
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_FILE_PERMISSIONS_UNSAFE']);
  });
  await t.test('invalid UTF-8', () => {
    const root = createHarness(t);
    prepare(root);
    fs.appendFileSync(sessionPath(root, 1), Buffer.from([0xff]));
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_FILE_UTF8_INVALID']);
  });
  await t.test('file mutation after safe open', async () => {
    const root = createHarness(t);
    prepare(root);
    const helperUrl = `${pathToFileURL(path.join(root, 'scripts/lib/pursuit-workbench-human-validation-files.mjs')).href}?race=${Date.now()}`;
    const helper = await import(helperUrl);
    assert.throws(
      () => helper.loadAndAggregateHumanValidationSessionFiles({
        afterFileOpenForTest(target) { fs.appendFileSync(target, ' '); }
      }),
      (error) => error?.code === 'SESSION_FILE_RACE_REFUSED'
    );
  });
});

test('runtime, record hash, and frozen artifact drift are rejected', async (t) => {
  await t.test('runtime SHA', () => {
    const root = createHarness(t);
    prepare(root);
    const record = readSession(root, 1);
    record.productRuntime.sha = '0'.repeat(40);
    writeSession(root, 1, record);
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_RUNTIME_SHA_INVALID']);
  });
  await t.test('record artifact hash', () => {
    const root = createHarness(t);
    prepare(root);
    const record = readSession(root, 1);
    record.productRuntime.artifactSha256['package-lock.json'] = '0'.repeat(64);
    writeSession(root, 1, record);
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_ARTIFACT_HASH_INVALID']);
  });
  await t.test('on-disk frozen artifact', () => {
    const root = createHarness(t);
    prepare(root);
    fs.appendFileSync(path.join(root, 'pursuit-workbench/fixtures/datacenter-workbench-v0.json'), '\n');
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['FROZEN_ARTIFACT_HASH_MISMATCH']);
  });
});

test('session dates must be exact calendar dates', (t) => {
  const root = createHarness(t);
  prepare(root);
  completeAll(root);
  const record = readSession(root, 1);
  record.reviewer.sessionDate = '2026-02-30';
  writeSession(root, 1, record);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_DATE_INVALID']);
});

test('reviewer, task, scenario, and cross-record consistency failures are rejected', async (t) => {
  await t.test('duplicate reviewer coverage', () => {
    const root = createHarness(t);
    prepare(root);
    const r1 = readSession(root, 1);
    const r2 = readSession(root, 2);
    r2.reviewer.reviewerId = r1.reviewer.reviewerId;
    r2.reviewer.targetRole = r1.reviewer.targetRole;
    writeSession(root, 2, r2);
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_FILENAME_REVIEWER_MISMATCH']);
  });
  await t.test('role coverage', () => {
    const root = createHarness(t);
    prepare(root);
    completeAll(root);
    const record = readSession(root, 3);
    record.reviewer.actualRole = 'INDUSTRIAL_TECHNICAL_SALES';
    writeSession(root, 3, record);
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_REVIEWER_COVERAGE_INVALID']);
  });
  await t.test('task and scenario coverage', () => {
    const root = createHarness(t);
    prepare(root);
    const record = readSession(root, 1);
    record.taskResults.T4.scenarioIds.reverse();
    writeSession(root, 1, record);
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_COVERAGE_INVALID']);
  });
  await t.test('derived agreement inconsistency', () => {
    const root = createHarness(t);
    prepare(root);
    completeAll(root);
    const record = readSession(root, 1);
    record.scenarioJudgments.strong_verified_electrical_fit.exactAgreement = false;
    writeSession(root, 1, record);
    const result = validate(root);
    assert.deepEqual(JSON.parse(result.stdout).failureCodes, ['SESSION_SCENARIO_AGREEMENT_INCONSISTENT']);
  });
});

test('valid negative observations lower metrics instead of being rejected', (t) => {
  const root = createHarness(t);
  prepare(root);
  completeAll(root);
  const record = readSession(root, 1);
  record.taskResults.T3.outcome = 'NOT_COMPLETED';
  record.taskResults.T3.timeToFirstCorrectInterpretationSeconds = null;
  record.taskResults.T3.findingIds = ['HV-R1-001'];
  record.findings.push({
    findingId: 'HV-R1-001', reviewerId: 'R1', taskId: 'T3',
    scenarioId: 'hard_voltage_mismatch', severity: 'P2', category: 'FIT_EXPLANATION',
    observationType: 'TASK_FAILURE', reasonCode: 'HARD_MISMATCH_NOT_FOUND',
    observationDescriptor: null, candidateCorrectionDescriptor: null,
    evidenceBackedP0P1FixCandidate: false, requiresSeparateProductDecision: false,
    resolved: false
  });
  writeSession(root, 1, record);
  const result = validate(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.counts.independentTaskCompletionCount, 29);
  assert.equal(report.findingSeverityCounts.P2, 1);
  assert.equal(report.status, 'COMPLETE_FOR_HUMAN_DECISION');
});

test('a resolved serious misunderstanding remains historical threshold evidence while unresolved counts clear', (t) => {
  const root = createHarness(t);
  prepare(root);
  completeAll(root);
  const record = readSession(root, 1);
  record.findings.push({
    findingId: 'HV-R1-001', reviewerId: 'R1', taskId: 'POST_SESSION',
    scenarioId: 'MULTIPLE', severity: 'P1', category: 'SPECIFICATION_WINDOW',
    observationType: 'MISUNDERSTANDING', reasonCode: 'SPEC_WINDOW_CONFUSED_WITH_FIT',
    observationDescriptor: null, candidateCorrectionDescriptor: null,
    evidenceBackedP0P1FixCandidate: true, requiresSeparateProductDecision: false,
    resolved: true
  });
  writeSession(root, 1, record);
  const result = validate(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.counts.seriousMisunderstandingCount, 1);
  assert.equal(report.counts.unresolvedP1Count, 0);
  assert.equal(report.thresholds.seriousMisunderstandings, 'NOT_MET');
  assert.equal(report.thresholds.unresolvedP1, 'MET');
  assert.equal(report.thresholds.summary, 'MERGE_THRESHOLDS_NOT_MET');
});

test('help/outcome and negative-observation consistency is enforced without rejecting truthful assisted results', (t) => {
  const root = createHarness(t);
  prepare(root);
  completeAll(root);
  const record = readSession(root, 1);
  record.taskResults.T2.outcome = 'COMPLETED_WITH_HELP';
  record.taskResults.T2.helpLevel = 'CLARIFY_PROMPT_ONLY';
  writeSession(root, 1, record);
  const valid = validate(root);
  assert.equal(valid.status, 0, valid.stdout || valid.stderr);

  const inconsistent = readSession(root, 1);
  inconsistent.taskResults.T2.outcome = 'COMPLETED_WITHOUT_HELP';
  inconsistent.taskResults.T2.helpLevel = 'NONE';
  inconsistent.taskResults.T2.fitTreatedAsCommercialApproval = true;
  writeSession(root, 1, inconsistent);
  const refused = validate(root);
  assert.equal(refused.status, 1);
  assert.deepEqual(JSON.parse(refused.stdout).failureCodes, ['SESSION_TASK_OUTCOME_OBSERVATION_INCONSISTENT']);
  assert.equal(JSON.parse(refused.stdout).productionReady, false);
});
