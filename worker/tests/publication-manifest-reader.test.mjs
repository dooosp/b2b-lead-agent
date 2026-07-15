import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { fetchLeads } from '../api/leads.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { jsonFixtureResponse, withMockedFetch } from './helpers/http.mjs';

const require = createRequire(import.meta.url);
const rootPublisher = require('../../lead-report-publisher');
const { createRootLead, createRootProfile } = require('../../tests/helpers/root-fixtures');

const PROFILE = 'danfoss';
const PUBLICATION_ID = 'pub-0123456789abcdef0123456789abcdef';
const LEADS = [{
  id: 'manifest-selected-lead',
  profileId: PROFILE,
  company: 'MANIFEST SELECTED COMPANY',
  summary: 'Manifest-selected immutable payload',
  product: 'Synthetic drive',
  score: 80,
  grade: 'A',
  status: 'NEW',
  reviewStatus: 'NEEDS_REVIEW',
  generationMode: 'llm',
  verificationStatus: 'needs_review',
  confidence: 'LOW',
  assumptions: [],
  dataGaps: [],
  sources: [],
  createdAt: '2026-07-15T02:00:00.000Z',
  updatedAt: '2026-07-15T02:00:00.000Z',
}];

function sha256(payload) {
  return createHash('sha256').update(payload).digest('hex');
}

function descriptor(kind, filename, payload, records) {
  return {
    kind,
    path: `publications/${PUBLICATION_ID}/${filename}`,
    canonicalPath: filename,
    sha256: sha256(payload),
    bytes: Buffer.byteLength(payload),
    ...(records === undefined ? {} : { records }),
  };
}

function manifestFixture(latestPayload) {
  const historyPayload = latestPayload;
  const reportPayload = '# Synthetic report\n';
  return {
    schemaVersion: 2,
    renderVersion: 1,
    profileId: PROFILE,
    runId: 'github-12345',
    publicationId: PUBLICATION_ID,
    previousPublicationId: null,
    previousManifestSchemaVersion: null,
    inputDigest: 'a'.repeat(64),
    generatedAt: '2026-07-15T02:00:00.000Z',
    reportDate: '2026-07-15',
    counts: { leads: 1, history: 1, artifacts: 3 },
    artifacts: {
      report: descriptor('report', 'lead-report-2026-07-15.md', reportPayload),
      latest: descriptor('latest', 'latest-leads.json', latestPayload, 1),
      history: descriptor('history', 'lead-history.json', historyPayload, 1),
    },
  };
}

test('manifest-aware Worker reads the immutable artifact selected by the pointer', async () => {
  const latestPayload = JSON.stringify(LEADS);
  const manifest = manifestFixture(latestPayload);
  const requested = [];
  const handler = async (input) => {
    const pathname = new URL(String(input)).pathname;
    requested.push(pathname);
    if (pathname.endsWith('/publication-manifest.json')) return jsonFixtureResponse(manifest);
    if (pathname.endsWith(`/${PUBLICATION_ID}/latest-leads.json`)) {
      return new Response(latestPayload, { status: 200 });
    }
    throw new Error(`Unexpected manifest-aware fetch: ${pathname}`);
  };
  handler.publicationManifestAware = true;

  await withMockedFetch(handler, async () => {
    const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.leads[0].company, 'MANIFEST SELECTED COMPANY');
  });
  assert.equal(requested.some((value) => value.endsWith(`/${PROFILE}/latest-leads.json`)), false);
});

test('manifest checksum failure is fail-closed and never falls back to the canonical mirror', async () => {
  const latestPayload = JSON.stringify(LEADS);
  const manifest = manifestFixture(latestPayload);
  manifest.artifacts.latest.sha256 = 'b'.repeat(64);
  const requested = [];
  const handler = async (input) => {
    const pathname = new URL(String(input)).pathname;
    requested.push(pathname);
    if (pathname.endsWith('/publication-manifest.json')) return jsonFixtureResponse(manifest);
    if (pathname.endsWith(`/${PUBLICATION_ID}/latest-leads.json`)) {
      return new Response(latestPayload, { status: 200 });
    }
    if (pathname.endsWith(`/${PROFILE}/latest-leads.json`)) return jsonFixtureResponse(LEADS);
    throw new Error(`Unexpected checksum fetch: ${pathname}`);
  };
  handler.publicationManifestAware = true;

  await withMockedFetch(handler, async () => {
    const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, PROFILE);
    assert.equal(response.status, 500);
  });
  assert.equal(requested.some((value) => value.endsWith(`/${PROFILE}/latest-leads.json`)), false);
});

test('a present schema-v1 manifest still selects and verifies its immutable artifact', async () => {
  const latestPayload = JSON.stringify(LEADS);
  const manifest = manifestFixture(latestPayload);
  manifest.schemaVersion = 1;
  delete manifest.runId;
  delete manifest.previousManifestSchemaVersion;
  const requested = [];
  const handler = async (input) => {
    const pathname = new URL(String(input)).pathname;
    requested.push(pathname);
    if (pathname.endsWith('/publication-manifest.json')) return jsonFixtureResponse(manifest);
    if (pathname.endsWith(`/${PUBLICATION_ID}/latest-leads.json`)) {
      return new Response(latestPayload, { status: 200 });
    }
    throw new Error(`Unexpected schema-v1 fetch: ${pathname}`);
  };
  handler.publicationManifestAware = true;

  await withMockedFetch(handler, async () => {
    const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.leads[0].id, 'manifest-selected-lead');
  });
  assert.equal(requested.some((value) => value.endsWith(`/${PROFILE}/latest-leads.json`)), false);
});

