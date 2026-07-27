const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRIVATE_RELATIVE_ROOT = 'tmp/pursuit-value-pilot-v0';
const REVIEWER_IDS = ['PV-R1', 'PV-R2', 'PV-R3', 'PV-R4', 'PV-R5'];
const SESSION_FILES = REVIEWER_IDS.map((_, index) => `session-pv-r${index + 1}.json`);
const HTML_FILES = REVIEWER_IDS.map((_, index) => `reviewer-pv-r${index + 1}.html`);
const EXPECTED_FILES = [...HTML_FILES, ...SESSION_FILES, 'team-week-team-1.json'].sort();

const COPY_PATHS = [
  'knowledge/claim-registry',
  'verticals/datacenter',
  'eval/fixtures/spec-fit/datacenter-v0-scenarios.json',
  'scripts/lib/repository-claim-registry.mjs',
  'scripts/lib/pursuit-value-pilot-offline-html.mjs',
  'scripts/lib/pursuit-value-pilot-files.mjs',
  'scripts/prepare-pursuit-value-pilot-v0.mjs',
  'scripts/validate-pursuit-value-pilot-v0.mjs',
];

function createHarness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pursuit-value-pilot-files-'));
  for (const relativePath of COPY_PATHS) {
    const source = path.join(REPO_ROOT, relativePath);
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
  }
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true, mode: 0o755 });
  fs.chmodSync(path.join(root, 'tmp'), 0o755);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runCli(root, script, args = []) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: process.env.PATH || '' },
  });
}

function privateRoot(root) {
  return path.join(root, PRIVATE_RELATIVE_ROOT);
}

