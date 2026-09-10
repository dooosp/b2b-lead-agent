import {
  ClaimValidationError,
  assertSafeArtifact,
  canonicalStringify,
  sha256,
} from '../../knowledge/claim-registry/index.mjs';
import {
  GOLDEN_HUMAN_REVIEW_BATCH_PROJECT_COUNT,
  validateGoldenHumanReviewBatch,
} from './golden-human-review-batch.mjs';

export const GOLDEN_HUMAN_REVIEW_PROPOSAL_SCHEMA_VERSION =
  'pursuit-golden-human-review-proposal-v0';
export const GOLDEN_HUMAN_REVIEW_PROPOSAL_BOUNDARY =
  'AI_ASSISTED_PROPOSED_DECISIONS_NOT_HUMAN_ADJUDICATION';

const PROJECT_DECISIONS = Object.freeze({
  stt_seoul1: {
    appliedSpecificationDocumentKeys: ['project_stt_seoul1_facility_spec_2026'],
    blockingEvidence: [
      'The public facility factsheet states dual 22.9kV utility service but does not provide the single-line diagram, transformation boundary, equipment package, or procurement requirements.',
      'The facility is operating and no current retrofit, replacement, tender, supplier-qualification, or procurement window is identified.',
    ],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'Initial construction is complete, but the sources do not establish whether any retrofit or replacement specification window exists.',
    },
    finalPursuitDecision: 'HOLD',
  },
  digitaledge_sel2: {
    appliedSpecificationDocumentKeys: ['project_digitaledge_sel2_facility_spec_2024_11'],
    blockingEvidence: [
      'The public facility specification gives a 2x154kV utility interface but not an equipment-level requirement for the compared MV switchgear or distribution transformer families.',
      'The single-line diagram, transformation boundary, equipment package, tender status, and replacement opportunity are unavailable.',
    ],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'The facility is operating; initial-build influence is over, while any retrofit or replacement window is not evidenced.',
    },
    finalPursuitDecision: 'HOLD',
  },
  skaws_ulsan_aidc: {
    appliedSpecificationDocumentKeys: [],
    blockingEvidence: [
      'SK Telecom publicly identifies Schneider Electric as the integrated MEP supplier for switchgear, UPS, transformers, automation, and related initial-build scope.',
      'No applicable tender, technical specification, single-line diagram, or alternate package opportunity is present in the review set.',
      'This recommendation is limited to the reviewed initial-build package and does not decide future expansion, retrofit, or replacement scope.',
    ],
    specificationWindow: {
      state: 'CLOSED',
      rationale: 'For the reviewed initial-build switchgear and transformer scope, an integrated MEP supplier has already been contracted.',
    },
    finalPursuitDecision: 'NO_BID',
  },
  lguplus_paju_aidc: {
    appliedSpecificationDocumentKeys: [],
    blockingEvidence: [
      'The sources confirm construction and a 2027 target but provide no tender, single-line diagram, equipment specification, supplier selection, or package status.',
    ],
    specificationWindow: {
      state: 'CLOSING',
      rationale: 'Construction is underway, so design influence is likely narrowing, but no public procurement evidence proves that the window is fully closed.',
    },
    finalPursuitDecision: 'HOLD',
  },
  digitaledge_sel5: {
    appliedSpecificationDocumentKeys: [],
    blockingEvidence: [
      'The source confirms secured power for a planned 60MW facility but provides no design basis, tender, equipment specification, construction status, supplier list, or procurement schedule.',
    ],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'The announced stage suggests possible future influence, but an open specification or procurement window is not actually evidenced.',
    },
    finalPursuitDecision: 'HOLD',
  },
  equinix_sl2x: {
    appliedSpecificationDocumentKeys: ['project_equinix_sl2x_specs'],
    blockingEvidence: [
      'The public technical-specification page identifies the facility but the captured evidence contains no equipment-level MV switchgear or transformer requirement.',
      'No current tender, replacement scope, supplier qualification, or procurement window is evidenced.',
    ],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: "The operating facility's initial-build window has passed, while possible lifecycle work is not described by the sources.",
    },
    finalPursuitDecision: 'HOLD',
  },
  naver_gak_chuncheon: {
    appliedSpecificationDocumentKeys: [],
    blockingEvidence: [
      'The operating-facility page describes aggregate power and UPS/STS architecture but is not an applicable equipment procurement specification.',
      'No expansion, replacement, tender, equipment specification, or current supplier opportunity is identified.',
    ],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'The original facility is operational, but the review set does not establish whether a lifecycle replacement window exists.',
    },
    finalPursuitDecision: 'HOLD',
  },
  naver_gak_sejong: {
    appliedSpecificationDocumentKeys: [],
    blockingEvidence: [
      'The existing operating facility and the 2026 expansion/AI Factory scope are not separated into equipment packages or project specifications.',
      'The expansion sources provide capacity milestones but no tender, single-line diagram, equipment requirements, supplier selection, or procurement status.',
    ],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'Expansion execution is announced, but the available evidence does not establish whether switchgear or transformer specifications remain influenceable.',
    },
    finalPursuitDecision: 'HOLD',
  },
  digitalrealty_icn10: {
    appliedSpecificationDocumentKeys: [],
    blockingEvidence: [
      'The sources confirm facility and colocation availability but provide no applicable electrical specification, tender, equipment package, supplier status, or lifecycle opportunity.',
    ],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'The facility is operating; no evidence establishes a current expansion, retrofit, or replacement specification window.',
    },
    finalPursuitDecision: 'HOLD',
  },
  ktcloud_gasan_aidc: {
    appliedSpecificationDocumentKeys: [],
    blockingEvidence: [
      'The sources confirm opening and business context but provide no single-line diagram, equipment specification, tender, supplier status, or replacement opportunity.',
    ],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'The facility is operating and no current lifecycle procurement window is evidenced.',
    },
    finalPursuitDecision: 'HOLD',
  },
});

