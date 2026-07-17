#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_IDS = ['danfoss', 'ls-electric', 'siemens'];

function normalizeText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function classifyReference(text) {
  if (/인증|승인|등급|LEED|EN54|UL|FDA/i.test(text)) return 'CERTIFICATION';
  if (/규제|의무|법|CBAM|RE100|EEXI|CII|EPBD|F-Gas|NDC/i.test(text)) return 'REGULATION';
  if (/절감|감소|향상|개선|효율|가동률|손실|생산성|오보율|PUE|ROI|\d/i.test(text)) return 'PERFORMANCE';
  return 'REFERENCE_CASE';
}

function createCandidate({
  profileId,
  sourcePath,
  sourceField,
  sourceIndex = null,
  claimType,
  text,
  currentReachability,
  status = 'UNVERIFIED',
  notes = []
}) {
  const normalizedText = normalizeText(text);
  const identityInput = [profileId, sourcePath, sourceField, sourceIndex ?? '', normalizedText].join('\n');
  return {
    candidateId: `legacy_${digest(identityInput)}`,
    profileId,
    sourcePath,
    sourceField,
    sourceIndex,
    claimType,
    normalizedText,
    sourceAvailability: false,
    directQuoteAvailability: false,
    verificationDateAvailability: false,
    currentTrustClassification: status,
    derivedCustomerUse: 'BLOCKED',
    currentCustomerFacingReachability: currentReachability,
    risk: currentReachability === 'DISCOVERY_ONLY' ? 'MEDIUM' : 'CRITICAL',
    notes
  };
}

