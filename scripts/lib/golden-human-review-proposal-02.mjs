import {
  ClaimValidationError,
  assertSafeArtifact,
  canonicalStringify,
  sha256,
} from '../../knowledge/claim-registry/index.mjs';
import {
  GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_COUNT,
  GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_KEYS,
  validateGoldenHumanReviewBatch02,
} from './golden-human-review-batch-02.mjs';

export const GOLDEN_HUMAN_REVIEW_PROPOSAL_02_SCHEMA_VERSION =
  'pursuit-golden-human-review-proposal-02-v0';
export const GOLDEN_HUMAN_REVIEW_PROPOSAL_02_BOUNDARY =
  'AI_ASSISTED_PENDING_PROJECT_DECISIONS_NOT_HUMAN_ADJUDICATION';
export const GOLDEN_HUMAN_REVIEW_PROPOSAL_02_ARTIFACT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json';

const PROJECT_DECISIONS = Object.freeze({
  empyrion_kr1_gangnam: Object.freeze({
    stageRationale: 'The operator source reports the KR1 Gangnam grand opening, which supports an OPERATION-stage observation as of the reported opening date.',
    blockingEvidence: Object.freeze([
      'The grand-opening release establishes facility operation but provides no single-line diagram, equipment specification, tender, supplier qualification, or package-level procurement requirement.',
      'No expansion, retrofit, replacement, or other current lifecycle opportunity for the compared product families is identified.',
    ]),
    specificationWindow: Object.freeze({
      state: 'UNKNOWN',
      rationale: 'The initial-build window has passed, while the reviewed source does not establish any current lifecycle specification or procurement window.',
    }),
  }),
  kakao_data_center_ansan: Object.freeze({
    stageRationale: 'Kakao describes opening the Ansan data center, which supports an OPERATION-stage observation as of the reported opening date.',
    blockingEvidence: Object.freeze([
      'The opening release describes resilient infrastructure at a facility level but provides no applicable switchgear or transformer specification, single-line diagram, tender, supplier status, or package requirement.',
      'No current expansion, retrofit, replacement, or supplier-qualification opportunity is evidenced.',
    ]),
    specificationWindow: Object.freeze({
      state: 'UNKNOWN',
      rationale: 'Opening confirms that initial construction is complete, but the source does not establish a current lifecycle specification or procurement window.',
    }),
  }),
  lguplus_pyeongchon2: Object.freeze({
    stageRationale: 'LG U+ reports completion of the Pyeongchon 2 data center, which supports an OPERATION-stage observation as of the completion announcement.',
    blockingEvidence: Object.freeze([
      'The completion release does not provide an applicable equipment specification, single-line diagram, tender, supplier selection, or package status for either compared product family.',
      'No current expansion, retrofit, replacement, or other lifecycle procurement scope is identified.',
    ]),
    specificationWindow: Object.freeze({
      state: 'UNKNOWN',
      rationale: 'Completion indicates that the initial-build influence window has passed, while no later lifecycle window is evidenced.',
    }),
  }),
  nhn_gwangju_national_ai: Object.freeze({
    stageRationale: 'NHN reports service launch for the Gwangju National AI Data Center, which supports an OPERATION-stage observation as of that launch.',
    blockingEvidence: Object.freeze([
      'The service-launch source establishes operation but contains no applicable electrical specification, single-line diagram, tender, supplier status, or equipment-package requirement.',
      'No current expansion, retrofit, replacement, or qualification opportunity for the compared product families is evidenced.',
    ]),
    specificationWindow: Object.freeze({
      state: 'UNKNOWN',
      rationale: 'Service launch indicates the initial build is complete, but the reviewed source does not establish a current lifecycle influence window.',
    }),
  }),
  samsungsds_dongtan: Object.freeze({
    stageRationale: 'Samsung SDS presents the Dongtan facility as operating cloud infrastructure, which supports an OPERATION-stage observation as of the source date.',
    blockingEvidence: Object.freeze([
      'The media-day source describes an operating cloud facility but provides no applicable equipment specification, single-line diagram, tender, supplier selection, or procurement package.',
      'No current expansion, retrofit, replacement, or supplier-qualification window is identified.',
    ]),
    specificationWindow: Object.freeze({
      state: 'UNKNOWN',
      rationale: 'The source supports ongoing operation but does not identify a current lifecycle specification or procurement window.',
    }),
  }),
  ulsan_underwater_data_center_model: Object.freeze({
    stageRationale: 'The municipal source says the project begins with site analysis, basic design, ground analysis, and server-cooling design, supporting a DESIGN-stage observation.',
    blockingEvidence: Object.freeze([
      'The source describes a research standard model and future testbed, not an issued commercial data-center equipment specification or procurement package.',
      'No single-line diagram, site-specific electrical requirement, tender, award, supplier qualification, or switchgear or transformer package is available.',
      'Named research participation does not establish an equipment award or a product-family fit.',
    ]),
    specificationWindow: Object.freeze({
      state: 'UNKNOWN',
      rationale: 'Design research is beginning, but the reviewed evidence does not establish a commercial specification influence process or an open procurement window.',
    }),
  }),
  wanju_ai_data_center: Object.freeze({
    stageRationale: 'The municipal source records a build-and-operate memorandum, a fixed site, and a passed grid-impact assessment, but does not show that project design or construction began; this supports a FEASIBILITY-stage ceiling.',
    blockingEvidence: Object.freeze([
      'The memorandum and future capacity target do not establish completed design, construction commencement, an issued tender, or a package-level equipment requirement.',
      'The source provides no single-line diagram, technical specification, award status, supplier qualification, or procurement schedule for either compared product family.',
      'Participation in the memorandum does not by itself establish an equipment award or product-family fit.',
    ]),
    specificationWindow: Object.freeze({
      state: 'UNKNOWN',
      rationale: 'The early project phase may permit future influence, but no actual specification process or open procurement window is evidenced.',
    }),
  }),
});