const CAPABILITY_DECISIONS = Object.freeze({
  mv_abb_001_rated_voltage: ['SUPPORTED_CONDITIONAL', ['OFFICIAL_SOURCE_SUPPORT', 'UNDATED_LIVE_PAGE', 'PROJECT_APPLICABILITY_UNVERIFIED']],
  mv_abb_002_main_busbar_current: ['SUPPORTED_CONDITIONAL', ['OFFICIAL_SOURCE_SUPPORT', 'UNDATED_LIVE_PAGE', 'SIMULTANEOUS_CONFIGURATION_UNVERIFIED']],
  mv_abb_003_short_time_current: ['INSUFFICIENT_EVIDENCE', ['DURATION_MISSING', 'UNDATED_LIVE_PAGE']],
  mv_hh_001_standard: ['SUPPORTED_CONDITIONAL', ['OFFICIAL_SOURCE_SUPPORT', 'UNDATED_LIVE_PAGE', 'DOCUMENT_CONTROL_UNVERIFIED']],
  mv_hh_002_rated_voltage: ['SUPPORTED_CONDITIONAL', ['OFFICIAL_SOURCE_SUPPORT', 'UNDATED_LIVE_PAGE', 'PROJECT_CONFIGURATION_UNVERIFIED']],
  mv_hh_003_rated_current: ['SUPPORTED_CONDITIONAL', ['OFFICIAL_SOURCE_SUPPORT', 'UNDATED_LIVE_PAGE', 'PROJECT_CONFIGURATION_UNVERIFIED']],
  mv_hh_004_vendor_breaking_capacity: ['INSUFFICIENT_EVIDENCE', ['VENDOR_TERM_MAPPING_UNRESOLVED']],
  mv_si_001_rated_voltage: ['SUPPORTED', ['DATED_OFFICIAL_CATALOG', 'PUBLISHED_CONFIGURATION_SCOPE']],
  mv_si_002_rated_frequency: ['SUPPORTED', ['DATED_OFFICIAL_CATALOG', 'PUBLISHED_CONFIGURATION_SCOPE']],
  mv_si_003_busbar_continuous_current: ['SUPPORTED_CONDITIONAL', ['CONDITION_BOUND_RATING', 'SIMULTANEOUS_CONFIGURATION_UNVERIFIED']],
  mv_si_004_feeder_continuous_current: ['SUPPORTED_CONDITIONAL', ['CONDITION_BOUND_RATING', 'SIMULTANEOUS_CONFIGURATION_UNVERIFIED']],
  mv_si_005_short_time_withstand_current: ['SUPPORTED_CONDITIONAL', ['DURATION_BOUND_RATING', 'PROJECT_CONFIGURATION_UNVERIFIED']],
  mv_si_006_ambient_temperature: ['SUPPORTED', ['DATED_OFFICIAL_CATALOG', 'PUBLISHED_RANGE_SUPPORT']],
  mv_si_007_primary_circuit_ip: ['SUPPORTED', ['DATED_OFFICIAL_CATALOG', 'ENCLOSURE_SCOPE_BOUND']],
  mv_si_008_internal_arc_classification: ['SUPPORTED_CONDITIONAL', ['CONFIGURATION_SPECIFIC_CLASSIFICATION', 'DURATION_BOUND_RATING']],
  mv_si_009_power_frequency_withstand_voltage: ['SUPPORTED_CONDITIONAL', ['PATH_SPECIFIC_RATING', 'RATED_VOLTAGE_24KV_SCOPE']],
  mv_si_010_lightning_impulse_withstand_voltage: ['SUPPORTED_CONDITIONAL', ['PATH_SPECIFIC_RATING', 'RATED_VOLTAGE_24KV_SCOPE']],
  mv_si_011_rated_peak_withstand_current: ['SUPPORTED_CONDITIONAL', ['ALTERNATIVE_VALUES_NOT_SIMULTANEOUS', 'FREQUENCY_CONDITION_BOUND']],
  tr_he_001_high_voltage: ['SUPPORTED_CONDITIONAL', ['UNDATED_LIVE_PAGE', 'FAMILY_MAXIMUM_SCOPE', 'MODEL_UNRESOLVED']],
  tr_he_002_partial_discharge: ['INSUFFICIENT_EVIDENCE', ['MODEL_TEST_CONDITIONS_MISSING']],
  tr_hh_001_rated_power_range: ['SUPPORTED_CONDITIONAL', ['UNDATED_LIVE_PAGE', 'FAMILY_RANGE_SCOPE']],
  tr_hh_002_rated_voltage_range: ['SUPPORTED_CONDITIONAL', ['UNDATED_LIVE_PAGE', 'WINDING_SIDE_UNRESOLVED', 'FAMILY_RANGE_SCOPE']],
  tr_si_001_rated_power: ['SUPPORTED_CONDITIONAL', ['HISTORICAL_EXAMPLE_CONFIGURATION', 'CURRENT_OFFER_UNVERIFIED']],
  tr_si_002_primary_voltage: ['SUPPORTED_CONDITIONAL', ['HISTORICAL_EXAMPLE_CONFIGURATION', 'CURRENT_OFFER_UNVERIFIED', 'PROJECT_VOLTAGE_UNVERIFIED']],
  tr_si_003_secondary_no_load_voltage: ['SUPPORTED_CONDITIONAL', ['HISTORICAL_EXAMPLE_CONFIGURATION', 'CURRENT_OFFER_UNVERIFIED']],
  tr_si_004_impedance_voltage: ['SUPPORTED_CONDITIONAL', ['HISTORICAL_EXAMPLE_CONFIGURATION', 'CURRENT_OFFER_UNVERIFIED']],
  tr_si_005_no_load_loss: ['SUPPORTED_CONDITIONAL', ['HISTORICAL_EXAMPLE_CONFIGURATION', 'CONFIGURATION_SPECIFIC_LOSS', 'CURRENT_OFFER_UNVERIFIED']],
  tr_si_006_load_loss_120c: ['SUPPORTED_CONDITIONAL', ['HISTORICAL_EXAMPLE_CONFIGURATION', 'CONFIGURATION_SPECIFIC_LOSS', 'REFERENCE_TEMPERATURE_BOUND']],
  tr_si_007_climatic_class: ['SUPPORTED_CONDITIONAL', ['FAMILY_SCOPE_ONLY', 'OTHER_CLASSES_ON_REQUEST', 'PROJECT_ENVIRONMENT_UNVERIFIED']],
  tr_si_008_fire_classification: ['SUPPORTED_CONDITIONAL', ['FAMILY_SCOPE_ONLY', 'CURRENT_OFFER_UNVERIFIED', 'PROJECT_APPLICABILITY_UNVERIFIED']],
});

