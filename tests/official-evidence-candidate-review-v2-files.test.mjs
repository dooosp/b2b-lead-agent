import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES
} from '../evidence-claim-workbench/domain/candidate-review-v2.mjs';
import { createSyntheticCandidateReviewV2BlankRound } from '../scripts/evaluate-candidate-review-v2.mjs';
import {
  CANDIDATE_REVIEW_V2_ALLOWLISTS,
  CANDIDATE_REVIEW_V2_CLOSE_REASONS,
  CANDIDATE_REVIEW_V2_LIMITS,
  CANDIDATE_REVIEW_V2_PATHS,
  CandidateReviewV2FilesError,
  assertCandidateReviewLeakageSafe,
  assertCandidateReviewPathsIgnored,
  buildCandidateReviewRoundManifest,
  loadCandidateReviewPackage,
  parseStrictCandidateReviewJson,
  planCandidateReviewClose,
  prepareBlankCandidateReviewRoots,
  readBoundedCandidateReviewJson,
  validateAndSealRoleSubmission,
  validateCandidateReviewClosePlan
} from '../scripts/lib/candidate-review-v2-files.mjs';

const execFile = promisify(execFileCallback);
const HASH = 'a'.repeat(64);
let cachedRound;

function syntheticRound() {
  cachedRound ??= createSyntheticCandidateReviewV2BlankRound();
  return cachedRound;
}

function centralRound() {
  const { population, roundId, assignmentHash } = syntheticRound();
  return {
    schemaVersion: 'pr207-candidate-review-v2-round-v1',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    humanReviewExecuted: false,
    issue165: 'HOLD',
    roundId,
    populationHash: population.populationHash,
    assignmentHash
  };
}

function passingAccessProbe() {
  return {
    available: true,
    samePrincipal: false,
    primary: {
      ownRoot: { list: true, read: true, write: true },
      otherRoleRoot: { list: false, read: false, write: false },
      custodianRoot: { list: false, read: false, write: false }
    },
    secondary: {
      ownRoot: { list: true, read: true, write: true },
      otherRoleRoot: { list: false, read: false, write: false },
      custodianRoot: { list: false, read: false, write: false }
    }
  };
}

async function createRepository(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'candidate-review-v2-files-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  await execFile('git', ['init', '-q'], { cwd: root });
  await writeFile(
    path.join(root, '.gitignore'),
    'tmp/evidence-claim-workbench/\n',
    { mode: 0o600 }
  );
  return root;
}

async function prepareRepository(t, { accessProbe } = {}) {
  const repositoryRoot = await createRepository(t);
  const result = await prepareBlankCandidateReviewRoots({
    repositoryRoot,
    round: centralRound(),
    accessProbe
  });
  return { repositoryRoot, result };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CandidateReviewV2FilesError);
    assert.equal(error.code, code);
    assert.equal(error.status, 'HOLD');
    return true;
  });
}

function completedDraft(role) {
  const { population, roleSubmissions } = syntheticRound();
  const blank = roleSubmissions[role];
  return {
    ...blank,
    submissionAuthorityStatus:
      CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic,
    roleQualificationAttested: true,
    rows: population.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      limitationSafetyAcknowledgement: 'NOT_ATTESTED',
      decisionForm: {
        type: 'OUTER_HOLD_TERMINOLOGY_GAP',
        reasonCode: 'OUTER_V2_TERMINOLOGY_GAP'
      },
      reviewDurationSeconds: 60,
      evidenceTraceabilityUsefulness: 3,
      structuredDecisionUsefulness: 3,
      patchAssessmentUsefulness:
        role === 'PRIMARY_TECHNICAL_REVIEWER' ? null : 3
    }))
  };
}

