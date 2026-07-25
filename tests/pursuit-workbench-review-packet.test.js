const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWorkbenchViewModel } = require('./helpers/pursuit-workbench');

function expectCode(code) {
  return (error) => error?.code === code;
}

function selection(viewModel, disposition, reasonCodes, overrides = {}) {
  return {
    productFamilyId: viewModel.reviewPolicy.families[0].productFamilyId,
    disposition,
    reasonCodes,
    selectedQuestionIds: [],
    acknowledgedNonClaims: true,
    ...overrides
  };
}

test('every technical-review disposition is supported only by an explicit policy prerequisite', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const cases = [
    ['strong_verified_cooling_fit', 'READY_FOR_TECHNICAL_REVIEW', 'VERIFIED_FIT_TRACE'],
    ['missing_incoming_voltage', 'HOLD_FOR_PROJECT_EVIDENCE', 'REQUIRED_PROJECT_FACT_MISSING'],
    ['unverified_product_capability', 'HOLD_FOR_PRODUCT_EVIDENCE', 'CAPABILITY_CLAIM_UNVERIFIED'],
    ['missing_incoming_voltage', 'HOLD_FOR_TECHNICAL_REQUIREMENTS', 'REQUIRED_TECHNICAL_INPUT_MISSING'],
    ['specification_window_closed', 'DEFER_FOR_PROJECT_STAGE', 'SPEC_WINDOW_CLOSED'],
    ['hard_voltage_mismatch', 'REJECT_TECHNICAL_MISMATCH', 'HARD_REQUIREMENT_MISMATCH'],
    ['conflicting_capability_claims', 'ESCALATE_DOMAIN_EXPERT', 'DOMAIN_EXPERT_REQUIRED']
  ];
  for (const [scenarioId, disposition, reason] of cases) {
    const viewModel = await loadWorkbenchViewModel(scenarioId);
    const normalized = packet.validateReviewSelection(viewModel, selection(viewModel, disposition, [reason]));
    assert.equal(normalized.disposition, disposition, scenarioId);
    assert.deepEqual(normalized.reasonCodes, [reason]);
  }
  assert.deepEqual([...packet.REVIEW_DISPOSITIONS].sort(), cases.map((item) => item[1]).sort());
});

test('invalid and unsupported reason or disposition combinations fail safely', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const fit = await loadWorkbenchViewModel('strong_verified_cooling_fit');
  assert.throws(() => packet.validateReviewSelection(fit, selection(fit, 'READY_FOR_TECHNICAL_REVIEW', ['UNSUPPORTED_REASON'])), expectCode('REVIEW_REASON_UNSUPPORTED'));
  assert.throws(() => packet.validateReviewSelection(fit, selection(fit, 'REJECT_TECHNICAL_MISMATCH', ['VERIFIED_FIT_TRACE'])), expectCode('REVIEW_DISPOSITION_UNSUPPORTED'));
  assert.throws(() => packet.validateReviewSelection(fit, selection(fit, 'COMMERCIAL_GO', ['VERIFIED_FIT_TRACE'])), expectCode('REVIEW_DISPOSITION_UNKNOWN'));
});

test('READY without fit trace and REJECT without hard mismatch are refused', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const missing = await loadWorkbenchViewModel('missing_incoming_voltage');
  const fit = await loadWorkbenchViewModel('strong_verified_cooling_fit');
  assert.throws(() => packet.validateReviewSelection(missing, selection(missing, 'READY_FOR_TECHNICAL_REVIEW', ['REQUIRED_PROJECT_FACT_MISSING'])), expectCode('REVIEW_DISPOSITION_UNSUPPORTED'));
  assert.throws(() => packet.validateReviewSelection(fit, selection(fit, 'REJECT_TECHNICAL_MISMATCH', ['HARD_REQUIREMENT_MISMATCH'])), expectCode('REVIEW_DISPOSITION_UNSUPPORTED'));
});

test('acknowledgement is mandatory and selections cannot contain free text or identity', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const viewModel = await loadWorkbenchViewModel('strong_verified_cooling_fit');
  assert.throws(() => packet.validateReviewSelection(viewModel, selection(viewModel, 'READY_FOR_TECHNICAL_REVIEW', ['VERIFIED_FIT_TRACE'], { acknowledgedNonClaims: false })), expectCode('REVIEW_ACKNOWLEDGEMENT_REQUIRED'));
  assert.throws(() => packet.validateReviewSelection(viewModel, { ...selection(viewModel, 'READY_FOR_TECHNICAL_REVIEW', ['VERIFIED_FIT_TRACE']), notes: 'free text' }), expectCode('REVIEW_SELECTION_FIELD_REFUSED'));
  assert.throws(() => packet.validateReviewSelection(viewModel, { ...selection(viewModel, 'READY_FOR_TECHNICAL_REVIEW', ['VERIFIED_FIT_TRACE']), reviewerIdentity: 'person@example.com' }), expectCode('REVIEW_SELECTION_FIELD_REFUSED'));
});

