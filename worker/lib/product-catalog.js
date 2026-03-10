import { buildDeterministicSolutionProfile } from '../self-service/profile-gen.js';
import { getProductKnowledgeEntry } from '../self-service/product-knowledge.js';

const CATALOG_BLUEPRINTS = Object.freeze([
  { company: '기준 제조사', industry: '제조' },
  { company: '기준 건설사', industry: '건설' },
  { company: '기준 물류사', industry: '물류' },
  { company: '기준 범용기업', industry: '서비스' }
]);

function mergeUniqueItems(target, values) {
  const next = Array.isArray(target) ? [...target] : [];
  for (const value of Array.isArray(values) ? values : []) {
    if (!value || next.includes(value)) continue;
    next.push(value);
  }
  return next;
}

function mergeCatalogProfiles() {
  const merged = {
    productKnowledgeGraph: {},
    productKnowledge: {},
    products: {},
    categoryRules: {},
    categoryConfig: {}
  };

  for (const blueprint of CATALOG_BLUEPRINTS) {
    const profile = buildDeterministicSolutionProfile(blueprint.company, blueprint.industry);
    for (const [name, entry] of Object.entries(profile.productKnowledgeGraph || {})) {
      const existing = merged.productKnowledgeGraph[name] || {};
      merged.productKnowledgeGraph[name] = {
        ...existing,
        ...entry,
        aliases: mergeUniqueItems(existing.aliases, entry.aliases),
        targetIndustries: mergeUniqueItems(existing.targetIndustries, entry.targetIndustries),
        targetPersonas: mergeUniqueItems(existing.targetPersonas, entry.targetPersonas),
        useCases: mergeUniqueItems(existing.useCases, entry.useCases),
        painsSolved: mergeUniqueItems(existing.painsSolved, entry.painsSolved),
        businessOutcomes: mergeUniqueItems(existing.businessOutcomes, entry.businessOutcomes),
        technicalRequirements: mergeUniqueItems(existing.technicalRequirements, entry.technicalRequirements),
        integrationConstraints: mergeUniqueItems(existing.integrationConstraints, entry.integrationConstraints),
        roiDrivers: mergeUniqueItems(existing.roiDrivers, entry.roiDrivers),
        proofPoints: mergeUniqueItems(existing.proofPoints, entry.proofPoints),
        differentiators: mergeUniqueItems(existing.differentiators, entry.differentiators),
        commonObjections: mergeUniqueItems(existing.commonObjections, entry.commonObjections)
      };
    }

    for (const [category, products] of Object.entries(profile.products || {})) {
      merged.products[category] = mergeUniqueItems(merged.products[category], products);
    }
    for (const [category, rules] of Object.entries(profile.categoryRules || {})) {
      merged.categoryRules[category] = mergeUniqueItems(merged.categoryRules[category], rules);
    }
    for (const [category, config] of Object.entries(profile.categoryConfig || {})) {
      if (!merged.categoryConfig[category]) merged.categoryConfig[category] = config;
    }
  }

  return merged;
}

const UNIFIED_PRODUCT_CATALOG = mergeCatalogProfiles();

export function getUnifiedProductCatalog() {
  return UNIFIED_PRODUCT_CATALOG;
}

export function resolveLeadProductEntry(lead) {
  return getProductKnowledgeEntry(UNIFIED_PRODUCT_CATALOG, lead && lead.product ? lead.product : '');
}
