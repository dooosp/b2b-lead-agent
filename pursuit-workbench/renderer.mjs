import { ClaimValidationError } from '../knowledge/claim-registry/index.mjs';
import { assertValidatedPursuitWorkbenchViewModel } from './domain/view-model.mjs';
import { REVIEW_ACKNOWLEDGEMENT_TEXT } from './domain/review-packet.mjs';

export const WORKBENCH_HTML_MAX_BYTES = 768 * 1024;

export function escapeWorkbenchHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function humanize(value) {
  return String(value || '').replaceAll('_', ' ').toLowerCase().replace(/^\w|\s\w/g, (part) => part.toUpperCase());
}

function renderIdList(ids, empty = 'None') {
  if (!ids?.length) return `<span class="muted">${escapeWorkbenchHtml(empty)}</span>`;
  return `<ul class="id-list">${ids.map((id) => `<li><code>${escapeWorkbenchHtml(id)}</code></li>`).join('')}</ul>`;
}

function renderCodeList(codes, empty = 'None') {
  if (!codes?.length) return `<span class="muted">${escapeWorkbenchHtml(empty)}</span>`;
  return `<ul class="code-list">${codes.map((code) => `<li><code>${escapeWorkbenchHtml(code)}</code></li>`).join('')}</ul>`;
}

function renderScenarioNavigation(scenarios, selectedId) {
  const options = scenarios.map((scenario) => `<option value="${escapeWorkbenchHtml(scenario.id)}"${scenario.id === selectedId ? ' selected' : ''}>${escapeWorkbenchHtml(scenario.title)}</option>`).join('');
  return `<nav class="scenario-nav" aria-label="Synthetic scenario control">
    <label for="scenario-select">Synthetic scenario</label>
    <div class="control-row">
      <select id="scenario-select" autocomplete="off">${options}</select>
      <button id="scenario-load" type="button">Load scenario</button>
    </div>
  </nav>`;
}

function renderTimeline(events) {
  return `<ol class="timeline-list">${events.map((event) => `<li class="timeline-event state-${escapeWorkbenchHtml(event.eventClass.toLowerCase())}">
    <div class="timeline-meta"><span class="event-class">${escapeWorkbenchHtml(humanize(event.eventClass))}</span><time datetime="${escapeWorkbenchHtml(event.occurredAt)}">${escapeWorkbenchHtml(event.occurredAt.slice(0, 10))}</time></div>
    <h3>${escapeWorkbenchHtml(event.title)}</h3>
    <p>${escapeWorkbenchHtml(event.summary)}</p>
    <dl class="compact-details">
      <div><dt>Event type</dt><dd><code>${escapeWorkbenchHtml(event.eventType)}</code></dd></div>
      <div><dt>Claims</dt><dd>${renderIdList(event.claimIds)}</dd></div>
      <div><dt>Requirements</dt><dd>${renderIdList(event.requirementIds)}</dd></div>
      <div><dt>Product families</dt><dd>${renderIdList(event.productFamilyIds)}</dd></div>
      <div><dt>Reason codes</dt><dd>${renderCodeList(event.reasonCodes)}</dd></div>
      ${event.state ? `<div><dt>Derived state</dt><dd>${escapeWorkbenchHtml(event.state.dimension)}: ${escapeWorkbenchHtml(event.state.before ?? 'not previously evaluated')} → <strong>${escapeWorkbenchHtml(event.state.after)}</strong></dd></div>` : ''}
    </dl>
  </li>`).join('')}</ol>`;
}

function renderRequirementDetails(items, empty) {
  if (!items.length) return `<p class="empty-state">${escapeWorkbenchHtml(empty)}</p>`;
  return `<ul class="requirement-list">${items.map((item) => `<li>
    <strong><code>${escapeWorkbenchHtml(item.requirementId)}</code></strong>
    <span>${escapeWorkbenchHtml(item.operator)} ${escapeWorkbenchHtml(item.requiredValue)}</span>
    <span>Project: ${escapeWorkbenchHtml(item.projectValues.join(', ') || 'UNKNOWN')}</span>
    <span>Capability: ${escapeWorkbenchHtml(item.capabilityValues.join(', ') || 'UNKNOWN')}</span>
    ${renderCodeList(item.reasonCodes)}
  </li>`).join('')}</ul>`;
}

