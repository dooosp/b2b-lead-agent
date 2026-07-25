import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  link,
  mkdir,
  mkdtemp,
  rename,
  rm,
  stat,
  symlink,
  utimes,
  writeFile
} from 'node:fs/promises';
import {
  computeNormalizedContentSha256,
  sha256
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { loadEvidenceInbox } from '../evidence-claim-workbench/domain/intake.mjs';
import { EvidenceWorkbenchValidationError } from '../evidence-claim-workbench/domain/errors.mjs';

const AS_OF = '2026-07-17T00:00:00.000Z';

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function makeBundle({ title = 'Synthetic Transformer Data Sheet', documentNumber = 'SYN-TR-001', sourceSha = sha256('source tr 001') } = {}) {
  const pages = [{
    pageNumber: 1,
    locator: { type: 'DOCUMENT_PAGE', value: '1' },
    text: '정격 용량 2500 kVA. Primary voltage 22.9 kV.'
  }];
  return {
    schemaVersion: 'source-document-bundle-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    synthetic: true,
    source: {
      sourceClass: 'SYNTHETIC_FIXTURE',
      publisher: 'Synthetic Transformer Publisher',
      title,
      documentNumber,
      sourceUrl: `https://synthetic.example/documents/${documentNumber.toLowerCase()}`,
      documentType: 'NORMALIZED_PAGE_TEXT_JSON',
      mimeType: 'application/json',
      language: 'en',
      vertical: 'datacenter',
      jurisdiction: 'KR',
      domain: 'electrical_power',
      productFamilies: ['transformer'],
      authenticityStatus: 'UNREVIEWED',
      redistributionStatus: 'SYNTHETIC_FIXTURE_REDISTRIBUTION_PERMITTED'
    },
    revision: {
      seriesId: documentNumber.toLowerCase(),
      revisionId: 'R1',
      sequence: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
      effectiveAt: '2026-01-02T00:00:00.000Z',
      retrievedAt: '2026-07-01T00:00:00.000Z'
    },
    file: {
      sha256: sourceSha,
      byteLength: 8192,
      contentSha256: computeNormalizedContentSha256(pages)
    },
    extraction: {
      method: 'PREEXTRACTED_PAGE_TEXT',
      extractorName: 'fixture',
      extractorVersion: '1',
      extractedAt: '2026-07-02T00:00:00.000Z',
      normalizationVersion: 'page-text-nfc-lf-codepoint-v1'
    },
    pages
  };
}

function makeManifestEntry(bundle, relativePath, bytes, { includeHash = true } = {}) {
  const entry = {
    relativePath,
    byteLength: bytes.byteLength,
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
  if (includeHash) entry.expectedSha256 = digest(bytes);
  return entry;
}

function makeManifest(entries) {
  return {
    schemaVersion: 'official-evidence-intake-manifest-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    documents: entries
  };
}

async function makeOwnedRoot(t) {
  const ownedRoot = await mkdtemp(path.join(tmpdir(), 'official-evidence-intake-'));
  const inboxRoot = path.join(ownedRoot, 'evidence-inbox');
  await mkdir(inboxRoot);
  t.after(() => rm(ownedRoot, { recursive: true, force: true }));
  return { ownedRoot, inboxRoot };
}

async function writeManifest(inboxRoot, manifest) {
  await writeFile(path.join(inboxRoot, 'manifest.json'), JSON.stringify(manifest));
}

async function expectRejectCode(code, action) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof EvidenceWorkbenchValidationError);
    assert.equal(error.code, code);
    assert.ok(!error.message.includes(tmpdir()));
    return true;
  });
}