const PROPOSAL_KEYS = Object.freeze([
  'documentStatus',
  'schemaVersion',
  'boundary',
  'productionReady',
  'goldenReady',
  'humanAdjudicationRecorded',
  'approvalStatus',
  'evaluationAsOf',
  'datasetCanonicalSha256',
  'priorMaterializedAdjudicationsCanonicalSha256',
  'reviewBatchCanonicalSha256',
  'summary',
  'projectProposals',
  'capabilityProposals',
  'pairProposals',
  'revisionProposals',
  'humanApproval',
  'nonClaims',
  'canonicalSha256',
]);

const PROPOSAL_NON_CLAIMS = Object.freeze([
  'Every decision in this artifact is AI-assisted review support and remains unapproved.',
  'No human review, authority, receipt, timestamp, attestation, or adjudication is recorded here.',
  'The seven proposals cover only projects that are unadjudicated in the pinned partially adjudicated dataset; prior adjudications are not reopened or changed.',
  'No project source is treated as an applied switchgear or transformer specification, and no facility-level statement is treated as product fit.',
  'An early project stage or research/design activity is not treated as proof of an open specification or procurement window.',
  'This artifact is not production evidence and does not authorize customer use, outreach, CRM mutation, or automated final decisions.',
]);

function fail(code, path) {
  throw new ClaimValidationError(code, path);
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function same(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function assertExactKeys(value, expected, path) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !same(Object.keys(value).sort(compareAscii), [...expected].sort(compareAscii))
  ) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_OBJECT_KEYS_MISMATCH', path);
  }
}

