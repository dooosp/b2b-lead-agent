import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PUBLISHED_ARTIFACT_REMOTE_CARDINALITY_CODE,
  PUBLISHED_ARTIFACT_REMOTE_MAX_BYTES,
  PUBLISHED_ARTIFACT_REMOTE_MAX_NESTING_DEPTH,
  PUBLISHED_ARTIFACT_REMOTE_MAX_STRUCTURAL_TOKENS,
  PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE,
  assertPublishedArtifactJsonComplexity,
  fetchHistory,
  fetchLeads,
} from '../api/leads.js';
import {
  PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_CORRUPT_CODE,
  PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_MUTABLE_AGGREGATE_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES,
  PUBLISHED_SNAPSHOT_OVERLAY_LIMIT_CODE,
  assertPublishedSnapshotPayloadBytes,
  computePublishedSnapshotId,
  getPublishedSnapshot,
  publishedSnapshotPayloadUtf8Bytes,
  publishedSnapshotEntryRowUtf8Bytes,
  savePublishedSnapshot,
} from '../db/published-snapshots.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLeadRow } from './helpers/fixtures.mjs';
import { jsonFixtureResponse, withMockedFetch } from './helpers/http.mjs';

const PROFILE = 'danfoss';
const WITHIN_STALE_WINDOW = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const CLOUDFLARE_FREE_QUERY_LIMIT = 50;
const SQLITE_COMMAND = process.env.SQLITE3_BIN || 'sqlite3';

function createPublishedLead({ id, company, summary, createdAt, ...overrides }) {
  return {
    id,
    status: 'NEW',
    reviewStatus: 'NEEDS_REVIEW',
    company,
    summary,
    product: 'iC7 Marine 드라이브',
    score: 80,
    grade: 'A',
    salesPitch: `${company} synthetic follow-up`,
    urgencyReason: `${company} synthetic why-now`,
    sources: [{
      title: `${company} synthetic public source`,
      url: `https://public-fixture.example/${id}`,
    }],
    evidence: [{
      field: 'summary',
      quote: `${company} synthetic evidence`,
      sourceUrl: `https://public-fixture.example/${id}`,
    }],
    confidence: 'MEDIUM',
    generationMode: 'llm',
    verificationStatus: 'needs_review',
    assumptions: [],
    dataGaps: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

const CURRENT_SNAPSHOT = [
  createPublishedLead({
    id: 'shared-snapshot-lead',
    company: 'CURRENT SNAPSHOT COMPANY',
    summary: 'CURRENT SNAPSHOT MARKER',
    createdAt: '2026-07-10T09:00:00.000Z',
  }),
  createPublishedLead({
    id: 'current-snapshot-only',
    company: 'CURRENT ONLY COMPANY',
    summary: 'CURRENT ONLY MARKER',
    createdAt: '2026-07-10T10:00:00.000Z',
  }),
];

const HISTORICAL_SNAPSHOT = [
  createPublishedLead({
    id: 'shared-snapshot-lead',
    company: 'HISTORY SNAPSHOT COMPANY',
    summary: 'HISTORY SNAPSHOT MARKER',
    createdAt: '2026-06-15T09:00:00.000Z',
  }),
  createPublishedLead({
    id: 'history-snapshot-only',
    company: 'HISTORY ONLY COMPANY',
    summary: 'HISTORY ONLY MARKER',
    createdAt: '2026-06-15T10:00:00.000Z',
  }),
];

function artifactName(input) {
  const pathname = new URL(String(input)).pathname;
  return pathname.split('/').at(-1);
}

function snapshotFetchHandler(requestedArtifacts, { current = CURRENT_SNAPSHOT, history = HISTORICAL_SNAPSHOT } = {}) {
  return async (input) => {
    const artifact = artifactName(input);
    requestedArtifacts.push(artifact);
    if (artifact === 'latest-leads.json') return jsonFixtureResponse(current);
    if (artifact === 'lead-history.json') return jsonFixtureResponse(history);
    throw new Error(`Unexpected mocked fetch target: ${String(input)}`);
  };
}

async function runApiOrder(order) {
  const db = new FakeD1Database();
  const requestedArtifacts = [];
  const env = { DB: db, GITHUB_REPO: 'synthetic-owner/synthetic-repo' };
  const payloads = {};

  await withMockedFetch(snapshotFetchHandler(requestedArtifacts), async () => {
    for (const operation of order) {
      const response = operation === 'current'
        ? await fetchLeads(env, PROFILE)
        : await fetchHistory(env, PROFILE);
      assert.equal(response.status, 200);
      payloads[operation] = await response.json();
    }
  });

  return { db, payloads, requestedArtifacts };
}

function ids(records) {
  return records.map((record) => record.id).sort();
}

function leadById(records, id) {
  return records.find((lead) => lead.id === id);
}

function snapshotIdFor(artifactKind, leads) {
  return computePublishedSnapshotId(PROFILE, artifactKind, leads);
}

async function requestRawArtifactWithParseCounter({ api, rawArtifactText, db }) {
  let rawArtifactParseCalls = 0;
  let response;
  await withMockedFetch(
    async () => new Response(rawArtifactText, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
    async () => {
      const originalJsonParse = JSON.parse;
      JSON.parse = function countedJsonParse(value, ...args) {
        if (value === rawArtifactText) rawArtifactParseCalls += 1;
        return originalJsonParse(value, ...args);
      };
      try {
        response = await api({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE);
      } finally {
        JSON.parse = originalJsonParse;
      }
    }
  );
  return { response, rawArtifactParseCalls };
}

function createPublishedLeadAtPayloadBytes(targetBytes, id = 'byte-boundary-lead') {
  const lead = createPublishedLead({
    id,
    company: 'BYTE BOUNDARY COMPANY',
    summary: '',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  const emptyBytes = publishedSnapshotPayloadUtf8Bytes(PROFILE, lead);
  const remainingBytes = targetBytes - emptyBytes;
  assert.ok(remainingBytes >= 0, `target ${targetBytes} must exceed base payload ${emptyBytes}`);
  lead.summary = '가'.repeat(Math.floor(remainingBytes / 3)) + 'x'.repeat(remainingBytes % 3);
  assert.equal(publishedSnapshotPayloadUtf8Bytes(PROFILE, lead), targetBytes);
  return lead;
}

function sqliteInvocation(args, input = '') {
  const result = spawnSync(SQLITE_COMMAND, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Unable to execute ${SQLITE_COMMAND}: ${result.error.message}`);
  return result;
}

function sqliteLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('SQLite test bindings must be finite numbers');
    return String(value);
  }
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function bindSql(sql, args = []) {
  let index = 0;
  const bound = sql.replace(/\?/g, () => {
    if (index >= args.length) throw new Error('Missing SQLite test binding');
    return sqliteLiteral(args[index++]);
  });
  if (index !== args.length) throw new Error('Unused SQLite test binding');
  return bound;
}

class LocalSqliteD1Database {
  constructor(databasePath) {
    this.databasePath = databasePath;
    this.failBatchAt = null;
    const schemaResult = sqliteInvocation(
      [this.databasePath],
      `.bail on\n${fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')}\n`
    );
    if (schemaResult.status !== 0) {
      throw new Error((schemaResult.stderr || schemaResult.stdout || 'SQLite schema load failed').trim());
    }
  }

  prepare(sql) {
    const database = this;
    const statement = {
      sql,
      args: [],
      bind(...args) {
        statement.args = args.map((value) => value === undefined ? null : value);
        return statement;
      },
      async run() {
        database.execute(bindSql(sql, statement.args));
        return { success: true };
      },
      async first() {
        return database.all(bindSql(sql, statement.args))[0] || null;
      },
      async all() {
        return { results: database.all(bindSql(sql, statement.args)) };
      },
    };
    return statement;
  }

  async batch(statements) {
    const boundStatements = statements.map((statement) => bindSql(statement.sql, statement.args));
    const executableStatements = this.failBatchAt === null
      ? boundStatements
      : boundStatements.slice(0, this.failBatchAt);
    const transaction = [
      '.bail on',
      'BEGIN IMMEDIATE;',
      ...executableStatements.map((sql) => `${sql};`),
      ...(this.failBatchAt === null
        ? ['COMMIT;']
        : ['SELECT * FROM synthetic_transaction_batch_failure;']),
      '',
    ].join('\n');
    const result = sqliteInvocation([this.databasePath], transaction);
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || 'SQLite batch failed').trim();
      if (this.failBatchAt !== null) {
        throw new Error(`synthetic transactional batch failure: ${detail}`);
      }
      throw new Error(detail);
    }
    return statements.map(() => ({ success: true }));
  }

  execute(sql) {
    const result = sqliteInvocation([this.databasePath], `.bail on\n${sql};\n`);
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'SQLite statement failed').trim());
    }
  }

  all(sql) {
    const result = sqliteInvocation(['-json', this.databasePath, sql]);
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'SQLite query failed').trim());
    }
    return result.stdout.trim() ? JSON.parse(result.stdout) : [];
  }
}

