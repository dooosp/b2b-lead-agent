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

function buildKnowledgeNames(name, entry = {}) {
  return uniqueList([name, ...toList(entry.aliases)]);
}

function formatKnowledgeBase(productKnowledgeGraph = {}) {
  return Object.entries(productKnowledgeGraph)
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

function buildLegacyProductKnowledge(productKnowledgeGraph = {}) {
  const legacy = {};
  for (const [name, entry] of Object.entries(productKnowledgeGraph || {})) {
    const summary = summarizeEntry(entry);
    const roi = summarizeRoi(entry);
    const value = summary || name;
    const roiText = roi || '정량 ROI 근거 확보 필요';
    for (const alias of buildKnowledgeNames(name, entry)) {
      legacy[alias] = { value, roi: roiText };
    }
  }
  return legacy;
}

module.exports = {
  buildLegacyProductKnowledge,
  formatKnowledgeBase
};
