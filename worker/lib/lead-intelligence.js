import { buildSolutionTranslation } from './solution-translation.js';
import { buildStakeholderPersuasion } from './persuasion-engine.js';

export function hydrateLeadIntelligence(lead, options = {}) {
  if (!lead || typeof lead !== 'object') return lead;
  const solutionTranslation = buildSolutionTranslation(lead);
  const stakeholderPersuasion = buildStakeholderPersuasion(lead);
  return {
    ...lead,
    solutionTranslation,
    stakeholderPersuasion
  };
}

export function hydrateLeadList(leads, options = {}) {
  return (Array.isArray(leads) ? leads : []).map((lead) => hydrateLeadIntelligence(lead, options));
}
