const DIMENSION_IDS = Object.freeze([
  'evidenceCompleteness',
  'confidenceClarity',
  'assumptionsClarity',
  'dataGaps',
  'verificationStatus',
  'reviewReadiness',
  'eventTypeClarity',
]);

const DIMENSION_WEIGHTS = Object.freeze({
  evidenceCompleteness: 25,
  confidenceClarity: 10,
  assumptionsClarity: 10,
  dataGaps: 10,
  verificationStatus: 15,
  reviewReadiness: 20,
  eventTypeClarity: 10,
});

const VALID_CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW']);
const VALID_REVIEW_STATUSES = new Set(['NEW', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'DEFERRED']);
const VALID_VERIFICATION_STATUSES = new Set(['verified', 'needs_review', 'draft', 'unverified']);
const GENERIC_EVENT_TYPES = new Set(['other', 'misc', 'general', 'unknown', '기타']);
const SYNTHETIC_URL_HOST = 'synthetic.example';
const PRODUCTION_ARTIFACT_RE = /(?:^|\/)(?:reports\/|latest-leads\.json$|lead-history\.json$|lead-report-\d{4}-\d{2}-\d{2}\.md$)/i;

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function normalizeConfidence(value) {
  return cleanText(value).toUpperCase();
}

function normalizeVerificationStatus(value) {
  return cleanText(value).toLowerCase();
}

function normalizeReviewStatus(value) {
  return cleanText(value).toUpperCase();
}

function normalizeSources(sources) {
  return (Array.isArray(sources) ? sources : [])
    .filter((source) => source && typeof source === 'object')
    .map((source) => ({
      title: cleanText(source.title),
      url: cleanText(source.url),
      publishedAt: cleanText(source.publishedAt || source.published_at || source.pubDate),
    }));
}

function normalizeEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      field: cleanText(item.field),
      quote: cleanText(item.quote),
      sourceUrl: cleanText(item.sourceUrl || item.source_url),
      contradicts: cleanText(item.contradicts),
    }));
}

function addUnique(items, value) {
  if (value && !items.includes(value)) items.push(value);
}

function collectLeadUrls(lead = {}) {
  const urls = [];
  for (const source of Array.isArray(lead.sources) ? lead.sources : []) {
    if (source && typeof source === 'object') {
      urls.push(source.url, source.originUrl, source.originalUrl);
    }
  }
  for (const evidence of Array.isArray(lead.evidence) ? lead.evidence : []) {
    if (evidence && typeof evidence === 'object') {
      urls.push(evidence.sourceUrl, evidence.source_url);
    }
  }
  return urls.map(cleanText).filter(Boolean);
}

function isProductionLikeUrl(value) {
  const url = cleanText(value);
  if (!url) return false;
  if (PRODUCTION_ARTIFACT_RE.test(url)) return true;
  try {
    const parsed = new URL(url);
    return PRODUCTION_ARTIFACT_RE.test(parsed.pathname);
  } catch {
    return false;
  }
}

function assertSyntheticLeadSet(leads = []) {
  if (!Array.isArray(leads)) {
    throw new Error('Lead quality harness input must be an array of synthetic leads.');
  }

  for (const [index, lead] of leads.entries()) {
    if (!lead || typeof lead !== 'object' || lead.synthetic !== true) {
      throw new Error(`Lead at index ${index} must set synthetic: true.`);
    }

    for (const url of collectLeadUrls(lead)) {
      if (isProductionLikeUrl(url)) {
        throw new Error(`Lead ${lead.id || index} includes a production-like URL: ${url}`);
      }
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`Lead ${lead.id || index} URL must be an absolute synthetic URL: ${url}`);
      }
      if (parsed.protocol !== 'https:' || parsed.hostname !== SYNTHETIC_URL_HOST) {
        throw new Error(`Lead ${lead.id || index} URL must use https://${SYNTHETIC_URL_HOST}: ${url}`);
      }
    }
  }

  return leads;
}