function projectProposal(item) {
  const decision = PROJECT_DECISIONS[item.candidate.projectKey];
  if (!decision) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_PROJECT_MISSING', `$.projectReviews.${item.candidate.projectKey}`);
  }
  return {
    projectKey: item.candidate.projectKey,
    projectId: item.candidate.projectId,
    name: item.candidate.name,
    location: item.candidate.location,
    stageObservationCandidate: item.candidate.stageObservationCandidate,
    stageRationale: decision.stageRationale,
    sourceDocuments: item.sourceDocuments.map((document) => ({
      documentKey: document.documentKey,
      title: document.title,
      sourceUrl: document.sourceUrl,
      documentKind: document.documentKind,
      excerpts: document.excerpts,
    })),
    candidateLimitations: item.candidate.limitations,
    suggestedAdjudication: {
      projectKey: item.candidate.projectKey,
      identityStatus: 'CONFIRMED',
      currentStage: item.candidate.stageObservationCandidate.stage,
      appliedSpecificationDocumentKeys: [],
      productFitByFamily: item.humanInputTemplate.productFitByFamily.map((fit) => ({
        productFamilyId: fit.productFamilyId,
        fitResult: 'INSUFFICIENT_EVIDENCE',
      })),
      blockingEvidence: [...decision.blockingEvidence],
      specificationWindow: { ...decision.specificationWindow },
      finalPursuitDecision: 'HOLD',
    },
  };
}

function assertBlankHumanApproval(approval) {
  assertExactKeys(approval, [
    'reviewer',
    'reviewReceipt',
    'reviewedAt',
    'disposition',
    'attestation',
    'changes',
  ], '$.goldenHumanReviewProposal02.humanApproval');
  for (const field of ['reviewer', 'reviewReceipt', 'reviewedAt', 'disposition', 'attestation']) {
    if (approval[field] !== null) {
      fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_HUMAN_APPROVAL_MUST_REMAIN_NULL', `$.goldenHumanReviewProposal02.humanApproval.${field}`);
    }
  }
  if (!Array.isArray(approval.changes) || approval.changes.length !== 0) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_HUMAN_APPROVAL_CHANGES_MUST_REMAIN_EMPTY', '$.goldenHumanReviewProposal02.humanApproval.changes');
  }
}

function composeProposal(reviewBatch, dataset) {
  validateGoldenHumanReviewBatch02(reviewBatch, dataset);
  const projectProposals = reviewBatch.projectReviews.map(projectProposal);
  const withoutHash = {
    documentStatus: 'PURSUIT_GOLDEN_HUMAN_REVIEW_PROPOSAL_02_DRAFT',
    schemaVersion: GOLDEN_HUMAN_REVIEW_PROPOSAL_02_SCHEMA_VERSION,
    boundary: GOLDEN_HUMAN_REVIEW_PROPOSAL_02_BOUNDARY,
    productionReady: false,
    goldenReady: false,
    humanAdjudicationRecorded: false,
    approvalStatus: 'AWAITING_EXPLICIT_HUMAN_APPROVAL',
    evaluationAsOf: reviewBatch.evaluationAsOf,
    datasetCanonicalSha256: reviewBatch.datasetCanonicalSha256,
    priorMaterializedAdjudicationsCanonicalSha256:
      reviewBatch.priorMaterializedAdjudicationsCanonicalSha256,
    reviewBatchCanonicalSha256: reviewBatch.canonicalSha256,
    summary: {
      projectProposalCount: projectProposals.length,
      capabilityProposalCount: 0,
      pairProposalCount: 0,
      revisionProposalCount: 0,
    },
    projectProposals,
    capabilityProposals: [],
    pairProposals: [],
    revisionProposals: [],
    humanApproval: {
      reviewer: null,
      reviewReceipt: null,
      reviewedAt: null,
      disposition: null,
      attestation: null,
      changes: [],
    },
    nonClaims: [...PROPOSAL_NON_CLAIMS],
  };
  return {
    ...withoutHash,
    canonicalSha256: sha256(canonicalStringify(withoutHash)),
  };
}