test('desired contract: current and history responses are order-independent typed snapshots', async () => {
  const currentThenHistory = await runApiOrder(['current', 'history']);
  const historyThenCurrent = await runApiOrder(['history', 'current']);

  assert.deepEqual(currentThenHistory.requestedArtifacts, ['latest-leads.json', 'lead-history.json']);
  assert.deepEqual(historyThenCurrent.requestedArtifacts, ['lead-history.json', 'latest-leads.json']);

  for (const result of [currentThenHistory, historyThenCurrent]) {
    assert.equal(result.payloads.current.source, 'github');
    assert.equal(result.payloads.history.source, 'github');
    assert.deepEqual(ids(result.payloads.current.leads), ['current-snapshot-only', 'shared-snapshot-lead']);
    assert.deepEqual(ids(result.payloads.history.history), ['history-snapshot-only', 'shared-snapshot-lead']);
    assert.equal(leadById(result.payloads.current.leads, 'shared-snapshot-lead').summary, 'CURRENT SNAPSHOT MARKER');
    assert.equal(Number.isSafeInteger(
      leadById(result.payloads.current.leads, 'shared-snapshot-lead').version
    ), true);
    assert.equal(leadById(result.payloads.history.history, 'shared-snapshot-lead').summary, 'HISTORY SNAPSHOT MARKER');
    assert.match(result.payloads.current.snapshotId, /^[a-f0-9]{64}$/);
    assert.match(result.payloads.history.snapshotId, /^[a-f0-9]{64}$/);
    assert.equal(result.payloads.current.snapshotStale, false);
    assert.equal(result.payloads.history.snapshotStale, false);
    assert.equal(typeof result.payloads.current.snapshotFetchedAt, 'string');
    assert.equal(typeof result.payloads.history.snapshotFetchedAt, 'string');
    assert.notEqual(result.payloads.current.snapshotId, result.payloads.history.snapshotId);
    assert.equal(result.db.publishedSnapshotHeads.size, 2);
  }

  assert.deepEqual(currentThenHistory.payloads.current.leads, historyThenCurrent.payloads.current.leads);
  assert.deepEqual(currentThenHistory.payloads.history.history, historyThenCurrent.payloads.history.history);
});

test('desired contract: mutable review state is separate while latest/history payloads keep same-id content distinct', async () => {
  const protectedNote = 'Human-only mutable note remains outside snapshot JSON.';
  const mutableUpdatedAt = '2026-03-01T00:00:00.000Z';
  const db = new FakeD1Database({
    leads: [createLeadRow({
      id: 'shared-snapshot-lead',
      profile_id: PROFILE,
      status: 'CONTACTED',
      review_status: 'APPROVED',
      notes: protectedNote,
      manual_review_notes_author_label: 'manual_reviewer',
      summary: 'STALE WORKING SUMMARY',
      updated_at: mutableUpdatedAt,
    })],
  });
  const requestedArtifacts = [];
  const env = { DB: db, GITHUB_REPO: 'synthetic-owner/synthetic-repo' };

  await withMockedFetch(snapshotFetchHandler(requestedArtifacts), async () => {
    const historyResponse = await fetchHistory(env, PROFILE);
    const historyPayload = await historyResponse.json();
    const currentResponse = await fetchLeads(env, PROFILE);
    const currentPayload = await currentResponse.json();

    const historyLead = leadById(historyPayload.history, 'shared-snapshot-lead');
    const currentLead = leadById(currentPayload.leads, 'shared-snapshot-lead');
    assert.equal(historyLead.summary, 'HISTORY SNAPSHOT MARKER');
    assert.equal(currentLead.summary, 'CURRENT SNAPSHOT MARKER');
    assert.equal(historyLead.status, 'CONTACTED');
    assert.equal(currentLead.status, 'CONTACTED');
    assert.equal(historyLead.reviewStatus, 'APPROVED');
    assert.equal(currentLead.reviewStatus, 'APPROVED');
    assert.equal(historyLead.manualReviewNotes, protectedNote);
    assert.equal(currentLead.manualReviewNotes, protectedNote);
    assert.equal(currentLead.updatedAt, mutableUpdatedAt);
  });

  assert.deepEqual(requestedArtifacts, ['lead-history.json', 'latest-leads.json']);
  assert.equal(db.leads.get('shared-snapshot-lead').summary, 'CURRENT SNAPSHOT MARKER');
  assert.equal(db.leads.get('shared-snapshot-lead').updated_at, mutableUpdatedAt);
  const serializedEntries = JSON.stringify(db.publishedSnapshotEntries);
  assert.equal(serializedEntries.includes(protectedNote), false);
  assert.equal(serializedEntries.includes('manualReviewNotes'), false);
  assert.equal(serializedEntries.includes('reviewerFeedback'), false);
  for (const entry of db.publishedSnapshotEntries) {
    const storedPayload = JSON.parse(entry.payload_json);
    assert.equal(Object.hasOwn(storedPayload, 'status'), false);
    assert.equal(Object.hasOwn(storedPayload, 'reviewStatus'), false);
  }
});

