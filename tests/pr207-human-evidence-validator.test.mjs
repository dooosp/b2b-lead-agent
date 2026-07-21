import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  EXPECTED_DOCUMENT_DECISION_FILE_SHA256,
  EXPECTED_DOCUMENT_TUPLE_FINGERPRINT_SHA256,
  EXPECTED_INTAKE_MANIFEST_SHA256,
  EXPECTED_PR207_HEAD,
  readSafeIgnoredJsonInput,
  validatePr207HumanEvidenceInputs,
} from '../scripts/lib/pr207-human-evidence-validator.mjs';

const SAFE_INPUT_STATUS = 'SAFE_IGNORED_UNTRACKED_REGULAR_0600_SINGLE_LINK';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function descriptor(value, sha) {
  return {
    safetyStatus: SAFE_INPUT_STATUS,
    sha256: sha,
    byteLength: Buffer.byteLength(JSON.stringify(value)),
    value,
  };
}

function syntheticInputs() {
  const rows = Array.from({ length: 8 }, (_, index) => {
    const sequence = index + 1;
    return {
      documentId: `doc_${sha256(`document-${sequence}`)}`,
      normalizedIntakeFileSha256: sha256(`normalized-file-${sequence}`),
      fileSha256: sha256(`source-file-${sequence}`),
      normalizedContentSha256: sha256(`normalized-content-${sequence}`),
      publisher: `publisher-${sequence}`,
      officialSourceUrl: `https://example.invalid/document-${sequence}`,
      documentNumber: `DOC-${sequence}`,
      revision: `revision-${sequence}`,
      language: 'en',
      productFamily: sequence <= 4 ? 'medium_voltage_switchgear' : 'transformer',
    };
  });
  const normalizedDocuments = rows.map((row, index) => {
    const value = {
      schemaVersion: 'source-document-bundle-v0',
      boundary: 'NOT_PRODUCTION_EVIDENCE',
      productionReady: false,
      synthetic: false,
      documentId: row.documentId,
      file: {
        sha256: row.fileSha256,
        contentSha256: row.normalizedContentSha256,
      },
      source: {
        sourceUrl: row.officialSourceUrl,
        publisher: row.publisher,
        documentNumber: row.documentNumber,
        language: row.language,
        productFamilies: [row.productFamily],
        redistributionStatus: 'METADATA_AND_BOUNDED_EXCERPTS_ONLY',
      },
      revision: { revisionId: row.revision },
      pages: [{ pageNumber: 1 }],
    };
    return {
      relativePath: `evidence-inbox/document-${index + 1}.json`,
      input: descriptor(value, row.normalizedIntakeFileSha256),
    };
  });
  const manifest = {
    schemaVersion: 'official-evidence-intake-manifest-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    documents: rows.map((row, index) => ({
      relativePath: `document-${index + 1}.json`,
      byteLength: normalizedDocuments[index].input.byteLength,
      mediaType: 'application/json',
      sourceUrl: row.officialSourceUrl,
      publisher: row.publisher,
      title: `title-${index + 1}`,
      documentNumber: row.documentNumber,
      documentType: 'NORMALIZED_PAGE_TEXT_JSON',
      revision: {
        seriesId: `series-${index + 1}`,
        revisionId: row.revision,
        sequence: 1,
      },
      language: row.language,
      vertical: 'datacenter',
      jurisdiction: 'KR',
      domain: 'electrical_power',
      productFamilies: [row.productFamily],
      redistributionStatus: 'METADATA_AND_BOUNDED_EXCERPTS_ONLY',
      expectedSha256: row.normalizedIntakeFileSha256,
    })),
  };
  const documentDecisions = {
    schemaVersion: 'pr207-document-decisions-v1',
    boundary: 'LOCAL_IGNORED_HUMAN_INPUT_TEMPLATE',
    evaluatedPr: 207,
    evaluatedHead: EXPECTED_PR207_HEAD,
    intakeAsOf: '2026-07-18T13:01:00.000Z',
    intakeManifestSha256: EXPECTED_INTAKE_MANIFEST_SHA256,
    documentTupleFingerprintSha256: EXPECTED_DOCUMENT_TUPLE_FINGERPRINT_SHA256,
    documentCount: 8,
    humanFieldsAreBlank: false,
    allowedDecisions: {
      officialityDecision: [
        'OWNER_ATTESTED_OFFICIAL_SOURCE',
        'REJECTED_NOT_OFFICIAL',
        'UNCERTAIN',
      ],
      currentnessDecision: ['CURRENT_REVISION', 'SUPERSEDED', 'UNKNOWN'],
      technicalScopeDecision: ['IN_SCOPE', 'OUT_OF_SCOPE', 'UNKNOWN'],
      boundedExcerptUseDecision: [
        'APPROVED_FOR_INTERNAL_REPOSITORY_REVIEW',
        'REJECTED',
        'UNKNOWN',
      ],
      binaryCommitDecision: ['DO_NOT_COMMIT_BINARY'],
    },
    documents: rows.map((row) => ({
      ...row,
      officialityDecision: 'OWNER_ATTESTED_OFFICIAL_SOURCE',
      currentnessDecision: 'CURRENT_REVISION',
      technicalScopeDecision: 'IN_SCOPE',
      boundedExcerptUseDecision: 'APPROVED_FOR_INTERNAL_REPOSITORY_REVIEW',
      binaryCommitDecision: 'DO_NOT_COMMIT_BINARY',
      decisionReasonCode: 'AUTHORIZED_OWNER_REVIEW_CONFIRMED',
    })),
    nonClaims: ['Synthetic fixture; no approval is created by this test.'],
  };
  const fidelityDecisions = {
    schemaVersion: 'pr207-document-fidelity-decisions-v1',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    preparedBy: 'CODEX_MACHINE_TEMPLATE_NO_HUMAN_DECISIONS',
    evaluatedPr: 207,
    evaluatedHead: EXPECTED_PR207_HEAD,
    documentDecisionFileSha256: EXPECTED_DOCUMENT_DECISION_FILE_SHA256,
    intakeManifestSha256: EXPECTED_INTAKE_MANIFEST_SHA256,
    documentTupleFingerprintSha256: EXPECTED_DOCUMENT_TUPLE_FINGERPRINT_SHA256,
    documentCount: 8,
    humanFieldsAreBlank: true,
    allowedPageTextFidelityDecisions: [
      'EXACT',
      'ACCEPTABLE_WITH_LIMITATIONS',
      'UNSAFE_FOR_CANDIDATE_REVIEW',
    ],
    documents: rows.map((row) => ({
      documentId: row.documentId,
      fileSha256: row.fileSha256,
      normalizedContentSha256: row.normalizedContentSha256,
      pagesChecked: [],
      candidateBearingPagesChecked: [],
      revisionPageChecked: null,
      pageTextFidelity: null,
      tableStructureFidelity: null,
      variantSemanticsPreserved: null,
      unitSemanticsPreserved: null,
      minMaxRangeSemanticsPreserved: null,
      footnoteSemanticsPreserved: null,
      eligiblePageNumbers: [],
      ineligiblePageNumbers: [],
      decisionReasonCodes: [],
    })),
    nonClaims: ['Synthetic blank fidelity fixture.'],
  };
  const candidateDecisions = {
    schemaVersion: 'pr207-candidate-decisions-v1',
    boundary: 'LOCAL_IGNORED_HUMAN_INPUT_TEMPLATE',
    evaluatedPr: 207,
    evaluatedHead: EXPECTED_PR207_HEAD,
    intakeAsOf: '2026-07-18T13:01:00.000Z',
    intakeManifestSha256: EXPECTED_INTAKE_MANIFEST_SHA256,
    candidateSource: 'CURRENT_REAL_WORKBENCH_PLUS_VARIANT_TABLE_SPIKE',
    candidateCount: 0,
    candidateCountsByFamily: {
      medium_voltage_switchgear: 0,
      transformer: 0,
    },
    variantTablePropositionCount: 0,
    variantTableAbstentionCount: 2,
    humanFieldsAreBlank: true,
    allowedHumanDecisions: [
      'APPROVE_FOR_REPOSITORY_REVIEW',
      'REJECT',
      'DEFER_MISSING_CONTEXT',
      'FLAG_CONFLICT',
      'FLAG_SUPERSEDED',
      'FLAG_SOURCE_AUTHENTICITY',
    ],
    candidates: [],
    blockers: [
      'CURRENT_CANDIDATE_ID_SET_IS_EMPTY',
      'TRACK_B_MINIMUM_25_CANDIDATES_CANNOT_BE_SATISFIED_FROM_CURRENT_OUTPUT',
    ],
    nonClaims: ['Synthetic empty candidate fixture.'],
  };
  return {
    intakeManifest: descriptor(manifest, EXPECTED_INTAKE_MANIFEST_SHA256),
    normalizedDocuments,
    documentDecisions: descriptor(
      documentDecisions,
      EXPECTED_DOCUMENT_DECISION_FILE_SHA256,
    ),
    fidelityDecisions: descriptor(fidelityDecisions, sha256('fidelity-fixture')),
    candidateDecisions: descriptor(candidateDecisions, sha256('candidate-fixture')),
  };
}