function containsAnyGap(dataGaps, matchers) {
  return dataGaps.some((gap) => matchers.some((matcher) => gap.toLowerCase().includes(matcher)));
}

function isStaleDate(publishedAt, now, staleAfterDays) {
  if (!publishedAt) return false;
  const publishedTime = Date.parse(publishedAt);
  const nowTime = Date.parse(now);
  if (!Number.isFinite(publishedTime) || !Number.isFinite(nowTime)) return false;
  const ageMs = nowTime - publishedTime;
  return ageMs > staleAfterDays * 24 * 60 * 60 * 1000;
}

function dimension(id, status, findings = [], actions = []) {
  return {
    id,
    weight: DIMENSION_WEIGHTS[id],
    status,
    score: DIMENSION_WEIGHTS[id] * (status === 'pass' ? 1 : status === 'warning' ? 0.5 : 0),
    findings,
    actions,
  };
}

function summarizeInputs(lead, options) {
  const now = options.now || new Date().toISOString();
  const staleAfterDays = Number.isFinite(options.staleAfterDays) ? options.staleAfterDays : 90;
  const company = cleanText(lead.company);
  const product = cleanText(lead.product);
  const signal = cleanText(lead.signal || lead.summary);
  const whyNow = cleanText(lead.whyNow || lead.urgencyReason || lead.globalContext);
  const recommendedMessage = cleanText(lead.recommendedMessage || lead.salesPitch || lead.sales_pitch);
  const eventType = cleanText(lead.eventType || lead.event_type);
  const confidence = normalizeConfidence(lead.confidence);
  const confidenceReason = cleanText(lead.confidenceReason || lead.confidence_reason);
  const assumptions = normalizeList(lead.assumptions);
  const dataGaps = normalizeList(lead.dataGaps || lead.data_gaps);
  const verificationStatus = normalizeVerificationStatus(lead.verificationStatus || lead.verification_status);
  const reviewStatus = normalizeReviewStatus(lead.reviewStatus || lead.review_status);
  const sources = normalizeSources(lead.sources);
  const evidence = normalizeEvidence(lead.evidence);
  const conflicts = Array.isArray(lead.conflicts) ? lead.conflicts : [];
  const contradictionFields = evidence.map((item) => item.contradicts).filter(Boolean);
  const sourceUrls = new Set(sources.map((source) => source.url).filter(Boolean));
  const completeSources = sources.filter((source) => source.title && source.url);
  const completeEvidence = evidence.filter((item) => item.field && item.quote && item.sourceUrl);
  const unmatchedEvidence = completeEvidence.filter((item) => !sourceUrls.has(item.sourceUrl));
  const staleSources = completeSources.filter((source) => isStaleDate(source.publishedAt, now, staleAfterDays));
  const conflictFields = [
    ...conflicts.map((conflict) => cleanText(conflict && conflict.field)).filter(Boolean),
    ...contradictionFields,
  ];

  return {
    now,
    staleAfterDays,
    company,
    product,
    signal,
    whyNow,
    recommendedMessage,
    eventType,
    confidence,
    confidenceReason,
    assumptions,
    dataGaps,
    verificationStatus,
    reviewStatus,
    sources,
    evidence,
    completeSources,
    completeEvidence,
    unmatchedEvidence,
    staleSources,
    conflictFields,
    hasConflicts: conflictFields.length > 0,
    hasSourceEvidence: completeSources.length > 0,
    hasQuoteEvidence: completeEvidence.length > 0,
  };
}

