const {
  ENRICHMENT_FIXTURE_REPLAY_STATUS,
  buildEnrichmentFixtureReplayArtifact,
} = require('./enricher/enrichment-fixture-replay');
const {
  ARTIFACT_NAMES,
  composeLeadReport,
  mergeLeadHistory,
  prepareLeadSnapshotRecords,
} = require('./lead-report-publisher');
const {
  assertSyntheticLeadSet,
  evaluateLeadQualitySet,
} = require('./eval/lead-quality-evaluator');
const { createEvidencePacket } = require('./scripts/generate-release-evidence-packet');

const LEAD_PIPELINE_FIXTURE_REPLAY_STATUS =
  'LEAD_PIPELINE_FIXTURE_REPLAY_ARTIFACT_CONTRACT_NON_PRODUCTION';
const LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP = '2026-06-03T00:00:00.000Z';
const MAX_SNIPPET_CHARS = 160;

const ARTIFACT_FIELDS = Object.freeze([
  'sourceReplay',
  'syntheticArticles',
  'leadQuality',
  'report',
  'publication',
  'evidence',
  'redaction',
]);

const REDACTION_PROVES_ABSENT = Object.freeze([
  'raw_html',
  'raw_urls',
  'headers',
  'cookies',
  'tokens',
  'auth_like_values',
  'private_urls',
  'manual_notes',
  'generated_guidance',
  'customer_private_data',
]);

const CHECKED_ARTIFACT_SURFACES = Object.freeze([
  'lead_quality_inputs',
  'report_summary',
  'publication_latest',
  'publication_history',
  'release_evidence_packet',
]);

const SYNTHETIC_PROFILE = Object.freeze({
  id: 'danfoss',
  name: 'Danfoss',
});

function sanitizeText(value, maxLength = MAX_SNIPPET_CHARS) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/[^\s\])"'<>]+/gi, '[URL_LABEL_ONLY]')
    .replace(/\b(?:Authorization|Proxy-Authorization)\s*:\s*[^\r\n]+/gi, '[AUTH_LABEL_ONLY]')
    .replace(/\b(?:Cookie|Set-Cookie)\s*:\s*[^\r\n]+/gi, '[COOKIE_LABEL_ONLY]')
    .replace(/\b(?:token|api[_-]?key|secret|password|session|auth)\s*=\s*[^&\s]+/gi, '$1=[TOKEN_LABEL_ONLY]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[PII_LABEL_ONLY]')
    .replace(/ACME_PRIVATE_CUSTOMER|PRIVATE_CUSTOMER/gi, '[CUSTOMER_LABEL_ONLY]')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function slugCaseId(caseId = '') {
  return String(caseId || '')
    .replace(/_/g, '-');
}

function syntheticSourceUrl(label = '') {
  const slug = String(label || 'fixture-source')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://synthetic.example/lead-pipeline-replay/${slug || 'source'}`;
}

function successfulReplayEntries(enrichmentArtifact) {
  return (Array.isArray(enrichmentArtifact.replay) ? enrichmentArtifact.replay : [])
    .filter((entry) => entry && entry.outcome === 'success' && entry.body && entry.body.available);
}

function buildSyntheticArticles(enrichmentArtifact) {
  return successfulReplayEntries(enrichmentArtifact).map((entry, index) => {
    const sourceUrlLabel = entry.finalUrlLabel || entry.requestedUrlLabel || `fixture-source-${index + 1}`;
    const title = entry.caseId === 'success_safe_redirect'
      ? 'Fixture redirect cooling plant expansion'
      : 'Fixture refrigeration system upgrade';
    return {
      articleId: `A${index + 1}`,
      caseId: entry.caseId,
      title,
      sourceLabel: entry.sourceLabel,
      sourceUrlLabel,
      syntheticUrl: syntheticSourceUrl(sourceUrlLabel),
      publishedAt: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
      resolution: entry.resolution,
      redirected: Boolean(entry.redirected),
      bodyTrust: entry.body.trust,
      bodySource: entry.body.source,
      bodySnippet: sanitizeText(entry.body.snippet),
    };
  });
}

