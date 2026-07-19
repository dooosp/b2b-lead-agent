import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { writeJsonArtifactInsideWorktree } from '../scripts/lib/safe-local-artifact-writer.mjs';

async function withTemporaryRoots(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'pilot-artifact-root-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'pilot-artifact-outside-'));
  try {
    await run({ root, outside });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
}

test('writes and atomically replaces a regular single-link JSON artifact', async () => {
  await withTemporaryRoots(async ({ root }) => {
    const outputPath = path.join(root, 'tmp', 'artifact.json');
    await writeJsonArtifactInsideWorktree({ worktreeRoot: root, outputPath, value: { run: 1 } });
    await writeJsonArtifactInsideWorktree({ worktreeRoot: root, outputPath, value: { run: 2 } });
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), { run: 2 });
  });
});

test('refuses an existing symbolic-link destination', async () => {
  await withTemporaryRoots(async ({ root, outside }) => {
    const parent = path.join(root, 'tmp');
    const outsideFile = path.join(outside, 'outside.json');
    const outputPath = path.join(parent, 'artifact.json');
    await mkdir(parent);
    await writeFile(outsideFile, 'unchanged\n');
    await symlink(outsideFile, outputPath);
    await assert.rejects(
      writeJsonArtifactInsideWorktree({ worktreeRoot: root, outputPath, value: { unsafe: true } }),
      /symbolic link/,
    );
    assert.equal(await readFile(outsideFile, 'utf8'), 'unchanged\n');
  });
});

test('refuses an existing multi-link destination', async () => {
  await withTemporaryRoots(async ({ root }) => {
    const parent = path.join(root, 'tmp');
    const original = path.join(parent, 'original.json');
    const outputPath = path.join(parent, 'artifact.json');
    await mkdir(parent);
    await writeFile(original, 'unchanged\n');
    await link(original, outputPath);
    await assert.rejects(
      writeJsonArtifactInsideWorktree({ worktreeRoot: root, outputPath, value: { unsafe: true } }),
      /multi-link/,
    );
    assert.equal(await readFile(original, 'utf8'), 'unchanged\n');
  });
});

test('refuses a symbolic-link parent even when the lexical output is inside the worktree', async () => {
  await withTemporaryRoots(async ({ root, outside }) => {
    const linkedParent = path.join(root, 'linked');
    await symlink(outside, linkedParent);
    await assert.rejects(
      writeJsonArtifactInsideWorktree({
        worktreeRoot: root,
        outputPath: path.join(linkedParent, 'artifact.json'),
        value: { unsafe: true },
      }),
      /parent path refuses symbolic links/,
    );
  });
});

test('refuses a nested path below a symbolic-link parent without creating an outside directory', async () => {
  await withTemporaryRoots(async ({ root, outside }) => {
    const linkedParent = path.join(root, 'linked');
    const outsideNested = path.join(outside, 'must-not-exist');
    await symlink(outside, linkedParent);
    await assert.rejects(
      writeJsonArtifactInsideWorktree({
        worktreeRoot: root,
        outputPath: path.join(linkedParent, 'must-not-exist', 'artifact.json'),
        value: { unsafe: true },
      }),
      /parent path refuses symbolic links/,
    );
    await assert.rejects(readFile(outsideNested), (error) => error?.code === 'ENOENT');
  });
});
