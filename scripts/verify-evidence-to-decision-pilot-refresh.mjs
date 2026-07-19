#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
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
const refreshInputCommitSha = gitHead(process.cwd());
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
assert(nextGate.overallStatus === 'BLOCKED_BOTH', 'overall gate must remain BLOCKED_BOTH');
assert(nextGate.mergeTrainRecommendation === 'NO_MERGE_INPUT_INCOMPLETE', 'merge gate unexpectedly opened');
assert(nextGate.tenderMatrixEntryGate === 'BLOCKED_BOTH', 'Tender Matrix gate unexpectedly opened');
assert(nextGate.issue165Status === 'HOLD', 'Issue #165 boundary unexpectedly changed');
assert(nextGate.productionReady === false, 'production readiness must remain false');
assert(nextGate.productionReviewerWorkflowReady === false, 'production reviewer readiness must remain false');
assert(commandLedger.evaluatedHeads?.pr206 === pr206Head, 'command-ledger PR206 head mismatch');
assert(commandLedger.evaluatedHeads?.pr207 === pr207Head, 'command-ledger PR207 head mismatch');
assert(commandLedger.evaluatedHeads?.base === EXPECTED_BASE_SHA, 'command-ledger base mismatch');
assert(
  commandLedger.commandGroups?.length === 5
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
  'docs/product/validation/pr207-real-evidence-input-ledger.json',
  'docs/product/validation/pr207-real-evidence-pilot-decision.json',
  'docs/product/validation/evidence-to-decision-next-gate.json',
  'tmp/codex/evidence-to-decision-pilot-repo-preflight.json',
  'tmp/codex/evidence-to-decision-github-state-20260719.json',
  'tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json',
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
  schemaVersion: 'evidence-to-decision-pilot-refresh-run-v1',
  asOf: AS_OF,
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  evaluatedBaseSha: EXPECTED_BASE_SHA,
  refreshLineage: {
    artifactParentSha: preflight.artifactParentSha,
    refreshInputCommitSha,
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
  },
  overallDecision: 'INCOMPLETE',
  overallStatus: 'BLOCKED_BOTH',
  issue165Status: 'HOLD',
  productionReady: false,
  productionReviewerWorkflowReady: false,
  prohibitedActionsPerformed: [],
  commandLedger: {
    relativePath: 'tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json',
    sha256: verificationInputSha256['tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json'],
    commandGroupCount: commandLedger.commandGroups.length,
    allPassed: true,
  },
};

await writeJsonArtifactInsideWorktree({ outputPath, value: report });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
