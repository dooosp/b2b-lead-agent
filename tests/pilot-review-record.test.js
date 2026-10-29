const test = require('node:test');
const assert = require('node:assert/strict');
const workspace = { workspaceSha256: 'a'.repeat(64), cases: [{ id: 'ELECTRICAL', caseSha256: 'b'.repeat(64), title: 'Electrical', evaluation: { results: [{ result: 'FIT' }] }, minimumEvidence: { requests: [] }, claims: [] }, { id: 'MISSING_VOLTAGE', caseSha256: 'c'.repeat(64), title: 'Missing voltage', evaluation: { results: [{ result: 'INSUFFICIENT_EVIDENCE' }] }, minimumEvidence: { requests: [] }, claims: [] }] };
const setup = () => import('../scripts/lib/pilot-review-record.mjs');

test('pilot records preserve exact draft fields, bind every case and never default authorship', async () => {
  const api = await setup();
  const draft = api.createPilotDraft(workspace);
  assert.equal(draft.recordKind, '');
  assert.deepEqual(draft.reviews[0], { caseId: 'ELECTRICAL', caseSha256: 'b'.repeat(64), disposition: 'UNDECIDED', reason: '', nextAction: '', baselineMinutes: null, assistedMinutes: null });
  assert.throws(() => api.createPilotReviewRecord(workspace, draft), /recordKind/);
  draft.recordKind = 'AGENT_SIMULATION';
  draft.reviews[0].reason = '<script>alert(1)</script>\nraw review';
  draft.reviews[0].nextAction = 'Obtain source';
  draft.reviews[0].disposition = 'HOLD';
  const record = api.createPilotReviewRecord(workspace, draft);
  assert.equal(record.authorship, 'AI_AGENT_SIMULATION');
  assert.equal(record.humanParticipant, false);
  assert.equal(record.formalPilotContribution, false);
  assert.equal(record.productionReady, false);
  assert.deepEqual(api.parsePilotReviewRecord(JSON.stringify(record), workspace), record);
  assert.equal(api.pilotReviewSummary(record).completedCases, 1);
  assert.equal(api.pilotReviewSummary(record).totalCases, 2);
});

test('pilot import refuses forged authority, case substitutions and malformed review values', async () => {
  const api = await setup();
  const draft = api.createPilotDraft(workspace);
  draft.recordKind = 'OTHER_USER_TRIAL';
  const valid = api.createPilotReviewRecord(workspace, draft);
  assert.equal(valid.authorship, 'SELF_REPORTED_NOT_VERIFIED');
  assert.equal(valid.humanParticipant, null);
  const changes = [
    r => { r.registry = { status: 'VERIFIED' }; }, r => { r.evaluation = { result: 'FIT' }; },
    r => { r.productionReady = true; }, r => { r.formalPilotContribution = true; },
    r => { r.authorship = 'HUMAN_VERIFIED'; }, r => { r.humanParticipant = true; },
    r => { r.workspaceSha256 = 'd'.repeat(64); }, r => { r.reviews[0].caseSha256 = 'e'.repeat(64); },
    r => { r.reviews[1] = structuredClone(r.reviews[0]); }, r => { r.reviews.pop(); },
    r => { r.reviews[0].engine = 'FIT'; }, r => { r.reviews[0].disposition = 'APPROVED'; },
    r => { r.reviews[0].reason = 12; }, r => { r.reviews[0].nextAction = 'x'.repeat(1601); },
    r => { r.reviews[0].baselineMinutes = -1; }, r => { r.reviews[0].assistedMinutes = 1441; },
    r => { r.reviews[0].baselineMinutes = '30'; }, r => { r.reviews[0].assistedMinutes = {}; },
    r => { r.__proto__ = { productionReady: true }; r.extra = 1; },
  ];
  for (const mutate of changes) {
    const forged = structuredClone(valid); mutate(forged);
    assert.throws(() => api.parsePilotReviewRecord(JSON.stringify(forged), workspace));
  }
  assert.throws(() => api.parsePilotReviewRecord('{', workspace), /JSON/);
  assert.throws(() => api.parsePilotReviewRecord(' '.repeat(128 * 1024 + 1), workspace), /128/);
  assert.throws(() => api.parsePilotReviewRecord('한'.repeat(45000), workspace), /128/);
  draft.reviews[0].baselineMinutes = Infinity;
  assert.throws(() => api.createPilotReviewRecord(workspace, draft), /Minutes/);
});

test('timing summaries exclude unpaired values and retain negative self-reported differences', async () => {
  const api = await setup(); const draft = api.createPilotDraft(workspace); draft.recordKind = 'OWNER_REPRODUCTION';
  draft.reviews[0].baselineMinutes = 5; draft.reviews[0].assistedMinutes = 12;
  draft.reviews[1].baselineMinutes = 90;
  draft.reviews[0].disposition = 'HOLD'; draft.reviews[0].reason = '   '; draft.reviews[0].nextAction = 'Ask';
  const record = api.createPilotReviewRecord(workspace, draft);
  assert.deepEqual(api.pilotReviewSummary(record), { totalCases: 2, completedCases: 0, pairedCases: 1, baselineMinutes: 5, assistedMinutes: 12, differenceMinutes: -7 });
  const markdown = api.renderPilotReviewMarkdown(workspace, record);
  assert.match(markdown, /-7/); assert.match(markdown, /SELF_REPORTED_NOT_VERIFIED/); assert.match(markdown, /FIT/); assert.match(markdown, /INSUFFICIENT_EVIDENCE/);
  assert.doesNotMatch(markdown, /90 min|ROI:|effectiveness:/);
});

test('readable exports escape hostile reviewer markup and separate immutable engine traces', async () => {
  const api = await setup(); const draft = api.createPilotDraft(workspace); draft.recordKind = 'AGENT_SIMULATION';
  draft.reviews[0].reason = '<script>alert(1)</script>\n[approve](javascript:alert(1))\n```';
  const record = api.createPilotReviewRecord(workspace, draft);
  const markdown = api.renderPilotReviewMarkdown(workspace, record);
  assert.doesNotMatch(markdown, /<script>|\[approve\]\(javascript|```/);
  assert.match(markdown, /AI_AGENT_SIMULATION/); assert.match(markdown, /Immutable engine packet/);
});