test('desired contract: first GitHub response and cached response project untrusted extras out of snapshot payloads', async () => {
  const poisoned = createPublishedLead({
    id: 'poisoned-lead',
    company: 'SAFE COMPANY',
    summary: 'SAFE SUMMARY',
    createdAt: '2026-07-10T09:00:00.000Z',
    status: 'WON',
    reviewStatus: 'APPROVED',
    manualReviewNotes: 'REMOTE NOTE MUST NOT PERSIST',
    reviewerFeedback: { feedbackText: 'REMOTE FEEDBACK MUST NOT PERSIST' },
    reviewNoteSuggestion: { text: 'GENERATED SUGGESTION MUST NOT PERSIST' },
    sources: [{
      title: 'Safe public title',
      url: 'https://public-fixture.example/safe',
      authorization: 'Bearer nested-secret',
      manualReviewNotes: 'NESTED SOURCE NOTE',
    }],
    evidence: [{
      field: 'summary',
      quote: 'Safe public quote',
      sourceUrl: 'https://public-fixture.example/safe',
      token: 'nested-evidence-secret',
    }],
    assumptions: ['Public assumption', { token: 'nested-assumption-secret' }],
  });
  const db = new FakeD1Database();
  let fetchCount = 0;

  await withMockedFetch(async () => {
    fetchCount += 1;
    return jsonFixtureResponse([poisoned]);
  }, async () => {
    const first = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();
    const cached = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();

    for (const payload of [first, cached]) {
      const lead = payload.leads[0];
      assert.equal(lead.status, 'NEW');
      assert.equal(lead.reviewStatus, 'NEEDS_REVIEW');
      assert.equal(lead.manualReviewNotes, '');
      assert.equal(lead.reviewerFeedback.hasFeedback, false);
      assert.equal(lead.reviewNoteSuggestion, undefined);
      assert.deepEqual(lead.sources, [{ title: 'Safe public title', url: 'https://public-fixture.example/safe' }]);
      assert.deepEqual(lead.evidence, [{
        field: 'summary',
        quote: 'Safe public quote',
        sourceUrl: 'https://public-fixture.example/safe',
      }]);
      assert.deepEqual(lead.assumptions, ['Public assumption']);
    }
    assert.equal(first.source, 'github');
    assert.equal(cached.source, 'd1');
  });

  assert.equal(fetchCount, 1);
  const stored = JSON.stringify(db.publishedSnapshotEntries);
  for (const poison of [
    'REMOTE NOTE MUST NOT PERSIST',
    'REMOTE FEEDBACK MUST NOT PERSIST',
    'GENERATED SUGGESTION MUST NOT PERSIST',
    'nested-secret',
    'NESTED SOURCE NOTE',
    'nested-evidence-secret',
    'nested-assumption-secret',
  ]) {
    assert.equal(stored.includes(poison), false);
  }
});

test('desired contract: explicit latest snapshot identity ignores arbitrary legacy rows and stays stable in cache', async () => {
  const db = new FakeD1Database({
    leads: [createLeadRow({
      id: 'arbitrary-legacy-row',
      company: 'ARBITRARY LEGACY ROW',
      summary: 'MUST NOT COUNT AS LATEST SNAPSHOT',
    })],
  });
  let fetchCount = 0;

  await withMockedFetch(async (input) => {
    fetchCount += 1;
    assert.equal(artifactName(input), 'latest-leads.json');
    return jsonFixtureResponse(CURRENT_SNAPSHOT);
  }, async () => {
    const first = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();
    const second = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();

    assert.equal(first.source, 'github');
    assert.equal(second.source, 'd1');
    assert.equal(first.snapshotId, second.snapshotId);
    assert.match(first.snapshotId, /^[a-f0-9]{64}$/);
    assert.deepEqual(ids(first.leads), ['current-snapshot-only', 'shared-snapshot-lead']);
    assert.equal(first.leads.some((lead) => lead.id === 'arbitrary-legacy-row'), false);
  });

  assert.equal(fetchCount, 1);
  assert.equal(db.publishedSnapshotHeads.get(`${PROFILE}\u0000latest`).snapshot_id.length, 64);
});

test('desired contract: expired latest revalidates, and failure falls back only to the same typed stale cache', async () => {
  const staleLatest = [createPublishedLead({
    id: 'typed-stale-latest',
    company: 'TYPED STALE LATEST',
    summary: 'TYPED STALE LATEST MARKER',
    createdAt: '2026-01-01T00:00:00.000Z',
  })];
  const staleSnapshotId = snapshotIdFor('latest', staleLatest);
  const db = new FakeD1Database({
    leads: [createLeadRow({ id: 'typed-stale-latest', summary: 'MUTABLE WORKING ROW' })],
    publishedSnapshots: [
      {
        profileId: PROFILE,
        artifactKind: 'latest',
        fetchedAt: WITHIN_STALE_WINDOW,
        leads: staleLatest,
      },
      {
        profileId: PROFILE,
        artifactKind: 'history',
        leads: HISTORICAL_SNAPSHOT,
      },
    ],
  });
  let fetchAttempts = 0;

  await withMockedFetch(async (input) => {
    fetchAttempts += 1;
    assert.equal(artifactName(input), 'latest-leads.json');
    throw new Error('synthetic GitHub outage');
  }, async () => {
    const response = await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.source, 'd1');
    assert.equal(payload.snapshotId, staleSnapshotId);
    assert.equal(payload.snapshotFetchedAt, WITHIN_STALE_WINDOW);
    assert.equal(payload.snapshotStale, true);
    assert.deepEqual(ids(payload.leads), ['typed-stale-latest']);
    assert.equal(payload.leads[0].summary, 'TYPED STALE LATEST MARKER');
  });

  assert.equal(fetchAttempts, 1);
});

test('desired contract: expired current cache refreshes and a fresh typed cache avoids another fetch', async () => {
  const db = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      fetchedAt: '2020-01-01T00:00:00.000Z',
      leads: [createPublishedLead({
        id: 'stale-current',
        company: 'STALE CURRENT',
        summary: 'STALE CURRENT MARKER',
        createdAt: '2020-01-01T00:00:00.000Z',
      })],
    }],
  });
  let fetchAttempts = 0;

  await withMockedFetch(async () => {
    fetchAttempts += 1;
    return jsonFixtureResponse(CURRENT_SNAPSHOT);
  }, async () => {
    const refreshed = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();
    const cached = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();
    assert.equal(refreshed.source, 'github');
    assert.equal(cached.source, 'd1');
    assert.equal(cached.snapshotId, refreshed.snapshotId);
    assert.deepEqual(ids(cached.leads), ['current-snapshot-only', 'shared-snapshot-lead']);
  });

  assert.equal(fetchAttempts, 1);
});

test('future cache timestamps cannot bypass revalidation', async () => {
  const futureLeads = [CURRENT_SNAPSHOT[0]];
  const futureSnapshotId = snapshotIdFor('latest', futureLeads);
  const db = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      fetchedAt: '2999-01-01T00:00:00.000Z',
      leads: futureLeads,
    }],
  });
  let fetchAttempts = 0;

  await withMockedFetch(async () => {
    fetchAttempts += 1;
    return jsonFixtureResponse(CURRENT_SNAPSHOT);
  }, async () => {
    const payload = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();
    assert.equal(payload.source, 'github');
    assert.notEqual(payload.snapshotId, futureSnapshotId);
  });

  assert.equal(fetchAttempts, 1);
});

