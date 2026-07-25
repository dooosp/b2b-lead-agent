import { canonicalStringify, sha256 } from '../../knowledge/claim-registry/index.mjs';
import { createCandidate, formatCandidateStatement } from '../domain/candidates.mjs';
import { normalizeSourceDocumentBundle } from '../domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../domain/evidence-anchor.mjs';
import { analyzeCandidateRelationships } from '../domain/relationships.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticDocument
} from './synthetic-benchmark-v0.mjs';

export const SYNTHETIC_CANDIDATE_REVIEW_V2_SCHEMA_VERSION =
  'pr207-candidate-review-v2-synthetic-fixture-v1';
export const SYNTHETIC_CANDIDATE_REVIEW_V2_AS_OF = SYNTHETIC_BENCHMARK_AS_OF;
export const SYNTHETIC_CANDIDATE_REVIEW_V2_PR207_HEAD =
  'c6a5469338999097acd5de7c5a12c827d27d4540';

const PRODUCT_FAMILY_CONFIG = Object.freeze({
  medium_voltage_switchgear: Object.freeze({
    displayName: 'Medium-voltage Switchgear',
    capabilityKey: 'rated_voltage',
    quantityKind: 'voltage',
    unit: 'kV'
  }),
  transformer: Object.freeze({
    displayName: 'Transformer',
    capabilityKey: 'primary_voltage',
    quantityKind: 'voltage',
    unit: 'kV'
  })
});

const SINGLETON_STAGES = Object.freeze([
  'SIGNAL',
  'ANNOUNCED',
  'FEASIBILITY',
  'BASIC_DESIGN',
  'DETAILED_DESIGN',
  'AWARD',
  'CONSTRUCTION',
  'COMMISSIONING',
  'OPERATION',
  'RETROFIT',
  'CANCELLED'
]);

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function anchorInput(document, quote) {
  const page = [...document.pages[0].text];
  const selection = [...quote];
  const startCodePoint = page.join('').indexOf(quote);
  if (startCodePoint < 0) throw new Error('SYNTHETIC_FIXTURE_QUOTE_NOT_FOUND');
  return {
    pageNumber: 1,
    startCodePoint,
    endCodePoint: startCodePoint + selection.length,
    quote
  };
}

function buildCandidateRecord({
  key,
  productFamily,
  projectStage,
  value,
  claimType = 'PRODUCT_CAPABILITY',
  conditions = [],
  revision = {}
}) {
  const config = PRODUCT_FAMILY_CONFIG[productFamily];
  const quote = `Synthetic ${key} evidence: ${config.capabilityKey} = ${value} ${config.unit}.`;
  const rawDocument = createSyntheticDocument({
    key,
    title: `Synthetic Candidate Review v2 document ${key}`,
    productFamilies: [productFamily],
    pages: [quote],
    revision
  });
  const document = normalizeSourceDocumentBundle(rawDocument, {
    asOf: SYNTHETIC_CANDIDATE_REVIEW_V2_AS_OF
  });
  const anchor = createPageEvidenceAnchor(document, anchorInput(document, quote));
  const candidateValue = {
    type: 'QUANTITY',
    key: config.capabilityKey,
    value,
    unit: config.unit,
    quantityKind: config.quantityKind
  };
  const candidate = createCandidate({
    schemaVersion: 'evidence-claim-candidate-v0',
    synthetic: true,
    documentId: document.documentId,
    evidenceAnchorId: anchor.anchorId,
    claimType,
    subject: {
      type: 'PRODUCT_FAMILY',
      id: productFamily,
      displayName: config.displayName
    },
    statement: formatCandidateStatement(productFamily, candidateValue),
    value: candidateValue,
    applicability: {
      vertical: 'datacenter',
      domain: 'electrical_power',
      productFamily,
      jurisdiction: 'KR',
      projectStages: [projectStage],
      conditions
    },
    validity: {
      type: 'NOT_STATED',
      validUntil: null
    },
    extractionMethod: 'DETERMINISTIC_RULE',
    extractionRuleId: 'OECRW0-PC-SYNTHETIC-CANDIDATE-REVIEW-V2',
    extractionReasons: [
      'CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW',
      'EXACT_LABEL_VALUE_MATCH'
    ],
    reviewState: 'REVIEW_REQUIRED'
  });
  return { document, anchor, candidate };
}

function createSingletonRecords(productFamily, valueOffset) {
  const records = SINGLETON_STAGES.map((projectStage, index) => buildCandidateRecord({
    key: `${productFamily}-singleton-${String(index + 1).padStart(2, '0')}`,
    productFamily,
    projectStage,
    value: valueOffset + index / 10
  }));
  records.push(buildCandidateRecord({
    key: `${productFamily}-singleton-technical-requirement`,
    productFamily,
    projectStage: 'SIGNAL',
    value: valueOffset + 9,
    claimType: 'TECHNICAL_REQUIREMENT'
  }));
  return records;
}

