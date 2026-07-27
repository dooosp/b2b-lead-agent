const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = join(__dirname, '..');
const HELPER_URL = pathToFileURL(join(
  ROOT,
  'scripts/lib/repository-artifact-output.mjs',
));

const OUTPUT_FLAGS = [
  {
    script: 'scripts/audit-pursuit-golden-dataset.mjs',
    flag: '--output',
    allowed: 'tmp/codex/pursuit-golden-dataset-audit-non-production.json',
    other: 'tmp/codex/pursuit-golden-human-review-batch-01.json',
  },
  {
    script: 'scripts/evaluate-pursuit-twin-v0.mjs',
    flag: '--output',
    allowed: 'tmp/codex/pursuit-twin-v0-evaluation-non-production.json',
    other: 'tmp/codex/pursuit-twin-v0-review-packet-non-production.json',
  },
  {
    script: 'scripts/evaluate-pursuit-twin-v0.mjs',
    flag: '--packet-json',
    allowed: 'tmp/codex/pursuit-twin-v0-review-packet-non-production.json',
    other: 'tmp/codex/pursuit-twin-v0-evaluation-non-production.json',
  },
  {
    script: 'scripts/evaluate-pursuit-twin-v0.mjs',
    flag: '--packet-markdown',
    allowed: 'tmp/codex/pursuit-twin-v0-review-packet-non-production.md',
    other: 'tmp/codex/pursuit-twin-v0-review-packet-non-production.json',
  },
  {
    script: 'scripts/prepare-pursuit-golden-human-review.mjs',
    flag: '--output',
    allowed: 'tmp/codex/pursuit-golden-human-review-batch-01.json',
    other: 'tmp/codex/pursuit-golden-human-review-batch-02.json',
  },
  {
    script: 'scripts/prepare-pursuit-golden-human-review-batch-02.mjs',
    flag: '--output',
    allowed: 'tmp/codex/pursuit-golden-human-review-batch-02.json',
    other: 'tmp/codex/pursuit-golden-human-review-batch-01.json',
  },
  {
    script: 'scripts/prepare-pursuit-golden-human-review-proposal.mjs',
    flag: '--output',
    allowed: 'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json',
    other: 'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json',
  },
  {
    script: 'scripts/prepare-pursuit-golden-human-review-proposal.mjs',
    flag: '--markdown-output',
    allowed: 'docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md',
    other: 'docs/roadmap/pursuit-golden-human-review-batch-02-proposal.md',
  },
  {
    script: 'scripts/prepare-pursuit-golden-human-review-proposal-02.mjs',
    flag: '--output',
    allowed: 'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json',
    other: 'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json',
  },
  {
    script: 'scripts/prepare-pursuit-golden-human-review-proposal-02.mjs',
    flag: '--markdown-output',
    allowed: 'docs/roadmap/pursuit-golden-human-review-batch-02-proposal.md',
    other: 'docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md',
  },
];

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function traversedEquivalent(path) {
  const [first, ...rest] = path.split('/');
  return [first, '..', first, ...rest].join('/');
}

test('artifact-producing Pursuit CLIs reject absolute, traversal, and cross-artifact paths', async (t) => {
  for (const item of OUTPUT_FLAGS) {
    await t.test(`${item.script} ${item.flag}`, () => {
      const absolute = join(tmpdir(), `pursuit-artifact-refused-${process.pid}`);
      const absoluteResult = run(item.script, [item.flag, absolute]);
      assert.notEqual(absoluteResult.status, 0);
      assert.match(absoluteResult.stderr, /ARTIFACT_OUTPUT_ABSOLUTE_REFUSED/);

      const traversalResult = run(item.script, [
        item.flag,
        traversedEquivalent(item.allowed),
      ]);
      assert.notEqual(traversalResult.status, 0);
      assert.match(traversalResult.stderr, /ARTIFACT_OUTPUT_TRAVERSAL_REFUSED/);

      const crossArtifactResult = run(item.script, [item.flag, item.other]);
      assert.notEqual(crossArtifactResult.status, 0);
      assert.match(crossArtifactResult.stderr, /ARTIFACT_OUTPUT_PATH_NOT_ALLOWLISTED/);
    });
  }
});

