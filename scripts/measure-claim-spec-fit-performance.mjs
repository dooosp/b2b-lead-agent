#!/usr/bin/env node

import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLAIM_LIMITS, createValidatedClaimRegistry } from '../knowledge/claim-registry/index.mjs';
import { buildPursuitDossier, DATACENTER_LIMITS, evaluateSpecificationFit, renderPursuitDossierJson } from '../verticals/datacenter/index.mjs';
import { createStrongCoolingOpportunity } from '../eval/spec-fit-evaluator.mjs';
import { loadEvidenceDomainInputs } from './lib/repository-claim-registry.mjs';

const clone = (value) => structuredClone(value);

function scaleRegistrySource(rawRegistry, count) {
  const requiredKeys = ['stage_basic_design', 'req_cooling_water', 'cap_compressor_water'];
  const claims = requiredKeys.slice(0, Math.min(count, requiredKeys.length))
    .map((key) => clone(rawRegistry.claims.find((claim) => claim.claimKey === key)));
  const template = rawRegistry.claims.find((claim) => claim.claimKey === 'reference_cooling_allowed');
  while (claims.length < count) {
    const index = claims.length;
    const claim = clone(template);
    claim.claimKey = `scale_filler_${String(index).padStart(4, '0')}`;
    claim.statement = `Synthetic scale filler assertion ${index}.`;
    claim.evidence[0].sourceUrl = `https://synthetic.example/performance/${index}`;
    claim.evidence[0].directQuote = `Synthetic scale filler quote ${index}.`;
    claim.provenance.sourceField = `claims.scale_filler_${String(index).padStart(4, '0')}`;
    claims.push(claim);
  }
  return { claims };
}

function milliseconds(start) {
  return Number((performance.now() - start).toFixed(3));
}

export async function measureClaimSpecPerformance() {
  const { rawRegistry, verticalPack } = await loadEvidenceDomainInputs();
  const claimCounts = [1, 10, 100, 1_000];
  const measurements = [];
  for (const claimCount of claimCounts) {
    const source = scaleRegistrySource(rawRegistry, claimCount);
    const serializedBytes = Buffer.byteLength(JSON.stringify(source), 'utf8');
    const heapBefore = process.memoryUsage().heapUsed;
    let started = performance.now();
    const registry = createValidatedClaimRegistry(source, { asOf: rawRegistry.evaluationAsOf });
    const registryLoadMs = milliseconds(started);
    started = performance.now();
    const evaluation = evaluateSpecificationFit(createStrongCoolingOpportunity(), registry, verticalPack);
    const fitEvaluationMs = milliseconds(started);
    measurements.push({
      claimCount,
      serializedBytes,
      registryLoadMs,
      fitEvaluationMs,
      heapDeltaBytes: Math.max(0, process.memoryUsage().heapUsed - heapBefore),
      observedResult: evaluation.results[0]?.result || 'NOT_EVALUATED'
    });
  }
  const registry = createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  const opportunity = createStrongCoolingOpportunity();
  const evaluation = evaluateSpecificationFit(opportunity, registry, verticalPack);
  const started = performance.now();
  const dossier = buildPursuitDossier(opportunity, evaluation, registry, verticalPack);
  const dossierGenerationMs = milliseconds(started);
  const dossierBytes = Buffer.byteLength(renderPursuitDossierJson(dossier), 'utf8');
  return {
    schemaVersion: 'claim-spec-performance-report-v0',
    boundary: 'LOCAL_SYNTHETIC_MEASUREMENT',
    productionReady: false,
    issue165Status: 'HOLD',
    nodeVersion: process.version,
    limits: {
      maxClaims: CLAIM_LIMITS.maxClaims,
      maxRegistryBytes: CLAIM_LIMITS.maxRegistryBytes,
      maxEvidencePerClaim: CLAIM_LIMITS.maxEvidencePerClaim,
      maxProductFamiliesPerOpportunity: DATACENTER_LIMITS.maxProductFamiliesPerOpportunity,
      maxRequirementsPerOpportunity: DATACENTER_LIMITS.maxRequirementsPerOpportunity,
      maxDossierBytes: DATACENTER_LIMITS.maxDossierBytes
    },
    measurements,
    dossier: { dossierGenerationMs, dossierBytes },
    nonClaims: ['Durations and memory deltas are observations from one local synthetic run and are excluded from deterministic artifact hashes.']
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(await measureClaimSpecPerformance(), null, 2)}\n`);
}
