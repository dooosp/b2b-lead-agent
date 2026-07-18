#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const AS_OF = '2026-07-18T13:00:48.000Z';
const EXPECTED_MANIFEST_SHA256 =
  '0e62b5b258a90395b4f7a95bf2e5288e0781d768aa0990b07c0916a67c16c953';
const SOURCE_LIMIT_BYTES = 25_000_000;

const REFUSED_SOURCES = [
  {
    sourceId: 'switchgear-ls-mcsg-ko-c80051-11-202605',
    relativePath: 'switchgear/ls-mcsg-ko-c80051-11-202605.pdf',
    expectedSha256: '1d8b97980391574bb34d616f62beeebf4a45a74d54553a102116599ec530c370',
    expectedSizeBytes: 47_116_934,
    refusalReason: 'SOURCE_SIZE_EXCEEDS_25000000_BYTE_INTAKE_LIMIT',
  },
  {
    sourceId: 'switchgear-schneider-mcset-en-nrjed312404en-02',
    relativePath: 'switchgear/schneider-mcset-en-nrjed312404en-02.pdf',
    expectedSha256: 'f52f559efdb2d5603b3d366d3680f38257a0f70da5709ca652ee153f7b5432b1',
    expectedSizeBytes: 42_927_512,
    refusalReason: 'SOURCE_SIZE_EXCEEDS_25000000_BYTE_INTAKE_LIMIT',
  },
  {
    sourceId: 'transformer-schneider-trihal-ko-954503439',
    relativePath: 'transformer/schneider-trihal-ko-954503439.pdf',
    expectedSha256: '71a0d59adee1c2176d29b75d7594e13efc601b55a4f176bc55ac9fb6dc615cbc',
    expectedSizeBytes: 6_143_616,
    refusalReason:
      'DOCUMENT_LANGUAGE_MISMATCH_DECLARED_KO_REPRESENTATIVE_PAGES_ZERO_HANGUL',
    representativePages: [18, 28],
  },
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSafeOutputPath(outputPath) {
  const relative = path.relative(process.cwd(), outputPath);
  assert(
    relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    '--output must resolve to a file inside the current pilot worktree',
  );
}

function sameFileState(before, after) {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mtimeNs === after.mtimeNs
    && before.ctimeNs === after.ctimeNs;
}

async function readDescriptorBounded(handle, limitBytes, sourceId) {
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const remainingWithSentinel = (limitBytes + 1) - totalBytes;
    if (remainingWithSentinel <= 0) {
      throw new Error(`${sourceId}: source exceeded the bounded read limit`);
    }
    const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, remainingWithSentinel));
    const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, null);
    if (bytesRead === 0) break;
    totalBytes += bytesRead;
    if (totalBytes > limitBytes) {
      throw new Error(`${sourceId}: source exceeded the bounded read limit`);
    }
    chunks.push(chunk.subarray(0, bytesRead));
  }
  return Buffer.concat(chunks, totalBytes);
}