test('loads only a manifest-bound normalized JSON bundle from the exact owned evidence-inbox', async (t) => {
  const { ownedRoot, inboxRoot } = await makeOwnedRoot(t);
  const bundle = makeBundle();
  const bytes = Buffer.from(JSON.stringify(bundle));
  await writeFile(path.join(inboxRoot, 'transformer.json'), bytes);
  await writeManifest(inboxRoot, makeManifest([makeManifestEntry(bundle, 'transformer.json', bytes)]));

  const result = await loadEvidenceInbox({ ownedRoot, asOf: AS_OF });
  assert.equal(result.schemaVersion, 'official-evidence-intake-result-v0');
  assert.equal(result.productionReady, false);
  assert.equal(result.catalog.documents.length, 1);
  assert.equal(result.catalog.documents[0].source.documentNumber, 'SYN-TR-001');
  assert.equal(result.manifest.documentCount, 1);
  assert.equal(result.manifest.records[0].relativePath, 'transformer.json');
  assert.equal(result.manifest.records[0].fileSha256, digest(bytes));
  assert.match(result.manifest.records[0].documentId, /^doc_[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(result.catalog.documents[0]));
});

test('optional expected hash is supported, but a provided hash and byte length fail closed on mismatch', async (t) => {
  const { ownedRoot, inboxRoot } = await makeOwnedRoot(t);
  const bundle = makeBundle();
  const bytes = Buffer.from(JSON.stringify(bundle));
  await writeFile(path.join(inboxRoot, 'transformer.json'), bytes);

  const noHash = makeManifestEntry(bundle, 'transformer.json', bytes, { includeHash: false });
  await writeManifest(inboxRoot, makeManifest([noHash]));
  assert.equal((await loadEvidenceInbox({ ownedRoot, asOf: AS_OF })).catalog.documents.length, 1);

  const badHash = makeManifestEntry(bundle, 'transformer.json', bytes);
  badHash.expectedSha256 = '0'.repeat(64);
  await writeManifest(inboxRoot, makeManifest([badHash]));
  await expectRejectCode('INTAKE_FILE_SHA256_MISMATCH', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));

  const badSize = makeManifestEntry(bundle, 'transformer.json', bytes);
  badSize.byteLength += 1;
  await writeManifest(inboxRoot, makeManifest([badSize]));
  await expectRejectCode('INTAKE_FILE_SIZE_MISMATCH', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));
});

test('manifest source metadata is substitution-resistant and cross-checked field by field', async (t) => {
  const { ownedRoot, inboxRoot } = await makeOwnedRoot(t);
  const bundle = makeBundle();
  const bytes = Buffer.from(JSON.stringify(bundle));
  await writeFile(path.join(inboxRoot, 'transformer.json'), bytes);
  const fields = [
    ['sourceUrl', 'https://synthetic.example/substituted'],
    ['publisher', 'Substituted Publisher'],
    ['title', 'Substituted title'],
    ['documentNumber', 'SUB-999'],
    ['language', 'ko'],
    ['vertical', 'other'],
    ['jurisdiction', 'US'],
    ['domain', 'other'],
    ['productFamilies', ['medium_voltage_switchgear']],
    ['redistributionStatus', 'METADATA_AND_BOUNDED_EXCERPTS_ONLY']
  ];
  for (const [field, value] of fields) {
    const entry = makeManifestEntry(bundle, 'transformer.json', bytes);
    entry[field] = value;
    await writeManifest(inboxRoot, makeManifest([entry]));
    await expectRejectCode('INTAKE_METADATA_MISMATCH', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));
  }
  const revisionEntry = makeManifestEntry(bundle, 'transformer.json', bytes);
  revisionEntry.revision.revisionId = 'R2';
  await writeManifest(inboxRoot, makeManifest([revisionEntry]));
  await expectRejectCode('INTAKE_METADATA_MISMATCH', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));
});

test('arbitrary roots, traversal, hidden paths, backslashes, and percent-encoded paths are refused', async (t) => {
  const first = await makeOwnedRoot(t);
  const second = await makeOwnedRoot(t);
  await expectRejectCode('INBOX_OUTSIDE_OWNED_ROOT_REFUSED', () => loadEvidenceInbox({
    ownedRoot: first.ownedRoot,
    inboxRoot: second.inboxRoot,
    asOf: AS_OF
  }));

  const bundle = makeBundle();
  const bytes = Buffer.from(JSON.stringify(bundle));
  for (const unsafe of ['../outside.json', '.hidden.json', 'nested\\file.json', '%2e%2e/file.json', '/absolute.json']) {
    await writeManifest(first.inboxRoot, makeManifest([makeManifestEntry(bundle, unsafe, bytes)]));
    await expectRejectCode('UNSAFE_INTAKE_PATH', () => loadEvidenceInbox({ ownedRoot: first.ownedRoot, asOf: AS_OF }));
  }
  await expectRejectCode('ABSOLUTE_OWNED_ROOT_REQUIRED', () => loadEvidenceInbox({ ownedRoot: 'relative', asOf: AS_OF }));
});