test('invalid remote artifact shape preserves same-kind stale cache and fails boundedly without one', async () => {
  const staleSnapshotId = snapshotIdFor('latest', [CURRENT_SNAPSHOT[0]]);
  const staleDb = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      fetchedAt: WITHIN_STALE_WINDOW,
      leads: [CURRENT_SNAPSHOT[0]],
    }],
  });

  await withMockedFetch(async () => jsonFixtureResponse({ leads: CURRENT_SNAPSHOT }), async () => {
    const fallbackResponse = await fetchLeads({ DB: staleDb, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const fallback = await fallbackResponse.json();
    assert.equal(fallbackResponse.status, 200);
    assert.equal(fallback.source, 'd1');
    assert.equal(fallback.snapshotId, staleSnapshotId);
    assert.equal(fallback.snapshotStale, true);
    assert.equal(
      staleDb.publishedSnapshotHeads.get(`${PROFILE}\u0000latest`).snapshot_id,
      staleSnapshotId
    );

    const missingResponse = await fetchLeads({ DB: new FakeD1Database(), GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const missing = await missingResponse.json();
    assert.equal(missingResponse.status, 500);
    assert.equal(missing.success, false);
    assert.deepEqual(missing.leads, []);
  });
});

test('404 never falls back to a stale snapshot, while a 5xx may use one within 24 hours', async () => {
  const staleSnapshotId = snapshotIdFor('latest', [CURRENT_SNAPSHOT[0]]);
  const createDb = () => new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      fetchedAt: WITHIN_STALE_WINDOW,
      leads: [CURRENT_SNAPSHOT[0]],
    }],
  });

  const notFoundDb = createDb();
  await withMockedFetch(async () => jsonFixtureResponse({ message: 'not found' }, 404), async () => {
    const response = await fetchLeads({ DB: notFoundDb, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(payload.leads, []);
    assert.equal(payload.snapshotId, undefined);
    assert.equal(payload.source, undefined);
  });

  const serverErrorDb = createDb();
  await withMockedFetch(async () => jsonFixtureResponse({ message: 'unavailable' }, 503), async () => {
    const response = await fetchLeads({ DB: serverErrorDb, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.source, 'd1');
    assert.equal(payload.snapshotId, staleSnapshotId);
    assert.equal(payload.snapshotStale, true);
  });
});

test('too-old and future-dated caches are never usable as stale fallbacks', async () => {
  for (const scenario of [
    {
      name: 'too old despite an oversized configured window',
      fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      maxStaleSeconds: 10 * 365 * 24 * 60 * 60,
    },
    {
      name: 'older than a configured tighter window',
      fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      maxStaleSeconds: 60 * 60,
    },
    { name: 'future', fetchedAt: '2999-01-01T00:00:00.000Z' },
  ]) {
    const db = new FakeD1Database({
      publishedSnapshots: [{
        profileId: PROFILE,
        artifactKind: 'latest',
        fetchedAt: scenario.fetchedAt,
        leads: [CURRENT_SNAPSHOT[0]],
      }],
    });
    await withMockedFetch(async () => {
      throw new Error('synthetic network failure');
    }, async () => {
      const response = await fetchLeads({
        DB: db,
        GITHUB_REPO: 'fixture/repo',
        PUBLISHED_SNAPSHOT_MAX_STALE_SECONDS: scenario.maxStaleSeconds,
      }, PROFILE);
      const payload = await response.json();
      assert.equal(response.status, 500, scenario.name);
      assert.equal(payload.success, false, scenario.name);
      assert.equal(payload.snapshotId, undefined, scenario.name);
    });
  }
});

test('one joined read stays internally consistent when a replacement is published mid-read', async () => {
  const oldLead = createPublishedLead({
    id: 'old-consistent-lead',
    company: 'OLD CONSISTENT COMPANY',
    summary: 'OLD CONSISTENT SUMMARY',
    createdAt: '2026-07-01T00:00:00.000Z',
  });
  const newLead = createPublishedLead({
    id: 'new-consistent-lead',
    company: 'NEW CONSISTENT COMPANY',
    summary: 'NEW CONSISTENT SUMMARY',
    createdAt: '2026-07-02T00:00:00.000Z',
  });
  const oldSnapshotId = snapshotIdFor('latest', [oldLead]);
  const newSnapshotId = snapshotIdFor('latest', [newLead]);
  const db = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      leads: [oldLead],
    }],
  });
  let interleavings = 0;
  db.onPublishedSnapshotRead = async (database) => {
    interleavings += 1;
    database.onPublishedSnapshotRead = null;
    database.seedPublishedSnapshot({
      profileId: PROFILE,
      artifactKind: 'latest',
      leads: [newLead],
    });
  };

  const first = await getPublishedSnapshot(db, { profileId: PROFILE, artifactKind: 'latest' });
  const second = await getPublishedSnapshot(db, { profileId: PROFILE, artifactKind: 'latest' });

  assert.equal(interleavings, 1);
  assert.equal(first.snapshotId, oldSnapshotId);
  assert.deepEqual(ids(first.leads), ['old-consistent-lead']);
  assert.equal(second.snapshotId, newSnapshotId);
  assert.deepEqual(ids(second.leads), ['new-consistent-lead']);
  assert.equal(
    db.executedQueries.filter((query) => query.sql.startsWith('with selected_head as')).length,
    2
  );
  assert.equal(
    db.executedQueries.some((query) => query.sql === 'select * from leads where id = ?'),
    false
  );
});

