import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  createCandidate,
  extractDeterministicCandidates
} from '../evidence-claim-workbench/domain/candidates.mjs';
import {
  copyPatchText,
  downloadPatchText
} from '../evidence-claim-workbench/assets/browser-effects.mjs';
import {
  normalizeSourceDocumentBundle
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import { loadEvidenceInbox } from '../evidence-claim-workbench/domain/intake.mjs';
import { analyzeCandidateRelationships } from '../evidence-claim-workbench/domain/relationships.mjs';
import { createReviewDecision } from '../evidence-claim-workbench/domain/review-decisions.mjs';
import {
  createReviewPatch,
  serializeReviewPatch
} from '../evidence-claim-workbench/domain/review-patch.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticDocument
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';
import {
  WORKBENCH_BASE_COMMIT_SHA,
  WORKBENCH_REGISTRY_PATH,
  createWorkbenchServer,
  parseWorkbenchHost,
  parseWorkbenchPort
} from '../evidence-claim-workbench/server.mjs';

const CLIENT_PATH = new URL('../evidence-claim-workbench/assets/app.js', import.meta.url);
const SAFE_ERROR_LEAK = /(?:\/Users\/|\/home\/|Bearer\s|gh[oprsu]_|sk-|\bVERIFIED\b|\bALLOWED\b)/u;

function injectedError(code) {
  return Object.assign(new Error('injected safe boundary failure'), { code });
}

function assertSafeTypedFailure(error, code) {
  assert.ok(error instanceof Error);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, SAFE_ERROR_LEAK);
  return true;
}

function expectCode(code, action) {
  assert.throws(action, (error) => assertSafeTypedFailure(error, code));
}

async function expectRejectCode(code, action) {
  await assert.rejects(action, (error) => assertSafeTypedFailure(error, code));
}

function locateQuote(text, quote) {
  const page = [...text];
  const needle = [...quote];
  outer: for (let start = 0; start <= page.length - needle.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (page[start + offset] !== needle[offset]) continue outer;
    }
    return start;
  }
  return -1;
}

function createWorkflowFixture(key = 'failure-injection-base', voltage = 24) {
  const quote = `Rated voltage: ${voltage} kV.`;
  const document = normalizeSourceDocumentBundle(createSyntheticDocument({
    key,
    pages: [`Synthetic context before.\n${quote}\nSynthetic context after.`]
  }), { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const startCodePoint = locateQuote(document.pages[0].text, quote);
  assert.ok(startCodePoint >= 0);
  const anchor = createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint,
    endCodePoint: startCodePoint + [...quote].length,
    quote
  });
  const candidates = extractDeterministicCandidates({ document, anchors: [anchor] });
  assert.equal(candidates.length, 1);
  const candidate = candidates[0];
  const decision = createReviewDecision({
    candidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  return { document, anchor, candidate, decision };
}

function patchInput(fixture = createWorkflowFixture()) {
  return {
    baseCommitSha: WORKBENCH_BASE_COMMIT_SHA,
    registryPath: WORKBENCH_REGISTRY_PATH,
    generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents: [fixture.document],
    anchors: [fixture.anchor],
    candidates: [fixture.candidate],
    decisions: [fixture.decision]
  };
}

function manifestEntry(bundle, byteLength) {
  return {
    relativePath: 'missing-normalized-document.json',
    byteLength,
    mediaType: 'application/json',
    sourceUrl: bundle.source.sourceUrl,
    publisher: bundle.source.publisher,
    title: bundle.source.title,
    documentNumber: bundle.source.documentNumber,
    documentType: bundle.source.documentType,
    revision: {
      seriesId: bundle.revision.seriesId,
      revisionId: bundle.revision.revisionId,
      sequence: bundle.revision.sequence
    },
    language: bundle.source.language,
    vertical: bundle.source.vertical,
    jurisdiction: bundle.source.jurisdiction,
    domain: bundle.source.domain,
    productFamilies: bundle.source.productFamilies,
    redistributionStatus: bundle.source.redistributionStatus
  };
}

async function createEmptyInbox(t) {
  const ownedRoot = await mkdtemp(path.join(tmpdir(), 'oecrw0-failure-'));
  const inboxRoot = path.join(ownedRoot, 'evidence-inbox');
  await mkdir(inboxRoot);
  t.after(() => rm(ownedRoot, { recursive: true, force: true }));
  return { ownedRoot, inboxRoot };
}

function allObjectKeys(value, target = []) {
  if (Array.isArray(value)) value.forEach((child) => allObjectKeys(child, target));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      target.push(key);
      allObjectKeys(child, target);
    }
  }
  return target;
}