async function writeDraft(repositoryRoot, role, value) {
  const relativePath = role === 'PRIMARY_TECHNICAL_REVIEWER'
    ? CANDIDATE_REVIEW_V2_PATHS.primarySubmission
    : CANDIDATE_REVIEW_V2_PATHS.secondarySubmission;
  const absolutePath = path.join(repositoryRoot, relativePath);
  await writeFile(absolutePath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  await chmod(absolutePath, 0o600);
  return absolutePath;
}

test('strict JSON parser rejects duplicate keys at every depth and trailing data', () => {
  assert.deepEqual(
    parseStrictCandidateReviewJson('{"a":1,"nested":{"b":[true,null]}}'),
    { a: 1, nested: { b: [true, null] } }
  );
  assert.throws(
    () => parseStrictCandidateReviewJson('{"a":1,"a":2}'),
    (error) => error.code === 'DUPLICATE_JSON_KEY'
  );
  assert.throws(
    () => parseStrictCandidateReviewJson('{"a":{"x":1,"x":2}}'),
    (error) => error.code === 'DUPLICATE_JSON_KEY'
  );
  assert.throws(
    () => parseStrictCandidateReviewJson('{"a":1} false'),
    (error) => error.code === 'TRAILING_JSON_CONTENT_REFUSED'
  );
  assert.throws(
    () => parseStrictCandidateReviewJson('{"n":1e9999}'),
    (error) => error.code === 'NON_FINITE_JSON_NUMBER_REFUSED'
  );
});
test('fixed roots and allowlists match the PR208 three-root method', () => {
  assert.deepEqual(Object.keys(CANDIDATE_REVIEW_V2_PATHS.roots), [
    'custodian',
    'primary',
    'secondary'
  ]);
  assert.equal(CANDIDATE_REVIEW_V2_ALLOWLISTS.candidateShards.length, 4);
  assert.equal(CANDIDATE_REVIEW_V2_ALLOWLISTS.patchShards.length, 35);
  assert.equal(CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes, 128 * 1024);
  assert.equal(CANDIDATE_REVIEW_V2_LIMITS.maximumPackageBytes, 1024 * 1024);
  assert.equal(CANDIDATE_REVIEW_V2_LIMITS.maximumAggregateExcerptCodePoints, 17_500);
});

test('ignore proof uses repository .gitignore and rejects a tracked detailed path', async (t) => {
  const repositoryRoot = await createRepository(t);
  const proof = await assertCandidateReviewPathsIgnored({ repositoryRoot });
  assert.equal(proof.gate, 'PASS');
  assert.ok(proof.paths.length > 40);
  assert.ok(proof.paths.every((entry) =>
    entry.ignoreSource === '.gitignore'
      && entry.tracked === false
      && entry.visibleAsUntracked === false));

  const trackedPath = CANDIDATE_REVIEW_V2_PATHS.round;
  await mkdir(path.dirname(path.join(repositoryRoot, trackedPath)), {
    recursive: true,
    mode: 0o700
  });
  await writeFile(path.join(repositoryRoot, trackedPath), '{}\n', { mode: 0o600 });
  await execFile('git', ['add', '-f', '--', trackedPath], { cwd: repositoryRoot });
  await expectCode(
    assertCandidateReviewPathsIgnored({
      repositoryRoot,
      relativePaths: [trackedPath]
    }),
    'TRACKED_CANDIDATE_REVIEW_PATH_REFUSED'
  );
});

test('blank preparation creates only fixed 0700 roots and 0600 non-human skeletons', async (t) => {
  const { repositoryRoot, result } = await prepareRepository(t);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.reason, 'BLANK_SKELETON_ONLY');
  assert.equal(result.accessIsolation, 'UNVERIFIED');
  assert.equal(result.humanReviewEvidenceCreated, false);
  assert.equal(result.files.length, 3);

  for (const root of Object.values(CANDIDATE_REVIEW_V2_PATHS.roots)) {
    const metadata = await lstat(path.join(repositoryRoot, root));
    assert.equal(metadata.mode & 0o777, 0o700);
  }
  for (const entry of result.files) {
    const metadata = await lstat(path.join(repositoryRoot, entry.relativePath));
    assert.equal(metadata.mode & 0o777, 0o600);
  }
  const primary = await readBoundedCandidateReviewJson({
    repositoryRoot,
    relativePath: CANDIDATE_REVIEW_V2_PATHS.primarySubmission
  });
  assert.equal(primary.value.role, 'PRIMARY_TECHNICAL_REVIEWER');
  assert.deepEqual(primary.value.rows, []);
  assert.equal(primary.value.sealed, false);
  assert.equal(primary.value.submissionHash, null);
});