test('accepts the exact blank-input contract as structurally valid but incomplete', () => {
  const report = validatePr207HumanEvidenceInputs(syntheticInputs());
  assert.equal(report.validationStatus, 'STRUCTURALLY_VALID');
  assert.equal(report.evidenceStatus, 'INCOMPLETE');
  assert.equal(report.operatorOutcome, 'AWAITING_HUMAN_INPUT');
  assert.equal(report.counts.safeIgnoredInputFileCount, 12);
  assert.equal(report.counts.fidelityDecisionRowCount, 8);
  assert.equal(report.counts.blankFidelityDecisionRowCount, 8);
  assert.equal(report.counts.completedFidelityDecisionRowCount, 0);
  assert.equal(report.counts.candidateDecisionRowCount, 0);
  assert.equal(report.statuses.mergeApproval, 'NOT_GRANTED');
  assert.doesNotMatch(
    JSON.stringify(report),
    /sourceUrl|publisher|title|reviewer|pagesChecked|decisionReasonCodes/,
  );
});

test('rejects unknown fields instead of widening the fidelity schema', () => {
  const inputs = syntheticInputs();
  inputs.fidelityDecisions.value.documents[0].unexpected = true;
  assert.throws(
    () => validatePr207HumanEvidenceInputs(inputs),
    { code: 'FIDELITY_ROW_SCHEMA_DRIFT' },
  );
});