test('actual SQLite transaction preserves the old head and entries when replacement fails mid-batch', async (t) => {
  const sqliteVersion = sqliteInvocation(['-version']);
  assert.equal(sqliteVersion.status, 0, `${SQLITE_COMMAND} must be available for SQLite tests`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2b-lead-snapshot-transaction-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const db = new LocalSqliteD1Database(path.join(tempDir, 'snapshot.sqlite3'));
  const oldLead = createPublishedLead({
    id: 'transaction-old-lead',
    company: 'TRANSACTION OLD COMPANY',
    summary: 'TRANSACTION OLD SUMMARY',
    createdAt: '2026-07-01T00:00:00.000Z',
  });
  await savePublishedSnapshot(db, {
    profileId: PROFILE,
    artifactKind: 'latest',
    leads: [oldLead],
  });
  const oldSnapshot = await getPublishedSnapshot(db, {
    profileId: PROFILE,
    artifactKind: 'latest',
  });

  const replacement = Array.from({ length: 4 }, (_, index) => createPublishedLead({
    id: `transaction-new-${index}`,
    company: `TRANSACTION NEW COMPANY ${index}`,
    summary: `TRANSACTION NEW SUMMARY ${index}`,
    createdAt: '2026-07-02T00:00:00.000Z',
  }));
  // Two lead-upsert chunks, delete, and entry insert run before this injected
  // failure prevents the final head statement. SQLite must roll all of it back.
  db.failBatchAt = 4;
  await assert.rejects(
    savePublishedSnapshot(db, {
      profileId: PROFILE,
      artifactKind: 'latest',
      leads: replacement,
    }),
    /synthetic transactional batch failure/
  );
  db.failBatchAt = null;

  const afterFailure = await getPublishedSnapshot(db, {
    profileId: PROFILE,
    artifactKind: 'latest',
  });
  assert.equal(afterFailure.snapshotId, oldSnapshot.snapshotId);
  assert.deepEqual(ids(afterFailure.leads), ['transaction-old-lead']);
  assert.equal(afterFailure.leads[0].summary, 'TRANSACTION OLD SUMMARY');
  assert.deepEqual(
    db.all("SELECT id FROM leads WHERE id LIKE 'transaction-new-%' ORDER BY id ASC"),
    []
  );
});

for (const scenario of [
  { artifactKind: 'latest', count: 90, api: fetchLeads, responseField: 'leads' },
  { artifactKind: 'history', count: 500, api: fetchHistory, responseField: 'history' },
]) {
  test(`${scenario.artifactKind} ${scenario.count}-lead refresh stays below the Cloudflare Free 50-query limit`, async () => {
    const leads = Array.from({ length: scenario.count }, (_, index) => createPublishedLead({
      id: `${scenario.artifactKind}-budget-${index}`,
      company: `${scenario.artifactKind.toUpperCase()} BUDGET COMPANY ${index}`,
      summary: `${scenario.artifactKind.toUpperCase()} BUDGET SUMMARY ${index}`,
      createdAt: '2026-07-10T00:00:00.000Z',
    }));
    const db = new FakeD1Database();

    await withMockedFetch(async (input) => {
      assert.equal(
        artifactName(input),
        scenario.artifactKind === 'latest' ? 'latest-leads.json' : 'lead-history.json'
      );
      return jsonFixtureResponse(leads);
    }, async () => {
      const response = await scenario.api({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE);
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(payload[scenario.responseField].length, scenario.count);
    });

    assert.ok(
      db.queryCount < CLOUDFLARE_FREE_QUERY_LIMIT,
      `${db.queryCount} queries must stay below the ${CLOUDFLARE_FREE_QUERY_LIMIT}-query limit`
    );
    assert.ok(db.maxBoundParams <= 100, `max bind count was ${db.maxBoundParams}`);
    assert.equal(
      db.executedQueries.some((query) => (
        query.sql === 'select version, name from d1_schema_migrations order by version asc limit 4'
      )),
      true,
      'query budget must include the cold migration-ledger readiness read'
    );
    assert.equal(
      db.executedQueries.some((query) => query.sql.includes('pragma_table_info')),
      true,
      'query budget must include the cold canonical-shape readiness read'
    );
    assert.equal(
      db.executedQueries.some((query) => query.sql.includes('from sqlite_schema')),
      true,
      'query budget must include the cold index/constraint readiness read'
    );
    assert.equal(
      db.executedQueries.some((query) => query.sql === 'select * from leads where id = ?'),
      false
    );
    if (scenario.artifactKind === 'history') {
      assert.equal(db.leads.size, 0, 'history refresh must not upsert mutable lead rows');
    } else {
      assert.equal(db.leads.size, scenario.count);
    }
  });
}

test('artifacts above the supported 90 latest and 500 history bounds fail before D1 writes', async () => {
  for (const scenario of [
    { artifactKind: 'latest', count: 91, api: fetchLeads },
    { artifactKind: 'history', count: 501, api: fetchHistory },
  ]) {
    const leads = Array.from({ length: scenario.count }, (_, index) => createPublishedLead({
      id: `${scenario.artifactKind}-oversized-${index}`,
      company: 'OVERSIZED COMPANY',
      summary: `OVERSIZED ${index}`,
      createdAt: '2026-07-10T00:00:00.000Z',
    }));
    const db = new FakeD1Database();
    await withMockedFetch(async () => jsonFixtureResponse(leads), async () => {
      const response = await scenario.api({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE);
      assert.equal(response.status, 500);
    });
    assert.equal(db.batches.length, 0);
    assert.equal(db.publishedSnapshotHeads.size, 0);
  }
});

test('UTF-8 payload validation accepts limit-1 and rejects limit+1 before a D1 batch', async () => {
  const acceptedLead = createPublishedLeadAtPayloadBytes(
    PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES - 1,
    'multibyte-limit-minus-one'
  );
  const acceptedDb = new FakeD1Database();
  await savePublishedSnapshot(acceptedDb, {
    profileId: PROFILE,
    artifactKind: 'latest',
    leads: [acceptedLead],
  });
  assert.equal(acceptedDb.batches.length, 1);
  assert.equal(
    new TextEncoder().encode(acceptedDb.publishedSnapshotEntries[0].payload_json).byteLength,
    PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES - 1
  );

  const rejectedLead = createPublishedLeadAtPayloadBytes(
    PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES + 1,
    'multibyte-limit-plus-one'
  );
  const rejectedDb = new FakeD1Database();
  await assert.rejects(
    savePublishedSnapshot(rejectedDb, {
      profileId: PROFILE,
      artifactKind: 'latest',
      leads: [rejectedLead],
    }),
    (error) => error?.code === 'ERR_PUBLISHED_SNAPSHOT_ENTRY_BYTES'
  );
  assert.equal(rejectedDb.batches.length, 0);
  assert.equal(rejectedDb.publishedSnapshotHeads.size, 0);
});

test('aggregate UTF-8 payload validation rejects a bounded set before a D1 batch', async () => {
  const perEntryBytes = Math.floor(PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES / 5) + 1;
  const leads = Array.from({ length: 5 }, (_, index) => createPublishedLeadAtPayloadBytes(
    perEntryBytes,
    `aggregate-byte-limit-${index}`
  ));
  const db = new FakeD1Database();

  await assert.rejects(
    savePublishedSnapshot(db, {
      profileId: PROFILE,
      artifactKind: 'latest',
      leads,
    }),
    (error) => error?.code === 'ERR_PUBLISHED_SNAPSHOT_ARTIFACT_BYTES'
  );
  assert.equal(db.batches.length, 0);
  assert.equal(db.publishedSnapshotHeads.size, 0);
});

test('oversized remote payload uses only bounded same-kind stale fallback or returns bounded 500', async () => {
  const oversizedLead = createPublishedLeadAtPayloadBytes(
    PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES + 1,
    'oversized-remote-lead'
  );
  const staleSnapshotId = snapshotIdFor('latest', [CURRENT_SNAPSHOT[0]]);
  const staleDb = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      fetchedAt: WITHIN_STALE_WINDOW,
      leads: [CURRENT_SNAPSHOT[0]],
    }],
  });

  await withMockedFetch(async () => jsonFixtureResponse([oversizedLead]), async () => {
    const fallbackResponse = await fetchLeads({ DB: staleDb, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const fallback = await fallbackResponse.json();
    assert.equal(fallbackResponse.status, 200);
    assert.equal(fallback.source, 'd1');
    assert.equal(fallback.snapshotId, staleSnapshotId);
    assert.equal(fallback.snapshotStale, true);
    assert.equal(staleDb.batches.length, 0);

    const missingDb = new FakeD1Database();
    const missingResponse = await fetchLeads({ DB: missingDb, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const missing = await missingResponse.json();
    assert.equal(missingResponse.status, 500);
    assert.equal(missing.success, false);
    assert.deepEqual(missing.leads, []);
    assert.equal(missingDb.batches.length, 0);
    assert.equal(missingDb.publishedSnapshotHeads.size, 0);
  });
});

test('empty published artifacts create typed heads and are served from cache', async () => {
  const db = new FakeD1Database();
  let fetchAttempts = 0;

  await withMockedFetch(async () => {
    fetchAttempts += 1;
    return jsonFixtureResponse([]);
  }, async () => {
    const first = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();
    const cached = await (await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE)).json();
    assert.deepEqual(first.leads, []);
    assert.deepEqual(cached.leads, []);
    assert.equal(first.source, 'github');
    assert.equal(cached.source, 'd1');
    assert.equal(first.snapshotId, cached.snapshotId);
  });

  assert.equal(fetchAttempts, 1);
  assert.equal(db.publishedSnapshotHeads.has(`${PROFILE}\u0000latest`), true);
  assert.equal(db.publishedSnapshotEntries.length, 0);
  assert.match(db.batches.at(-1).at(-1), /^insert into published_snapshot_heads /);
});

test('unknown cached fields are re-projected and corrupt allowed content self-heals from upstream', async () => {
  const safeLead = createPublishedLead({
    id: 'cached-safe-id',
    company: 'CACHED SAFE COMPANY',
    summary: 'CACHED SAFE SUMMARY',
    createdAt: '2026-07-10T09:00:00.000Z',
  });
  const db = new FakeD1Database({
    leads: [createLeadRow({ id: safeLead.id, company: safeLead.company, summary: safeLead.summary })],
    publishedSnapshots: [{ profileId: PROFILE, artifactKind: 'latest', leads: [safeLead] }],
  });
  const entry = db.publishedSnapshotEntries[0];
  const storedPayload = JSON.parse(entry.payload_json);
  entry.payload_json = JSON.stringify({
    ...storedPayload,
    manualReviewNotes: 'TAMPERED TOP LEVEL NOTE',
    reviewerFeedback: { feedbackText: 'TAMPERED FEEDBACK' },
    sources: storedPayload.sources.map((source) => ({
      ...source,
      token: 'TAMPERED NESTED TOKEN',
    })),
  });

  const sanitizedResponse = await fetchLeads({ DB: db, GITHUB_REPO: 'unused/repo' }, PROFILE);
  const sanitized = await sanitizedResponse.json();
  assert.equal(sanitizedResponse.status, 200);
  assert.equal(sanitized.leads[0].manualReviewNotes, '');
  assert.equal(JSON.stringify(sanitized).includes('TAMPERED'), false);

  db.publishedSnapshotEntries[0].payload_json = JSON.stringify({
    ...storedPayload,
    summary: 'TAMPERED ALLOWED SUMMARY',
  });
  let repairFetches = 0;
  await withMockedFetch(async () => {
    repairFetches += 1;
    return jsonFixtureResponse([safeLead]);
  }, async () => {
    const repairedResponse = await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const repaired = await repairedResponse.json();
    assert.equal(repairedResponse.status, 200);
    assert.equal(repaired.source, 'github');
    assert.equal(repaired.leads[0].summary, safeLead.summary);
    assert.equal(repaired.leads[0].source, 'managed');
    assert.equal(
      repaired.snapshotId,
      db.publishedSnapshotHeads.get(`${PROFILE}\u0000latest`).snapshot_id
    );
    assert.equal(
      repaired.snapshotId,
      computePublishedSnapshotId(
        PROFILE,
        'latest',
        db.publishedSnapshotEntries.map((storedEntry) => JSON.parse(storedEntry.payload_json))
      )
    );
  });
  assert.equal(repairFetches, 1);

  db.publishedSnapshotEntries[0].payload_json = '{not-json';
  let outageFetches = 0;
  await withMockedFetch(async () => {
    outageFetches += 1;
    throw new Error('synthetic repair outage');
  }, async () => {
    const malformedResponse = await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const malformed = await malformedResponse.json();
    assert.equal(malformedResponse.status, 500);
    assert.equal(malformed.success, false);
    assert.deepEqual(malformed.leads, []);
    assert.equal(JSON.stringify(malformed).includes('{not-json'), false);
  });
  assert.equal(outageFetches, 1);
});

test('cached read validates count, aggregate bytes, ordinals, and content hash before returning', async () => {
  const historyLeads = Array.from({ length: 500 }, (_, index) => createPublishedLead({
    id: `read-limit-${index}`,
    company: `READ LIMIT ${index}`,
    summary: `READ LIMIT SUMMARY ${index}`,
    createdAt: '2026-07-10T00:00:00.000Z',
  }));
  const countDb = new FakeD1Database({
    publishedSnapshots: [{ profileId: PROFILE, artifactKind: 'history', leads: historyLeads }],
  });
  const extraLead = createPublishedLead({
    id: 'read-limit-extra',
    company: 'READ LIMIT EXTRA',
    summary: 'READ LIMIT EXTRA SUMMARY',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  countDb.publishedSnapshotEntries.push({
    profile_id: PROFILE,
    artifact_kind: 'history',
    snapshot_id: countDb.publishedSnapshotHeads.get(`${PROFILE}\u0000history`).snapshot_id,
    ordinal: 500,
    lead_id: extraLead.id,
    payload_json: JSON.stringify({ ...extraLead, profileId: PROFILE, source: 'managed' }),
  });
  await assert.rejects(
    getPublishedSnapshot(countDb, { profileId: PROFILE, artifactKind: 'history' }),
    (error) => error?.code === PUBLISHED_SNAPSHOT_CORRUPT_CODE
  );

  const aggregateLeads = Array.from({ length: 5 }, (_, index) => createPublishedLeadAtPayloadBytes(
    Math.floor(PUBLISHED_SNAPSHOT_ARTIFACT_MAX_UTF8_BYTES / 5) + 1,
    `read-aggregate-${index}`
  ));
  const aggregateDb = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      snapshotId: 'a'.repeat(64),
      leads: aggregateLeads,
    }],
  });
  await assert.rejects(
    getPublishedSnapshot(aggregateDb, { profileId: PROFILE, artifactKind: 'latest' }),
    (error) => error?.code === PUBLISHED_SNAPSHOT_CORRUPT_CODE
  );

  const ordinalDb = new FakeD1Database({
    publishedSnapshots: [{ profileId: PROFILE, artifactKind: 'latest', leads: CURRENT_SNAPSHOT }],
  });
  ordinalDb.publishedSnapshotEntries[1].ordinal = 3;
  await assert.rejects(
    getPublishedSnapshot(ordinalDb, { profileId: PROFILE, artifactKind: 'latest' }),
    (error) => error?.code === PUBLISHED_SNAPSHOT_CORRUPT_CODE
  );
});

