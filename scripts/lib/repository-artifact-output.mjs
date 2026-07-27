import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  lstat,
  open,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
  win32,
} from 'node:path';

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function containsTraversal(path) {
  return path.split(/[\\/]+/u).includes('..');
}

function repositoryRelativePath(repositoryRoot, path) {
  const fromRoot = relative(repositoryRoot, path);
  if (
    !fromRoot
    || fromRoot === '..'
    || fromRoot.startsWith(`..${sep}`)
    || isAbsolute(fromRoot)
  ) fail('ARTIFACT_OUTPUT_OUTSIDE_REPOSITORY_REFUSED');
  return fromRoot;
}

export function resolveApprovedArtifactOutput(
  requestedPath,
  allowedRelativePath,
  { repositoryRoot } = {},
) {
  if (!requestedPath) return null;
  if (typeof requestedPath !== 'string' || typeof allowedRelativePath !== 'string') {
    fail('ARTIFACT_OUTPUT_PATH_INVALID');
  }
  if (!repositoryRoot || typeof repositoryRoot !== 'string') {
    fail('ARTIFACT_OUTPUT_REPOSITORY_ROOT_INVALID');
  }
  if (isAbsolute(requestedPath) || win32.isAbsolute(requestedPath)) {
    fail('ARTIFACT_OUTPUT_ABSOLUTE_REFUSED', requestedPath);
  }
  if (containsTraversal(requestedPath)) {
    fail('ARTIFACT_OUTPUT_TRAVERSAL_REFUSED', requestedPath);
  }

  const destination = resolve(repositoryRoot, requestedPath);
  const repoRelative = repositoryRelativePath(repositoryRoot, destination)
    .split(sep)
    .join('/');
  if (repoRelative !== allowedRelativePath) {
    fail('ARTIFACT_OUTPUT_PATH_NOT_ALLOWLISTED', requestedPath);
  }
  return destination;
}

async function assertSafeArtifactDirectory(destination, repositoryRoot) {
  const directory = dirname(destination);
  let directoryStat;
  try {
    directoryStat = await lstat(directory);
  } catch {
    fail('ARTIFACT_OUTPUT_DIRECTORY_UNSAFE', directory);
  }
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    fail('ARTIFACT_OUTPUT_DIRECTORY_UNSAFE', directory);
  }

  let canonicalRoot;
  let canonicalDirectory;
  try {
    [canonicalRoot, canonicalDirectory] = await Promise.all([
      realpath(repositoryRoot),
      realpath(directory),
    ]);
  } catch {
    fail('ARTIFACT_OUTPUT_DIRECTORY_UNSAFE', directory);
  }
  const directoryRelative = repositoryRelativePath(repositoryRoot, directory);
  if (canonicalDirectory !== resolve(canonicalRoot, directoryRelative)) {
    fail('ARTIFACT_OUTPUT_DIRECTORY_UNSAFE', directory);
  }
  return directory;
}

async function assertSafeExistingTarget(destination) {
  let stat;
  try {
    stat = await lstat(destination, { bigint: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('ARTIFACT_OUTPUT_TARGET_INSPECTION_FAILED', destination);
  }
  if (stat.isSymbolicLink()) {
    fail('ARTIFACT_OUTPUT_TARGET_SYMLINK_REFUSED', destination);
  }
  if (!stat.isFile()) {
    fail('ARTIFACT_OUTPUT_TARGET_NON_REGULAR_REFUSED', destination);
  }
  return stat;
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileState(left, right) {
  return sameFile(left, right)
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

async function existingTargetMatches(destination, contents, noFollow) {
  const before = await assertSafeExistingTarget(destination);
  if (!before) return false;

  let handle;
  try {
    try {
      handle = await open(destination, constants.O_RDONLY | noFollow);
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(before, opened)) {
      fail('ARTIFACT_OUTPUT_TARGET_CHANGED_DURING_INSPECTION', destination);
    }
    const actual = await handle.readFile();
    const after = await assertSafeExistingTarget(destination);
    if (!after || !sameFileState(opened, after)) {
      fail('ARTIFACT_OUTPUT_TARGET_CHANGED_DURING_INSPECTION', destination);
    }
    const expected = Buffer.isBuffer(contents)
      ? contents
      : Buffer.from(contents, 'utf8');
    return actual.equals(expected);
  } finally {
    if (handle) {
      try { await handle.close(); } catch {}
    }
  }
}

async function unlinkIfPresent(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export async function writeApprovedArtifactOutput(
  destination,
  contents,
  { repositoryRoot } = {},
) {
  if (!destination) return;
  if (!repositoryRoot || typeof repositoryRoot !== 'string') {
    fail('ARTIFACT_OUTPUT_REPOSITORY_ROOT_INVALID');
  }
  repositoryRelativePath(repositoryRoot, destination);
  const directory = await assertSafeArtifactDirectory(destination, repositoryRoot);
  const noFollow = constants.O_NOFOLLOW;
  if (!Number.isInteger(noFollow)) fail('ARTIFACT_OUTPUT_NOFOLLOW_UNAVAILABLE');
  if (await existingTargetMatches(destination, contents, noFollow)) return;

  const temporary = resolve(
    directory,
    `.${basename(destination)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  let temporaryCreated = false;
  try {
    handle = await open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
      0o600,
    );
    temporaryCreated = true;
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1) {
      fail('ARTIFACT_OUTPUT_TEMPORARY_UNSAFE', temporary);
    }
    await handle.chmod(0o644);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;

    await assertSafeExistingTarget(destination);
    await rename(temporary, destination);
    temporaryCreated = false;
  } finally {
    if (handle) {
      try { await handle.close(); } catch {}
    }
    if (temporaryCreated) {
      try { await unlinkIfPresent(temporary); } catch {}
    }
  }
}
