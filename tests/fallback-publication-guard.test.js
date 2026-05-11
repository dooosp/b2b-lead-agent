const test = require('node:test');
const assert = require('node:assert/strict');

const { qualifyLeads } = require('../lead-qualifier');
const { prepareLeadSnapshotRecords } = require('../lead-report-publisher');
const { createRootArticle, createRootProfile } = require('./helpers/root-fixtures');

function withoutGeminiKey(fn) {
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (original === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = original;
      }
    });
}

test('root qualifier fails closed instead of returning demo leads when LLM config is missing', async () => {
  await withoutGeminiKey(async () => {
    await assert.rejects(
      () => qualifyLeads([createRootArticle()], createRootProfile()),
      /LLM|GEMINI_API_KEY|lead qualification/i
    );
  });
});

test('root qualifier fails closed instead of returning demo leads when LLM analysis fails', async () => {
  const failingLlm = {
    async chatJSON() {
      throw new Error('model unavailable');
    }
  };

  await assert.rejects(
    () => qualifyLeads([createRootArticle()], createRootProfile(), { llm: failingLlm }),
    /model unavailable|lead qualification/i
  );
});

test('LLM-qualified root leads carry explicit verified generation metadata', async () => {
  const llm = {
    async chatJSON() {
      return [
        {
          company: 'DL이앤씨',
          summary: '데이터센터 에너지 효율 투자 확대',
          product: 'E-Manager',
          score: 82,
          grade: 'A',
          roi: '근거 없음(추정 불가) - 공개 기사 기준 정량 데이터 부족',
          salesPitch: 'DL이앤씨 데이터센터의 에너지 기준선 정리를 제안합니다.',
          globalContext: '에너지 효율 규제 강화',
          sourceIds: ['A1'],
          sources: [{ title: 'wrong', url: 'https://invalid.example.com' }],
          evidence: [{ field: 'title', quote: '데이터센터 에너지 효율 투자 확대', sourceUrl: 'https://example.com/news/dl-energy' }],
          confidence: 'MEDIUM',
          confidenceReason: '본문과 제목 근거가 확인되었습니다.',
          assumptions: ['공개 기사 기준 초도 검토입니다.'],
          eventType: '투자'
        }
      ];
    }
  };

  const leads = await qualifyLeads([createRootArticle()], createRootProfile(), { llm });

  assert.equal(leads.length, 1);
  assert.equal(leads[0].generationMode, 'llm');
  assert.equal(leads[0].verificationStatus, 'verified');
  assert.equal(leads[0].confidence, 'MEDIUM');
  assert.deepEqual(leads[0].dataGaps, []);
});

test('publisher snapshot preparation refuses demo leads as canonical latest leads', () => {
  assert.throws(
    () => prepareLeadSnapshotRecords([
      {
        company: 'Demo Corp',
        summary: 'Demo opportunity',
        product: 'Demo Product',
        score: 80,
        grade: 'A',
        generationMode: 'demo',
        verificationStatus: 'draft',
        sources: [{ title: 'Demo source', url: 'https://example.com/demo' }]
      }
    ], {
      now: '2026-04-07T12:34:56.000Z',
      profileId: 'fixture-profile'
    }),
    /demo/i
  );
});
