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
  PR207_RIGHTS_RETENTION_POLICY_EXPECTATION,
  readSafeIgnoredJsonInput,
  validatePr207RightsRetentionPolicyComment,
  validatePr207HumanEvidenceInputs,
  validateRightsRetentionPolicyCommentAgainstExpectation,
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

const SYNTHETIC_POLICY_FIELDS = Object.freeze({
  POLICY_DECISION: 'APPROVE',
  FULL_PAGE_REVIEW_MODE: 'LOCAL_OPERATOR_DISPLAY_ONLY',
  FULL_PAGE_TRANSMISSION_ALLOWED: 'NO',
  FULL_PAGE_GIT_COMMIT_ALLOWED: 'NO',
  FULL_PAGE_EXPORT_ALLOWED: 'NO',
  BOUNDED_EXCERPT_INTERNAL_REVIEW_ALLOWED: 'YES',
  PUBLIC_REPOSITORY_EXCERPT_ALLOWED_DURING_PILOT: 'NO',
  REVIEW_RECORD_RETENTION_MODE:
    'BOUNDED_REVIEW_METADATA_AND_EXCERPTS_ONLY',
  REVIEW_RECORD_RETENTION_LOCATION:
    'LOCAL_IGNORED_HUMAN_APPROVAL_PATH_AND_CONTROL_BRANCH_ANONYMIZED_HASH_AGGREGATES_ONLY',
  REVIEWER_IDENTITY_RETAINED: 'NOT_COLLECTED',
  FULL_SOURCE_BINARY_RETAINED:
    'LOCAL_IGNORED_OPERATOR_CONTROLLED_ONLY; NEVER_GIT_COMMITTED_OR_TRANSMITTED',
  REAL_DOCUMENT_VERIFIED_CLAIMS_CREATED: '0',
  REAL_DOCUMENT_ALLOWED_CLAIMS_CREATED: '0',
  PRODUCTION_APPROVED: 'NO',
  MERGE_APPROVED_BY_THIS_COMMENT: 'NO',
});

function syntheticPolicyFixture() {
  const lines = [
    'SYNTHETIC_PR207_RIGHTS_POLICY_TEST_V1',
    '',
    'RIGHTS_RETENTION_OWNER_GITHUB_LOGIN: synthetic-owner',
    'OWNER_AUTHORITY: I attest I am authorized to decide the page-review rights and review-record retention policy for this bounded pilot.',
    `EVALUATED_PR: 207`,
    `EVALUATED_HEAD: ${EXPECTED_PR207_HEAD}`,
    `DOCUMENT_DECISION_FILE_SHA256: ${EXPECTED_DOCUMENT_DECISION_FILE_SHA256}`,
    ...Object.entries(SYNTHETIC_POLICY_FIELDS).map(([key, value]) => `${key}: ${value}`),
    'EXPIRATION_OR_REVIEW_DATE: 2026-08-21T23:59:59Z',
    'STOP_CONDITIONS: evaluated-head drift; document-decision or source hash drift; unauthorized full-page transmission, export, or Git commit; full-page or source-binary leakage; private or secret leakage; expiry/review-date arrival; incomplete, vague, or contradictory human decision.',
  ];
  const body = lines.join('\r\n');
  const expectation = {
    commentId: 999,
    apiUrl: 'https://api.example.invalid/comments/999',
    commentUrl: 'https://example.invalid/pull/207#comment-999',
    issueUrl: 'https://api.example.invalid/issues/207',
    authorLogin: 'synthetic-owner',
    authorType: 'User',
    authorAssociation: 'OWNER',
    createdAt: '2026-07-21T08:48:13Z',
    updatedAt: '2026-07-21T08:48:13Z',
    marker: lines[0],
    rawBodySha256: sha256(body),
    lfBodySha256: sha256(body.replace(/\r\n?/g, '\n')),
    evaluatedPr: 207,
    evaluatedHead: EXPECTED_PR207_HEAD,
    documentDecisionFileSha256: EXPECTED_DOCUMENT_DECISION_FILE_SHA256,
    expirationOrReviewDate: '2026-08-21T23:59:59Z',
    policyFields: SYNTHETIC_POLICY_FIELDS,
  };
  return {
    expectation,
    comment: {
      id: expectation.commentId,
      url: expectation.apiUrl,
      html_url: expectation.commentUrl,
      issue_url: expectation.issueUrl,
      user: {
        login: expectation.authorLogin,
        type: expectation.authorType,
      },
      author_association: expectation.authorAssociation,
      created_at: expectation.createdAt,
      updated_at: expectation.updatedAt,
      body,
    },
  };
}