const PROPOSAL_NON_CLAIMS = Object.freeze([
  'Every decision in this artifact is AI-assisted review support and remains unapproved.',
  'No human review, authority, receipt, timestamp, attestation, or adjudication is recorded here.',
  'Ulsan NO_BID and CLOSED apply only to the reviewed initial-build switchgear and transformer package, not future lifecycle work.',
  'Facility utility voltage is not treated as an equipment procurement requirement or a product match.',
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
    fail('PROPOSAL_OBJECT_KEYS_MISMATCH', path);
  }
}

function projectProposal(item) {
  const decision = PROJECT_DECISIONS[item.candidate.projectKey];
  if (!decision) fail('PROJECT_PROPOSAL_MISSING', `$.projectReviews.${item.candidate.projectKey}`);
  const eligible = new Set(item.candidate.eligibleAppliedSpecificationDocumentKeys);
  if (decision.appliedSpecificationDocumentKeys.some((key) => !eligible.has(key))) {
    fail('PROPOSED_APPLIED_SPECIFICATION_INELIGIBLE', `$.projectReviews.${item.candidate.projectKey}`);
  }
  return {
    projectKey: item.candidate.projectKey,
    projectId: item.candidate.projectId,
    name: item.candidate.name,
    location: item.candidate.location,
    sourceDocuments: item.sourceDocuments.map((document) => ({
      documentKey: document.documentKey,
      title: document.title,
      sourceUrl: document.sourceUrl,
      documentKind: document.documentKind,
      excerpts: document.excerpts,
    })),
    suggestedAdjudication: {
      projectKey: item.candidate.projectKey,
      identityStatus: 'CONFIRMED',
      currentStage: item.candidate.stageObservationCandidate.stage,
      appliedSpecificationDocumentKeys: [...decision.appliedSpecificationDocumentKeys],
      productFitByFamily: item.humanInputTemplate.productFitByFamily.map((fit) => ({
        productFamilyId: fit.productFamilyId,
        fitResult: 'INSUFFICIENT_EVIDENCE',
      })),
      blockingEvidence: [...decision.blockingEvidence],
      specificationWindow: { ...decision.specificationWindow },
      finalPursuitDecision: decision.finalPursuitDecision,
    },
  };
}

