import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  open,
  realpath
} from 'node:fs/promises';
import path from 'node:path';
import {
  EVIDENCE_DOCUMENT_LIMITS,
  EVIDENCE_INTAKE_MANIFEST_SCHEMA_VERSION,
  EVIDENCE_INTAKE_RESULT_SCHEMA_VERSION,
  NON_PRODUCTION_BOUNDARY,
  SHA256_HEX_PATTERN,
  SOURCE_DOCUMENT_MIME_TYPE,
  SOURCE_DOCUMENT_TYPE
} from './constants.mjs';
import { canonicalStringify, createSourceDocumentCatalog } from './document-bundle.mjs';
import {
  EvidenceWorkbenchValidationError,
  assertExactKeys,
  assertPlainObject,
  assertSafeMetadata,
  deepFreeze,
  fail
} from './errors.mjs';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function normalizeRelativePath(value, pathLabel) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || value.includes('%')) {
    fail('UNSAFE_INTAKE_PATH', pathLabel);
  }
  if (path.posix.isAbsolute(value) || path.posix.normalize(value) !== value || value.startsWith('./')) fail('UNSAFE_INTAKE_PATH', pathLabel);
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) fail('UNSAFE_INTAKE_PATH', pathLabel);
  return value;
}

async function inspectRoot(ownedRoot, inboxRoot) {
  if (typeof ownedRoot !== 'string' || !path.isAbsolute(ownedRoot)) fail('ABSOLUTE_OWNED_ROOT_REQUIRED', '$.ownedRoot');
  const resolvedOwnedRoot = path.resolve(ownedRoot);
  const expectedInboxRoot = path.join(resolvedOwnedRoot, 'evidence-inbox');
  const resolved = inboxRoot === undefined ? expectedInboxRoot : path.resolve(inboxRoot);
  if (resolved !== expectedInboxRoot) fail('INBOX_OUTSIDE_OWNED_ROOT_REFUSED', '$.inboxRoot');
  let ownedStats;
  try {
    ownedStats = await lstat(resolvedOwnedRoot);
  } catch {
    fail('OWNED_ROOT_NOT_FOUND', '$.ownedRoot');
  }
  if (ownedStats.isSymbolicLink()) fail('OWNED_ROOT_SYMLINK_REFUSED', '$.ownedRoot');
  if (!ownedStats.isDirectory()) fail('OWNED_ROOT_DIRECTORY_REQUIRED', '$.ownedRoot');
  let stats;
  try {
    stats = await lstat(resolved);
  } catch {
    fail('EVIDENCE_INBOX_NOT_FOUND', '$.inboxRoot');
  }
  if (stats.isSymbolicLink()) fail('INBOX_SYMLINK_REFUSED', '$.inboxRoot');
  if (!stats.isDirectory()) fail('EVIDENCE_INBOX_DIRECTORY_REQUIRED', '$.inboxRoot');
  let canonicalRoot;
  let canonicalOwnedRoot;
  try {
    canonicalOwnedRoot = await realpath(resolvedOwnedRoot);
    canonicalRoot = await realpath(resolved);
  } catch {
    fail('EVIDENCE_INBOX_NOT_FOUND', '$.inboxRoot');
  }
  if (path.dirname(canonicalRoot) !== canonicalOwnedRoot) fail('INBOX_OUTSIDE_OWNED_ROOT_REFUSED', '$.inboxRoot');
  return { resolved, canonicalRoot };
}

async function assertNoSymlinkSegments(root, relativePath, pathLabel) {
  const segments = relativePath.split('/');
  let current = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    current = path.join(current, segments[index]);
    let stats;
    try {
      stats = await lstat(current);
    } catch {
      fail('INTAKE_FILE_NOT_FOUND', pathLabel);
    }
    if (stats.isSymbolicLink()) fail('INTAKE_SYMLINK_REFUSED', pathLabel);
    if (!stats.isDirectory()) fail('INTAKE_PATH_COMPONENT_NOT_DIRECTORY', pathLabel);
  }
}