test('blank preparation refuses an intermediate-directory swap before file creation', async (t) => {
  const repositoryRoot = await createRepository(t);
  const custodianRoot = path.join(
    repositoryRoot,
    CANDIDATE_REVIEW_V2_PATHS.roots.custodian
  );
  const movedRoot = `${custodianRoot}-moved`;
  let swapped = false;
  await expectCode(
    prepareBlankCandidateReviewRoots({
      repositoryRoot,
      round: centralRound(),
      inject: {
        async beforePrivateCreate({ relativePath }) {
          if (swapped || relativePath !== CANDIDATE_REVIEW_V2_PATHS.round) return;
          swapped = true;
          await rename(custodianRoot, movedRoot);
          await symlink(movedRoot, custodianRoot);
        }
      }
    }),
    'CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED'
  );
  await assert.rejects(
    lstat(path.join(movedRoot, path.basename(CANDIDATE_REVIEW_V2_PATHS.round))),
    (error) => error.code === 'ENOENT'
  );
});

test('blank preparation refuses an intermediate-directory swap after file creation', async (t) => {
  const repositoryRoot = await createRepository(t);
  const custodianRoot = path.join(
    repositoryRoot,
    CANDIDATE_REVIEW_V2_PATHS.roots.custodian
  );
  const movedRoot = `${custodianRoot}-moved`;
  let swapped = false;
  await expectCode(
    prepareBlankCandidateReviewRoots({
      repositoryRoot,
      round: centralRound(),
      inject: {
        async afterPrivateCreate({ relativePath }) {
          if (swapped || relativePath !== CANDIDATE_REVIEW_V2_PATHS.round) return;
          swapped = true;
          await rename(custodianRoot, movedRoot);
          await mkdir(custodianRoot, { recursive: true, mode: 0o700 });
          await writeFile(
            path.join(custodianRoot, path.basename(CANDIDATE_REVIEW_V2_PATHS.round)),
            '{}\n',
            { mode: 0o600 }
          );
        }
      }
    }),
    'CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED'
  );
  const movedStat = await lstat(
    path.join(movedRoot, path.basename(CANDIDATE_REVIEW_V2_PATHS.round))
  );
  assert.equal(movedStat.isFile(), true);
});

test('blank preparation refuses a directory swap after final path inspection', async (t) => {
  const repositoryRoot = await createRepository(t);
  const custodianRoot = path.join(
    repositoryRoot,
    CANDIDATE_REVIEW_V2_PATHS.roots.custodian
  );
  const movedRoot = `${custodianRoot}-moved`;
  let swapped = false;
  await expectCode(
    prepareBlankCandidateReviewRoots({
      repositoryRoot,
      round: centralRound(),
      inject: {
        async afterPrivateCreatePathInspection({ relativePath }) {
          if (swapped || relativePath !== CANDIDATE_REVIEW_V2_PATHS.round) return;
          swapped = true;
          await rename(custodianRoot, movedRoot);
          await symlink(movedRoot, custodianRoot);
        }
      }
    }),
    'CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED'
  );
});