function validateSyntheticPolicy(fixture, asOf = '2026-07-21T08:54:24.000Z') {
  return validateRightsRetentionPolicyCommentAgainstExpectation({
    ...fixture,
    asOf,
  });
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

test('accepts a bounded active rights/retention policy without retaining its body', () => {
  const record = validateSyntheticPolicy(syntheticPolicyFixture());
  assert.equal(
    record.validationStatus,
    'VALID_ACTIVE_BOUNDED_POLICY_LOCAL_DISPLAY_ONLY',
  );
  assert.equal(record.fullPageReviewMode, 'LOCAL_OPERATOR_DISPLAY_ONLY');
  assert.equal(record.fullPageTransmissionAllowed, 'NO');
  assert.equal(record.boundedExcerptInternalReviewAllowed, 'YES');
  assert.equal(record.realDocumentVerifiedClaimsCreated, 0);
  assert.equal(record.realDocumentAllowedClaimsCreated, 0);
  assert.equal(record.productionApproved, 'NO');
  assert.equal(record.mergeApprovedByThisComment, 'NO');
  assert.equal(record.activeAtEvaluation, true);
  assert.equal(record.rawBodyRetained, false);
  assert.equal(record.stopConditionCoverage.length, 7);
  assert.doesNotMatch(JSON.stringify(record), /OWNER_AUTHORITY|STOP_CONDITIONS|body/);
});

test('pins the canonical GitHub comment identity before reading policy content', () => {
  assert.equal(PR207_RIGHTS_RETENTION_POLICY_EXPECTATION.commentId, 5031954760);
  assert.equal(PR207_RIGHTS_RETENTION_POLICY_EXPECTATION.authorLogin, 'dooosp');
  assert.equal(PR207_RIGHTS_RETENTION_POLICY_EXPECTATION.authorAssociation, 'OWNER');
  assert.equal(
    PR207_RIGHTS_RETENTION_POLICY_EXPECTATION.rawBodySha256,
    '13a7d5809bf10df1383219dac9f9ebe59e92c83e01e054ccbada539aa1b6b760',
  );
  const { comment } = syntheticPolicyFixture();
  assert.throws(
    () => validatePr207RightsRetentionPolicyComment({
      comment,
      asOf: '2026-07-21T08:54:24.000Z',
    }),
    { code: 'RIGHTS_POLICY_COMMENT_METADATA_DRIFT' },
  );
});

test('rejects rights policy metadata drift including post-publication edits', () => {
  const fixture = syntheticPolicyFixture();
  fixture.comment.updated_at = '2026-07-21T08:49:00Z';
  assert.throws(
    () => validateSyntheticPolicy(fixture),
    { code: 'RIGHTS_POLICY_COMMENT_METADATA_DRIFT' },
  );
});

test('rejects rights policy body schema and marker drift', async (t) => {
  await t.test('marker drift', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body = fixture.comment.body.replace(
      fixture.expectation.marker,
      'DIFFERENT_POLICY_MARKER',
    );
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_MARKER_DRIFT' },
    );
  });

  await t.test('missing field', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body = fixture.comment.body.replace(
      /REVIEWER_IDENTITY_RETAINED:[^\r\n]+\r\n/,
      '',
    );
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_BODY_SCHEMA_DRIFT' },
    );
  });
});