function prepare(root) {
  const result = runCli(root, 'prepare-pursuit-value-pilot-v0.mjs');
  assert.equal(result.status, 0, result.stdout || result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function validate(root) {
  return runCli(root, 'validate-pursuit-value-pilot-v0.mjs');
}

function failureCodes(result) {
  assert.equal(result.status, 1, result.stdout || result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout).failureCodes;
}

function writePrivateJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(target, 0o600);
}

function completedSessionHumanInput(context, index) {
  const blank = context.sessions[index];
  const assignment = context.protocol.reviewerAssignments.find(
    (item) => item.reviewerId === blank.reviewerId,
  );
  const binding = context.protocol.caseBindings.find(
    (item) => item.caseId === assignment.assignedTwinCaseId,
  );
  const day = String(index + 1).padStart(2, '0');
  const baselineHour = assignment.presentationOrder === 'BASELINE_FIRST' ? '01' : '02';
  const twinHour = assignment.presentationOrder === 'TWIN_FIRST' ? '01' : '02';
  const humanInput = structuredClone(blank.humanInput);
  Object.assign(humanInput, {
    role: assignment.assignedRole,
    experienceBand: 'Y6_TO_10',
    eligibilityConfirmed: 'YES',
    syntheticOnlyConfirmed: 'YES',
    technicalStateDisposition: 'ACCEPTED_AS_WRITTEN',
    unsupportedCustomerUseClaimObserved: 'NO',
    unsupportedCustomerUseClaimCount: 0,
    wouldUseAgain: 'YES',
    weeklyUseIntent: 'YES',
    willingnessToPay: 'YES',
    decisionImpact: 'IMPROVED',
    finalDisposition: 'ADVANCE',
  });
  Object.assign(humanInput.baseline, {
    startedAt: `2026-07-${day}T${baselineHour}:00:00.000Z`,
    completedAt: `2026-07-${day}T${baselineHour}:10:00.000Z`,
    elapsedSeconds: 600,
    humanDecision: 'PURSUE',
  });
  Object.assign(humanInput.twin, {
    startedAt: `2026-07-${day}T${twinHour}:00:00.000Z`,
    completedAt: `2026-07-${day}T${twinHour}:04:00.000Z`,
    elapsedSeconds: 240,
    humanDecision: 'PURSUE',
    evidenceTraceAttestation: 'YES',
    selectedDecisionTraceRefs: [binding.allowedDecisionTraceRefs[0]],
    gapAssessments: [{
      gapId: binding.allowedGapIds[0],
      materiality: 'KEY',
      priorAwareness: 'NO',
      discoveredBeforeDecision: 'YES',
    }],
  });
  return humanInput;
}

function completedTeamWeekHumanInput() {
  return {
    participationConfirmed: 'YES',
    syntheticOnlyConfirmed: 'YES',
    weekStartedAt: '2026-07-01T00:00:00.000Z',
    weekCompletedAt: '2026-07-07T23:59:59.000Z',
    packetUseCount: 5,
    repeatUseObserved: 'YES',
  };
}

test('prepare creates exactly five blank sessions, five offline pages, and one team week privately', (t) => {
  const root = createHarness(t);
  const report = prepare(root);
  assert.equal(report.documentStatus, 'PREPARED_FOR_HUMAN_SESSIONS');
  assert.equal(report.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(report.productionReady, false);
  assert.equal(report.issue165Status, 'HOLD');
  assert.equal(report.humanEvidenceStatus, 'INCOMPLETE');
  assert.equal(report.automaticPilotDecision, false);
  assert.equal(report.pilotDisposition, 'NOT_MADE');
  assert.deepEqual(report.reviewerIds, REVIEWER_IDS);
  assert.equal(report.counts.totalFiles, 11);

  const directory = privateRoot(root);
  assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
  assert.deepEqual(fs.readdirSync(directory).sort(), EXPECTED_FILES);
  for (const filename of EXPECTED_FILES) {
    const stat = fs.statSync(path.join(directory, filename));
    assert.equal(stat.isFile(), true, filename);
    assert.equal(stat.mode & 0o777, 0o600, filename);
    assert.equal(stat.nlink, 1, filename);
  }

  for (const [index, filename] of SESSION_FILES.entries()) {
    const session = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'));
    assert.equal(JSON.stringify(session).includes(REVIEWER_IDS[index]), true);
    assert.equal(JSON.stringify(session).includes('COMPLETED'), false);
    for (const field of [
      'role',
      'experienceBand',
      'eligibilityConfirmed',
      'syntheticOnlyConfirmed',
      'technicalStateDisposition',
      'unsupportedCustomerUseClaimObserved',
      'unsupportedCustomerUseClaimCount',
      'wouldUseAgain',
      'weeklyUseIntent',
      'willingnessToPay',
      'decisionImpact',
      'finalDisposition',
    ]) assert.equal(session.humanInput[field], null, `${filename}:${field}`);
    for (const phase of ['baseline', 'twin']) {
      assert.equal(typeof session.humanInput[phase].caseId, 'string');
      for (const field of [
        'startedAt',
        'completedAt',
        'elapsedSeconds',
        'humanDecision',
        'evidenceTraceAttestation',
      ]) assert.equal(session.humanInput[phase][field], null, `${filename}:${phase}.${field}`);
      assert.deepEqual(session.humanInput[phase].selectedDecisionTraceRefs, []);
      assert.deepEqual(session.humanInput[phase].gapAssessments, []);
    }
  }
  const teamWeek = JSON.parse(fs.readFileSync(
    path.join(directory, 'team-week-team-1.json'),
    'utf8',
  ));
  assert.equal(teamWeek.schemaVersion, 'pursuit-value-pilot-team-week-response-v0');
  assert.equal(teamWeek.teamWeekId, 'PV-WEEK-1');
  assert.equal(teamWeek.teamId, 'TEAM-1');
  assert.equal(Object.hasOwn(teamWeek, 'canonicalSha256'), false);
  assert.deepEqual(teamWeek.humanInput, {
    participationConfirmed: null,
    syntheticOnlyConfirmed: null,
    weekStartedAt: null,
    weekCompletedAt: null,
    packetUseCount: null,
    repeatUseObserved: null,
  });
});

test('prepare is deterministic and blank packages validate as valid INCOMPLETE evidence', (t) => {
  const firstRoot = createHarness(t);
  const secondRoot = createHarness(t);
  prepare(firstRoot);
  prepare(secondRoot);
  for (const filename of EXPECTED_FILES) {
    assert.deepEqual(
      fs.readFileSync(path.join(privateRoot(firstRoot), filename)),
      fs.readFileSync(path.join(privateRoot(secondRoot), filename)),
      filename,
    );
  }

  const result = validate(firstRoot);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(report.productionReady, false);
  assert.equal(report.issue165Status, 'HOLD');
  assert.equal(report.humanEvidenceStatus, 'INCOMPLETE');
  assert.equal(report.automaticPilotDecision, false);
  assert.equal(report.pilotDisposition, 'NOT_MADE');
  for (const reviewerId of REVIEWER_IDS) assert.equal(result.stdout.includes(reviewerId), false);
  const privateSession = JSON.parse(fs.readFileSync(
    path.join(privateRoot(firstRoot), SESSION_FILES[0]),
    'utf8',
  ));
  assert.equal(typeof privateSession.sessionId, 'string');
  assert.equal(result.stdout.includes(privateSession.sessionId), false);
});

test('prepare refuses all arguments, overwrite, unsafe roots, and path tricks', async (t) => {
  await t.test('arguments and traversal-like output are refused without creating either path', () => {
    const root = createHarness(t);
    const escaped = path.join(root, 'escaped');
    const result = runCli(root, 'prepare-pursuit-value-pilot-v0.mjs', ['--output', '../escaped']);
    assert.deepEqual(failureCodes(result), ['PILOT_CLI_ARGUMENT_REFUSED']);
    assert.equal(fs.existsSync(privateRoot(root)), false);
    assert.equal(fs.existsSync(escaped), false);
  });

  await t.test('validator refuses output and path arguments without altering prepared intake', () => {
    const root = createHarness(t);
    prepare(root);
    const before = Object.fromEntries(EXPECTED_FILES.map((filename) => [
      filename,
      fs.readFileSync(path.join(privateRoot(root), filename)),
    ]));
    const result = runCli(root, 'validate-pursuit-value-pilot-v0.mjs', [
      '--output',
      '../../aggregate.json',
    ]);
    assert.deepEqual(failureCodes(result), ['PILOT_CLI_ARGUMENT_REFUSED']);
    for (const filename of EXPECTED_FILES) {
      assert.deepEqual(fs.readFileSync(path.join(privateRoot(root), filename)), before[filename]);
    }
    assert.equal(fs.existsSync(path.resolve(root, '../../aggregate.json')), false);
  });

  await t.test('an existing empty private root is never reused', () => {
    const root = createHarness(t);
    fs.mkdirSync(privateRoot(root), { mode: 0o700 });
    assert.deepEqual(
      failureCodes(runCli(root, 'prepare-pursuit-value-pilot-v0.mjs')),
      ['PILOT_PREPARE_REFUSES_OVERWRITE'],
    );
  });

  await t.test('an existing nonempty private root is never overwritten', () => {
    const root = createHarness(t);
    fs.mkdirSync(privateRoot(root), { mode: 0o700 });
    fs.writeFileSync(path.join(privateRoot(root), 'preserve'), 'do-not-delete');
    assert.deepEqual(
      failureCodes(runCli(root, 'prepare-pursuit-value-pilot-v0.mjs')),
      ['PILOT_PREPARE_REFUSES_OVERWRITE'],
    );
    assert.equal(fs.readFileSync(path.join(privateRoot(root), 'preserve'), 'utf8'), 'do-not-delete');
  });

  await t.test('a symlink private root is refused', () => {
    const root = createHarness(t);
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'pursuit-value-pilot-target-'));
    t.after(() => fs.rmSync(target, { recursive: true, force: true }));
    fs.symlinkSync(target, privateRoot(root));
    assert.deepEqual(
      failureCodes(runCli(root, 'prepare-pursuit-value-pilot-v0.mjs')),
      ['PILOT_DIRECTORY_SYMLINK_REFUSED'],
    );
  });

  await t.test('a hard-linked file at the private root is refused without unlinking it', () => {
    const root = createHarness(t);
    const source = path.join(root, 'tmp', 'preserve-hardlink-source');
    fs.writeFileSync(source, 'preserve');
    fs.linkSync(source, privateRoot(root));
    assert.deepEqual(
      failureCodes(runCli(root, 'prepare-pursuit-value-pilot-v0.mjs')),
      ['PILOT_DIRECTORY_LINK_COUNT_UNSAFE'],
    );
    assert.equal(fs.readFileSync(source, 'utf8'), 'preserve');
    assert.equal(fs.readFileSync(privateRoot(root), 'utf8'), 'preserve');
  });

  await t.test('unsafe private-root permissions are refused', () => {
    const root = createHarness(t);
    fs.mkdirSync(privateRoot(root), { mode: 0o755 });
    fs.chmodSync(privateRoot(root), 0o755);
    assert.deepEqual(
      failureCodes(runCli(root, 'prepare-pursuit-value-pilot-v0.mjs')),
      ['PILOT_DIRECTORY_PERMISSIONS_UNSAFE'],
    );
  });

  await t.test('unsafe parent permissions are refused', () => {
    const root = createHarness(t);
    fs.chmodSync(path.join(root, 'tmp'), 0o777);
    assert.deepEqual(
      failureCodes(runCli(root, 'prepare-pursuit-value-pilot-v0.mjs')),
      ['PILOT_PARENT_DIRECTORY_PERMISSIONS_UNSAFE'],
    );
  });
});