test('blank package remains INCOMPLETE even with valid injected isolation evidence', async (t) => {
  const { repositoryRoot } = await prepareRepository(t);
  const loaded = await loadCandidateReviewPackage({
    repositoryRoot,
    population: syntheticRound().population,
    accessProbe: async () => passingAccessProbe()
  });
  assert.equal(loaded.status, 'INCOMPLETE');
  assert.equal(loaded.accessIsolation, 'PASS');
  assert.equal(loaded.productionReady, false);
  await expectCode(
    loadCandidateReviewPackage({
      repositoryRoot,
      population: syntheticRound().population
    }),
    'ACCESS_PROBE_REQUIRED'
  );
  await expectCode(
    loadCandidateReviewPackage({
      repositoryRoot,
      population: syntheticRound().population,
      accessProbe: async () => ({
        ...passingAccessProbe(),
        samePrincipal: true
      })
    }),
    'ACCESS_ISOLATION_HOLD'
  );
});

test('secure reader rejects invalid UTF-8, duplicate JSON keys, symlinks, and hardlinks', async (t) => {
  await t.test('invalid UTF-8', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    const target = path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.round);
    await writeFile(target, Buffer.from([0xc3, 0x28]));
    await chmod(target, 0o600);
    await expectCode(
      readBoundedCandidateReviewJson({
        repositoryRoot,
        relativePath: CANDIDATE_REVIEW_V2_PATHS.round
      }),
      'CANDIDATE_REVIEW_FILE_UTF8_INVALID'
    );
  });

  await t.test('duplicate keys', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    const target = path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.round);
    await writeFile(target, '{"boundary":"NOT_PRODUCTION_EVIDENCE","boundary":"HOLD"}\n');
    await chmod(target, 0o600);
    await expectCode(
      readBoundedCandidateReviewJson({
        repositoryRoot,
        relativePath: CANDIDATE_REVIEW_V2_PATHS.round
      }),
      'DUPLICATE_JSON_KEY'
    );
  });

  await t.test('symlink', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    const target = path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.round);
    const alternate = path.join(repositoryRoot, 'alternate.json');
    await writeFile(alternate, '{}\n', { mode: 0o600 });
    await unlink(target);
    await symlink(alternate, target);
    await expectCode(
      readBoundedCandidateReviewJson({
        repositoryRoot,
        relativePath: CANDIDATE_REVIEW_V2_PATHS.round
      }),
      'CANDIDATE_REVIEW_FILE_UNSAFE'
    );
  });

  await t.test('hardlink', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    const target = path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.round);
    const alternate = path.join(repositoryRoot, 'alternate.json');
    await writeFile(alternate, '{}\n', { mode: 0o600 });
    await unlink(target);
    await link(alternate, target);
    await expectCode(
      readBoundedCandidateReviewJson({
        repositoryRoot,
        relativePath: CANDIDATE_REVIEW_V2_PATHS.round
      }),
      'CANDIDATE_REVIEW_FILE_UNSAFE'
    );
  });
});

test('reader refuses alternate/traversal paths, wrong modes, oversize files, and inode races', async (t) => {
  const { repositoryRoot } = await prepareRepository(t);
  await expectCode(
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: '../round.json'
    }),
    'CANDIDATE_REVIEW_PATH_REFUSED'
  );
  await expectCode(
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: 'tmp/evidence-claim-workbench/human-approval/other.json'
    }),
    'CANDIDATE_REVIEW_PATH_NOT_ALLOWLISTED'
  );

  const target = path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.round);
  await chmod(target, 0o644);
  await expectCode(
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: CANDIDATE_REVIEW_V2_PATHS.round
    }),
    'CANDIDATE_REVIEW_FILE_MODE_UNSAFE'
  );

  await writeFile(
    target,
    Buffer.alloc(CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes + 1, 0x20)
  );
  await chmod(target, 0o600);
  await expectCode(
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: CANDIDATE_REVIEW_V2_PATHS.round
    }),
    'CANDIDATE_REVIEW_FILE_SIZE_OUT_OF_BOUNDS'
  );

  await writeFile(target, `${JSON.stringify(centralRound())}\n`, { mode: 0o600 });
  await chmod(target, 0o600);
  const original = await readFile(target);
  const backup = path.join(repositoryRoot, 'round-race-backup.json');
  await expectCode(
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: CANDIDATE_REVIEW_V2_PATHS.round,
      inject: {
        async afterPathInspection() {
          await rename(target, backup);
          await writeFile(target, original, { mode: 0o600 });
          await chmod(target, 0o600);
        }
      }
    }),
    'CANDIDATE_REVIEW_FILE_RACE_REFUSED'
  );

  const custodianRoot = path.join(
    repositoryRoot,
    CANDIDATE_REVIEW_V2_PATHS.roots.custodian
  );
  const movedRoot = `${custodianRoot}-moved`;
  await expectCode(
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: CANDIDATE_REVIEW_V2_PATHS.round,
      inject: {
        async afterPathInspection() {
          await rename(custodianRoot, movedRoot);
          await symlink(movedRoot, custodianRoot);
        }
      }
    }),
    'CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED'
  );
});

