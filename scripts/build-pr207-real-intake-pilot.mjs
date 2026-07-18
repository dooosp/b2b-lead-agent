#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  mkdir,
  mkdtemp,
  open,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const AS_OF = '2026-07-18T13:00:48.000Z';
const SOURCE_LIMIT_BYTES = 25_000_000;

const DOCUMENTS = Object.freeze([
  {
    id: 'ls-p01100-ko',
    relativeSourcePath: 'switchgear/ls-p01100-ko.html',
    expectedSourceSha256: '5b56ee75613d57faad09dd42d2d0dd344b679554e87ee4a33c038d64a9005dfd',
    kind: 'LS_PRODUCT_HTML',
    publisher: 'LS ELECTRIC Co., Ltd.',
    title: '고압 일반배전반',
    documentNumber: 'P01100',
    sourceUrl: 'https://www.ls-electric.com/ko/product/view/P01100',
    language: 'ko',
    productFamily: 'medium_voltage_switchgear',
    revision: {
      seriesId: 'ls-p01100',
      revisionId: '2022-12-14',
      sequence: 1,
      publishedAt: '2016-11-26T00:14:09.000Z',
      effectiveAt: '2022-12-13T15:33:49.000Z'
    }
  },
  {
    id: 'ls-p02201-ko',
    relativeSourcePath: 'switchgear/ls-p02201-ko.html',
    expectedSourceSha256: '4889d94784f7c933b524a8260024ec9cf978a1f0a39fda3137750690867f68c2',
    kind: 'LS_PRODUCT_HTML',
    publisher: 'LS ELECTRIC Co., Ltd.',
    title: 'C-GIS 큐비클 가스절연개폐장치',
    documentNumber: 'P02201',
    sourceUrl: 'https://www.ls-electric.com/ko/product/view/P02201',
    language: 'ko',
    productFamily: 'medium_voltage_switchgear',
    revision: {
      seriesId: 'ls-p02201',
      revisionId: '2022-12-21',
      sequence: 1,
      publishedAt: '2021-01-11T05:03:33.000Z',
      effectiveAt: '2022-12-21T13:23:27.000Z'
    }
  },
  {
    id: 'ls-mv-metal-clad-en',
    relativeSourcePath: 'switchgear/ls-mv-metal-clad-en-201112.pdf',
    expectedSourceSha256: '190708b9d00cadbe7aa9b6ccb78afe6220d834b00d2d3330644b138cc22de6da',
    kind: 'PDF',
    pages: [14, 15, 20],
    publisher: 'LS ELECTRIC Co., Ltd.',
    title: 'Medium Voltage Metal Clad Switchgear',
    documentNumber: 'LS-MV-MCSG-EN-201112',
    sourceUrl: 'https://www.ls-electric.com/upload/customer/download/2619/Medium%20Voltage%20Metal%20Clad%20Swichgear_E.pdf',
    language: 'en',
    productFamily: 'medium_voltage_switchgear',
    revision: {
      seriesId: 'ls-mv-mcsg-en',
      revisionId: '2011.12-01',
      sequence: 1,
      publishedAt: '2011-12-01T00:00:00.000Z',
      effectiveAt: '2011-12-01T00:00:00.000Z'
    }
  },
  {
    id: 'schneider-masterclad-en',
    relativeSourcePath: 'switchgear/schneider-masterclad-en-6055ct9901-r05-2024.pdf',
    expectedSourceSha256: '3aef01e0ff85000bff61c327b09ecfa02e65b7e1ba2d1a4fd0f22cba2203a7ae',
    kind: 'PDF',
    pages: [5, 6, 8],
    publisher: 'Schneider Electric',
    title: '27 kV Masterclad Medium Voltage Metal-Clad Switchgear Catalog',
    documentNumber: '6055CT9901',
    sourceUrl: 'https://productinfo.se.com/6055ct9901_masterclad_mvmc_sg_catalog/6055ct9901-masterclad-mvmc-switchgear-catalog/English/6055CT9901.pdf',
    language: 'en',
    productFamily: 'medium_voltage_switchgear',
    revision: {
      seriesId: 'schneider-6055ct9901',
      revisionId: 'R05-2024',
      sequence: 5,
      publishedAt: '2024-05-21T11:07:45.000Z',
      effectiveAt: '2024-05-21T11:07:45.000Z'
    }
  },
  {
    id: 'ls-cast-resin-ko',
    relativeSourcePath: 'transformer/ls-cast-resin-ko-c84001-9-202601.pdf',
    expectedSourceSha256: 'b2156454bb94ee12526fe6a77b717bcc7363cb2f5b1d68e05866b412d268ad2a',
    kind: 'PDF',
    pages: [3, 15],
    publisher: 'LS ELECTRIC Co., Ltd.',
    title: '몰드변압기 Premium Type 카탈로그',
    documentNumber: 'C84001-9-202601',
    sourceUrl: 'https://www.ls-electric.com/ko/product/view/P01109',
    language: 'ko',
    productFamily: 'transformer',
    revision: {
      seriesId: 'ls-c84001',
      revisionId: 'C84001-9-202601',
      sequence: 9,
      publishedAt: '2026-01-01T00:00:00.000Z',
      effectiveAt: '2026-01-01T00:00:00.000Z'
    }
  },
  {
    id: 'ls-cast-resin-manual-ko',
    relativeSourcePath: 'transformer/ls-cast-resin-manual-ko-202204.pdf',
    expectedSourceSha256: '0b286384a90e6d44d3959441a449cf69c1b6922ba302a96345999a1c8a7c0481',
    kind: 'PDF',
    pages: [13, 14, 20, 26],
    publisher: 'LS ELECTRIC Co., Ltd.',
    title: '몰드변압기 사용설명서',
    documentNumber: 'LS-CAST-RESIN-MANUAL-KO-202204',
    sourceUrl: 'https://www.ls-electric.com/ko/product/view/P01109',
    language: 'ko',
    productFamily: 'transformer',
    revision: {
      seriesId: 'ls-cast-resin-manual-ko',
      revisionId: '2022.04-03',
      sequence: 3,
      publishedAt: '2022-04-01T00:00:00.000Z',
      effectiveAt: '2022-04-01T00:00:00.000Z'
    }
  },
  {
    id: 'ls-transformer-en',
    relativeSourcePath: 'transformer/ls-transformer-en-180316.pdf',
    expectedSourceSha256: 'fc44eabb92b864c45c2c6279c7f753be1c99958da283eb18651fea3a4323a689',
    kind: 'PDF',
    pages: [19, 23],
    publisher: 'LS ELECTRIC Co., Ltd.',
    title: 'Transformer Catalog',
    documentNumber: 'LS-TRANSFORMER-EN-201803',
    sourceUrl: 'https://www.ls-electric.com/products/category/Smart_Power_Solution/Power_Distribution/Transformer',
    language: 'en',
    productFamily: 'transformer',
    revision: {
      seriesId: 'ls-transformer-en',
      revisionId: '2018.03-02',
      sequence: 2,
      publishedAt: '2018-03-01T00:00:00.000Z',
      effectiveAt: '2018-03-01T00:00:00.000Z'
    }
  },
  {
    id: 'schneider-trihal-en',
    relativeSourcePath: 'transformer/schneider-trihal-en-nrjed315663en.pdf',
    expectedSourceSha256: '04faa079a37613b076404c033c715d019bd7a77237b190301caddef85055726b',
    kind: 'PDF',
    pages: [18, 28, 31, 33],
    publisher: 'Schneider Electric',
    title: 'Trihal Cast Resin Dry Type Transformers up to 15 MVA - 36 kV',
    documentNumber: 'NRJED315663EN',
    sourceUrl: 'https://www.se.com/sg/en/download/document/NRJED315663EN/',
    language: 'en',
    productFamily: 'transformer',
    revision: {
      seriesId: 'schneider-nrjed315663en',
      revisionId: '3.1',
      sequence: 31,
      publishedAt: '2018-04-03T00:00:00.000Z',
      effectiveAt: '2018-04-03T00:00:00.000Z'
    }
  }
]);

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
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
      throw new Error(`${sourceId} source exceeded the bounded read limit`);
    }
    const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, remainingWithSentinel));
    const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, null);
    if (bytesRead === 0) break;
    totalBytes += bytesRead;
    if (totalBytes > limitBytes) {
      throw new Error(`${sourceId} source exceeded the bounded read limit`);
    }
    chunks.push(chunk.subarray(0, bytesRead));
  }
  return Buffer.concat(chunks, totalBytes);
}