export function validateGoldenHumanReviewProposal02(proposal, reviewBatch, dataset) {
  assertSafeArtifact(proposal, '$.goldenHumanReviewProposal02');
  assertExactKeys(proposal, PROPOSAL_KEYS, '$.goldenHumanReviewProposal02');
  const { canonicalSha256, ...withoutHash } = proposal;
  if (
    proposal.documentStatus !== 'PURSUIT_GOLDEN_HUMAN_REVIEW_PROPOSAL_02_DRAFT'
    || proposal.schemaVersion !== GOLDEN_HUMAN_REVIEW_PROPOSAL_02_SCHEMA_VERSION
    || proposal.boundary !== GOLDEN_HUMAN_REVIEW_PROPOSAL_02_BOUNDARY
    || proposal.productionReady !== false
    || proposal.goldenReady !== false
    || proposal.humanAdjudicationRecorded !== false
    || proposal.approvalStatus !== 'AWAITING_EXPLICIT_HUMAN_APPROVAL'
    || !/^[a-f0-9]{64}$/.test(proposal.datasetCanonicalSha256 || '')
    || !/^[a-f0-9]{64}$/.test(proposal.priorMaterializedAdjudicationsCanonicalSha256 || '')
    || !/^[a-f0-9]{64}$/.test(proposal.reviewBatchCanonicalSha256 || '')
    || !Array.isArray(proposal.projectProposals)
    || proposal.projectProposals.length !== GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_COUNT
    || !Array.isArray(proposal.capabilityProposals)
    || proposal.capabilityProposals.length !== 0
    || !Array.isArray(proposal.pairProposals)
    || proposal.pairProposals.length !== 0
    || !Array.isArray(proposal.revisionProposals)
    || proposal.revisionProposals.length !== 0
    || !Array.isArray(proposal.nonClaims)
  ) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_INVALID', '$.goldenHumanReviewProposal02');
  }
  if (!same(proposal.nonClaims, PROPOSAL_NON_CLAIMS)) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_NON_CLAIMS_MISMATCH', '$.goldenHumanReviewProposal02.nonClaims');
  }
  if (!same(
    proposal.projectProposals.map((item) => item.projectKey),
    GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_KEYS,
  )) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_PROJECT_SET_MISMATCH', '$.goldenHumanReviewProposal02.projectProposals');
  }
  assertBlankHumanApproval(proposal.humanApproval);
  if (sha256(canonicalStringify(withoutHash)) !== canonicalSha256) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_HASH_MISMATCH', '$.goldenHumanReviewProposal02.canonicalSha256');
  }
  const expected = composeProposal(reviewBatch, dataset);
  if (!same(proposal, expected)) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_02_CONTENT_MISMATCH', '$.goldenHumanReviewProposal02');
  }
  return proposal;
}