function allStringValues(value, target = []) {
  if (typeof value === 'string') target.push(value);
  else if (Array.isArray(value)) value.forEach((child) => allStringValues(child, target));
  else if (value && typeof value === 'object') Object.values(value).forEach((child) => allStringValues(child, target));
  return target;
}

function extractClientFunction(source, name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?^\\}`, 'mu');
  const match = source.match(pattern);
  assert.ok(match, `${name} must remain a named, locally testable browser function`);
  return match[0];
}

test('manifest-load and referenced-file read failures are typed, redacted, and return no partial catalog', async (t) => {
  const first = await createEmptyInbox(t);
  let result;
  await expectRejectCode('INTAKE_MANIFEST_NOT_FOUND', async () => {
    result = await loadEvidenceInbox({ ownedRoot: first.ownedRoot, asOf: SYNTHETIC_BENCHMARK_AS_OF });
  });
  assert.equal(result, undefined);

  const second = await createEmptyInbox(t);
  const bundle = createSyntheticDocument({ key: 'failure-missing-file' });
  const byteLength = Buffer.byteLength(JSON.stringify(bundle), 'utf8');
  const manifest = {
    schemaVersion: 'official-evidence-intake-manifest-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    documents: [manifestEntry(bundle, byteLength)]
  };
  await writeFile(path.join(second.inboxRoot, 'manifest.json'), JSON.stringify(manifest));
  await expectRejectCode('INTAKE_FILE_NOT_FOUND', () => loadEvidenceInbox({
    ownedRoot: second.ownedRoot,
    asOf: SYNTHETIC_BENCHMARK_AS_OF
  }));
});

test('document hash, page bundle, page hash, and parser/extractor failures are independently fail-closed', () => {
  const contentHash = createSyntheticDocument({ key: 'failure-content-hash' });
  contentHash.file.contentSha256 = '0'.repeat(64);
  expectCode('CONTENT_SHA256_MISMATCH', () => normalizeSourceDocumentBundle(contentHash, { asOf: SYNTHETIC_BENCHMARK_AS_OF }));

  const pageBundle = createSyntheticDocument({ key: 'failure-page-sequence' });
  pageBundle.pages[0].pageNumber = 2;
  expectCode('INVALID_PAGE_SEQUENCE', () => normalizeSourceDocumentBundle(pageBundle, { asOf: SYNTHETIC_BENCHMARK_AS_OF }));

  const pageHash = createSyntheticDocument({ key: 'failure-page-hash' });
  pageHash.pages[0].textSha256 = '0'.repeat(64);
  expectCode('PAGE_TEXT_SHA256_MISMATCH', () => normalizeSourceDocumentBundle(pageHash, { asOf: SYNTHETIC_BENCHMARK_AS_OF }));

  const rawPdf = createSyntheticDocument({ key: 'failure-raw-pdf' });
  rawPdf.source.documentType = 'PDF';
  rawPdf.source.mimeType = 'application/pdf';
  expectCode('RAW_PDF_PARSER_UNAVAILABLE', () => normalizeSourceDocumentBundle(rawPdf, { asOf: SYNTHETIC_BENCHMARK_AS_OF }));

  const unsupportedExtractor = createSyntheticDocument({ key: 'failure-extractor' });
  unsupportedExtractor.extraction.method = 'OCR_WITH_UNTRUSTED_BINARY';
  expectCode('UNSUPPORTED_EXTRACTION_METHOD', () => normalizeSourceDocumentBundle(unsupportedExtractor, { asOf: SYNTHETIC_BENCHMARK_AS_OF }));
});

test('quote-anchor corruption fails before an anchor or candidate can be returned', () => {
  const { document } = createWorkflowFixture('failure-anchor-source');
  let anchor;
  expectCode('PAGE_QUOTE_MISMATCH', () => {
    anchor = createPageEvidenceAnchor(document, {
      pageNumber: 1,
      startCodePoint: 0,
      endCodePoint: [...'Rated voltage: 36 kV.'].length,
      quote: 'Rated voltage: 36 kV.'
    });
  });
  assert.equal(anchor, undefined);
});

test('candidate generation and normalization injections expose no partial candidate', () => {
  const { document, anchor, candidate } = createWorkflowFixture('failure-candidate');
  let generated;
  expectCode('INJECTED_CANDIDATE_GENERATION_FAILURE', () => {
    generated = extractDeterministicCandidates({ document, anchors: [anchor] }, {
      inject: { afterCandidateGeneration() { throw injectedError('INJECTED_CANDIDATE_GENERATION_FAILURE'); } }
    });
  });
  assert.equal(generated, undefined);

  let normalized;
  expectCode('INJECTED_CANDIDATE_NORMALIZATION_FAILURE', () => {
    normalized = createCandidate(structuredClone(candidate), {
      inject: { afterCandidateNormalization() { throw injectedError('INJECTED_CANDIDATE_NORMALIZATION_FAILURE'); } }
    });
  });
  assert.equal(normalized, undefined);
});

test('review-decision injection returns no decision and cannot promote candidate authority', () => {
  const { candidate } = createWorkflowFixture('failure-decision');
  let decision;
  expectCode('INJECTED_REVIEW_DECISION_FAILURE', () => {
    decision = createReviewDecision({
      candidate,
      decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
      reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
    }, {
      inject: { afterReviewDecision() { throw injectedError('INJECTED_REVIEW_DECISION_FAILURE'); } }
    });
  });
  assert.equal(decision, undefined);
  assert.equal(candidate.reviewState, 'REVIEW_REQUIRED');
  assert.equal(Object.hasOwn(candidate, 'status'), false);
  assert.equal(Object.hasOwn(candidate, 'customerUseAllowed'), false);
});

test('conflict detector reports a blocking conflict and injected failure returns no favorable resolution', () => {
  const left = createWorkflowFixture('failure-conflict-left', 22.9);
  const right = createWorkflowFixture('failure-conflict-right', 24);
  const report = analyzeCandidateRelationships([left.candidate, right.candidate]);
  assert.equal(report.metrics.materialConflictCount, 1);
  assert.equal(report.relationships[0].blocking, true);
  assert.equal(report.automaticResolution, false);
  assert.equal(report.favorableClaimAutomaticallySelected, false);

  let failedReport;
  expectCode('INJECTED_RELATIONSHIP_FAILURE', () => {
    failedReport = analyzeCandidateRelationships([left.candidate, right.candidate], {
      inject: { beforeRelationshipDetection() { throw injectedError('INJECTED_RELATIONSHIP_FAILURE'); } }
    });
  });
  assert.equal(failedReport, undefined);
});

test('patch build and serialization injections return nothing while the valid patch stays thin and non-authoritative', () => {
  const input = patchInput(createWorkflowFixture('failure-patch'));
  let partialPatch;
  expectCode('INJECTED_PATCH_BUILD_FAILURE', () => {
    partialPatch = createReviewPatch(input, {
      inject: { beforePatchSerialization() { throw injectedError('INJECTED_PATCH_BUILD_FAILURE'); } }
    });
  });
  assert.equal(partialPatch, undefined);

  const patch = createReviewPatch(input);
  let serializedFailure;
  expectCode('INJECTED_PATCH_SERIALIZATION_FAILURE', () => {
    serializedFailure = serializeReviewPatch(patch, {
      inject: { beforePatchSerialization() { throw injectedError('INJECTED_PATCH_SERIALIZATION_FAILURE'); } }
    });
  });
  assert.equal(serializedFailure, undefined);

  const serialized = serializeReviewPatch(patch);
  assert.equal(patch.approvedCandidates.length, 1);
  assert.equal(patch.productionReady, false);
  assert.equal(patch.productionReviewerWorkflowReady, false);
  assert.equal(patch.issue165Status, 'HOLD');
  assert.equal(patch.automaticVerification, false);
  assert.equal(patch.customerUseAllowed, false);
  assert.equal(patch.proofExecutionApproved, false);
  assert.equal(patch.reviewerIdentity, 'NOT_COLLECTED');
  assert.equal(allStringValues(patch).some((value) => value === 'VERIFIED' || value === 'ALLOWED'), false);
  assert.equal(allObjectKeys(patch).some((key) => /^(?:pages|pageText|sourceBinary|binary|buffer|bytes|filePath|localPath|reviewerName|reviewerEmail|customerData|privateData)$/iu.test(key)), false);
  assert.doesNotMatch(serialized, /(?:\/Users\/|\/home\/|"pages"|"pageText"|"sourceBinary"|\bVERIFIED\b|\bALLOWED\b)/u);
});

test('server startup rejects non-loopback binding and injected catalog failure before creating a server', async () => {
  assert.equal(parseWorkbenchHost('127.0.0.1'), '127.0.0.1');
  expectCode('WORKBENCH_NON_LOOPBACK_HOST_REFUSED', () => parseWorkbenchHost('0.0.0.0'));
  expectCode('WORKBENCH_PORT_INVALID', () => parseWorkbenchPort(80, { allowZero: false }));

  let server;
  await expectRejectCode('WORKBENCH_NON_LOOPBACK_HOST_REFUSED', async () => {
    server = await createWorkbenchServer({ host: '0.0.0.0', port: 0 });
  });
  assert.equal(server, undefined);

  let loadCalls = 0;
  await expectRejectCode('INJECTED_CATALOG_LOAD_FAILURE', async () => {
    server = await createWorkbenchServer({
      host: '127.0.0.1',
      port: 0,
      handlerOptions: {
        async loadCatalog() {
          loadCalls += 1;
          throw injectedError('INJECTED_CATALOG_LOAD_FAILURE');
        }
      }
    });
  });
  assert.equal(server, undefined);
  assert.equal(loadCalls, 1);
});

test('browser copy/download failures and unknown document switches stay local, bounded, and non-persistent', async () => {
  const source = await readFile(CLIENT_PATH, 'utf8');
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|WebSocket|EventSource|sendBeacon)\b/u);
  assert.doesNotMatch(source, /\bexport\s+(?:async\s+)?function\s+(?:copyPatch|downloadPatch|selectDocument|selectPage)\b/u);
  const fetchTargets = [...source.matchAll(/fetch\(\s*(['"])(.*?)\1/gu)].map((match) => match[2]).sort();
  assert.deepEqual(fetchTargets, ['/api/catalog', '/api/patch']);

  const preview = { value: '{"boundary":"NOT_PRODUCTION_EVIDENCE"}', focused: false, selected: false, focus() { this.focused = true; }, select() { this.selected = true; } };
  const fallback = { hidden: true };
  const announcements = [];
  const copyOutcome = await copyPatchText({
    text: preview.value,
    async writeText() { throw injectedError('INJECTED_CLIPBOARD_FAILURE'); },
    onFallback() {
      fallback.hidden = false;
      preview.focus();
      preview.select();
      announcements.push('자동 복사가 차단되어 미리보기 텍스트를 선택했습니다.');
    }
  });
  assert.equal(copyOutcome, 'FALLBACK_SELECTED');
  assert.equal(fallback.hidden, false);
  assert.equal(preview.focused, true);
  assert.equal(preview.selected, true);
  assert.match(announcements.at(-1), /차단되어 미리보기 텍스트를 선택/u);

  const revoked = [];
  let clicked = 0;
  const downloadOutcome = downloadPatchText({
    text: preview.value,
    filename: `official-evidence-review-patch_${'a'.repeat(27)}.json`,
    BlobConstructor: class SafeTestBlob {},
    createObjectUrl() { return 'blob:synthetic-local-only'; },
    revokeObjectUrl(value) { revoked.push(value); },
    createLink() {
      return {
        click() {
          clicked += 1;
          throw injectedError('INJECTED_DOWNLOAD_FAILURE');
        }
      };
    },
    onBlocked() { announcements.push('다운로드가 차단되었습니다.'); }
  });
  assert.equal(downloadOutcome, 'DOWNLOAD_BLOCKED');
  assert.equal(clicked, 1);
  assert.deepEqual(revoked, ['blob:synthetic-local-only']);
  assert.match(announcements.at(-1), /다운로드.*차단|차단.*다운로드/u);

  const selectDocumentSource = extractClientFunction(source, 'selectDocument');
  const lookupIndex = selectDocumentSource.indexOf('const selected = documentById(id);');
  const refusalIndex = selectDocumentSource.indexOf('if (!selected) return;');
  const mutationIndex = selectDocumentSource.indexOf('state.document = selected;');
  assert.ok(lookupIndex >= 0 && refusalIndex > lookupIndex && mutationIndex > refusalIndex);
  assert.doesNotMatch(source, /\bnew Function\b|\beval\s*\(/u);
});
