import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEnrichmentPrompt, normalizeEnrichData } from '../api/enrichment.js';

function createLead(overrides = {}) {
  return {
    company: 'LG전자',
    summary: 'LG전자가 스마트팩토리 에너지 효율 개선 투자를 검토 중이다.',
    product: '에너지 관리 시스템',
    roi: '',
    salesPitch: '',
    globalContext: '',
    sources: [
      {
        title: 'LG전자, 스마트팩토리 에너지 효율 개선 투자 검토',
        url: 'https://example.com/news'
      }
    ],
    ...overrides
  };
}

test('buildEnrichmentPrompt uses no-body-specific evidence and ROI guidance', () => {
  const prompt = buildEnrichmentPrompt(createLead(), '');

  assert.match(prompt, /\[기사 본문 없음\]/);
  assert.match(prompt, /직접 인용을 만들지 말 것/);
  assert.match(prompt, /evidence는 빈 배열\(\[\]\)로 반환/);
  assert.match(prompt, /구체 금액, 절감률, payback 숫자를 쓰지 말 것/);
  assert.match(prompt, /기사 본문 미확보/);
  assert.doesNotMatch(prompt, /기사 원문에서 직접 인용/);
  assert.match(prompt, /"evidence":\[\]/);
});

test('normalizeEnrichData drops evidence quotes and numeric ROI when article body is missing', () => {
  const normalized = normalizeEnrichData({
    roi: '투자 추정 10억 -> 절감 추정 2억/년 (Payback 5년)',
    evidence: [
      {
        field: 'roi',
        quote: '회사는 연간 2억원 절감을 기대한다고 밝혔다.',
        sourceUrl: 'https://example.com/news'
      }
    ],
    dataGaps: []
  }, createLead(), { hasArticleBody: false });

  assert.equal(normalized.roi, '근거 없음(추정 불가) - 기사 본문 미확보로 정량 ROI 산정 불가');
  assert.deepEqual(normalized.evidence, []);
  assert.deepEqual(normalized.dataGaps, ['기사 본문 미확보']);
});

test('normalizeEnrichData keeps conservative assumptions and appends missing-body gap', () => {
  const normalized = normalizeEnrichData({
    roi: '정량 데이터 부족 - 운영 데이터 추가 확인 필요',
    assumptions: ['기사 제목과 리드 요약만 기준으로 1차 검토함'],
    dataGaps: ['예산 규모 미확인'],
    evidence: [
      {
        field: 'summary',
        quote: 'LG전자, 스마트팩토리 에너지 효율 개선 투자 검토',
        sourceUrl: 'https://example.com/news'
      }
    ]
  }, createLead(), { hasArticleBody: false });

  assert.equal(normalized.roi, '근거 없음(추정 불가) - 정량 데이터 부족 - 운영 데이터 추가 확인 필요');
  assert.deepEqual(normalized.assumptions, ['기사 제목과 리드 요약만 기준으로 1차 검토함']);
  assert.deepEqual(normalized.evidence, []);
  assert.deepEqual(normalized.dataGaps, ['예산 규모 미확인', '기사 본문 미확보']);
});

test('normalizeEnrichData preserves numeric ROI warning when article body exists', () => {
  const normalized = normalizeEnrichData({
    roi: '투자 추정 10억 -> 절감 추정 2억/년 (Payback 5년)',
    assumptions: []
  }, createLead(), { hasArticleBody: true });

  assert.equal(normalized.roi, '투자 추정 10억 -> 절감 추정 2억/년 (Payback 5년)');
  assert.deepEqual(normalized.assumptions, ['(시스템 경고: ROI에 숫자가 포함되었으나 가정이 명시되지 않음)']);
});
