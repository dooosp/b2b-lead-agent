#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { auditLegacyInventory, canonicalStringify, sha256 } from '../knowledge/claim-registry/index.mjs';
import { loadEvidenceDomainInputs, REPO_ROOT } from './lib/repository-claim-registry.mjs';
import { buildLegacyClaimInventory } from './generate-legacy-claim-inventory.mjs';
import { validateClaimAuditReport } from './lib/claim-spec-report-validation.mjs';

function parseOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

const { registry, rawRegistry, inventory } = await loadEvidenceDomainInputs();
const legacy = auditLegacyInventory(inventory);
const currentInventory = buildLegacyClaimInventory();
const registryCounts = Object.fromEntries(
  ['VERIFIED', 'UNVERIFIED', 'ASSUMPTION', 'CONFLICTED', 'EXPIRED', 'RETRACTED']
    .map((status) => [status, registry.claims.filter((claim) => claim.status === status).length])
);
const registryByType = Object.fromEntries(
  [...new Set(registry.claims.map((claim) => claim.claimType))]
    .sort()
    .map((claimType) => [claimType, registry.claims.filter((claim) => claim.claimType === claimType).length])
);
const registryMissingSource = registry.claims.filter((claim) => claim.evidence.length === 0 || claim.evidence.some((evidence) => !evidence.sourceUrl)).length;
const registryMissingQuote = registry.claims.filter((claim) => claim.evidence.length === 0 || claim.evidence.some((evidence) => !evidence.directQuote)).length;
const registryMissingVerificationDate = registry.claims.filter((claim) => !claim.verification.verifiedAt).length;
const intrinsicallyBlockedRegistryClaims = registry.claims.filter((claim) => claim.status !== 'VERIFIED').length;
const violations = [...legacy.violations];
if (canonicalStringify(currentInventory) !== canonicalStringify(inventory)) {
  violations.push({ candidateId: null, reasonCode: 'LEGACY_INVENTORY_STALE' });
}
if (rawRegistry.claims.some((claim) => claim.synthetic !== true)) {
  violations.push({ candidateId: null, reasonCode: 'SYNTHETIC_MARKER_MISSING' });
}
const reportWithoutHash = {
  documentStatus: violations.length === 0 ? 'EVIDENCE_CLAIM_AUDIT_PASS' : 'EVIDENCE_CLAIM_AUDIT_FAIL',
  schemaVersion: 'evidence-claim-audit-v1',
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  productionReady: false,
  issue165Status: 'HOLD',
  evaluationAsOf: rawRegistry.evaluationAsOf,
  summary: {
    totalClaimCandidates: legacy.totalClaimCandidates + registry.claims.length,
    legacyClaimCandidates: legacy.totalClaimCandidates,
    registryClaims: registry.claims.length,
    verified: legacy.verified + registryCounts.VERIFIED,
    unverified: legacy.unverified + registryCounts.UNVERIFIED,
    assumption: legacy.assumption + registryCounts.ASSUMPTION,
    conflicted: registryCounts.CONFLICTED,
    expired: registryCounts.EXPIRED,
    retracted: registryCounts.RETRACTED,
    missingSource: legacy.missingSource + registryMissingSource,
    missingQuote: legacy.missingQuote + registryMissingQuote,
    missingVerificationDate: legacy.missingVerificationDate + registryMissingVerificationDate,
    customerUseBlocked: legacy.customerUseBlocked + intrinsicallyBlockedRegistryClaims,
    unsafeSecretShaped: legacy.unsafeSecretShaped,
    duplicateCount: legacy.duplicateCount,
    registryCounts,
    violations: violations.length
  },
  byType: inventory.summary.byType,
  byProfile: inventory.summary.byProfile,
  registryByType,
  violations,
  nonClaims: [
    'Legacy missing evidence is an expected migration inventory condition, not verification.',
    'This audit does not access production, D1, endpoints, logs, secrets, private data, CRM, or outreach systems.'
  ]
};
const report = { ...reportWithoutHash, canonicalSha256: sha256(canonicalStringify(reportWithoutHash)) };
validateClaimAuditReport(report);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
const output = parseOption('--output');
if (output) {
  const path = resolve(REPO_ROOT, output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serialized, 'utf8');
}
process.stdout.write(serialized);
if (violations.length > 0 && process.argv.includes('--fail-on-violations')) process.exitCode = 1;
