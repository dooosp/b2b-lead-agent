function createRootProfile(overrides = {}) {
  return {
    id: 'fixture-profile',
    name: 'Fixture Corp',
    competitors: ['Comp A', 'Comp B'],
    products: {
      energy: ['E-Manager'],
      automation: ['A-Controller'],
    },
    productKnowledge: {
      'E-Manager': { value: '에너지 원단위 관리', roi: '절감률 기반 ROI 추정' },
      'A-Controller': { value: '설비 자동화', roi: '설비 운영 최적화 기반 ROI 추정' },
    },
    globalReferences: {
      energy: [
        { client: 'Global Plant', project: 'EMS rollout', result: '전력 사용량 12% 절감' },
      ],
      automation: [
        { client: 'Smart Factory', project: 'PLC modernization', result: '라인 가동률 8% 개선' },
      ],
    },
    categoryRules: {
      energy: ['에너지', '전력', '피크', '투자'],
      automation: ['자동화', '스마트팩토리', '설비'],
    },
    categoryConfig: {
      energy: {
        product: 'E-Manager',
        score: 78,
        grade: 'B',
        roi: '정량 데이터 부족 - 절감률 8~12% 예상',
        policy: '에너지 효율 규제 강화',
        pitch: '{company}에 {product} 도입을 제안합니다.',
      },
      automation: {
        product: 'A-Controller',
        score: 82,
        grade: 'A',
        roi: '정량 데이터 부족 - 절감률 6~10% 예상',
        policy: '스마트팩토리 투자 확대',
        pitch: '{company}에 {product} 도입을 제안합니다.',
      },
    },
    ...overrides,
  };
}

function createRootArticle(overrides = {}) {
  return {
    title: 'DL이앤씨, 데이터센터 에너지 효율 투자 확대',
    link: 'https://example.com/news/dl-energy',
    source: 'Example News',
    query: 'DL이앤씨 에너지 투자',
    pubDate: 'Tue, 07 Apr 2026 09:00:00 GMT',
    content: '검증 가능한 기사 본문입니다.',
    resolvedUrl: true,
    ...overrides,
  };
}

function createRootLead(overrides = {}) {
  return {
    company: 'LG전자',
    summary: '스마트팩토리 증설 프로젝트',
    product: 'A-Controller',
    score: 82,
    grade: 'A',
    roi: '정량 데이터 부족 - 절감률 6~10% 예상',
    salesPitch: 'LG전자 공장의 자동화 기준선 정립이 필요합니다.',
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
  };
}

function createWorkerApiEnv(overrides = {}) {
  return {
    API_TOKEN: 'api-secret',
    TRIGGER_PASSWORD: 'legacy-secret',
    GITHUB_REPO: 'dooosp/b2b-lead-agent',
    PROFILES: JSON.stringify([
      { id: 'danfoss', name: 'Danfoss' },
      { id: 'ls-electric', name: 'LS Electric' },
    ]),
    ...overrides,
  };
}

function createWorkerApiRequest(path, { headers = {}, method = 'GET', body } = {}) {
  return new Request(`https://b2b-lead-trigger.example.workers.dev${path}`, {
    method,
    headers,
    body,
  });
}

function jsonFixtureResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function createRootLeadRow(overrides = {}) {
  return {
    id: 'lead-db-1',
    identity_key: 'identity-1',
    profile_id: 'danfoss',
    source: 'managed',
    status: 'CONTACTED',
    review_status: 'NEEDS_REVIEW',
    company: 'Mutable DB Lead',
    summary: 'Mutable cache row',
    product: 'Turbocor 컴프레서',
    score: 20,
    grade: 'B',
    roi: 'Mutable ROI',
    sales_pitch: 'Mutable pitch',
    global_context: 'Mutable context',
    sources: JSON.stringify([{ title: 'DB Source', url: 'https://example.com/db-source' }]),
    notes: 'mutated',
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
    event_type: '',
    created_at: '2026-04-07T12:34:56.000Z',
    updated_at: '2026-04-08T12:34:56.000Z',
    ...overrides,
  };
}

module.exports = {
  createRootLeadRow,
  createRootArticle,
  createRootLead,
  createRootProfile,
  createWorkerApiEnv,
  createWorkerApiRequest,
  jsonFixtureResponse,
};