test('remote JSON preflight is escape-aware and bounds cardinality, structure, and depth', () => {
  const validArtifactText = ` \n${JSON.stringify([{
    id: 'preparse-valid',
    summary: 'literal [ ] { } , : escaped " quote \\ slash and newline\nmarker',
    ignored: { nested: [{ value: 1 }] },
  }]).replace('literal [', 'literal \\u005b')}\t `;
  const scan = assertPublishedArtifactJsonComplexity(validArtifactText, {
    maxTopLevelEntries: 1,
  });
  assert.equal(scan.topLevelEntries, 1);
  assert.ok(scan.structuralTokens < PUBLISHED_ARTIFACT_REMOTE_MAX_STRUCTURAL_TOKENS);
  assert.ok(scan.maxDepthObserved < PUBLISHED_ARTIFACT_REMOTE_MAX_NESTING_DEPTH);
  assert.equal(JSON.parse(validArtifactText)[0].summary.startsWith('literal ['), true);

  assert.throws(
    () => assertPublishedArtifactJsonComplexity('[{},{}]', {
      maxTopLevelEntries: 1,
      maxStructuralTokens: 100,
      maxNestingDepth: 8,
    }),
    (error) => error?.code === PUBLISHED_ARTIFACT_REMOTE_CARDINALITY_CODE
  );
  assert.throws(
    () => assertPublishedArtifactJsonComplexity('[{"ignored":[0,0,0]}]', {
      maxTopLevelEntries: 1,
      maxStructuralTokens: 6,
      maxNestingDepth: 8,
    }),
    (error) => error?.code === PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
  );
  assert.throws(
    () => assertPublishedArtifactJsonComplexity('[[[[0]]]]', {
      maxTopLevelEntries: 1,
      maxStructuralTokens: 100,
      maxNestingDepth: 3,
    }),
    (error) => error?.code === PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
  );
  assert.throws(
    () => assertPublishedArtifactJsonComplexity('[{"id":"mismatch"]', {
      maxTopLevelEntries: 1,
    }),
    (error) => error?.code === PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
  );
});

