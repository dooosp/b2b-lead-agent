#!/usr/bin/env node

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

const {
  buildOutboundHttpEnrichmentBoundaryAudit,
} = require('../enricher/outbound-http-boundary');

export const OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_OUTPUT_PATH =
  'tmp/codex/outbound-http-enrichment-boundary-guards-non-production.json';

function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

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
  const artifact = evaluateOutboundHttpEnrichmentBoundaryAudit();
  const output = process.argv.includes('--json')
    ? JSON.stringify(artifact, null, 2)
    : [
      `${artifact.documentStatus}: PASS_LOCAL_ONLY`,
      `boundary: ${artifact.boundary}`,
      `productionReady: ${artifact.productionReady}`,
      `notProductionEvidence: ${artifact.notProductionEvidence}`,
      `transport: ${artifact.transportContract.defaultTransport}`,
    ].join('\n');
  const outputPath = optionValue('--output') || '';

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  }

  console.log(output);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