test('validator rejects exact-set drift, unsafe files, malformed bytes, and HTML drift', async (t) => {
  await t.test('private root replaced by symlink', () => {
    const root = createHarness(t);
    prepare(root);
    const moved = `${privateRoot(root)}-moved`;
    fs.renameSync(privateRoot(root), moved);
    fs.symlinkSync(moved, privateRoot(root));
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_DIRECTORY_SYMLINK_REFUSED']);
  });

  await t.test('extra file', () => {
    const root = createHarness(t);
    prepare(root);
    fs.writeFileSync(path.join(privateRoot(root), 'extra.json'), '{}', { mode: 0o600 });
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_FILE_SET_INVALID']);
  });

  await t.test('session symlink', () => {
    const root = createHarness(t);
    prepare(root);
    const target = path.join(privateRoot(root), SESSION_FILES[0]);
    fs.unlinkSync(target);
    fs.symlinkSync(path.join(privateRoot(root), SESSION_FILES[1]), target);
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_JSON_FILE_SYMLINK_REFUSED']);
  });

  await t.test('session hardlink', () => {
    const root = createHarness(t);
    prepare(root);
    const target = path.join(privateRoot(root), SESSION_FILES[0]);
    const source = path.join(privateRoot(root), SESSION_FILES[1]);
    fs.unlinkSync(target);
    fs.linkSync(source, target);
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_JSON_FILE_LINK_COUNT_UNSAFE']);
  });

  await t.test('session non-regular type', () => {
    const root = createHarness(t);
    prepare(root);
    const target = path.join(privateRoot(root), SESSION_FILES[0]);
    fs.unlinkSync(target);
    fs.mkdirSync(target, { mode: 0o700 });
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_JSON_FILE_NON_REGULAR']);
  });

  await t.test('session unsafe permissions', () => {
    const root = createHarness(t);
    prepare(root);
    fs.chmodSync(path.join(privateRoot(root), SESSION_FILES[0]), 0o644);
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_JSON_FILE_PERMISSIONS_UNSAFE']);
  });

  await t.test('invalid UTF-8', () => {
    const root = createHarness(t);
    prepare(root);
    fs.appendFileSync(path.join(privateRoot(root), SESSION_FILES[0]), Buffer.from([0xff]));
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_JSON_FILE_UTF8_INVALID']);
  });

  await t.test('JSON size overflow', () => {
    const root = createHarness(t);
    prepare(root);
    const target = path.join(privateRoot(root), SESSION_FILES[0]);
    fs.writeFileSync(target, Buffer.alloc((512 * 1024) + 1, 0x20), { mode: 0o600 });
    fs.chmodSync(target, 0o600);
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_JSON_FILE_SIZE_INVALID']);
  });

  await t.test('offline HTML byte drift', () => {
    const root = createHarness(t);
    prepare(root);
    fs.appendFileSync(path.join(privateRoot(root), HTML_FILES[0]), '<!-- drift -->');
    assert.deepEqual(failureCodes(validate(root)), ['PILOT_HTML_CONTENT_MISMATCH']);
  });
});

