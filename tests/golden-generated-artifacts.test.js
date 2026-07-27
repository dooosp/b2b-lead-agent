const test = require('node:test');
const assert = require('node:assert/strict');
const {
  promises: fsPromises,
  readFileSync,
  statSync,
} = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

function moduleUrl(relativePath) {
  return pathToFileURL(join(process.cwd(), relativePath));
}

async function loadChecker() {
  return import(moduleUrl('scripts/check-pursuit-golden-generated-artifacts.mjs'));
}

function snapshot(paths) {
  return paths.map((relativePath) => {
    const absolutePath = join(process.cwd(), relativePath);
    const stats = statSync(absolutePath, { bigint: true });
    return {
      relativePath,
      bytes: readFileSync(absolutePath),
      size: stats.size,
      mtimeNs: stats.mtimeNs,
      mode: stats.mode,
    };
  });
}

function artifactReader(contents, mutate) {
  return async ({ relativePath }) => {
    const value = contents.get(relativePath);
    return mutate ? mutate(relativePath, value) : value;
  };
}

test('canonical Golden generated artifacts are deterministic and cover the exact nine paths', async () => {
  const checker = await loadChecker();
  const first = await checker.buildExpectedGoldenGeneratedArtifacts();
  const second = await checker.buildExpectedGoldenGeneratedArtifacts();

  assert.deepEqual(
    first.map((entry) => entry.relativePath),
    checker.GOLDEN_GENERATED_ARTIFACT_PATHS,
  );
  assert.deepEqual(
    first.map((entry) => [entry.relativePath, entry.format, entry.expectedContent]),
    second.map((entry) => [entry.relativePath, entry.format, entry.expectedContent]),
  );
  assert.ok(first.every((entry) => entry.expectedContent.endsWith('\n')));
});

test('current canonical artifacts pass without filesystem mutation', async () => {
  const checker = await loadChecker();
  const before = snapshot(checker.GOLDEN_GENERATED_ARTIFACT_PATHS);

  const first = await checker.checkPursuitGoldenGeneratedArtifacts();
  const second = await checker.checkPursuitGoldenGeneratedArtifacts();
  const after = snapshot(checker.GOLDEN_GENERATED_ARTIFACT_PATHS);

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    documentStatus: 'PURSUIT_GOLDEN_GENERATED_ARTIFACT_DRIFT_CHECK_PASS',
    productionReady: false,
    checkedArtifactCount: 9,
    checkedPaths: [...checker.GOLDEN_GENERATED_ARTIFACT_PATHS],
  });
  assert.deepEqual(after, before);
});

test('both approval receipts fail closed on one-byte canonical drift', async (t) => {
  const checker = await loadChecker();
  const contents = new Map(
    checker.GOLDEN_GENERATED_ARTIFACT_PATHS.map((relativePath) => [
      relativePath,
      readFileSync(join(process.cwd(), relativePath), 'utf8'),
    ]),
  );
  const receiptPaths = [
    'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json',
    'tmp/codex/pursuit-golden-human-review-batch-02-approval-receipt-non-production.json',
  ];

  for (const driftPath of receiptPaths) {
    await t.test(driftPath, async () => {
      await assert.rejects(
        checker.checkPursuitGoldenGeneratedArtifacts({
          readArtifact: artifactReader(contents, (relativePath, value) => (
            relativePath === driftPath ? `${value} ` : value
          )),
        }),
        (error) => error?.code === 'GOLDEN_GENERATED_ARTIFACT_DRIFT'
          && error?.relativePath === driftPath,
      );
    });
  }
});

test('candidate-additions envelope drift fails before generated expectations are accepted', async () => {
  const checker = await loadChecker();
  const candidateAdditionsPath =
    'knowledge/golden-dataset/datacenter-kr-v1/public-source-candidate-additions.json';

  await assert.rejects(
    checker.buildExpectedGoldenGeneratedArtifacts({
      readGoldenJson: async (relativePath) => {
        const value = JSON.parse(await fsPromises.readFile(
          join(process.cwd(), relativePath),
          'utf8',
        ));
        return relativePath === candidateAdditionsPath
          ? { ...value, boundary: 'DRIFTED_BOUNDARY' }
          : value;
      },
    }),
    (error) => error?.code === 'GOLDEN_GENERATED_ARTIFACT_EXPECTED_INVALID'
      && error?.relativePath === 'tmp/codex/pursuit-golden-human-review-batch-02.json',
  );
});

test('one-byte canonical drift fails closed with the exact artifact path', async () => {
  const checker = await loadChecker();
  const contents = new Map(
    checker.GOLDEN_GENERATED_ARTIFACT_PATHS.map((relativePath) => [
      relativePath,
      readFileSync(join(process.cwd(), relativePath), 'utf8'),
    ]),
  );
  const driftPath = 'docs/roadmap/pursuit-golden-human-review-batch-02-proposal.md';

  await assert.rejects(
    checker.checkPursuitGoldenGeneratedArtifacts({
      readArtifact: artifactReader(contents, (relativePath, value) => (
        relativePath === driftPath ? `${value} ` : value
      )),
    }),
    (error) => error?.code === 'GOLDEN_GENERATED_ARTIFACT_DRIFT'
      && error?.relativePath === driftPath,
  );
});

test('missing artifact fails closed with the exact missing path', async () => {
  const checker = await loadChecker();
  const missingPath = 'tmp/codex/pursuit-golden-human-review-batch-02.json';

  await assert.rejects(
    checker.checkPursuitGoldenGeneratedArtifacts({
      readArtifact: async ({ relativePath, absolutePath, encoding }) => {
        if (relativePath === missingPath) {
          const error = new Error('synthetic missing artifact');
          error.code = 'ENOENT';
          throw error;
        }
        return require('node:fs').promises.readFile(absolutePath, encoding);
      },
    }),
    (error) => error?.code === 'GOLDEN_GENERATED_ARTIFACT_MISSING'
      && error?.relativePath === missingPath,
  );
});

test('invalid JSON fails closed before byte comparison with the exact artifact path', async () => {
  const checker = await loadChecker();
  const invalidPath = 'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json';

  await assert.rejects(
    checker.checkPursuitGoldenGeneratedArtifacts({
      readArtifact: async ({ relativePath, absolutePath, encoding }) => {
        if (relativePath === invalidPath) return '{';
        return require('node:fs').promises.readFile(absolutePath, encoding);
      },
    }),
    (error) => error?.code === 'GOLDEN_GENERATED_ARTIFACT_INVALID'
      && error?.relativePath === invalidPath,
  );
});
