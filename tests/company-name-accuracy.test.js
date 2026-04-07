const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { postProcessQualifiedLeads } = require('../lead-qualifier');

function loadFixture(...segments) {
  const filePath = path.join(__dirname, '..', ...segments);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findLead(leads, company) {
  const lead = leads.find(item => item.company === company);
  assert.ok(lead, `fixture lead not found for ${company}`);
  return lead;
}

test('root company hardening rejects or corrects known bad fixture companies', () => {
  const siemensLeads = loadFixture('reports', 'siemens', 'latest-leads.json');
  const danfossLeads = loadFixture('reports', 'danfoss', 'latest-leads.json');

  const correctedInterview = postProcessQualifiedLeads([findLead(siemensLeads, '[인터뷰]')]);
  assert.equal(correctedInterview.length, 1);
  assert.equal(correctedInterview[0].company, '동양BMS');
  assert.doesNotMatch(correctedInterview[0].salesPitch, /\[인터뷰\]/u);

  for (const company of ['건물에너지', '김연재', '② K-조선', '선박까지', '부평 청천동']) {
    const fixtureLead = company === '건물에너지' || company === '김연재'
      ? findLead(siemensLeads, company)
      : findLead(danfossLeads, company);
    assert.deepEqual(postProcessQualifiedLeads([fixtureLead]), [], `${company} should be rejected`);
  }
});

test('root company hardening preserves clearly valid project owners', () => {
  const danfossLeads = loadFixture('reports', 'danfoss', 'latest-leads.json');
  const validLead = findLead(danfossLeads, 'DL이앤씨');

  const processed = postProcessQualifiedLeads([validLead]);

  assert.equal(processed.length, 1);
  assert.equal(processed[0].company, 'DL이앤씨');
});