test('validator detects mutation after safe open and never echoes protected content', async (t) => {
  const root = createHarness(t);
  prepare(root);
  const helperUrl = `${pathToFileURL(path.join(root, 'scripts/lib/pursuit-value-pilot-files.mjs')).href}?race=${Date.now()}`;
  const helper = await import(helperUrl);
  let mutated = false;
  await assert.rejects(
    helper.loadAndAggregatePursuitValuePilotPrivateFiles({
      afterFileOpenForTest(target, kind) {
        if (!mutated && kind === 'JSON') {
          mutated = true;
          fs.appendFileSync(target, ' ');
        }
      },
    }),
    (error) => error?.code === 'PILOT_JSON_FILE_RACE_REFUSED',
  );

  const poison = 'Authorization: Bearer human-private-value';
  const target = path.join(privateRoot(root), SESSION_FILES[1]);
  const record = JSON.parse(fs.readFileSync(target, 'utf8'));
  record.privateCustomerNotes = poison;
  fs.writeFileSync(target, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  fs.chmodSync(target, 0o600);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.equal(result.stdout.includes(poison), false);
  assert.equal(result.stderr.includes(poison), false);
});

test('validator accepts canonical blanks but refuses completed canonical human records', async (t) => {
  await t.test('completed canonical reviewer session must arrive as a bound response envelope', async () => {
    const root = createHarness(t);
    prepare(root);
    const helper = await import(`${pathToFileURL(
      path.join(root, 'scripts/lib/pursuit-value-pilot-files.mjs'),
    ).href}?canonical-session=${Date.now()}`);
    const domain = await import(`${pathToFileURL(
      path.join(root, 'verticals/datacenter/pursuit-value-pilot-v0.mjs'),
    ).href}?canonical-session=${Date.now()}`);
    const context = await helper.buildRepositoryPursuitValuePilotContext();
    const completed = domain.buildCompletedPursuitValuePilotSession(
      context.protocol,
      context.sessions[0].reviewerId,
      completedSessionHumanInput(context, 0),
    );
    writePrivateJson(path.join(privateRoot(root), SESSION_FILES[0]), completed);
    assert.deepEqual(
      failureCodes(validate(root)),
      ['PILOT_COMPLETED_CANONICAL_SESSION_REFUSED'],
    );
  });

  await t.test('completed canonical team week must arrive as a bound response envelope', async () => {
    const root = createHarness(t);
    prepare(root);
    const helper = await import(`${pathToFileURL(
      path.join(root, 'scripts/lib/pursuit-value-pilot-files.mjs'),
    ).href}?canonical-team=${Date.now()}`);
    const domain = await import(`${pathToFileURL(
      path.join(root, 'verticals/datacenter/pursuit-value-pilot-v0.mjs'),
    ).href}?canonical-team=${Date.now()}`);
    const context = await helper.buildRepositoryPursuitValuePilotContext();
    const completed = domain.buildCompletedPursuitValuePilotTeamWeek(
      context.protocol,
      completedTeamWeekHumanInput(),
    );
    writePrivateJson(path.join(privateRoot(root), 'team-week-team-1.json'), completed);
    assert.deepEqual(
      failureCodes(validate(root)),
      ['PILOT_COMPLETED_CANONICAL_TEAM_WEEK_REFUSED'],
    );
  });
});

test('five completed response envelopes and one team week produce only a bounded redacted aggregate', async (t) => {
  const root = createHarness(t);
  prepare(root);
  const helper = await import(`${pathToFileURL(
    path.join(root, 'scripts/lib/pursuit-value-pilot-files.mjs'),
  ).href}?complete=${Date.now()}`);
  const domain = await import(`${pathToFileURL(
    path.join(root, 'verticals/datacenter/pursuit-value-pilot-v0.mjs'),
  ).href}?complete=${Date.now()}`);
  const context = await helper.buildRepositoryPursuitValuePilotContext();

  for (const [index, blank] of context.sessions.entries()) {
    const assignment = context.protocol.reviewerAssignments.find(
      (item) => item.reviewerId === blank.reviewerId,
    );
    const binding = context.protocol.caseBindings.find(
      (item) => item.caseId === assignment.assignedTwinCaseId,
    );
    const day = String(index + 1).padStart(2, '0');
    const baselineHour = assignment.presentationOrder === 'BASELINE_FIRST' ? '01' : '02';
    const twinHour = assignment.presentationOrder === 'TWIN_FIRST' ? '01' : '02';
    const humanInput = structuredClone(blank.humanInput);
    Object.assign(humanInput, {
      role: assignment.assignedRole,
      experienceBand: 'Y6_TO_10',
      eligibilityConfirmed: 'YES',
      syntheticOnlyConfirmed: 'YES',
      technicalStateDisposition: 'ACCEPTED_AS_WRITTEN',
      unsupportedCustomerUseClaimObserved: 'NO',
      unsupportedCustomerUseClaimCount: 0,
      wouldUseAgain: 'YES',
      weeklyUseIntent: 'YES',
      willingnessToPay: 'YES',
      decisionImpact: 'IMPROVED',
      finalDisposition: 'ADVANCE',
    });
    Object.assign(humanInput.baseline, {
      startedAt: `2026-07-${day}T${baselineHour}:00:00.000Z`,
      completedAt: `2026-07-${day}T${baselineHour}:10:00.000Z`,
      elapsedSeconds: 600,
      humanDecision: 'PURSUE',
    });
    Object.assign(humanInput.twin, {
      startedAt: `2026-07-${day}T${twinHour}:00:00.000Z`,
      completedAt: `2026-07-${day}T${twinHour}:04:00.000Z`,
      elapsedSeconds: 240,
      humanDecision: 'PURSUE',
      evidenceTraceAttestation: 'YES',
      selectedDecisionTraceRefs: [binding.allowedDecisionTraceRefs[0]],
      gapAssessments: [{
        gapId: binding.allowedGapIds[0],
        materiality: 'KEY',
        priorAwareness: 'NO',
        discoveredBeforeDecision: 'YES',
      }],
    });
    const response = {
      schemaVersion: 'pursuit-value-pilot-session-response-v0',
      protocolCanonicalSha256: context.protocol.canonicalSha256,
      blankSessionCanonicalSha256: blank.canonicalSha256,
      sessionId: blank.sessionId,
      reviewerId: blank.reviewerId,
      humanInput,
    };
    writePrivateJson(
      path.join(privateRoot(root), SESSION_FILES[index]),
      response,
    );
  }

  const teamWeek = domain.buildBlankPursuitValuePilotTeamWeekResponseEnvelope(
    context.protocol,
    context.teamWeek,
  );
  teamWeek.humanInput = {
    participationConfirmed: 'YES',
    syntheticOnlyConfirmed: 'YES',
    weekStartedAt: '2026-07-01T00:00:00.000Z',
    weekCompletedAt: '2026-07-07T23:59:59.000Z',
    packetUseCount: 5,
    repeatUseObserved: 'YES',
  };
  assert.equal(Object.hasOwn(teamWeek, 'canonicalSha256'), false);
  writePrivateJson(
    path.join(privateRoot(root), 'team-week-team-1.json'),
    teamWeek,
  );

  const result = validate(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const aggregate = JSON.parse(result.stdout);
  assert.equal(aggregate.documentStatus, 'COMPLETE_FOR_HUMAN_DISPOSITION');
  assert.equal(aggregate.humanEvidenceStatus, 'COMPLETE');
  assert.equal(aggregate.counts.eligibleCompletedReviewerCount, 5);
  assert.equal(aggregate.counts.completedTeamWeekCount, 1);
  assert.equal(aggregate.allTargetsMet, true);
  assert.equal(aggregate.humanDispositionRequired, true);
  assert.equal(aggregate.pilotDisposition, 'NOT_MADE');
  assert.equal(aggregate.automaticPilotDecision, false);
  assert.equal(aggregate.redaction.rawSessionAnswersIncluded, false);
  assert.equal(aggregate.redaction.rawTimingValuesIncluded, false);
  assert.equal(aggregate.redaction.identitiesIncluded, false);
  assert.equal(aggregate.redaction.caseContentIncluded, false);
  for (const privateToken of [
    ...REVIEWER_IDS,
    ...context.sessions.map((session) => session.sessionId),
    ...context.protocol.caseBindings.map((binding) => binding.caseId),
    'Y6_TO_10',
  ]) assert.equal(result.stdout.includes(privateToken), false, privateToken);
});

test('prepare rolls back every file and the new private directory after an injected failure', async (t) => {
  const root = createHarness(t);
  const helperUrl = `${pathToFileURL(path.join(root, 'scripts/lib/pursuit-value-pilot-files.mjs')).href}?rollback=${Date.now()}`;
  const helper = await import(helperUrl);
  await assert.rejects(
    helper.preparePursuitValuePilotPrivateFiles({
      afterFileCreateForTest(_target, count) {
        if (count === 4) throw new Error('injected failure');
      },
    }),
    (error) => error?.code === 'PILOT_PREPARE_FAILED',
  );
  assert.equal(fs.existsSync(privateRoot(root)), false);
});