test('artifact output resolver rejects traversal even when normalization returns to the allowlist', async () => {
  const { resolveApprovedArtifactOutput } = await import(HELPER_URL.href);
  const repositoryRoot = mkdtempSync(join(tmpdir(), 'pursuit-artifact-resolve-'));
  try {
    assert.throws(
      () => resolveApprovedArtifactOutput(
        'tmp/codex/../codex/allowed.json',
        'tmp/codex/allowed.json',
        { repositoryRoot },
      ),
      (error) => error?.code === 'ARTIFACT_OUTPUT_TRAVERSAL_REFUSED',
    );
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test('artifact writer atomically replaces regular files and refuses symlink/non-regular targets', async () => {
  const {
    resolveApprovedArtifactOutput,
    writeApprovedArtifactOutput,
  } = await import(HELPER_URL.href);
  const repositoryRoot = mkdtempSync(join(tmpdir(), 'pursuit-artifact-write-'));
  const artifactDirectory = join(repositoryRoot, 'tmp', 'codex');
  const allowed = 'tmp/codex/allowed.json';
  const destination = join(repositoryRoot, allowed);
  mkdirSync(artifactDirectory, { recursive: true });
  try {
    const resolved = resolveApprovedArtifactOutput(allowed, allowed, { repositoryRoot });
    await writeApprovedArtifactOutput(resolved, 'first\n', { repositoryRoot });
    const unchangedBefore = statSync(destination, { bigint: true });
    await writeApprovedArtifactOutput(resolved, 'first\n', { repositoryRoot });
    const unchangedAfter = statSync(destination, { bigint: true });
    assert.equal(unchangedAfter.ino, unchangedBefore.ino);
    assert.equal(unchangedAfter.mtimeNs, unchangedBefore.mtimeNs);

    await writeApprovedArtifactOutput(resolved, 'second\n', { repositoryRoot });
    assert.equal(readFileSync(destination, 'utf8'), 'second\n');

    rmSync(destination);
    const external = join(repositoryRoot, 'external.txt');
    writeFileSync(external, 'outside\n');
    symlinkSync(external, destination);
    await assert.rejects(
      writeApprovedArtifactOutput(resolved, 'forbidden\n', { repositoryRoot }),
      (error) => error?.code === 'ARTIFACT_OUTPUT_TARGET_SYMLINK_REFUSED',
    );
    assert.equal(readFileSync(external, 'utf8'), 'outside\n');

    rmSync(destination);
    mkdirSync(destination);
    await assert.rejects(
      writeApprovedArtifactOutput(resolved, 'forbidden\n', { repositoryRoot }),
      (error) => error?.code === 'ARTIFACT_OUTPUT_TARGET_NON_REGULAR_REFUSED',
    );
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test('artifact writer refuses an allowlisted path through a symlinked parent directory', async () => {
  const {
    resolveApprovedArtifactOutput,
    writeApprovedArtifactOutput,
  } = await import(HELPER_URL.href);
  const repositoryRoot = mkdtempSync(join(tmpdir(), 'pursuit-artifact-parent-'));
  const externalDirectory = mkdtempSync(join(tmpdir(), 'pursuit-artifact-external-'));
  mkdirSync(join(repositoryRoot, 'tmp'));
  symlinkSync(externalDirectory, join(repositoryRoot, 'tmp', 'codex'));
  try {
    const allowed = 'tmp/codex/allowed.json';
    const resolved = resolveApprovedArtifactOutput(allowed, allowed, { repositoryRoot });
    await assert.rejects(
      writeApprovedArtifactOutput(resolved, 'forbidden\n', { repositoryRoot }),
      (error) => error?.code === 'ARTIFACT_OUTPUT_DIRECTORY_UNSAFE',
    );
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
    rmSync(externalDirectory, { recursive: true, force: true });
  }
});