function evaluateEvidenceCompleteness(input) {
  const findings = [];
  const actions = [];

  if (!input.hasSourceEvidence) {
    findings.push('No complete source with title and URL is attached.');
    actions.push('Add at least one source with title, URL, and publication date.');
  }
  if (!input.hasQuoteEvidence) {
    findings.push('No direct evidence quote with field and source URL is attached.');
    actions.push('Add direct evidence quotes tied to source URLs.');
  }
  if (input.hasConflicts) {
    const fields = [...new Set(input.conflictFields)].join(', ');
    findings.push(`Conflicting evidence is declared for ${fields}.`);
    actions.push(`Resolve conflicting evidence for ${fields}.`);
  }

  if (findings.length > 0) return dimension('evidenceCompleteness', 'fail', findings, actions);

  if (input.unmatchedEvidence.length > 0) {
    findings.push('At least one evidence quote points to a URL outside the source list.');
    actions.push('Align every evidence sourceUrl with a listed source URL.');
  }
  if (input.staleSources.length > 0) {
    findings.push(`Source evidence is older than ${input.staleAfterDays} days.`);
    actions.push('Refresh stale sources or revalidate the signal before outreach.');
  }

  return dimension(
    'evidenceCompleteness',
    findings.length > 0 ? 'warning' : 'pass',
    findings,
    actions
  );
}

function evaluateConfidenceClarity(input) {
  const findings = [];
  const actions = [];

  if (!VALID_CONFIDENCE.has(input.confidence)) {
    findings.push('Confidence must be HIGH, MEDIUM, or LOW.');
    actions.push('Set confidence to HIGH, MEDIUM, or LOW with a concise reason.');
    return dimension('confidenceClarity', 'fail', findings, actions);
  }

  if (!input.confidenceReason) {
    findings.push('Confidence reason is missing.');
    actions.push('Add a confidenceReason explaining the evidence basis.');
    return dimension('confidenceClarity', 'fail', findings, actions);
  }

  if (input.confidence === 'LOW') {
    findings.push('Low-confidence lead is clearly labeled.');
    actions.push('Keep low confidence visible and resolve data gaps before outreach.');
    return dimension('confidenceClarity', 'warning', findings, actions);
  }

  if (input.hasConflicts) {
    findings.push('Confidence is overstated while evidence conflicts are unresolved.');
    actions.push('Lower confidence or resolve conflicting evidence.');
    return dimension('confidenceClarity', 'warning', findings, actions);
  }

  if (input.staleSources.length > 0 && input.confidence !== 'LOW') {
    findings.push('Confidence depends on stale source evidence.');
    actions.push('Refresh stale sources before raising confidence.');
    return dimension('confidenceClarity', 'warning', findings, actions);
  }

  return dimension('confidenceClarity', 'pass', ['Confidence and reason are explicit.']);
}

function evaluateAssumptionsClarity(input) {
  if (input.assumptions.length === 0) {
    return dimension(
      'assumptionsClarity',
      'fail',
      ['No assumptions are attached.'],
      ['Add explicit assumptions for estimates, fit, and outreach timing.']
    );
  }

  return dimension('assumptionsClarity', 'pass', ['Assumptions are explicit.']);
}

function evaluateDataGaps(input) {
  const findings = [];
  const actions = [];

  const expectations = [
    {
      active: !input.company,
      matchers: ['company', 'account'],
      action: 'Document the missing company name in dataGaps.',
    },
    {
      active: !input.product,
      matchers: ['product'],
      action: 'Document the missing recommended product in dataGaps.',
    },
    {
      active: !input.hasSourceEvidence,
      matchers: ['source', 'published'],
      action: 'Document missing published source evidence in dataGaps.',
    },
    {
      active: !input.hasQuoteEvidence,
      matchers: ['quote', 'direct evidence'],
      action: 'Document missing direct evidence quotes in dataGaps.',
    },
    {
      active: input.hasConflicts,
      matchers: ['conflict', 'contradict'],
      action: 'Document conflicting evidence that needs resolution.',
    },
    {
      active: input.staleSources.length > 0,
      matchers: ['stale', 'freshness', 'current'],
      action: 'Document stale signal freshness in dataGaps.',
    },
  ];

  for (const expectation of expectations) {
    if (!expectation.active) continue;
    if (!containsAnyGap(input.dataGaps, expectation.matchers)) {
      findings.push(expectation.action);
      actions.push(expectation.action);
    }
  }

  if (findings.length > 0) return dimension('dataGaps', 'fail', findings, actions);

  const lowConfidenceWithoutBlockingIdentityGap = input.confidence === 'LOW'
    && input.company
    && input.product
    && input.hasSourceEvidence
    && input.hasQuoteEvidence
    && !input.hasConflicts
    && input.staleSources.length === 0;

  if (lowConfidenceWithoutBlockingIdentityGap || input.hasConflicts || input.staleSources.length > 0) {
    return dimension(
      'dataGaps',
      'warning',
      ['Open data gaps are documented and should be resolved before outreach.'],
      input.dataGaps
    );
  }

  return dimension('dataGaps', 'pass', ['Data gaps are clear for the current evidence state.']);
}

