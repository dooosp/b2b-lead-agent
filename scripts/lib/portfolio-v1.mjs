import { readFileSync } from 'node:fs';
import { createValidatedClaimRegistry, deriveCustomerUse, sha256 } from '../../knowledge/claim-registry/index.mjs';
import { buildPursuitRevisionSnapshot, buildMinimumEvidenceToAdvance, evaluateSpecificationDelta } from '../../verticals/datacenter/pursuit-twin-v0.mjs';

const raw = JSON.parse(readFileSync(new URL('../../eval/fixtures/portfolio-v1/claims.json', import.meta.url), 'utf8'));
const pack = JSON.parse(readFileSync(new URL('../../verticals/datacenter/vertical-pack-v0.json', import.meta.url), 'utf8'));

// One frozen synthetic project. The 33 kV revision explicitly belongs to Alpha;
// it is not the unrelated Mismatch project from the broad evaluator fixtures.
export function buildPortfolioDemo() {
  const registry = createValidatedClaimRegistry(raw, { asOf: raw.evaluationAsOf });
  const family = 'medium_voltage_switchgear';
  const opportunityId = 'synthetic_dc_alpha';
  const revisions = [
    { id: 'R1', value: 22.9, state: 'KNOWN', refs: ['req_voltage_22_9kv'], date: '2026-04-01' },
    { id: 'R2', value: 22.9, state: 'UNKNOWN', refs: [], date: '2026-04-15' },
    { id: 'R3', value: 33, state: 'KNOWN', refs: ['req_voltage_33kv'], date: '2026-05-01' },
  ].map((revision, i) => {
    const requirement = {
      requirementId: 'req_incoming_voltage', category: 'electrical_power',
      key: 'incoming_voltage', productFamilyIds: [family], priority: 'HARD',
      valueState: revision.state, operator: 'GTE',
      value: { type: 'QUANTITY', key: 'incoming_voltage', value: revision.value, unit: 'kV', quantityKind: 'voltage' },
      evidenceClaimRefs: revision.refs,
    };
    const opportunity = {
      schemaVersion: 'project-opportunity-v0', synthetic: true, opportunityId,
      verticalId: 'datacenter_infrastructure', jurisdiction: 'KR', conditions: {},
      identity: { opportunityId, accountDisplayName: 'Synthetic Metro Compute',
        projectDisplayName: 'Synthetic DC Alpha', facilityDisplayName: 'Alpha DC',
        verticalId: 'datacenter_infrastructure', jurisdiction: 'KR' },
      stage: { value: 'BASIC_DESIGN', evidenceClaimRefs: ['stage_basic_design'] },
      candidateProductFamilyIds: [family], requirements: [requirement],
    };
    const snapshot = buildPursuitRevisionSnapshot({
      opportunity,
      sourceRevision: {
        documentKey: 'synthetic_alpha_single_line', revisionId: revision.id,
        supersedesRevisionId: i ? 'R' + i : null,
        effectiveAt: revision.date + 'T00:00:00.000Z',
        evidenceClaimRefs: ['stage_basic_design', ...revision.refs],
      },
      observedAt: revision.date + 'T12:00:00.000Z',
    }, registry, pack);
    return { id: revision.id, requirement, snapshot, fit: snapshot.evaluation.results[0],
      minimum: buildMinimumEvidenceToAdvance(opportunity, registry, pack) };
  });
  const capability = registry.byKey.get('cap_switchgear_24kv');
  const context = { synthetic: true, verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR', productFamilyId: family, projectStage: 'BASIC_DESIGN', conditions: {} };
  const result = {
    schemaVersion: 'b2b-portfolio-demo-v1', evidenceBoundary: 'NOT_PRODUCTION_EVIDENCE',
    synthetic: true, productionReady: false, issue165Status: 'HOLD',
    evaluationAsOf: registry.asOf, inputSha256: sha256(raw),
    provenance: {
      master: '62007116cba3e3425ae6e73a15f8f2dad413160d',
      reviewerUxPr214: 'db35ed7999c7415c495e6e6b780c872ffe1cc01d',
      twinModulePr212: 'e6fbc373878701a77d8cce530d857e43cd74e1d7',
    },
    candidate: { family, voltage: capability.value.value, claimId: capability.claimId,
      status: capability.status, customerUse: deriveCustomerUse(capability, context) },
    claims: registry.claims, revisions,
    deltas: revisions.slice(1).map((revision, i) => evaluateSpecificationDelta(
      revisions[i].snapshot, revision.snapshot, registry, pack)),
    // Never create a prior human decision to make a demo look completed.
    finalHumanDecision: 'NOT_MADE',
    humanEvidence: { personalReproduction: 'NOT_RECORDED', otherUserTrial: 'NOT_RECORDED',
      formalPilot: 'SEPARATE_NOT_UPDATED' },
  };
  return { ...result, canonicalSha256: sha256(result) };
}
