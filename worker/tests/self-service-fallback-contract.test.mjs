import test from 'node:test';
import assert from 'node:assert/strict';

import { generateQuickLeadsWorker } from '../self-service/analyze.js';
import {
  createSelfServiceSchemaPayloadWorker,
  isValidSelfServiceResponseSchema,
} from '../self-service/lead-utils.js';
import { handleSelfServiceAnalyze } from '../self-service/orchestrator.js';
import { leadToRow, rowToLead } from '../db/transform.js';

function createProfile() {
  return {
    name: 'LG전자',
    industry: '제조',
    products: {
      energy: ['에너지 관리 시스템']
    },
    productKnowledge: {
      '에너지 관리 시스템': { value: '전력 피크 관리', roi: '전력비 절감' }
    },
    categoryRules: {
      energy: ['에너지', '투자']
    },
    categoryConfig: {
      energy: {
        product: '에너지 관리 시스템',
        score: 78,
        roi: '정량 데이터 부족',
        policy: '제조업 에너지 효율 투자 확대',
        pitch: '{company}에 {product} 도입을 제안합니다.'
      }
    },
    searchQueries: ['LG전자 에너지 투자']
  };
}

function createArticle() {
  return {
    title: 'LG전자, 스마트팩토리 에너지 효율 투자 확대',
    query: 'LG전자 에너지 투자',
    link: 'https://example.com/news/lg-energy'
  };
}

test('quick self-service fallback leads are explicitly heuristic and not verified', () => {
  const leads = generateQuickLeadsWorker([createArticle()], createProfile(), 'LG전자');

  assert.equal(leads.length, 1);
  assert.equal(leads[0].generationMode, 'heuristic');
  assert.equal(leads[0].verificationStatus, 'needs_review');
  assert.ok(['LOW', 'MEDIUM'].includes(leads[0].confidence));
  assert.match(leads[0].confidenceReason, /규칙|본문|제목/);
  assert.ok(leads[0].assumptions.length > 0);
  assert.ok(leads[0].dataGaps.includes('LLM 정밀 분석 미완료'));
});

test('self-service response schema preserves fallback trust fields', () => {
  const [lead] = generateQuickLeadsWorker([createArticle()], createProfile(), 'LG전자');
  const payload = createSelfServiceSchemaPayloadWorker([lead], '규칙 기반 결과입니다.');

  assert.equal(isValidSelfServiceResponseSchema(payload), true);
  assert.equal(payload.leads[0].generationMode, 'heuristic');
  assert.equal(payload.leads[0].verificationStatus, 'needs_review');
  assert.equal(typeof payload.leads[0].confidenceReason, 'string');
  assert.ok(Array.isArray(payload.leads[0].assumptions));
  assert.ok(Array.isArray(payload.leads[0].dataGaps));
});

test('self-service missing LLM credentials returns an explicit unavailable generation contract', async () => {
  const response = await handleSelfServiceAnalyze(
    new Request('https://example.com/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'LG전자', industry: '제조' })
    }),
    {},
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.success, false);
  assert.equal(payload.generationMode, 'unavailable');
  assert.equal(payload.verificationStatus, 'unverified');
  assert.ok(payload.dataGaps.includes('LLM API key missing'));
});

test('self-service persisted rows keep fallback trust metadata machine-readable', () => {
  const [lead] = generateQuickLeadsWorker([createArticle()], createProfile(), 'LG전자');
  const row = leadToRow(lead, 'self-service:LG전자', 'self-service');
  const roundTripped = rowToLead(row);

  assert.equal(row.generation_mode, 'heuristic');
  assert.equal(row.verification_status, 'needs_review');
  assert.equal(JSON.parse(row.data_gaps).includes('LLM 정밀 분석 미완료'), true);
  assert.equal(roundTripped.generationMode, 'heuristic');
  assert.equal(roundTripped.verificationStatus, 'needs_review');
  assert.ok(roundTripped.dataGaps.includes('LLM 정밀 분석 미완료'));
});