function evaluateVerificationStatus(input) {
  const findings = [];
  const actions = [];

  if (!VALID_VERIFICATION_STATUSES.has(input.verificationStatus)) {
    findings.push('Verification status is missing or outside the frozen values.');
    actions.push('Set verificationStatus to verified, needs_review, draft, or unverified.');
    return dimension('verificationStatus', 'fail', findings, actions);
  }

  const verifiedBlocked = input.verificationStatus === 'verified' && (
    !input.hasSourceEvidence || !input.hasQuoteEvidence || input.hasConflicts || input.staleSources.length > 0
  );
  if (verifiedBlocked) {
    findings.push('Lead is marked verified before evidence is complete and current.');
    actions.push('Do not mark verified until evidence and conflicts are resolved.');
    return dimension('verificationStatus', 'fail', findings, actions);
  }

  if (!input.company || !input.product || input.staleSources.length > 0) {
    findings.push('Verification cannot be final until identity, fit, and freshness are rechecked.');
    actions.push('Keep verification at needs_review until identity, fit, and freshness are confirmed.');
    return dimension('verificationStatus', 'warning', findings, actions);
  }

  return dimension('verificationStatus', 'pass', ['Verification status matches the evidence state.']);
}

function evaluateReviewReadiness(input) {
  const findings = [];
  const actions = [];

  if (!input.company) {
    findings.push('Target company is missing.');
    actions.push('Add a target company before review.');
  }
  if (!input.product) {
    findings.push('Recommended product is missing.');
    actions.push('Add the recommended product before review.');
  }
  if (!input.signal) {
    findings.push('Lead signal is missing.');
    actions.push('Add a concise signal before review.');
  }
  if (!input.whyNow) {
    findings.push('Why-now rationale is missing.');
    actions.push('Add a why-now rationale before review.');
  }
  if (!input.recommendedMessage) {
    findings.push('Recommended message is missing.');
    actions.push('Add a recommended first message before review.');
  }
  if (!VALID_REVIEW_STATUSES.has(input.reviewStatus)) {
    findings.push('Review status is missing or outside the frozen values.');
    actions.push('Set reviewStatus to one of NEW, NEEDS_REVIEW, APPROVED, REJECTED, or DEFERRED.');
  }
  if (input.reviewStatus === 'APPROVED') {
    findings.push('Generated leads should not start as human-approved.');
    actions.push('Use NEEDS_REVIEW until a human approves the lead.');
  }
  if (!input.hasSourceEvidence || !input.hasQuoteEvidence || input.hasConflicts || input.staleSources.length > 0) {
    findings.push('Evidence state is not ready for confident human review.');
  }
  if (input.staleSources.length > 0) {
    actions.push('Refresh stale sources or revalidate the signal before outreach.');
  }

  return dimension(
    'reviewReadiness',
    findings.length > 0 ? 'fail' : 'pass',
    findings.length > 0 ? findings : ['Lead has the required review fields.'],
    actions
  );
}

