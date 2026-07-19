#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { writeJsonArtifactInsideWorktree } from './lib/safe-local-artifact-writer.mjs';

const AS_OF = '2026-07-19T03:33:31.000Z';
const EXPECTED_BASE_SHA = '9d144fbe6309ce363f9dad8d50ffa713d24af683';
const EXPECTED_PR206_HEAD = 'b5570e182c8ab6515c0f09272d22d7121518f134';
const EXPECTED_PR207_HEAD = 'c6a5469338999097acd5de7c5a12c827d27d4540';
const EXPECTED_VARIANT_EVALUATION_SHA256 =
  'a73449493dc3cb07b2c28a41446d1bea36eba1f09acf16a6eb092cda5495dfdb';
const EXPECTED_VARIANT_CANONICAL_SHA256 =
  '8c3ceefd6e74b82f87d5e488ecb31a3c3496c6ade16518451c6151f894f6971e';
const EXPECTED_PR206_METHOD_COMMENT_ID = 5013934447;
const EXPECTED_PR206_METHOD_COMMENT_RAW_SHA256 =
  '98bf4f2b0681dc35433c0988c71b0ccfd23004061d9b3514583cd7fe1ffb33f2';
const EXPECTED_PR206_METHOD_COMMENT_LF_SHA256 =
  'c9c4013a95e08226533d2cfac27e186b308ab13aefdaa70dcd9e389f68c0d9ac';
const EXPECTED_PR207_APPROVAL_COMMENT_ID = 5014019753;
const EXPECTED_PR207_APPROVAL_COMMENT_RAW_SHA256 =
  '9ade99c11f09bf78bec23c5799d7d95de41ccf5f636147300f15c0cfa2e0b661';
const EXPECTED_PR207_APPROVAL_COMMENT_LF_SHA256 =
  'b7680d1776ef5f726bc8fa1206850e24ff839e32b03e99b2f37a39b8c3ba760e';
const EXPECTED_PR207_DECISION_FILE_SHA256 =
  '2748e31856100d2f00259f32b1e351d6b7fe4386884e593ba1dc7997c6cab8fb';
const EXPECTED_PR207_DECISION_FILE_RELATIVE_PATH =
  'tmp/evidence-claim-workbench/human-approval/pr207-document-decisions.json';
const EXPECTED_PR207_INTAKE_MANIFEST_RELATIVE_PATH = 'evidence-inbox/manifest.json';
const EXPECTED_PR207_INTAKE_MANIFEST_SHA256 =
  '0e62b5b258a90395b4f7a95bf2e5288e0781d768aa0990b07c0916a67c16c953';
const EXPECTED_PR207_DOCUMENT_TUPLE_FINGERPRINT_SHA256 =
  '59c292b30801208853cbd6cb902d1eb4d0064001b72c1317001c849d48ecabb7';

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

function gitTopLevel(root) {
  return path.resolve(
    execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).trim(),
  );
}