export function buildLegacyClaimInventory() {
  const candidates = [];

  for (const profileId of PROFILE_IDS) {
    const profile = require(resolve(REPO_ROOT, 'profiles', `${profileId}.js`));
    const sourcePath = `profiles/${profileId}.js`;

    for (const [productName, knowledge] of Object.entries(profile.productKnowledge || {})) {
      candidates.push(createCandidate({
        profileId,
        sourcePath,
        sourceField: `productKnowledge.${productName}.value`,
        claimType: 'PRODUCT_CAPABILITY',
        text: knowledge.value,
        currentReachability: 'ROOT_PROMPT_LEADBRIEF_REPORT_EMAIL_PPT_CSV',
        notes: ['Legacy profile text has no bound source, quote, or verification record.']
      }));
      candidates.push(createCandidate({
        profileId,
        sourcePath,
        sourceField: `productKnowledge.${productName}.roi`,
        claimType: 'ROI',
        text: knowledge.roi,
        currentReachability: 'ROOT_PROMPT_LEADBRIEF_REPORT_EMAIL_PPT_CSV',
        notes: ['Legacy quantitative text cannot support VERIFIED or FIT.']
      }));
    }

    for (const [category, references] of Object.entries(profile.globalReferences || {})) {
      references.forEach((reference, index) => {
        const text = `${reference.client}: ${reference.project} -> ${reference.result}`;
        candidates.push(createCandidate({
          profileId,
          sourcePath,
          sourceField: `globalReferences.${category}`,
          sourceIndex: index,
          claimType: classifyReference(text),
          text,
          currentReachability: 'ROOT_PROMPT_LEADBRIEF_REPORT_EMAIL_PPT',
          notes: ['Legacy reference case has no bound source, quote, or verification record.']
        }));
        candidates.push(createCandidate({
          profileId,
          sourcePath: 'worker/db/references.js',
          sourceField: `reference_library.seed.${profileId}.${category}`,
          sourceIndex: index,
          claimType: classifyReference(text),
          text,
          currentReachability: 'WORKER_PROPOSAL_CUSTOMER_OUTPUT',
          notes: [
            'Seeded reference rows store source_url and verified_at as empty strings.',
            `Mirrors ${sourcePath} globalReferences.${category}[${index}].`
          ]
        }));
      });
    }

    for (const [category, config] of Object.entries(profile.categoryConfig || {})) {
      for (const [field, claimType] of [['roi', 'ROI'], ['policy', 'REGULATION'], ['pitch', 'REFERENCE_CASE']]) {
        if (!config[field]) continue;
        candidates.push(createCandidate({
          profileId,
          sourcePath,
          sourceField: `categoryConfig.${category}.${field}`,
          claimType,
          text: config[field],
          currentReachability: 'FALLBACK_LEADBRIEF_REPORT_EMAIL_PPT_CSV',
          notes: ['Legacy fallback text has no claim-level evidence binding.']
        }));
      }
    }

    (profile.competitors || []).forEach((competitor, index) => {
      candidates.push(createCandidate({
        profileId,
        sourcePath,
        sourceField: 'competitors',
        sourceIndex: index,
        claimType: 'COMPETITOR',
        text: competitor,
        currentReachability: 'ENRICHMENT_PROMPT_INTERNAL_REVIEW',
        notes: ['A profile label is not evidence of a project-specific incumbent or competitor.']
      }));
    });

    (profile.searchQueries || []).forEach((query, index) => {
      candidates.push(createCandidate({
        profileId,
        sourcePath,
        sourceField: 'searchQueries',
        sourceIndex: index,
        claimType: 'PROJECT_FACT',
        text: query,
        currentReachability: 'DISCOVERY_ONLY',
        status: 'ASSUMPTION',
        notes: ['Discovery query only; it is not evidence that a project exists.']
      }));
    });
  }

  candidates.sort((left, right) => left.candidateId.localeCompare(right.candidateId, 'en'));
  const byProfile = Object.fromEntries(PROFILE_IDS.map((profileId) => [
    profileId,
    candidates.filter((candidate) => candidate.profileId === profileId).length
  ]));
  const byType = {};
  for (const candidate of candidates) byType[candidate.claimType] = (byType[candidate.claimType] || 0) + 1;
  const referenceSource = readFileSync(resolve(REPO_ROOT, 'worker', 'db', 'references.js'), 'utf8');
  const referenceSeedObjectCount = [...referenceSource.matchAll(/\{\s*client:\s*'[^']*',\s*project:\s*'[^']*',\s*result:\s*'[^']*',\s*region:\s*'[^']*'\s*\}/g)].length;
  const inferredReferenceSeedCount = candidates.filter((candidate) => candidate.sourceField.startsWith('reference_library.seed.')).length;
  if (referenceSeedObjectCount !== inferredReferenceSeedCount) {
    const error = new Error(`LEGACY_REFERENCE_SEED_INVENTORY_MISMATCH:${referenceSeedObjectCount}:${inferredReferenceSeedCount}`);
    error.code = 'LEGACY_REFERENCE_SEED_INVENTORY_MISMATCH';
    throw error;
  }

  return {
    schemaVersion: 'legacy-claim-inventory-v1',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    issue165Status: 'HOLD',
    generatedFromCommit: 'd52b2f11a9f7342d91fed7431664083b3d95a537',
    generatedAt: null,
    summary: {
      totalClaimCandidates: candidates.length,
      byProfile,
      byType: Object.fromEntries(Object.entries(byType).sort(([a], [b]) => a.localeCompare(b, 'en'))),
      verified: 0,
      unverified: candidates.filter((candidate) => candidate.currentTrustClassification === 'UNVERIFIED').length,
      assumption: candidates.filter((candidate) => candidate.currentTrustClassification === 'ASSUMPTION').length,
      missingSource: candidates.length,
      missingQuote: candidates.length,
      missingVerificationDate: candidates.length,
      customerUseBlocked: candidates.length,
      referenceSeedObjectCount
    },
    candidates,
    nonClaims: [
      'This inventory does not verify any legacy profile or reference assertion.',
      'This inventory is not production evidence and does not authorize customer use.'
    ]
  };
}

function parseOutputPath(argv) {
  const index = argv.indexOf('--output');
  return index === -1 ? null : argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventory = buildLegacyClaimInventory();
  const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
  const outputPath = parseOutputPath(process.argv.slice(2));

  if (outputPath) {
    const absolutePath = resolve(REPO_ROOT, outputPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, serialized, 'utf8');
  } else {
    process.stdout.write(serialized);
  }
}
