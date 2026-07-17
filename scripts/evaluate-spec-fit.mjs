#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { evaluateSpecFitSuite } from '../eval/spec-fit-evaluator.mjs';
import { canonicalStringify, sha256 } from '../knowledge/claim-registry/index.mjs';
import { loadEvidenceDomainInputs, REPO_ROOT } from './lib/repository-claim-registry.mjs';
import { validateSpecFitEvaluationReport } from './lib/claim-spec-report-validation.mjs';

function parseOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

const inputs = await loadEvidenceDomainInputs();
const first = evaluateSpecFitSuite(inputs);
const repeat = Number(parseOption('--repeat') || 1);
for (let index = 1; index < repeat; index += 1) {
  const next = evaluateSpecFitSuite(inputs);
  if (canonicalStringify(first) !== canonicalStringify(next)) throw new Error('SPEC_FIT_REPEAT_NONDETERMINISTIC');
}
const { fixtureDossier, ...canonicalReport } = first;
const report = { ...canonicalReport, canonicalSha256: sha256(canonicalStringify(canonicalReport)) };
validateSpecFitEvaluationReport(report);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
const output = parseOption('--output');
if (output) {
  const path = resolve(REPO_ROOT, output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serialized, 'utf8');
}
const dossierJson = parseOption('--dossier-json');
if (dossierJson) {
  const path = resolve(REPO_ROOT, dossierJson);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, fixtureDossier.json, 'utf8');
}
const dossierMarkdown = parseOption('--dossier-markdown');
if (dossierMarkdown) {
  const path = resolve(REPO_ROOT, dossierMarkdown);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, fixtureDossier.markdown, 'utf8');
}
process.stdout.write(serialized);
const summary = report.summary;
if (
  summary.expectedResultAccuracyBasisPoints !== 10_000
  || summary.fitTraceabilityBasisPoints !== 10_000
  || summary.repeatHashEqualityBasisPoints !== 10_000
  || summary.hardMismatchAccuracyBasisPoints !== 10_000
  || summary.missingRequirementRecallBasisPoints !== 10_000
  || summary.conflictDetectionBasisPoints !== 10_000
  || summary.stageWindowAccuracyBasisPoints !== 10_000
  || summary.unverifiedCustomerClaimLeakage !== 0
  || summary.secretLeakage !== 0
) process.exitCode = 1;