async function readBoundedRegularFile(candidate, {
  canonicalRoot,
  maximumBytes,
  pathLabel,
  missingCode,
  expectedBytes,
  expectedSha256,
  inject = {}
}) {
  let before;
  let canonicalCandidate;
  try {
    before = await lstat(candidate);
    canonicalCandidate = await realpath(candidate);
  } catch {
    fail(missingCode, pathLabel);
  }
  if (before.isSymbolicLink()) fail('INTAKE_SYMLINK_REFUSED', pathLabel);
  if (!before.isFile()) fail('INTAKE_REGULAR_FILE_REQUIRED', pathLabel);
  if (before.nlink !== 1) fail('INTAKE_HARDLINK_REFUSED', pathLabel);
  if (!isContained(canonicalRoot, canonicalCandidate)) fail('INTAKE_PATH_ESCAPE_REFUSED', pathLabel);
  if (before.size < 1 || before.size > maximumBytes) fail('INTAKE_FILE_SIZE_OUT_OF_BOUNDS', pathLabel);
  if (expectedBytes !== undefined && before.size !== expectedBytes) fail('INTAKE_FILE_SIZE_MISMATCH', pathLabel);

  let handle;
  try {
    await inject.afterIntakePathInspection?.({ candidate, pathLabel });
    handle = await open(candidate, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    const opened = await handle.stat();
    if (!opened.isFile()
      || opened.nlink !== 1
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.size !== before.size
      || opened.mtimeMs !== before.mtimeMs
      || opened.ctimeMs !== before.ctimeMs
      || opened.size < 1
      || opened.size > maximumBytes
      || (expectedBytes !== undefined && opened.size !== expectedBytes)) {
      fail('INTAKE_FILE_CHANGED_DURING_READ', pathLabel);
    }
    await inject.beforeIntakeRead?.({ candidate, pathLabel, maximumBytes });
    const readLimit = Math.min(maximumBytes, expectedBytes ?? maximumBytes);
    const chunks = [];
    let total = 0;
    while (total <= readLimit) {
      const remaining = readLimit + 1 - total;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
    }
    if (total > readLimit) fail('INTAKE_FILE_SIZE_OUT_OF_BOUNDS', pathLabel);
    const bytes = Buffer.concat(chunks, total);
    const after = await handle.stat();
    if (after.size !== bytes.byteLength
      || after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs) {
      fail('INTAKE_FILE_CHANGED_DURING_READ', pathLabel);
    }
    if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes) fail('INTAKE_FILE_SIZE_MISMATCH', pathLabel);
    const digest = sha256Bytes(bytes);
    if (expectedSha256 !== undefined && digest !== expectedSha256) fail('INTAKE_FILE_SHA256_MISMATCH', pathLabel);
    return { bytes, digest };
  } catch (error) {
    if (error instanceof EvidenceWorkbenchValidationError) throw error;
    fail('INTAKE_FILE_READ_REFUSED', pathLabel);
  } finally {
    await handle?.close().catch(() => {});
  }
}

function decodeJson(bytes, pathLabel) {
  let text;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    fail('INVALID_UTF8', pathLabel);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail('INVALID_JSON_DOCUMENT', pathLabel);
  }
}