test('value-aware leakage validation rejects benign-key secrets, encoded paths, private URLs, and protected payloads', () => {
  for (const value of [
    { benign: 'token=super-secret-value' },
    { benign: 'release.owner@example.com' },
    { benign: '%2FUsers%2Freviewer%2Fprivate.json' },
    { benign: 'http://127.0.0.1:8787/review' },
    { benign: 'VERIFIED' },
    { sourceBinary: 'AA==' },
    { reviewerIdentity: 'alice' }
  ]) {
    assert.throws(
      () => assertCandidateReviewLeakageSafe(value),
      CandidateReviewV2FilesError
    );
  }
  assert.equal(assertCandidateReviewLeakageSafe({
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    reviewerIdentity: 'NOT_COLLECTED',
    reviewerLabel: 'repository_reviewer_pending',
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    publicSource: 'https://example.com/public/document'
  }), true);
});

test('quote and row caps fail rather than truncate', async (t) => {
  const repositoryRoot = await createRepository(t);
  await expectCode(
    prepareBlankCandidateReviewRoots({
      repositoryRoot,
      round: {
        ...centralRound(),
        evidence: {
          directQuote: 'x'.repeat(
            CANDIDATE_REVIEW_V2_LIMITS.maximumDirectQuoteCodePoints + 1
          )
        }
      }
    }),
    'DIRECT_QUOTE_CODE_POINT_LIMIT_EXCEEDED'
  );
});

test('completed role submission is core-validated, atomically sealed, and binds semantic and byte hashes separately', async (t) => {
  const { repositoryRoot } = await prepareRepository(t);
  await writeDraft(
    repositoryRoot,
    'PRIMARY_TECHNICAL_REVIEWER',
    completedDraft('PRIMARY_TECHNICAL_REVIEWER')
  );
  const result = await validateAndSealRoleSubmission({
    repositoryRoot,
    role: 'PRIMARY_TECHNICAL_REVIEWER',
    population: syntheticRound().population,
    accessProbe: async () => passingAccessProbe()
  });
  assert.equal(result.gate, 'PASS');
  assert.match(result.submissionHash, /^[a-f0-9]{64}$/u);
  assert.match(result.sha256, /^[a-f0-9]{64}$/u);
  assert.notEqual(result.submissionHash, result.sha256);
  const metadata = await lstat(
    path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.primarySubmission)
  );
  assert.equal(metadata.mode & 0o777, 0o400);
  const sealed = await readBoundedCandidateReviewJson({
    repositoryRoot,
    relativePath: CANDIDATE_REVIEW_V2_PATHS.primarySubmission,
    expectedMode: 0o400
  });
  assert.equal(sealed.value.sealed, true);
  assert.equal(sealed.value.submissionHash, result.submissionHash);
  assert.equal(sealed.value.rows.length, syntheticRound().population.candidateCount);
  assert.ok(sealed.value.rows.every((row) =>
    /^reviewrow_[a-f0-9]{64}$/u.test(row.reviewRowId)));
});

