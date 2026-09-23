import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  readdir,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  MUTATION_CASES,
  REQUIRED_SENSITIVITY_LABELS,
  runSensitivityHarness
} from '../scripts/test-evidence-claim-workbench-sensitivity.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_LABELS = [
  'non-loopback',
  'arbitrary-path',
  'document-hash',
  'page-hash',
  'quote-presence',
  'quote-offsets',
  'credentialed-url',
  'private-url',
  'imported-model-verified',
  'review-to-verified',
  'review-to-allowed',
  'disabled-conflicts',
  'superseded-treated-current',
  'full-page-patch',
  'absolute-path-patch',
  'reviewer-identity-patch',
  'html-escaping',
  'external-browser-requests',
  'local-storage',
  'canonical-ordering',
  'candidate-id-content-reuse',
  'third-party-pdf-staged-by-default'
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('sensitivity inventory is the exact ordered 22-case guard-removal matrix', () => {
  assert.deepEqual(REQUIRED_SENSITIVITY_LABELS, EXPECTED_LABELS);
  assert.deepEqual(MUTATION_CASES.map(({ label }) => label), EXPECTED_LABELS);
  assert.equal(MUTATION_CASES.length, 22);
  assert.equal(new Set(MUTATION_CASES.map(({ label }) => label)).size, 22);
  assert.equal(new Set(MUTATION_CASES.map(({ probeId }) => probeId)).size, 22);
  for (const mutationCase of MUTATION_CASES) {
    assert.match(mutationCase.target, /^(?:evidence-claim-workbench|knowledge\/claim-registry)\//);
    assert.match(mutationCase.existingTest, /^tests\//);
    assert.equal(typeof mutationCase.from, 'string');
    assert.ok(mutationCase.from.length > 0);
    assert.equal(typeof mutationCase.probe, 'function');
  }
});

test('isolated mutations detect 22/22 guards, preserve originals, and remove every temporary copy', async (context) => {
  const temporaryParent = await mkdtemp(path.join(tmpdir(), 'oecrw-sensitivity-test-parent-'));
  context.after(async () => {
    await rm(temporaryParent, { recursive: true, force: true });
  });
  const targetFiles = [...new Set(MUTATION_CASES.map(({ target }) => target))].sort();
  const before = new Map(await Promise.all(targetFiles.map(async (target) => [
    target,
    sha256(await readFile(path.join(REPOSITORY_ROOT, target), 'utf8'))
  ])));

  const summary = await runSensitivityHarness({
    repositoryRoot: REPOSITORY_ROOT,
    temporaryParent
  });

  assert.equal(summary.schemaVersion, 'official-evidence-claim-workbench-sensitivity-v0');
  assert.equal(summary.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(summary.productionReady, false);
  assert.equal(summary.productionReviewerWorkflowReady, false);
  assert.equal(summary.issue165Status, 'HOLD');
  assert.deepEqual(summary.metrics, {
    required: 22,
    executed: 22,
    detected: 22,
    escaped: 0,
    baselineProbeFailures: 0,
    targetFileCount: targetFiles.length
  });
  assert.deepEqual(summary.execution, {
    mode: 'ISOLATED_TEMPORARY_COPY_STATIC_AND_BEHAVIORAL_MUTATION',
    realSourceWrites: 0,
    temporaryMutationCopies: 22,
    behavioralTestProcesses: 22,
    productionSystemsTouched: false,
    stagingSystemsTouched: false,
    externalNetworkCalls: 0,
    loopbackTestTrafficOnly: true,
    browserRequestsExecuted: 0,
    browserPersistenceWrites: 0
  });
  assert.deepEqual(summary.sourceIntegrity, { originalsUnchanged: true, changedFiles: [] });
  assert.deepEqual(summary.cleanup, {
    temporaryCaseCopiesRemoved: true,
    temporaryRootRemoved: true
  });
  assert.deepEqual(summary.cases.map(({ label }) => label), EXPECTED_LABELS);
  assert.ok(summary.cases.every((result) => result.baselineGuardPassed && result.detected && result.temporaryCopyRemoved));
  assert.ok(summary.cases.every((result) => result.probeKind === 'STATIC_SOURCE_INVARIANT_AND_BEHAVIORAL_TEST'));
  assert.ok(summary.cases.every((result) => result.behavioralTestFailed && result.behavioralTestExitCode > 0));
  assert.deepEqual(await readdir(temporaryParent), []);

  for (const target of targetFiles) {
    assert.equal(sha256(await readFile(path.join(REPOSITORY_ROOT, target), 'utf8')), before.get(target));
  }
});

test('committed sensitivity harness has no external-network surface and only the bounded test subprocess', async () => {
  const source = await readFile(path.join(REPOSITORY_ROOT, 'scripts/test-evidence-claim-workbench-sensitivity.mjs'), 'utf8');
  assert.doesNotMatch(source, /from ['"]node:(?:http|https|http2|net|tls|dgram|cluster|worker_threads)['"]/);
  assert.match(source, /import \{ spawnSync \} from 'node:child_process'/);
  assert.doesNotMatch(source, /\b(?:exec|execFile|spawn|fork)\s*\(/);
  assert.match(source, /spawnSync\(process\.execPath, \['--test', mutationCase\.existingTest\]/);
  assert.doesNotMatch(source, /\bawait\s+fetch\s*\(|\bglobalThis\.fetch\b/);
  assert.doesNotMatch(source, /process\.env/);
  assert.match(source, /externalNetworkCalls: 0/);
  assert.match(source, /realSourceWrites: 0/);
});

test('temporary mutation parent must be absolute and outside the repository', async () => {
  await assert.rejects(
    runSensitivityHarness({ repositoryRoot: REPOSITORY_ROOT, temporaryParent: '.' }),
    /ABSOLUTE_TEMPORARY_PARENT_REQUIRED/
  );
  await assert.rejects(
    runSensitivityHarness({ repositoryRoot: REPOSITORY_ROOT, temporaryParent: REPOSITORY_ROOT }),
    /TEMPORARY_PARENT_INSIDE_REPOSITORY_REFUSED/
  );
});
