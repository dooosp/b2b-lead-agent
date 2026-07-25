#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  EVIDENCE_DOCUMENT_LIMITS
} from '../evidence-claim-workbench/domain/constants.mjs';
import {
  createSourceDocumentCatalog,
  normalizeSourceDocumentBundle
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import {
  createCandidate,
  formatCandidateStatement
} from '../evidence-claim-workbench/domain/candidates.mjs';
import {
  RELATIONSHIP_LIMITS,
  analyzeCandidateRelationships
} from '../evidence-claim-workbench/domain/relationships.mjs';
import {
  REVIEW_PATCH_LIMITS,
  serializeReviewPatch
} from '../evidence-claim-workbench/domain/review-patch.mjs';
import { loadEvidenceInbox } from '../evidence-claim-workbench/domain/intake.mjs';
import {
  createSyntheticDocument,
  SYNTHETIC_BENCHMARK_AS_OF
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';
import { createSyntheticApprovedReviewPatchFixture } from '../evidence-claim-workbench/fixtures/synthetic-approved-review-patch-v0.mjs';
import {
  WORKBENCH_HTML_MAX_BYTES,
  renderOfficialEvidenceWorkbenchPage
} from '../evidence-claim-workbench/renderer.mjs';

export const PERFORMANCE_PHASE_LIMIT_MS = 5_000;
export const PERFORMANCE_HEAP_DELTA_LIMIT_BYTES = 256 * 1024 * 1024;

function elapsed(started) {
  return Number((performance.now() - started).toFixed(3));
}

function measure(label, scale, operation) {
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const result = operation();
  return {
    label,
    scale,
    durationMs: elapsed(started),
    heapDeltaBytes: Math.max(0, process.memoryUsage().heapUsed - heapBefore),
    result
  };
}

async function measureAsync(label, scale, operation) {
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const result = await operation();
  return {
    label,
    scale,
    durationMs: elapsed(started),
    heapDeltaBytes: Math.max(0, process.memoryUsage().heapUsed - heapBefore),
    result
  };
}

function performanceDocument(key, pageCount = 1) {
  return createSyntheticDocument({
    key,
    title: `Synthetic performance document ${key}`,
    pages: Array.from({ length: pageCount }, (_, index) => [
      `Synthetic page context ${index + 1}.`,
      `Rated voltage: ${22 + (index % 3)} kV.`,
      'End of synthetic performance evidence.'
    ].join('\n'))
  });
}

function documentBatch(documentCount, pagesPerDocument = 1, prefix = 'scale') {
  return Array.from({ length: documentCount }, (_, index) => performanceDocument(
    `${prefix}-${String(index).padStart(3, '0')}`,
    pagesPerDocument
  ));
}

function scaleCandidate(base, index) {
  const raw = structuredClone(base);
  delete raw.candidateId;
  raw.documentId = `perf_doc_${String(index).padStart(4, '0')}`;
  raw.evidenceAnchorId = `perf_anchor_${String(index).padStart(4, '0')}`;
  raw.value = { ...raw.value, value: Number((1 + index / 1_000).toFixed(3)) };
  raw.statement = formatCandidateStatement(raw.applicability.productFamily, raw.value);
  return createCandidate(raw);
}

function manifestEntry(rawDocument, relativePath, bytes, digest) {
  return {
    relativePath,
    byteLength: bytes.byteLength,
    mediaType: 'application/json',
    sourceUrl: rawDocument.source.sourceUrl,
    publisher: rawDocument.source.publisher,
    title: rawDocument.source.title,
    documentNumber: rawDocument.source.documentNumber,
    documentType: rawDocument.source.documentType,
    revision: {
      seriesId: rawDocument.revision.seriesId,
      revisionId: rawDocument.revision.revisionId,
      sequence: rawDocument.revision.sequence
    },
    language: rawDocument.source.language,
    vertical: rawDocument.source.vertical,
    jurisdiction: rawDocument.source.jurisdiction,
    domain: rawDocument.source.domain,
    productFamilies: rawDocument.source.productFamilies,
    redistributionStatus: rawDocument.source.redistributionStatus,
    expectedSha256: digest
  };
}

async function measureInboxManifest() {
  const ownedRoot = await mkdtemp(path.join(tmpdir(), 'oecrw-performance-'));
  const inboxRoot = path.join(ownedRoot, 'evidence-inbox');
  try {
    await mkdir(inboxRoot);
    const rawDocument = performanceDocument('manifest-audit');
    const serialized = `${JSON.stringify(rawDocument)}\n`;
    const bytes = Buffer.from(serialized, 'utf8');
    const digest = createHash('sha256').update(bytes).digest('hex');
    await writeFile(path.join(inboxRoot, 'document.json'), bytes, { mode: 0o600 });
    const manifest = {
      schemaVersion: 'official-evidence-intake-manifest-v0',
      boundary: 'NOT_PRODUCTION_EVIDENCE',
      productionReady: false,
      documents: [manifestEntry(rawDocument, 'document.json', bytes, digest)]
    };
    await writeFile(path.join(inboxRoot, 'manifest.json'), `${JSON.stringify(manifest)}\n`, { mode: 0o600 });
    const measurement = await measureAsync('inbox_manifest_audit', 1, async () => {
      const result = await loadEvidenceInbox({ ownedRoot, inboxRoot, asOf: SYNTHETIC_BENCHMARK_AS_OF });
      return { documentCount: result.catalog.documents.length };
    });
    return measurement;
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
}

export async function measureEvidenceClaimWorkbench() {
  const measurements = [];
  measurements.push(await measureInboxManifest());

  for (const documentCount of [1, 10, 100]) {
    const documents = documentBatch(documentCount, 1, `documents-${documentCount}`);
    measurements.push(measure('source_bundle_validation', documentCount, () => {
      const catalog = createSourceDocumentCatalog(documents, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
      return {
        documentCount: catalog.documents.length,
        serializedBytes: Buffer.byteLength(JSON.stringify(documents), 'utf8')
      };
    }));
  }

  for (const totalPages of [100, 1_000]) {
    const documentCount = Math.ceil(totalPages / 100);
    const documents = documentBatch(documentCount, Math.min(totalPages, 100), `pages-${totalPages}`);
    measurements.push(measure('page_validation_and_lookup', totalPages, () => {
      const catalog = createSourceDocumentCatalog(documents, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
      const pageIndex = new Map(catalog.documents.flatMap((document) => document.pages.map((page) => [
        `${document.documentId}:${page.pageNumber}`,
        page
      ])));
      const lookups = [...pageIndex.keys()].reduce((count, key) => count + Number(pageIndex.has(key)), 0);
      return { documentCount: catalog.documents.length, pageCount: pageIndex.size, successfulLookups: lookups };
    }));
  }

  const anchorDocument = normalizeSourceDocumentBundle(performanceDocument('quote-anchors', 100), {
    asOf: SYNTHETIC_BENCHMARK_AS_OF
  });
  measurements.push(measure('quote_anchoring', 100, () => {
    const anchors = anchorDocument.pages.map((page) => {
      const quote = page.text.split('\n')[1];
      const startCodePoint = [...page.text.slice(0, page.text.indexOf(quote))].length;
      return createPageEvidenceAnchor(anchorDocument, {
        pageNumber: page.pageNumber,
        startCodePoint,
        endCodePoint: startCodePoint + [...quote].length,
        quote
      });
    });
    return { anchorCount: anchors.length, distinctAnchorCount: new Set(anchors.map(({ anchorId }) => anchorId)).size };
  }));

  for (const occurrenceCount of [1, 10, 100]) {
    const quote = 'Rated voltage: 24 kV.';
    const occurrenceDocument = normalizeSourceDocumentBundle(createSyntheticDocument({
      key: `quote-occurrences-${occurrenceCount}`,
      pages: [Array.from({ length: occurrenceCount }, () => quote).join('\n')]
    }), { asOf: SYNTHETIC_BENCHMARK_AS_OF });
    measurements.push(measure('repeated_quote_occurrence_binding', occurrenceCount, () => {
      const text = occurrenceDocument.pages[0].text;
      const prefix = Array.from({ length: occurrenceCount - 1 }, () => quote).join('\n');
      const startCodePoint = occurrenceCount === 1 ? 0 : [...`${prefix}\n`].length;
      const anchor = createPageEvidenceAnchor(occurrenceDocument, {
        pageNumber: 1,
        startCodePoint,
        endCodePoint: startCodePoint + [...quote].length,
        quote,
        ...(occurrenceCount > 1 ? { occurrenceIndex: occurrenceCount } : {})
      });
      return {
        occurrenceIndex: anchor.selection.occurrenceIndex,
        occurrenceCount: anchor.selection.occurrenceCount
      };
    }));
  }

  const basePatch = createSyntheticApprovedReviewPatchFixture();
  const baseCandidate = basePatch.approvedCandidates[0].candidate;
  const candidateScales = new Map();
  for (const candidateCount of [10, 100, 1_000]) {
    const measurement = measure('candidate_generation', candidateCount, () => {
      const candidates = Array.from({ length: candidateCount }, (_, index) => scaleCandidate(baseCandidate, index));
      return {
        candidates,
        candidateCount: candidates.length,
        serializedBytes: Buffer.byteLength(JSON.stringify(candidates), 'utf8')
      };
    });
    candidateScales.set(candidateCount, measurement.result.candidates);
    measurement.result = {
      candidateCount: measurement.result.candidateCount,
      serializedBytes: measurement.result.serializedBytes
    };
    measurements.push(measurement);
  }

  for (const candidateCount of [10, 100]) {
    measurements.push(measure('conflict_detection', candidateCount, () => {
      const report = analyzeCandidateRelationships(candidateScales.get(candidateCount));
      return {
        candidateCount,
        relationshipCount: report.metrics.relationshipCount,
        conflictCount: report.metrics.materialConflictCount
      };
    }));
  }

  measurements.push(measure('conflict_detection_bounded_refusal', 1_000, () => {
    try {
      analyzeCandidateRelationships(candidateScales.get(1_000));
      return { refused: false, errorCode: '' };
    } catch (error) {
      if (error?.code !== 'TOO_MANY_RELATIONSHIPS') throw error;
      return {
        refused: true,
        errorCode: error.code,
        maxCandidates: RELATIONSHIP_LIMITS.maxCandidates,
        maxRelationships: RELATIONSHIP_LIMITS.maxRelationships
      };
    }
  }));

  measurements.push(measure('review_patch_generation', 1, () => {
    const patch = createSyntheticApprovedReviewPatchFixture();
    const serialized = serializeReviewPatch(patch);
    return { approvedCandidateCount: patch.metrics.approvedCandidateCount, patchBytes: Buffer.byteLength(serialized, 'utf8') };
  }));

  measurements.push(measure('workbench_page_rendering', 100, () => {
    const documents = Array.from({ length: 100 }, (_, index) => ({
      id: `summary-${index}`,
      title: `Synthetic document summary ${index}`,
      publisher: 'Synthetic Electrical Evidence Laboratory',
      revision: `rev-${index + 1}`
    }));
    const html = renderOfficialEvidenceWorkbenchPage({ capabilityToken: 'a'.repeat(64), documents });
    return { documentSummaryCount: documents.length, htmlBytes: Buffer.byteLength(html, 'utf8') };
  }));

  const phaseViolations = measurements.filter(({ durationMs, heapDeltaBytes }) => (
    durationMs >= PERFORMANCE_PHASE_LIMIT_MS || heapDeltaBytes >= PERFORMANCE_HEAP_DELTA_LIMIT_BYTES
  ));
  const patchBytes = measurements.find(({ label }) => label === 'review_patch_generation')?.result.patchBytes || 0;
  const htmlBytes = measurements.find(({ label }) => label === 'workbench_page_rendering')?.result.htmlBytes || 0;
  const sizeViolations = [
    ...(patchBytes > REVIEW_PATCH_LIMITS.maxSerializedBytes ? ['PATCH_SIZE_LIMIT_EXCEEDED'] : []),
    ...(htmlBytes > WORKBENCH_HTML_MAX_BYTES ? ['HTML_SIZE_LIMIT_EXCEEDED'] : [])
  ];

  return {
    schemaVersion: 'official-evidence-claim-workbench-performance-v0',
    boundary: 'LOCAL_SYNTHETIC_MEASUREMENT',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    nodeVersion: process.version,
    status: phaseViolations.length === 0 && sizeViolations.length === 0
      ? 'OFFICIAL_EVIDENCE_WORKBENCH_PERFORMANCE_PASS'
      : 'OFFICIAL_EVIDENCE_WORKBENCH_PERFORMANCE_FAIL',
    limits: {
      phaseDurationMs: PERFORMANCE_PHASE_LIMIT_MS,
      heapDeltaBytes: PERFORMANCE_HEAP_DELTA_LIMIT_BYTES,
      maxCatalogDocuments: EVIDENCE_DOCUMENT_LIMITS.maxCatalogDocuments,
      maxPagesPerDocument: EVIDENCE_DOCUMENT_LIMITS.maxPagesPerDocument,
      maxPageCodePoints: EVIDENCE_DOCUMENT_LIMITS.maxPageCodePoints,
      maxDocumentCodePoints: EVIDENCE_DOCUMENT_LIMITS.maxDocumentCodePoints,
      maxIntakeFileBytes: EVIDENCE_DOCUMENT_LIMITS.maxIntakeFileBytes,
      maxInteractiveCandidatesPerPatch: REVIEW_PATCH_LIMITS.maxApprovedCandidates,
      maxRelationshipCandidates: RELATIONSHIP_LIMITS.maxCandidates,
      maxRelationships: RELATIONSHIP_LIMITS.maxRelationships,
      maxPatchBytes: REVIEW_PATCH_LIMITS.maxSerializedBytes,
      maxHtmlBytes: WORKBENCH_HTML_MAX_BYTES,
      performanceCandidateScale: 1_000,
      performancePageScale: 1_000
    },
    measurements,
    browserPageLoad: {
      measuredBy: 'npm run test:evidence-claim-workbench:e2e',
      includedInThisNodeOnlyReport: false,
      reason: 'Browser startup depends on the separately installed Playwright runtime; it is not hidden behind a synthetic Node timing.'
    },
    violations: [
      ...phaseViolations.map(({ label, scale }) => `${label}:${scale}`),
      ...sizeViolations
    ],
    nonClaims: [
      'Durations and heap deltas are observations from one local synthetic run and are excluded from deterministic evaluation hashes.',
      'Temporary inbox files are performance-harness setup and are removed; the Workbench runtime performs no persistence write.',
      'This is not a production capacity, latency, or service-level claim.'
    ]
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await measureEvidenceClaimWorkbench();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.violations.length > 0) process.exitCode = 1;
}