test('a manifest-selected artifact 404 never falls back to a valid stale D1 snapshot', async () => {
  const latestPayload = JSON.stringify(LEADS);
  const manifest = manifestFixture(latestPayload);
  const db = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      fetchedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      leads: LEADS,
    }],
  });
  const requested = [];
  const handler = async (input) => {
    const pathname = new URL(String(input)).pathname;
    requested.push(pathname);
    if (pathname.endsWith('/publication-manifest.json')) return jsonFixtureResponse(manifest);
    if (pathname.endsWith(`/${PUBLICATION_ID}/latest-leads.json`)) {
      return jsonFixtureResponse({ message: 'not found' }, 404);
    }
    if (pathname.endsWith(`/${PROFILE}/latest-leads.json`)) return jsonFixtureResponse(LEADS);
    throw new Error(`Unexpected manifest 404 fetch: ${pathname}`);
  };
  handler.publicationManifestAware = true;

  await withMockedFetch(handler, async () => {
    const response = await fetchLeads({
      DB: db,
      GITHUB_REPO: 'fixture/repo',
      PUBLISHED_SNAPSHOT_TTL_SECONDS: '0',
    }, PROFILE);
    assert.equal(response.status, 500);
  });
  assert.equal(requested.some((value) => value.endsWith(`/${PROFILE}/latest-leads.json`)), false);
});

test('Worker consumes a schema-v2 manifest and immutable bytes generated by the root publisher', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'root-worker-publication-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const reportsRoot = path.join(tempRoot, 'reports');
  const profile = createRootProfile({ id: PROFILE });
  const prepared = rootPublisher.prepareLeadPublication([
    createRootLead({
      id: 'root-generated-worker-lead',
      profileId: PROFILE,
      company: 'ROOT GENERATED COMPANY',
      summary: 'Root-generated immutable publication',
      generationMode: 'llm',
      verificationStatus: 'needs_review',
      confidence: 'LOW',
    }),
  ], profile, {
    reportsRoot,
    now: '2026-07-15T02:00:00.000Z',
    runId: 'root-worker-contract-run',
  });
  rootPublisher.commitLeadPublication(prepared, profile, { reportsRoot });
  const reportsDir = path.join(reportsRoot, PROFILE);
  const manifestPayload = fs.readFileSync(path.join(reportsDir, 'publication-manifest.json'));
  const manifest = JSON.parse(manifestPayload);
  const selectedPayload = fs.readFileSync(path.join(reportsDir, manifest.artifacts.latest.path));
  const handler = async (input) => {
    const pathname = new URL(String(input)).pathname;
    if (pathname.endsWith('/publication-manifest.json')) {
      return new Response(manifestPayload, { status: 200 });
    }
    if (pathname.endsWith(`/${manifest.artifacts.latest.path}`)) {
      return new Response(selectedPayload, { status: 200 });
    }
    throw new Error(`Unexpected root-generated publication fetch: ${pathname}`);
  };
  handler.publicationManifestAware = true;

  await withMockedFetch(handler, async () => {
    const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.leads[0].company, 'ROOT GENERATED COMPANY');
  });
});

test('manifest-primary exact-schema, path, count, and 64 KiB bounds fail closed', async () => {
  const latestPayload = JSON.stringify(LEADS);
  const cases = [
    {
      name: 'unknown field',
      build() {
        const manifest = manifestFixture(latestPayload);
        manifest.unexpected = true;
        return JSON.stringify(manifest);
      },
    },
    {
      name: 'record count mismatch',
      build() {
        const manifest = manifestFixture(latestPayload);
        manifest.counts.leads = 2;
        return JSON.stringify(manifest);
      },
    },
    {
      name: 'path traversal',
      build() {
        const manifest = manifestFixture(latestPayload);
        manifest.artifacts.latest.path = `publications/${PUBLICATION_ID}/../latest-leads.json`;
        return JSON.stringify(manifest);
      },
    },
    {
      name: 'oversized manifest',
      build() {
        return `${' '.repeat(64 * 1024)}${JSON.stringify(manifestFixture(latestPayload))}`;
      },
    },
  ];

  for (const fixture of cases) {
    let artifactFetched = false;
    const handler = async (input) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith('/publication-manifest.json')) {
        return new Response(fixture.build(), { status: 200 });
      }
      artifactFetched = true;
      return new Response(latestPayload, { status: 200 });
    };
    handler.publicationManifestAware = true;
    await withMockedFetch(handler, async () => {
      const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, PROFILE);
      assert.equal(response.status, 500, fixture.name);
    });
    assert.equal(artifactFetched, false, fixture.name);
  }
});

test('legacy publication without a manifest still reads the canonical artifact', async () => {
  const requested = [];
  const handler = async (input) => {
    const pathname = new URL(String(input)).pathname;
    requested.push(pathname);
    if (pathname.endsWith('/publication-manifest.json')) {
      return jsonFixtureResponse({ message: 'not found' }, 404);
    }
    if (pathname.endsWith(`/${PROFILE}/latest-leads.json`)) return jsonFixtureResponse(LEADS);
    throw new Error(`Unexpected legacy fetch: ${pathname}`);
  };
  handler.publicationManifestAware = true;

  await withMockedFetch(handler, async () => {
    const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, PROFILE);
    assert.equal(response.status, 200);
  });
  assert.equal(requested.length, 2);
});
