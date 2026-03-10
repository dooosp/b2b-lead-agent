import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEnrichData, buildPainSignalsFromEnrichment } from '../api/enrichment.js';

test('normalizeEnrichData preserves additive pain fields and missing information', () => {
  const normalized = normalizeEnrichData({
    summary: '신규 데이터센터 증설 검토',
    painPoint: '냉각 부하 증가로 운영비 상승 우려',
    urgency: 'high',
    urgencyReason: '설계 단계에서 냉각 아키텍처를 확정해야 함',
    businessImpact: '전력비와 가동률 리스크가 동시에 커짐',
    likelyInitiative: '고효율 냉각 설비 표준화',
    stakeholderHint: '데이터센터 개발 PM / 설비기술팀',
    signalStrength: 88,
    confidence: 'medium',
    confidenceReason: '본문에 증설 계획은 있으나 예산은 미공개',
    missingInformation: ['예산 규모 미확인', '의사결정자 실명 미확인'],
    evidence: [{ field: 'painPoint', quote: '추가 데이터센터 단계가 추진된다', sourceUrl: 'https://example.com/a' }],
    painPoints: ['냉각 부하 증가', '전력비 상승'],
    buyingSignals: ['증설 발표']
  }, {
    summary: 'fallback summary',
    roi: '',
    salesPitch: '',
    globalContext: '',
    score: 72
  });

  assert.equal(normalized.painPoint, '냉각 부하 증가로 운영비 상승 우려');
  assert.equal(normalized.urgency, 'HIGH');
  assert.equal(normalized.businessImpact, '전력비와 가동률 리스크가 동시에 커짐');
  assert.equal(normalized.stakeholderHint, '데이터센터 개발 PM / 설비기술팀');
  assert.equal(normalized.signalStrength, 88);
  assert.equal(normalized.confidence, 'MEDIUM');
  assert.deepEqual(normalized.missingInformation, ['예산 규모 미확인', '의사결정자 실명 미확인']);
});

test('normalizeEnrichData uses unknown for unsupported claims', () => {
  const normalized = normalizeEnrichData({
    summary: '본문 없는 기사 요약',
    urgency: 'not-valid',
    confidence: 'not-valid',
    evidence: []
  }, {
    summary: 'fallback summary',
    roi: '',
    salesPitch: '',
    globalContext: '',
    score: 40
  });

  assert.equal(normalized.painPoint, 'unknown');
  assert.equal(normalized.businessImpact, 'unknown');
  assert.equal(normalized.likelyInitiative, 'unknown');
  assert.equal(normalized.stakeholderHint, 'unknown');
  assert.equal(normalized.urgency, 'MEDIUM');
  assert.equal(normalized.confidence, 'LOW');
  assert.equal(normalized.confidenceReason, 'unknown');
});

test('buildPainSignalsFromEnrichment maps enriched lead into company_signals payload', () => {
  const signals = buildPainSignalsFromEnrichment({
    id: 'lead_1',
    profileId: 'danfoss',
    company: 'DL E&C',
    createdAt: '2026-03-09T00:00:00.000Z',
    eventType: 'news',
    source: 'managed',
    summary: '데이터센터 증설',
    sources: [{ title: 'DL E&C expands data center pipeline', url: 'https://example.com/article' }]
  }, {
    painPoint: '냉각 부하 증가',
    urgency: 'HIGH',
    urgencyReason: '설계 단계 의사결정 임박',
    businessImpact: '운영비와 uptime 리스크 상승',
    likelyInitiative: '냉각 설비 표준화',
    stakeholderHint: '설비기술팀',
    signalStrength: 81,
    confidence: 'MEDIUM',
    confidenceReason: '증설 발표는 확인되나 예산은 미확인',
    missingInformation: ['예산 규모 미확인'],
    keyFigures: ['증설 1개 동'],
    buyingSignals: ['증설 발표'],
    evidence: [{ field: 'painPoint', quote: '추가 단계가 추진된다', sourceUrl: 'https://example.com/article' }]
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0].leadId, 'lead_1');
  assert.equal(signals[0].signalType, 'news');
  assert.equal(signals[0].signalSource, 'example.com');
  assert.equal(signals[0].painHint, '냉각 부하 증가');
  assert.equal(signals[0].businessImpactHint, '운영비와 uptime 리스크 상승');
  assert.deepEqual(signals[0].structuredEvidence.missingInformation, ['예산 규모 미확인']);
});