async function readBoundedImmutableSource(sourcePath, definition) {
  const handle = await open(sourcePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) throw new Error(`${definition.id} source is not a regular file`);
    if (before.nlink !== 1n) throw new Error(`${definition.id} hardlinked source is refused`);
    if (before.size < 1n || before.size > BigInt(SOURCE_LIMIT_BYTES)) {
      throw new Error(`${definition.id} source size is outside PR #207 bounds`);
    }

    const sourceBytes = await readDescriptorBounded(handle, SOURCE_LIMIT_BYTES, definition.id);
    const after = await handle.stat({ bigint: true });
    if (!sameFileState(before, after) || sourceBytes.byteLength !== Number(before.size)) {
      throw new Error(`${definition.id} source changed during the bounded read`);
    }
    if (digest(sourceBytes) !== definition.expectedSourceSha256) {
      throw new Error(`${definition.id} source hash does not match the bounded pilot ledger`);
    }
    return sourceBytes;
  } finally {
    await handle.close();
  }
}

function decodeHtmlEntities(value) {
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&apos;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&');
  }
  return decoded;
}

function normalizeTechnicalLine(value, { collapseWhitespace = true } = {}) {
  const normalized = value.replace(/(\S)\s*\/\s*(?=\S)/gu, '$1/');
  return (collapseWhitespace ? normalized.replace(/\s+/gu, ' ') : normalized).trim();
}