function capabilityProposal(item) {
  const decision = CAPABILITY_DECISIONS[item.candidate.claimKey];
  if (!decision) fail('CAPABILITY_PROPOSAL_MISSING', `$.capabilityReviews.${item.candidate.claimKey}`);
  const [label, reasonCodes] = decision;
  return {
    claimKey: item.candidate.claimKey,
    capabilityClaimId: item.candidate.capabilityClaimId,
    productFamilyId: item.candidate.productFamilyId,
    field: item.candidate.field,
    operator: item.candidate.operator,
    value: item.candidate.value,
    unit: item.candidate.unit,
    conditions: item.candidate.conditions,
    evidenceDocument: {
      documentKey: item.evidenceDocument.documentKey,
      title: item.evidenceDocument.title,
      sourceUrl: item.evidenceDocument.sourceUrl,
    },
    suggestedAdjudication: {
      claimKey: item.candidate.claimKey,
      label,
      reasonCodes: [...reasonCodes],
      sourceSpans: [...item.humanInputTemplate.sourceSpans],
    },
  };
}

function pairProposal(item) {
  const isSel2 = item.candidate.projectKey === 'digitaledge_sel2';
  const isTransformer = item.candidate.productFamilyId === 'transformer';
  return {
    pairKey: item.candidate.pairKey,
    pairId: item.candidate.pairId,
    projectKey: item.candidate.projectKey,
    capabilityClaimKey: item.candidate.capabilityClaimKey,
    productFamilyId: item.candidate.productFamilyId,
    requirementEvidence: item.candidate.requirementEvidence,
    capabilityCandidate: item.candidate.capabilityCandidate,
    evidenceDocuments: item.evidenceDocuments,
    suggestedAdjudication: {
      pairKey: item.candidate.pairKey,
      label: isSel2 ? 'NOT_APPLICABLE' : 'INSUFFICIENT_EVIDENCE',
      reasonCodes: [
        'FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT',
        isSel2 || isTransformer
          ? 'TRANSFORMATION_BOUNDARY_MISSING'
          : 'EQUIPMENT_PACKAGE_MISSING',
        'SINGLE_LINE_DIAGRAM_MISSING',
      ],
      sourceSpans: [...item.humanInputTemplate.sourceSpans],
    },
  };
}

