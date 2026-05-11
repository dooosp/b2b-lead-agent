import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOpportunityWorkbenchModel,
  getOpportunityWorkbenchStyles,
  renderOpportunityWorkbench,
} from '../pages/opportunity-workbench.js';
import { getLeadDetailPage } from '../pages/lead-detail.js';

test('opportunity workbench renders review status, verification, evidence, data gaps, confidence, and next action', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-1',
    company: 'DL이앤씨',
    reviewStatus: 'NEEDS_REVIEW',
    verificationStatus: 'verified',
    generationMode: 'llm',
    signal: '데이터센터 냉각 설비 증설 착공',
    whyNow: '착공 직후 설비 기준선 확정 전 검토가 필요합니다.',
    recommendedMessage: '냉각 효율 검증 파일럿을 제안합니다.',
    confidence: 'MEDIUM',
    confidenceReason: '공개 기사 출처와 제목 근거가 확인되었습니다.',
    evidence: [
      { field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' },
    ],
    sources: [{ title: 'DL이앤씨 데이터센터 증설', url: 'https://example.com/dl' }],
    dataGaps: ['상세 발주 일정 미확인'],
    assumptions: ['현장 냉각 부하 데이터는 미확인입니다.'],
  });
  const html = renderOpportunityWorkbench(model);

  assert.equal(model.reviewStatus.label, '검토 필요');
  assert.equal(model.verificationStatus.label, '검증됨');
  assert.equal(model.confidence.label, '신뢰도 MEDIUM');
  assert.equal(model.evidence.count, 1);
  assert.equal(model.sources.count, 1);
  assert.equal(model.dataGaps.count, 1);
  assert.equal(model.nextAction.label, '근거 보강 후 재검토');
  assert.match(html, /id="opportunity-workbench"/);
  assert.match(html, /Opportunity Workbench/);
  assert.match(html, /검토 필요/);
  assert.match(html, /검증됨/);
  assert.match(html, /신뢰도 MEDIUM/);
  assert.match(html, /데이터 공백 1건/);
  assert.match(html, /상세 발주 일정 미확인/);
  assert.match(html, /다음 검토 액션/);
  assert.match(html, /근거 보강 후 재검토/);
});

test('opportunity workbench accepts legacy snake_case review payloads conservatively', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-legacy',
    company: 'LG전자',
    review_status: 'deferred',
    verification_status: 'needs_review',
    generation_mode: 'heuristic',
    summary: '스마트팩토리 증설 프로젝트',
    urgency_reason: '투자 발표 직후 설비 후보군 검토가 필요합니다.',
    sales_pitch: '자동화 제어 개선 검토를 제안합니다.',
    confidence: 'low',
    confidence_reason: '본문 직접 인용은 아직 없습니다.',
    data_gaps: ['직접 인용 없음', '발주 일정 미확인'],
    evidence: [],
    sources: [],
  });
  const html = renderOpportunityWorkbench(model);

  assert.equal(model.reviewStatus.value, 'DEFERRED');
  assert.equal(model.verificationStatus.value, 'needs_review');
  assert.equal(model.generationMode.value, 'heuristic');
  assert.equal(model.confidence.value, 'LOW');
  assert.equal(model.evidence.count, 0);
  assert.equal(model.sources.count, 0);
  assert.equal(model.nextAction.label, '데이터 보강 후 재검토');
  assert.match(html, /보류/);
  assert.match(html, /휴리스틱 생성/);
  assert.match(html, /직접 인용 없음/);
  assert.match(html, /출처 0개/);
  assert.match(html, /데이터 보강 후 재검토/);
});

test('opportunity workbench derives deterministic advisory checklist for weak review signals', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-weak-action',
    company: 'Weak Signal Co',
    reviewStatus: 'NEEDS_REVIEW',
    verificationStatus: 'needs_review',
    generationMode: 'heuristic',
    signal: '공장 자동화 투자 검토',
    whyNow: '투자 검토 초기 단계입니다.',
    recommendedMessage: '자동화 효율 진단을 제안합니다.',
    confidence: 'LOW',
    confidenceReason: '공개 출처와 직접 인용이 부족합니다.',
    evidence: [],
    sources: [],
    dataGaps: ['의사결정자 미확인', '예산 규모 미확인'],
  });
  const html = renderOpportunityWorkbench(model);

  assert.ok(model.nextAction.reasons.includes('신뢰도 LOW'));
  assert.ok(model.nextAction.reasons.includes('휴리스틱 생성'));
  assert.ok(model.nextAction.reasons.includes('검증 필요'));
  assert.ok(model.nextAction.reasons.some((reason) => reason.startsWith('데이터 공백 ')));
  assert.ok(model.nextAction.checklist.includes('직접 인용과 출처를 보강하세요.'));
  assert.ok(model.nextAction.checklist.includes('데이터 공백 확인: 의사결정자 미확인'));
  assert.match(html, /검토 체크리스트/);
  assert.match(html, /직접 인용과 출처를 보강하세요\./);
  assert.match(html, /데이터 공백 확인: 의사결정자 미확인/);
});