test('question ids are exact, family-scoped, and bounded', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const viewModel = await loadWorkbenchViewModel('missing_incoming_voltage');
  const questionId = viewModel.technicalQuestions[0].questionId;
  const valid = packet.validateReviewSelection(viewModel, selection(viewModel, 'HOLD_FOR_TECHNICAL_REQUIREMENTS', ['REQUIRED_TECHNICAL_INPUT_MISSING'], { selectedQuestionIds: [questionId] }));
  assert.deepEqual(valid.selectedQuestionIds, [questionId]);
  assert.throws(() => packet.validateReviewSelection(viewModel, selection(viewModel, 'HOLD_FOR_TECHNICAL_REQUIREMENTS', ['REQUIRED_TECHNICAL_INPUT_MISSING'], { selectedQuestionIds: ['q_foreign'] })), expectCode('REVIEW_QUESTION_UNSUPPORTED'));
});

test('packet bytes are deterministic for an injected clock and id strategy', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const viewModel = await loadWorkbenchViewModel('strong_verified_cooling_fit');
  const input = selection(viewModel, 'READY_FOR_TECHNICAL_REVIEW', ['SPEC_WINDOW_OPEN', 'VERIFIED_FIT_TRACE']);
  const options = { clock: () => new Date('2026-06-01T12:00:00.000Z'), hash: async () => 'a'.repeat(64) };
  const first = await packet.buildPursuitReviewPacket(viewModel, input, options);
  const second = await packet.buildPursuitReviewPacket(viewModel, { ...input, reasonCodes: [...input.reasonCodes].reverse() }, options);
  assert.deepEqual(first, second);
  assert.equal(packet.serializePursuitReviewPacket(first), packet.serializePursuitReviewPacket(second));
  assert.equal(first.packetId, `prv0_${'a'.repeat(64)}`);
  assert.equal(first.createdAt, '2026-06-01T12:00:00.000Z');
});

test('review packet contains only safe structured fields and no protected content', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const viewModel = await loadWorkbenchViewModel('missing_incoming_voltage');
  const built = await packet.buildPursuitReviewPacket(
    viewModel,
    selection(viewModel, 'HOLD_FOR_TECHNICAL_REQUIREMENTS', ['REQUIRED_TECHNICAL_INPUT_MISSING'], { selectedQuestionIds: [viewModel.technicalQuestions[0].questionId] }),
    { clock: () => '2026-06-01T12:00:00.000Z', hash: async () => 'b'.repeat(64) }
  );
  assert.equal(built.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(built.productionReady, false);
  assert.equal(built.productionReviewerWorkflowReady, false);
  assert.equal(built.issue165Status, 'HOLD');
  assert.equal(built.persistence, 'NONE');
  assert.equal(built.reviewerIdentity, 'NOT_COLLECTED');
  assert.equal(built.packetIntegrity, 'UNSIGNED_LOCAL_PACKET');
  assert.doesNotMatch(JSON.stringify(built), /statement|quote|sourceUrl|sourceTitle|notes|feedback|email|recipient|cookie|token/i);
  assert.match(packet.pursuitReviewPacketFilename(built), /^pursuit-review-[a-z0-9_]+-[a-f0-9]{12}\.json$/);
  assert.ok(Buffer.byteLength(packet.serializePursuitReviewPacket(built), 'utf8') < packet.REVIEW_PACKET_LIMITS.maxBytes);
});

test('packet artifact hashes remain bound to the recomputed dossier and timeline', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const viewModel = await loadWorkbenchViewModel('strong_verified_cooling_fit');
  const built = await packet.buildPursuitReviewPacket(viewModel, selection(viewModel, 'READY_FOR_TECHNICAL_REVIEW', ['VERIFIED_FIT_TRACE']), {
    clock: () => '2026-06-01T12:00:00.000Z', hash: async () => 'c'.repeat(64)
  });
  assert.deepEqual(built.artifactHashes, viewModel.artifactHashes);
  const forged = structuredClone(viewModel);
  forged.artifactHashes.timelineSha256 = 'forged';
  await assert.rejects(packet.buildPursuitReviewPacket(forged, selection(forged, 'READY_FOR_TECHNICAL_REVIEW', ['VERIFIED_FIT_TRACE'])), expectCode('REVIEW_ARTIFACT_HASH_INVALID'));
  for (const key of ['dossierJsonSha256', 'dossierMarkdownSha256', 'timelineSha256']) {
    const missing = structuredClone(viewModel);
    delete missing.artifactHashes[key];
    await assert.rejects(packet.buildPursuitReviewPacket(missing, selection(missing, 'READY_FOR_TECHNICAL_REVIEW', ['VERIFIED_FIT_TRACE'])), expectCode('REVIEW_ARTIFACT_HASH_INVALID'));
  }
  const extra = structuredClone(viewModel);
  extra.artifactHashes.untrustedSha256 = 'd'.repeat(64);
  await assert.rejects(packet.buildPursuitReviewPacket(extra, selection(extra, 'READY_FOR_TECHNICAL_REVIEW', ['VERIFIED_FIT_TRACE'])), expectCode('REVIEW_ARTIFACT_HASH_INVALID'));
});