test('raw PDF and every non-JSON document type are typed refusals without parser invocation', async (t) => {
  const { ownedRoot, inboxRoot } = await makeOwnedRoot(t);
  const bundle = makeBundle();
  const bytes = Buffer.from('not parsed');
  const pdf = makeManifestEntry(bundle, 'source.pdf', bytes);
  pdf.mediaType = 'application/pdf';
  pdf.documentType = 'PDF';
  await writeManifest(inboxRoot, makeManifest([pdf]));
  await expectRejectCode('RAW_PDF_PARSER_UNAVAILABLE', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));

  const unsupported = makeManifestEntry(bundle, 'source.txt', bytes);
  unsupported.mediaType = 'text/plain';
  unsupported.documentType = 'TEXT';
  await writeManifest(inboxRoot, makeManifest([unsupported]));
  await expectRejectCode('UNSUPPORTED_INTAKE_MEDIA_TYPE', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));
});

test('symlink, hardlink, nested symlink, and symlinked inbox roots are refused', async (t) => {
  const { ownedRoot, inboxRoot } = await makeOwnedRoot(t);
  const bundle = makeBundle();
  const bytes = Buffer.from(JSON.stringify(bundle));
  const target = path.join(inboxRoot, 'target.json');
  await writeFile(target, bytes);

  await symlink(target, path.join(inboxRoot, 'linked.json'));
  await writeManifest(inboxRoot, makeManifest([makeManifestEntry(bundle, 'linked.json', bytes)]));
  await expectRejectCode('INTAKE_SYMLINK_REFUSED', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));

  await link(target, path.join(inboxRoot, 'hard.json'));
  await writeManifest(inboxRoot, makeManifest([makeManifestEntry(bundle, 'hard.json', bytes)]));
  await expectRejectCode('INTAKE_HARDLINK_REFUSED', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));

  const realDirectory = path.join(inboxRoot, 'real-directory');
  await mkdir(realDirectory);
  await writeFile(path.join(realDirectory, 'nested.json'), bytes);
  await symlink(realDirectory, path.join(inboxRoot, 'linked-directory'));
  await writeManifest(inboxRoot, makeManifest([makeManifestEntry(bundle, 'linked-directory/nested.json', bytes)]));
  await expectRejectCode('INTAKE_SYMLINK_REFUSED', () => loadEvidenceInbox({ ownedRoot, asOf: AS_OF }));

  const otherOwned = await mkdtemp(path.join(tmpdir(), 'official-evidence-symlink-root-'));
  t.after(() => rm(otherOwned, { recursive: true, force: true }));
  await symlink(inboxRoot, path.join(otherOwned, 'evidence-inbox'));
  await expectRejectCode('INBOX_SYMLINK_REFUSED', () => loadEvidenceInbox({ ownedRoot: otherOwned, asOf: AS_OF }));
});

test('descriptor identity is checked before any bounded read after a path-swap race', async (t) => {
  const { ownedRoot, inboxRoot } = await makeOwnedRoot(t);
  const bundle = makeBundle();
  const bytes = Buffer.from(JSON.stringify(bundle));
  const candidate = path.join(inboxRoot, 'transformer.json');
  await writeFile(candidate, bytes);
  await writeManifest(inboxRoot, makeManifest([makeManifestEntry(bundle, 'transformer.json', bytes)]));
  let readStarted = 0;
  let swapped = false;
  await expectRejectCode('INTAKE_FILE_CHANGED_DURING_READ', () => loadEvidenceInbox({
    ownedRoot,
    asOf: AS_OF,
    inject: {
      async afterIntakePathInspection({ pathLabel }) {
        if (pathLabel !== '$.manifest.documents[0]' || swapped) return;
        swapped = true;
        await rename(candidate, `${candidate}.original`);
        await writeFile(candidate, Buffer.from('{}'));
      },
      beforeIntakeRead({ pathLabel }) {
        if (pathLabel === '$.manifest.documents[0]') readStarted += 1;
      }
    }
  }));
  assert.equal(swapped, true);
  assert.equal(readStarted, 0);
});