test('opportunity workbench gives approved verified leads an advisory outreach checklist', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-ready-action',
    company: 'Ready Co',
    reviewStatus: 'APPROVED',
    verificationStatus: 'verified',
    generationMode: 'llm',
    signal: '데이터센터 냉각 설비 발주 검토',
    whyNow: '설계 기준 확정 전 효율 검토가 필요합니다.',
    recommendedMessage: '냉각 효율 파일럿 미팅을 제안합니다.',
    confidence: 'HIGH',
    confidenceReason: '공개 기사와 직접 인용이 일치합니다.',
    evidence: [
      { field: 'summary', quote: '냉각 설비 발주 검토', sourceUrl: 'https://example.com/ready' },
    ],
    sources: [{ title: 'Ready Co project', url: 'https://example.com/ready' }],
    dataGaps: [],
  });
  const html = renderOpportunityWorkbench(model);

  assert.equal(model.nextAction.label, '영업 액션 준비');
  assert.deepEqual(model.nextAction.reasons, ['사람 검토 승인', '검증됨', '신뢰도 HIGH']);
  assert.ok(model.nextAction.checklist.includes('추천 메시지를 사람 검토 후 개인화하세요.'));
  assert.ok(model.nextAction.checklist.includes('후속 조치일과 담당 메모를 남기세요.'));
  assert.match(html, /추천 메시지를 사람 검토 후 개인화하세요\./);
  assert.match(html, /후속 조치일과 담당 메모를 남기세요\./);
});

test('opportunity workbench translates solution fit from current LeadBrief fields', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-solution-fit',
    company: 'Solution Fit Co',
    reviewStatus: 'APPROVED',
    verificationStatus: 'verified',
    generationMode: 'llm',
    signal: 'Chiller retrofit program entered vendor shortlist',
    whyNow: 'Shortlist closes this quarter.',
    recommendedMessage: 'Follow up with operations director about a compressor retrofit pilot.',
    product: 'Turbocor compressor',
    confidence: 'HIGH',
    evidence: [
      { field: 'summary', quote: 'vendor shortlist', sourceUrl: 'https://example.com/solution-fit' },
    ],
    sources: [{ title: 'Solution Fit source', url: 'https://example.com/solution-fit' }],
    dataGaps: [],
  });
  const html = renderOpportunityWorkbench(model);

  assert.equal(model.solutionTranslation.solution, 'Turbocor compressor');
  assert.equal(
    model.solutionTranslation.whyThisSolution,
    'Turbocor compressor is the candidate solution to review against Chiller retrofit program entered vendor shortlist.'
  );
  assert.equal(model.solutionTranslation.whyNow, 'Shortlist closes this quarter.');
  assert.equal(
    model.solutionTranslation.reviewCaveat,
    'Approved and verified context is ready for human-personalized outreach, not automatic sending.'
  );
  assert.match(html, /솔루션 번역/);
  assert.match(html, /왜 이 솔루션/);
  assert.match(html, /Turbocor compressor/);
  assert.match(html, /Shortlist closes this quarter\./);
  assert.match(html, /not automatic sending/);
});

test('opportunity workbench keeps solution translation conservative for weak evidence', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-weak-solution',
    company: 'Weak Solution Co',
    reviewStatus: 'NEEDS_REVIEW',
    verificationStatus: 'needs_review',
    generationMode: 'heuristic',
    signal: 'Expansion rumor needs confirmation',
    whyNow: '',
    recommendedMessage: '',
    confidence: 'LOW',
    evidence: [],
    sources: [],
    dataGaps: ['Buyer not confirmed'],
  });
  const html = renderOpportunityWorkbench(model);

  assert.equal(model.solutionTranslation.solution, '추천 솔루션 확인 필요');
  assert.equal(
    model.solutionTranslation.reviewCaveat,
    'Use only as an internal review note until evidence, data gaps, and human review state are resolved.'
  );
  assert.match(html, /추천 솔루션 확인 필요/);
  assert.match(html, /Use only as an internal review note/);
});