function buildSyntheticLead(article, index) {
  const isGradeA = index === 0;
  const caseSlug = slugCaseId(article.caseId);
  const company = isGradeA ? 'Fixture Cooling Systems' : 'Fixture Redirect Energy';
  const product = isGradeA ? 'Turbocor compressor' : 'VLT HVAC Drive';
  const summary = isGradeA
    ? 'Fixture cooling system upgrade reached local replay review readiness.'
    : 'Fixture redirected source confirmed safe replay provenance for HVAC review.';
  const whyNow = isGradeA
    ? 'The replayed trusted article body is available before fixture equipment scoping.'
    : 'The replayed safe redirect keeps provenance stable before fixture review.';
  const recommendedMessage = isGradeA
    ? 'Review the fixture cooling upgrade with a local-only efficiency proposal.'
    : 'Review the fixture HVAC redirect signal with a local-only provenance check.';

  return {
    id: `fixture-lead-${caseSlug}`,
    fixtureType: 'lead_pipeline_fixture_replay',
    fixtureCaseId: article.caseId,
    synthetic: true,
    company,
    summary,
    signal: summary,
    product,
    score: isGradeA ? 91 : 78,
    grade: isGradeA ? 'A' : 'B',
    roi: isGradeA
      ? 'Fixture-only efficiency range 20-30% pending reviewer confirmation.'
      : 'Fixture-only HVAC efficiency range 15-25% pending reviewer confirmation.',
    salesPitch: recommendedMessage,
    recommendedMessage,
    globalContext: 'Synthetic fixture replay context only; no production or customer evidence.',
    whyNow,
    urgencyReason: whyNow,
    sourceIds: [article.articleId],
    sources: [{
      sourceId: article.articleId,
      title: article.title,
      url: article.syntheticUrl,
      source: article.sourceUrlLabel,
      query: 'lead pipeline fixture replay',
      publishedAt: article.publishedAt,
      originUrl: article.syntheticUrl,
      resolution: article.resolution,
      contentAvailable: true,
    }],
    evidence: [{
      field: 'summary',
      quote: article.bodySnippet,
      sourceUrl: article.syntheticUrl,
    }],
    confidence: 'MEDIUM',
    confidenceReason: 'Synthetic fixture replay includes trusted body text and stable source labels.',
    assumptions: [
      'Fixture replay entries are synthetic and local-only.',
      'Reviewer must validate any real account fit before outreach.',
    ],
    dataGaps: [],
    reviewStatus: 'NEEDS_REVIEW',
    generationMode: 'heuristic',
    verificationStatus: 'needs_review',
    eventType: isGradeA ? 'fixture_replay_upgrade' : 'fixture_replay_redirect',
    sourceUrlLabel: article.sourceUrlLabel,
    notes: 'Manual note body must not enter artifacts.',
    manualReviewNotes: 'Manual review note body must not enter artifacts.',
    manual_review_notes: 'Snake manual note body must not enter artifacts.',
    manualReviewNotesAuthorLabel: 'manual_reviewer',
    reviewNoteSuggestion: {
      text: 'Generated suggestion must not enter artifacts.',
    },
    reviewNoteTemplates: [
      { text: 'Generated guidance must not enter artifacts.' },
    ],
    authHeader: 'Bearer raw-auth-like-value',
    token: 'raw-token-value',
  };
}

function buildSyntheticLeads(articles) {
  const leads = articles.map((article, index) => buildSyntheticLead(article, index));
  return assertSyntheticLeadSet(leads);
}

function summarizeLeadQualityInput(lead) {
  return {
    id: lead.id,
    caseId: lead.fixtureCaseId,
    company: lead.company,
    product: lead.product,
    confidence: lead.confidence,
    reviewStatus: lead.reviewStatus,
    verificationStatus: lead.verificationStatus,
    eventType: lead.eventType,
    sourceUrlLabel: lead.sourceUrlLabel || '',
    evidenceQuoteLength: lead.evidence[0]?.quote ? lead.evidence[0].quote.length : 0,
  };
}

function buildLeadQualityContract(leads) {
  const report = evaluateLeadQualitySet(leads, {
    now: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
    staleAfterDays: 30,
  });

  return {
    generatedAt: report.generatedAt,
    dimensions: report.dimensions,
    summary: report.summary,
    inputs: leads.map(summarizeLeadQualityInput),
    results: report.results.map((result) => ({
      id: result.id,
      fixtureType: result.fixtureType,
      company: result.company,
      product: result.product,
      score: result.score,
      status: result.status,
      reviewReady: result.reviewReady,
      actions: result.actions,
    })),
  };
}

