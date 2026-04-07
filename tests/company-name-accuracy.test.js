const test = require('node:test');
const assert = require('node:assert/strict');

const { postProcessQualifiedLeads } = require('../lead-qualifier');

function createLead(company, title, salesPitch = `${company}에 제안합니다.`) {
  return {
    company,
    summary: title,
    salesPitch,
    sources: [{ title, url: 'https://example.com/article' }],
  };
}

test('root company hardening rejects or corrects representative low-trust company strings', () => {
  const correctedInterview = postProcessQualifiedLeads([
    createLead('[인터뷰]', '[인터뷰] 동양BMS, 스마트빌딩 사업 전략 공개', '[인터뷰]에 제안합니다.')
  ]);
  assert.equal(correctedInterview.length, 1);
  assert.equal(correctedInterview[0].company, '동양BMS');
  assert.doesNotMatch(correctedInterview[0].salesPitch, /\[인터뷰\]/u);

  for (const company of ['건물에너지', '김연재', '② K-조선', '선박까지', '부평 청천동']) {
    const rejected = postProcessQualifiedLeads([
      createLead(company, `${company} 관련 일반 산업 동향`)
    ]);
    assert.deepEqual(rejected, [], `${company} should be rejected`);
  }
});

test('root company hardening preserves clearly valid project owners', () => {
  const validLead = createLead('DL이앤씨', 'DL이앤씨, 데이터센터 냉각 인프라 증설');

  const processed = postProcessQualifiedLeads([validLead]);

  assert.equal(processed.length, 1);
  assert.equal(processed[0].company, 'DL이앤씨');
});
