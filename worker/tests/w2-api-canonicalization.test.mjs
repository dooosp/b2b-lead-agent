import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalizeLeadProductForProfile,
  resolveLeadProfileForQuery,
} from '../lib/profile.js';
import { fetchHistory, fetchLeads } from '../api/leads.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLeadRow } from './helpers/fixtures.mjs';
import { jsonFixtureResponse, withMockedFetch } from './helpers/http.mjs';

test('resolveLeadProfileForQuery keeps valid self-service profiles explicit', () => {
  const result = resolveLeadProfileForQuery(' self-service:acme-co ', {
    PROFILES: JSON.stringify([{ id: 'danfoss', name: '댄포스 코리아' }]),
  });

  assert.deepEqual(result, {
    ok: true,
    profileId: 'self-service:acme-co',
    profileType: 'self-service',
  });
});

test('canonicalizeLeadProductForProfile normalizes legacy managed aliases', () => {
  const result = canonicalizeLeadProductForProfile('siemens', 'Desigo CC');

  assert.equal(result.product, 'Desigo CC 통합 빌딩관리');
  assert.equal(result.resolution, 'normalized');
  assert.equal(result.reason, 'alias-match');
});

test('canonicalizeLeadProductForProfile downgrades cross-profile mismatches and orphans', () => {
  const mismatch = canonicalizeLeadProductForProfile('danfoss', 'Desigo CC');
  const orphan = canonicalizeLeadProductForProfile('ls-electric', 'Unknown Widget');

  assert.equal(mismatch.product, 'iC7 Marine 드라이브');
  assert.equal(mismatch.resolution, 'fallback');
  assert.equal(mismatch.reason, 'profile-mismatch:siemens');
  assert.equal(orphan.product, 'GSIS 가스절연개폐장치');
  assert.equal(orphan.resolution, 'fallback');
  assert.equal(orphan.reason, 'orphan-product');
});

test('fetchLeads canonicalizes managed DB lead products and profile IDs', async () => {
  const db = new FakeD1Database({
    leads: [createLeadRow({
      profile_id: 'danfoss',
      product: 'Desigo CC',
    })],
  });

  const response = await fetchLeads({ DB: db }, 'danfoss');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.profile, 'danfoss');
  assert.equal(payload.source, 'd1');
  assert.equal(payload.leads[0].profileId, 'danfoss');
  assert.equal(payload.leads[0].product, 'iC7 Marine 드라이브');
  assert.notEqual(payload.leads[0].product, 'Desigo CC');
});

test('fetchHistory canonicalizes managed GitHub history products before returning them', async () => {
  await withMockedFetch(async () => jsonFixtureResponse([
    {
      id: 'lead-2',
      company: 'Beta Corp',
      product: 'VLT Drive',
      summary: 'Drive refresh',
      score: 80,
      grade: 'A'
    }
  ]), async () => {
    const response = await fetchHistory({ GITHUB_REPO: 'acme/repo' }, 'danfoss');
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.profile, 'danfoss');
    assert.equal(payload.source, 'github');
    assert.equal(payload.history[0].profileId, 'danfoss');
    assert.equal(payload.history[0].product, 'VLT AutomationDrive');
  });
});

test('fetchLeads preserves self-service products while keeping canonical profile IDs', async () => {
  const db = new FakeD1Database({
    leads: [createLeadRow({
      profile_id: 'self-service:acme',
      source: 'self-service',
      product: 'Custom Analytics Studio',
    })],
  });

  const response = await fetchLeads({ DB: db }, 'self-service:acme');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.profile, 'self-service:acme');
  assert.equal(payload.leads[0].profileId, 'self-service:acme');
  assert.equal(payload.leads[0].product, 'Custom Analytics Studio');
});
