function toList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function uniqueList(items) {
  return [...new Set(toList(items))];
}

function summarizeEntry(entry = {}) {
  if (typeof entry.summary === 'string' && entry.summary.trim()) return entry.summary.trim();
  if (typeof entry.value === 'string' && entry.value.trim()) return entry.value.trim();
  const parts = [
    ...toList(entry.useCases),
    ...toList(entry.painsSolved),
    ...toList(entry.businessOutcomes)
  ].slice(0, 3);
  return parts.join(', ');
}

function summarizeRoi(entry = {}) {
  if (typeof entry.roiSummary === 'string' && entry.roiSummary.trim()) return entry.roiSummary.trim();
  if (typeof entry.roi === 'string' && entry.roi.trim()) return entry.roi.trim();
  return toList(entry.roiDrivers).slice(0, 3).join(', ');
}

function normalizeName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function buildLegacyProductKnowledge(productKnowledgeGraph = {}) {
  const legacy = {};
  for (const [name, entry] of Object.entries(productKnowledgeGraph || {})) {
    const summary = summarizeEntry(entry);
    const roi = summarizeRoi(entry);
    const value = summary || name;
    const roiText = roi || '정량 ROI 근거 확보 필요';
    for (const alias of uniqueList([name, ...toList(entry.aliases)])) {
      legacy[alias] = { value, roi: roiText };
    }
  }
  return legacy;
}

export function getProductKnowledgeEntry(profile, productName) {
  const normalizedName = normalizeName(productName);
  const graph = profile && profile.productKnowledgeGraph && typeof profile.productKnowledgeGraph === 'object'
    ? profile.productKnowledgeGraph
    : {};
  for (const [name, entry] of Object.entries(graph)) {
    const aliases = uniqueList([name, ...toList(entry.aliases)]);
    if (aliases.some((alias) => normalizeName(alias) === normalizedName)) {
      return { name, ...entry };
    }
  }

  const fallback = profile && profile.productKnowledge && profile.productKnowledge[productName];
  if (fallback && typeof fallback === 'object') return { name: productName, ...fallback };
  return null;
}

export function getProductKnowledgeTerms(entry) {
  if (!entry || typeof entry !== 'object') return [];
  return uniqueList([
    entry.name,
    ...toList(entry.aliases),
    entry.summary,
    entry.value,
    entry.roiSummary,
    entry.roi,
    ...toList(entry.targetIndustries),
    ...toList(entry.targetPersonas),
    ...toList(entry.useCases),
    ...toList(entry.painsSolved),
    ...toList(entry.businessOutcomes),
    ...toList(entry.technicalRequirements),
    ...toList(entry.integrationConstraints),
    ...toList(entry.roiDrivers),
    ...toList(entry.proofPoints),
    ...toList(entry.differentiators),
    ...toList(entry.commonObjections)
  ]);
}

export function formatProductKnowledgeLines(profile) {
  const graph = profile && profile.productKnowledgeGraph && typeof profile.productKnowledgeGraph === 'object'
    ? profile.productKnowledgeGraph
    : null;
  if (!graph || Object.keys(graph).length === 0) {
    return profile && profile.productKnowledge
      ? Object.entries(profile.productKnowledge)
          .map(([name, info]) => `- ${name}: 핵심가치="${info.value}", ROI="${info.roi}"`)
          .join('\n')
      : '(자동 생성 프로필)';
  }

  return Object.entries(graph)
    .map(([name, entry]) => {
      const industries = toList(entry.targetIndustries).slice(0, 3).join(', ') || '-';
      const useCases = toList(entry.useCases).slice(0, 2).join(', ') || '-';
      const pains = toList(entry.painsSolved).slice(0, 2).join(', ') || '-';
      const outcomes = toList(entry.businessOutcomes).slice(0, 2).join(', ') || '-';
      const roi = summarizeRoi(entry) || '-';
      return `- ${name}: 산업="${industries}", useCases="${useCases}", pains="${pains}", outcomes="${outcomes}", ROI="${roi}"`;
    })
    .join('\n');
}