function evaluateEventTypeClarity(input) {
  if (!input.eventType) {
    return dimension(
      'eventTypeClarity',
      'fail',
      ['Event type is missing.'],
      ['Add an eventType that explains the trigger category.']
    );
  }

  if (GENERIC_EVENT_TYPES.has(input.eventType.toLowerCase())) {
    return dimension(
      'eventTypeClarity',
      'warning',
      ['Event type is too generic for reliable triage.'],
      ['Replace generic eventType with the specific trigger category.']
    );
  }

  return dimension('eventTypeClarity', 'pass', ['Event type is explicit.']);
}

function orderDimensions(dimensions) {
  return DIMENSION_IDS.reduce((ordered, id) => {
    ordered[id] = dimensions[id];
    return ordered;
  }, {});
}

function determineStatus(score, reviewReady, dimensions) {
  const hasWarnings = Object.values(dimensions).some((item) => item.status === 'warning');
  if (!reviewReady) return 'HOLD';
  if (score < 90 || hasWarnings) return 'FOLLOW_UP';
  return 'SHIP';
}

function evaluateLeadQuality(lead = {}, options = {}) {
  const input = summarizeInputs(lead && typeof lead === 'object' ? lead : {}, options);
  const dimensions = orderDimensions({
    evidenceCompleteness: evaluateEvidenceCompleteness(input),
    confidenceClarity: evaluateConfidenceClarity(input),
    assumptionsClarity: evaluateAssumptionsClarity(input),
    dataGaps: evaluateDataGaps(input),
    verificationStatus: evaluateVerificationStatus(input),
    reviewReadiness: evaluateReviewReadiness(input),
    eventTypeClarity: evaluateEventTypeClarity(input),
  });
  const score = Math.round(Object.values(dimensions).reduce((sum, item) => sum + item.score, 0));
  const reviewReady = dimensions.reviewReadiness.status === 'pass';
  const status = determineStatus(score, reviewReady, dimensions);
  const actions = [];
  for (const item of Object.values(dimensions)) {
    for (const action of item.actions) addUnique(actions, action);
  }

  return {
    id: cleanText(lead.id),
    fixtureType: cleanText(lead.fixtureType),
    company: input.company,
    product: input.product,
    score,
    status,
    reviewReady,
    dimensions,
    actions,
  };
}

function evaluateLeadQualitySet(leads = [], options = {}) {
  const results = (Array.isArray(leads) ? leads : []).map((lead) => evaluateLeadQuality(lead, options));
  const summary = results.reduce((acc, result) => {
    acc.total += 1;
    if (result.status === 'SHIP') acc.ship += 1;
    if (result.status === 'FOLLOW_UP') acc.followUp += 1;
    if (result.status === 'HOLD') acc.hold += 1;
    acc.averageScore += result.score;
    return acc;
  }, {
    total: 0,
    ship: 0,
    followUp: 0,
    hold: 0,
    averageScore: 0,
  });

  summary.averageScore = summary.total === 0 ? 0 : Math.round(summary.averageScore / summary.total);

  return {
    generatedAt: options.now || new Date().toISOString(),
    dimensions: DIMENSION_IDS,
    summary,
    results,
  };
}

function formatLeadQualityReport(report) {
  const lines = [
    'Lead quality evaluation',
    `Total: ${report.summary.total}`,
    `SHIP: ${report.summary.ship}`,
    `FOLLOW_UP: ${report.summary.followUp}`,
    `HOLD: ${report.summary.hold}`,
    `Average score: ${report.summary.averageScore}`,
    '',
  ];

  for (const result of report.results) {
    lines.push(`${result.status} ${result.score}/100 ${result.id || result.fixtureType || result.company || 'lead'}`);
    for (const action of result.actions) {
      lines.push(`- ${action}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  DIMENSION_IDS,
  DIMENSION_WEIGHTS,
  assertSyntheticLeadSet,
  evaluateLeadQuality,
  evaluateLeadQualitySet,
  formatLeadQualityReport,
};
