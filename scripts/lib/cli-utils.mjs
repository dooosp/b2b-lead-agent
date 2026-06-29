import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

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

export function isDirectCliRun(importMetaUrl, argv = process.argv) {
  if (!argv[1]) return false;
  return importMetaUrl === pathToFileURL(argv[1]).href;
}
