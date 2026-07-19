import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

async function assertExistingDestinationIsSafe(destinationPath) {
  try {
    const stat = await lstat(destinationPath);
    assert(!stat.isSymbolicLink(), '--output refuses an existing symbolic link');
    assert(stat.isFile(), '--output refuses an existing non-regular file');
    assert(stat.nlink === 1, '--output refuses an existing multi-link file');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function ensureParentPathSafely(rootRealPath, lexicalParentPath) {
  const relative = path.relative(rootRealPath, lexicalParentPath);
  assert(relative !== '..' && !relative.startsWith(`..${path.sep}`), '--output parent must remain inside this worktree');
  let currentPath = rootRealPath;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment);
    let stat;
    try {
      stat = await lstat(currentPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      try {
        await mkdir(currentPath, { mode: 0o755 });
      } catch (mkdirError) {
        if (mkdirError?.code !== 'EEXIST') throw mkdirError;
      }
      stat = await lstat(currentPath);
    }
    assert(!stat.isSymbolicLink(), '--output parent path refuses symbolic links');
    assert(stat.isDirectory(), '--output parent path must contain directories only');
  }
}

export async function writeJsonArtifactInsideWorktree({
  worktreeRoot = process.cwd(),
  outputPath,
  value,
}) {
  const lexicalRootPath = path.resolve(worktreeRoot);
  const rootRealPath = await realpath(worktreeRoot);
  const lexicalOutputPath = path.resolve(outputPath);
  const lexicalRelative = path.relative(lexicalRootPath, lexicalOutputPath);
  assert(
    lexicalRelative !== ''
      && lexicalRelative !== '..'
      && !lexicalRelative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(lexicalRelative),
    '--output must remain inside this worktree',
  );

  const canonicalOutputPath = path.join(rootRealPath, lexicalRelative);
  await ensureParentPathSafely(rootRealPath, path.dirname(canonicalOutputPath));
  const parentRealPath = await realpath(path.dirname(canonicalOutputPath));
  assert(isInside(rootRealPath, parentRealPath), '--output parent must remain inside this worktree');

  const destinationPath = path.join(parentRealPath, path.basename(lexicalOutputPath));
  await assertExistingDestinationIsSafe(destinationPath);

  const temporaryPath = path.join(
    parentRealPath,
    `.${path.basename(destinationPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  let handle;
  try {
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o644,
    );
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, destinationPath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }

  return destinationPath;
}