function reportFieldPresence(leads) {
  return {
    company: leads.every((lead) => Boolean(lead.company)),
    summary: leads.every((lead) => Boolean(lead.summary)),
    product: leads.every((lead) => Boolean(lead.product)),
    roi: leads.every((lead) => Boolean(lead.roi)),
    salesPitch: leads.every((lead) => Boolean(lead.salesPitch)),
    globalContext: leads.every((lead) => Boolean(lead.globalContext)),
  };
}

function buildReportContract(leads) {
  const leadReport = composeLeadReport(leads, SYNTHETIC_PROFILE, {
    now: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
  });

  return {
    profileId: SYNTHETIC_PROFILE.id,
    profileName: SYNTHETIC_PROFILE.name,
    dateStr: leadReport.dateStr,
    gradeCounts: {
      A: leads.filter((lead) => lead.grade === 'A').length,
      B: leads.filter((lead) => lead.grade === 'B').length,
    },
    totalLeads: leads.length,
    fieldPresence: reportFieldPresence(leads),
  };
}

function publishedIdFactory(lead) {
  return `fixture-published-${slugCaseId(lead.fixtureCaseId)}`;
}

function summarizePublishedLead(record) {
  return {
    id: record.id,
    company: record.company,
    status: record.status,
    reviewStatus: record.reviewStatus,
    generationMode: record.generationMode,
    verificationStatus: record.verificationStatus,
    confidence: record.confidence,
    sourceUrlLabels: (Array.isArray(record.sources) ? record.sources : []).map((source) => source.source),
    dataGapCount: Array.isArray(record.dataGaps) ? record.dataGaps.length : 0,
    assumptionCount: Array.isArray(record.assumptions) ? record.assumptions.length : 0,
  };
}

function containsProtectedPublicationEvidence(value) {
  const serialized = JSON.stringify(value);
  return /Manual note body|manual_reviewer|Generated suggestion|Generated guidance|raw-auth-like-value|raw-token-value|reviewNoteSuggestion|reviewNoteTemplates|manualReviewNotes|manual_review_notes/.test(serialized);
}

function buildPublicationContract(leads) {
  const publicationLeads = leads.map(({ id, ...lead }) => lead);
  const latestLeadsRaw = prepareLeadSnapshotRecords(publicationLeads, {
    now: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
    profileId: SYNTHETIC_PROFILE.id,
    idFactory: publishedIdFactory,
  });
  const historyRaw = mergeLeadHistory([
    {
      id: 'stale-private-history',
      company: leads[0]?.company || 'Fixture Cooling Systems',
      summary: leads[0]?.summary || 'Fixture stale history',
      notes: 'Manual note body must not remain in history.',
      manualReviewNotesAuthorLabel: 'manual_reviewer',
      reviewNoteSuggestion: { text: 'Generated suggestion must not remain in history.' },
      token: 'raw-token-value',
    },
  ], publicationLeads, {
    now: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
    profileId: SYNTHETIC_PROFILE.id,
  });
  const latestLeads = latestLeadsRaw.map(summarizePublishedLead);
  const history = historyRaw.map(summarizePublishedLead);

  return {
    artifactNames: {
      markdownCanonical: ARTIFACT_NAMES.markdownCanonical('2026-06-03'),
      latestCanonical: ARTIFACT_NAMES.latestCanonical,
      historyCanonical: ARTIFACT_NAMES.historyCanonical,
    },
    latestLeads,
    historyLeadCount: history.length,
    historyProtectedFieldsRemoved: !containsProtectedPublicationEvidence(historyRaw),
  };
}

function buildEvidenceContract() {
  const packet = createEvidencePacket({
    status: 'SHIP',
    generatedAtUtc: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
    title: 'Lead pipeline fixture replay artifact contract',
    repo: {
      name: 'dooosp/b2b-lead-agent',
      branch: 'codex/lead-pipeline-fixture-replay-artifact-contract',
      headSha: 'LOCAL_ONLY_NON_PRODUCTION_REPLAY',
    },
    validations: [
      {
        command: 'npm run check:lead-pipeline-replay',
        source: 'local',
        status: 'pass',
        summary: 'Synthetic fixture replay to lead/report/publication/evidence artifact contract.',
      },
    ],
  }, {
    generatedAtUtc: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
  });

  return {
    packet: {
      status: packet.status,
      mode: packet.mode,
      generatedAtUtc: packet.generatedAtUtc,
      sourceBoundary: packet.sourceBoundary,
      boundaries: packet.boundaries,
      claims: packet.claims,
      warnings: packet.warnings,
      validations: packet.validations,
      invalidProductionEvidence: packet.invalidProductionEvidence,
    },
  };
}

