import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  link,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSyntheticBenchmarkFixture,
  createSyntheticDemoDocuments,
  SYNTHETIC_BENCHMARK_AS_OF
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';
import { createSyntheticApprovedReviewPatchFixture } from '../evidence-claim-workbench/fixtures/synthetic-approved-review-patch-v0.mjs';
import {
  createSourceDocumentCatalog,
  normalizeSourceDocumentBundle
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import { extractDeterministicCandidates } from '../evidence-claim-workbench/domain/candidates.mjs';
import {
  createReviewDecision,
  validateReviewDecision
} from '../evidence-claim-workbench/domain/review-decisions.mjs';
import { analyzeCandidateRelationships } from '../evidence-claim-workbench/domain/relationships.mjs';
import { createReviewPatch, serializeReviewPatch } from '../evidence-claim-workbench/domain/review-patch.mjs';
import { createDraftRegistryPreview } from '../evidence-claim-workbench/domain/registry-adapter.mjs';
import { loadEvidenceInbox } from '../evidence-claim-workbench/domain/intake.mjs';
import { evaluateEvidenceClaimWorkbench } from '../scripts/evaluate-evidence-claim-workbench.mjs';
import { auditEvidenceDocuments } from '../scripts/audit-evidence-documents.mjs';
import { exportEvidenceClaimReview } from '../scripts/export-evidence-claim-review.mjs';

const EXPECTED_SCENARIOS = Object.freeze([
  '01_valid_switchgear_datasheet',
  '02_valid_transformer_datasheet',
  '03_korean_product_document',
  '04_english_product_document',
  '05_quantity_capability',
  '06_range_capability',
  '07_certification_statement',
  '08_operating_condition',
  '09_limitation_disqualifier',
  '10_table_like_text',
  '11_repeated_quote_one_page',
  '12_same_quote_different_pages',
  '13_superseded_revision',
  '14_conflicting_revision',
  '15_conditions_resolve_conflict',
  '16_missing_revision',
  '17_future_dated_document',
  '18_malformed_source_url',
  '19_url_with_credentials',
  '20_private_url',
  '21_file_hash_mismatch',
  '22_page_hash_mismatch',
  '23_quote_absent',
  '24_ambiguous_unit',
  '25_incompatible_unit',
  '26_unsupported_product_family',
  '27_marketing_only',
  '28_secret_shaped_text',
  '29_personal_information_shaped_text',
  '30_oversized_page',
  '31_excessive_page_count',
  '32_duplicate_document_id',
  '33_duplicate_candidate_changed_content',
  '34_raw_pdf_without_parser',
  '35_unsupported_file_type'
]);

// These are test-owned acceptance requirements. Intentional benchmark or
// evaluator semantic changes require explicit review and an oracle update.
const REQUIRED_EVALUATION_THRESHOLDS = Object.freeze({
  overallScenarioPassBasisPoints: 10_000,
  quoteBindingBasisPoints: 10_000,
  candidateIdentityRepeatEqualityBasisPoints: 10_000,
  candidateExtractionPrecisionBasisPoints: 10_000,
  candidateExtractionRecallBasisPoints: 10_000,
  reviewDecisionFixtureAccuracyBasisPoints: 10_000,
  conflictDetectionBasisPoints: 10_000,
  supersessionDetectionBasisPoints: 10_000,
  patchRepeatEqualityBasisPoints: 10_000,
  repeatedRunHashEqualityBasisPoints: 10_000,
  automaticVerifiedLeakage: 0,
  automaticAllowedLeakage: 0,
  secretLeakage: 0,
  privateDataLeakage: 0,
  externalRequestCount: 0,
  persistenceWriteCount: 0,
  browserStorageWriteCount: 0
});

const PRECOMMITTED_BENCHMARK_SEMANTIC_SHA256 = 'b27cc4e888861805267eb9657db036ec9a5d68da140aaa779b5181c35e75f898';
const PRECOMMITTED_EVALUATION_CANONICAL_SHA256 = '45b83a7eefe4df63fb29b7f763136c6e48765931a82a92ba77f077ca28ff37d1';
const PRECOMMITTED_REVIEW_DECISION_ORACLE_SHA256 = 'e9dd9c414c5ff82bfc85e5357f568b3cb6e82f5e19dce6dc9eb3ece795628aeb';

function canonicalizeOracleValue(value) {
  if (Array.isArray(value)) return value.map(canonicalizeOracleValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeOracleValue(value[key])])
    );
  }
  return value;
}

