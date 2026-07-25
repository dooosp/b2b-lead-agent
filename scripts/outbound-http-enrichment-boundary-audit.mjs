#!/usr/bin/env node

import { createRequire } from 'node:module';
import {
  isDirectCliRun,
  optionValue,
  writeJsonArtifactIfMateriallyChanged,
} from './lib/cli-utils.mjs';

const require = createRequire(import.meta.url);

const {
  buildOutboundHttpEnrichmentBoundaryAudit,
} = require('../enricher/outbound-http-boundary');

export const OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_OUTPUT_PATH =
  'tmp/codex/outbound-http-enrichment-boundary-guards-non-production.json';

export function evaluateOutboundHttpEnrichmentBoundaryAudit(input = {}) {
  return buildOutboundHttpEnrichmentBoundaryAudit({
    generatedAt: input.generatedAt,
    sampleEvidence: input.sampleEvidence || {
      url: 'https://b2b-lead-trigger.example.com/api/leads?token=raw-token-value',
      headers: {
        Authorization: 'Bearer raw-bearer-value',
        Cookie: 'sid=raw-cookie-value',
      },
      error: 'ACME_PRIVATE_CUSTOMER raw payload should not enter evidence',
    },
  });
}

function runCli() {
  const evaluatedArtifact = evaluateOutboundHttpEnrichmentBoundaryAudit();
  const outputPath = optionValue('--output') || '';
  const { artifact } = writeJsonArtifactIfMateriallyChanged(
    outputPath,
    evaluatedArtifact
  );
  const output = process.argv.includes('--json')
    ? JSON.stringify(artifact, null, 2)
    : [
      `${artifact.documentStatus}: PASS_LOCAL_ONLY`,
      `boundary: ${artifact.boundary}`,
      `productionReady: ${artifact.productionReady}`,
      `notProductionEvidence: ${artifact.notProductionEvidence}`,
      `transport: ${artifact.transportContract.defaultTransport}`,
    ].join('\n');

  console.log(output);
}

if (isDirectCliRun(import.meta.url)) {
  runCli();
}