function renderFitMatrix(rows) {
  if (!rows.length) return '<p class="empty-state">No product family was evaluated. Result: NOT_EVALUATED.</p>';
  const tableRows = rows.map((row) => `<tr>
    <th scope="row"><span lang="ko">${escapeWorkbenchHtml(row.productFamily.displayNameKo)}</span><br><span>${escapeWorkbenchHtml(row.productFamily.displayNameEn)}</span><br><code>${escapeWorkbenchHtml(row.productFamily.id)}</code></th>
    <td><span class="state-chip state-${escapeWorkbenchHtml(row.result.toLowerCase())}">${escapeWorkbenchHtml(row.result)}</span></td>
    <td><strong>${escapeWorkbenchHtml(row.specificationWindow.state)}</strong>${renderCodeList(row.specificationWindow.reasonCodes)}</td>
    <td>${renderRequirementDetails(row.hardMatches, 'No verified hard match.')}</td>
    <td>${renderRequirementDetails(row.hardMismatches, 'No verified hard mismatch.')}</td>
    <td>${row.missingRequirements.length ? renderIdList(row.missingRequirements.map((item) => item.requirementId)) : '<span class="muted">None</span>'}</td>
    <td>${renderCodeList(row.reasonCodes)}</td>
    <td>${row.projectClaimCount} project / ${row.capabilityClaimCount} capability</td>
  </tr>`).join('');
  return `<div class="table-scroll" tabindex="0" aria-label="Specification fit matrix scroll area">
    <table>
      <caption>Specification Fit Matrix — fit and evidence state remain separate</caption>
      <thead><tr><th scope="col">Product family</th><th scope="col">Fit result</th><th scope="col">Specification window</th><th scope="col">Hard matches</th><th scope="col">Hard mismatches</th><th scope="col">Missing requirements</th><th scope="col">Reason codes</th><th scope="col">Claim traces</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>`;
}

function renderBlockingItems(viewModel) {
  return `<div class="three-column">
    <article><h3>Hard mismatches</h3>${renderRequirementDetails(viewModel.hardMismatches, 'No verified hard mismatch in this scenario.')}</article>
    <article><h3>Missing technical requirements</h3>${viewModel.missingRequirements.length ? `<ul>${viewModel.missingRequirements.map((item) => `<li><code>${escapeWorkbenchHtml(item.requirementId)}</code> — ${escapeWorkbenchHtml(item.criticality)} — ${escapeWorkbenchHtml(item.expectedValue)}</li>`).join('')}</ul>` : '<p class="empty-state">No missing technical requirement.</p>'}</article>
    <article><h3>Conflicting evidence</h3>${viewModel.conflicts.length ? `<ul>${viewModel.conflicts.map((item) => `<li><code>${escapeWorkbenchHtml(item.claimId)}</code> conflicts with ${item.conflictClaimIds.map((id) => `<code>${escapeWorkbenchHtml(id)}</code>`).join(', ')}</li>`).join('')}</ul>` : '<p class="empty-state">No unresolved claim conflict.</p>'}</article>
  </div>`;
}

function renderClaims(viewModel) {
  const allowed = viewModel.allowedClaims.length ? `<ul class="claim-list">${viewModel.allowedClaims.map((claim) => `<li>
    <h3>Customer-use ALLOWED <code>${escapeWorkbenchHtml(claim.claimId)}</code></h3>
    <p><strong>Verified customer-use source metadata and direct quote are shown for this synthetic scenario.</strong></p>
    <dl class="compact-details">
      <div><dt>Source title</dt><dd>${escapeWorkbenchHtml(claim.sourceTitle)}</dd></div>
      <div><dt>Safe URL (not fetched)</dt><dd><code>${escapeWorkbenchHtml(claim.sourceUrl)}</code></dd></div>
      <div><dt>Direct quote</dt><dd><q>${escapeWorkbenchHtml(claim.directQuote)}</q></dd></div>
      <div><dt>Verified</dt><dd>${escapeWorkbenchHtml(claim.verifiedAt)}</dd></div>
      <div><dt>Applicability</dt><dd>${escapeWorkbenchHtml(claim.applicability)}</dd></div>
    </dl>
  </li>`).join('')}</ul>` : '<p class="empty-state">No customer-use ALLOWED claim.</p>';
  const blocked = viewModel.blockedClaims.length ? `<ul class="claim-list blocked-list">${viewModel.blockedClaims.map((claim) => `<li>
    <h3>Customer-use BLOCKED <code>${escapeWorkbenchHtml(claim.claimId)}</code></h3>
    <p><strong>Statement, quote, source title, and URL intentionally withheld.</strong></p>
    <p>Reason codes: ${claim.reasonCodes.map((code) => `<code>${escapeWorkbenchHtml(code)}</code>`).join(', ')}</p>
    <p>Source location: <code>${escapeWorkbenchHtml(claim.sourceLocation)}</code></p>
    <p>Remediation: ${escapeWorkbenchHtml(claim.remediation)}</p>
  </li>`).join('')}</ul>` : '<p class="empty-state">No customer-use BLOCKED claim.</p>';
  return `<div class="two-column"><article><h3>Customer-use allowed</h3>${allowed}</article><article><h3>Blocked metadata only</h3>${blocked}</article></div>`;
}

