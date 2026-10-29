const test = require('node:test');
const assert = require('node:assert/strict');

const rawRegistry = require('../knowledge/claim-registry/synthetic/datacenter-claims-v1.json');
const verticalPack = require('../verticals/datacenter/vertical-pack-v0.json');
const fixture = require('../eval/fixtures/spec-fit/datacenter-v0-scenarios.json');
const projectContext = require('../eval/fixtures/pilot-review/project-context-v1.json');
const pilotRegistry = { ...rawRegistry, claims: rawRegistry.claims.map(claim =>
  projectContext.claimReplacements.find(replacement => replacement.claimKey === claim.claimKey) || claim) };
const ids = ['ELECTRICAL', 'MISSING_VOLTAGE', 'HARD_MISMATCH', 'UNVERIFIED_CAPABILITY',
  'EXPIRED_CAPABILITY', 'WRONG_JURISDICTION', 'WINDOW_CLOSED'];
const load = () => import('../scripts/lib/pilot-review-workspace.mjs');

test('every referenced project requirement and stage belongs to the displayed synthetic project', async () => {
  const { buildPilotReviewWorkspace } = await load();
  for (const item of buildPilotReviewWorkspace().cases) {
    assert.equal(item.opportunity.identity.opportunityId, item.opportunity.opportunityId);
    for (const claim of item.claims.filter(claim => claim.subject.type === 'PROJECT')) {
      assert.equal(claim.subject.id, item.opportunity.opportunityId, `${item.id}: ${claim.claimKey}`);
      assert.equal(claim.subject.displayName, item.opportunity.identity.projectDisplayName);
      for (const source of claim.evidence) {
        assert.match(source.sourceUrl, /^https:\/\/synthetic\.example\/projects\/alpha(?:-|\/)/);
        assert.doesNotMatch(`${source.sourceTitle} ${source.sourceUrl}`, /mismatch/i);
      }
    }
  }
});