test('opportunity workbench fuses product context from current enrichment fields', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-product-context',
    company: 'Context Co',
    reviewStatus: 'APPROVED',
    verificationStatus: 'verified',
    generationMode: 'llm',
    signal: 'Chiller retrofit program entered vendor shortlist',
    whyNow: 'Shortlist closes this quarter.',
    recommendedMessage: 'Follow up with operations director about a compressor retrofit pilot.',
    product: 'Turbocor compressor',
    buyerRole: 'Operations Director',
    eventType: 'vendor_shortlist',
    buyingSignals: ['Vendor shortlist', 'Energy cost pressure'],
    painPoints: ['Cooling energy cost'],
    keyFigures: ['18-24% cooling energy reduction range'],
    confidence: 'HIGH',
    evidence: [
      { field: 'summary', quote: 'vendor shortlist', sourceUrl: 'https://example.com/context' },
    ],
    sources: [{ title: 'Context source', url: 'https://example.com/context' }],
    dataGaps: [],
  });
  const html = renderOpportunityWorkbench(model);

  assert.equal(model.productContext.product, 'Turbocor compressor');
  assert.equal(model.productContext.eventType, 'vendor_shortlist');
  assert.equal(model.productContext.buyerContext, 'Operations Director');
  assert.ok(model.productContext.fusionSignals.includes('Buying signal: Vendor shortlist'));
  assert.ok(model.productContext.fusionSignals.includes('Pain point: Cooling energy cost'));
  assert.ok(model.productContext.fusionSignals.includes('Key figure: 18-24% cooling energy reduction range'));
  assert.equal(
    model.productContext.reviewGuidance,
    'Use these fused signals to personalize the reviewed message; they are context for a human reviewer, not automatic approval.'
  );
  assert.match(html, /제품\/신호 맥락/);
  assert.match(html, /Operations Director/);
  assert.match(html, /Buying signal: Vendor shortlist/);
  assert.match(html, /Pain point: Cooling energy cost/);
});

test('opportunity workbench keeps product context conservative when signals are thin', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-thin-context',
    company: 'Thin Context Co',
    reviewStatus: 'NEEDS_REVIEW',
    verificationStatus: 'needs_review',
    generationMode: 'heuristic',
    signal: 'Expansion rumor needs confirmation',
    confidence: 'LOW',
    evidence: [],
    sources: [],
    dataGaps: ['Buyer not confirmed'],
  });
  const html = renderOpportunityWorkbench(model);

  assert.equal(model.productContext.product, '제품 맥락 확인 필요');
  assert.equal(model.productContext.eventType, '신호 유형 미확인');
  assert.equal(model.productContext.buyerContext, '구매자 맥락 확인 필요');
  assert.deepEqual(model.productContext.fusionSignals, ['Primary signal: Expansion rumor needs confirmation']);
  assert.equal(
    model.productContext.reviewGuidance,
    'Treat this context as tentative until product fit, buyer role, and evidence are confirmed.'
  );
  assert.match(html, /제품 맥락 확인 필요/);
  assert.match(html, /Treat this context as tentative/);
});

test('opportunity workbench turns missing evidence into explicit data-gap review items', () => {
  const model = buildOpportunityWorkbenchModel({
    id: 'lead-missing',
    company: 'No Evidence Co',
    reviewStatus: 'NEW',
    confidence: 'HIGH',
    signal: 'New plant expansion',
    recommendedMessage: 'Start with a narrow discovery note.',
    evidence: [],
    sources: [],
    dataGaps: [],
  });
  const html = renderOpportunityWorkbench(model);

  assert.equal(model.evidence.count, 0);
  assert.equal(model.sources.count, 0);
  assert.ok(model.dataGaps.items.includes('Published source evidence missing'));
  assert.ok(model.dataGaps.items.includes('Direct evidence quote missing'));
  assert.ok(model.dataGaps.items.includes('Why-now rationale missing'));
  assert.equal(model.nextAction.label, '근거 보강 후 재검토');
  assert.match(html, /직접 인용 없음/);
  assert.match(html, /Published source evidence missing/);
  assert.match(html, /Direct evidence quote missing/);
  assert.match(html, /Why-now rationale missing/);
});

test('opportunity workbench exposes a mobile single-column layout fallback', () => {
  const css = getOpportunityWorkbenchStyles();

  assert.match(css, /\.opportunity-workbench-grid/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.opportunity-workbench-grid \{ grid-template-columns:1fr; \}/);
  assert.match(css, /\.opportunity-workbench-evidence-list \{ max-height: none; \}/);
});

test('lead detail page embeds the opportunity workbench as the first review surface', () => {
  const html = getLeadDetailPage({
    id: 'lead-1',
    profileId: 'danfoss',
    status: 'NEW',
    reviewStatus: 'NEEDS_REVIEW',
    company: 'DL이앤씨',
    signal: '데이터센터 냉각 설비 증설 착공',
    whyNow: '착공 직후 설비 기준선 확정 전 검토가 필요합니다.',
    recommendedMessage: '냉각 효율 검증 파일럿을 제안합니다.',
    confidence: 'MEDIUM',
    evidence: [{ field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }],
    sources: [{ title: 'DL이앤씨 데이터센터 증설', url: 'https://example.com/dl' }],
    dataGaps: [],
    product: 'Turbocor 컴프레서',
    score: 84,
    grade: 'A',
  }, []);

  assert.match(html, /Opportunity Workbench/);
  assert.match(html, /opportunityWorkbenchHtml/);
  assert.match(html, /opportunity-workbench-grid/);
  assert.ok(html.indexOf('opportunityWorkbenchHtml') < html.indexOf('기본 정보'));
});