test('malformed completed rows and same-bytes replacement races cannot be sealed', async (t) => {
  await t.test('invalid candidate binding', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    const invalid = completedDraft('PRIMARY_TECHNICAL_REVIEWER');
    invalid.rows[0] = {
      ...invalid.rows[0],
      candidateId: `cand_${'0'.repeat(64)}`
    };
    await writeDraft(repositoryRoot, 'PRIMARY_TECHNICAL_REVIEWER', invalid);
    await expectCode(
      validateAndSealRoleSubmission({
        repositoryRoot,
        role: 'PRIMARY_TECHNICAL_REVIEWER',
        population: syntheticRound().population,
        accessProbe: async () => passingAccessProbe()
      }),
      'CORE_ROLE_SUBMISSION_INVALID'
    );
    const metadata = await lstat(
      path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.primarySubmission)
    );
    assert.equal(metadata.mode & 0o777, 0o600);
  });

  await t.test('replacement race', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    const target = await writeDraft(
      repositoryRoot,
      'PRIMARY_TECHNICAL_REVIEWER',
      completedDraft('PRIMARY_TECHNICAL_REVIEWER')
    );
    const bytes = await readFile(target);
    const backup = path.join(repositoryRoot, 'submission-race-backup.json');
    await expectCode(
      validateAndSealRoleSubmission({
        repositoryRoot,
        role: 'PRIMARY_TECHNICAL_REVIEWER',
        population: syntheticRound().population,
        accessProbe: async () => passingAccessProbe(),
        inject: {
          async beforeAtomicSeal() {
            await rename(target, backup);
            await writeFile(target, bytes, { mode: 0o600 });
            await chmod(target, 0o600);
          }
        }
      }),
      'CANDIDATE_REVIEW_FILE_RACE_REFUSED'
    );
  });

  await t.test('intermediate-directory replacement race', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    await writeDraft(
      repositoryRoot,
      'PRIMARY_TECHNICAL_REVIEWER',
      completedDraft('PRIMARY_TECHNICAL_REVIEWER')
    );
    const primaryRoot = path.join(
      repositoryRoot,
      CANDIDATE_REVIEW_V2_PATHS.roots.primary
    );
    const movedRoot = `${primaryRoot}-moved`;
    await expectCode(
      validateAndSealRoleSubmission({
        repositoryRoot,
        role: 'PRIMARY_TECHNICAL_REVIEWER',
        population: syntheticRound().population,
        accessProbe: async () => passingAccessProbe(),
        inject: {
          async beforeSealRename() {
            await rename(primaryRoot, movedRoot);
            await symlink(movedRoot, primaryRoot);
          }
        }
      }),
      'CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED'
    );
    const original = JSON.parse(await readFile(
      path.join(movedRoot, path.basename(CANDIDATE_REVIEW_V2_PATHS.primarySubmission)),
      'utf8'
    ));
    assert.equal(original.sealed, false);
  });
});

test('two distinct core-valid sealed roles are required before package COMPLETE', async (t) => {
  const { repositoryRoot } = await prepareRepository(t);
  for (const role of [
    'PRIMARY_TECHNICAL_REVIEWER',
    'SECONDARY_EVIDENCE_REVIEWER'
  ]) {
    await writeDraft(repositoryRoot, role, completedDraft(role));
    await validateAndSealRoleSubmission({
      repositoryRoot,
      role,
      population: syntheticRound().population,
      accessProbe: async () => passingAccessProbe()
    });
  }
  const loaded = await loadCandidateReviewPackage({
    repositoryRoot,
    population: syntheticRound().population,
    accessProbe: async () => passingAccessProbe()
  });
  assert.equal(loaded.status, 'COMPLETE');
  assert.equal(loaded.productionReady, false);
});