function extractPdfPageText(pdfPath, page) {
  return execFileSync(
    'pdftotext',
    ['-f', String(page), '-l', String(page), '-layout', pdfPath, '-'],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
}

function inspectRepresentativePage(pdfPath, page) {
  const text = extractPdfPageText(pdfPath, page);
  const hangulCharacterCount = (text.match(/[\uac00-\ud7a3]/gu) || []).length;
  const latinCharacterCount = (text.match(/[A-Za-z]/gu) || []).length;
  const normalized = text.toLowerCase();
  const transformerMarkerCount = [
    'transformer',
    'primary voltage',
    'secondary voltage',
    'rated power',
    'frequency',
  ].filter((marker) => normalized.includes(marker)).length;

  return {
    page,
    hangulCharacterCount,
    latinCharacterCount,
    transformerMarkerCount,
  };
}

async function inspectRepresentativePagesFromSnapshot(sourceBytes, pages) {
  const snapshotRoot = await mkdtemp(path.join(tmpdir(), 'pr207-refusal-pdf-'));
  const snapshotPath = path.join(snapshotRoot, 'source.pdf');
  try {
    await writeFile(snapshotPath, sourceBytes, { mode: 0o600, flag: 'wx' });
    return pages.map((page) => inspectRepresentativePage(snapshotPath, page));
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
}

async function inspectRefusedSource(sourceRoot, source) {
  const sourcePath = path.join(sourceRoot, source.relativePath);
  const handle = await open(sourcePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    assert(before.isFile(), `${source.sourceId}: expected a regular file`);
    assert(before.nlink === 1n, `${source.sourceId}: hardlinked source is refused`);
    assert(
      before.size === BigInt(source.expectedSizeBytes),
      `${source.sourceId}: unexpected size ${before.size}`,
    );

    const result = {
      sourceId: source.sourceId,
      sizeBytes: Number(before.size),
      refusalReason: source.refusalReason,
      refusalCheckPassed: false,
    };

    if (source.refusalReason === 'SOURCE_SIZE_EXCEEDS_25000000_BYTE_INTAKE_LIMIT') {
      result.intakeLimitBytes = SOURCE_LIMIT_BYTES;
      result.sha256Recomputed = false;
      result.sha256Check = 'NOT_COMPUTED_SOURCE_REFUSED_BEFORE_READ';
      result.refusalCheckPassed = before.size > BigInt(result.intakeLimitBytes);
    } else {
      assert(before.size <= BigInt(SOURCE_LIMIT_BYTES), `${source.sourceId}: source exceeds read bound`);
      const sourceBytes = await readDescriptorBounded(handle, SOURCE_LIMIT_BYTES, source.sourceId);
      const after = await handle.stat({ bigint: true });
      assert(sameFileState(before, after), `${source.sourceId}: source changed during bounded read`);
      assert(sourceBytes.byteLength === Number(before.size), `${source.sourceId}: incomplete bounded read`);
      const actualSha256 = sha256(sourceBytes);
      assert(
        actualSha256 === source.expectedSha256,
        `${source.sourceId}: unexpected SHA-256 ${actualSha256}`,
      );
      const representativePageChecks = await inspectRepresentativePagesFromSnapshot(
        sourceBytes,
        source.representativePages,
      );
      result.sha256 = actualSha256;
      result.sha256Recomputed = true;
      result.declaredLanguage = 'ko';
      result.representativePageChecks = representativePageChecks;
      result.refusalCheckPassed = representativePageChecks.every(
        (page) =>
          page.hangulCharacterCount === 0 &&
          page.latinCharacterCount > 500 &&
          page.transformerMarkerCount > 0,
      );
    }

    assert(result.refusalCheckPassed, `${source.sourceId}: refusal check did not pass`);
    return result;
  } finally {
    await handle.close();
  }
}

const { values } = parseArgs({
  options: {
    'source-root': { type: 'string' },
    'target-root': { type: 'string' },
    output: { type: 'string' },
  },
  strict: true,
});

assert(values['source-root'], '--source-root is required');
assert(values['target-root'], '--target-root is required');
assert(values.output, '--output is required');

const sourceRoot = path.resolve(values['source-root']);
const targetRoot = path.resolve(values['target-root']);
const outputPath = path.resolve(values.output);
assertSafeOutputPath(outputPath);

const serverModulePath = path.join(targetRoot, 'evidence-claim-workbench/server.mjs');
const { loadEvidenceInboxWorkbenchCatalog } = await import(serverModulePath);
const catalog = await loadEvidenceInboxWorkbenchCatalog({
  ownedRoot: targetRoot,
  asOf: AS_OF,
});

assert(
  catalog.intake?.mode === 'REAL_MANIFEST_BOUND' &&
    catalog.intake?.population === 'LOADED_UNVERIFIED',
  `unexpected intake state: ${catalog.intake?.mode}/${catalog.intake?.population}`,
);
assert(catalog.intake?.manifestSha256 === EXPECTED_MANIFEST_SHA256, 'unexpected manifest hash');
assert(catalog.documents.length === 8, `expected 8 accepted documents, got ${catalog.documents.length}`);

const acceptedDocuments = catalog.documents.map((document) => ({
  documentId: document.documentId,
  family: document.productFamilies.includes('transformer') ? 'transformer' : 'switchgear',
  language: document.language,
  candidateCount: document.pages.reduce(
    (total, page) => total + page.candidates.length,
    0,
  ),
}));
const acceptedByFamily = Object.fromEntries(
  ['switchgear', 'transformer'].map((family) => [
    family,
    acceptedDocuments.filter((document) => document.family === family).length,
  ]),
);
const acceptedByLanguage = Object.fromEntries(
  ['ko', 'en'].map((language) => [
    language,
    acceptedDocuments.filter((document) => document.language === language).length,
  ]),
);
const postFixCandidateCount = acceptedDocuments.reduce(
  (total, document) => total + document.candidateCount,
  0,
);

assert(acceptedByFamily.switchgear === 4, 'expected 4 accepted switchgear documents');
assert(acceptedByFamily.transformer === 4, 'expected 4 accepted transformer documents');
assert(acceptedByLanguage.ko === 4, 'expected 4 accepted Korean documents');
assert(acceptedByLanguage.en === 4, 'expected 4 accepted English documents');
assert(postFixCandidateCount === 0, `expected 0 post-fix candidates, got ${postFixCandidateCount}`);

const refusedSources = [];
for (const source of REFUSED_SOURCES) {
  refusedSources.push(await inspectRefusedSource(sourceRoot, source));
}

const report = {
  schemaVersion: 1,
  asOf: AS_OF,
  artifactClass: 'NOT_PRODUCTION_EVIDENCE',
  executionBoundary: {
    sourceScope: 'BOUNDED_PUBLISHER_DOMAIN_ASSOCIATED_FILES_AUTHENTICITY_UNREVIEWED',
    targetScope: 'LOCAL_IGNORED_EVIDENCE_INBOX_ONLY',
    refusalInspectionAuthority:
      'MACHINE_FILE_SIZE_HASH_AND_REPRESENTATIVE_PAGE_SCRIPT_NOT_HUMAN_VALIDITY_REVIEW',
    fullSourceDocumentsCommitted: false,
    customerOrPrivateDataUsed: false,
    productionOrStagingAccessed: false,
    productionReady: false,
  },
  evaluatedSourceCount: 11,
  acceptedSourceCount: acceptedDocuments.length,
  refusedSourceCount: refusedSources.length,
  acceptedByFamily,
  acceptedByLanguage,
  manifestSha256: catalog.intake.manifestSha256,
  acceptedDocuments,
  refusedSources,
  postFixCandidateCount,
  automaticVerificationEnabled: false,
  verifiedClaimCount: 0,
  customerUseAllowedCount: 0,
  humanAuthenticityDecisionCount: 0,
  humanCandidateDecisionCount: 0,
  decision: 'INCOMPLETE',
  decisionReason:
    'Human authenticity, validity, rights, and candidate review decisions are absent; the safe post-fix candidate count is zero.',
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(
  `${JSON.stringify({
    output: path.relative(process.cwd(), outputPath),
    evaluated: report.evaluatedSourceCount,
    accepted: report.acceptedSourceCount,
    refused: report.refusedSourceCount,
    postFixCandidates: report.postFixCandidateCount,
    decision: report.decision,
  })}\n`,
);