function revisionProposal(item) {
  return {
    documentKey: item.candidate.documentKey,
    supersedesDocumentKey: item.candidate.supersedesDocumentKey,
    evidenceDocuments: item.evidenceDocuments,
    suggestedAdjudication: {
      documentKey: item.candidate.documentKey,
      supersedesDocumentKey: item.candidate.supersedesDocumentKey,
      relationshipStatus: 'CONFIRMED_SUPERSESSION',
      reasonCodes: [
        'IEC_EXPLICIT_CANCELLATION_AND_REPLACEMENT',
        'SAME_STANDARD_SERIES_LATER_EDITION',
      ],
      sourceSpans: [...item.humanInputTemplate.sourceSpans],
    },
  };
}

function assertBlankHumanApproval(approval) {
  assertExactKeys(
    approval,
    ['reviewer', 'reviewReceipt', 'reviewedAt', 'disposition', 'attestation', 'changes'],
    '$.goldenHumanReviewProposal.humanApproval',
  );
  for (const field of ['reviewer', 'reviewReceipt', 'reviewedAt', 'disposition', 'attestation']) {
    if (approval[field] !== null) {
      fail('HUMAN_APPROVAL_MUST_REMAIN_NULL', `$.goldenHumanReviewProposal.humanApproval.${field}`);
    }
  }
  if (!Array.isArray(approval.changes) || approval.changes.length !== 0) {
    fail('HUMAN_APPROVAL_CHANGES_MUST_REMAIN_EMPTY', '$.goldenHumanReviewProposal.humanApproval.changes');
  }
}

function assertProposalMatchesBatch(proposal, batch) {
  validateGoldenHumanReviewBatch(batch);
  if (
    proposal.datasetCanonicalSha256 !== batch.datasetCanonicalSha256
    || proposal.reviewBatchCanonicalSha256 !== batch.canonicalSha256
    || proposal.evaluationAsOf !== batch.evaluationAsOf
  ) {
    fail('PROPOSAL_BATCH_PIN_MISMATCH', '$.goldenHumanReviewProposal');
  }
  const groups = [
    ['projectProposals', 'projectReviews', 'projectKey', 'projectKey'],
    ['capabilityProposals', 'capabilityReviews', 'claimKey', 'claimKey'],
    ['pairProposals', 'pairReviews', 'pairKey', 'pairKey'],
    ['revisionProposals', 'revisionReviews', 'documentKey', 'documentKey'],
  ];
  for (const [proposalField, batchField, proposalKey, candidateKey] of groups) {
    const actualKeys = proposal[proposalField].map((item) => item[proposalKey]);
    const expectedKeys = batch[batchField].map((item) => item.candidate[candidateKey]);
    if (!same(actualKeys, expectedKeys)) {
      fail('PROPOSAL_REVIEW_KEY_MISMATCH', `$.goldenHumanReviewProposal.${proposalField}`);
    }
  }
  const exactProjections = [
    ['projectProposals', 'projectReviews', projectProposal, 'PROJECT_PROPOSAL_CONTENT_MISMATCH'],
    ['capabilityProposals', 'capabilityReviews', capabilityProposal, 'CAPABILITY_PROPOSAL_CONTENT_MISMATCH'],
    ['pairProposals', 'pairReviews', pairProposal, 'PAIR_PROPOSAL_CONTENT_MISMATCH'],
    ['revisionProposals', 'revisionReviews', revisionProposal, 'REVISION_PROPOSAL_CONTENT_MISMATCH'],
  ];
  for (const [proposalField, batchField, projector, code] of exactProjections) {
    proposal[proposalField].forEach((item, index) => {
      if (!same(item, projector(batch[batchField][index]))) {
        fail(code, `$.goldenHumanReviewProposal.${proposalField}[${index}]`);
      }
    });
  }
}

