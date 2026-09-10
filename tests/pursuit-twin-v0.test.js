const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rawRegistry = require('../knowledge/claim-registry/synthetic/datacenter-claims-v1.json');
const verticalPack = require('../verticals/datacenter/vertical-pack-v0.json');

const clone = (value) => structuredClone(value);

async function setup(raw = rawRegistry) {
  const core = await import(path.resolve(__dirname, '../knowledge/claim-registry/index.mjs'));
  const twin = await import(path.resolve(__dirname, '../verticals/datacenter/pursuit-twin-v0.mjs'));
  const registry = core.createValidatedClaimRegistry(raw, { asOf: rawRegistry.evaluationAsOf });
  return { core, twin, registry };
}

function identity(id = 'syn_dc_alpha') {
  return {
    opportunityId: id,
    accountDisplayName: 'Synthetic Metro Compute',
    projectDisplayName: 'Campus Alpha Phase 1',
    facilityDisplayName: 'Alpha DC',
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR'
  };
}

function opportunity({
  id = 'syn_dc_alpha',
  family = 'oil_free_compressor',
  stage = 'BASIC_DESIGN',
  stageRef = 'stage_basic_design',
  requirementId = 'req_cooling_architecture',
  category = 'cooling',
  key = 'cooling_architecture',
  valueState = 'KNOWN',
  operator = 'EQ',
  value = { type: 'ENUM', key: 'cooling_architecture', value: 'WATER_COOLED' },
  evidence = 'req_cooling_water'
} = {}) {
  return {
    schemaVersion: 'project-opportunity-v0',
    synthetic: true,
    opportunityId: id,
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR',
    conditions: {},
    identity: identity(id),
    stage: { value: stage, evidenceClaimRefs: stageRef ? [stageRef] : [] },
    candidateProductFamilyIds: family ? [family] : [],
    requirements: family ? [{
      requirementId,
      category,
      key,
      productFamilyIds: [family],
      priority: 'HARD',
      valueState,
      operator,
      value,
      evidenceClaimRefs: evidence ? [evidence] : []
    }] : []
  };
}

function sourceRevision({ revisionId, supersedesRevisionId = null, effectiveAt, refs, documentKey = 'synthetic-spec-alpha' }) {
  return { documentKey, revisionId, supersedesRevisionId, effectiveAt, evidenceClaimRefs: refs };
}

function snapshotInput(opportunityValue, {
  revisionId,
  supersedesRevisionId = null,
  effectiveAt,
  observedAt,
  refs,
  documentKey
}) {
  return {
    opportunity: opportunityValue,
    observedAt,
    sourceRevision: sourceRevision({ revisionId, supersedesRevisionId, effectiveAt, refs, documentKey })
  };
}

function pairedSnapshots(twin, registry, before, after) {
  const previous = twin.buildPursuitRevisionSnapshot(snapshotInput(before, {
    revisionId: 'rev-001',
    effectiveAt: '2026-04-10T00:00:00.000Z',
    observedAt: '2026-04-11T00:00:00.000Z',
    refs: ['stage_basic_design', ...(before.requirements[0]?.evidenceClaimRefs || [])]
  }), registry, verticalPack);
  const current = twin.buildPursuitRevisionSnapshot(snapshotInput(after, {
    revisionId: 'rev-002',
    supersedesRevisionId: 'rev-001',
    effectiveAt: '2026-05-20T00:00:00.000Z',
    observedAt: '2026-05-21T00:00:00.000Z',
    refs: ['stage_basic_design', ...(after.requirements[0]?.evidenceClaimRefs || [])]
  }), registry, verticalPack);
  return { previous, current };
}

