#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SECURITY_DEPENDENCY_AUDIT_TRIAGE_OUTPUT_PATH =
  'tmp/codex/security-dependency-audit-triage-non-production.json';

export const AXIOS_PATCHED_MINIMUM_VERSION = '1.16.0';

const AXIOS_ADVISORIES = Object.freeze([
  {
    source: 1119667,
    url: 'https://github.com/advisories/GHSA-pjwm-pj3p-43mv',
    severity: 'high',
    range: '>=1.0.0 <1.16.0',
    title:
      "axios shouldBypassProxy does not recognize IPv4-mapped IPv6 addresses, allowing NO_PROXY bypass",
  },
  {
    source: 1119669,
    url: 'https://github.com/advisories/GHSA-898c-q2cr-xwhg',
    severity: 'moderate',
    range: '>=1.0.0 <1.16.0',
    title:
      'axios has DoS and Header Injection via Prototype Pollution Read-Side Gadgets in merge functions',
  },
  {
    source: 1119670,
    url: 'https://github.com/advisories/GHSA-654m-c8p4-x5fp',
    severity: 'low',
    range: '=1.15.2',
    title:
      'Axios Proxy-Authorization Header Injection via Prototype Pollution incomplete null-prototype fix',
  },
  {
    source: 1119675,
    url: 'https://github.com/advisories/GHSA-35jp-ww65-95wh',
    severity: 'high',
    range: '>=1.0.0 <1.16.0',
    title:
      'axios vulnerable to full man-in-the-middle via Prototype Pollution gadget in config.proxy',
  },
]);

function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

export function extractMinimumVersion(spec) {
  const match = String(spec || '').match(/\d+\.\d+\.\d+/);
  return match ? match[0] : '';
}

export function compareVersions(left, right) {
  const leftParts = String(left || '').split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = String(right || '').split('.').map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < 3; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

function isAtLeast(version, minimum) {
  return compareVersions(version, minimum) >= 0;
}

function buildBlocker(reason, detail = {}) {
  return {
    reason,
    status: 'HOLD',
    ...detail,
  };
}

export function evaluateSecurityDependencyAuditTriage(input = {}) {
  const packageJsonPath = input.packageJsonPath || 'package.json';
  const packageLockPath = input.packageLockPath || 'package-lock.json';
  const packageJson = input.packageJson || readJson(packageJsonPath);
  const packageLock = input.packageLock || readJson(packageLockPath);
  const generatedAt = input.generatedAt || new Date().toISOString();
  const rootLock = packageLock.packages?.[''] || {};
  const axiosLock = packageLock.packages?.['node_modules/axios'] || null;
  const directProdSpec = packageJson.dependencies?.axios || rootLock.dependencies?.axios || '';
  const directDevSpec = packageJson.devDependencies?.axios || rootLock.devDependencies?.axios || '';
  const manifestMinimum = extractMinimumVersion(directProdSpec);
  const lockedVersion = axiosLock?.version || '';
  const blockers = [];

  if (!directProdSpec) {
    blockers.push(buildBlocker('axios_not_declared_as_direct_production_dependency'));
  }
  if (directDevSpec) {
    blockers.push(buildBlocker('axios_unexpected_dev_dependency_scope', { spec: directDevSpec }));
  }
  if (!manifestMinimum || !isAtLeast(manifestMinimum, AXIOS_PATCHED_MINIMUM_VERSION)) {
    blockers.push(buildBlocker('axios_manifest_floor_below_patched_minimum', {
      manifestSpec: directProdSpec,
      patchedMinimum: AXIOS_PATCHED_MINIMUM_VERSION,
    }));
  }
  if (!lockedVersion || !isAtLeast(lockedVersion, AXIOS_PATCHED_MINIMUM_VERSION)) {
    blockers.push(buildBlocker('axios_lock_below_patched_minimum', {
      lockedVersion,
      patchedMinimum: AXIOS_PATCHED_MINIMUM_VERSION,
    }));
  }

  const status = blockers.length === 0 ? 'PASS_LOCAL_PATCHED' : 'HOLD_REQUIRES_TRIAGE';

  return {
    ok: blockers.length === 0,
    schemaVersion: 'security.dependency_audit_triage.v1',
    documentStatus: 'SECURITY_DEPENDENCY_AUDIT_TRIAGE_NON_PRODUCTION',
    generatedAt,
    repo: 'dooosp/b2b-lead-agent',
    packageJsonPath,
    packageLockPath,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issueRefs: {
      level1ProofHold: 'https://github.com/dooosp/b2b-lead-agent/issues/165',
    },
    finding: {
      packageName: 'axios',
      directDependency: hasOwn(packageJson.dependencies, 'axios'),
      devOnly: false,
      prodScope: true,
      manifestSpec: directProdSpec,
      manifestMinimum,
      lockedVersion,
      patchedMinimum: AXIOS_PATCHED_MINIMUM_VERSION,
      lockDependencies: axiosLock?.dependencies || {},
      baselineSeverity: 'high',
      baselineAuditCommands: [
        'npm audit --json',
        'npm audit --omit=dev --json',
      ],
      advisories: AXIOS_ADVISORIES,
    },
    reachability: {
      rootRuntimePipeline: true,
      workerRuntimeEntrypoint: false,
      affectedFiles: [
        'enricher/article-content-scraper.js',
        'enricher/article-url-resolver.js',
      ],
      affectedScriptsAndWorkflows: [
        'npm start',
        'npm run email',
        '.github/workflows/generate-report.yml node main.js --profile "$PROFILE" --email',
      ],
      exploitSurface:
        'Outbound HTTP GET requests for public article and DuckDuckGo HTML lookup URLs in the root lead-generation pipeline.',
    },
    decision: {
      status,
      action: status === 'PASS_LOCAL_PATCHED'
        ? 'PATCHED_WITH_SCOPED_AXIOS_1_16_0_UPDATE'
        : 'HOLD_UNTIL_AXIOS_PATCHED_MINIMUM_RESTORED',
      riskOwner: '@dooosp / Taeho Jang',
      followUp:
        'Keep npm audit in local validation and keep this scoped offline gate in CI for the known axios advisory floor.',
    },
    blockers,
    nonClaims: [
      'This artifact is not production proof.',
      'This artifact does not deploy, call production or staging endpoints, access D1, read logs or secrets, parse real auth material, use customer/private data, or touch CRM/outreach/LLM/automation.',
      'This artifact is scoped to the known axios audit finding and does not certify all future dependency risk.',
    ],
  };
}

function runCli() {
  const packageJsonPath = optionValue('--package-json') || 'package.json';
  const packageLockPath = optionValue('--package-lock') || 'package-lock.json';
  const result = evaluateSecurityDependencyAuditTriage({
    packageJsonPath,
    packageLockPath,
  });
  const output = process.argv.includes('--json')
    ? JSON.stringify(result, null, 2)
    : [
      `${result.documentStatus}: ${result.decision.status}`,
      `package: ${result.finding.packageName}@${result.finding.lockedVersion}`,
      `patchedMinimum: ${result.finding.patchedMinimum}`,
      `productionReady: ${result.productionReady}`,
      `notProductionEvidence: ${result.notProductionEvidence}`,
      `blockers: ${result.blockers.length}`,
    ].join('\n');
  const outputPath = optionValue('--output') || '';

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  }

  console.log(output);
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
