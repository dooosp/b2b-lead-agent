import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRoleplayPrompt, buildRoleplayStakeholderContext } from '../api/roleplay.js';
import { getRoleplayPage } from '../pages/roleplay.js';

const reviewReadyLead = {
  company: 'Local Factory Automation',
  summary: 'Cooling automation modernization',
  product: 'Turbocor compressor',
  roi: '18-24% cooling energy reduction range',
  buyerRole: 'Operations Director',
  confidence: 'HIGH',
  verificationStatus: 'verified',
  keyFigures: ['Cooling energy cost down 18-24%'],
  painPoints: ['Unplanned shutdown window coordination'],
  buyingSignals: ['Vendor shortlist opened this quarter'],
  recommendedMessage: 'Follow up with operations director',
  evidence: [
    {
      field: 'project',
      quote: 'Local evidence quote',
      sourceUrl: 'https://example.com/local-proof',
    },
  ],
  dataGaps: [],
};

test('roleplay stakeholder context stays advisory and grounded in selected LeadBrief fields', () => {
  const context = buildRoleplayStakeholderContext(reviewReadyLead);

  assert.match(context, /이해관계자 연습 컨텍스트/);
  assert.match(context, /Primary stakeholder: Operations Director/);
  assert.match(context, /Value focus: Cooling energy cost down 18-24%/);
  assert.match(context, /Operating concern: Unplanned shutdown window coordination/);
  assert.match(context, /Evidence to practice: Local evidence quote/);
  assert.match(context, /Data gaps to ask about: No open data gaps/);
  assert.match(context, /does not approve outreach/);
  assert.match(context, /CRM ownership/);
});

test('roleplay prompt includes stakeholder context without turning gaps into claims', () => {
  const prompt = buildRoleplayPrompt({
    lead: {
      ...reviewReadyLead,
      confidence: 'LOW',
      verificationStatus: 'needs_review',
      dataGaps: ['Confirm budget owner', 'Confirm implementation timeline'],
    },
    history: [{ role: 'user', content: 'Can you share a reference?' }],
    userMessage: 'How should we discuss budget risk?',
  });

  assert.match(prompt, /영업사원: Can you share a reference\?/);
  assert.match(prompt, /Data gaps to ask about: Confirm budget owner \/ Confirm implementation timeline/);
  assert.match(prompt, /Use open gaps as practice questions, not as verified claims/);
  assert.match(prompt, /human review is required/);
  assert.match(prompt, /do not present this as outreach approval/);
});

test('roleplay page exposes stakeholder-practice boundary copy', () => {
  const html = getRoleplayPage();

  assert.match(html, /roleplay-boundary/);
  assert.match(html, /이해관계자 맥락은 연습 보조입니다/);
  assert.match(html, /아웃리치 승인/);
  assert.match(html, /CRM 배정/);
});