test('revision snapshots bind exact materialized inputs and normalize set-like permutations', async () => {
  const { core, twin, registry } = await setup();
  const input = opportunity();
  input.stage.evidenceClaimRefs = ['stage_basic_design', 'stage_basic_design'];
  input.requirements[0].productFamilyIds = ['oil_free_compressor'];
  const snapshotA = twin.buildPursuitRevisionSnapshot(snapshotInput(input, {
    revisionId: 'rev-001',
    effectiveAt: '2026-04-10T00:00:00.000Z',
    observedAt: '2026-04-11T00:00:00.000Z',
    refs: ['req_cooling_water', 'stage_basic_design']
  }), registry, verticalPack);

  const reversedRaw = { claims: clone(rawRegistry.claims).reverse() };
  const reversedRegistry = core.createValidatedClaimRegistry(reversedRaw, { asOf: rawRegistry.evaluationAsOf });
  const snapshotB = twin.buildPursuitRevisionSnapshot(snapshotInput(clone(input), {
    revisionId: 'rev-001',
    effectiveAt: '2026-04-10T00:00:00.000Z',
    observedAt: '2026-04-11T00:00:00.000Z',
    refs: ['stage_basic_design', 'req_cooling_water']
  }), reversedRegistry, verticalPack);

  assert.deepEqual(snapshotA, snapshotB);
  assert.equal(snapshotA.schemaVersion, 'project-opportunity-snapshot-v0');
  assert.equal(snapshotA.boundary, 'LOCAL_TEST_SYNTHETIC_ONLY');
  assert.equal(snapshotA.evidenceBoundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(snapshotA.productionReady, false);
  assert.equal(snapshotA.issue165Status, 'HOLD');
  assert.equal(snapshotA.materializedRegistryCanonicalSha256.length, 64);
  assert.equal(snapshotA.verticalPackCanonicalSha256.length, 64);
  assert.equal(snapshotA.opportunityCanonicalSha256.length, 64);
  assert.equal(snapshotA.evaluationCanonicalSha256.length, 64);
  assert.equal(snapshotA.canonicalSha256.length, 64);
  assert.deepEqual(twin.validatePursuitRevisionSnapshot(snapshotA, registry, verticalPack), snapshotA);
});

test('snapshot validation rejects modified hashes, forged evaluations, and non-validated registries', async () => {
  const { core, twin, registry } = await setup();
  const snapshot = twin.buildPursuitRevisionSnapshot(snapshotInput(opportunity(), {
    revisionId: 'rev-001',
    effectiveAt: '2026-04-10T00:00:00.000Z',
    observedAt: '2026-04-11T00:00:00.000Z',
    refs: ['stage_basic_design', 'req_cooling_water']
  }), registry, verticalPack);
  const modified = clone(snapshot);
  modified.evaluation.results[0].result = 'NOT_FIT';
  assert.throws(
    () => twin.validatePursuitRevisionSnapshot(modified, registry, verticalPack),
    (error) => error.code === 'SNAPSHOT_HASH_MISMATCH'
  );

  const forged = clone(snapshot);
  forged.evaluation.results[0].result = 'NOT_FIT';
  const hashPayload = clone(forged);
  delete hashPayload.canonicalSha256;
  forged.canonicalSha256 = core.sha256(hashPayload);
  assert.throws(
    () => twin.validatePursuitRevisionSnapshot(forged, registry, verticalPack),
    (error) => error.code === 'SNAPSHOT_RECOMPUTATION_MISMATCH'
  );
  assert.throws(
    () => twin.buildPursuitRevisionSnapshot(snapshotInput(opportunity(), {
      revisionId: 'future-observation',
      effectiveAt: '2026-05-31T00:00:00.000Z',
      observedAt: '2026-06-02T00:00:00.000Z',
      refs: ['stage_basic_design', 'req_cooling_water']
    }), registry, verticalPack),
    (error) => error.code === 'OBSERVATION_AFTER_REGISTRY_AS_OF'
  );
  assert.throws(
    () => twin.buildPursuitRevisionSnapshot(snapshotInput(opportunity(), {
      revisionId: 'rev-001',
      effectiveAt: '2026-04-10T00:00:00.000Z',
      observedAt: '2026-04-11T00:00:00.000Z',
      refs: ['stage_basic_design']
    }), { claims: [] }, verticalPack),
    (error) => error.code === 'UNVALIDATED_REGISTRY'
  );
});

test('Spec Delta reports FIT to insufficient evidence and requires review without changing a prior human decision', async () => {
  const { twin, registry } = await setup();
  const before = opportunity();
  const after = opportunity({ valueState: 'UNKNOWN', evidence: '' });
  const { previous, current } = pairedSnapshots(twin, registry, before, after);
  const priorHumanDecision = {
    decisionId: 'synthetic-decision-001',
    decision: 'PURSUE',
    decidedAt: '2026-05-15T00:00:00.000Z',
    snapshotCanonicalSha256: previous.canonicalSha256,
    reviewReceipt: 'synthetic-human-review-receipt-001'
  };
  const delta = twin.evaluateSpecificationDelta(previous, current, registry, verticalPack, { priorHumanDecision });

  assert.equal(delta.documentRevisionChange.currentSupersedesRevisionId, 'rev-001');
  assert.equal(delta.requirementChanges.length, 1);
  assert.deepEqual(delta.requirementChanges[0].changedFields, ['valueState', 'evidenceClaimRefs']);
  assert.equal(delta.fitChanges[0].previous.result, 'FIT');
  assert.equal(delta.fitChanges[0].current.result, 'INSUFFICIENT_EVIDENCE');
  assert.equal(delta.evaluationInvalidated, true);
  assert.equal(delta.technicalOutcomeChanged, true);
  assert.equal(delta.decisionReview.state, 'REVIEW_REQUIRED');
  assert.equal(delta.decisionReview.carryForwardAllowed, false);
  assert.equal(delta.decisionReview.replacementHumanDecision, 'NOT_MADE');
  assert.equal(delta.decisionReview.automaticDecisionChangePerformed, false);
  assert.equal(delta.decisionReview.priorHumanDecision.decision, 'PURSUE');
  assert.equal(delta.revisionTimeline.length, 2);
});

test('Spec Delta distinguishes no prior decision and enforces identity, lineage, and monotonic time', async () => {
  const { twin, registry } = await setup();
  const { previous, current } = pairedSnapshots(twin, registry, opportunity(), opportunity({ valueState: 'UNKNOWN', evidence: '' }));
  const delta = twin.evaluateSpecificationDelta(previous, current, registry, verticalPack);
  assert.equal(delta.decisionReview.state, 'NO_PRIOR_HUMAN_DECISION');
  assert.equal(delta.decisionReview.replacementHumanDecision, 'NOT_MADE');

  const badLineage = twin.buildPursuitRevisionSnapshot(snapshotInput(opportunity({ valueState: 'UNKNOWN', evidence: '' }), {
    revisionId: 'rev-003',
    supersedesRevisionId: 'wrong-revision',
    effectiveAt: '2026-05-20T00:00:00.000Z',
    observedAt: '2026-05-21T00:00:00.000Z',
    refs: ['stage_basic_design']
  }), registry, verticalPack);
  assert.throws(
    () => twin.evaluateSpecificationDelta(previous, badLineage, registry, verticalPack),
    (error) => error.code === 'REVISION_LINEAGE_MISMATCH'
  );

  const other = opportunity({ id: 'syn_dc_other' });
  const otherCurrent = twin.buildPursuitRevisionSnapshot(snapshotInput(other, {
    revisionId: 'rev-002',
    supersedesRevisionId: 'rev-001',
    effectiveAt: '2026-05-20T00:00:00.000Z',
    observedAt: '2026-05-21T00:00:00.000Z',
    refs: ['stage_basic_design', 'req_cooling_water']
  }), registry, verticalPack);
  assert.throws(
    () => twin.evaluateSpecificationDelta(previous, otherCurrent, registry, verticalPack),
    (error) => error.code === 'SNAPSHOT_IDENTITY_MISMATCH'
  );
});

test('Minimum Evidence returns the one bounded project artifact needed only for reevaluation', async () => {
  const { twin, registry } = await setup();
  const minimum = twin.buildMinimumEvidenceToAdvance(
    opportunity({ valueState: 'UNKNOWN', evidence: '' }),
    registry,
    verticalPack
  );
  assert.equal(minimum.advancementState, 'EVIDENCE_REQUIRED_FOR_REEVALUATION');
  assert.equal(minimum.minimumEvidenceSet.length, 1);
  assert.equal(minimum.nextEvidenceItem.side, 'PROJECT');
  assert.equal(minimum.nextEvidenceItem.actionCode, 'REQUEST_COOLING_BASIS_OF_DESIGN');
  assert.deepEqual(minimum.nextEvidenceItem.requestedArtifacts, ['cooling_basis_of_design']);
  assert.equal(minimum.nextEvidenceItem.completionEffect, 'RE_EVALUATE_ONLY');
  assert.equal(minimum.nextEvidenceItem.fitGuarantee, false);
  assert.equal(minimum.fitGuarantee, false);
  assert.equal(minimum.finalHumanDecision, 'NOT_MADE');
  assert.equal(minimum.issue165Status, 'HOLD');
  assert.match(minimum.nextEvidenceItem.evidenceItemId, /^mei_[a-f0-9]{64}$/);
});

test('Verified hard mismatch is a non-evidence gate and never becomes a claimed evidence path', async () => {
  const { twin, registry } = await setup();
  const mismatch = opportunity({
    family: 'medium_voltage_switchgear',
    requirementId: 'req_incoming_voltage',
    category: 'electrical_power',
    key: 'incoming_voltage',
    operator: 'GTE',
    value: { type: 'QUANTITY', key: 'incoming_voltage', value: 33, unit: 'kV', quantityKind: 'voltage' },
    evidence: 'req_voltage_33kv'
  });
  const minimum = twin.buildMinimumEvidenceToAdvance(mismatch, registry, verticalPack);
  assert.equal(minimum.currentTechnicalOutcomes[0].result, 'NOT_FIT');
  assert.equal(minimum.advancementState, 'NO_EVIDENCE_ONLY_ADVANCE_PATH');
  assert.equal(minimum.minimumEvidenceSet.length, 0);
  assert.equal(minimum.nextEvidenceItem, null);
  assert.ok(minimum.nonEvidenceGates.some((gate) => gate.code === 'VERIFIED_HARD_REQUIREMENT_MISMATCH'));
  assert.ok(minimum.nonEvidenceGates.every((gate) => gate.resolvableByAdditionalEvidenceAlone === false));
});

test('Unverified product capability creates a PRODUCT-side verification item', async () => {
  const { twin, registry } = await setup();
  const protocol = opportunity({
    family: 'energy_analytics',
    requirementId: 'req_required_protocols',
    category: 'controls_bms',
    key: 'required_protocols',
    operator: 'CONTAINS_ALL',
    value: { type: 'STRING_SET', key: 'required_protocols', value: ['BACNET_IP'] },
    evidence: 'req_bacnet'
  });
  const minimum = twin.buildMinimumEvidenceToAdvance(protocol, registry, verticalPack);
  assert.equal(minimum.currentTechnicalOutcomes[0].result, 'CONDITIONAL_FIT');
  assert.equal(minimum.advancementState, 'EVIDENCE_REQUIRED_FOR_REEVALUATION');
  assert.equal(minimum.nextEvidenceItem.side, 'PRODUCT');
  assert.equal(minimum.nextEvidenceItem.actionCode, 'VERIFY_PRODUCT_CAPABILITY');
  assert.deepEqual(minimum.nextEvidenceItem.reasonCodes, ['CAPABILITY_CLAIM_UNVERIFIED']);
});

test('Stage uncertainty creates STAGE evidence while a closed window remains a non-evidence gate', async () => {
  const { twin, registry } = await setup();
  const unknownStage = opportunity({ stage: 'UNKNOWN', stageRef: '' });
  const unknownMinimum = twin.buildMinimumEvidenceToAdvance(unknownStage, registry, verticalPack);
  assert.equal(unknownMinimum.advancementState, 'EVIDENCE_REQUIRED_FOR_REEVALUATION');
  assert.equal(unknownMinimum.nextEvidenceItem.side, 'STAGE');
  assert.equal(unknownMinimum.nextEvidenceItem.actionCode, 'VERIFY_PROJECT_STAGE');

  const stageAndProject = twin.buildMinimumEvidenceToAdvance(
    opportunity({ stage: 'UNKNOWN', stageRef: '', valueState: 'UNKNOWN', evidence: '' }),
    registry,
    verticalPack
  );
  assert.deepEqual(stageAndProject.minimumEvidenceSet.map((item) => item.side), ['STAGE', 'PROJECT']);
  assert.deepEqual(stageAndProject.minimumEvidenceSet.map((item) => item.priority), [1, 2]);

  const closed = opportunity({ stage: 'AWARD', stageRef: 'stage_award' });
  const closedMinimum = twin.buildMinimumEvidenceToAdvance(closed, registry, verticalPack);
  assert.equal(closedMinimum.currentTechnicalOutcomes[0].result, 'FIT');
  assert.equal(closedMinimum.currentTechnicalOutcomes[0].windowState, 'CLOSED');
  assert.equal(closedMinimum.advancementState, 'NON_EVIDENCE_GATE_BLOCKED');
  assert.equal(closedMinimum.minimumEvidenceSet.length, 0);
  assert.ok(closedMinimum.nonEvidenceGates.some((gate) => gate.code === 'SPECIFICATION_WINDOW_CLOSED'));

  const cancelled = opportunity({ stage: 'CANCELLED', stageRef: '' });
  const cancelledMinimum = twin.buildMinimumEvidenceToAdvance(cancelled, registry, verticalPack);
  assert.equal(cancelledMinimum.advancementState, 'NON_EVIDENCE_GATE_BLOCKED');
  assert.equal(cancelledMinimum.minimumEvidenceSet.length, 0);
  assert.equal(cancelledMinimum.evidenceItems.length, 0);
  assert.ok(cancelledMinimum.nonEvidenceGates.some((gate) => gate.code === 'PROJECT_CANCELLED'));
});

test('Missing window policy, missing question policy, and empty scope fail closed', async () => {
  const { twin, registry } = await setup();
  const missingWindow = opportunity({
    family: 'synthetic_unmapped_family',
    requirementId: 'req_unknown_product',
    category: 'cooling',
    key: 'cooling_architecture',
    valueState: 'UNKNOWN',
    evidence: ''
  });
  const missingWindowMinimum = twin.buildMinimumEvidenceToAdvance(missingWindow, registry, verticalPack);
  assert.ok(missingWindowMinimum.nonEvidenceGates.some((gate) => gate.code === 'MISSING_SPECIFICATION_WINDOW_POLICY'));
  assert.equal(missingWindowMinimum.minimumEvidenceSet.length, 0);

  const missingQuestion = opportunity({
    family: 'oil_free_compressor',
    requirementId: 'req_thermal_capacity',
    category: 'cooling',
    key: 'thermal_capacity_min',
    valueState: 'UNKNOWN',
    operator: 'GTE',
    value: { type: 'QUANTITY', key: 'thermal_capacity_min', value: 1, unit: 'MW_th', quantityKind: 'thermal_power' },
    evidence: ''
  });
  const missingQuestionMinimum = twin.buildMinimumEvidenceToAdvance(missingQuestion, registry, verticalPack);
  assert.ok(missingQuestionMinimum.nonEvidenceGates.some((gate) => gate.code === 'MISSING_QUESTION_POLICY'));
  assert.equal(missingQuestionMinimum.minimumEvidenceSet.length, 0);

  const empty = opportunity({ family: null, stage: 'UNKNOWN', stageRef: '' });
  const emptyMinimum = twin.buildMinimumEvidenceToAdvance(empty, registry, verticalPack);
  assert.equal(emptyMinimum.advancementState, 'NO_EVALUABLE_PRODUCT_SCOPE');
  assert.ok(emptyMinimum.nonEvidenceGates.some((gate) => gate.code === 'NO_EVALUABLE_PRODUCT_SCOPE'));
});

test('A technically FIT and open family is already reviewable without inventing more evidence', async () => {
  const { twin, registry } = await setup();
  const minimum = twin.buildMinimumEvidenceToAdvance(opportunity(), registry, verticalPack);
  assert.equal(minimum.currentTechnicalOutcomes[0].result, 'FIT');
  assert.equal(minimum.currentTechnicalOutcomes[0].windowState, 'OPEN');
  assert.equal(minimum.advancementState, 'ALREADY_REVIEWABLE');
  assert.equal(minimum.minimumEvidenceSet.length, 0);
  assert.equal(minimum.nextEvidenceItem, null);
  assert.equal(minimum.finalHumanDecision, 'NOT_MADE');
});

test('Integrated review packet is stable, escaped, bounded, and excludes counterfactual fit', async () => {
  const { core, twin, registry } = await setup();
  const before = opportunity();
  const after = opportunity({ valueState: 'UNKNOWN', evidence: '' });
  const { previous, current } = pairedSnapshots(twin, registry, before, after);
  const priorHumanDecision = {
    decisionId: 'synthetic-decision-001',
    decision: 'PURSUE',
    decidedAt: '2026-05-15T00:00:00.000Z',
    snapshotCanonicalSha256: previous.canonicalSha256,
    reviewReceipt: 'synthetic-human-review-receipt-001'
  };
  const one = twin.buildPursuitTwinReviewPacket({ previousSnapshot: previous, currentSnapshot: current, priorHumanDecision }, registry, verticalPack);
  const two = twin.buildPursuitTwinReviewPacket({ previousSnapshot: clone(previous), currentSnapshot: clone(current), priorHumanDecision: clone(priorHumanDecision) }, registry, verticalPack);
  assert.deepEqual(one, two);
  assert.equal(twin.renderPursuitTwinReviewPacketJson(one), twin.renderPursuitTwinReviewPacketJson(two));
  assert.equal(twin.renderPursuitTwinReviewPacketMarkdown(one), twin.renderPursuitTwinReviewPacketMarkdown(two));
  assert.deepEqual(twin.pursuitTwinReviewPacketHashes(one), twin.pursuitTwinReviewPacketHashes(two));
  assert.deepEqual(one.excludedCapabilities, ['COUNTERFACTUAL_FIT']);
  assert.equal(one.productionReady, false);
  assert.equal(one.finalHumanDecision, 'NOT_MADE');
  assert.equal(one.specificationDelta.decisionReview.state, 'REVIEW_REQUIRED');

  const unsafeDocumentKey = '**unsafe** [follow](javascript:alert(1)) <img src=x>';
  const unsafePrevious = twin.buildPursuitRevisionSnapshot(snapshotInput(before, {
    revisionId: 'unsafe-rev-001',
    effectiveAt: '2026-04-10T00:00:00.000Z',
    observedAt: '2026-04-11T00:00:00.000Z',
    refs: ['stage_basic_design', 'req_cooling_water'],
    documentKey: unsafeDocumentKey
  }), registry, verticalPack);
  const unsafeCurrent = twin.buildPursuitRevisionSnapshot(snapshotInput(after, {
    revisionId: 'unsafe-rev-002',
    supersedesRevisionId: 'unsafe-rev-001',
    effectiveAt: '2026-05-20T00:00:00.000Z',
    observedAt: '2026-05-21T00:00:00.000Z',
    refs: ['stage_basic_design'],
    documentKey: unsafeDocumentKey
  }), registry, verticalPack);
  const unsafePacket = twin.buildPursuitTwinReviewPacket({ previousSnapshot: unsafePrevious, currentSnapshot: unsafeCurrent }, registry, verticalPack);
  const markdown = twin.renderPursuitTwinReviewPacketMarkdown(unsafePacket);
  assert.match(markdown, /\\\*\\\*unsafe\\\*\\\*/);
  assert.ok(markdown.includes('\\[follow\\]\\(javascript:alert\\(1\\)\\)'));
  assert.match(markdown, /&lt;img src=x&gt;/);
  assert.doesNotMatch(markdown, /\]\(javascript:/);
  assert.doesNotMatch(markdown, /<img/i);

  const modified = clone(one);
  modified.minimumEvidenceToAdvance.minimumEvidenceSet[0].text = 'modified without lineage';
  assert.throws(
    () => twin.renderPursuitTwinReviewPacketJson(modified),
    (error) => error.code === 'PURSUIT_TWIN_REVIEW_PACKET_HASH_MISMATCH'
  );

  const nestedForged = clone(one);
  nestedForged.minimumEvidenceToAdvance.advancementState = 'ALREADY_REVIEWABLE';
  const outerPayload = clone(nestedForged);
  delete outerPayload.canonicalSha256;
  nestedForged.canonicalSha256 = core.sha256(outerPayload);
  assert.throws(
    () => twin.renderPursuitTwinReviewPacketJson(nestedForged),
    (error) => error.code === 'PURSUIT_TWIN_NESTED_HASH_MISMATCH'
  );

  const dossierForged = clone(one);
  dossierForged.currentPursuitDossier.decision.technicalPursuitState = 'PURSUE';
  const dossierOuterPayload = clone(dossierForged);
  delete dossierOuterPayload.canonicalSha256;
  dossierForged.canonicalSha256 = core.sha256(dossierOuterPayload);
  assert.throws(
    () => twin.renderPursuitTwinReviewPacketJson(dossierForged),
    (error) => error.code === 'PURSUIT_TWIN_DOSSIER_HASH_MISMATCH'
  );

  const poisoned = clone(one);
  poisoned.minimumEvidenceToAdvance.minimumEvidenceSet[0].text = 'Bearer abcdefghijklmnopqrstuvwxyz123456';
  assert.throws(
    () => twin.renderPursuitTwinReviewPacketMarkdown(poisoned),
    (error) => error.code === 'SECRET_SHAPED_VALUE'
  );
  assert.ok(one.explicitNonClaims.some((claim) => /does not make or replace a human pursuit decision/i.test(claim)));
  assert.ok(one.minimumEvidenceToAdvance.explicitNonClaims.some((claim) => /does not guarantee FIT/i.test(claim)));
  assert.equal(one.specificationDelta.decisionReview.automaticDecisionChangePerformed, false);
});