function normalizeManifest(raw, pathLabel = '$.manifest') {
  assertPlainObject(raw, pathLabel, 'INTAKE_MANIFEST_REQUIRED');
  assertExactKeys(raw, {
    required: ['schemaVersion', 'boundary', 'productionReady', 'documents']
  }, pathLabel);
  assertSafeMetadata(raw, pathLabel);
  if (raw.schemaVersion !== EVIDENCE_INTAKE_MANIFEST_SCHEMA_VERSION) fail('UNSUPPORTED_INTAKE_MANIFEST_SCHEMA', `${pathLabel}.schemaVersion`);
  if (raw.boundary !== NON_PRODUCTION_BOUNDARY) fail('NON_PRODUCTION_BOUNDARY_REQUIRED', `${pathLabel}.boundary`);
  if (raw.productionReady !== false) fail('PRODUCTION_READY_MUST_BE_FALSE', `${pathLabel}.productionReady`);
  if (!Array.isArray(raw.documents)
    || raw.documents.length < 1
    || raw.documents.length > EVIDENCE_DOCUMENT_LIMITS.maxIntakeDocuments) {
    fail('INTAKE_DOCUMENT_COUNT_OUT_OF_BOUNDS', `${pathLabel}.documents`);
  }
  const seenPaths = new Set();
  const documents = raw.documents.map((entry, index) => {
    const entryPath = `${pathLabel}.documents[${index}]`;
    assertPlainObject(entry, entryPath, 'INVALID_INTAKE_ENTRY');
    assertExactKeys(entry, {
      required: [
        'relativePath',
        'byteLength',
        'mediaType',
        'sourceUrl',
        'publisher',
        'title',
        'documentNumber',
        'documentType',
        'revision',
        'language',
        'vertical',
        'jurisdiction',
        'domain',
        'productFamilies',
        'redistributionStatus'
      ],
      optional: ['expectedSha256']
    }, entryPath);
    const relativePath = normalizeRelativePath(entry.relativePath, `${entryPath}.relativePath`);
    if (seenPaths.has(relativePath)) fail('DUPLICATE_INTAKE_PATH', `${entryPath}.relativePath`);
    seenPaths.add(relativePath);
    const extension = path.posix.extname(relativePath).toLowerCase();
    if (entry.mediaType === 'application/pdf' || extension === '.pdf' || entry.documentType === 'PDF') fail('RAW_PDF_PARSER_UNAVAILABLE', `${entryPath}.mediaType`);
    if (entry.mediaType !== SOURCE_DOCUMENT_MIME_TYPE || extension !== '.json') fail('UNSUPPORTED_INTAKE_MEDIA_TYPE', `${entryPath}.mediaType`);
    if (entry.documentType !== SOURCE_DOCUMENT_TYPE) fail('UNSUPPORTED_INTAKE_DOCUMENT_TYPE', `${entryPath}.documentType`);
    if (entry.expectedSha256 !== undefined
      && (typeof entry.expectedSha256 !== 'string' || !SHA256_HEX_PATTERN.test(entry.expectedSha256))) {
      fail('INVALID_INTAKE_FILE_SHA256', `${entryPath}.expectedSha256`);
    }
    if (!Number.isInteger(entry.byteLength)
      || entry.byteLength < 1
      || entry.byteLength > EVIDENCE_DOCUMENT_LIMITS.maxIntakeFileBytes) {
      fail('INTAKE_FILE_SIZE_OUT_OF_BOUNDS', `${entryPath}.byteLength`);
    }
    assertPlainObject(entry.revision, `${entryPath}.revision`, 'INTAKE_REVISION_REQUIRED');
    assertExactKeys(entry.revision, { required: ['seriesId', 'revisionId', 'sequence'] }, `${entryPath}.revision`);
    for (const field of ['sourceUrl', 'publisher', 'title', 'documentNumber', 'language', 'vertical', 'jurisdiction', 'domain', 'redistributionStatus']) {
      if (typeof entry[field] !== 'string' || !entry[field]) fail('INVALID_INTAKE_METADATA', `${entryPath}.${field}`);
    }
    if (typeof entry.revision.seriesId !== 'string'
      || !entry.revision.seriesId
      || typeof entry.revision.revisionId !== 'string'
      || !entry.revision.revisionId
      || !Number.isInteger(entry.revision.sequence)
      || entry.revision.sequence < 1) {
      fail('INVALID_INTAKE_METADATA', `${entryPath}.revision`);
    }
    if (!Array.isArray(entry.productFamilies)
      || entry.productFamilies.length < 1
      || entry.productFamilies.some((family) => typeof family !== 'string' || !family)) {
      fail('INVALID_INTAKE_METADATA', `${entryPath}.productFamilies`);
    }
    const normalized = {
      relativePath,
      byteLength: entry.byteLength,
      mediaType: SOURCE_DOCUMENT_MIME_TYPE,
      sourceUrl: entry.sourceUrl,
      publisher: entry.publisher,
      title: entry.title,
      documentNumber: entry.documentNumber,
      documentType: SOURCE_DOCUMENT_TYPE,
      revision: {
        seriesId: entry.revision.seriesId,
        revisionId: entry.revision.revisionId,
        sequence: entry.revision.sequence
      },
      language: entry.language,
      vertical: entry.vertical,
      jurisdiction: entry.jurisdiction,
      domain: entry.domain,
      productFamilies: entry.productFamilies,
      redistributionStatus: entry.redistributionStatus
    };
    if (entry.expectedSha256) normalized.expectedSha256 = entry.expectedSha256;
    return normalized;
  });
  return { documents };
}