export function validateGoldenHumanReviewProposal(proposal, reviewBatch) {
  assertSafeArtifact(proposal, '$.goldenHumanReviewProposal');
  assertExactKeys(proposal, [
    'documentStatus',
    'schemaVersion',
    'boundary',
    'productionReady',
    'goldenReady',
    'humanAdjudicationRecorded',
    'approvalStatus',
    'evaluationAsOf',
    'datasetCanonicalSha256',
    'reviewBatchCanonicalSha256',
    'summary',
    'projectProposals',
    'capabilityProposals',
    'pairProposals',
    'revisionProposals',
    'humanApproval',
    'nonClaims',
    'canonicalSha256',
  ], '$.goldenHumanReviewProposal');
  const { canonicalSha256, ...withoutHash } = proposal || {};
  if (
    proposal?.documentStatus !== 'PURSUIT_GOLDEN_HUMAN_REVIEW_PROPOSAL_DRAFT'
    || proposal?.schemaVersion !== GOLDEN_HUMAN_REVIEW_PROPOSAL_SCHEMA_VERSION
    || proposal?.boundary !== GOLDEN_HUMAN_REVIEW_PROPOSAL_BOUNDARY
    || proposal?.productionReady !== false
    || proposal?.goldenReady !== false
    || proposal?.humanAdjudicationRecorded !== false
    || proposal?.approvalStatus !== 'AWAITING_EXPLICIT_HUMAN_APPROVAL'
    || !Array.isArray(proposal?.projectProposals)
    || proposal.projectProposals.length !== GOLDEN_HUMAN_REVIEW_BATCH_PROJECT_COUNT
    || !Array.isArray(proposal?.capabilityProposals)
    || !Array.isArray(proposal?.pairProposals)
    || !Array.isArray(proposal?.revisionProposals)
    || !Array.isArray(proposal?.nonClaims)
  ) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_INVALID', '$.goldenHumanReviewProposal');
  }
  if (canonicalStringify(proposal).includes('HUMAN_DOMAIN_REVIEW')) {
    fail('HUMAN_AUTHORITY_ASSERTION_REFUSED_IN_PROPOSAL', '$.goldenHumanReviewProposal');
  }
  const expectedSummary = {
    projectProposalCount: proposal.projectProposals.length,
    capabilityProposalCount: proposal.capabilityProposals.length,
    pairProposalCount: proposal.pairProposals.length,
    revisionProposalCount: proposal.revisionProposals.length,
  };
  if (!same(proposal.summary, expectedSummary)) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_COUNT_MISMATCH', '$.goldenHumanReviewProposal.summary');
  }
  if (!same(proposal.nonClaims, PROPOSAL_NON_CLAIMS)) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_NON_CLAIMS_MISMATCH', '$.goldenHumanReviewProposal.nonClaims');
  }
  assertBlankHumanApproval(proposal.humanApproval);
  assertProposalMatchesBatch(proposal, reviewBatch);
  if (sha256(canonicalStringify(withoutHash)) !== canonicalSha256) {
    fail('GOLDEN_HUMAN_REVIEW_PROPOSAL_HASH_MISMATCH', '$.goldenHumanReviewProposal.canonicalSha256');
  }
  return proposal;
}