test('remote JSON preflight rejects compact amplification before JSON.parse or D1 writes', async () => {
  const cardinalityScenarios = [
    { api: fetchLeads, count: 91 },
    { api: fetchHistory, count: 501 },
  ];
  for (const scenario of cardinalityScenarios) {
    const db = new FakeD1Database();
    const rawArtifactText = `[${Array.from({ length: scenario.count }, () => '{}').join(',')}]`;
    const { response, rawArtifactParseCalls } = await requestRawArtifactWithParseCounter({
      api: scenario.api,
      rawArtifactText,
      db,
    });
    assert.equal(response.status, 500);
    assert.equal(rawArtifactParseCalls, 0);
    assert.equal(db.batches.length, 0);
    assert.equal(db.publishedSnapshotHeads.size, 0);
  }

  const structureText = '[{"id":"structure-guard","ignored":['
    + `${'0,'.repeat(PUBLISHED_ARTIFACT_REMOTE_MAX_STRUCTURAL_TOKENS)}0]}]`;
  const depthText = '[{"id":"depth-guard","ignored":'
    + `${'['.repeat(PUBLISHED_ARTIFACT_REMOTE_MAX_NESTING_DEPTH)}0`
    + `${']'.repeat(PUBLISHED_ARTIFACT_REMOTE_MAX_NESTING_DEPTH)}}]`;
  for (const rawArtifactText of [structureText, depthText, '[{"id":"mismatch"]']) {
    const db = new FakeD1Database();
    const { response, rawArtifactParseCalls } = await requestRawArtifactWithParseCounter({
      api: fetchLeads,
      rawArtifactText,
      db,
    });
    assert.equal(response.status, 500);
    assert.equal(rawArtifactParseCalls, 0);
    assert.equal(db.batches.length, 0);
  }
});

test('remote JSON preflight preserves valid escaped data and leaves final grammar rejection to JSON.parse', async () => {
  const validSummary = 'literal [ ] { } , : escaped " quote \\ slash and newline\nmarker';
  const validArtifactText = ` \n${JSON.stringify([createPublishedLead({
    id: 'preparse-valid-integration',
    company: 'PREPARSE VALID',
    summary: validSummary,
    createdAt: '2026-07-10T00:00:00.000Z',
    ignored: { nested: [{ delimiterText: '],}:,[{' }] },
  })]).replace('literal [', 'literal \\u005b')}\t `;
  const validResult = await requestRawArtifactWithParseCounter({
    api: fetchLeads,
    rawArtifactText: validArtifactText,
  });
  assert.equal(validResult.response.status, 200);
  assert.equal(validResult.rawArtifactParseCalls, 1);
  const validPayload = await validResult.response.json();
  assert.equal(validPayload.leads[0].summary, validSummary);

  const invalidGrammarText = '[{"id":"invalid-number","score":01}]';
  const invalidResult = await requestRawArtifactWithParseCounter({
    api: fetchLeads,
    rawArtifactText: invalidGrammarText,
  });
  assert.equal(invalidResult.response.status, 500);
  assert.equal(invalidResult.rawArtifactParseCalls, 1);
});

test('DB-less managed reads reject duplicate ids and stream-bound oversized remote bodies', async () => {
  const duplicateLead = createPublishedLead({
    id: 'duplicate-remote-id',
    company: 'DUPLICATE REMOTE',
    summary: 'DUPLICATE REMOTE SUMMARY',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  await withMockedFetch(async () => jsonFixtureResponse([duplicateLead, duplicateLead]), async () => {
    const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, PROFILE);
    assert.equal(response.status, 500);
  });

  const chunkSize = Math.floor(PUBLISHED_ARTIFACT_REMOTE_MAX_BYTES / 2) + 1;
  let emitted = 0;
  let cancelled = false;
  const oversizedStream = new ReadableStream({
    pull(controller) {
      emitted += 1;
      controller.enqueue(new Uint8Array(chunkSize));
    },
    cancel() {
      cancelled = true;
    },
  });
  await withMockedFetch(async () => new Response(oversizedStream, { status: 200 }), async () => {
    const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, PROFILE);
    assert.equal(response.status, 500);
  });
  assert.equal(cancelled, true);
});