test('rejects fidelity tuple drift from the bound document decisions', () => {
  const inputs = syntheticInputs();
  inputs.fidelityDecisions.value.documents[0].fileSha256 = sha256('drifted-file');
  assert.throws(
    () => validatePr207HumanEvidenceInputs(inputs),
    { code: 'FIDELITY_DOCUMENT_BINDING_DRIFT' },
  );
});

test('rejects an actual normalized input that drifts from its manifest hash', () => {
  const inputs = syntheticInputs();
  inputs.normalizedDocuments[0].input.sha256 = sha256('drifted-normalized-input');
  assert.throws(
    () => validatePr207HumanEvidenceInputs(inputs),
    { code: 'NORMALIZED_INPUT_HASH_DRIFT' },
  );
});

test('rejects nonblank fidelity values until a human completion contract exists', () => {
  const inputs = syntheticInputs();
  inputs.fidelityDecisions.value.documents[0].pagesChecked = [1];
  assert.throws(
    () => validatePr207HumanEvidenceInputs(inputs),
    { code: 'FIDELITY_COMPLETION_CONTRACT_UNSUPPORTED' },
  );
});

test('rejects nonempty candidate v1 inputs until a candidate contract exists', () => {
  const inputs = syntheticInputs();
  inputs.candidateDecisions.value.candidateCount = 1;
  inputs.candidateDecisions.value.candidates = [{ decision: 'APPROVE_FOR_REPOSITORY_REVIEW' }];
  assert.throws(
    () => validatePr207HumanEvidenceInputs(inputs),
    { code: 'CANDIDATE_POPULATION_CONTRACT_UNSUPPORTED' },
  );
});

test('rejects pinned manifest hash drift', () => {
  const inputs = syntheticInputs();
  inputs.intakeManifest.sha256 = sha256('different-manifest');
  assert.throws(
    () => validatePr207HumanEvidenceInputs(inputs),
    { code: 'MANIFEST_HASH_DRIFT' },
  );
});

async function withSyntheticIgnoredInput(run) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'pr207-validator-root-'));
  const root = await realpath(temporaryRoot);
  try {
    execFileSync('git', ['init', '--quiet', root]);
    await writeFile(path.join(root, '.gitignore'), 'ignored/\n', 'utf8');
    await mkdir(path.join(root, 'ignored'));
    const inputPath = path.join(root, 'ignored', 'input.json');
    await writeFile(inputPath, '{"safe":true}\n', { mode: 0o600 });
    await chmod(inputPath, 0o600);
    await run({ root, inputPath });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

test('secure reader accepts an ignored untracked regular 0600 single-link JSON input', async () => {
  await withSyntheticIgnoredInput(async ({ root }) => {
    const input = await readSafeIgnoredJsonInput({
      pr207Root: root,
      relativePath: 'ignored/input.json',
    });
    assert.equal(input.safetyStatus, SAFE_INPUT_STATUS);
    assert.deepEqual(input.value, { safe: true });
  });
});

test('secure reader rejects permissive mode, symbolic links, and hard links', async (t) => {
  await t.test('mode 0644', async () => {
    await withSyntheticIgnoredInput(async ({ root, inputPath }) => {
      await chmod(inputPath, 0o644);
      await assert.rejects(
        readSafeIgnoredJsonInput({
          pr207Root: root,
          relativePath: 'ignored/input.json',
        }),
        { code: 'INPUT_MODE_MUST_BE_0600' },
      );
    });
  });

  await t.test('symbolic link', async () => {
    await withSyntheticIgnoredInput(async ({ root, inputPath }) => {
      const target = path.join(root, 'target.json');
      await writeFile(target, '{}\n', { mode: 0o600 });
      await rm(inputPath);
      await symlink(target, inputPath);
      await assert.rejects(
        readSafeIgnoredJsonInput({
          pr207Root: root,
          relativePath: 'ignored/input.json',
        }),
        { code: 'INPUT_UNSAFE_OR_MISSING' },
      );
    });
  });

  await t.test('hard link', async () => {
    await withSyntheticIgnoredInput(async ({ root, inputPath }) => {
      const secondPath = path.join(root, 'ignored', 'second.json');
      await link(inputPath, secondPath);
      await assert.rejects(
        readSafeIgnoredJsonInput({
          pr207Root: root,
          relativePath: 'ignored/input.json',
        }),
        { code: 'INPUT_MULTI_LINK_REFUSED' },
      );
      assert.equal(await readFile(secondPath, 'utf8'), '{"safe":true}\n');
    });
  });
});