function createRelationshipRecords() {
  const exactDuplicate = [
    buildCandidateRecord({
      key: 'switchgear-exact-duplicate-a',
      productFamily: 'medium_voltage_switchgear',
      projectStage: 'SPECIFICATION',
      value: 24
    }),
    buildCandidateRecord({
      key: 'switchgear-exact-duplicate-b',
      productFamily: 'medium_voltage_switchgear',
      projectStage: 'SPECIFICATION',
      value: 24
    })
  ];
  const materialConflict = [
    buildCandidateRecord({
      key: 'transformer-material-conflict-a',
      productFamily: 'transformer',
      projectStage: 'SPECIFICATION',
      value: 22.9
    }),
    buildCandidateRecord({
      key: 'transformer-material-conflict-b',
      productFamily: 'transformer',
      projectStage: 'SPECIFICATION',
      value: 24
    })
  ];
  const conditionResolved = [
    buildCandidateRecord({
      key: 'switchgear-condition-indoor',
      productFamily: 'medium_voltage_switchgear',
      projectStage: 'TENDER',
      value: 24,
      conditions: [{ id: 'installation_condition', value: 'indoor_only' }]
    }),
    buildCandidateRecord({
      key: 'switchgear-condition-outdoor',
      productFamily: 'medium_voltage_switchgear',
      projectStage: 'TENDER',
      value: 22.9,
      conditions: [{ id: 'installation_condition', value: 'outdoor_only' }]
    })
  ];

  const superseded = buildCandidateRecord({
    key: 'transformer-superseded-old',
    productFamily: 'transformer',
    projectStage: 'TENDER',
    value: 22.9,
    revision: {
      seriesId: 'synthetic-series-candidate-review-v2-transformer-supersession',
      revisionId: 'rev-1',
      sequence: 1
    }
  });
  const successor = buildCandidateRecord({
    key: 'transformer-superseded-new',
    productFamily: 'transformer',
    projectStage: 'TENDER',
    value: 24,
    revision: {
      seriesId: 'synthetic-series-candidate-review-v2-transformer-supersession',
      revisionId: 'rev-2',
      sequence: 2,
      publishedAt: '2026-02-15T00:00:00.000Z',
      effectiveAt: '2026-03-01T00:00:00.000Z',
      retrievedAt: '2026-03-02T00:00:00.000Z',
      supersedesDocumentId: superseded.document.documentId
    }
  });

  return {
    exactDuplicate,
    materialConflict,
    conditionResolved,
    supersedes: [superseded, successor]
  };
}

function fixtureSemanticProjection({ candidates, relationshipReport }) {
  return {
    evaluatedPr207Head: SYNTHETIC_CANDIDATE_REVIEW_V2_PR207_HEAD,
    candidates,
    relationships: relationshipReport.relationships.map((relationship) => ({
      relationshipId: relationship.relationshipId,
      type: relationship.type,
      candidateIds: relationship.candidateIds
    }))
  };
}

export function createSyntheticCandidateReviewV2Fixture() {
  const relationshipCases = createRelationshipRecords();
  const records = [
    ...createSingletonRecords('medium_voltage_switchgear', 30),
    ...createSingletonRecords('transformer', 40),
    ...relationshipCases.exactDuplicate,
    ...relationshipCases.materialConflict,
    ...relationshipCases.conditionResolved,
    ...relationshipCases.supersedes
  ];
  const documents = records.map(({ document }) => document);
  const anchors = records.map(({ anchor }) => anchor);
  const candidates = records.map(({ candidate }) => candidate)
    .sort((left, right) => compareAscii(left.candidateId, right.candidateId));
  const relationshipReport = analyzeCandidateRelationships(candidates, { documents });
  const relationshipTypes = relationshipReport.relationships.map(({ type }) => type).sort(compareAscii);
  const semanticProjection = fixtureSemanticProjection({ candidates, relationshipReport });

  return Object.freeze({
    schemaVersion: SYNTHETIC_CANDIDATE_REVIEW_V2_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    humanReviewExecuted: false,
    humanReviewStatus: 'INCOMPLETE',
    evaluationAsOf: SYNTHETIC_CANDIDATE_REVIEW_V2_AS_OF,
    evaluatedPr207Head: SYNTHETIC_CANDIDATE_REVIEW_V2_PR207_HEAD,
    documents,
    anchors,
    candidates,
    relationshipReport,
    relationshipCaseTypes: relationshipTypes,
    semanticSha256: sha256(canonicalStringify(semanticProjection)),
    nonClaims: Object.freeze([
      'The fixture contains generated synthetic candidates only.',
      'No human fidelity or Candidate Review v2 decision is represented.',
      'No candidate is a canonical claim or customer-use permission.',
      'Issue #165 and both Draft merge gates remain HOLD.'
    ])
  });
}
