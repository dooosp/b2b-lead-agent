const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readFileSync,
  statSync,
} = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

function moduleUrl(relativePath) {
  return pathToFileURL(join(process.cwd(), relativePath));
}

async function loadChecker() {
  return import(moduleUrl(
    'scripts/check-pursuit-value-pilot-generated-artifacts.mjs',
  ));
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

test('live Pilot generation is deterministic for the exact two canonical artifacts', async () => {
  const checker = await loadChecker();
  const first = await checker.buildExpectedPursuitValuePilotGeneratedArtifacts();
  const second = await checker.buildExpectedPursuitValuePilotGeneratedArtifacts();

  assert.deepEqual(
    first.map((entry) => entry.relativePath),
    checker.PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS,
  );
  assert.deepEqual(
    first.map((entry) => [entry.relativePath, entry.expectedContent]),
    second.map((entry) => [entry.relativePath, entry.expectedContent]),
  );
  assert.ok(first.every((entry) => entry.expectedContent.endsWith('\n')));
});

test('current Pilot canonical artifacts pass without filesystem mutation', async () => {
  const checker = await loadChecker();
  const before = snapshot(checker.PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS);

  const result = await checker.checkPursuitValuePilotGeneratedArtifacts();
  const after = snapshot(checker.PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS);

  assert.deepEqual(result, {
    documentStatus: 'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_DRIFT_CHECK_PASS',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    checkedArtifactCount: 2,
    checkedPaths: [...checker.PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS],
  });
  assert.deepEqual(after, before);
});

test('protocol and readiness artifacts each fail closed on one-byte drift', async (t) => {
  const checker = await loadChecker();
  const contents = new Map(
    checker.PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS.map((relativePath) => [
      relativePath,
      readFileSync(join(process.cwd(), relativePath), 'utf8'),
    ]),
  );

  for (const driftPath of checker.PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS) {
    await t.test(driftPath, async () => {
      await assert.rejects(
        checker.checkPursuitValuePilotGeneratedArtifacts({
          readArtifact: artifactReader(contents, (relativePath, value) => (
            relativePath === driftPath ? `${value} ` : value
          )),
        }),
        (error) => (
          error?.code === 'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_DRIFT'
          && error?.relativePath === driftPath
        ),
      );
    });
  }
});