function assertManifestMatchesDocument(entry, document, pathLabel) {
  const expected = {
    sourceUrl: document.source.sourceUrl,
    publisher: document.source.publisher,
    title: document.source.title,
    documentNumber: document.source.documentNumber,
    documentType: document.source.documentType,
    revision: {
      seriesId: document.revision.seriesId,
      revisionId: document.revision.revisionId,
      sequence: document.revision.sequence
    },
    language: document.source.language,
    vertical: document.source.vertical,
    jurisdiction: document.source.jurisdiction,
    domain: document.source.domain,
    productFamilies: document.source.productFamilies,
    redistributionStatus: document.source.redistributionStatus
  };
  const actual = Object.fromEntries(Object.keys(expected).map((key) => [key, entry[key]]));
  if (canonicalStringify(actual) !== canonicalStringify(expected)) fail('INTAKE_METADATA_MISMATCH', pathLabel);
}

export async function loadEvidenceInbox({ ownedRoot, inboxRoot, asOf, manifestName = 'manifest.json', inject = {} } = {}) {
  if (manifestName !== 'manifest.json') fail('FIXED_INTAKE_MANIFEST_NAME_REQUIRED', '$.manifestName');
  const { resolved, canonicalRoot } = await inspectRoot(ownedRoot, inboxRoot);
  const manifestPath = path.join(resolved, manifestName);
  const manifestRead = await readBoundedRegularFile(manifestPath, {
    canonicalRoot,
    maximumBytes: EVIDENCE_DOCUMENT_LIMITS.maxManifestBytes,
    pathLabel: '$.manifest',
    missingCode: 'INTAKE_MANIFEST_NOT_FOUND',
    inject
  });
  const manifest = normalizeManifest(decodeJson(manifestRead.bytes, '$.manifest'));
  const loaded = [];
  const records = [];

  for (let index = 0; index < manifest.documents.length; index += 1) {
    const entry = manifest.documents[index];
    const filePath = path.resolve(resolved, ...entry.relativePath.split('/'));
    if (!isContained(resolved, filePath)) fail('INTAKE_PATH_ESCAPE_REFUSED', `$.manifest.documents[${index}].relativePath`);
    await assertNoSymlinkSegments(resolved, entry.relativePath, `$.manifest.documents[${index}].relativePath`);
    const read = await readBoundedRegularFile(filePath, {
      canonicalRoot,
      maximumBytes: EVIDENCE_DOCUMENT_LIMITS.maxIntakeFileBytes,
      pathLabel: `$.manifest.documents[${index}]`,
      missingCode: 'INTAKE_FILE_NOT_FOUND',
      expectedBytes: entry.byteLength,
      expectedSha256: entry.expectedSha256,
      inject
    });
    const rawDocument = decodeJson(read.bytes, `$.documents[${index}]`);
    loaded.push(rawDocument);
    records.push({
      relativePath: entry.relativePath,
      fileSha256: read.digest,
      byteLength: read.bytes.byteLength
    });
  }

  const catalog = createSourceDocumentCatalog(loaded, { asOf, path: '$.documents' });
  const documents = catalog.documents;
  const documentIdBySourceFileHash = new Map(documents.map((document) => [document.file.sha256, document.documentId]));
  const documentBySourceFileHash = new Map(documents.map((document) => [document.file.sha256, document]));
  const normalizedRecords = records.map((record, index) => ({
    ...record,
    documentId: documentIdBySourceFileHash.get(loaded[index]?.file?.sha256) || ''
  }));
  manifest.documents.forEach((entry, index) => {
    const document = documentBySourceFileHash.get(loaded[index]?.file?.sha256);
    if (!document) fail('INTAKE_DOCUMENT_ASSOCIATION_FAILED', `$.manifest.documents[${index}]`);
    assertManifestMatchesDocument(entry, document, `$.manifest.documents[${index}]`);
  });
  return deepFreeze({
    schemaVersion: EVIDENCE_INTAKE_RESULT_SCHEMA_VERSION,
    boundary: NON_PRODUCTION_BOUNDARY,
    productionReady: false,
    asOf: catalog.asOf,
    manifest: {
      fileSha256: manifestRead.digest,
      documentCount: manifest.documents.length,
      records: normalizedRecords
    },
    catalog
  });
}