function buildSourceReplayContract(enrichmentArtifact) {
  return {
    documentStatus: ENRICHMENT_FIXTURE_REPLAY_STATUS,
    generatedAt: enrichmentArtifact.generatedAt,
    caseOrder: enrichmentArtifact.outputContract.deterministicOrdering,
    successCaseIds: enrichmentArtifact.replay
      .filter((entry) => entry.outcome === 'success')
      .map((entry) => entry.caseId),
    failureTaxonomy: enrichmentArtifact.outputContract.failureTaxonomy,
    sourceLabels: enrichmentArtifact.outputContract.sourceLabels,
    liveNetworkCalls: enrichmentArtifact.summary.liveNetworkCalls,
    maxSnippetChars: enrichmentArtifact.summary.maxSnippetChars,
  };
}

function buildRedactionContract() {
  return {
    provesAbsent: [...REDACTION_PROVES_ABSENT],
    checkedArtifactSurfaces: [...CHECKED_ARTIFACT_SURFACES],
    sourceUrlPolicy: 'labels_only_in_serialized_artifacts',
    fixtureInputs: 'synthetic_only',
  };
}

async function runLeadPipelineFixtureReplay(input = {}) {
  const enrichmentArtifact = input.enrichmentArtifact || await buildEnrichmentFixtureReplayArtifact({
    generatedAt: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
  });
  const syntheticArticles = buildSyntheticArticles(enrichmentArtifact);
  const syntheticLeads = buildSyntheticLeads(syntheticArticles);

  return {
    sourceReplay: buildSourceReplayContract(enrichmentArtifact),
    syntheticArticles: syntheticArticles.map((article) => ({
      articleId: article.articleId,
      caseId: article.caseId,
      title: article.title,
      sourceLabel: article.sourceLabel,
      sourceUrlLabel: article.sourceUrlLabel,
      publishedAt: article.publishedAt,
      resolution: article.resolution,
      redirected: article.redirected,
      bodyTrust: article.bodyTrust,
      bodySource: article.bodySource,
      bodySnippet: article.bodySnippet,
    })),
    leadQuality: buildLeadQualityContract(syntheticLeads),
    report: buildReportContract(syntheticLeads),
    publication: buildPublicationContract(syntheticLeads),
    evidence: buildEvidenceContract(),
    redaction: buildRedactionContract(),
  };
}

async function buildLeadPipelineFixtureReplayArtifact(input = {}) {
  const sections = await runLeadPipelineFixtureReplay(input);

  return {
    documentStatus: LEAD_PIPELINE_FIXTURE_REPLAY_STATUS,
    generatedAt: input.generatedAt || LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
    repo: 'dooosp/b2b-lead-agent',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issueRefs: {
      level1ProofHold: 'Issue #165',
    },
    summary: {
      replayCases: sections.sourceReplay.caseOrder.length,
      successReplayCases: sections.sourceReplay.successCaseIds.length,
      failureReplayCases: sections.sourceReplay.caseOrder.length - sections.sourceReplay.successCaseIds.length,
      syntheticArticles: sections.syntheticArticles.length,
      syntheticLeads: sections.leadQuality.inputs.length,
      leadQualityResults: sections.leadQuality.results.length,
      liveNetworkCalls: sections.sourceReplay.liveNetworkCalls,
      llmCalls: 0,
      crmCalls: 0,
      d1Calls: 0,
    },
    transport: {
      localFixtureOnly: true,
      liveNetworkAllowed: false,
      liveNetworkCalls: 0,
      fixtureTransport: 'in-memory',
    },
    outputContract: {
      artifactFields: [...ARTIFACT_FIELDS],
      deterministicOrdering: sections.sourceReplay.caseOrder,
      stableTimestamp: LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
      sourceUrlPolicy: 'labels_only_in_serialized_artifacts',
    },
    ...sections,
    nonClaims: [
      'This artifact is not production proof.',
      'This artifact uses only synthetic local fixtures.',
      'This artifact does not deploy, access D1, call endpoints, read logs or secrets, use customer or private data, touch CRM, send outreach, call LLMs, run automation, or claim production readiness.',
    ],
  };
}

module.exports = {
  LEAD_PIPELINE_FIXTURE_REPLAY_STATUS,
  LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
  buildLeadPipelineFixtureReplayArtifact,
  runLeadPipelineFixtureReplay,
};