function renderQuestionFieldset(questions, firstFamilyId) {
  if (!questions.length) return '<fieldset><legend>Technical questions</legend><p class="empty-state">No dossier-supported technical question for this scenario.</p></fieldset>';
  return `<fieldset id="question-fieldset"><legend>Technical questions for the next internal review</legend>
    <p class="field-help">Questions request technical evidence. They are not outreach messages.</p>
    ${questions.map((question) => `<label class="choice-card" data-review-families="${escapeWorkbenchHtml(question.productFamilyIds.join(' '))}"${question.productFamilyIds.includes(firstFamilyId) ? '' : ' hidden'}><input type="checkbox" name="question" value="${escapeWorkbenchHtml(question.questionId)}"${question.productFamilyIds.includes(firstFamilyId) ? '' : ' disabled'}>
      <span><strong>${escapeWorkbenchHtml(question.text)}</strong><br>
      Artifact: <code>${escapeWorkbenchHtml(question.requestedArtifact)}</code> · Owner role: <code>${escapeWorkbenchHtml(question.ownerRole)}</code> · Requirement: <code>${escapeWorkbenchHtml(question.requirementId)}</code> · Action: <code>${escapeWorkbenchHtml(question.actionCode)}</code> · State: ${escapeWorkbenchHtml(question.blockingState)}</span>
    </label>`).join('')}<p id="question-empty" class="empty-state"${questions.some((question) => question.productFamilyIds.includes(firstFamilyId)) ? ' hidden' : ''}>No technical question applies to the selected product family.</p>
  </fieldset>`;
}

function renderReviewForm(viewModel) {
  const families = viewModel.fitMatrix.map((row) => row.productFamily);
  const firstFamilyId = families[0]?.id || '';
  const supportedPolicies = viewModel.reviewPolicy.families.flatMap((family) => family.dispositions
    .filter((item) => item.supported)
    .map((item) => ({ productFamilyId: family.productFamilyId, ...item })));
  const familyChoices = families.length ? families.map((family, index) => `<label class="choice-card"><input type="radio" name="productFamily" value="${escapeWorkbenchHtml(family.id)}"${index === 0 ? ' checked' : ''}><span>${escapeWorkbenchHtml(family.displayNameEn)} <code>${escapeWorkbenchHtml(family.id)}</code></span></label>`).join('') : '<p class="empty-state">No product family is available for a disposition packet.</p>';
  const dispositionChoices = supportedPolicies.map((policy) => `<label class="choice-card" data-review-family="${escapeWorkbenchHtml(policy.productFamilyId)}"${policy.productFamilyId === firstFamilyId ? '' : ' hidden'}><input type="radio" name="disposition" value="${escapeWorkbenchHtml(policy.value)}"${policy.productFamilyId === firstFamilyId ? '' : ' disabled'}><span>${escapeWorkbenchHtml(humanize(policy.value))}<br><code>${escapeWorkbenchHtml(policy.value)}</code></span></label>`).join('');
  const reasonChoices = supportedPolicies.flatMap((policy) => policy.reasonCodes.map((code) => `<label class="choice-card" data-review-family="${escapeWorkbenchHtml(policy.productFamilyId)}" data-review-disposition="${escapeWorkbenchHtml(policy.value)}" hidden><input type="checkbox" name="reason" value="${escapeWorkbenchHtml(code)}" disabled><code>${escapeWorkbenchHtml(code)}</code></label>`)).join('');
  return `<form id="review-form" autocomplete="off" novalidate>
    <section aria-labelledby="questions-heading"><h2 id="questions-heading">Recommended Technical Questions</h2>${renderQuestionFieldset(viewModel.technicalQuestions, firstFamilyId)}</section>
    <section aria-labelledby="review-heading"><h2 id="review-heading">Structured Technical-review Disposition</h2>
      <p class="boundary-note">Current page memory only: not saved, not sent, no reviewer identity collected, and no history retained.</p>
      <div id="review-errors" class="error-summary" role="alert" tabindex="-1" hidden></div>
      <fieldset id="family-fieldset"><legend>Product family under review</legend>${familyChoices}</fieldset>
      <fieldset id="disposition-fieldset"><legend>Dossier-supported technical-review dispositions for the selected family</legend>
        ${dispositionChoices || '<p class="empty-state">No disposition is supported for this scenario.</p>'}
      </fieldset>
      <fieldset id="reason-fieldset"><legend>Reason codes for the selected disposition</legend>
        ${reasonChoices}<p id="reason-empty" class="empty-state">Select a supported disposition to see its exact reason codes.</p>
      </fieldset>
      <fieldset><legend>Required boundary acknowledgement</legend>
        <label class="choice-card"><input id="review-acknowledgement" type="checkbox" name="acknowledgement"><span>${escapeWorkbenchHtml(REVIEW_ACKNOWLEDGEMENT_TEXT)}</span></label>
      </fieldset>
      <div class="action-row"><button id="packet-create" type="button"${families.length ? '' : ' disabled'}>Create structured review packet</button></div>
      <section id="packet-section" aria-labelledby="packet-heading" hidden>
        <h3 id="packet-heading">Unsigned local review packet</h3>
        <p>This export is not saved or transmitted by the Workbench.</p>
        <textarea id="packet-preview" rows="20" readonly aria-label="Structured review packet JSON"></textarea>
        <div class="action-row"><button id="packet-copy" type="button" disabled>Copy review packet JSON</button><button id="packet-download" type="button" disabled>Download review packet JSON</button></div>
      </section>
    </section>
  </form>`;
}