test('same-inode same-size substitution with restored mtime is refused without an expected hash', async (t) => {
  const { ownedRoot, inboxRoot } = await makeOwnedRoot(t);
  const bundle = makeBundle();
  const originalBytes = Buffer.from(JSON.stringify(bundle));
  const substituted = structuredClone(bundle);
  substituted.pages[0].text = substituted.pages[0].text.replace('2500', '2600');
  substituted.file.contentSha256 = computeNormalizedContentSha256(substituted.pages);
  const substitutedBytes = Buffer.from(JSON.stringify(substituted));
  assert.equal(substitutedBytes.byteLength, originalBytes.byteLength);
  const candidate = path.join(inboxRoot, 'transformer.json');
  await writeFile(candidate, originalBytes);
  const originalStat = await stat(candidate);
  await writeManifest(inboxRoot, makeManifest([
    makeManifestEntry(bundle, 'transformer.json', originalBytes, { includeHash: false })
  ]));
  let substitutedDuringRead = false;
  await expectRejectCode('INTAKE_FILE_CHANGED_DURING_READ', () => loadEvidenceInbox({
    ownedRoot,
    asOf: AS_OF,
    inject: {
      async beforeIntakeRead({ pathLabel }) {
        if (pathLabel !== '$.manifest.documents[0]' || substitutedDuringRead) return;
        substitutedDuringRead = true;
        await writeFile(candidate, substitutedBytes);
        await utimes(candidate, originalStat.atime, originalStat.mtime);
      }
    }
  }));
  assert.equal(substitutedDuringRead, true);
});

test('fatal UTF-8, malformed JSON, prototype keys, oversized manifests, and duplicate document identities are refused', async (t) => {
  const first = await makeOwnedRoot(t);
  const bundle = makeBundle();
  const invalidUtf8 = Buffer.from([0xc3, 0x28]);
  await writeFile(path.join(first.inboxRoot, 'bad.json'), invalidUtf8);
  await writeManifest(first.inboxRoot, makeManifest([makeManifestEntry(bundle, 'bad.json', invalidUtf8)]));
  await expectRejectCode('INVALID_UTF8', () => loadEvidenceInbox({ ownedRoot: first.ownedRoot, asOf: AS_OF }));

  const malformed = Buffer.from('{');
  await writeFile(path.join(first.inboxRoot, 'bad.json'), malformed);
  await writeManifest(first.inboxRoot, makeManifest([makeManifestEntry(bundle, 'bad.json', malformed)]));
  await expectRejectCode('INVALID_JSON_DOCUMENT', () => loadEvidenceInbox({ ownedRoot: first.ownedRoot, asOf: AS_OF }));

  const pollutedManifest = JSON.parse(`${JSON.stringify(makeManifest([])).slice(0, -1)},"__proto__":{"polluted":true}}`);
  await writeManifest(first.inboxRoot, pollutedManifest);
  await expectRejectCode('PROTOTYPE_KEY_REFUSED', () => loadEvidenceInbox({ ownedRoot: first.ownedRoot, asOf: AS_OF }));

  await writeFile(path.join(first.inboxRoot, 'manifest.json'), 'x'.repeat(256_001));
  await expectRejectCode('INTAKE_FILE_SIZE_OUT_OF_BOUNDS', () => loadEvidenceInbox({ ownedRoot: first.ownedRoot, asOf: AS_OF }));

  const second = await makeOwnedRoot(t);
  const bytes = Buffer.from(JSON.stringify(bundle));
  await writeFile(path.join(second.inboxRoot, 'one.json'), bytes);
  await writeFile(path.join(second.inboxRoot, 'two.json'), bytes);
  await writeManifest(second.inboxRoot, makeManifest([
    makeManifestEntry(bundle, 'one.json', bytes),
    makeManifestEntry(bundle, 'two.json', bytes)
  ]));
  await expectRejectCode('DUPLICATE_DOCUMENT_ID', () => loadEvidenceInbox({ ownedRoot: second.ownedRoot, asOf: AS_OF }));
});
