import { readFileSync } from 'node:fs';
import { runFitVariant } from '../../eval/spec-fit-evaluator.mjs';
import { canonicalStringify, sha256 } from '../../knowledge/claim-registry/index.mjs';
import { buildPursuitDossier, evaluateSpecificationFit } from '../../verticals/datacenter/index.mjs';
import { buildMinimumEvidenceToAdvance } from '../../verticals/datacenter/pursuit-twin-v0.mjs';

const rawRegistry = JSON.parse(readFileSync(new URL('../../knowledge/claim-registry/synthetic/datacenter-claims-v1.json', import.meta.url), 'utf8'));
const verticalPack = JSON.parse(readFileSync(new URL('../../verticals/datacenter/vertical-pack-v0.json', import.meta.url), 'utf8'));
const projectContext = JSON.parse(readFileSync(new URL('../../eval/fixtures/pilot-review/project-context-v1.json', import.meta.url), 'utf8'));
// Only checked-in synthetic context is applied, before registry validation and
// evaluation. Broad evaluator fixtures and trusted engine semantics stay intact.
const pilotRegistry = {
  ...rawRegistry,
  claims: rawRegistry.claims.map(claim => projectContext.claimReplacements.find(
    replacement => replacement.claimKey === claim.claimKey) || claim)
};

const cases = new Map([
  ['ELECTRICAL', {
    title: '전압 요구 충족 · 기술 검토 계속',
    description: '합성 22.9 kV 요구와 24 kV 후보의 기술 적합성을 검토합니다. FIT와 열린 사양 창은 사람의 상업적 승인이나 구매 결정을 뜻하지 않습니다.'
  }],
  ['MISSING_VOLTAGE', {
    title: '전압 근거 누락 · 자료 요청',
    description: '요구 전압은 UNKNOWN이며 연결된 요구 근거가 없습니다. 보존된 숫자를 확정 요구로 사용하지 않고, 단선결선도 확보 후 재평가할 항목을 검토합니다.'
  }],
  ['HARD_MISMATCH', {
    title: '확인된 전압 불일치 · 현재 후보 검토',
    description: '합성 33 kV 요구가 24 kV 후보의 용량을 초과합니다. 현재 후보의 확인된 불일치를 추가 자료 수집만으로 해결할 수 있다고 해석하지 않습니다.'
  }],
  ['UNVERIFIED_CAPABILITY', {
    title: '미검증 제품 주장 · 근거 확인',
    description: 'BACnet/IP 요구에 대해 모델이 제안한 제품 주장은 검증되지 않았습니다. 검증된 기능이나 고객에게 사용할 수 있는 주장으로 승격하지 않습니다.'
  }],
  ['EXPIRED_CAPABILITY', {
    title: '유효기간 만료 · 최신 근거 확인',
    description: 'BACnet/IP 기능의 합성 근거는 고정 평가 시점에 만료되었습니다. 과거 검토 기록과 현재 사용 가능한 검증을 구분합니다.'
  }],
  ['WRONG_JURISDICTION', {
    title: '관할 범위 불일치 · 적용성 확인',
    description: 'US 평가 맥락에 KR 범위의 합성 근거를 대입한 사례입니다. VERIFIED 상태여도 관할이 다르면 적용 가능한 근거로 보지 않습니다.'
  }],
  ['WINDOW_CLOSED', {
    title: '사양 창 종료 · 진행 조건 검토',
    description: '기술 요구는 충족하지만 AWARD 단계에서 사양 창이 닫혔습니다. FIT와 실제 진행 가능성을 구분하고 비근거 차단 조건을 검토합니다.'
  }]
]);

function relevantClaims(opportunity, evaluation, registry) {
  const refs = new Set([
    ...opportunity.stage.evidenceClaimRefs,
    ...opportunity.requirements.flatMap(requirement => requirement.evidenceClaimRefs),
    ...evaluation.results.flatMap(result => [
      ...(result.projectClaimIds || []), ...(result.capabilityClaimIds || []),
      ...(result.window.stageClaimIds || [])
    ])
  ]);
  const families = new Set(opportunity.candidateProductFamilyIds);
  // Keep the actual referenced project records plus family capability/reference
  // records even when the engine excludes them for status or applicability.
  // Unreferenced project values must not silently fill an UNKNOWN requirement.
  return registry.claims.filter(claim => refs.has(claim.claimKey) || refs.has(claim.claimId)
    || (claim.subject.type === 'PRODUCT_FAMILY'
      && claim.applicability.productFamilyIds.some(family => families.has(family))));
}

export function buildPilotReviewCase(id) {
  if (arguments.length > 1) throw new Error('PILOT_REVIEW_INPUTS_REFUSED');
  if (typeof id !== 'string' || !cases.has(id)) throw new Error('UNKNOWN_PILOT_REVIEW_CASE');
  const { input: opportunity, registry } = runFitVariant(id, pilotRegistry, verticalPack);
  opportunity.opportunityId = projectContext.opportunityId;
  opportunity.identity = { ...opportunity.identity, ...projectContext.identity,
    opportunityId: projectContext.opportunityId };
  const evaluation = evaluateSpecificationFit(opportunity, registry, verticalPack);
  const dossier = buildPursuitDossier(opportunity, evaluation, registry, verticalPack);
  const minimumEvidence = buildMinimumEvidenceToAdvance(opportunity, registry, verticalPack);
  const payload = {
    id, ...cases.get(id), opportunity, evaluation, minimumEvidence, dossier,
    claims: relevantClaims(opportunity, evaluation, registry),
    // Bind every materialized engine input, not only the displayed claim subset.
    inputSha256: sha256({ opportunity,
      registry: { asOf: registry.asOf, claims: registry.claims }, verticalPack })
  };
  return JSON.parse(canonicalStringify({ ...payload, caseSha256: sha256(payload) }));
}

export function buildPilotReviewWorkspace() {
  if (arguments.length) throw new Error('PILOT_REVIEW_INPUTS_REFUSED');
  const payload = {
    schemaVersion: 'b2b-pilot-review-workspace-v1',
    evidenceBoundary: 'NOT_PRODUCTION_EVIDENCE',
    synthetic: true,
    productionReady: false,
    issue165Status: 'HOLD',
    evaluationAsOf: rawRegistry.evaluationAsOf,
    cases: [...cases.keys()].map(id => buildPilotReviewCase(id))
  };
  return { ...payload, workspaceSha256: sha256(payload) };
}