export function buildGoldenHumanReviewProposal(reviewBatch) {
  validateGoldenHumanReviewBatch(reviewBatch);
  const proposalWithoutHash = {
    documentStatus: 'PURSUIT_GOLDEN_HUMAN_REVIEW_PROPOSAL_DRAFT',
    schemaVersion: GOLDEN_HUMAN_REVIEW_PROPOSAL_SCHEMA_VERSION,
    boundary: GOLDEN_HUMAN_REVIEW_PROPOSAL_BOUNDARY,
    productionReady: false,
    goldenReady: false,
    humanAdjudicationRecorded: false,
    approvalStatus: 'AWAITING_EXPLICIT_HUMAN_APPROVAL',
    evaluationAsOf: reviewBatch.evaluationAsOf,
    datasetCanonicalSha256: reviewBatch.datasetCanonicalSha256,
    reviewBatchCanonicalSha256: reviewBatch.canonicalSha256,
    summary: {
      projectProposalCount: reviewBatch.projectReviews.length,
      capabilityProposalCount: reviewBatch.capabilityReviews.length,
      pairProposalCount: reviewBatch.pairReviews.length,
      revisionProposalCount: reviewBatch.revisionReviews.length,
    },
    projectProposals: reviewBatch.projectReviews.map(projectProposal),
    capabilityProposals: reviewBatch.capabilityReviews.map(capabilityProposal),
    pairProposals: reviewBatch.pairReviews.map(pairProposal),
    revisionProposals: reviewBatch.revisionReviews.map(revisionProposal),
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
  const proposal = deepFreeze({
    ...proposalWithoutHash,
    canonicalSha256: sha256(canonicalStringify(proposalWithoutHash)),
  });
  validateGoldenHumanReviewProposal(proposal, reviewBatch);
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

export function renderGoldenHumanReviewProposalMarkdown(proposal, reviewBatch) {
  validateGoldenHumanReviewProposal(proposal, reviewBatch);
  const lines = [
    '# Golden Dataset 인간 판정 1차 배치 — 승인 전 제안서',
    '',
    '> 이 문서는 AI가 작성한 검토 초안입니다. 사람 판정, 승인, 검토 영수증 또는 Golden readiness를 주장하지 않습니다.',
    '',
    `- 경계: \`${proposal.boundary}\``,
    `- 증거 기준 시각: \`${proposal.evaluationAsOf}\``,
    `- dataset hash: \`${proposal.datasetCanonicalSha256}\``,
    `- blank batch hash: \`${proposal.reviewBatchCanonicalSha256}\``,
    `- proposal hash: \`${proposal.canonicalSha256}\``,
    `- 범위: 프로젝트 ${proposal.summary.projectProposalCount}, capability ${proposal.summary.capabilityProposalCount}, pair ${proposal.summary.pairProposalCount}, revision ${proposal.summary.revisionProposalCount}`,
    '',
    '## 프로젝트 제안 10건',
    '',
    '| 프로젝트 | 단계 | 적용 사양 | MV / Transformer | 영향 구간 | 최종 제안 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const item of proposal.projectProposals) {
    const decision = item.suggestedAdjudication;
    lines.push(`| \`${item.projectKey}\`<br>${escapeCell(item.name)} | ${decision.currentStage} | ${decision.appliedSpecificationDocumentKeys.map((key) => `\`${key}\``).join('<br>') || '없음'} | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | ${decision.specificationWindow.state} | ${decision.finalPursuitDecision} |`);
  }
  for (const item of proposal.projectProposals) {
    const decision = item.suggestedAdjudication;
    lines.push(
      '',
      `### ${item.name} (\`${item.projectKey}\`)`,
      '',
      `- 근거: ${sourceLinks(item.sourceDocuments)}`,
      `- 영향 구간 근거: ${decision.specificationWindow.rationale}`,
      `- 범위가 제한된 최종 제안: \`${decision.finalPursuitDecision}\``,
      '- blocker:',
      ...decision.blockingEvidence.map((blocker) => `  - ${blocker}`),
    );
  }
  lines.push(
    '',
    '## Capability 제안 30건',
    '',
    '| Claim | 제품군 / 필드 | 공개 후보 값 | 제안 label | reason codes | 공식 근거 |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const item of proposal.capabilityProposals) {
    const value = escapeCell(JSON.stringify(item.value));
    lines.push(`| \`${item.claimKey}\` | ${item.productFamilyId}<br>\`${item.field}\` | \`${item.operator} ${value}${item.unit ? ` ${item.unit}` : ''}\` | ${item.suggestedAdjudication.label} | ${item.suggestedAdjudication.reasonCodes.map((code) => `\`${code}\``).join('<br>')} | [${escapeCell(item.evidenceDocument.documentKey)}](${item.evidenceDocument.sourceUrl}) |`);
  }
  lines.push(
    '',
    '## Requirement–Capability pair 제안 10건',
    '',
    '| Pair | 프로젝트 | 비교 후보 | 제안 label | 이유 | 근거 |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const item of proposal.pairProposals) {
    const requirement = item.requirementEvidence;
    const capability = item.capabilityCandidate;
    const comparison = `${requirement.field} ${requirement.operator} ${JSON.stringify(requirement.value)}${requirement.unit ? ` ${requirement.unit}` : ''}<br>↔ \`${item.capabilityClaimKey}\`<br>${capability.field} ${capability.operator} ${JSON.stringify(capability.value)}${capability.unit ? ` ${capability.unit}` : ''}`;
    lines.push(`| \`${item.pairKey}\` | \`${item.projectKey}\` | ${escapeCell(comparison)} | ${item.suggestedAdjudication.label} | ${item.suggestedAdjudication.reasonCodes.map((code) => `\`${code}\``).join('<br>')} | ${sourceLinks([item.evidenceDocuments.projectRequirement, item.evidenceDocuments.productCapability])} |`);
  }
  lines.push(
    '',
    '## Revision 제안 1건',
    '',
    '| 최신 문서 | 대체된 문서 | 관계 | 이유 | 근거 |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const item of proposal.revisionProposals) {
    lines.push(`| \`${item.documentKey}\` | \`${item.supersedesDocumentKey}\` | ${item.suggestedAdjudication.relationshipStatus} | ${item.suggestedAdjudication.reasonCodes.map((code) => `\`${code}\``).join('<br>')} | ${sourceLinks([item.evidenceDocuments.newer, item.evidenceDocuments.superseded])} |`);
  }
  lines.push(
    '',
    '## 사용자가 승인하는 방법',
    '',
    '위의 링크와 판단을 실제로 확인한 뒤, 아래 블록을 복사해 이 Codex 작업에 보내십시오. `reviewedAt`은 실제 검토 완료 UTC 시각이어야 하며 증거 기준 시각보다 빠르거나 현재보다 미래일 수 없습니다.',
    '',
    '```text',
    'GOLDEN_BATCH_01_APPROVAL',
    `datasetCanonicalSha256: ${proposal.datasetCanonicalSha256}`,
    `proposalCanonicalSha256: ${proposal.canonicalSha256}`,
    'reviewer: <실제 이름 또는 이니셜>',
    'reviewReceipt: golden-batch01-<소문자 이니셜>-<YYYYMMDD>-01',
    'reviewedAt: <검토를 마친 실제 현재 UTC 시각>',
    'scope: PROJECTS_10_CAPABILITIES_30_PAIRS_10_REVISION_1',
    'disposition: APPROVE_AS_WRITTEN',
    'attestation: 나는 연결된 출처, 근거, 한계를 직접 검토했고 이 제안들을 내 도메인 판단으로 채택합니다.',
    'changes: NONE',
    '```',
    '',
    '수정할 항목이 있으면 `disposition: APPROVE_WITH_CHANGES`로 바꾸고 `changes` 아래에 정확한 key와 새 값을 적으십시오. 승인 전까지 `human-adjudications.json`은 비어 있어야 합니다.',
    '',
    '## 승인 뒤에도 남는 제약',
    '',
    '- 이 배치는 현재 15개 프로젝트 중 10개만 다룹니다.',
    '- 후보 단계는 3종뿐이므로 5단계 다양성 기준을 아직 충족하지 못합니다.',
    '- 따라서 이 배치의 사람 승인이 끝나도 곧바로 `goldenReady:true`가 되지는 않습니다.',
  );
  return `${lines.join('\n')}\n`;
}

export const GOLDEN_HUMAN_REVIEW_PROPOSAL_CAPABILITY_DECISIONS =
  CAPABILITY_DECISIONS;