function canonicalOracleSha256(value) {
  const canonical = JSON.stringify(canonicalizeOracleValue(value));
  return createHash('sha256').update(canonical).digest('hex');
}

test('the benchmark is exactly the precommitted 35-scenario synthetic matrix', () => {
  const fixture = createSyntheticBenchmarkFixture({ includeOversizedInputs: false });
  assert.equal(fixture.schemaVersion, 'official-evidence-synthetic-benchmark-v0');
  assert.equal(fixture.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(fixture.productionReady, false);
  assert.equal(fixture.issue165Status, 'HOLD');
  assert.deepEqual(fixture.scenarioOrder, EXPECTED_SCENARIOS);
  assert.deepEqual(fixture.scenarios.map(({ id }) => id), EXPECTED_SCENARIOS);
  assert.equal(fixture.scenarios.reduce((count, { documents }) => count + documents.length, 0), 39);
  assert.ok(fixture.scenarios.every(({ documents }) => documents.every((document) => (
    document.synthetic === true
    && document.source.sourceClass === 'SYNTHETIC_FIXTURE'
    && document.source.publisher === 'Synthetic Electrical Evidence Laboratory'
  ))));
  const intentionallyUnsafeUrls = new Set([
    '18_malformed_source_url',
    '19_url_with_credentials',
    '20_private_url'
  ]);
  assert.ok(fixture.scenarios
    .filter(({ id }) => !intentionallyUnsafeUrls.has(id))
    .every(({ documents }) => documents.every(({ source }) => source.sourceUrl.startsWith('https://synthetic.example/'))));
  const oversized = fixture.scenarios.find(({ id }) => id === '30_oversized_page');
  assert.equal(oversized.documents[0].pages[0].text, 'OVERSIZED_INPUT_GENERATED_AT_RUNTIME');
});

test('the full benchmark inputs and expectations match the precommitted semantic digest', () => {
  const fixture = createSyntheticBenchmarkFixture();
  assert.deepEqual(fixture.scenarioOrder, EXPECTED_SCENARIOS);
  assert.deepEqual(fixture.scenarios.map(({ id }) => id), EXPECTED_SCENARIOS);
  assert.equal(
    canonicalOracleSha256(fixture),
    PRECOMMITTED_BENCHMARK_SEMANTIC_SHA256,
    'intentional benchmark input or expectation changes require explicit oracle review'
  );

  const changedInput = structuredClone(fixture);
  changedInput.scenarios[0].documents[0].pages[0].text += ' Synthetic input drift.';
  assert.notEqual(canonicalOracleSha256(changedInput), PRECOMMITTED_BENCHMARK_SEMANTIC_SHA256);

  const changedExpectation = structuredClone(fixture);
  changedExpectation.scenarios[0].expected.accepted = false;
  assert.notEqual(canonicalOracleSha256(changedExpectation), PRECOMMITTED_BENCHMARK_SEMANTIC_SHA256);
});

test('scenario 21 is backed by the real read-only intake hash guard', async () => {
  const ownedRootUrl = new URL('../evidence-claim-workbench/fixtures/intake-hash-mismatch/', import.meta.url);
  const [manifest, documentBytes, evaluatorSource] = await Promise.all([
    readFile(new URL('evidence-inbox/manifest.json', ownedRootUrl), 'utf8').then(JSON.parse),
    readFile(new URL('evidence-inbox/document.json', ownedRootUrl)),
    readFile(new URL('../scripts/evaluate-evidence-claim-workbench.mjs', import.meta.url), 'utf8')
  ]);
  assert.equal(manifest.documents.length, 1);
  assert.equal(manifest.documents[0].byteLength, documentBytes.byteLength);
  assert.equal(manifest.documents[0].expectedSha256, '0'.repeat(64));
  assert.notEqual(createHash('sha256').update(documentBytes).digest('hex'), manifest.documents[0].expectedSha256);
  await assert.rejects(
    loadEvidenceInbox({ ownedRoot: fileURLToPath(ownedRootUrl), asOf: SYNTHETIC_BENCHMARK_AS_OF }),
    (error) => error.code === 'INTAKE_FILE_SHA256_MISMATCH'
  );
  assert.match(evaluatorSource, /loadEvidenceInbox\(\{[\s\S]*INTAKE_HASH_MISMATCH_OWNED_ROOT/u);
  assert.doesNotMatch(evaluatorSource, /file\.sha256\s*===\s*['"]0['"]\.repeat/u);
});

test('review-decision accuracy uses a precommitted two-case oracle independent of decision creation', async () => {
  const oracleUrl = new URL(
    '../evidence-claim-workbench/fixtures/review-decision-validation-oracle-v0.json',
    import.meta.url
  );
  const [oracle, evaluatorSource] = await Promise.all([
    readFile(oracleUrl, 'utf8').then(JSON.parse),
    readFile(new URL('../scripts/evaluate-evidence-claim-workbench.mjs', import.meta.url), 'utf8')
  ]);
  assert.equal(canonicalOracleSha256(oracle), PRECOMMITTED_REVIEW_DECISION_ORACLE_SHA256);
  assert.deepEqual(oracle.cases.map(({ id }) => id), [
    'valid_precommitted_approval',
    'invalid_precommitted_approval_acknowledgement'
  ]);
  for (const entry of oracle.cases) {
    let accepted = true;
    let errorCode = '';
    try {
      validateReviewDecision(entry.artifact);
    } catch (error) {
      accepted = false;
      errorCode = error.code;
    }
    assert.deepEqual({ accepted, errorCode }, entry.expected, entry.id);
  }
  const changedArtifact = structuredClone(oracle);
  changedArtifact.cases[0].artifact.reasonCodes = ['EVIDENCE_QUOTE_CONFIRMED'];
  assert.notEqual(canonicalOracleSha256(changedArtifact), PRECOMMITTED_REVIEW_DECISION_ORACLE_SHA256);
  const changedExpectation = structuredClone(oracle);
  changedExpectation.cases[1].expected.errorCode = 'DECISION_ID_MISMATCH';
  assert.notEqual(canonicalOracleSha256(changedExpectation), PRECOMMITTED_REVIEW_DECISION_ORACLE_SHA256);
  assert.match(evaluatorSource, /validateReviewDecision\(entry\.artifact\)/u);
  assert.doesNotMatch(evaluatorSource, /validateReviewDecision\(reviewAndPatch\.decision\)/u);
  assert.doesNotMatch(evaluatorSource, /independentlyBindDecisionId|computeReviewDecisionId/u);
});

test('the bounded demo catalog includes both families and conflict/supersession evidence', () => {
  const catalog = createSourceDocumentCatalog(createSyntheticDemoDocuments(), { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  assert.equal(catalog.documents.length, 13);
  assert.equal(catalog.supersessionEdges.length, 1);
  assert.deepEqual(
    [...new Set(catalog.documents.flatMap(({ source }) => source.productFamilies))].sort(),
    ['medium_voltage_switchgear', 'transformer']
  );
  assert.ok(catalog.documents.some(({ source }) => source.language === 'ko'));
});

test('all deterministic evaluation thresholds pass twice with zero authority or data leakage', async () => {
  const first = await evaluateEvidenceClaimWorkbench({ repeat: 2 });
  const second = await evaluateEvidenceClaimWorkbench({ repeat: 2 });
  assert.equal(first.documentStatus, 'OFFICIAL_EVIDENCE_WORKBENCH_EVALUATION_PASS');
  assert.equal(first.summary.scenarioCount, 35);
  assert.equal(first.summary.passed, 35);
  assert.equal(first.summary.failed, 0);
  assert.deepEqual(first.scenarioResults.map(({ id }) => id), EXPECTED_SCENARIOS);
  assert.deepEqual(first.thresholds, REQUIRED_EVALUATION_THRESHOLDS);
  for (const [metric, threshold] of Object.entries(REQUIRED_EVALUATION_THRESHOLDS)) {
    assert.equal(first.summary[metric], threshold, metric);
  }
  assert.equal(
    first.canonicalSha256,
    PRECOMMITTED_EVALUATION_CANONICAL_SHA256,
    'intentional evaluator semantic changes require explicit canonical oracle review'
  );
  assert.equal(first.canonicalSha256, second.canonicalSha256);
  assert.deepEqual(first.patchProof.previewClaimStatuses, ['UNVERIFIED']);
  assert.deepEqual(first.patchProof.previewCustomerUseStates, ['BLOCKED']);
  assert.equal(first.summary.realDocumentPopulation, 'BLOCKED_INPUT_MISSING');
  assert.equal(first.summary.candidateTruePositiveCount, 12);
  assert.equal(first.summary.candidateFalsePositiveCount, 0);
  assert.equal(first.summary.candidateFalseNegativeCount, 0);
  assert.equal(first.summary.realVerifiedClaims, 0);
  assert.equal(first.summary.realCustomerUseAllowed, 0);
});

test('the checked-in synthetic export fixture is bounded, deterministic, and remains a draft preview', () => {
  const first = createSyntheticApprovedReviewPatchFixture();
  const second = createSyntheticApprovedReviewPatchFixture();
  const serialized = serializeReviewPatch(first);
  assert.equal(serialized, serializeReviewPatch(second));
  assert.equal(first.productionReady, false);
  assert.equal(first.productionReviewerWorkflowReady, false);
  assert.equal(first.repositoryReviewRequired, true);
  assert.equal(first.automaticVerification, false);
  assert.equal(first.customerUseAllowed, false);
  assert.equal(first.evidenceAnchors.length, 1);
  assert.equal(first.evidenceAnchors[0].selection.directQuote, 'Rated voltage: 24 kV.');
  const preview = createDraftRegistryPreview(first, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  assert.deepEqual(preview.claims.map(({ claim }) => claim.status), ['UNVERIFIED']);
  assert.deepEqual(preview.claims.map(({ customerUse }) => customerUse.state), ['BLOCKED']);
  assert.equal(preview.metrics.verifiedCount, 0);
  assert.equal(preview.metrics.customerUseAllowedCount, 0);
});

test('review patch generation refuses an anchor containing the full page', () => {
  const fixture = createSyntheticBenchmarkFixture({ includeOversizedInputs: false });
  const raw = fixture.scenarios.find(({ id }) => id === '05_quantity_capability').documents[0];
  const document = normalizeSourceDocumentBundle(raw, { asOf: fixture.asOf });
  const page = document.pages[0];
  const anchor = createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: 0,
    endCodePoint: [...page.text].length,
    quote: page.text
  });
  const candidate = extractDeterministicCandidates({ document, anchors: [anchor] })[0];
  const decision = createReviewDecision({
    candidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  const relationshipReport = analyzeCandidateRelationships([candidate], { documents: [document] });
  assert.throws(() => createReviewPatch({
    baseCommitSha: 'a'.repeat(40),
    registryPath: 'knowledge/claim-registry/repository-reviewed/evidence-claim-review-import-v0.json',
    generatedAt: '2026-05-15T00:00:00.000Z',
    documents: [document],
    anchors: [anchor],
    candidates: [candidate],
    decisions: [decision],
    relationshipReport
  }), (error) => error.code === 'FULL_PAGE_EXCERPT_REFUSED');
});

test('the audit reports exact synthetic/real separation and no violations', async () => {
  const report = await auditEvidenceDocuments();
  assert.equal(report.documentStatus, 'OFFICIAL_EVIDENCE_DOCUMENT_AUDIT_PASS');
  assert.equal(report.summary.scenarioCount, 35);
  assert.equal(report.summary.syntheticDocumentRecords, 39);
  assert.equal(report.summary.normalizedDocumentRecords + report.summary.rejectedDocumentRecords, 39);
  assert.equal(report.summary.conflictCount, 1);
  assert.equal(report.summary.supersededCount, 1);
  assert.equal(report.summary.quoteBindingFailures, 0);
  assert.equal(report.summary.candidateExtractionFailures, 0);
  assert.deepEqual(report.summary.revisionStatus, {
    passed: 31,
    failed: 2,
    notEvaluatedAfterEarlierRefusal: 6
  });
  assert.deepEqual(report.summary.sourceUrlStatus, {
    passed: 33,
    failed: 3,
    notEvaluatedAfterEarlierRefusal: 3
  });
  assert.equal(report.realDocumentOutcome.REAL_DOCUMENT_POPULATION, 'BLOCKED_INPUT_MISSING');
  assert.equal(report.realDocumentOutcome.REAL_VERIFIED_CLAIMS, 0);
  assert.equal(report.realDocumentOutcome.REAL_CUSTOMER_USE_ALLOWED, 0);
  assert.deepEqual(report.violations, []);
});

test('export is stdout-only, imports bounded regular files, and exposes no filesystem-write option', async () => {
  const defaultResult = await exportEvidenceClaimReview();
  assert.equal(defaultResult.outputPath, '');
  assert.ok(defaultResult.serialized.endsWith('\n'));
  assert.equal(defaultResult.patch.patchId, createSyntheticApprovedReviewPatchFixture().patchId);
  await assert.rejects(
    exportEvidenceClaimReview({ argv: ['--output', '../escape.json'] }),
    /UNKNOWN_OPTION/
  );
  await assert.rejects(
    exportEvidenceClaimReview({ argv: ['--output', '/tmp/escape.json'] }),
    /UNKNOWN_OPTION/
  );

  const cwd = await mkdtemp(path.join(tmpdir(), 'oecrw-export-test-'));
  try {
    await writeFile(path.join(cwd, 'input.json'), defaultResult.serialized, { mode: 0o600 });
    const imported = await exportEvidenceClaimReview({ argv: ['--input', 'input.json'], cwd });
    assert.equal(imported.patch.patchId, defaultResult.patch.patchId);
    await symlink('input.json', path.join(cwd, 'symlink.json'));
    await assert.rejects(
      exportEvidenceClaimReview({ argv: ['--input', 'symlink.json'], cwd }),
      /INPUT_FILE_REFUSED/
    );
    await link(path.join(cwd, 'input.json'), path.join(cwd, 'hardlink.json'));
    await assert.rejects(
      exportEvidenceClaimReview({ argv: ['--input', 'hardlink.json'], cwd }),
      /INPUT_FILE_REFUSED/
    );
    await assert.rejects(
      exportEvidenceClaimReview({ argv: ['--force'], cwd }),
      /UNKNOWN_OPTION/
    );
    await assert.rejects(
      exportEvidenceClaimReview({ argv: ['input.json'], cwd }),
      /UNEXPECTED_POSITIONAL_ARGUMENT/
    );
    await assert.rejects(
      exportEvidenceClaimReview({ argv: ['--input', 'input.json', 'ignored.json'], cwd }),
      /UNEXPECTED_POSITIONAL_ARGUMENT/
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('export CLI failures are typed and never disclose a workspace path or stack', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'oecrw-export-cli-error-'));
  try {
    const script = fileURLToPath(new URL('../scripts/export-evidence-claim-review.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script, '--input', 'missing.json'], {
      cwd,
      encoding: 'utf8',
      env: { PATH: process.env.PATH || '' }
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'EXPORT_EVIDENCE_CLAIM_REVIEW_REFUSED:INPUT_FILE_REFUSED\n');
    assert.doesNotMatch(result.stderr, /(?:\/Users\/|\/home\/|file:\/\/|\bat\s+file:)/u);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('zero-side-effect metrics are backed by static browser/runtime contract checks', async () => {
  const [client, server] = await Promise.all([
    readFile(new URL('../evidence-claim-workbench/assets/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../evidence-claim-workbench/server.mjs', import.meta.url), 'utf8')
  ]);
  for (const forbidden of [
    /localStorage/u,
    /sessionStorage/u,
    /indexedDB/u,
    /caches\.open/u,
    /serviceWorker\.register/u,
    /document\.cookie/u
  ]) assert.doesNotMatch(client, forbidden);
  assert.doesNotMatch(client, /fetch\(\s*['"]https?:\/\//u);
  assert.doesNotMatch(server, /fetch\(\s*['"]https?:\/\//u);
});
