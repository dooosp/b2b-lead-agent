const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_URL = pathToFileURL(
  path.join(REPO_ROOT, 'verticals/datacenter/pursuit-value-pilot-v0.mjs'),
).href;
const FILES_URL = pathToFileURL(
  path.join(REPO_ROOT, 'scripts/lib/pursuit-value-pilot-files.mjs'),
).href;

let fixturePromise;

async function fixture() {
  if (!fixturePromise) {
    fixturePromise = Promise.all([import(CORE_URL), import(FILES_URL)])
      .then(async ([core, files]) => ({
        core,
        context: await files.buildRepositoryPursuitValuePilotContext(),
      }));
  }
  return fixturePromise;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function completedInput(protocol, blankSession, index, overrides = {}) {
  const input = clone(blankSession.humanInput);
  const assignment = protocol.reviewerAssignments[index];
  const binding = protocol.caseBindings.find((item) => item.caseId === assignment.assignedTwinCaseId);
  input.role = assignment.assignedRole;
  input.experienceBand = 'Y6_TO_10';
  input.eligibilityConfirmed = 'YES';
  input.syntheticOnlyConfirmed = 'YES';
  const baselineHour = assignment.presentationOrder === 'BASELINE_FIRST' ? '00' : '01';
  const twinHour = assignment.presentationOrder === 'TWIN_FIRST' ? '00' : '01';
  input.baseline.startedAt = `2026-07-0${index + 1}T${baselineHour}:00:00.000Z`;
  input.baseline.completedAt = `2026-07-0${index + 1}T${baselineHour}:10:00.000Z`;
  input.baseline.elapsedSeconds = 600;
  input.baseline.humanDecision = index % 2 ? 'HOLD' : 'PURSUE';
  input.twin.startedAt = `2026-07-0${index + 1}T${twinHour}:00:00.000Z`;
  input.twin.completedAt = `2026-07-0${index + 1}T${twinHour}:04:00.000Z`;
  input.twin.elapsedSeconds = 240;
  input.twin.humanDecision = index === 4 ? 'NO_BID' : 'PURSUE';
  input.twin.evidenceTraceAttestation = 'YES';
  input.twin.selectedDecisionTraceRefs = [binding.allowedDecisionTraceRefs[0]];
  input.twin.gapAssessments = [{
    gapId: binding.allowedGapIds[0],
    materiality: 'KEY',
    priorAwareness: 'NO',
    discoveredBeforeDecision: 'YES',
  }];
  input.technicalStateDisposition = index < 4 ? 'ACCEPTED_AS_WRITTEN' : 'MODIFIED';
  input.unsupportedCustomerUseClaimObserved = 'NO';
  input.unsupportedCustomerUseClaimCount = 0;
  input.wouldUseAgain = index < 3 ? 'YES' : 'NO';
  input.weeklyUseIntent = 'YES';
  input.willingnessToPay = 'UNSURE';
  input.decisionImpact = 'IMPROVED';
  input.finalDisposition = 'ADVANCE';
  return Object.assign(input, overrides);
}

function completedTeamInput() {
  return {
    participationConfirmed: 'YES',
    syntheticOnlyConfirmed: 'YES',
    weekStartedAt: '2026-07-01T00:00:00.000Z',
    weekCompletedAt: '2026-07-07T00:00:00.000Z',
    packetUseCount: 5,
    repeatUseObserved: 'YES',
  };
}

test('case catalog is five distinct engine-built Pursuit Twin packets with stable pins', async () => {
  const { core, context } = await fixture();
  assert.equal(context.cases.cases.length, 5);
  assert.equal(new Set(context.cases.cases.map((item) => item.opportunityId)).size, 5);
  assert.deepEqual(context.cases.cases.map((item) => item.caseId), [
    'PV-C1', 'PV-C2', 'PV-C3', 'PV-C4', 'PV-C5',
  ]);
  for (const record of context.cases.cases) {
    assert.equal(record.productionReady, false);
    assert.equal(record.finalHumanDecision, 'NOT_MADE');
    assert.equal(record.twinPacket.schemaVersion, 'pursuit-twin-review-packet-v0');
    assert.equal(record.twinPacket.specificationDelta.automaticDecisionChangePerformed, undefined);
    assert.equal(record.twinPacket.specificationDelta.decisionReview.automaticDecisionChangePerformed, false);
    assert.equal(record.twinPacket.minimumEvidenceToAdvance.fitGuarantee, false);
    assert.equal(record.twinPacketCanonicalSha256, record.twinPacket.canonicalSha256);
  }
  assert.deepEqual(
    core.validatePursuitValuePilotCaseCatalog(context.cases),
    context.cases,
  );
  const repeated = core.buildPursuitValuePilotCaseCatalog(context.registry, context.verticalPack);
  assert.deepEqual(repeated, context.cases);
});

test('protocol freezes cyclic counterbalance, roles, thresholds, and no system decision', async () => {
  const { context } = await fixture();
  const assignments = context.protocol.reviewerAssignments;
  assert.equal(assignments.length, 5);
  assert.deepEqual(
    assignments.map((item) => item.assignedBaselineCaseId).sort(),
    ['PV-C1', 'PV-C2', 'PV-C3', 'PV-C4', 'PV-C5'],
  );
  assert.deepEqual(
    assignments.map((item) => item.assignedTwinCaseId).sort(),
    ['PV-C1', 'PV-C2', 'PV-C3', 'PV-C4', 'PV-C5'],
  );
  assert.equal(assignments.every((item) => item.assignedBaselineCaseId !== item.assignedTwinCaseId), true);
  assert.deepEqual(new Set(assignments.map((item) => item.presentationOrder)), new Set([
    'BASELINE_FIRST', 'TWIN_FIRST',
  ]));
  assert.equal(context.protocol.thresholds.pairedMedianTimeReductionBasisPoints, 5000);
  assert.equal(context.protocol.thresholds.acceptedTechnicalStateMinimumCount, 4);
  assert.equal(context.protocol.systemFinalDecisionAcceptance, 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION');
  assert.equal(context.protocol.automaticPilotDecision, false);
  assert.equal(context.protocol.pilotDisposition, 'NOT_MADE');
});

test('blank human records stay zero-evidence and aggregate is INCOMPLETE', async () => {
  const { core, context } = await fixture();
  for (const session of context.sessions) {
    assert.equal(session.humanEvidenceStatus, 'INCOMPLETE');
    assert.equal(session.reviewerIdentity, 'NOT_COLLECTED');
    assert.equal(session.humanInput.role, null);
    assert.equal(session.humanInput.baseline.elapsedSeconds, null);
    assert.equal(session.humanInput.twin.humanDecision, null);
  }
  assert.equal(context.teamWeek.humanInput.participationConfirmed, null);
  const aggregate = core.buildPursuitValuePilotAggregate(
    context.protocol,
    context.sessions,
    [context.teamWeek],
  );
  assert.equal(aggregate.documentStatus, 'INCOMPLETE');
  assert.equal(aggregate.counts.eligibleCompletedReviewerCount, 0);
  assert.equal(aggregate.counts.humanPursuitDecisionCount, 0);
  assert.equal(aggregate.allTargetsMet, null);
  assert.equal(Object.values(aggregate.criteria).every((item) => item.status === 'INCOMPLETE'), true);
});

test('all five human sessions and one team week produce only a redacted human-disposition aggregate', async () => {
  const { core, context } = await fixture();
  const sessions = context.sessions.map((blank, index) => core.buildCompletedPursuitValuePilotSession(
    context.protocol,
    blank.reviewerId,
    completedInput(context.protocol, blank, index),
  ));
  const teamWeek = core.buildCompletedPursuitValuePilotTeamWeek(
    context.protocol,
    completedTeamInput(),
  );
  const aggregate = core.buildPursuitValuePilotAggregate(
    context.protocol,
    sessions,
    [teamWeek],
  );
  assert.equal(aggregate.documentStatus, 'COMPLETE_FOR_HUMAN_DISPOSITION');
  assert.equal(aggregate.humanEvidenceStatus, 'COMPLETE');
  assert.equal(aggregate.counts.eligibleCompletedReviewerCount, 5);
  assert.equal(aggregate.counts.humanPursuitDecisionCount, 5);
  assert.equal(aggregate.counts.acceptedTechnicalStateCount, 4);
  assert.equal(aggregate.metrics.pairedInitialReviewTimeReduction.medianBasisPoints, 6000);
  assert.equal(aggregate.metrics.traceableHumanDecisions.basisPoints, 10000);
  assert.equal(aggregate.metrics.acceptedTechnicalState.count, 4);
  assert.equal(aggregate.metrics.acceptedTechnicalState.basisPoints, 8000);
  assert.equal(aggregate.metrics.keyGaps.coverageBasisPoints, 10000);
  assert.equal(aggregate.metrics.keyGaps.meanPerProjectMilli, 1000);
  assert.equal(aggregate.metrics.unsupportedCustomerUseClaims.count, 0);
  assert.equal(aggregate.metrics.repeatUseIntent.count, 3);
  assert.equal(aggregate.metrics.weeklyPilotTeam.completedRecordCount, 1);
  assert.equal(aggregate.metrics.weeklyPilotTeam.count, 1);
  assert.equal(aggregate.metrics.weeklyPilotTeam.basisPoints, 10000);
  assert.equal(Object.values(aggregate.criteria).every((item) => item.status === 'MET'), true);
  assert.equal(aggregate.allTargetsMet, true);
  assert.equal(aggregate.humanDispositionRequired, true);
  assert.equal(aggregate.pilotDisposition, 'NOT_MADE');
  assert.equal(aggregate.automaticPilotDecision, false);
  assert.equal(aggregate.systemFinalDecisionAcceptance, 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION');
  const serialized = JSON.stringify(aggregate);
  assert.equal(serialized.includes('2026-07-01T01:00:00.000Z'), false);
  assert.equal(serialized.includes('selectedDecisionTraceRefs'), false);
  assert.equal(serialized.includes('gapAssessments'), false);
  assert.equal(serialized.includes('humanInput'), false);
});

test('four completed reviewers never shrink the fixed denominator or evaluate thresholds', async () => {
  const { core, context } = await fixture();
  const sessions = context.sessions.map((blank, index) => (
    index === 4
      ? blank
      : core.buildCompletedPursuitValuePilotSession(
        context.protocol,
        blank.reviewerId,
        completedInput(context.protocol, blank, index),
      )
  ));
  const teamWeek = core.buildCompletedPursuitValuePilotTeamWeek(
    context.protocol,
    completedTeamInput(),
  );
  const aggregate = core.buildPursuitValuePilotAggregate(context.protocol, sessions, [teamWeek]);
  assert.equal(aggregate.documentStatus, 'INCOMPLETE');
  assert.equal(aggregate.counts.fixedReviewerDenominator, 5);
  assert.equal(aggregate.counts.eligibleCompletedReviewerCount, 4);
  assert.equal(aggregate.metrics.pairedInitialReviewTimeReduction.observationCount, 0);
  assert.equal(aggregate.metrics.pairedInitialReviewTimeReduction.medianBasisPoints, null);
  assert.equal(aggregate.criteria.repeatUseIntent.status, 'INCOMPLETE');
  assert.equal(aggregate.allTargetsMet, null);
});

test('browser response envelope materializes only against its exact blank session hash', async () => {
  const { core, context } = await fixture();
  const blank = context.sessions[0];
  const envelope = {
    schemaVersion: 'pursuit-value-pilot-session-response-v0',
    protocolCanonicalSha256: context.protocol.canonicalSha256,
    blankSessionCanonicalSha256: blank.canonicalSha256,
    sessionId: blank.sessionId,
    reviewerId: blank.reviewerId,
    humanInput: completedInput(context.protocol, blank, 0),
  };
  const completed = core.materializePursuitValuePilotSessionResponse(
    envelope,
    blank,
    context.protocol,
  );
  assert.equal(completed.humanEvidenceStatus, 'COMPLETED');
  assert.match(completed.canonicalSha256, /^[a-f0-9]{64}$/);

  const stale = clone(envelope);
  stale.blankSessionCanonicalSha256 = '0'.repeat(64);
  assert.throws(
    () => core.materializePursuitValuePilotSessionResponse(stale, blank, context.protocol),
    (error) => error?.code === 'PILOT_RESPONSE_ENVELOPE_BINDING_INVALID',
  );
});

test('team coordinator can fill a hashless response envelope bound to the blank team record', async () => {
  const { core, context } = await fixture();
  const envelope = core.buildBlankPursuitValuePilotTeamWeekResponseEnvelope(
    context.protocol,
    context.teamWeek,
  );
  assert.equal(envelope.schemaVersion, 'pursuit-value-pilot-team-week-response-v0');
  assert.equal(Object.hasOwn(envelope, 'canonicalSha256'), false);
  assert.equal(
    core.materializePursuitValuePilotTeamWeekResponse(
      envelope,
      context.teamWeek,
      context.protocol,
    ).humanEvidenceStatus,
    'INCOMPLETE',
  );
  envelope.humanInput = completedTeamInput();
  const completed = core.materializePursuitValuePilotTeamWeekResponse(
    envelope,
    context.teamWeek,
    context.protocol,
  );
  assert.equal(completed.humanEvidenceStatus, 'COMPLETED');
  const stale = clone(envelope);
  stale.blankTeamWeekCanonicalSha256 = '0'.repeat(64);
  assert.throws(
    () => core.materializePursuitValuePilotTeamWeekResponse(
      stale,
      context.teamWeek,
      context.protocol,
    ),
    (error) => error?.code === 'PILOT_TEAM_WEEK_RESPONSE_BINDING_INVALID',
  );
  const tooLong = clone(envelope);
  tooLong.humanInput.weekCompletedAt = '2026-07-09T00:00:00.000Z';
  assert.throws(
    () => core.materializePursuitValuePilotTeamWeekResponse(
      tooLong,
      context.teamWeek,
      context.protocol,
    ),
    (error) => error?.code === 'PILOT_TEAM_WEEK_USAGE_INVALID',
  );
  const countContradiction = clone(envelope);
  countContradiction.humanInput.packetUseCount = 1;
  assert.throws(
    () => core.materializePursuitValuePilotTeamWeekResponse(
      countContradiction,
      context.teamWeek,
      context.protocol,
    ),
    (error) => error?.code === 'PILOT_TEAM_WEEK_REPEAT_USE_CONTRADICTION',
  );
  const attestationContradiction = clone(envelope);
  attestationContradiction.humanInput.repeatUseObserved = 'NO';
  assert.throws(
    () => core.materializePursuitValuePilotTeamWeekResponse(
      attestationContradiction,
      context.teamWeek,
      context.protocol,
    ),
    (error) => error?.code === 'PILOT_TEAM_WEEK_REPEAT_USE_CONTRADICTION',
  );
});

test('tampering, partial human input, unbound traces, and production overclaims fail closed', async () => {
  const { core, context } = await fixture();
  const partial = clone(context.sessions[0]);
  partial.humanInput.role = 'TECHNICAL_SALES';
  partial.canonicalSha256 = core.hashPursuitValuePilotCanonical((({ canonicalSha256, ...body }) => body)(partial));
  assert.throws(() => core.validatePursuitValuePilotSession(partial, context.protocol));

  const wrongTrace = completedInput(context.protocol, context.sessions[0], 0);
  wrongTrace.twin.selectedDecisionTraceRefs = ['PV-C2:UNBOUND:trace'];
  assert.throws(() => core.buildCompletedPursuitValuePilotSession(
    context.protocol,
    'PV-R1',
    wrongTrace,
  ));

  const reversed = completedInput(context.protocol, context.sessions[0], 0);
  reversed.twin.startedAt = '2026-07-01T00:05:00.000Z';
  reversed.twin.completedAt = '2026-07-01T00:09:00.000Z';
  assert.throws(
    () => core.buildCompletedPursuitValuePilotSession(context.protocol, 'PV-R1', reversed),
    (error) => error?.code === 'PILOT_PRESENTATION_ORDER_TIMING_INVALID',
  );

  const twinFirstOverlap = completedInput(context.protocol, context.sessions[1], 1);
  twinFirstOverlap.baseline.startedAt = '2026-07-02T00:03:00.000Z';
  twinFirstOverlap.baseline.completedAt = '2026-07-02T00:13:00.000Z';
  assert.throws(
    () => core.buildCompletedPursuitValuePilotSession(context.protocol, 'PV-R2', twinFirstOverlap),
    (error) => error?.code === 'PILOT_PRESENTATION_ORDER_TIMING_INVALID',
  );

  const production = clone(context.protocol);
  production.productionReady = true;
  production.canonicalSha256 = core.hashPursuitValuePilotCanonical((({ canonicalSha256, ...body }) => body)(production));
  assert.throws(() => core.validatePursuitValuePilotProtocol(production));
});

test('strict parser rejects duplicate keys and protected or trailing JSON', async () => {
  const { core } = await fixture();
  assert.deepEqual(core.parsePursuitValuePilotJsonStrict('{"a":1,"b":[true,null]}'), {
    a: 1,
    b: [true, null],
  });
  assert.throws(
    () => core.parsePursuitValuePilotJsonStrict('{"a":1,"a":2}'),
    (error) => error?.code === 'PILOT_JSON_DUPLICATE_KEY',
  );
  assert.throws(() => core.parsePursuitValuePilotJsonStrict('{"a":1} trailing'));
  assert.throws(() => core.parsePursuitValuePilotJsonStrict('{"Authorization":"Bearer abcdefghijklmnopqrstuvwxyz"}'));
});

test('complete negative evidence remains valid and never auto-selects a pilot decision', async () => {
  const { core, context } = await fixture();
  const sessions = context.sessions.map((blank, index) => {
    const input = completedInput(context.protocol, blank, index);
    input.twin.elapsedSeconds = 590;
    input.technicalStateDisposition = 'REJECTED';
    input.wouldUseAgain = 'NO';
    input.twin.evidenceTraceAttestation = 'NO';
    input.twin.selectedDecisionTraceRefs = [];
    input.twin.gapAssessments = [];
    return core.buildCompletedPursuitValuePilotSession(context.protocol, blank.reviewerId, input);
  });
  const teamWeek = core.buildCompletedPursuitValuePilotTeamWeek(context.protocol, {
    ...completedTeamInput(),
    packetUseCount: 1,
    repeatUseObserved: 'NO',
  });
  const aggregate = core.buildPursuitValuePilotAggregate(context.protocol, sessions, [teamWeek]);
  assert.equal(aggregate.documentStatus, 'COMPLETE_FOR_HUMAN_DISPOSITION');
  assert.equal(aggregate.allTargetsMet, false);
  assert.equal(Object.values(aggregate.criteria).some((item) => item.status === 'NOT_MET'), true);
  assert.equal(aggregate.metrics.weeklyPilotTeam.completedRecordCount, 1);
  assert.equal(aggregate.metrics.weeklyPilotTeam.count, 0);
  assert.equal(aggregate.criteria.weeklyPilotTeam.status, 'NOT_MET');
  assert.equal(aggregate.pilotDisposition, 'NOT_MADE');
  assert.equal(aggregate.automaticPilotDecision, false);
});