test('extra files and round-manifest self references fail closed', async (t) => {
  await t.test('extra file', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    await writeFile(
      path.join(
        repositoryRoot,
        CANDIDATE_REVIEW_V2_PATHS.roots.custodian,
        'backup.json'
      ),
      '{}\n',
      { mode: 0o600 }
    );
    await expectCode(
      loadCandidateReviewPackage({
        repositoryRoot,
        population: syntheticRound().population,
        accessProbe: async () => passingAccessProbe()
      }),
      'CANDIDATE_REVIEW_FILE_SET_INVALID'
    );
  });

  await t.test('self reference', async (t) => {
    const { repositoryRoot } = await prepareRepository(t);
    const target = path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.round);
    await writeFile(target, `${JSON.stringify({
      ...centralRound(),
      roundManifestSha256: HASH
    })}\n`);
    await chmod(target, 0o600);
    await expectCode(
      loadCandidateReviewPackage({
        repositoryRoot,
        population: syntheticRound().population,
        accessProbe: async () => passingAccessProbe()
      }),
      'ROUND_MANIFEST_SELF_REFERENCE_REFUSED'
    );
  });
});

test('round manifest externally hashes every other file and excludes itself', async () => {
  const files = [
    {
      rootLabel: 'PRIMARY_TECHNICAL_REVIEWER',
      relativePath: CANDIDATE_REVIEW_V2_PATHS.primarySubmission,
      sealState: 'SEALED',
      sha256: HASH,
      byteLength: 100
    },
    {
      rootLabel: 'SECONDARY_EVIDENCE_REVIEWER',
      relativePath: CANDIDATE_REVIEW_V2_PATHS.secondarySubmission,
      sealState: 'SEALED',
      sha256: 'b'.repeat(64),
      byteLength: 100
    },
    {
      rootLabel: 'CUSTODIAN',
      relativePath: CANDIDATE_REVIEW_V2_PATHS.round,
      sealState: 'DRAFT_OR_CENTRAL',
      sha256: 'c'.repeat(64),
      byteLength: 100
    }
  ];
  const result = buildCandidateReviewRoundManifest({ files });
  assert.equal(result.fileCount, 2);
  assert.match(result.roundManifestSha256, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(result.serialized, /roundManifestSha256|pr207-candidate-review-v2-round\.json/u);
});

test('close API returns and validates a non-destructive exact allowlist plan only', async (t) => {
  const { repositoryRoot } = await prepareRepository(t);
  const roundPath = path.join(repositoryRoot, CANDIDATE_REVIEW_V2_PATHS.round);
  const before = await readFile(roundPath);
  const plan = planCandidateReviewClose({
    closeKind: 'EXCEPTIONAL',
    closeReason: CANDIDATE_REVIEW_V2_CLOSE_REASONS.EXPIRED,
    roundManifestSha256: HASH
  });
  assert.equal(plan.executionAuthorized, false);
  assert.equal(plan.destructiveActionPerformed, false);
  assert.equal(plan.aggregateState, 'AGGREGATE_UNAVAILABLE_AT_FORCED_CLOSE');
  assert.ok(plan.filesToClear.includes(CANDIDATE_REVIEW_V2_PATHS.round));
  assert.deepEqual(validateCandidateReviewClosePlan(plan), {
    schemaVersion: 'pr207-candidate-review-v2-close-plan-v1',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    gate: 'PASS',
    planOnly: true,
    destructiveActionPerformed: false
  });
  assert.deepEqual(await readFile(roundPath), before);

  await expectCode(
    Promise.resolve().then(() => planCandidateReviewClose({
      closeKind: 'ORDINARY',
      closeReason: CANDIDATE_REVIEW_V2_CLOSE_REASONS.ORDINARY,
      roundManifestSha256: HASH
    })),
    'ORDINARY_CLOSE_PRECONDITIONS_NOT_MET'
  );
});
