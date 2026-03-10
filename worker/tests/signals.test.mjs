import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSignal, signalToRow, rowToSignal } from '../db/signals.js';

test('normalizeSignal applies context defaults and clamps scores', () => {
  const signal = normalizeSignal({
    signal_type: 'hiring',
    signal_source: 'company-careers',
    signal_strength: 120,
    recency_score: -10,
    structured_evidence_json: {
      team: 'AI infra',
      details: {
        role: 'Energy Optimization Manager',
        location: 'Seoul'
      }
    }
  }, {
    leadId: 'lead_123',
    profileId: 'siemens',
    company: 'LG CNS'
  });

  assert.equal(signal.leadId, 'lead_123');
  assert.equal(signal.profileId, 'siemens');
  assert.equal(signal.company, 'LG CNS');
  assert.equal(signal.signalStrength, 100);
  assert.equal(signal.recencyScore, 0);
  assert.deepEqual(signal.structuredEvidence, {
    team: 'AI infra',
    details: {
      role: 'Energy Optimization Manager',
      location: 'Seoul'
    }
  });
});

test('signalToRow stores structured evidence as JSON and rowToSignal restores it', () => {
  const row = signalToRow({
    leadId: 'lead_456',
    profileId: 'danfoss',
    company: 'DL E&C',
    signalType: 'news',
    signalSource: 'google-news',
    sourceUrl: 'https://example.com/article',
    sourceTitle: 'DL E&C expands data center pipeline',
    sourcePublishedAt: '2026-03-09T10:00:00.000Z',
    signalStrength: 82,
    recencyScore: 74,
    trustScore: 61,
    painHint: 'Cooling load likely rising with capacity expansion',
    urgencyHint: 'New site design decisions underway',
    businessImpactHint: 'Energy cost and uptime exposure increasing',
    rawExcerpt: 'The developer plans an additional hyperscale data center phase.',
    structuredEvidence: {
      capacities: ['hyperscale phase', 'new capacity'],
      sourceType: 'article'
    },
    createdAt: '2026-03-10T09:00:00.000Z'
  });

  assert.match(row.id, /^sig_/);
  assert.equal(row.structured_evidence_json, JSON.stringify({
    capacities: ['hyperscale phase', 'new capacity'],
    sourceType: 'article'
  }));

  assert.deepEqual(rowToSignal(row), {
    id: row.id,
    leadId: 'lead_456',
    profileId: 'danfoss',
    company: 'DL E&C',
    signalType: 'news',
    signalSource: 'google-news',
    sourceUrl: 'https://example.com/article',
    sourceTitle: 'DL E&C expands data center pipeline',
    sourcePublishedAt: '2026-03-09T10:00:00.000Z',
    signalStrength: 82,
    recencyScore: 74,
    trustScore: 61,
    painHint: 'Cooling load likely rising with capacity expansion',
    urgencyHint: 'New site design decisions underway',
    businessImpactHint: 'Energy cost and uptime exposure increasing',
    rawExcerpt: 'The developer plans an additional hyperscale data center phase.',
    structuredEvidence: {
      capacities: ['hyperscale phase', 'new capacity'],
      sourceType: 'article'
    },
    createdAt: '2026-03-10T09:00:00.000Z'
  });
});
