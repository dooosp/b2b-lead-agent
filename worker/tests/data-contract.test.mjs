import test from 'node:test';
import assert from 'node:assert/strict';

import { saveLeadsBatch } from '../db/leads.js';
import {
  buildLeadIdentityKey,
  canonicalizeSourceUrl,
  computeStableLeadId,
  leadToRow,
  rowToLead,
} from '../db/transform.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLead } from './helpers/fixtures.mjs';

function makeLead(overrides = {}) {
  return createLead({
    company: 'LG전자',
    summary: '스마트팩토리 증설 프로젝트',
    product: 'A-Controller',
    score: 82,
    grade: 'A',
    roi: '정량 데이터 부족 - 절감률 6~10% 예상',
    salesPitch: '현장 자동화 기준선 정립이 필요합니다.',
    globalContext: '스마트팩토리 투자 확대',
    sources: [
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?id=100&utm_source=rss',
      },
      {
        title: 'LG전자 증설 계획 발표',
        url: 'https://news.google.com/rss/articles/abc123',
      },
    ],
    eventType: '증설',
    ...overrides,
  });
}

test('source-order changes preserve the same persisted id and identity_key', async () => {
  const db = new FakeD1Database();

  await saveLeadsBatch(db, [makeLead()], 'fixture-profile', 'managed');
  await saveLeadsBatch(db, [makeLead({
    sources: [
      {
        title: 'LG전자 증설 계획 발표',
        url: 'https://news.google.com/rss/articles/abc123',
      },
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?utm_campaign=spring&id=100&ref=naver',
      },
    ],
  })], 'fixture-profile', 'managed');

  assert.equal(db.leads.size, 1);

  const [storedRow] = [...db.leads.values()];
  assert.equal(storedRow.id, computeStableLeadId(makeLead(), { profileId: 'fixture-profile' }));
  assert.equal(storedRow.identity_key, buildLeadIdentityKey(makeLead(), { profileId: 'fixture-profile' }));
});

test('decorated query URL variants normalize before persistence', () => {
  const baseRow = leadToRow(makeLead({
    sources: [
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?id=100&utm_source=rss&utm_medium=email',
      },
    ],
  }), 'fixture-profile', 'managed');
  const variantRow = leadToRow(makeLead({
    sources: [
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?utm_campaign=spring&id=100&ref=naver',
      },
    ],
  }), 'fixture-profile', 'managed');

  assert.equal(
    canonicalizeSourceUrl('https://example.com/news/lg-smart-factory?utm_campaign=spring&id=100&ref=naver'),
    'https://example.com/news/lg-smart-factory?id=100'
  );
  assert.equal(baseRow.id, variantRow.id);
  assert.equal(baseRow.identity_key, variantRow.identity_key);
  assert.equal(baseRow.sources, variantRow.sources);
});

test('lead -> row -> lead round-trip keeps canonical contract fields stable', () => {
  const initialRow = leadToRow(makeLead({
    sources: [
      {
        title: 'LG전자 증설 계획 발표',
        url: 'https://news.google.com/rss/articles/abc123',
      },
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?utm_medium=email&id=100&utm_source=rss',
      },
    ],
  }), 'fixture-profile', 'managed');

  const roundTrippedLead = rowToLead(initialRow);
  const roundTrippedRow = leadToRow(roundTrippedLead, roundTrippedLead.profileId, roundTrippedLead.source);

  assert.equal(roundTrippedLead.id, initialRow.id);
  assert.equal(roundTrippedLead.identityKey, initialRow.identity_key);
  assert.equal(roundTrippedRow.id, initialRow.id);
  assert.equal(roundTrippedRow.identity_key, initialRow.identity_key);
  assert.equal(roundTrippedRow.sources, initialRow.sources);
  assert.equal(roundTrippedRow.company, initialRow.company);
  assert.equal(roundTrippedRow.event_type, initialRow.event_type);
});