function documentShell({ title, bodyAttributes = '', navigation, main, status = '' }) {
  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeWorkbenchHtml(title)}</title>
  <link rel="stylesheet" href="/assets/pursuit-workbench.css">
  <script type="module" src="/assets/pursuit-workbench.js"></script>
</head><body ${bodyAttributes}>
  <a class="skip-link" href="#workbench-main">Skip to Workbench</a>
  <header class="site-header"><div><p class="eyebrow">Evidence-first Industrial Specification Opportunity Copilot</p><p class="site-title">Data Center Pursuit Workbench v0</p></div>${navigation}</header>
  ${main}
  <div id="workbench-status" class="sr-status" role="status" aria-live="polite" aria-atomic="true">${escapeWorkbenchHtml(status)}</div>
</body></html>`;
}

export function renderPursuitWorkbenchPage(viewModel, scenarios) {
  assertValidatedPursuitWorkbenchViewModel(viewModel);
  if (!Array.isArray(scenarios) || scenarios.some((scenario) => typeof scenario.id !== 'string' || typeof scenario.title !== 'string')) {
    throw new ClaimValidationError('WORKBENCH_SCENARIO_LIST_INVALID', '$.scenarios');
  }
  const summary = viewModel.technicalPursuitSummary;
  const main = `<main id="workbench-main" aria-labelledby="scenario-heading">
    <section class="boundary-banner" aria-label="Local synthetic boundary">
      <strong>LOCAL / SYNTHETIC / NOT PRODUCTION EVIDENCE</strong>
      <span>Issue #165: HOLD · productionReady: false · productionReviewerWorkflowReady: false · persistence: NONE</span>
      <span>Final commercial decision not made. No CRM update or outreach approval.</span>
    </section>
    <section class="hero" aria-labelledby="scenario-heading">
      <p class="eyebrow">${escapeWorkbenchHtml(viewModel.scenario.title)}</p>
      <h1 id="scenario-heading" tabindex="-1">${escapeWorkbenchHtml(viewModel.project.projectDisplayName)}</h1>
      <p>${escapeWorkbenchHtml(viewModel.scenario.description)}</p>
      <dl class="identity-grid">
        <div><dt>Account</dt><dd>${escapeWorkbenchHtml(viewModel.project.accountDisplayName)}</dd></div>
        <div><dt>Facility</dt><dd>${escapeWorkbenchHtml(viewModel.project.facilityDisplayName)}</dd></div>
        <div><dt>Jurisdiction</dt><dd>${escapeWorkbenchHtml(viewModel.project.jurisdiction)}</dd></div>
        <div><dt>Opportunity ID</dt><dd><code>${escapeWorkbenchHtml(viewModel.project.opportunityId)}</code></dd></div>
        <div><dt>Dossier hash</dt><dd><code title="${escapeWorkbenchHtml(viewModel.artifactHashes.dossierJsonSha256)}">${escapeWorkbenchHtml(viewModel.artifactHashes.dossierJsonSha256.slice(0, 12))}</code></dd></div>
        <div><dt>Controlled as of</dt><dd>${escapeWorkbenchHtml(viewModel.asOf)}</dd></div>
      </dl>
    </section>
    <section aria-labelledby="summary-heading"><h2 id="summary-heading">Technical Pursuit Summary</h2>
      <div class="summary-grid">
        <article><h3>Supported project stage</h3><strong>${escapeWorkbenchHtml(viewModel.projectStage.value)}</strong><p>${viewModel.projectStage.claimIds.length ? `${viewModel.projectStage.claimIds.length} claim trace(s)` : 'No stage claim trace'}</p></article>
        <article><h3>Technical pursuit state</h3><strong>${escapeWorkbenchHtml(summary.technicalPursuitState)}</strong><p>Not a commercial decision</p></article>
        <article><h3>Specification window</h3><strong>${escapeWorkbenchHtml(summary.overallSpecificationWindow)}</strong><p>Fit and timing are separate</p></article>
        <article><h3>Family results</h3><strong>${summary.fitFamilyCount} FIT · ${summary.notFitFamilyCount} NOT_FIT</strong><p>${summary.conditionalFitFamilyCount} conditional · ${summary.insufficientEvidenceFamilyCount} insufficient · ${summary.notEvaluatedFamilyCount} not evaluated</p></article>
        <article><h3>Blocking gaps</h3><strong>${summary.missingBlockingRequirementCount}</strong><p>${summary.conflictedClaimCount} conflicted claim set(s)</p></article>
        <article><h3>Next supported disposition</h3><strong>${escapeWorkbenchHtml(summary.nextTechnicalAction)}</strong><p>Internal technical review only</p></article>
      </div>
    </section>
    <section aria-labelledby="fit-heading"><h2 id="fit-heading">Specification Fit Matrix</h2><p>${escapeWorkbenchHtml(viewModel.productMappingDisclaimer)}</p>${renderFitMatrix(viewModel.fitMatrix)}</section>
    <section aria-labelledby="blocking-heading"><h2 id="blocking-heading">Mismatch, Gap, and Conflict Review</h2>${renderBlockingItems(viewModel)}</section>
    <section aria-labelledby="timeline-heading"><h2 id="timeline-heading">Project Signal Timeline</h2><p>Evidence events are source facts; derived events are recomputed conclusions.</p>${renderTimeline(viewModel.timeline)}</section>
    <section aria-labelledby="claims-heading"><h2 id="claims-heading">Claim Review Boundary</h2>${renderClaims(viewModel)}</section>
    ${renderReviewForm(viewModel)}
    <section aria-labelledby="nonclaims-heading"><h2 id="nonclaims-heading">Explicit Non-claims</h2><ul>${viewModel.explicitNonClaims.map((item) => `<li>${escapeWorkbenchHtml(item)}</li>`).join('')}</ul></section>
  </main>`;
  const html = documentShell({
    title: `${viewModel.scenario.title} — Data Center Pursuit Workbench v0`,
    bodyAttributes: `data-scenario-id="${escapeWorkbenchHtml(viewModel.scenario.id)}"`,
    navigation: renderScenarioNavigation(scenarios, viewModel.scenario.id),
    main
  });
  if (Buffer.byteLength(html, 'utf8') > WORKBENCH_HTML_MAX_BYTES) throw new ClaimValidationError('WORKBENCH_HTML_TOO_LARGE', '$.html');
  return html;
}

export function renderPursuitWorkbenchErrorPage(scenarios, statusCode = 500) {
  const navigation = renderScenarioNavigation(scenarios, '');
  const main = `<main id="workbench-main" aria-labelledby="error-heading"><section class="boundary-banner"><strong>LOCAL / SYNTHETIC / NOT PRODUCTION EVIDENCE</strong><span>Issue #165 remains HOLD.</span></section><section><h1 id="error-heading" tabindex="-1">Workbench scenario unavailable</h1><div id="load-error" class="error-summary" role="alert" tabindex="-1">The allowlisted synthetic scenario could not be recomputed safely. No prior scenario data or review packet is available.</div><p>Status: ${escapeWorkbenchHtml(statusCode)}</p></section></main>`;
  return documentShell({ title: 'Scenario unavailable — Data Center Pursuit Workbench v0', bodyAttributes: 'data-load-error="true"', navigation, main });
}
