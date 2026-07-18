#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEvidenceInbox } from '../evidence-claim-workbench/domain/intake.mjs';
import {
  evaluateVariantTableEvidence,
  readFixedVariantTableEvidenceSpec,
  summarizeVariantTableEvidence
} from '../evidence-claim-workbench/experiments/variant-table-evidence.mjs';

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function parseVariantTableSpikeArguments(argv) {
  let asOf = '';
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json' && !json) {
      json = true;
      continue;
    }
    if (argument === '--as-of' && !asOf && typeof argv[index + 1] === 'string') {
      asOf = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error('UNSUPPORTED_VARIANT_TABLE_SPIKE_ARGUMENT');
  }
  if (!json) throw new Error('JSON_OUTPUT_REQUIRED');
  const parsed = new Date(asOf);
  if (!asOf || !Number.isFinite(parsed.getTime()) || parsed.toISOString() !== asOf) {
    throw new Error('FIXED_AS_OF_REQUIRED');
  }
  return { asOf, json: true };
}

export async function runVariantTableEvidenceSpike({ ownedRoot = REPOSITORY_ROOT, asOf }) {
  const [intake, spec] = await Promise.all([
    loadEvidenceInbox({ ownedRoot, asOf }),
    readFixedVariantTableEvidenceSpec({ ownedRoot })
  ]);
  return summarizeVariantTableEvidence(evaluateVariantTableEvidence({
    documents: intake.catalog.documents,
    spec
  }));
}

async function main() {
  try {
    const options = parseVariantTableSpikeArguments(process.argv.slice(2));
    const summary = await runVariantTableEvidenceSpike(options);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } catch (error) {
    const failure = {
      schemaVersion: 'variant-table-evidence-spike-cli-failure-v0',
      boundary: 'NOT_PRODUCTION_EVIDENCE',
      productionReady: false,
      status: 'REFUSED',
      errorCode: typeof error?.code === 'string' ? error.code : error?.message || 'UNKNOWN_ERROR',
      errorPath: typeof error?.path === 'string' ? error.path : '$'
    };
    process.stderr.write(`${JSON.stringify(failure)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
