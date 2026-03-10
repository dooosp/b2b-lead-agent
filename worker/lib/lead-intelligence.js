import { buildSolutionTranslation } from './solution-translation.js';

export function hydrateLeadIntelligence(lead, options = {}) {
  if (!lead || typeof lead !== 'object') return lead;
  const solutionTranslation = buildSolutionTranslation(lead);
  return {
    ...lead,
    solutionTranslation
  };
}

export function hydrateLeadList(leads, options = {}) {
  return (Array.isArray(leads) ? leads : []).map((lead) => hydrateLeadIntelligence(lead, options));
}