function htmlFragmentToText(value) {
  return decodeHtmlEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, '')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/t[dh]>/giu, ' | ')
    .replace(/<\/(?:tr|li|p|div|ul|ol|h[1-6])>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .split(/\r?\n/u)
    .map((line) => normalizeTechnicalLine(line.replace(/(?:\s*\|\s*)+$/u, '')))
    .filter(Boolean)
    .join('\n');
}

function extractHiddenJson(html, id) {
  const expression = new RegExp(`id="${id}" value="([\\s\\S]*?)"\\s*\\/>`, 'u');
  const match = html.match(expression);
  if (!match) throw new Error(`missing ${id}`);
  return JSON.parse(decodeHtmlEntities(match[1]));
}

function extractLsProductPages(html) {
  const entity = extractHiddenJson(html, 'hd_entity');
  const contents = extractHiddenJson(html, 'hd_contents');
  const overview = [
    entity.p_name,
    entity.p_full_name,
    htmlFragmentToText(entity.p_summary || ''),
    htmlFragmentToText(entity.c_summary || '')
  ].filter(Boolean).join('\n');
  const detail = contents.map((item) => [
    item.pc_title,
    htmlFragmentToText(item.pc_content || '')
  ].filter(Boolean).join('\n')).join('\n');
  if (!overview || !detail) throw new Error('LS product page did not yield bounded product content');
  return [
    { locator: { type: 'SECTION', value: 'official-product-page:overview' }, text: overview },
    { locator: { type: 'SECTION', value: 'official-product-page:technical-content' }, text: detail }
  ];
}

function normalizePdfText(value) {
  return value
    .replaceAll('\f', '')
    .replaceAll('\u0007', '•')
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => normalizeTechnicalLine(line, { collapseWhitespace: false }))
    .join('\n')
    .replace(/^\n+|\n+$/gu, '');
}

function extractPdfPages(sourcePath, pageNumbers) {
  return pageNumbers.map((sourcePage) => {
    const text = normalizePdfText(execFileSync('pdftotext', [
      '-f', String(sourcePage),
      '-l', String(sourcePage),
      '-layout',
      '-enc', 'UTF-8',
      sourcePath,
      '-'
    ], { encoding: 'utf8', maxBuffer: 2_000_000 }));
    if (!text) throw new Error(`empty PDF text at source page ${sourcePage}`);
    return {
      locator: { type: 'DOCUMENT_PAGE', value: String(sourcePage) },
      text
    };
  });
}

