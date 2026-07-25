import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createValidatedClaimRegistry,
  deriveCustomerUse
} from '../knowledge/claim-registry/index.mjs';
import { extractDeterministicCandidates } from '../evidence-claim-workbench/domain/candidates.mjs';
import { normalizeSourceDocumentBundle } from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import {
  adaptReviewPatchToDraftClaims,
  candidateToRegistryClaim,
  createDraftRegistryPreview
} from '../evidence-claim-workbench/domain/registry-adapter.mjs';
import { createReviewDecision } from '../evidence-claim-workbench/domain/review-decisions.mjs';
import { createReviewPatch } from '../evidence-claim-workbench/domain/review-patch.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticDocument
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';

const BASE_SHA = '9d144fbe6309ce363f9dad8d50ffa713d24af683';
const REGISTRY_PATH = 'knowledge/claim-registry/synthetic/datacenter-claims-v1.json';

function patchFixture() {
  const document = normalizeSourceDocumentBundle(createSyntheticDocument({
    key: 'adapter-fixture',
    pages: ['Synthetic context before. Rated voltage: 24 kV. Synthetic context after.']
  }), { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const quote = 'Rated voltage: 24 kV.';
  const prefix = document.pages[0].text.slice(0, document.pages[0].text.indexOf(quote));
  const startCodePoint = [...prefix].length;
  const anchor = createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint,
    endCodePoint: startCodePoint + [...quote].length,
    quote
  });
  const candidate = extractDeterministicCandidates({ document, anchors: [anchor] })[0];
  const decision = createReviewDecision({
    candidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  const patch = createReviewPatch({
    baseCommitSha: BASE_SHA,
    registryPath: REGISTRY_PATH,
    generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents: [document],
    anchors: [anchor],
    candidates: [candidate],
    decisions: [decision]
  });
  return { patch, candidate };
}

test('adapter maps the thin Workbench scope to canonical Registry scope without adding trust', () => {
  const { patch } = patchFixture();
  const [claim] = adaptReviewPatchToDraftClaims(patch);
  assert.equal(claim.applicability.verticalId, 'datacenter_infrastructure');
  assert.deepEqual(claim.applicability.productFamilyIds, ['medium_voltage_switchgear']);
  assert.deepEqual(claim.applicability.jurisdictions, ['KR']);
  assert.equal(claim.provenance.origin, 'WORKBENCH_REVIEW_PATCH');
  assert.equal(claim.verification.reviewed, false);
  assert.equal(claim.verification.verifiedAt, '');
  assert.deepEqual(claim.verification.conflictClaimKeys, []);
  assert.equal(Object.hasOwn(claim, 'status'), false);
  assert.equal(Object.hasOwn(claim, 'customerUse'), false);
  assert.notEqual(claim.provenance.origin, 'REPOSITORY_REVIEWED');
  assert.notEqual(claim.provenance.origin, 'REPOSITORY_REVIEWED_SYNTHETIC');
});

test('the existing Claim Registry alone derives every imported draft as UNVERIFIED and customer-use BLOCKED', () => {
  const { patch } = patchFixture();
  const rawClaims = adaptReviewPatchToDraftClaims(patch);
  const registry = createValidatedClaimRegistry({ claims: rawClaims }, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  assert.equal(registry.claims.length, 1);
  const claim = registry.claims[0];
  assert.equal(claim.status, 'UNVERIFIED');
  const customerUse = deriveCustomerUse(claim, {
    synthetic: true,
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR',
    productFamilyId: 'medium_voltage_switchgear',
    projectStage: 'SPECIFICATION',
    conditions: {}
  });
  assert.deepEqual(customerUse, { state: 'BLOCKED', reasonCodes: ['CLAIM_UNVERIFIED'] });
});

test('draft preview is deterministic and keeps every production/reviewer boundary false', () => {
  const { patch } = patchFixture();
  const first = createDraftRegistryPreview(patch, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const second = createDraftRegistryPreview(patch, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  assert.deepEqual(first, second);
  assert.match(first.previewFingerprint, /^preview_[a-f0-9]{64}$/);
  assert.equal(first.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(first.productionReady, false);
  assert.equal(first.productionReviewerWorkflowReady, false);
  assert.equal(first.issue165Status, 'HOLD');
  assert.equal(first.repositoryReviewRequired, true);
  assert.equal(first.automaticVerification, false);
  assert.equal(first.customerUseAllowed, false);
  assert.equal(first.proofExecutionApproved, false);
  assert.equal(first.reviewerIdentity, 'NOT_COLLECTED');
  assert.deepEqual(first.metrics, {
    claimCount: 1,
    unverifiedCount: 1,
    customerUseBlockedCount: 1,
    verifiedCount: 0,
    customerUseAllowedCount: 0
  });
  assert.equal(first.claims[0].claim.status, 'UNVERIFIED');
  assert.equal(first.claims[0].customerUse.state, 'BLOCKED');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.claims), true);
  assert.equal(Object.isFrozen(first.claims[0]), true);
  assert.equal(Object.isFrozen(first.claims[0].claim), true);
  assert.equal(Object.isFrozen(first.claims[0].customerUse), true);
  assert.equal(Object.isFrozen(first.metrics), true);
  assert.throws(() => { first.claims[0].claim.status = 'VERIFIED'; }, TypeError);
  assert.throws(() => { first.claims[0].customerUse.state = 'ALLOWED'; }, TypeError);
  assert.throws(() => { first.metrics.customerUseAllowedCount = 1; }, TypeError);
  assert.equal(first.claims[0].claim.status, 'UNVERIFIED');
  assert.equal(first.claims[0].customerUse.state, 'BLOCKED');
  assert.equal(first.metrics.customerUseAllowedCount, 0);
});

test('adapter input cannot override provenance, review, verification, status, customer use, or identity', () => {
  const { patch } = patchFixture();
  const record = patch.approvedCandidates[0];
  const sourceDocument = patch.sourceDocuments[0];
  const evidenceAnchor = patch.evidenceAnchors[0];
  const validInput = {
    candidate: record.candidate,
    sourceDocument,
    evidenceAnchor,
    registryPath: patch.base.registryPath
  };
  assert.equal(candidateToRegistryClaim(validInput).provenance.origin, 'WORKBENCH_REVIEW_PATCH');
  const embeddedAuthorityCandidate = structuredClone(record.candidate);
  delete embeddedAuthorityCandidate.candidateId;
  embeddedAuthorityCandidate.statement = 'Medium-voltage Switchgear is verified and customer use allowed.';
  assert.throws(
    () => candidateToRegistryClaim({ ...validInput, candidate: embeddedAuthorityCandidate }),
    (error) => error.code === 'AUTHORITY_VALUE_REFUSED'
  );
  for (const extra of [
    { provenance: { origin: 'REPOSITORY_REVIEWED_SYNTHETIC' } },
    { verification: { reviewed: true, verifiedAt: SYNTHETIC_BENCHMARK_AS_OF } },
    { status: 'VERIFIED' },
    { customerUse: 'ALLOWED' },
    { reviewerIdentity: 'named-person' }
  ]) {
    assert.throws(
      () => candidateToRegistryClaim({ ...validInput, ...extra }),
      (error) => error.code === 'ADAPTER_FIELD_REFUSED'
    );
  }
});

test('preview failure injection returns no partial trust result', () => {
  const { patch } = patchFixture();
  assert.throws(
    () => createDraftRegistryPreview(patch, {
      asOf: SYNTHETIC_BENCHMARK_AS_OF,
      inject: { beforeRegistryPreview() { throw Object.assign(new Error('injected'), { code: 'INJECTED_REGISTRY_PREVIEW_FAILURE' }); } }
    }),
    (error) => error.code === 'INJECTED_REGISTRY_PREVIEW_FAILURE'
  );
  assert.throws(
    () => createDraftRegistryPreview(patch, {
      asOf: SYNTHETIC_BENCHMARK_AS_OF,
      inject: {
        afterRegistryPreview(preview) {
          preview.claims[0].customerUse.state = 'ALLOWED';
        }
      }
    }),
    TypeError
  );
});
