#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { writeJsonArtifactInsideWorktree } from './lib/safe-local-artifact-writer.mjs';

const AS_OF = '2026-07-19T00:00:00.000Z';
const EXPECTED_BASE_SHA = '9d144fbe6309ce363f9dad8d50ffa713d24af683';
const EXPECTED_PR206_HEAD = 'b5570e182c8ab6515c0f09272d22d7121518f134';
const EXPECTED_PR207_HEAD = 'c6a5469338999097acd5de7c5a12c827d27d4540';
const EXPECTED_VARIANT_EVALUATION_SHA256 =
  'a73449493dc3cb07b2c28a41446d1bea36eba1f09acf16a6eb092cda5495dfdb';
const EXPECTED_VARIANT_CANONICAL_SHA256 =
  '8c3ceefd6e74b82f87d5e488ecb31a3c3496c6ade16518451c6151f894f6971e';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactCommandSet(group, expectedCommands) {
  assert(group, 'required command group is missing');
  assert(group.expectedCommandCount === expectedCommands.length, `${group.id} expected-command count drifted`);
  assert(
    JSON.stringify(group.commandResults?.map((result) => result.command)) === JSON.stringify(expectedCommands),
    `${group.id} command set or order drifted`,
  );
  assert(
    group.commandResults.every((result) => result.exitCode === 0),
    `${group.id} contains a failed command`,
  );
  assert(
    group.commandResults.every((result) => result.counts && Object.keys(result.counts).length > 0),
    `${group.id} contains a command without exact result counts`,
  );
}

function assertExactCommandCounts(group, expectedCountsByCommand) {
  for (const result of group.commandResults) {
    assert(
      isDeepStrictEqual(result.counts, expectedCountsByCommand[result.command]),
      `${group.id} exact counts drifted for: ${result.command}`,
    );
  }
}