test('workspace contains only seven frozen synthetic cases and never a human decision', async () => {
  const { buildPilotReviewWorkspace } = await load();
  const workspace = buildPilotReviewWorkspace();
  assert.deepEqual(workspace.cases.map(item => item.id), ids);
  assert.equal(workspace.schemaVersion, 'b2b-pilot-review-workspace-v1');
  assert.equal(workspace.evidenceBoundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(workspace.synthetic, true);
  assert.equal(workspace.productionReady, false);
  assert.equal(workspace.issue165Status, 'HOLD');
  assert.equal(workspace.evaluationAsOf, '2026-06-01T00:00:00.000Z');
  for (const item of workspace.cases) {
    assert.deepEqual(Object.keys(item).sort(), ['id', 'title', 'description', 'opportunity',
      'evaluation', 'minimumEvidence', 'dossier', 'claims', 'inputSha256', 'caseSha256'].sort());
    assert.ok(item.title.trim());
    assert.ok(item.description.trim());
    assert.equal(item.dossier.decision.finalHumanPursuitDecision, 'NOT_MADE');
    assert.equal(item.minimumEvidence.finalHumanDecision, 'NOT_MADE');
    assert.equal(item.minimumEvidence.fitGuarantee, false);
  }
});

test('each case preserves curated synthetic inputs and actual engine outputs at the frozen clock', async () => {
  const { buildPilotReviewCase } = await load();
  const { runFitVariant } = await import('../eval/spec-fit-evaluator.mjs');
  const engine = await import('../verticals/datacenter/index.mjs');
  const { buildMinimumEvidenceToAdvance } = await import('../verticals/datacenter/pursuit-twin-v0.mjs');
  const { sha256 } = await import('../knowledge/claim-registry/index.mjs');
  for (const id of ids) {
    const item = buildPilotReviewCase(id);
    const { input, registry, observed } = runFitVariant(id, pilotRegistry, verticalPack);
    input.opportunityId = projectContext.opportunityId;
    input.identity = { ...input.identity, ...projectContext.identity, opportunityId: projectContext.opportunityId };
    const evaluation = engine.evaluateSpecificationFit(input, registry, verticalPack);
    assert.deepEqual(item.opportunity, input);
    assert.deepEqual(item.evaluation, evaluation);
    assert.deepEqual(item.minimumEvidence, buildMinimumEvidenceToAdvance(input, registry, verticalPack));
    assert.deepEqual(item.dossier, engine.buildPursuitDossier(input, evaluation, registry, verticalPack));
    assert.deepEqual(observed, fixture.scenarios.find(scenario => scenario.variant === id).expected);
    assert.equal(item.inputSha256, sha256({ opportunity: input,
      registry: { asOf: registry.asOf, claims: registry.claims }, verticalPack }));
  }
});

test('missing voltage requests bounded project evidence while verified mismatch has no evidence-only path', async () => {
  const { buildPilotReviewCase } = await load();
  const missing = buildPilotReviewCase('MISSING_VOLTAGE');
  const mismatch = buildPilotReviewCase('HARD_MISMATCH');
  assert.equal(missing.opportunity.requirements[0].valueState, 'UNKNOWN');
  assert.deepEqual(missing.opportunity.requirements[0].evidenceClaimRefs, []);
  assert.equal(missing.evaluation.results[0].result, 'INSUFFICIENT_EVIDENCE');
  assert.equal(missing.minimumEvidence.advancementState, 'EVIDENCE_REQUIRED_FOR_REEVALUATION');
  assert.equal(missing.minimumEvidence.minimumEvidenceSet.length, 1);
  assert.equal(missing.minimumEvidence.nextEvidenceItem.side, 'PROJECT');
  assert.equal(missing.minimumEvidence.nextEvidenceItem.actionCode, 'REQUEST_ELECTRICAL_SINGLE_LINE');
  assert.equal(mismatch.opportunity.requirements[0].value.value, 33);
  assert.equal(mismatch.evaluation.results[0].result, 'NOT_FIT');
  assert.equal(mismatch.minimumEvidence.advancementState, 'NO_EVIDENCE_ONLY_ADVANCE_PATH');
  assert.deepEqual(mismatch.minimumEvidence.minimumEvidenceSet, []);
  assert.ok(mismatch.minimumEvidence.nonEvidenceGates.some(item => item.code === 'VERIFIED_HARD_REQUIREMENT_MISMATCH'));
});

test('unverified and expired capabilities retain their distinct normalized statuses and review-only fit', async () => {
  const { buildPilotReviewCase } = await load();
  for (const [id, key, status, reason] of [
    ['UNVERIFIED_CAPABILITY', 'cap_bms_unverified', 'UNVERIFIED', 'CAPABILITY_CLAIM_UNVERIFIED'],
    ['EXPIRED_CAPABILITY', 'cap_bms_expired', 'EXPIRED', 'CAPABILITY_CLAIM_EXPIRED']
  ]) {
    const item = buildPilotReviewCase(id);
    const claim = item.claims.find(claim => claim.claimKey === key);
    assert.equal(claim.status, status);
    assert.equal(item.evaluation.results[0].result, 'CONDITIONAL_FIT');
    assert.deepEqual(item.evaluation.results[0].reasons.map(reason => reason.code), [reason]);
    assert.equal(item.dossier.decision.technicalPursuitState, 'HOLD');
    assert.equal(item.dossier.customerUsableClaims.some(entry => entry.claimId === claim.claimId), false);
    assert.equal(item.minimumEvidence.nextEvidenceItem.side, 'PRODUCT');
  }
});

test('wrong jurisdiction preserves excluded family evidence and does not invent an evidence-only scope fix', async () => {
  const { buildPilotReviewCase } = await load();
  const item = buildPilotReviewCase('WRONG_JURISDICTION');
  assert.equal(item.opportunity.jurisdiction, 'US');
  assert.equal(item.evaluation.results[0].result, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(item.evaluation.results[0].reasons.map(reason => reason.code), ['JURISDICTION_MISMATCH']);
  assert.equal(item.evaluation.results[0].window.state, 'UNKNOWN');
  const capability = item.claims.find(claim => claim.claimKey === 'cap_switchgear_24kv');
  assert.equal(capability.status, 'VERIFIED');
  assert.deepEqual(capability.applicability.jurisdictions, ['KR']);
  assert.equal(item.evaluation.results[0].capabilityClaimIds.includes(capability.claimId), false);
  assert.equal(item.minimumEvidence.advancementState, 'NON_EVIDENCE_GATE_BLOCKED');
  assert.deepEqual(item.minimumEvidence.minimumEvidenceSet, []);
  assert.ok(item.minimumEvidence.nonEvidenceGates.some(gate => gate.reasonCodes.includes('JURISDICTION_MISMATCH')));
});

test('closed window stays separate from technical FIT and blocks an evidence-only advance path', async () => {
  const { buildPilotReviewCase } = await load();
  const item = buildPilotReviewCase('WINDOW_CLOSED');
  assert.equal(item.evaluation.results[0].result, 'FIT');
  assert.equal(item.evaluation.results[0].window.state, 'CLOSED');
  assert.equal(item.dossier.decision.technicalPursuitState, 'HOLD');
  assert.equal(item.minimumEvidence.advancementState, 'NON_EVIDENCE_GATE_BLOCKED');
  assert.ok(item.minimumEvidence.nonEvidenceGates.some(gate => gate.code === 'SPECIFICATION_WINDOW_CLOSED'));
  assert.deepEqual(item.minimumEvidence.minimumEvidenceSet, []);
  assert.ok(item.claims.some(claim => claim.claimKey === 'stage_award'));
  assert.ok(item.claims.some(claim => claim.claimKey === 'req_bacnet'));
});

test('case claims preserve normalized required/stage/family references without promotion or unrelated families', async () => {
  const { buildPilotReviewWorkspace } = await load();
  const { createValidatedClaimRegistry } = await import('../knowledge/claim-registry/index.mjs');
  const registry = createValidatedClaimRegistry(pilotRegistry, { asOf: rawRegistry.evaluationAsOf });
  for (const item of buildPilotReviewWorkspace().cases) {
    for (const claim of item.claims) assert.deepEqual(claim, registry.byId.get(claim.claimId));
    for (const ref of [...item.opportunity.stage.evidenceClaimRefs,
      ...item.opportunity.requirements.flatMap(requirement => requirement.evidenceClaimRefs)]) {
      assert.ok(item.claims.some(claim => claim.claimKey === ref || claim.claimId === ref));
    }
    assert.equal(item.claims.some(claim => claim.claimKey === 'cap_compressor_water'), false);
    assert.deepEqual(item.claims.map(claim => claim.claimId), [...item.claims.map(claim => claim.claimId)].sort());
  }
});

test('canonical hashes bind full materialized inputs and outputs and repeated builds are isolated', async () => {
  const { buildPilotReviewWorkspace, buildPilotReviewCase } = await load();
  const { sha256 } = await import('../knowledge/claim-registry/index.mjs');
  const first = buildPilotReviewWorkspace();
  assert.deepEqual(first, buildPilotReviewWorkspace());
  const { workspaceSha256, ...workspacePayload } = first;
  assert.equal(workspaceSha256, sha256(workspacePayload));
  for (const item of first.cases) {
    const { caseSha256, ...casePayload } = item;
    assert.equal(caseSha256, sha256(casePayload));
    assert.deepEqual(item, buildPilotReviewCase(item.id));
  }
  const original = first.cases[0].caseSha256;
  first.cases[0].opportunity.requirements[0].value.value = 999;
  assert.equal(buildPilotReviewCase('ELECTRICAL').caseSha256, original);
  assert.notEqual(sha256(first.cases[0]), sha256(buildPilotReviewCase('ELECTRICAL')));
});

test('only exact curated IDs are accepted and callers cannot supply registry, engine, or date inputs', async () => {
  const { buildPilotReviewWorkspace, buildPilotReviewCase } = await load();
  for (const id of [undefined, null, '', 'COOLING', 'electrical', ' ELECTRICAL', '__proto__', {}, ['ELECTRICAL']]) {
    assert.throws(() => buildPilotReviewCase(id), /UNKNOWN_PILOT_REVIEW_CASE/);
  }
  assert.throws(() => buildPilotReviewCase('ELECTRICAL', { registry: { claims: [] } }), /PILOT_REVIEW_INPUTS_REFUSED/);
  assert.throws(() => buildPilotReviewWorkspace({ evaluationAsOf: '2027-01-01' }), /PILOT_REVIEW_INPUTS_REFUSED/);
});
