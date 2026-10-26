/**
 * Self-contained browser source for human feedback editing. Keep this as an
 * explicit fragment: serializing bundled functions with toString() can leak
 * Worker-only helpers (for example esbuild's keepNames __name) into the page.
 * Adapters are trusted page code, never lead/user data. Drafts remain in memory.
 */
export function getReviewerFeedbackControllerScript({ findLead, onSaved, onConflict }) {
  return `
function createReviewerFeedbackController({ findLead, normalizeFeedback, authHeaders, onSaved, onConflict }) {
  const drafts = new Map();
  const pendingWrites = new Map();
  const draftNotice = '저장 전 · 초안은 이 페이지에서만 보관됩니다.';

  function collect(section) {
    const payload = {};
    if (section) section.querySelectorAll('[data-feedback-field]').forEach((field) => {
      payload[field.dataset.feedbackField] = field.value || '';
    });
    return payload;
  }

  function remember(section) {
    const leadId = section.dataset.feedbackLeadId;
    const lead = findLead(leadId);
    if (!lead) return;
    const payload = collect(section);
    const saved = normalizeFeedback(lead);
    // An in-flight write can replace the saved baseline. Returning to that
    // baseline is still a new edit, so retain its distinct draft identity.
    const changed = pendingWrites.has(leadId)
      || Object.keys(payload).some((key) => payload[key] !== saved[key]);
    if (changed) drafts.set(leadId, { payload });
    else drafts.delete(leadId);
    const notice = section.querySelector('[data-feedback-draft-state]');
    const summary = section.querySelector('[data-reviewer-feedback-summary-state]');
    if (notice) notice.textContent = changed ? draftNotice : '';
    if (summary) summary.textContent = changed ? '저장 전' : saved.hasFeedback ? '저장됨' : '비어 있음';
  }

  function trackWrite(leadId, change) {
    const count = (pendingWrites.get(leadId) || 0) + change;
    if (count > 0) pendingWrites.set(leadId, count);
    else pendingWrites.delete(leadId);
  }

  async function mutate(leadId, payload, button, operation) {
    if (!leadId) return;
    const submittedDraft = drafts.get(leadId);
    const current = findLead(leadId);
    if (button) button.disabled = true;
    trackWrite(leadId, 1);
    try {
      const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reviewerFeedback: payload, expectedVersion: current && current.version })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data.code === 'LEAD_VERSION_CONFLICT') {
          await onConflict(leadId);
          return;
        }
        alert(data.message || '리뷰어 피드백 ' + operation + ' 실패');
        return;
      }
      const lead = findLead(leadId);
      if (data.lead && lead) Object.assign(lead, data.lead);
      if (drafts.get(leadId) === submittedDraft) drafts.delete(leadId);
      onSaved(leadId);
    } catch (error) {
      alert('리뷰어 피드백 ' + operation + ' 실패: ' + error.message);
    } finally {
      trackWrite(leadId, -1);
      if (button) button.disabled = false;
    }
  }

  return {
    drafts,
    remember,
    save(leadId, section, button) {
      if (!section || !leadId) return;
      return mutate(leadId, collect(section), button, '저장');
    },
    clear(leadId, button) {
      if (!leadId || !window.confirm('저장된 리뷰어 피드백을 지울까요? 메타데이터 이력은 본문 없이 남습니다.')) return;
      return mutate(leadId, { clear: true }, button, '지우기');
    }
  };
}

    const reviewerFeedbackController = createReviewerFeedbackController({
      findLead: ${findLead}, normalizeFeedback: normalizeReviewerFeedback, authHeaders,
      onSaved: ${onSaved}, onConflict: ${onConflict}
    });
    const reviewerFeedbackDrafts = reviewerFeedbackController.drafts;
    function rememberReviewerFeedbackDraft(section) { reviewerFeedbackController.remember(section); }
  `;
}