function runJson(root, relativeScript, args = []) {
  const stdout = execFileSync(
    process.execPath,
    [path.join(root, relativeScript), ...args],
    { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

function gitHead(root) {
  return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
}

function gitIsAncestor(root, ancestor, descendant) {
  try {
    execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

async function readDecision(relativePath) {
  return JSON.parse(await readFile(path.join(process.cwd(), relativePath), 'utf8'));
}

async function sha256File(relativePath) {
  return createHash('sha256')
    .update(await readFile(path.join(process.cwd(), relativePath)))
    .digest('hex');
}

const { values } = parseArgs({
  options: {
    'pr206-root': { type: 'string' },
    'pr207-root': { type: 'string' },
    output: { type: 'string' },
  },
  strict: true,
});

assert(values['pr206-root'], '--pr206-root is required');
assert(values['pr207-root'], '--pr207-root is required');
assert(values.output, '--output is required');

const pr206Root = path.resolve(values['pr206-root']);
const pr207Root = path.resolve(values['pr207-root']);
const outputPath = path.resolve(values.output);

const pr206Head = gitHead(pr206Root);
const pr207Head = gitHead(pr207Root);
const reportParentCommitSha = gitHead(process.cwd());
assert(pr206Head === EXPECTED_PR206_HEAD, `unexpected PR206 head: ${pr206Head}`);
assert(pr207Head === EXPECTED_PR207_HEAD, `unexpected PR207 head: ${pr207Head}`);

const humanValidation = runJson(
  pr206Root,
  'scripts/validate-pursuit-workbench-human-validation.mjs',
);
assert(humanValidation.boundary === 'NOT_PRODUCTION_EVIDENCE', 'unexpected PR206 boundary');
assert(humanValidation.status === 'INCOMPLETE', 'PR206 is no longer INCOMPLETE; refresh the decision');
assert(humanValidation.decision === 'INCOMPLETE', 'unexpected PR206 decision');
assert(humanValidation.counts?.recordCount === 5, 'expected five prepared PR206 records');
assert(humanValidation.counts?.eligibleReviewerCount === 0, 'real PR206 reviewers now exist; refresh the decision');
assert(humanValidation.counts?.taskResultCount === 0, 'real PR206 task results now exist; refresh the decision');
assert(humanValidation.counts?.scenarioJudgmentCount === 0, 'real PR206 judgments now exist; refresh the decision');
assert(humanValidation.rates?.independentTaskCompletionRate === null, 'PR206 human rate must remain unavailable');
assert(humanValidation.thresholds?.summary === 'INCOMPLETE', 'unexpected PR206 threshold summary');

const variantSpike = runJson(
  pr207Root,
  'scripts/evaluate-variant-table-evidence-spike.mjs',
  ['--json', '--as-of', AS_OF],
);
assert(variantSpike.boundary === 'NOT_PRODUCTION_EVIDENCE', 'unexpected PR207 boundary');
assert(variantSpike.inputDocumentCount === 8, 'expected eight manifest-bound input documents');
assert(variantSpike.structuredTableCount === 2, 'expected two structured tables');
assert(variantSpike.structuredRowCount === 2, 'expected two structured rows');
assert(variantSpike.proposalCount === 0, 'safe proposals now exist; refresh the decision');
assert(variantSpike.abstentionCount === 2, 'unexpected abstention count');
assert(variantSpike.gateStatus === 'NO_SAFE_PROPOSITION', 'unexpected variant gate');
assert(variantSpike.sourceAuthenticityStatus === 'UNREVIEWED', 'source authenticity must remain unreviewed');
assert(variantSpike.canonicalPatchExportAllowed === false, 'canonical patch export must remain blocked');
assert(variantSpike.evaluationSha256 === EXPECTED_VARIANT_EVALUATION_SHA256, 'variant evaluation drifted');
assert(variantSpike.canonicalSha256 === EXPECTED_VARIANT_CANONICAL_SHA256, 'variant canonical hash drifted');

const documentAudit = runJson(
  pr207Root,
  'scripts/audit-evidence-documents.mjs',
  ['--json'],
);
assert(documentAudit.documentStatus === 'OFFICIAL_EVIDENCE_DOCUMENT_AUDIT_PASS', 'synthetic document audit failed');
assert(documentAudit.summary?.scenarioCount === 35, 'unexpected synthetic audit count');
assert(documentAudit.summary?.reviewState?.actualHumanReviewSessions === 0, 'human PR207 review now exists; refresh the decision');
assert(documentAudit.realDocumentOutcome?.REAL_DOCUMENT_POPULATION === 'PRESENT_REJECTED', 'unexpected fixed-clock intake result');
assert(documentAudit.realDocumentOutcome?.auditAsOf === '2026-07-17T23:59:59.999Z', 'unexpected fixed audit clock');
assert(documentAudit.realDocumentOutcome?.rejectionCodes?.includes('FUTURE_DOCUMENT_DATE'), 'expected fail-closed clock refusal');

const pr206Decision = await readDecision('docs/product/validation/pr206-human-validation-decision.json');
const pr207Decision = await readDecision('docs/product/validation/pr207-real-evidence-pilot-decision.json');
const nextGate = await readDecision('docs/product/validation/evidence-to-decision-next-gate.json');
const preflight = await readDecision('tmp/codex/evidence-to-decision-pilot-repo-preflight.json');
const githubState = await readDecision('tmp/codex/evidence-to-decision-github-state-20260719.json');
const pr207Ledger = await readDecision('docs/product/validation/pr207-real-evidence-input-ledger.json');
const pr207MachineRun = await readDecision('tmp/codex/pr207-real-evidence-pilot-run-non-production.json');
const investigationLedger = await readDecision('tmp/codex/evidence-to-decision-initial-investigation-ledger-20260719.json');
const changeAuthorityAudit = await readDecision('tmp/codex/evidence-to-decision-change-authority-audit-20260719.json');
const commandLedger = await readDecision('tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json');
const packageJson = await readDecision('package.json');
const ciWorkflow = await readFile(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
const githubPr206 = githubState.pullRequests?.find((pullRequest) => pullRequest.number === 206);
const githubPr207 = githubState.pullRequests?.find((pullRequest) => pullRequest.number === 207);

assert(pr206Decision.evaluatedHeadSha === pr206Head, 'PR206 decision head mismatch');
assert(pr206Decision.baseSha === EXPECTED_BASE_SHA, 'PR206 decision base mismatch');
assert(pr206Decision.decision === 'INCOMPLETE', 'PR206 artifact must remain INCOMPLETE');
assert(pr206Decision.safeIntake?.status === 'AVAILABLE', 'PR206 safe-intake status drifted');
assert(
  pr206Decision.automatedGateFitness === 'NOT_DECISION_CAPABLE_WITHOUT_MANUAL_METHOD_REVIEW',
  'PR206 automated-gate warning drifted',
);
assert(pr207Decision.evaluatedHeadSha === pr207Head, 'PR207 decision head mismatch');
assert(pr207Decision.baseSha === EXPECTED_BASE_SHA, 'PR207 decision base mismatch');
assert(pr207Decision.decision === 'INCOMPLETE', 'PR207 artifact must remain INCOMPLETE');
assert(
  pr207Decision.realIntakeExecutionRestriction === 'DO_NOT_LAUNCH_REAL_INTAKE_UI_WITH_UNREVIEWED_DOCUMENTS',
  'PR207 real-intake restriction drifted',
);
assert(
  pr207Ledger.realIntakeUiNormalizedPageTextTransportRisk ===
    'PRESENT_DO_NOT_LAUNCH_BEFORE_RIGHTS_BOUNDARY_REMEDIATION_OR_APPROVAL',
  'PR207 ledger transport-risk warning drifted',
);
assert(pr207MachineRun.evaluatedSourceCount === 11, 'PR207 machine-run evaluated count drifted');
assert(pr207MachineRun.acceptedSourceCount === 8, 'PR207 machine-run accepted count drifted');
assert(pr207MachineRun.refusedSourceCount === 3, 'PR207 machine-run refused count drifted');
assert(
  pr207MachineRun.manifestSha256 === pr207Ledger.machineRunManifestSha256
    && pr207Decision.inputLineage?.machineRunManifestSha256 === pr207MachineRun.manifestSha256,
  'PR207 machine-run manifest hash drifted',
);
const ledgerAcceptedIds = pr207Ledger.documents
  .filter((document) => document.intakeDecision === 'ACCEPTED')
  .map((document) => document.documentId)
  .sort();
const machineAcceptedIds = pr207MachineRun.acceptedDocuments
  .map((document) => document.documentId)
  .sort();
assert(
  JSON.stringify(ledgerAcceptedIds) === JSON.stringify(machineAcceptedIds),
  'PR207 accepted document IDs do not match the machine run',
);
const machineRefusalReasons = Object.fromEntries(
  Object.entries(
    pr207MachineRun.refusedSources.reduce((counts, source) => {
      counts[source.refusalReason] = (counts[source.refusalReason] || 0) + 1;
      return counts;
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right)),
);
const ledgerRefusalReasons = Object.fromEntries(
  Object.entries(pr207Ledger.counts?.machineRunRefusalReasonsExact || {})
    .sort(([left], [right]) => left.localeCompare(right)),
);
assert(
  JSON.stringify(machineRefusalReasons) === JSON.stringify(ledgerRefusalReasons),
  'PR207 refusal reasons do not match the machine run',
);
assert(pr207Decision.humanReviewCounts?.approvedForRepositoryReview === 0, 'PR207 approved count drifted');
assert(
  Object.values(pr207Decision.humanReviewCounts?.approvedForRepositoryReviewByFamily || {})
    .every((count) => count === 0),
  'PR207 per-family approved counts drifted',
);
assert(
  pr207Decision.thresholdResults?.approvedForRepositoryReviewAtLeastTwentyFive === 'INCOMPLETE_0_OF_25',
  'PR207 approved-candidate threshold drifted',
);
assert(
  pr207Decision.thresholdResults?.approvedForRepositoryReviewAtLeastTenPerFamily ===
    'INCOMPLETE_SWITCHGEAR_0_OF_10_TRANSFORMER_0_OF_10',
  'PR207 per-family approved threshold drifted',
);
assert(
  changeAuthorityAudit.initialDecisionRecord?.commitSha === '41ac25adcbb6aebd0de0018660dbcac0b9427d95'
    && changeAuthorityAudit.initialDecisionRecord?.trackA === 'INCOMPLETE'
    && changeAuthorityAudit.initialDecisionRecord?.trackB === 'INCOMPLETE',
  'initial INCOMPLETE decision authority record drifted',
);
assert(
  changeAuthorityAudit.changeAuthorityStatus === 'HOLD_OWNER_DISPOSITION_REQUIRED'
    && changeAuthorityAudit.counts?.postIncompleteImplementationCommits === 4
    && changeAuthorityAudit.counts?.commitsWithExplicitRetentionAuthorityRecord === 0,
  'post-INCOMPLETE change-authority count drifted',
);
const auditedImplementationCommits = changeAuthorityAudit.postIncompleteImplementationCommits
  .map((entry) => entry.commitSha);
assert(
  JSON.stringify(auditedImplementationCommits) === JSON.stringify([
    'b5570e182c8ab6515c0f09272d22d7121518f134',
    'cfa753591f06584c7091bbc122844766b33cbb01',
    '9ef1f94fed500a0fed3d478eb2bb0710baecb861',
    'c6a5469338999097acd5de7c5a12c827d27d4540',
  ]),
  'post-INCOMPLETE implementation commit list drifted',
);
assert(gitIsAncestor(pr206Root, 'b5570e182c8ab6515c0f09272d22d7121518f134', pr206Head), 'PR206 audited implementation is absent');
for (const commitSha of [
  'cfa753591f06584c7091bbc122844766b33cbb01',
  '9ef1f94fed500a0fed3d478eb2bb0710baecb861',
  'c6a5469338999097acd5de7c5a12c827d27d4540',
]) {
  assert(gitIsAncestor(pr207Root, commitSha, pr207Head), `PR207 audited implementation is absent: ${commitSha}`);
}
assert(
  pr206Decision.changeAuthorityAudit === 'tmp/codex/evidence-to-decision-change-authority-audit-20260719.json'
    && pr206Decision.postInitialIncompleteImplementationCommitsPresent?.length === 1,
  'PR206 change-authority disclosure drifted',
);
assert(
  pr207Decision.changeAuthorityAudit === 'tmp/codex/evidence-to-decision-change-authority-audit-20260719.json'
    && pr207Decision.postInitialIncompleteImplementationCommitsPresent?.length === 3,
  'PR207 change-authority disclosure drifted',
);
for (const requiredThreshold of [
  'acceptedDocumentsAtLeastEight',
  'acceptedSwitchgearDocumentsAtLeastFour',
  'acceptedTransformerDocumentsAtLeastFour',
  'koreanAndEnglishRepresented',
  'quoteToPageTraceabilityOneHundredPercent',
  'documentPageHashMismatchEscapesZero',
  'approvedForRepositoryReviewAtLeastTwentyFive',
  'approvedForRepositoryReviewAtLeastTenPerFamily',
  'reviewedSuggestionPrecisionAtLeastEightyPercent',
  'materialUnresolvedConflictsVisiblyBlocking',
  'automaticVerifiedLeakageZero',
  'automaticAllowedLeakageZero',
  'fullDocumentCommitOrLeakageZero',
  'secretOrPrivateLeakageZero',
  'unresolvedP0Zero',
  'generatedPatchSuitableForRepositoryReview',
]) {
  assert(requiredThreshold in pr207Decision.thresholdResults, `missing PR207 MERGE threshold: ${requiredThreshold}`);
}
assert(nextGate.pr206?.evaluatedHeadSha === pr206Head, 'next-gate PR206 head mismatch');
assert(nextGate.pr206?.safeIgnoredIntakeAvailable === true, 'next-gate PR206 safe-intake state drifted');
assert(nextGate.pr207?.evaluatedHeadSha === pr207Head, 'next-gate PR207 head mismatch');
assert(nextGate.evaluatedBaseSha === EXPECTED_BASE_SHA, 'next-gate base mismatch');
assert(preflight.pinnedBaseSha === EXPECTED_BASE_SHA, 'preflight base mismatch');
assert(nextGate.pr206?.draft === true && nextGate.pr206?.unmerged === true, 'next-gate PR206 state drifted');
assert(nextGate.pr207?.draft === true && nextGate.pr207?.unmerged === true, 'next-gate PR207 state drifted');
for (const [label, snapshot, expectedHead] of [
  ['PR206', githubPr206, pr206Head],
  ['PR207', githubPr207, pr207Head],
]) {
  assert(snapshot?.state === 'OPEN', `${label} GitHub state is not OPEN`);
  assert(snapshot?.isDraft === true, `${label} GitHub state is not Draft`);
  assert(snapshot?.mergeable === 'MERGEABLE', `${label} GitHub mergeability drifted`);
  assert(snapshot?.headRefOid === expectedHead, `${label} GitHub head mismatch`);
  assert(snapshot?.baseRefOid === EXPECTED_BASE_SHA, `${label} GitHub base mismatch`);
  assert(snapshot?.checks?.length > 0, `${label} GitHub check snapshot is empty`);
  assert(
    snapshot.checks.every((check) => check.status === 'COMPLETED' && check.conclusion === 'SUCCESS'),
    `${label} GitHub check snapshot is not all-success`,
  );
}
assert(githubState.issue165?.state === 'OPEN', 'Issue #165 GitHub state is not OPEN');
assert(githubState.issue165?.latestDecision === 'HOLD', 'Issue #165 latest decision is not HOLD');
assert(
  githubState.issue165?.latestCommentUrl ===
    'https://github.com/dooosp/b2b-lead-agent/issues/165#issuecomment-4632271853',
  'Issue #165 HOLD evidence reference drifted',
);
assert(investigationLedger.boundary === 'AUTOMATED_READ_ONLY_INVESTIGATION_NOT_HUMAN_REVIEW', 'investigation boundary drifted');
assert(investigationLedger.required === 8 && investigationLedger.completed === 8, 'investigation count drifted');
assert(
  investigationLedger.investigations?.map((investigation) => investigation.id).join('') === 'ABCDEFGH',
  'investigation A-H ledger drifted',
);
assert(
  nextGate.readOnlyInvestigationStatus?.ledger ===
    'tmp/codex/evidence-to-decision-initial-investigation-ledger-20260719.json',
  'next-gate investigation ledger reference drifted',
);
assert(
  nextGate.missingExternalInputs?.filter((input) => input.owner === 'PR207_RIGHTS_SECURITY_OWNER').length === 1
    && nextGate.missingExternalInputs?.filter((input) => input.owner === 'PR207_VALIDATION_METHOD_OWNER').length === 1,
  'independent PR207 rights and validation-method inputs must remain separate',
);
assert(nextGate.pr207?.approvedForRepositoryReview === 0, 'next-gate PR207 approved count drifted');
assert(
  nextGate.fixPolicy?.changeAuthorityStatus === 'HOLD_OWNER_DISPOSITION_REQUIRED'
    && nextGate.fixPolicy?.postInitialIncompleteImplementationCommitsPresent === 4
    && nextGate.missingExternalInputs?.some((input) =>
      input.owner === 'EVIDENCE_TO_DECISION_CHANGE_OWNER'
        && input.required === 4
        && input.current === 0),
  'next-gate change-authority HOLD drifted',
);
assert(nextGate.overallStatus === 'BLOCKED_BOTH', 'overall gate must remain BLOCKED_BOTH');
assert(nextGate.goalCompletionStatus === 'INCOMPLETE_CHANGE_AUTHORITY_HOLD', 'goal completion HOLD drifted');
assert(nextGate.mergeTrainRecommendation === 'NO_MERGE_INPUT_INCOMPLETE', 'merge gate unexpectedly opened');
assert(nextGate.tenderMatrixEntryGate === 'BLOCKED_BOTH', 'Tender Matrix gate unexpectedly opened');
assert(nextGate.issue165Status === 'HOLD', 'Issue #165 boundary unexpectedly changed');
assert(nextGate.productionReady === false, 'production readiness must remain false');
assert(nextGate.productionReviewerWorkflowReady === false, 'production reviewer readiness must remain false');
assert(commandLedger.evaluatedHeads?.pr206 === pr206Head, 'command-ledger PR206 head mismatch');
assert(commandLedger.evaluatedHeads?.pr207 === pr207Head, 'command-ledger PR207 head mismatch');
assert(commandLedger.evaluatedHeads?.base === EXPECTED_BASE_SHA, 'command-ledger base mismatch');
assert(
  commandLedger.commandGroups?.length === 6
    && commandLedger.commandGroups.every((group) => group.status === 'PASS' && group.exitCode === 0),
  'command-ledger result is not all-pass',
);
assert(
  commandLedger.commandGroups.find((group) => group.id === 'PILOT_ARTIFACT_WRITER_SAFETY')?.passed === 5,
  'artifact-writer regression count drifted',
);
assert(
  commandLedger.commandGroups.find((group) => group.id === 'PILOT_WORKFLOW_CONTRACT')?.passed === 29
    && commandLedger.commandGroups.find((group) => group.id === 'PILOT_WORKFLOW_CONTRACT')?.failed === 0,
  'pilot workflow-contract result drifted',
);
assert(
  commandLedger.commandGroups.find((group) => group.id === 'PILOT_REFRESH_VERIFIER')?.goalCompletionStatus ===
    'INCOMPLETE_CHANGE_AUTHORITY_HOLD'
    && commandLedger.commandGroups.find((group) => group.id === 'PILOT_REFRESH_VERIFIER')?.changeAuthorityStatus ===
      'HOLD_OWNER_DISPOSITION_REQUIRED',
  'pilot verifier change-authority result drifted',
);
const pr206Commands = [
  'npm ci',
  'npm run test:pursuit-workbench',
  'npm run eval:pursuit-workbench',
  'npm run test:pursuit-workbench:e2e',
  'npm run test:claim-spec-fit',
  'npm test',
  'npm run check:naming',
  'npm run check:schema',
  'npm run test:e2e:local',
  'npm run test:evidence',
  'npm run check:lead-pipeline-replay',
  'git diff --check',
];
const pr207Commands = [
  'npm ci',
  'npm run test:evidence-claim-workbench',
  'npm run test:evidence-claim-workbench:e2e',
  'npm run eval:evidence-claim-workbench',
  'npm run audit:evidence-documents',
  'npm run measure:evidence-claim-workbench',
  'npm run test:claim-spec-fit',
  'npm test',
  'npm run check:naming',
  'npm run check:schema',
  'npm run test:e2e:local',
  'npm run test:evidence',
  'npm run check:lead-pipeline-replay',
  'git diff --check',
];
const pr206ExpectedCounts = {
  'npm ci': { packagesAdded: 57, packagesAudited: 58, vulnerabilities: 0 },
  'npm run test:pursuit-workbench': { tests: 93, passed: 93, failed: 0 },
  'npm run eval:pursuit-workbench': {
    syntheticScenarios: 12,
    passed: 12,
    failed: 0,
    repeatRuns: 2,
  },
  'npm run test:pursuit-workbench:e2e': { tests: 5, passed: 5, failed: 0 },
  'npm run test:claim-spec-fit': { tests: 37, passed: 37, failed: 0 },
  'npm test': {
    root: { tests: 313, passed: 313, failed: 0 },
    workerUnit: { tests: 416, passed: 416, failed: 0 },
    workerContract: { tests: 30, passed: 30, failed: 0 },
  },
  'npm run check:naming': { commandChecksPassed: 1, commandChecksFailed: 0 },
  'npm run check:schema': { commandChecksPassed: 1, commandChecksFailed: 0 },
  'npm run test:e2e:local': { tests: 1, passed: 1, failed: 0 },
  'npm run test:evidence': { tests: 7, passed: 7, failed: 0 },
  'npm run check:lead-pipeline-replay': { tests: 6, passed: 6, failed: 0 },
  'git diff --check': { whitespaceErrors: 0 },
};
const pr207ExpectedCounts = {
  'npm ci': { packagesAdded: 57, packagesAudited: 58, vulnerabilities: 0 },
  'npm run test:evidence-claim-workbench': { tests: 113, passed: 113, failed: 0 },
  'npm run test:evidence-claim-workbench:e2e': { tests: 4, passed: 4, failed: 0 },
  'npm run eval:evidence-claim-workbench': {
    syntheticScenarios: 35,
    passed: 35,
    failed: 0,
    repeatRuns: 2,
  },
  'npm run audit:evidence-documents': {
    syntheticScenarios: 35,
    syntheticDocumentRecords: 39,
    normalizedDocumentRecords: 26,
    rejectedDocumentRecords: 13,
    realDocumentsAcceptedAtFixedClock: 0,
    realCandidatesCreated: 0,
    actualHumanReviewSessions: 0,
    violations: 0,
  },
  'npm run measure:evidence-claim-workbench': { measurements: 18, violations: 0 },
  'npm run test:claim-spec-fit': { tests: 38, passed: 38, failed: 0 },
  'npm test': {
    root: { tests: 225, passed: 225, failed: 0 },
    workerUnit: { tests: 416, passed: 416, failed: 0 },
    workerContract: { tests: 28, passed: 28, failed: 0 },
  },
  'npm run check:naming': { commandChecksPassed: 1, commandChecksFailed: 0 },
  'npm run check:schema': { commandChecksPassed: 1, commandChecksFailed: 0 },
  'npm run test:e2e:local': { tests: 1, passed: 1, failed: 0 },
  'npm run test:evidence': { tests: 7, passed: 7, failed: 0 },
  'npm run check:lead-pipeline-replay': { tests: 6, passed: 6, failed: 0 },
  'git diff --check': { whitespaceErrors: 0 },
};
const pr206CommandGroup = commandLedger.commandGroups.find((group) => group.id === 'PR206_REQUIRED_COMMANDS');
const pr207CommandGroup = commandLedger.commandGroups.find((group) => group.id === 'PR207_REQUIRED_COMMANDS');
assertExactCommandSet(pr206CommandGroup, pr206Commands);
assertExactCommandSet(pr207CommandGroup, pr207Commands);
assertExactCommandCounts(pr206CommandGroup, pr206ExpectedCounts);
assertExactCommandCounts(pr207CommandGroup, pr207ExpectedCounts);
const githubCommandGroup = commandLedger.commandGroups.find((group) => group.id === 'GITHUB_STATE_RECHECK');
assert(
  githubCommandGroup?.commandResults?.length === 3
    && githubCommandGroup.commandResults.every((result) => result.exitCode === 0)
    && githubCommandGroup.commandResults.some((result) => result.observed.includes('LATEST_DECISION_HOLD')),
  'GitHub state recheck command ledger drifted',
);
assert(
  packageJson.scripts?.['test:evidence-to-decision-pilot'] ===
    'node --test tests/evidence-to-decision-pilot-artifacts.test.mjs',
  'pilot artifact test script is missing',
);
assert(
  ciWorkflow.includes('run: npm run test:evidence-to-decision-pilot'),
  'pilot artifact safety test is missing from CI',
);

const verificationInputPaths = [
  'docs/product/validation/pr206-human-validation-decision.json',
  'docs/product/validation/pr206-human-validation-summary.md',
  'docs/product/validation/pr207-real-evidence-input-ledger.json',
  'docs/product/validation/pr207-real-evidence-pilot-decision.json',
  'docs/product/validation/pr207-real-evidence-pilot-summary.md',
  'docs/product/validation/evidence-to-decision-next-gate.json',
  'tmp/codex/evidence-to-decision-pilot-repo-preflight.json',
  'tmp/codex/evidence-to-decision-github-state-20260719.json',
  'tmp/codex/evidence-to-decision-initial-investigation-ledger-20260719.json',
  'tmp/codex/evidence-to-decision-change-authority-audit-20260719.json',
  'tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json',
  'tmp/codex/pr207-real-evidence-pilot-run-non-production.json',
  'scripts/verify-evidence-to-decision-pilot-refresh.mjs',
  'scripts/lib/safe-local-artifact-writer.mjs',
  'tests/evidence-to-decision-pilot-artifacts.test.mjs',
  'package.json',
  '.github/workflows/ci.yml',
  'worker/tests/workflow-contract.test.mjs',
];
const verificationInputSha256 = Object.fromEntries(
  await Promise.all(
    verificationInputPaths.map(async (relativePath) => [relativePath, await sha256File(relativePath)]),
  ),
);

const report = {
  schemaVersion: 'evidence-to-decision-pilot-refresh-run-v2',
  asOf: AS_OF,
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  evaluatedBaseSha: EXPECTED_BASE_SHA,
  refreshLineage: {
    artifactParentSha: preflight.artifactParentSha,
    reportParentCommitSha,
    finalArtifactCommitSha: 'EXCLUDED_TO_AVOID_SELF_REFERENCE_VERIFY_GIT_PARENT_EQUALS_REPORT_PARENT',
    verificationInputSha256,
  },
  pr206: {
    headSha: pr206Head,
    decision: humanValidation.decision,
    sessionFilesPresent: humanValidation.counts.recordCount,
    eligibleReviewerCount: humanValidation.counts.eligibleReviewerCount,
    taskResultCount: humanValidation.counts.taskResultCount,
    scenarioJudgmentCount: humanValidation.counts.scenarioJudgmentCount,
    rates: humanValidation.rates,
    thresholdSummary: humanValidation.thresholds.summary,
    automatedGateFitness: pr206Decision.automatedGateFitness,
  },
  pr207: {
    headSha: pr207Head,
    inputDocumentCount: variantSpike.inputDocumentCount,
    structuredTableCount: variantSpike.structuredTableCount,
    structuredRowCount: variantSpike.structuredRowCount,
    proposalCount: variantSpike.proposalCount,
    abstentionCount: variantSpike.abstentionCount,
    abstentionReasons: variantSpike.abstentionReasons,
    gateStatus: variantSpike.gateStatus,
    sourceAuthenticityStatus: variantSpike.sourceAuthenticityStatus,
    canonicalPatchExportAllowed: variantSpike.canonicalPatchExportAllowed,
    evaluationSha256: variantSpike.evaluationSha256,
    canonicalSha256: variantSpike.canonicalSha256,
    fixedClockAuditDiagnostic: {
      auditAsOf: documentAudit.realDocumentOutcome.auditAsOf,
      realDocumentPopulation: documentAudit.realDocumentOutcome.REAL_DOCUMENT_POPULATION,
      rejectionCodes: documentAudit.realDocumentOutcome.rejectionCodes,
      interpretation: 'NOT_A_CURRENT_REAL_INPUT_COUNT',
    },
    realIntakeExecutionRestriction: pr207Decision.realIntakeExecutionRestriction,
    humanReviewEvidenceRetentionFitness: pr207Decision.humanReviewEvidenceRetentionFitness,
    machineIntake: {
      evaluatedSourceCount: pr207MachineRun.evaluatedSourceCount,
      acceptedSourceCount: pr207MachineRun.acceptedSourceCount,
      refusedSourceCount: pr207MachineRun.refusedSourceCount,
      manifestSha256: pr207MachineRun.manifestSha256,
    },
    humanCandidateDecisions: pr207Decision.humanReviewCounts.candidateDecisions,
    approvedForRepositoryReview: pr207Decision.humanReviewCounts.approvedForRepositoryReview,
    approvedForRepositoryReviewByFamily:
      pr207Decision.humanReviewCounts.approvedForRepositoryReviewByFamily,
  },
  overallDecision: 'INCOMPLETE',
  overallStatus: 'BLOCKED_BOTH',
  goalCompletionStatus: nextGate.goalCompletionStatus,
  issue165Status: 'HOLD',
  issue165Evidence: {
    state: githubState.issue165.state,
    latestDecision: githubState.issue165.latestDecision,
    latestCommentUrl: githubState.issue165.latestCommentUrl,
  },
  initialReadOnlyInvestigations: {
    required: investigationLedger.required,
    completed: investigationLedger.completed,
    ids: investigationLedger.investigations.map((investigation) => investigation.id),
    boundary: investigationLedger.boundary,
  },
  changeAuthority: {
    status: changeAuthorityAudit.changeAuthorityStatus,
    initialDecisionCommitSha: changeAuthorityAudit.initialDecisionRecord.commitSha,
    postIncompleteImplementationCommits:
      changeAuthorityAudit.counts.postIncompleteImplementationCommits,
    explicitProductCodeFixCommits: changeAuthorityAudit.counts.explicitProductCodeFixCommits,
    commitsWithExplicitRetentionAuthorityRecord:
      changeAuthorityAudit.counts.commitsWithExplicitRetentionAuthorityRecord,
  },
  productionReady: false,
  productionReviewerWorkflowReady: false,
  prohibitedActionsPerformed: [],
  goalRuleDeviationsObserved: nextGate.goalRuleDeviationsObserved,
  commandLedger: {
    relativePath: 'tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json',
    sha256: verificationInputSha256['tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json'],
    commandGroupCount: commandLedger.commandGroups.length,
    allPassed: true,
  },
};

await writeJsonArtifactInsideWorktree({ outputPath, value: report });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