test('lead serialization maps canonical LeadBrief aliases into persisted row fields', () => {
  const row = leadToRow(makeLead({
    summary: '',
    signal: 'Warehouse automation retrofit',
    salesPitch: '',
    recommendedMessage: 'Open with baseline automation risk.',
    urgencyReason: '',
    whyNow: 'Budget is being finalized this quarter.',
    reviewStatus: 'APPROVED',
    confidence: 'HIGH',
    assumptions: ['Site footprint is based on public plans.'],
    dataGaps: ['Decision owner unconfirmed'],
  }), 'fixture-profile', 'managed');
  const lead = rowToLead(row);

  assert.equal(row.summary, 'Warehouse automation retrofit');
  assert.equal(row.sales_pitch, 'Open with baseline automation risk.');
  assert.equal(row.urgency_reason, 'Budget is being finalized this quarter.');
  assert.equal(row.review_status, 'APPROVED');
  assert.equal(row.confidence, 'HIGH');
  assert.deepEqual(JSON.parse(row.assumptions), ['Site footprint is based on public plans.']);
  assert.ok(JSON.parse(row.data_gaps).includes('Decision owner unconfirmed'));
  assert.equal(lead.signal, 'Warehouse automation retrofit');
  assert.equal(lead.recommendedMessage, 'Open with baseline automation risk.');
  assert.equal(lead.whyNow, 'Budget is being finalized this quarter.');
});

test('legacy row serialization is conservative when JSON fields are malformed', () => {
  const lead = rowToLead({
    id: 'legacy-bad-json',
    profile_id: 'fixture-profile',
    source: 'managed',
    status: 'CONTACTED',
    review_status: '',
    company: 'Legacy Corp',
    summary: 'Legacy signal',
    product: 'Controller',
    score: 75,
    grade: 'B',
    roi: '',
    sales_pitch: '',
    global_context: '',
    sources: '{not-json',
    notes: '',
    evidence: '{not-json',
    confidence: '',
    confidence_reason: '',
    assumptions: '{not-json',
    generation_mode: 'unknown',
    verification_status: '',
    data_gaps: '{not-json',
    event_type: '',
    created_at: '2026-04-07T00:00:00.000Z',
    updated_at: '2026-04-07T00:00:00.000Z',
  });

  assert.deepEqual(lead.sources, []);
  assert.deepEqual(lead.evidence, []);
  assert.deepEqual(lead.assumptions, []);
  assert.equal(lead.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(lead.confidence, 'LOW');
  assert.equal(lead.generationMode, 'llm');
  assert.equal(lead.verificationStatus, 'needs_review');
  assert.ok(lead.dataGaps.includes('Published source evidence missing'));
  assert.ok(lead.dataGaps.includes('Direct evidence quote missing'));
});

test('legacy rows without identity_key still deserialize safely and backfill deterministically', () => {
  const legacyRow = {
    id: 'legacy-row-1',
    profile_id: 'fixture-profile',
    source: 'managed',
    status: 'NEW',
    review_status: 'NEEDS_REVIEW',
    company: 'LG전자',
    summary: '스마트팩토리 증설 프로젝트',
    product: 'A-Controller',
    score: 82,
    grade: 'A',
    roi: '정량 데이터 부족 - 절감률 6~10% 예상',
    sales_pitch: '현장 자동화 기준선 정립이 필요합니다.',
    global_context: '스마트팩토리 투자 확대',
    sources: JSON.stringify([
      {
        title: 'LG전자 증설 계획 발표',
        url: 'https://news.google.com/rss/articles/abc123',
      },
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?utm_medium=email&id=100&utm_source=rss',
      },
    ]),
    notes: '',
    enriched: 0,
    article_body: '',
    action_items: '[]',
    key_figures: '[]',
    pain_points: '[]',
    score_reason: '',
    urgency: '',
    urgency_reason: '',
    buyer_role: '',
    evidence: '[]',
    confidence: '',
    confidence_reason: '',
    assumptions: '[]',
    generation_mode: 'llm',
    verification_status: 'needs_review',
    data_gaps: '[]',
    event_type: '증설',
    enriched_at: null,
    follow_up_date: '',
    estimated_value: 0,
    created_at: '2026-04-07T00:00:00.000Z',
    updated_at: '2026-04-07T00:00:00.000Z',
  };

  const lead = rowToLead(legacyRow);
  const row = leadToRow(lead, lead.profileId, lead.source);

  assert.equal(lead.id, 'legacy-row-1');
  assert.match(lead.identityKey, /^[a-f0-9]{40}$/);
  assert.equal(row.id, 'legacy-row-1');
  assert.equal(row.identity_key, lead.identityKey);
  assert.equal(
    row.sources,
    JSON.stringify([
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?id=100',
      },
      {
        title: 'LG전자 증설 계획 발표',
        url: 'https://news.google.com/rss/articles/abc123',
      },
    ])
  );
});