test('rejects rights policy evaluated-head and decision-file hash drift', async (t) => {
  await t.test('head drift', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body = fixture.comment.body.replace(
      EXPECTED_PR207_HEAD,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_HEAD_DRIFT' },
    );
  });

  await t.test('decision-file hash drift', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body = fixture.comment.body.replace(
      EXPECTED_DOCUMENT_DECISION_FILE_SHA256,
      'a'.repeat(64),
    );
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_DOCUMENT_DECISION_HASH_DRIFT' },
    );
  });
});

test('rejects raw and LF-normalized rights policy body hash drift', async (t) => {
  await t.test('raw hash drift', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body += '\r\n';
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_RAW_BODY_HASH_DRIFT' },
    );
  });

  await t.test('LF-normalized hash drift', () => {
    const fixture = syntheticPolicyFixture();
    fixture.expectation = {
      ...fixture.expectation,
      lfBodySha256: sha256('different LF-normalized body'),
    };
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_LF_BODY_HASH_DRIFT' },
    );
  });
});

test('rejects contradictory rights policy fields, counts, and authority', async (t) => {
  await t.test('full-page transmission', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body = fixture.comment.body.replace(
      'FULL_PAGE_TRANSMISSION_ALLOWED: NO',
      'FULL_PAGE_TRANSMISSION_ALLOWED: YES',
    );
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_CONTRADICTION' },
    );
  });

  await t.test('nonzero verified claim count', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body = fixture.comment.body.replace(
      'REAL_DOCUMENT_VERIFIED_CLAIMS_CREATED: 0',
      'REAL_DOCUMENT_VERIFIED_CLAIMS_CREATED: 1',
    );
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_CONTRADICTION' },
    );
  });

  await t.test('merge approval', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body = fixture.comment.body.replace(
      'MERGE_APPROVED_BY_THIS_COMMENT: NO',
      'MERGE_APPROVED_BY_THIS_COMMENT: YES',
    );
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_CONTRADICTION' },
    );
  });
});

test('rejects incomplete stop conditions and an expired policy', async (t) => {
  await t.test('stop-condition coverage', () => {
    const fixture = syntheticPolicyFixture();
    fixture.comment.body = fixture.comment.body.replace(
      'private or secret leakage; ',
      '',
    );
    assert.throws(
      () => validateSyntheticPolicy(fixture),
      { code: 'RIGHTS_POLICY_STOP_CONDITIONS_INCOMPLETE' },
    );
  });

  await t.test('expiry boundary', () => {
    const fixture = syntheticPolicyFixture();
    assert.throws(
      () => validateSyntheticPolicy(fixture, '2026-08-21T23:59:59.000Z'),
      { code: 'RIGHTS_POLICY_EXPIRED' },
    );
  });
});

test('accepts the exact blank-input contract as structurally valid but incomplete', () => {
  const report = validatePr207HumanEvidenceInputs(syntheticInputs());
  assert.equal(report.schemaVersion, 'pr207-human-evidence-input-validation-v2');
  assert.equal(report.validationStatus, 'STRUCTURALLY_VALID');
  assert.equal(report.evidenceStatus, 'INCOMPLETE');
  assert.equal(report.operatorOutcome, 'AWAITING_HUMAN_INPUT');
  assert.equal(report.counts.safeIgnoredInputFileCount, 12);
  assert.equal(report.counts.fidelityDecisionRowCount, 8);
  assert.equal(report.counts.blankFidelityDecisionRowCount, 8);
  assert.equal(report.counts.completedFidelityDecisionRowCount, 0);
  assert.equal(report.counts.candidateDecisionRowCount, 0);
  assert.equal(report.statuses.mergeApproval, 'NOT_GRANTED');
  assert.equal(
    report.statuses.rightsAndRetentionAuthority,
    'NOT_VALIDATED_REQUIRES_CANONICAL_GITHUB_DECISION',
  );
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