async function extractPdfPagesFromSnapshot(sourceBytes, pageNumbers) {
  const snapshotRoot = await mkdtemp(path.join(tmpdir(), 'pr207-pilot-pdf-'));
  const snapshotPath = path.join(snapshotRoot, 'source.pdf');
  try {
    await writeFile(snapshotPath, sourceBytes, { mode: 0o600, flag: 'wx' });
    return extractPdfPages(snapshotPath, pageNumbers);
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
}

function manifestEntry(bundle, relativePath, bytes) {
  return {
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
    redistributionStatus: bundle.source.redistributionStatus,
    expectedSha256: digest(bytes)
  };
}

const { values } = parseArgs({
  options: {
    'source-root': { type: 'string' },
    'target-root': { type: 'string' }
  },
  strict: true
});

if (!values['source-root'] || !path.isAbsolute(values['source-root'])) {
  throw new Error('--source-root must be an absolute directory');
}
if (!values['target-root'] || !path.isAbsolute(values['target-root'])) {
  throw new Error('--target-root must be an absolute PR #207 worktree');
}

const sourceRoot = path.resolve(values['source-root']);
const targetRoot = path.resolve(values['target-root']);
const finalInbox = path.join(targetRoot, 'evidence-inbox');
const stagingInbox = path.join(targetRoot, 'evidence-inbox.building');

await access(path.join(targetRoot, 'evidence-claim-workbench/domain/document-bundle.mjs'), fsConstants.R_OK);
for (const target of [finalInbox, stagingInbox]) {
  try {
    await access(target);
    throw new Error(`${path.basename(target)} already exists; refusing to overwrite`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const documentModuleUrl = pathToFileURL(path.join(
  targetRoot,
  'evidence-claim-workbench/domain/document-bundle.mjs'
)).href;
const {
  computeNormalizedContentSha256,
  normalizeSourceDocumentBundle
} = await import(documentModuleUrl);

await mkdir(stagingInbox, { recursive: false, mode: 0o700 });
const entries = [];
const results = [];

for (const definition of DOCUMENTS) {
  const sourcePath = path.join(sourceRoot, definition.relativeSourcePath);
  const sourceBytes = await readBoundedImmutableSource(sourcePath, definition);
  const extractedPages = definition.kind === 'PDF'
    ? await extractPdfPagesFromSnapshot(sourceBytes, definition.pages)
    : extractLsProductPages(sourceBytes.toString('utf8'));
  const pages = extractedPages.map((page, index) => ({
    pageNumber: index + 1,
    locator: page.locator,
    text: page.text
  }));
  const rawBundle = {
    schemaVersion: 'source-document-bundle-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    synthetic: false,
    source: {
      sourceClass: 'PUBLISHER_DOMAIN_ASSOCIATED_UNREVIEWED',
      publisher: definition.publisher,
      title: definition.title,
      documentNumber: definition.documentNumber,
      sourceUrl: definition.sourceUrl,
      documentType: 'NORMALIZED_PAGE_TEXT_JSON',
      mimeType: 'application/json',
      language: definition.language,
      vertical: 'datacenter',
      jurisdiction: 'KR',
      domain: 'electrical_power',
      productFamilies: [definition.productFamily],
      authenticityStatus: 'UNREVIEWED',
      redistributionStatus: 'METADATA_AND_BOUNDED_EXCERPTS_ONLY'
    },
    revision: {
      ...definition.revision,
      retrievedAt: AS_OF
    },
    file: {
      sha256: digest(sourceBytes),
      byteLength: sourceBytes.byteLength,
      contentSha256: computeNormalizedContentSha256(pages)
    },
    extraction: {
      method: 'PREEXTRACTED_PAGE_TEXT',
      extractorName: definition.kind === 'PDF' ? 'pdftotext-layout' : 'bounded-ls-product-html',
      extractorVersion: definition.kind === 'PDF' ? 'poppler-cli' : '1',
      extractedAt: AS_OF,
      normalizationVersion: 'page-text-nfc-lf-codepoint-v1'
    },
    pages
  };
  const bundle = normalizeSourceDocumentBundle(rawBundle, { asOf: AS_OF });
  const relativePath = `${definition.id}.json`;
  const serializableBundle = {
    ...bundle,
    pages: bundle.pages.map(({ codePointLength: _derivedCodePointLength, ...page }) => page)
  };
  const bytes = Buffer.from(`${JSON.stringify(serializableBundle, null, 2)}\n`, 'utf8');
  if (bytes.byteLength > 1_000_000) throw new Error(`${definition.id} normalized bundle exceeds intake limit`);
  await writeFile(path.join(stagingInbox, relativePath), bytes, { mode: 0o600, flag: 'wx' });
  entries.push(manifestEntry(bundle, relativePath, bytes));
  results.push({
    documentId: bundle.documentId,
    documentNumber: bundle.source.documentNumber,
    language: bundle.source.language,
    productFamily: definition.productFamily,
    sourceByteLength: sourceBytes.byteLength,
    normalizedByteLength: bytes.byteLength,
    pageCount: bundle.pages.length
  });
}

const manifest = {
  schemaVersion: 'official-evidence-intake-manifest-v0',
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  productionReady: false,
  documents: entries
};
await writeFile(
  path.join(stagingInbox, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o600, flag: 'wx' }
);
await rename(stagingInbox, finalInbox);

process.stdout.write(`${JSON.stringify({
  schemaVersion: 'pr207-real-intake-build-result-v0',
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  productionReady: false,
  asOf: AS_OF,
  documentCount: results.length,
  byProductFamily: Object.fromEntries(['medium_voltage_switchgear', 'transformer'].map((family) => [
    family,
    results.filter((result) => result.productFamily === family).length
  ])),
  byLanguage: Object.fromEntries(['ko', 'en'].map((language) => [
    language,
    results.filter((result) => result.language === language).length
  ])),
  documents: results
}, null, 2)}\n`);
