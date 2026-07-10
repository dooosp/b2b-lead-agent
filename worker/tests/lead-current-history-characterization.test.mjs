import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchHistory, fetchLeads } from '../api/leads.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLeadRow } from './helpers/fixtures.mjs';
import { jsonFixtureResponse, withMockedFetch } from './helpers/http.mjs';

const PROFILE = 'danfoss';

function createPublishedLead({ id, company, summary, createdAt }) {
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
  };
}

const CURRENT_SNAPSHOT = [
  createPublishedLead({
    id: 'current-snapshot-only',
    company: 'CURRENT SNAPSHOT COMPANY',
    summary: 'CURRENT SNAPSHOT MARKER',
    createdAt: '2026-07-10T09:00:00.000Z',
  }),
];

const HISTORICAL_SNAPSHOT = [
  createPublishedLead({
    id: 'history-snapshot-only',
    company: 'HISTORY SNAPSHOT COMPANY',
    summary: 'HISTORY SNAPSHOT MARKER',
    createdAt: '2026-06-15T09:00:00.000Z',
  }),
];

function artifactName(input) {
  const pathname = new URL(String(input)).pathname;
  return pathname.split('/').at(-1);
}

async function runApiOrder(order) {
  const db = new FakeD1Database();
  const requestedArtifacts = [];
  const env = {
    DB: db,
    GITHUB_REPO: 'synthetic-owner/synthetic-repo',
  };
  const payloads = {};

  await withMockedFetch(async (input) => {
    const artifact = artifactName(input);
    requestedArtifacts.push(artifact);
    if (artifact === 'latest-leads.json') return jsonFixtureResponse(CURRENT_SNAPSHOT);
    if (artifact === 'lead-history.json') return jsonFixtureResponse(HISTORICAL_SNAPSHOT);
    throw new Error(`Unexpected mocked fetch target: ${String(input)}`);
  }, async () => {
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

test('characterization: current/history results depend only on which API populates the shared D1 table first', async () => {
  const currentThenHistory = await runApiOrder(['current', 'history']);
  const historyThenCurrent = await runApiOrder(['history', 'current']);

  assert.deepEqual(currentThenHistory.requestedArtifacts, ['latest-leads.json']);
  assert.equal(currentThenHistory.payloads.current.source, 'github');
  assert.equal(currentThenHistory.payloads.history.source, 'd1');
  assert.deepEqual(ids(currentThenHistory.payloads.current.leads), ['current-snapshot-only']);

  // This assertion records the current audited behavior. It is not the desired
  // data contract and is expected to change in the remediation PR.
  assert.deepEqual(ids(currentThenHistory.payloads.history.history), ['current-snapshot-only']);
  assert.deepEqual([...currentThenHistory.db.leads.keys()], ['current-snapshot-only']);

  assert.deepEqual(historyThenCurrent.requestedArtifacts, ['lead-history.json']);
  assert.equal(historyThenCurrent.payloads.history.source, 'github');
  assert.equal(historyThenCurrent.payloads.current.source, 'd1');
  assert.deepEqual(ids(historyThenCurrent.payloads.history.history), ['history-snapshot-only']);

  // This assertion records the current audited behavior. It is not the desired
  // data contract and is expected to change in the remediation PR.
  assert.deepEqual(ids(historyThenCurrent.payloads.current.leads), ['history-snapshot-only']);
  assert.deepEqual([...historyThenCurrent.db.leads.keys()], ['history-snapshot-only']);

  assert.notDeepEqual(
    ids(currentThenHistory.payloads.current.leads),
    ids(historyThenCurrent.payloads.current.leads),
  );
});

test('characterization: one existing D1 row permanently short-circuits refresh from a newer latest snapshot', async () => {
  const staleRow = createLeadRow({
    id: 'stale-d1-current',
    company: 'STALE D1 COMPANY',
    summary: 'STALE D1 CURRENT MARKER',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  });
  const newerLatest = [
    createPublishedLead({
      id: 'newer-github-current',
      company: 'NEWER GITHUB COMPANY',
      summary: 'NEWER GITHUB LATEST MARKER',
      createdAt: '2026-07-10T10:00:00.000Z',
    }),
  ];
  const db = new FakeD1Database({ leads: [staleRow] });
  let fetchAttempts = 0;

  await withMockedFetch(async (input) => {
    fetchAttempts += 1;
    assert.equal(artifactName(input), 'latest-leads.json');
    return jsonFixtureResponse(newerLatest);
  }, async () => {
    for (let read = 0; read < 2; read += 1) {
      const response = await fetchLeads({
        DB: db,
        GITHUB_REPO: 'synthetic-owner/synthetic-repo',
      }, PROFILE);
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.source, 'd1');
      // This assertion records the current audited behavior. It is not the
      // desired freshness contract and is expected to change in remediation.
      assert.deepEqual(ids(payload.leads), ['stale-d1-current']);
      assert.equal(payload.leads[0].summary, 'STALE D1 CURRENT MARKER');
      assert.notEqual(payload.leads[0].summary, 'NEWER GITHUB LATEST MARKER');
    }
  });

  assert.equal(fetchAttempts, 0);
  assert.deepEqual([...db.leads.keys()], ['stale-d1-current']);
});

test.todo('desired contract: mutable lead/review state is stored separately from published snapshot membership');
test.todo('desired contract: current and history responses are order-independent');
test.todo('desired contract: current reads use an explicit latest snapshot identity');
test.todo('desired contract: freshness rules prevent an existing row from making current permanently stale');