export function buildGoldenHumanReviewProposal02(reviewBatch, dataset) {
  const proposal = deepFreeze(composeProposal(reviewBatch, dataset));
  validateGoldenHumanReviewProposal02(proposal, reviewBatch, dataset);
  return proposal;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function sourceLinks(documents) {
  return documents.map((document) => (
    `[${escapeCell(document.documentKey)}](${document.sourceUrl})`
  )).join('<br>');
}

export function renderGoldenHumanReviewProposal02Markdown(proposal, reviewBatch, dataset) {
  validateGoldenHumanReviewProposal02(proposal, reviewBatch, dataset);
  const lines = [
    '# Golden Dataset 인간 판정 2차 배치 — 승인 전 제안서',
    '',
    '> 이 문서는 AI가 작성한 검토 초안입니다. 사람 판정, 승인, 검토 영수증 또는 Golden readiness를 주장하지 않습니다.',
    '',
    `- 경계: \`${proposal.boundary}\``,
    `- 증거 기준 시각: \`${proposal.evaluationAsOf}\``,
    `- dataset hash: \`${proposal.datasetCanonicalSha256}\``,
    `- prior adjudications hash: \`${proposal.priorMaterializedAdjudicationsCanonicalSha256}\``,
    `- blank batch hash: \`${proposal.reviewBatchCanonicalSha256}\``,
    `- proposal hash: \`${proposal.canonicalSha256}\``,
    `- 신규 검토 범위: 프로젝트 ${proposal.summary.projectProposalCount}, capability ${proposal.summary.capabilityProposalCount}, pair ${proposal.summary.pairProposalCount}, revision ${proposal.summary.revisionProposalCount}`,
    '- 이전 판정 범위: 프로젝트 10, capability 30, pair 10, revision 1 — 이 제안서는 이전 판정을 다시 열거나 수정하지 않습니다.',
    '',
    '## 프로젝트 제안 7건',
    '',
    '| 프로젝트 | 후보 단계 | 적용 사양 | MV / Transformer | 영향 구간 | 최종 제안 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const item of proposal.projectProposals) {
    const decision = item.suggestedAdjudication;
    lines.push(`| \`${item.projectKey}\`<br>${escapeCell(item.name)} | ${decision.currentStage} | 없음 | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | ${decision.specificationWindow.state} | ${decision.finalPursuitDecision} |`);
  }
  for (const item of proposal.projectProposals) {
    const decision = item.suggestedAdjudication;
    lines.push(
      '',
      `### ${item.name} (\`${item.projectKey}\`)`,
      '',
      `- 공식 출처 후보: ${sourceLinks(item.sourceDocuments)}`,
      `- 단계 제안 근거: ${item.stageRationale}`,
      '- 적용 사양 제안: 없음 (`[]`)',
      '- 제품 적합성 제안: `medium_voltage_switchgear=INSUFFICIENT_EVIDENCE`, `transformer=INSUFFICIENT_EVIDENCE`',
      `- 영향 구간 제안: \`${decision.specificationWindow.state}\` — ${decision.specificationWindow.rationale}`,
      `- 최종 제안: \`${decision.finalPursuitDecision}\``,
      '- blocker:',
      ...decision.blockingEvidence.map((blocker) => `  - ${blocker}`),
      '- 후보 데이터 자체의 한계:',
      ...item.candidateLimitations.map((limitation) => `  - ${limitation}`),
    );
  }
  lines.push(
    '',
    '## 명시적 비주장',
    '',
    ...proposal.nonClaims.map((nonClaim) => `- ${nonClaim}`),
    '',
    '## 사용자가 승인하는 방법',
    '',
    '위의 링크, 단계 근거, blocker와 한계를 직접 확인한 뒤 아래 블록을 복사해 이 Codex 작업에 보내십시오. `reviewer`만 실제 검토자 이름 또는 이니셜로 바꾸십시오. 고유 영수증과 검토 시각은 명시적 승인 뒤 guarded materialization이 최초 승인 후 시스템 기록으로 결합합니다.',
    '',
    '```text',
    'GOLDEN_BATCH_02_APPROVAL',
    `datasetCanonicalSha256: ${proposal.datasetCanonicalSha256}`,
    `priorMaterializedAdjudicationsCanonicalSha256: ${proposal.priorMaterializedAdjudicationsCanonicalSha256}`,
    `reviewBatchCanonicalSha256: ${proposal.reviewBatchCanonicalSha256}`,
    `proposalCanonicalSha256: ${proposal.canonicalSha256}`,
    'reviewer: <실제 이름 또는 이니셜>',
    'scope: PROJECTS_7_CAPABILITIES_0_PAIRS_0_REVISIONS_0',
    'disposition: APPROVE_AS_WRITTEN',
    'attestation: 나는 연결된 출처, 근거, 한계를 직접 검토했고 이 제안들을 내 도메인 판단으로 채택합니다.',
    'changes: NONE',
    '```',
    '',
    '수정이 필요하면 승인하지 말고 프로젝트 key와 수정할 필드를 먼저 명시하십시오. 이 승인 블록이 실제로 제출되고 해시·범위·결정이 검증되어 materialize되기 전까지 Batch 02 사람 판정은 존재하지 않습니다.',
    '',
    '## 승인 뒤에도 적용되는 경계',
    '',
    '- 승인 메시지만으로 파일이 바뀌거나 Golden readiness가 성립하지 않습니다. 별도의 guarded materialization과 전체 감사 통과가 필요합니다.',
    '- 이 데이터는 비생산 검증 자료이며 고객 사용, 생산 접근, CRM 변경, 아웃리치 또는 자동 최종 결정을 승인하지 않습니다.',
  );
  return `${lines.join('\n')}\n`;
}

export const GOLDEN_HUMAN_REVIEW_PROPOSAL_02_PROJECT_DECISIONS =
  PROJECT_DECISIONS;
