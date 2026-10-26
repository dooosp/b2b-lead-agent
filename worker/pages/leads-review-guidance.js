/** Generated copy-only guidance is selected before page assembly. */
export function getLeadsReviewGuidanceScript(includeGeneratedReviewGuidance) {
  if (!includeGeneratedReviewGuidance) return `
    function normalizeReviewNoteData() { return { current: null, templates: [] }; }
    function renderReviewNoteSuggestion() { return ''; }
  `;
  return `    function summarizeReviewNoteEvidence(lead) {
      const evidence = getEvidenceItems(lead);
      const sources = getSources(lead);
      if (evidence.length > 0) {
        const quote = String(evidence[0].quote || '').trim() || 'direct evidence';
        const source = String(evidence[0].sourceUrl || evidence[0].source_url || (sources[0] && sources[0].url) || '').trim();
        return source ? '"' + quote + '" (' + source + ')' : '"' + quote + '"';
      }
      if (sources.length > 0) {
        return 'Source to review: ' + (sources[0].title || sources[0].url || 'published source');
      }
      return 'No direct evidence quote or published source is available.';
    }

    function summarizeReviewNoteList(items, fallback) {
      const normalized = (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean);
      return normalized.length > 0 ? normalized.slice(0, 3).join('; ') : fallback;
    }

    function buildFallbackReviewNoteTemplates(lead, summary = buildLeadActionIntelligenceSummary(lead)) {
      const company = lead.company || '리드';
      const product = lead.product || lead.recommendedProduct || lead.recommended_product || 'recommended solution';
      const why = lead.whyNow || lead.why_now || lead.signal || lead.summary || 'Lead context needs review.';
      const evidence = summarizeReviewNoteEvidence(lead);
      const gaps = summarizeReviewNoteList(getDataGaps(lead), 'No open data gaps in current LeadBrief.');
      const risks = summarizeReviewNoteList(summary.risks, 'No risk flags in current LeadBrief.');
      const missing = getDataGaps(lead).length > 0 ? gaps : risks;
      const followUpState = getDataGaps(lead).length > 0 ? 'DATA_GAP' : 'RISK_CHECK';
      const followUpLabel = followUpState === 'DATA_GAP' ? '데이터 공백 확인 노트' : '리스크 확인 노트';
      const labels = {
        APPROVED: '승인 노트',
        NEEDS_REVIEW: '검토 필요 노트',
        DATA_GAP: '데이터 공백 확인 노트',
        RISK_CHECK: '리스크 확인 노트'
      };
      const approved = {
        state: 'APPROVED',
        label: labels.APPROVED,
        text: [
          'Decision: APPROVED',
          'Lead: ' + company + ' | Product: ' + product,
          'Why: ' + why,
          'Evidence: ' + evidence,
          'Review basis: verification=' + getVerificationStatus(lead) + '; confidence=' + getConfidence(lead) + '; action=' + summary.action + '.',
          'Missing/risk check: ' + missing,
          'Next: use as an internal review note and personalize before any CRM log or outreach.'
        ].join('\\n')
      };
      const needsReview = {
        state: 'NEEDS_REVIEW',
        label: labels.NEEDS_REVIEW,
        text: [
          'Decision: NEEDS_REVIEW',
          'Lead: ' + company + ' | Product: ' + product,
          'Reason: ' + summary.action + ' - ' + summary.reason,
          'Evidence status: ' + evidence,
          'Missing: ' + missing,
          'Current state: reviewStatus=' + getReviewStatus(lead) + '; verification=' + getVerificationStatus(lead) + '; confidence=' + getConfidence(lead) + '.',
          'Next: keep reviewStatus=NEEDS_REVIEW until evidence, gaps, and reviewer decision are resolved.'
        ].join('\\n')
      };
      const followUp = {
        state: followUpState,
        label: followUpLabel,
        text: [
          'Follow-up check: ' + followUpState,
          'Lead: ' + company + ' | Product: ' + product,
          'Reason: ' + summary.action + ' - ' + summary.reason,
          'Evidence status: ' + evidence,
          'Open items: ' + (followUpState === 'DATA_GAP' ? gaps : risks),
          'Missing prompts: ' + missing,
          'Next: resolve this check before approval or follow-up; this does not save or send notes.'
        ].join('\\n')
      };
      const templates = [approved, needsReview, followUp];
      const currentState = summary.nextReviewAction === 'prepare_human_follow_up'
        ? 'APPROVED'
        : followUpState === 'DATA_GAP' || summary.risks.length > 0
          ? followUpState
          : getReviewStatus(lead) === 'APPROVED'
            ? 'APPROVED'
            : 'NEEDS_REVIEW';

      return {
        current: templates.find((template) => template.state === currentState) || needsReview,
        templates,
        labels
      };
    }
    function normalizeReviewNoteData(lead) {
      if (!canShowGeneratedReviewGuidance()) return { current: null, templates: [] };
      const item = getLeadQueueItem(lead);
      const fallback = buildFallbackReviewNoteTemplates(lead);
      const current = item.reviewNoteSuggestion && item.reviewNoteSuggestion.text
        ? item.reviewNoteSuggestion
        : fallback.current;
      const templates = Array.isArray(item.reviewNoteTemplates) && item.reviewNoteTemplates.length > 0
        ? item.reviewNoteTemplates
        : fallback.templates;
      return { current, templates };
    }

    function normalizeSummaryText(value, fallback = '') {
      const text = String(value || '').replace(/\\s+/g, ' ').trim();
      return text || fallback;
    }

    function truncateSummaryText(value, limit = 120) {
      const text = normalizeSummaryText(value);
      if (text.length <= limit) return text;
      return text.slice(0, Math.max(0, limit - 3)).trim() + '...';
    }

    function findReviewNoteLine(text, prefixes) {
      const lines = String(text || '').split(/\\n+/).map((line) => normalizeSummaryText(line)).filter(Boolean);
      return lines.find((line) => prefixes.some((prefix) => line.toLowerCase().startsWith(prefix.toLowerCase()))) || '';
    }

    function renderReviewNoteSummary(note = {}) {
      const text = note.text || '';
      const decision = findReviewNoteLine(text, ['Decision:', 'Follow-up check:']) || note.label || note.state || '검토 필요 노트';
      const lead = findReviewNoteLine(text, ['Lead:']);
      const reason = findReviewNoteLine(text, ['Reason:', 'Review basis:']);
      const evidence = findReviewNoteLine(text, ['Evidence status:', 'Evidence:']);
      const risk = findReviewNoteLine(text, ['Missing/risk check:', 'Open items:', 'Missing:', 'Missing prompts:']);
      const items = [decision, lead, reason, evidence || risk]
        .map((item) => truncateSummaryText(item, 96))
        .filter(Boolean)
        .slice(0, 4);
      const itemHtml = items.length > 0
        ? items.map((item) => \`<span>\${esc(item)}</span>\`).join('')
        : '<span>리뷰 노트 내용을 확인하세요.</span>';
      return \`
        <div class="review-note-summary" aria-label="검토 메모 제안 요약">
          <strong>검토 메모 제안 요약</strong>
          <div class="review-note-summary-items">\${itemHtml}</div>
          <p>생성된 제안은 복사 전용이며 자동 저장/전송되지 않습니다.</p>
        </div>
      \`;
    }

    function renderReviewNoteSuggestion(lead, options = {}) {
      if (!canShowGeneratedReviewGuidance()) return '';
      const noteData = normalizeReviewNoteData(lead || {});
      const current = noteData.current || {};
      const templates = noteData.templates || [];
      const variants = templates.map((template) => \`
        <details class="review-note-variant">
          <summary>\${esc(template.label || template.state)}</summary>
          \${renderReviewNoteSummary(template)}
          <pre class="review-note-copy-target" data-review-note-text tabindex="0" aria-label="\${esc(template.label || template.state)} 텍스트">\${esc(template.text || 'Review note suggestion unavailable.')}</pre>
          <div class="review-note-copy-actions">
            <button class="btn btn-secondary" type="button" data-note-copy-action="copy-variant-note" aria-label="\${esc(template.label || template.state)} 복사">복사</button>
          </div>
        </details>
      \`).join('');
      return \`
        <div class="review-note-suggestion \${options.compact ? 'is-compact' : ''}" aria-label="생성된 검토 메모 제안">
          <span class="block-label">생성된 검토 메모 제안</span>
          <div class="review-note-copy-head">
            <strong>\${esc(current.label || '검토 필요 노트')}</strong>
            <div class="review-note-copy-actions">
              <button class="btn btn-secondary" type="button" data-note-copy-action="copy-current-note" aria-label="현재 노트 복사">현재 노트 복사</button>
            </div>
          </div>
          \${renderReviewNoteSummary(current)}
          <pre class="review-note-copy-target" data-review-note-text tabindex="0" aria-label="현재 리뷰 노트 텍스트">\${esc(current.text || 'Review note suggestion unavailable. Confirm company, evidence, verification status, and data gaps before writing a review note.')}</pre>
          <p class="review-note-helper">사람이 저장한 메모가 아닙니다. 복사 후 사람이 직접 검토해 사용하세요.</p>
          <div class="review-note-variants" aria-label="review note variants">
            \${variants}
          </div>
        </div>
      \`;
    }

`;
}
