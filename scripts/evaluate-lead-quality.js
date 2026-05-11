#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {
  assertSyntheticLeadSet,
  evaluateLeadQualitySet,
  formatLeadQualityReport,
} = require('../eval/lead-quality-evaluator');
const { syntheticLeadFixtures } = require('../eval/fixtures/synthetic-leads');

const repoRoot = path.resolve(__dirname, '..');

function printUsage() {
  console.log(`Usage: node scripts/evaluate-lead-quality.js [--fixtures] [--input <path>] [--json] [--fail-on-hold] [--now <iso-date>] [--stale-after-days <days>]

Local-only lead quality evaluation.

Options:
  --fixtures                 Evaluate the built-in synthetic fixture set (default).
  --input <path>             Evaluate a local synthetic JSON file. URLs and reports/ artifacts are rejected.
  --json                     Print machine-readable JSON.
  --fail-on-hold             Exit non-zero when any evaluated lead is HOLD.
  --now <iso-date>           Override the evaluation clock.
  --stale-after-days <days>  Override stale-source threshold. Default: 90.
  --help                     Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    useFixtures: true,
    inputPath: '',
    json: false,
    failOnHold: false,
    now: '',
    staleAfterDays: 90,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--fixtures') {
      options.useFixtures = true;
      options.inputPath = '';
    } else if (arg === '--input') {
      options.inputPath = argv[index + 1] || '';
      options.useFixtures = false;
      index += 1;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--fail-on-hold') {
      options.failOnHold = true;
    } else if (arg === '--now') {
      options.now = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--stale-after-days') {
      options.staleAfterDays = Number(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(options.staleAfterDays) || options.staleAfterDays <= 0) {
    throw new Error('--stale-after-days must be a positive number.');
  }

  return options;
}

function rejectUnsafeInputPath(inputPath) {
  const value = String(inputPath || '').trim();
  if (!value) throw new Error('--input requires a local file path.');
  if (/^https?:\/\//i.test(value)) {
    throw new Error('Remote URLs are not allowed. Use a local synthetic fixture file.');
  }

  const absolutePath = path.resolve(process.cwd(), value);
  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
  const basename = path.basename(absolutePath);
  if (relativePath.startsWith('reports/') || /^(latest-leads|lead-history)\.json$/i.test(basename) || /^lead-report-\d{4}-\d{2}-\d{2}\.md$/i.test(basename)) {
    throw new Error('Production report artifacts are not allowed as lead quality evaluation input.');
  }

  return absolutePath;
}

function readLeadInput(inputPath) {
  const absolutePath = rejectUnsafeInputPath(inputPath);
  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.leads)) return parsed.leads;
  throw new Error('Input JSON must be an array of synthetic leads or an object with a leads array.');
}

function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printUsage();
    return 0;
  }

  const leads = options.useFixtures ? syntheticLeadFixtures : readLeadInput(options.inputPath);
  assertSyntheticLeadSet(leads);

  const report = evaluateLeadQualitySet(leads, {
    now: options.now || undefined,
    staleAfterDays: options.staleAfterDays,
  });

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatLeadQualityReport(report));
  }

  return options.failOnHold && report.summary.hold > 0 ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  readLeadInput,
  rejectUnsafeInputPath,
  run,
};