test('published snapshot ids are canonical, bounded, and unique after whitespace normalization', async () => {
  const canonical = createPublishedLead({
    id: 'canonical-id',
    company: 'CANONICAL ID COMPANY',
    summary: 'CANONICAL ID SUMMARY',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  const whitespaceDuplicate = { ...canonical, id: '  canonical-id  ' };
  assert.throws(
    () => computePublishedSnapshotId(PROFILE, 'latest', [canonical, whitespaceDuplicate]),
    /ids must be unique/
  );
  assert.throws(
    () => computePublishedSnapshotId(PROFILE, 'latest', [{
      ...canonical,
      id: 'x'.repeat(257),
    }]),
    /at most 256 UTF-8 bytes/
  );
  for (const malformedId of [123, true, {}, ['a', 'b']]) {
    assert.throws(
      () => computePublishedSnapshotId(PROFILE, 'latest', [{
        ...canonical,
        id: malformedId,
      }]),
      /lead id must be a string/
    );
  }
  for (const unsafeId of [
    '.',
    '..',
    'lead/other',
    'lead\\other',
    'lead\u0000other',
    'lead\ud800other',
    'lead\udc00other',
  ]) {
    assert.throws(
      () => computePublishedSnapshotId(PROFILE, 'latest', [{ ...canonical, id: unsafeId }]),
      /route-safe non-dot segment/
    );
  }
  assert.doesNotThrow(() => computePublishedSnapshotId(PROFILE, 'latest', [{
    ...canonical,
    id: 'lead-😀',
  }]));

  const nearPayloadLimit = createPublishedLeadAtPayloadBytes(
    PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES - 1,
    'bounded-row-id'
  );
  const { entryRowBytes } = assertPublishedSnapshotPayloadBytes(
    PROFILE,
    'latest',
    [nearPayloadLimit]
  );
  assert.ok(entryRowBytes[0] < PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES);
  assert.ok(publishedSnapshotEntryRowUtf8Bytes({
    profileId: PROFILE,
    artifactKind: 'latest',
    leadId: 'x'.repeat(150_000),
    payloadJson: 'x'.repeat(PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES),
  }) > PUBLISHED_SNAPSHOT_ENTRY_ROW_MAX_UTF8_BYTES);
});

test('profile collisions fail atomically and cached legacy collisions are unreadable', async (t) => {
  const sqliteVersion = sqliteInvocation(['-version']);
  assert.equal(sqliteVersion.status, 0, `${SQLITE_COMMAND} must be available for SQLite tests`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2b-lead-profile-collision-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const db = new LocalSqliteD1Database(path.join(tempDir, 'collision.sqlite3'));
  const sharedId = 'shared-cross-profile-id';
  const profileALead = createPublishedLead({
    id: sharedId,
    company: 'PROFILE A COMPANY',
    summary: 'PROFILE A SUMMARY',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  await savePublishedSnapshot(db, {
    profileId: 'profile-a',
    artifactKind: 'latest',
    leads: [profileALead],
  });
  db.execute(
    "UPDATE leads SET notes = 'A private reviewer note' WHERE id = 'shared-cross-profile-id'"
  );
  const profileBLead = createPublishedLead({
    id: sharedId,
    company: 'PROFILE B COMPANY',
    summary: 'PROFILE B SUMMARY',
    createdAt: '2026-07-11T00:00:00.000Z',
  });

  for (const artifactKind of ['latest', 'history']) {
    await assert.rejects(
      savePublishedSnapshot(db, {
        profileId: 'profile-b',
        artifactKind,
        leads: [profileBLead],
      }),
      /NOT NULL constraint failed: leads\.profile_id/
    );
    assert.deepEqual(db.all(
      `SELECT snapshot_id FROM published_snapshot_heads
       WHERE profile_id = 'profile-b' AND artifact_kind = '${artifactKind}'`
    ), []);
  }
  assert.deepEqual(db.all(
    `SELECT profile_id, notes FROM leads WHERE id = '${sharedId}'`
  ), [{ profile_id: 'profile-a', notes: 'A private reviewer note' }]);

  const legacyCollisionDb = new FakeD1Database({
    leads: [{
      ...createLeadRow({ id: sharedId, profile_id: 'profile-a' }),
      notes: 'A private reviewer note',
    }],
    publishedSnapshots: [{
      profileId: 'profile-b',
      artifactKind: 'latest',
      leads: [profileBLead],
    }],
  });
  await assert.rejects(
    getPublishedSnapshot(legacyCollisionDb, {
      profileId: 'profile-b',
      artifactKind: 'latest',
    }),
    (error) => error?.code === PUBLISHED_SNAPSHOT_CORRUPT_CODE
  );
});

test('mutable overlays are per-entry and aggregate bounded without loading history enrichment', async () => {
  const first = createPublishedLead({
    id: 'mutable-bound-first',
    company: 'MUTABLE BOUND FIRST',
    summary: 'MUTABLE BOUND FIRST SUMMARY',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  const second = createPublishedLead({
    id: 'mutable-bound-second',
    company: 'MUTABLE BOUND SECOND',
    summary: 'MUTABLE BOUND SECOND SUMMARY',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  const oversizedBody = 'x'.repeat(PUBLISHED_SNAPSHOT_MUTABLE_RAW_MAX_UTF8_BYTES + 1);
  const db = new FakeD1Database({
    leads: [
      createLeadRow({ id: first.id, profile_id: PROFILE, enriched: 1, article_body: oversizedBody }),
      createLeadRow({ id: second.id, profile_id: PROFILE }),
    ],
    publishedSnapshots: [
      { profileId: PROFILE, artifactKind: 'latest', leads: [first, second] },
      { profileId: PROFILE, artifactKind: 'history', leads: [first, second] },
    ],
  });
  const rawLatestRows = await db.publishedSnapshotJoinedRows(PROFILE, 'latest', 90, 91);
  assert.ok(rawLatestRows.every((row) => row.snapshot_mutable_json === null));
  await assert.rejects(
    getPublishedSnapshot(db, { profileId: PROFILE, artifactKind: 'latest' }),
    (error) => error?.code === PUBLISHED_SNAPSHOT_OVERLAY_LIMIT_CODE
  );
  const history = await getPublishedSnapshot(db, { profileId: PROFILE, artifactKind: 'history' });
  assert.equal(history.leads.length, 2);
  assert.equal(history.leads.some((lead) => lead.articleBody === oversizedBody), false);

  const aggregateCount = Math.ceil(
    PUBLISHED_SNAPSHOT_MUTABLE_AGGREGATE_MAX_UTF8_BYTES / 60_000
  ) + 1;
  const aggregateLeads = Array.from({ length: aggregateCount }, (_, index) => createPublishedLead({
    id: `mutable-aggregate-${index}`,
    company: `MUTABLE AGGREGATE ${index}`,
    summary: `MUTABLE AGGREGATE SUMMARY ${index}`,
    createdAt: '2026-07-10T00:00:00.000Z',
  }));
  const aggregateDb = new FakeD1Database({
    leads: aggregateLeads.map((lead) => createLeadRow({
      id: lead.id,
      profile_id: PROFILE,
      notes: 'n'.repeat(60_000),
    })),
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      leads: aggregateLeads,
    }],
  });
  const aggregateRows = await aggregateDb.publishedSnapshotJoinedRows(
    PROFILE,
    'latest',
    90,
    91
  );
  assert.ok(aggregateRows.every((row) => row.snapshot_mutable_json === null));
  await assert.rejects(
    getPublishedSnapshot(aggregateDb, { profileId: PROFILE, artifactKind: 'latest' }),
    (error) => error?.code === PUBLISHED_SNAPSHOT_OVERLAY_LIMIT_CODE
  );
});

test('one oversized persisted payload suppresses every sibling before parsing', async () => {
  const db = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      leads: CURRENT_SNAPSHOT,
    }],
  });
  const payload = JSON.parse(db.publishedSnapshotEntries[0].payload_json);
  db.publishedSnapshotEntries[0].payload_json = JSON.stringify({
    ...payload,
    summary: 'x'.repeat(PUBLISHED_SNAPSHOT_ENTRY_MAX_UTF8_BYTES),
  });

  const rows = await db.publishedSnapshotJoinedRows(PROFILE, 'latest', 90, 91);
  assert.equal(rows.length, CURRENT_SNAPSHOT.length);
  assert.ok(rows.every((row) => row.snapshot_payload_json === null));
  assert.ok(rows.every((row) => row.snapshot_mutable_json === null));
  await assert.rejects(
    getPublishedSnapshot(db, { profileId: PROFILE, artifactKind: 'latest' }),
    (error) => error?.code === PUBLISHED_SNAPSHOT_CORRUPT_CODE
  );
});

test('corrupt-cache repair cannot turn an upstream 404 into a successful empty response', async () => {
  const db = new FakeD1Database({
    publishedSnapshots: [{
      profileId: PROFILE,
      artifactKind: 'latest',
      leads: CURRENT_SNAPSHOT,
    }],
  });
  const stored = JSON.parse(db.publishedSnapshotEntries[0].payload_json);
  db.publishedSnapshotEntries[0].payload_json = JSON.stringify({
    ...stored,
    summary: 'CORRUPT ALLOWED CONTENT',
  });

  await withMockedFetch(async () => new Response('not found', { status: 404 }), async () => {
    const response = await fetchLeads({ DB: db, GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const payload = await response.json();
    assert.equal(response.status, 500);
    assert.equal(payload.success, false);
  });

  await withMockedFetch(async () => new Response('not found', { status: 404 }), async () => {
    const response = await fetchLeads({ DB: new FakeD1Database(), GITHUB_REPO: 'fixture/repo' }, PROFILE);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(payload.leads, []);
  });
});

test('managed profile ids stay one encoded non-dot GitHub report path segment', async () => {
  let requestedPath = '';
  await withMockedFetch(async (input) => {
    requestedPath = new URL(input).pathname;
    return new Response('not found', { status: 404 });
  }, async () => {
    const response = await fetchLeads(
      { GITHUB_REPO: 'fixture/repo' },
      'profile:safe'
    );
    assert.equal(response.status, 200);
  });
  assert.match(requestedPath, /reports\/profile%3Asafe\/latest-leads\.json$/);

  for (const unsafeProfile of [
    '.',
    '..',
    'profile-a/../profile-b',
    'profile\\other',
    'foo bar',
    'foo  bar',
  ]) {
    let fetchAttempts = 0;
    await withMockedFetch(async () => {
      fetchAttempts += 1;
      return new Response('not found', { status: 404 });
    }, async () => {
      const response = await fetchLeads({ GITHUB_REPO: 'fixture/repo' }, unsafeProfile);
      assert.equal(response.status, 500, unsafeProfile);
    });
    assert.equal(fetchAttempts, 0, unsafeProfile);
  }
});
