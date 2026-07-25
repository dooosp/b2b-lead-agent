import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

export function writeJsonArtifact(outputPath, value) {
  if (!outputPath) return;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}

function withoutIgnoredTopLevelKeys(value, ignoredTopLevelKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const ignored = new Set(ignoredTopLevelKeys);
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !ignored.has(key))
  );
}

function isSafeIgnoredValue(key, value) {
  if (key !== 'generatedAt') return true;
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

export function writeJsonArtifactIfMateriallyChanged(
  outputPath,
  value,
  { ignoredTopLevelKeys = ['generatedAt'] } = {}
) {
  if (!outputPath) {
    return { written: false, reason: 'no_output_path', artifact: value };
  }

  try {
    const existing = JSON.parse(readFileSync(outputPath, 'utf8'));
    const canIgnoreTopLevelKeys = ignoredTopLevelKeys.every((key) => (
      Object.prototype.hasOwnProperty.call(existing, key)
      && Object.prototype.hasOwnProperty.call(value, key)
      && isSafeIgnoredValue(key, existing[key])
      && isSafeIgnoredValue(key, value[key])
    ));
    const existingMaterial = canIgnoreTopLevelKeys
      ? withoutIgnoredTopLevelKeys(existing, ignoredTopLevelKeys)
      : existing;
    const nextMaterial = canIgnoreTopLevelKeys
      ? withoutIgnoredTopLevelKeys(value, ignoredTopLevelKeys)
      : value;

    if (isDeepStrictEqual(existingMaterial, nextMaterial)) {
      return {
        written: false,
        reason: 'materially_unchanged',
        artifact: existing,
      };
    }
  } catch {
    // Missing or invalid artifacts are replaced by the freshly evaluated value.
  }

  writeJsonArtifact(outputPath, value);
  return {
    written: true,
    reason: 'materially_changed_or_missing',
    artifact: value,
  };
}

export function isDirectCliRun(importMetaUrl, argv = process.argv) {
  if (!argv[1]) return false;
  return importMetaUrl === pathToFileURL(argv[1]).href;
}