function gitIsAncestor(root, ancestor, descendant) {
  try {
    execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

function gitPathIsIgnored(root, relativePath) {
  try {
    execFileSync('git', ['-C', root, 'check-ignore', '--quiet', '--', relativePath], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function gitPathIsTracked(root, relativePath) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', relativePath], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

async function readSafeIgnoredFile(root, relativePath, expectedSha256) {
  assert(
    Number.isInteger(constants.O_NOFOLLOW),
    'runtime does not provide O_NOFOLLOW for safe local-input reads',
  );
  const exactPath = path.resolve(root, relativePath);
  const canonicalRoot = await realpath(root);
  const canonicalParent = await realpath(path.dirname(exactPath));
  assert(
    path.relative(root, exactPath) === relativePath,
    `PR207 ignored input path escaped its exact worktree-relative location: ${relativePath}`,
  );
  assert(canonicalRoot === root, 'PR207 worktree root must not resolve through symbolic links');
  assert(
    canonicalParent === path.dirname(exactPath)
      && !path.relative(canonicalRoot, canonicalParent).startsWith('..'),
    'PR207 human decision parent must remain a real directory inside the exact worktree',
  );
  assert(
    gitPathIsIgnored(root, relativePath),
    `PR207 local input is no longer ignored: ${relativePath}`,
  );
  assert(
    !gitPathIsTracked(root, relativePath),
    `PR207 local input must remain untracked: ${relativePath}`,
  );

  let handle;
  try {
    handle = await open(exactPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    assert(stat.isFile(), `PR207 local input is not a regular file: ${relativePath}`);
    assert(stat.nlink === 1, `PR207 local input must have exactly one hard link: ${relativePath}`);
    assert((stat.mode & 0o777) === 0o600, `PR207 local input mode must remain 0600: ${relativePath}`);
    const raw = await handle.readFile();
    const sha256 = createHash('sha256').update(raw).digest('hex');
    assert(sha256 === expectedSha256, `PR207 local input hash drifted: ${relativePath}`);
    return {
      exactPath,
      relativePath,
      sha256,
      mode: '0600',
      tracked: false,
      ignored: true,
      byteLength: raw.length,
      raw,
    };
  } finally {
    await handle?.close();
  }
}

async function readIgnoredHumanDecision(root) {
  const input = await readSafeIgnoredFile(
    root,
    EXPECTED_PR207_DECISION_FILE_RELATIVE_PATH,
    EXPECTED_PR207_DECISION_FILE_SHA256,
  );
  return {
    ...input,
    value: JSON.parse(input.raw.toString('utf8')),
  };
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
assert(gitTopLevel(pr206Root) === pr206Root, '--pr206-root must be the exact PR206 worktree root');
assert(gitTopLevel(pr207Root) === pr207Root, '--pr207-root must be the exact PR207 worktree root');
assert(pr206Head === EXPECTED_PR206_HEAD, `unexpected PR206 head: ${pr206Head}`);
assert(pr207Head === EXPECTED_PR207_HEAD, `unexpected PR207 head: ${pr207Head}`);

const pr207HumanDecisionInput = await readIgnoredHumanDecision(pr207Root);
const pr207HumanDecision = pr207HumanDecisionInput.value;
assert(pr207HumanDecision.schemaVersion === 'pr207-document-decisions-v1', 'PR207 human decision schema drifted');
assert(
  pr207HumanDecision.boundary === 'LOCAL_IGNORED_HUMAN_INPUT_TEMPLATE',
  'PR207 decision-file wrapper boundary drifted; approval must remain externally bound',
);
assert(pr207HumanDecision.evaluatedPr === 207, 'PR207 human decision PR binding drifted');
assert(pr207HumanDecision.evaluatedHead === pr207Head, 'PR207 human decision head binding drifted');
assert(
  pr207HumanDecision.intakeManifestSha256 === EXPECTED_PR207_INTAKE_MANIFEST_SHA256,
  'PR207 human decision manifest binding drifted',
);
assert(
  pr207HumanDecision.documentTupleFingerprintSha256 ===
    EXPECTED_PR207_DOCUMENT_TUPLE_FINGERPRINT_SHA256,
  'PR207 human decision tuple fingerprint drifted',
);
assert(pr207HumanDecision.documentCount === 8, 'PR207 human decision document count drifted');
assert(pr207HumanDecision.humanFieldsAreBlank === false, 'PR207 human decision fields are unexpectedly blank');
assert(pr207HumanDecision.documents?.length === 8, 'PR207 human decision rows drifted');

const pr207IntakeManifestInput = await readSafeIgnoredFile(
  pr207Root,
  EXPECTED_PR207_INTAKE_MANIFEST_RELATIVE_PATH,
  EXPECTED_PR207_INTAKE_MANIFEST_SHA256,
);
const pr207IntakeManifest = JSON.parse(pr207IntakeManifestInput.raw.toString('utf8'));
assert(
  pr207IntakeManifest.schemaVersion === 'official-evidence-intake-manifest-v0'
    && pr207IntakeManifest.boundary === 'NOT_PRODUCTION_EVIDENCE'
    && pr207IntakeManifest.productionReady === false
    && pr207IntakeManifest.documents?.length === 8,
  'PR207 exact ignored intake manifest boundary or document count drifted',
);
assert(
  new Set(pr207IntakeManifest.documents.map((document) => document.relativePath)).size === 8
    && new Set(pr207IntakeManifest.documents.map((document) => document.expectedSha256)).size === 8,
  'PR207 intake manifest paths and hashes must be unique',
);
const pr207NormalizedInputByManifestPath = new Map();
for (const manifestDocument of pr207IntakeManifest.documents) {
  assert(
    typeof manifestDocument.relativePath === 'string'
      && path.posix.basename(manifestDocument.relativePath) === manifestDocument.relativePath
      && manifestDocument.relativePath.endsWith('.json'),
    `PR207 intake manifest contains a non-flat or non-JSON path: ${manifestDocument.relativePath}`,
  );
  const normalizedInputRelativePath = path.posix.join(
    'evidence-inbox',
    manifestDocument.relativePath,
  );
  const normalizedInput = await readSafeIgnoredFile(
    pr207Root,
    normalizedInputRelativePath,
    manifestDocument.expectedSha256,
  );
  assert(
    normalizedInput.byteLength === manifestDocument.byteLength,
    `PR207 normalized intake byte length drifted: ${manifestDocument.relativePath}`,
  );
  const normalizedDocument = JSON.parse(normalizedInput.raw.toString('utf8'));
  assert(
    normalizedDocument.source?.sourceUrl === manifestDocument.sourceUrl
      && normalizedDocument.source?.publisher === manifestDocument.publisher
      && normalizedDocument.source?.documentNumber === manifestDocument.documentNumber
      && normalizedDocument.source?.language === manifestDocument.language
      && isDeepStrictEqual(
        normalizedDocument.source?.productFamilies,
        manifestDocument.productFamilies,
      )
      && normalizedDocument.revision?.revisionId === manifestDocument.revision?.revisionId
      && normalizedDocument.source?.redistributionStatus === manifestDocument.redistributionStatus,
    `PR207 normalized intake metadata drifted from its manifest entry: ${manifestDocument.relativePath}`,
  );
  pr207NormalizedInputByManifestPath.set(manifestDocument.relativePath, {
    input: normalizedInput,
    value: normalizedDocument,
  });
}

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
assert(
  documentAudit.summary?.reviewState?.actualHumanReviewSessions === 0,
  'human PR207 candidate-review sessions now exist; refresh the decision',
);
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
  pr206Decision.automatedGateFitness ===
    'OWNER_ACCEPTED_CURRENT_METHOD_FOR_HUMAN_MERGE_EVIDENCE_AUTOMATED_GATE_REMAINS_ADVISORY',
  'PR206 automated-gate advisory boundary drifted',
);
assert(
  pr206Decision.methodOwnerDecisionRecord?.marker === 'PR206_VALIDATION_METHOD_APPROVAL_V1'
    && pr206Decision.methodOwnerDecisionRecord?.commentId === EXPECTED_PR206_METHOD_COMMENT_ID
    && pr206Decision.methodOwnerDecisionRecord?.commentUrl ===
      'https://github.com/dooosp/b2b-lead-agent/pull/206#issuecomment-5013934447'
    && pr206Decision.methodOwnerDecisionRecord?.commenterLogin === 'dooosp'
    && pr206Decision.methodOwnerDecisionRecord?.createdAt === '2026-07-19T03:10:20Z'
    && pr206Decision.methodOwnerDecisionRecord?.rawBodySha256 ===
      EXPECTED_PR206_METHOD_COMMENT_RAW_SHA256
    && pr206Decision.methodOwnerDecisionRecord?.lfNormalizedBodySha256 ===
      EXPECTED_PR206_METHOD_COMMENT_LF_SHA256
    && pr206Decision.methodOwnerDecisionRecord?.evaluatedHeadSha === pr206Head
    && pr206Decision.methodOwnerDecisionRecord?.frozenRuntimeSha ===
      '8098f66c6fb7e64464297c0ee70d25f49756135d'
    && pr206Decision.methodOwnerDecisionRecord?.methodDecision === 'ACCEPT_CURRENT_METHOD'
    && pr206Decision.methodOwnerDecisionRecord?.approvedForHumanMergeEvidence === true
    && pr206Decision.methodOwnerDecisionRecord?.authorizedCorrectionScope === 'NONE'
    && pr206Decision.methodOwnerDecisionRecord?.identityAndDataBoundaryAccepted === true
    && pr206Decision.methodOwnerDecisionRecord?.automatedGateIsAdvisory === true
    && pr206Decision.methodOwnerDecisionRecord?.productionApproved === false
    && pr206Decision.methodOwnerDecisionRecord?.mergeApprovedByThisComment === false
    && pr206Decision.methodOwnerDecisionRecord?.stopConditionsPresent === true,
  'PR206 canonical method-owner approval binding drifted',
);
assert(pr207Decision.evaluatedHeadSha === pr207Head, 'PR207 decision head mismatch');
assert(pr207Decision.baseSha === EXPECTED_BASE_SHA, 'PR207 decision base mismatch');
assert(pr207Decision.decision === 'INCOMPLETE', 'PR207 artifact must remain INCOMPLETE');
assert(
  pr207Decision.realIntakeExecutionRestriction ===
    'DO_NOT_LAUNCH_REAL_INTAKE_UI_FULL_NORMALIZED_PAGE_TEXT_EXCEEDS_BOUNDED_EXCERPT_APPROVAL',
  'PR207 real-intake restriction drifted',
);
const pr207HumanDecisionRecord = pr207Decision.humanDocumentDecisionRecord;
assert(
  pr207HumanDecisionRecord?.marker === 'PR207_DOCUMENT_PILOT_APPROVAL_V1'
    && pr207HumanDecisionRecord?.canonicalApprovalCommentId === EXPECTED_PR207_APPROVAL_COMMENT_ID
    && pr207HumanDecisionRecord?.canonicalApprovalCommentUrl ===
      'https://github.com/dooosp/b2b-lead-agent/pull/207#issuecomment-5014019753'
    && pr207HumanDecisionRecord?.approverLogin === 'dooosp'
    && pr207HumanDecisionRecord?.createdAt === '2026-07-19T03:33:31Z'
    && pr207HumanDecisionRecord?.rawBodySha256 === EXPECTED_PR207_APPROVAL_COMMENT_RAW_SHA256
    && pr207HumanDecisionRecord?.lfNormalizedBodySha256 === EXPECTED_PR207_APPROVAL_COMMENT_LF_SHA256
    && pr207HumanDecisionRecord?.supportingDecisionIntentCommentUrl ===
      'https://github.com/dooosp/b2b-lead-agent/pull/207#issuecomment-5013945474'
    && pr207HumanDecisionRecord?.evaluatedHeadSha === pr207Head,
  'PR207 canonical approval comment binding drifted',
);
assert(
  pr207HumanDecisionRecord?.decisionFile?.path === pr207HumanDecisionInput.relativePath
    && pr207HumanDecisionRecord?.decisionFile?.sha256 === pr207HumanDecisionInput.sha256
    && pr207HumanDecisionRecord?.decisionFile?.mode === pr207HumanDecisionInput.mode
    && pr207HumanDecisionRecord?.decisionFile?.tracked === pr207HumanDecisionInput.tracked
    && pr207HumanDecisionRecord?.decisionFile?.ignored === pr207HumanDecisionInput.ignored
    && pr207HumanDecisionRecord?.decisionFile?.role ===
      'SHA_BOUND_TRANSCRIPTION_OF_CANONICAL_GITHUB_APPROVAL'
    && pr207HumanDecisionRecord?.decisionFile?.wrapperBoundary === pr207HumanDecision.boundary
    && pr207HumanDecisionRecord?.decisionFile?.wrapperTemplateNonClaimRetained === true
    && pr207HumanDecisionRecord?.decisionFile?.approvalSource === 'CANONICAL_GITHUB_COMMENT',
  'PR207 ignored decision-file safety or approval-source binding drifted',
);
assert(
  pr207HumanDecisionRecord?.inputManifestSha256 === pr207HumanDecision.intakeManifestSha256
    && pr207HumanDecisionRecord?.documentTupleFingerprintSha256 ===
      pr207HumanDecision.documentTupleFingerprintSha256
    && pr207HumanDecisionRecord?.documentCount === pr207HumanDecision.documentCount,
  'PR207 decision-file lineage binding drifted',
);
assert(
  isDeepStrictEqual(pr207HumanDecisionRecord?.commonDecisions, {
    officiality: 'OWNER_ATTESTED_OFFICIAL_SOURCE',
    currentness: 'CURRENT_REVISION',
    technicalScope: 'IN_SCOPE',
    boundedExcerptUse: 'APPROVED_FOR_INTERNAL_REPOSITORY_REVIEW',
    binaryHandling: 'DO_NOT_COMMIT_BINARY',
    reason: 'AUTHORIZED_OWNER_REVIEW_CONFIRMED',
  })
    && pr207HumanDecisionRecord?.architectureDecision ===
      'APPROVE_BOUNDED_NON_CANONICAL_REVIEW_PATH'
    && pr207HumanDecisionRecord?.originalSourceFidelityDecision === 'NOT_SEPARATELY_PROVIDED'
    && pr207HumanDecisionRecord?.automaticVerifiedAllowed === false
    && pr207HumanDecisionRecord?.automaticCustomerUseAllowed === false
    && pr207HumanDecisionRecord?.productionApproved === false
    && pr207HumanDecisionRecord?.mergeApproved === false,
  'PR207 bounded human owner decision or non-approval boundaries drifted',
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
const pr207HumanDocumentIds = pr207HumanDecision.documents
  .map((document) => document.documentId)
  .sort();
assert(
  new Set(pr207HumanDocumentIds).size === 8
    && JSON.stringify(pr207HumanDocumentIds) === JSON.stringify(ledgerAcceptedIds),
  'PR207 human decision rows do not bind exactly to the eight accepted machine-intake documents',
);
const acceptedLedgerDocumentById = new Map(
  pr207Ledger.documents
    .filter((document) => document.intakeDecision === 'ACCEPTED')
    .map((document) => [document.documentId, document]),
);
for (const decisionDocument of pr207HumanDecision.documents) {
  const ledgerDocument = acceptedLedgerDocumentById.get(decisionDocument.documentId);
  assert(ledgerDocument, `PR207 human decision references an unknown document: ${decisionDocument.documentId}`);
  assert(
    decisionDocument.fileSha256 === ledgerDocument.sourceFileSha256
      && decisionDocument.normalizedContentSha256 === ledgerDocument.normalizedContentSha256
      && decisionDocument.publisher === ledgerDocument.publisher
      && decisionDocument.officialSourceUrl === ledgerDocument.sourceUrl
      && decisionDocument.documentNumber === ledgerDocument.documentNumber
      && decisionDocument.revision === ledgerDocument.revision?.revisionId
      && decisionDocument.language === ledgerDocument.language
      && decisionDocument.productFamily === ledgerDocument.productFamily,
    `PR207 human decision tuple drifted from the accepted ledger: ${decisionDocument.documentId}`,
  );
  const matchingManifestDocuments = pr207IntakeManifest.documents.filter(
    (manifestDocument) =>
      manifestDocument.sourceUrl === decisionDocument.officialSourceUrl
        && manifestDocument.publisher === decisionDocument.publisher
        && manifestDocument.documentNumber === decisionDocument.documentNumber
        && manifestDocument.revision?.revisionId === decisionDocument.revision
        && manifestDocument.language === decisionDocument.language
        && isDeepStrictEqual(manifestDocument.productFamilies, [decisionDocument.productFamily]),
  );
  assert(
    matchingManifestDocuments.length === 1,
    `PR207 human decision must map to exactly one current intake manifest entry: ${decisionDocument.documentId}`,
  );
  const manifestDocument = matchingManifestDocuments[0];
  const normalizedInput = pr207NormalizedInputByManifestPath.get(manifestDocument.relativePath);
  assert(
    decisionDocument.normalizedIntakeFileSha256 === manifestDocument.expectedSha256
      && decisionDocument.normalizedIntakeFileSha256 === normalizedInput?.input.sha256
      && normalizedInput?.value.documentId === decisionDocument.documentId
      && normalizedInput?.value.file?.sha256 === decisionDocument.fileSha256
      && normalizedInput?.value.file?.contentSha256 === decisionDocument.normalizedContentSha256,
    `PR207 decision row does not bind to the manifest hash and actual normalized JSON: ${decisionDocument.documentId}`,
  );
  assert(
    decisionDocument.officialityDecision === 'OWNER_ATTESTED_OFFICIAL_SOURCE'
      && decisionDocument.currentnessDecision === 'CURRENT_REVISION'
      && decisionDocument.technicalScopeDecision === 'IN_SCOPE'
      && decisionDocument.boundedExcerptUseDecision ===
        'APPROVED_FOR_INTERNAL_REPOSITORY_REVIEW'
      && decisionDocument.binaryCommitDecision === 'DO_NOT_COMMIT_BINARY'
      && decisionDocument.decisionReasonCode === 'AUTHORIZED_OWNER_REVIEW_CONFIRMED',
    `PR207 bounded human decision values drifted: ${decisionDocument.documentId}`,
  );
  assert(
    !Object.hasOwn(decisionDocument, 'originalSourceFidelityDecision'),
    `PR207 decision file unexpectedly claims original-source fidelity: ${decisionDocument.documentId}`,
  );
}
assert(
  pr207HumanDecision.nonClaims?.includes('This blank template is not a human approval.'),
  'PR207 decision-file template non-claim must remain retained and externally qualified',
);
assert(
  pr207Decision.inputLineage?.sourceAuthenticityStatus === 'UNREVIEWED',
  'PR207 machine-state authenticity overlay must remain UNREVIEWED',
);
assert(
  pr207Decision.humanReviewCounts?.documentAuthenticityDecisions === 8
    && pr207Decision.humanReviewCounts?.revisionCurrentnessDecisions === 8
    && pr207Decision.humanReviewCounts?.technicalScopeDecisions === 8
    && pr207Decision.humanReviewCounts?.boundedExcerptUseRightsDecisions === 8
    && pr207Decision.humanReviewCounts?.binaryHandlingDecisions === 8
    && pr207Decision.humanReviewCounts?.completeStructuredDocumentDecisionRows === 8
    && pr207Decision.humanReviewCounts?.originalSourceFidelityDecisions === 0
    && pr207Decision.humanReviewCounts?.redistributionOrUseRightsDecisions === 0,
  'PR207 bounded document-decision counts drifted or exceeded the canonical approval',
);
assert(
  pr207Decision.architectureOwnerDecision?.decision ===
    'APPROVE_BOUNDED_NON_CANONICAL_REVIEW_PATH'
    && pr207Decision.architectureSignal ===
      'BOUNDED_NON_CANONICAL_REVIEW_PATH_APPROVED_SAFE_CANDIDATE_POPULATION_STILL_EMPTY'
    && pr207Decision.thresholdResults?.allDocumentOwnerBoundedDecisions ===
      'PASS_8_OF_8_SHA_BOUND_TO_CANONICAL_GITHUB_APPROVAL'
    && pr207Decision.thresholdResults?.allOriginalSourceFidelityDecisions ===
      'INCOMPLETE_0_OF_8'
    && pr207Decision.thresholdResults?.allDocumentValidityDecisions ===
      'INCOMPLETE_ORIGINAL_SOURCE_FIDELITY_0_OF_8',
  'PR207 owner decision or remaining fidelity gate drifted',
);
assert(pr207Decision.humanReviewCounts?.approvedForRepositoryReview === 0, 'PR207 approved count drifted');
assert(
  pr207Decision.humanReviewCounts?.candidateReviewSessions === 0
    && pr207Decision.humanReviewCounts?.candidateSuggestions === 0
    && pr207Decision.humanReviewCounts?.candidateDecisions === 0
    && pr207Decision.humanReviewCounts?.reviewedSuggestions === 0
    && pr207Decision.humanReviewCounts?.canonicalVerifiedClaimsCreated === 0
    && pr207Decision.humanReviewCounts?.customerUseAllowedClaimsCreated === 0,
  'PR207 candidate-review or automatic-claim count unexpectedly opened',
);
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
  changeAuthorityAudit.schemaVersion === 'evidence-to-decision-change-authority-audit-v2'
    && pr206Decision.schemaVersion === 'pr206-human-validation-decision-v5'
    && pr207Decision.schemaVersion === 'pr207-real-evidence-pilot-decision-v7'
    && nextGate.schemaVersion === 'evidence-to-decision-next-gate-v7'
    && githubState.schemaVersion === 'evidence-to-decision-github-state-v3'
    && commandLedger.schemaVersion === 'evidence-to-decision-validation-command-ledger-v4',
  'owner-disposition artifact schema drifted',
);
assert(
  changeAuthorityAudit.initialDecisionRecord?.commitSha === '41ac25adcbb6aebd0de0018660dbcac0b9427d95'
    && changeAuthorityAudit.initialDecisionRecord?.trackA === 'INCOMPLETE'
    && changeAuthorityAudit.initialDecisionRecord?.trackB === 'INCOMPLETE',
  'initial INCOMPLETE decision authority record drifted',
);
assert(
  changeAuthorityAudit.changeAuthorityStatus === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'
    && changeAuthorityAudit.counts?.postIncompleteImplementationCommits === 4
    && changeAuthorityAudit.counts?.explicitProductCodeFixCommits === 2
    && changeAuthorityAudit.counts?.validationOrExperimentalImplementationCommits === 2
    && changeAuthorityAudit.counts?.commitsWithExplicitRetentionAuthorityRecord === 4,
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
assert(
  changeAuthorityAudit.ownerDispositionRecord?.recordedAtDate === '2026-07-19'
    && changeAuthorityAudit.ownerDispositionRecord?.source === 'EXPLICIT_USER_INSTRUCTION_IN_CURRENT_CODEX_TASK'
    && changeAuthorityAudit.ownerDispositionRecord?.exactInstruction === '네 커밋 모두 유지 승인'
    && changeAuthorityAudit.ownerDispositionRecord?.disposition ===
      'RETAIN_ALL_FOUR_COMMITS_AS_DOCUMENTED_EXCEPTION'
    && JSON.stringify(changeAuthorityAudit.ownerDispositionRecord?.appliesToCommitShas) ===
      JSON.stringify(auditedImplementationCommits)
    && changeAuthorityAudit.requiredOwnerDisposition?.length === 0,
  'owner retention-disposition record drifted',
);
assert(
  changeAuthorityAudit.postIncompleteImplementationCommits.every((entry) =>
    entry.explicitRetentionAuthorityRecordFound === true
      && entry.retentionDisposition === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'),
  'per-commit retention disposition drifted',
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
    && pr206Decision.changeAuthorityStatus === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'
    && pr206Decision.postInitialIncompleteImplementationCommitsPresent?.length === 1
    && pr206Decision.postInitialIncompleteImplementationCommitsPresent.every((entry) =>
      entry.changeAuthorityStatus === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'),
  'PR206 change-authority disclosure drifted',
);
assert(
  pr207Decision.changeAuthorityAudit === 'tmp/codex/evidence-to-decision-change-authority-audit-20260719.json'
    && pr207Decision.changeAuthorityStatus === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'
    && pr207Decision.postInitialIncompleteImplementationCommitsPresent?.length === 3
    && pr207Decision.postInitialIncompleteImplementationCommitsPresent.every((entry) =>
      entry.changeAuthorityStatus === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'),
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
  'allDocumentOwnerBoundedDecisions',
  'allOriginalSourceFidelityDecisions',
  'allDocumentValidityDecisions',
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
assert(
  nextGate.pr206?.methodOwnerDecisionRecord?.commentId === EXPECTED_PR206_METHOD_COMMENT_ID
    && nextGate.pr206?.methodOwnerDecisionRecord?.rawBodySha256 ===
      EXPECTED_PR206_METHOD_COMMENT_RAW_SHA256
    && nextGate.pr206?.methodOwnerDecisionRecord?.lfNormalizedBodySha256 ===
      EXPECTED_PR206_METHOD_COMMENT_LF_SHA256
    && nextGate.pr206?.methodOwnerDecisionRecord?.decision === 'ACCEPT_CURRENT_METHOD'
    && nextGate.pr206?.methodOwnerDecisionRecord?.approvedForHumanMergeEvidence === true
    && nextGate.pr206?.methodOwnerDecisionRecord?.automatedGateIsAdvisory === true
    && nextGate.pr206?.methodOwnerDecisionRecord?.productionApproved === false
    && nextGate.pr206?.methodOwnerDecisionRecord?.mergeApprovedByThisComment === false
    && nextGate.pr206?.automatedGateFitness === pr206Decision.automatedGateFitness,
  'next-gate PR206 method-owner resolution drifted',
);
assert(
  nextGate.pr207?.humanDocumentValidityDecisions === 0
    && nextGate.pr207?.architectureSignal ===
      'BOUNDED_NON_CANONICAL_REVIEW_PATH_APPROVED_SAFE_CANDIDATE_POPULATION_STILL_EMPTY'
    && nextGate.pr207?.completeStructuredDocumentDecisionRows === 8
    && isDeepStrictEqual(nextGate.pr207?.humanDocumentDecisionCounts, {
      officiality: 8,
      currentness: 8,
      technicalScope: 8,
      boundedExcerptUse: 8,
      binaryHandling: 8,
      originalSourceFidelity: 0,
    })
    && nextGate.pr207?.humanDocumentDecisionRecord?.canonicalApprovalCommentId ===
      EXPECTED_PR207_APPROVAL_COMMENT_ID
    && nextGate.pr207?.humanDocumentDecisionRecord?.rawBodySha256 ===
      EXPECTED_PR207_APPROVAL_COMMENT_RAW_SHA256
    && nextGate.pr207?.humanDocumentDecisionRecord?.lfNormalizedBodySha256 ===
      EXPECTED_PR207_APPROVAL_COMMENT_LF_SHA256
    && nextGate.pr207?.humanDocumentDecisionRecord?.decisionFileSha256 ===
      pr207HumanDecisionInput.sha256
    && nextGate.pr207?.humanDocumentDecisionRecord?.architectureDecision ===
      'APPROVE_BOUNDED_NON_CANONICAL_REVIEW_PATH'
    && nextGate.pr207?.humanDocumentDecisionRecord?.originalSourceFidelityDecision ===
      'NOT_SEPARATELY_PROVIDED'
    && nextGate.pr207?.humanDocumentDecisionRecord?.productionApproved === false
    && nextGate.pr207?.humanDocumentDecisionRecord?.mergeApprovedByThisComment === false
    && nextGate.pr207?.architectureOwnerDecision ===
      'APPROVE_BOUNDED_NON_CANONICAL_REVIEW_PATH'
    && nextGate.pr207?.safeProposals === 0
    && nextGate.pr207?.humanCandidateDecisions === 0
    && nextGate.pr207?.realIntakeUiAllowed === false,
  'next-gate PR207 bounded approval or remaining-blocker state drifted',
);
assert(
  nextGate.pr206?.changeAuthorityStatus === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'
    && nextGate.pr207?.changeAuthorityStatus === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS',
  'next-gate per-PR retention disposition drifted',
);
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
const githubPr206MethodApproval = githubState.canonicalHumanInputRecords?.find(
  (record) => record.recordType === 'PR206_METHOD_OWNER_APPROVAL',
);
const githubPr207DocumentApproval = githubState.canonicalHumanInputRecords?.find(
  (record) => record.recordType === 'PR207_DOCUMENT_PILOT_APPROVAL',
);
assert(
  githubState.canonicalHumanInputRecords?.length === 2
    && githubPr206MethodApproval?.classification === 'CANONICAL_VALID_METHOD_OWNER_APPROVAL'
    && githubPr206MethodApproval?.pullRequest === 206
    && githubPr206MethodApproval?.commentId === EXPECTED_PR206_METHOD_COMMENT_ID
    && githubPr206MethodApproval?.commentUrl === pr206Decision.methodOwnerDecisionRecord.commentUrl
    && githubPr206MethodApproval?.commenterLogin === 'dooosp'
    && githubPr206MethodApproval?.rawBodySha256 === EXPECTED_PR206_METHOD_COMMENT_RAW_SHA256
    && githubPr206MethodApproval?.lfNormalizedBodySha256 === EXPECTED_PR206_METHOD_COMMENT_LF_SHA256
    && githubPr206MethodApproval?.evaluatedHeadSha === pr206Head
    && githubPr206MethodApproval?.methodDecision === 'ACCEPT_CURRENT_METHOD'
    && githubPr206MethodApproval?.approvedForHumanMergeEvidence === true
    && githubPr206MethodApproval?.automatedGateIsAdvisory === true
    && githubPr206MethodApproval?.productionApproved === false
    && githubPr206MethodApproval?.mergeApprovedByThisComment === false
    && githubPr206MethodApproval?.effect === 'RESOLVES_PR206_METHOD_OWNER_INPUT_ONLY',
  'GitHub snapshot PR206 method-owner approval binding drifted',
);
assert(
  githubPr207DocumentApproval?.classification ===
    'CANONICAL_SHA_BOUND_DOCUMENT_AND_ARCHITECTURE_APPROVAL'
    && githubPr207DocumentApproval?.pullRequest === 207
    && githubPr207DocumentApproval?.commentId === EXPECTED_PR207_APPROVAL_COMMENT_ID
    && githubPr207DocumentApproval?.commentUrl ===
      pr207HumanDecisionRecord.canonicalApprovalCommentUrl
    && githubPr207DocumentApproval?.commenterLogin === 'dooosp'
    && githubPr207DocumentApproval?.rawBodySha256 === EXPECTED_PR207_APPROVAL_COMMENT_RAW_SHA256
    && githubPr207DocumentApproval?.lfNormalizedBodySha256 ===
      EXPECTED_PR207_APPROVAL_COMMENT_LF_SHA256
    && githubPr207DocumentApproval?.evaluatedHeadSha === pr207Head
    && githubPr207DocumentApproval?.decisionFileSha256 === pr207HumanDecisionInput.sha256
    && githubPr207DocumentApproval?.documentCount === 8
    && Object.values(githubPr207DocumentApproval?.ownerLogins || {})
      .length === 4
    && Object.values(githubPr207DocumentApproval?.ownerLogins || {})
      .every((login) => login === 'dooosp')
    && isDeepStrictEqual(
      githubPr207DocumentApproval?.commonDecisions,
      pr207HumanDecisionRecord.commonDecisions,
    )
    && githubPr207DocumentApproval?.architectureDecision ===
      'APPROVE_BOUNDED_NON_CANONICAL_REVIEW_PATH'
    && githubPr207DocumentApproval?.originalSourceFidelityDecision === 'NOT_SEPARATELY_PROVIDED'
    && githubPr207DocumentApproval?.automaticVerifiedClaimsCreated === 0
    && githubPr207DocumentApproval?.automaticAllowedClaimsCreated === 0
    && githubPr207DocumentApproval?.productionApproved === false
    && githubPr207DocumentApproval?.mergeApprovedByThisComment === false
    && githubPr207DocumentApproval?.effect ===
      'RESOLVES_BOUNDED_DOCUMENT_AND_ARCHITECTURE_INPUTS_ONLY',
  'GitHub snapshot PR207 SHA-bound approval drifted',
);
const supportingPr207Intent = githubState.supportingHumanInputRecords?.[0];
assert(
  githubState.supportingHumanInputRecords?.length === 1
    && supportingPr207Intent?.classification ===
      'SUPPORTING_INTENT_NOT_CANONICAL_SHA_BOUND_APPROVAL'
    && supportingPr207Intent?.pullRequest === 207
    && supportingPr207Intent?.commentId === 5013945474
    && supportingPr207Intent?.commentUrl ===
      'https://github.com/dooosp/b2b-lead-agent/pull/207#issuecomment-5013945474'
    && supportingPr207Intent?.commenterLogin === 'dooosp'
    && supportingPr207Intent?.createdAt === '2026-07-19T03:14:36Z'
    && supportingPr207Intent?.rawBodySha256 ===
      'c39a89e53bd4de39a9a85b988d45ab14c11e9be6840a3b94cce08065c20b77fa'
    && supportingPr207Intent?.lfNormalizedBodySha256 ===
      'b454432248aec101854ea045bb1b8e8c2f3e195baf359303689d51fcc2d84a5c'
    && supportingPr207Intent?.canonicalizedByCommentId === EXPECTED_PR207_APPROVAL_COMMENT_ID,
  'GitHub snapshot supporting PR207 decision intent drifted',
);
const wrongPrDuplicate = githubState.wrongPrDuplicates?.[0];
assert(
  githubState.wrongPrDuplicates?.length === 1
    && wrongPrDuplicate?.classification === 'NONCANONICAL_WRONG_PULL_REQUEST_DUPLICATE'
    && wrongPrDuplicate?.actualPullRequest === 206
    && wrongPrDuplicate?.intendedPullRequest === 207
    && wrongPrDuplicate?.commentId === 5013938164
    && wrongPrDuplicate?.commentUrl ===
      'https://github.com/dooosp/b2b-lead-agent/pull/206#issuecomment-5013938164'
    && wrongPrDuplicate?.commenterLogin === 'dooosp'
    && wrongPrDuplicate?.createdAt === '2026-07-19T03:11:46Z'
    && wrongPrDuplicate?.rawBodySha256 ===
      'c39a89e53bd4de39a9a85b988d45ab14c11e9be6840a3b94cce08065c20b77fa'
    && wrongPrDuplicate?.lfNormalizedBodySha256 ===
      'b454432248aec101854ea045bb1b8e8c2f3e195baf359303689d51fcc2d84a5c'
    && wrongPrDuplicate?.effect === 'NONE',
  'GitHub snapshot wrong-PR duplicate classification drifted',
);
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
const remainingExternalInputOwners = nextGate.missingExternalInputs
  .map((input) => input.owner)
  .sort();
assert(
  isDeepStrictEqual(remainingExternalInputOwners, [
    'PR206_FACILITATOR_AND_FIVE_QUALIFIED_REVIEWERS',
    'PR207_DOCUMENT_SOURCE_OWNER',
    'PR207_QUALIFIED_CANDIDATE_REVIEWERS',
    'PR207_RIGHTS_SECURITY_OWNER',
    'PR207_VALIDATION_METHOD_OWNER',
  ])
    && nextGate.missingExternalInputs.every((input) => input.current === 0)
    && nextGate.missingExternalInputs.find(
      (input) => input.owner === 'PR206_FACILITATOR_AND_FIVE_QUALIFIED_REVIEWERS',
    )?.required === 5
    && nextGate.missingExternalInputs.find(
      (input) => input.owner === 'PR207_DOCUMENT_SOURCE_OWNER',
    )?.required === 8
    && nextGate.missingExternalInputs.find(
      (input) => input.owner === 'PR207_QUALIFIED_CANDIDATE_REVIEWERS',
    )?.required === 25
    && !nextGate.missingExternalInputs.some(
      (input) => input.owner === 'PR206_VALIDATION_METHOD_OWNER'
        || input.owner === 'PR207_EVIDENCE_ARCHITECTURE_OWNER',
    ),
  'next-gate resolved and remaining human-input owners drifted',
);
assert(nextGate.pr207?.approvedForRepositoryReview === 0, 'next-gate PR207 approved count drifted');
assert(
  nextGate.fixPolicy?.changeAuthorityStatus === 'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'
    && nextGate.fixPolicy?.postInitialIncompleteImplementationCommitsPresent === 4
    && nextGate.fixPolicy?.explicitProductCodeFixCommitsPresent === 2
    && nextGate.fixPolicy?.retentionDispositionsRecorded === 4
    && nextGate.missingExternalInputs?.length === 5
    && nextGate.tenderMatrixBlockers?.length === 10
    && nextGate.tenderMatrixBlockers?.includes(
      'PR207_ORIGINAL_SOURCE_FIDELITY_DECISIONS_BELOW_8',
    )
    && !nextGate.tenderMatrixBlockers?.includes(
      'PR207_HUMAN_DOCUMENT_VALIDITY_DECISIONS_BELOW_8',
    )
    && !nextGate.missingExternalInputs?.some((input) => input.owner === 'EVIDENCE_TO_DECISION_CHANGE_OWNER')
    && !nextGate.tenderMatrixBlockers?.includes(
      'POST_INCOMPLETE_IMPLEMENTATION_CHANGE_AUTHORITY_DISPOSITION_MISSING'),
  'next-gate retention disposition or remaining blocker set drifted',
);
assert(nextGate.overallStatus === 'BLOCKED_BOTH', 'overall gate must remain BLOCKED_BOTH');
assert(nextGate.goalCompletionStatus === 'INCOMPLETE_EXTERNAL_INPUTS', 'goal completion state drifted');
assert(
  nextGate.goalRuleDeviationDisposition ===
    'EXPLICIT_OWNER_RETENTION_EXCEPTION_RECORDED_FOR_EXACT_FOUR_COMMITS',
  'goal-rule exception disposition drifted',
);
assert(nextGate.mergeTrainRecommendation === 'NO_MERGE_INPUT_INCOMPLETE', 'merge gate unexpectedly opened');
assert(nextGate.tenderMatrixEntryGate === 'BLOCKED_BOTH', 'Tender Matrix gate unexpectedly opened');
assert(nextGate.issue165Status === 'HOLD', 'Issue #165 boundary unexpectedly changed');
assert(nextGate.productionReady === false, 'production readiness must remain false');
assert(nextGate.productionReviewerWorkflowReady === false, 'production reviewer readiness must remain false');
assert(commandLedger.evaluatedHeads?.pr206 === pr206Head, 'command-ledger PR206 head mismatch');
assert(commandLedger.evaluatedHeads?.pr207 === pr207Head, 'command-ledger PR207 head mismatch');
assert(commandLedger.evaluatedHeads?.base === EXPECTED_BASE_SHA, 'command-ledger base mismatch');
assert(
  commandLedger.commandGroups?.length === 7
    && commandLedger.commandGroups.every((group) => group.status === 'PASS' && group.exitCode === 0),
  'command-ledger result is not all-pass',
);
const humanApprovalBindingGroup = commandLedger.commandGroups.find(
  (group) => group.id === 'HUMAN_APPROVAL_BINDING_RECHECK',
);
const humanApprovalBindingObservations = humanApprovalBindingGroup?.commandResults
  ?.map((result) => result.observed) || [];
const ledgerPr206MethodApproval = humanApprovalBindingObservations.find(
  (observed) => observed.commentId === EXPECTED_PR206_METHOD_COMMENT_ID,
);
const ledgerPr207DocumentApproval = humanApprovalBindingObservations.find(
  (observed) => observed.commentId === EXPECTED_PR207_APPROVAL_COMMENT_ID,
);
const ledgerSupportingIntent = humanApprovalBindingObservations.find(
  (observed) => observed.commentId === 5013945474,
);
const ledgerWrongPrDuplicate = humanApprovalBindingObservations.find(
  (observed) => observed.commentId === 5013938164,
);
const ledgerDecisionFileSafety = humanApprovalBindingObservations.find(
  (observed) => observed.sha256 === EXPECTED_PR207_DECISION_FILE_SHA256,
);
const ledgerDecisionRows = humanApprovalBindingObservations.find(
  (observed) => observed.documentRows === 8,
);
assert(
  humanApprovalBindingGroup?.expectedCommandCount === 6
    && humanApprovalBindingGroup?.commandResults?.length === 6
    && humanApprovalBindingGroup.commandResults.every((result) => result.exitCode === 0)
    && ledgerPr206MethodApproval?.classification === 'CANONICAL_VALID_METHOD_OWNER_APPROVAL'
    && ledgerPr206MethodApproval?.rawBodySha256 === EXPECTED_PR206_METHOD_COMMENT_RAW_SHA256
    && ledgerPr206MethodApproval?.lfNormalizedBodySha256 ===
      EXPECTED_PR206_METHOD_COMMENT_LF_SHA256
    && ledgerPr206MethodApproval?.evaluatedHeadAndRuntimeBinding === 'PASS'
    && ledgerPr207DocumentApproval?.classification ===
      'CANONICAL_SHA_BOUND_DOCUMENT_AND_ARCHITECTURE_APPROVAL'
    && ledgerPr207DocumentApproval?.rawBodySha256 ===
      EXPECTED_PR207_APPROVAL_COMMENT_RAW_SHA256
    && ledgerPr207DocumentApproval?.lfNormalizedBodySha256 ===
      EXPECTED_PR207_APPROVAL_COMMENT_LF_SHA256
    && ledgerPr207DocumentApproval?.evaluatedHeadDecisionFileAndDocumentCountBinding === 'PASS'
    && ledgerSupportingIntent?.classification ===
      'SUPPORTING_INTENT_NOT_CANONICAL_SHA_BOUND_APPROVAL'
    && ledgerSupportingIntent?.canonicalizedByCommentId === EXPECTED_PR207_APPROVAL_COMMENT_ID
    && ledgerWrongPrDuplicate?.classification === 'NONCANONICAL_WRONG_PULL_REQUEST_DUPLICATE'
    && ledgerWrongPrDuplicate?.gateEffect === 'NONE'
    && ledgerDecisionFileSafety?.mode === '0600'
    && ledgerDecisionFileSafety?.ignored === true
    && ledgerDecisionFileSafety?.tracked === false
    && ledgerDecisionRows?.evaluatedHeadSha === pr207Head
    && ledgerDecisionRows?.humanFieldsAreBlank === false
    && ledgerDecisionRows?.officialityCurrentnessScopeBoundedExcerptAndBinaryDecisionsMatch === true
    && ledgerDecisionRows?.originalSourceFidelityFieldPresent === false
    && ledgerDecisionRows?.wrapperBoundary === 'LOCAL_IGNORED_HUMAN_INPUT_TEMPLATE'
    && ledgerDecisionRows?.wrapperTemplateNonClaimRetained === true
    && isDeepStrictEqual(humanApprovalBindingGroup?.gateEffect, {
      pr206MethodOwnerInputResolved: true,
      pr207BoundedDocumentAndArchitectureInputsResolved: true,
      pr206SessionsComplete: false,
      pr207FullValidityComplete: false,
      pr207OriginalSourceFidelityComplete: false,
      pr207CandidateApprovalThresholdComplete: false,
      mergeApproved: false,
      productionApproved: false,
    }),
  'human-approval binding command ledger drifted',
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
    'INCOMPLETE_EXTERNAL_INPUTS'
    && commandLedger.commandGroups.find((group) => group.id === 'PILOT_REFRESH_VERIFIER')?.changeAuthorityStatus ===
      'RETENTION_APPROVED_FOR_EXACT_FOUR_COMMITS'
    && commandLedger.commandGroups.find((group) => group.id === 'PILOT_REFRESH_VERIFIER')
      ?.retentionDispositionsRecorded === 4,
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
  schemaVersion: 'evidence-to-decision-pilot-refresh-run-v4',
  asOf: AS_OF,
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  evaluatedBaseSha: EXPECTED_BASE_SHA,
  refreshLineage: {
    artifactParentSha: preflight.artifactParentSha,
    reportParentCommitSha,
    finalArtifactCommitSha: 'EXCLUDED_TO_AVOID_SELF_REFERENCE_VERIFY_GIT_PARENT_EQUALS_REPORT_PARENT',
    verificationInputSha256,
    ignoredHumanInputBindings: {
      pr207DocumentDecisions: {
        evaluatedWorktreeHeadSha: pr207Head,
        relativePath: pr207HumanDecisionInput.relativePath,
        sha256: pr207HumanDecisionInput.sha256,
        mode: pr207HumanDecisionInput.mode,
        tracked: pr207HumanDecisionInput.tracked,
        ignored: pr207HumanDecisionInput.ignored,
      },
      pr207IntakeManifest: {
        evaluatedWorktreeHeadSha: pr207Head,
        relativePath: pr207IntakeManifestInput.relativePath,
        sha256: pr207IntakeManifestInput.sha256,
        mode: pr207IntakeManifestInput.mode,
        tracked: pr207IntakeManifestInput.tracked,
        ignored: pr207IntakeManifestInput.ignored,
        documentCount: pr207IntakeManifest.documents.length,
      },
      pr207NormalizedDocuments: pr207IntakeManifest.documents.map((manifestDocument) => {
        const normalizedInput = pr207NormalizedInputByManifestPath.get(
          manifestDocument.relativePath,
        ).input;
        return {
          relativePath: normalizedInput.relativePath,
          sha256: normalizedInput.sha256,
          byteLength: normalizedInput.byteLength,
          mode: normalizedInput.mode,
          tracked: normalizedInput.tracked,
          ignored: normalizedInput.ignored,
        };
      }),
    },
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
    methodOwnerDecisionRecord: pr206Decision.methodOwnerDecisionRecord,
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
    architectureSignal: pr207Decision.architectureSignal,
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
    humanDocumentDecisionRecord: {
      marker: pr207HumanDecisionRecord.marker,
      canonicalApprovalCommentUrl: pr207HumanDecisionRecord.canonicalApprovalCommentUrl,
      canonicalApprovalCommentId: pr207HumanDecisionRecord.canonicalApprovalCommentId,
      approverLogin: pr207HumanDecisionRecord.approverLogin,
      createdAt: pr207HumanDecisionRecord.createdAt,
      rawBodySha256: pr207HumanDecisionRecord.rawBodySha256,
      lfNormalizedBodySha256: pr207HumanDecisionRecord.lfNormalizedBodySha256,
      evaluatedHeadSha: pr207HumanDecisionRecord.evaluatedHeadSha,
      decisionFile: pr207HumanDecisionRecord.decisionFile,
      inputManifestSha256: pr207HumanDecisionRecord.inputManifestSha256,
      documentTupleFingerprintSha256: pr207HumanDecisionRecord.documentTupleFingerprintSha256,
      documentCount: pr207HumanDecisionRecord.documentCount,
      commonDecisions: pr207HumanDecisionRecord.commonDecisions,
      architectureDecision: pr207HumanDecisionRecord.architectureDecision,
      originalSourceFidelityDecision: pr207HumanDecisionRecord.originalSourceFidelityDecision,
      automaticVerifiedAllowed: pr207HumanDecisionRecord.automaticVerifiedAllowed,
      automaticCustomerUseAllowed: pr207HumanDecisionRecord.automaticCustomerUseAllowed,
      productionApproved: pr207HumanDecisionRecord.productionApproved,
      mergeApproved: pr207HumanDecisionRecord.mergeApproved,
      interpretation:
        'HUMAN_OWNER_OVERLAY_SHA_BOUND_TO_CANONICAL_GITHUB_APPROVAL_NOT_A_MACHINE_STATE_REWRITE',
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
    boundedDocumentDecisionCounts: {
      officiality: pr207Decision.humanReviewCounts.documentAuthenticityDecisions,
      currentness: pr207Decision.humanReviewCounts.revisionCurrentnessDecisions,
      technicalScope: pr207Decision.humanReviewCounts.technicalScopeDecisions,
      boundedExcerptUse: pr207Decision.humanReviewCounts.boundedExcerptUseRightsDecisions,
      binaryHandling: pr207Decision.humanReviewCounts.binaryHandlingDecisions,
      originalSourceFidelity: pr207Decision.humanReviewCounts.originalSourceFidelityDecisions,
    },
    completeStructuredDocumentDecisionRows:
      pr207Decision.humanReviewCounts.completeStructuredDocumentDecisionRows,
    fullDocumentValidityDecisions: nextGate.pr207.humanDocumentValidityDecisions,
    approvedForRepositoryReview: pr207Decision.humanReviewCounts.approvedForRepositoryReview,
    approvedForRepositoryReviewByFamily:
      pr207Decision.humanReviewCounts.approvedForRepositoryReviewByFamily,
  },
  overallDecision: 'INCOMPLETE',
  overallStatus: 'BLOCKED_BOTH',
  goalCompletionStatus: nextGate.goalCompletionStatus,
  remainingExternalInputCount: nextGate.missingExternalInputs.length,
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
    ownerDisposition: {
      recordedAtDate: changeAuthorityAudit.ownerDispositionRecord.recordedAtDate,
      source: changeAuthorityAudit.ownerDispositionRecord.source,
      exactInstruction: changeAuthorityAudit.ownerDispositionRecord.exactInstruction,
      disposition: changeAuthorityAudit.ownerDispositionRecord.disposition,
      appliesToCommitShas: changeAuthorityAudit.ownerDispositionRecord.appliesToCommitShas,
    },
  },
  productionReady: false,
  productionReviewerWorkflowReady: false,
  prohibitedActionsPerformed: [],
  goalRuleDeviationsObserved: nextGate.goalRuleDeviationsObserved,
  goalRuleDeviationDisposition: nextGate.goalRuleDeviationDisposition,
  commandLedger: {
    relativePath: 'tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json',
    sha256: verificationInputSha256['tmp/codex/evidence-to-decision-validation-command-ledger-20260719.json'],
    commandGroupCount: commandLedger.commandGroups.length,
    allPassed: true,
  },
};

await writeJsonArtifactInsideWorktree({ outputPath, value: report });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
