/**
 * Self-contained browser source for human feedback editing. Keep this as an
 * explicit fragment: serializing bundled functions with toString() can leak
 * Worker-only helpers (for example esbuild's keepNames __name) into the page.
 * Adapters are trusted page code, never lead/user data. Drafts remain in memory.
 */
export function getReviewerFeedbackControllerScript({ findLead, onSaved, onConflict, onDenied }) {
  return `
function createReviewerFeedbackController({ findLead, normalizeFeedback, authHeaders, onSaved, onConflict, onDenied }) {
  const drafts = new Map();
  const pendingWrites = new Map();
  const notices = new Map();
  let accessEpoch = 0;
  function setNotice(leadId, message) {
    notices.set(leadId, message);
    document.querySelectorAll('[data-feedback-lead-id]').forEach(section => {
      if (section.dataset.feedbackLeadId !== leadId) return;
      const el = section.querySelector('[data-feedback-draft-state]');
      if (el) el.textContent = message;
    });
  }
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
    notices.delete(leadId);
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
    const epoch = accessEpoch;
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
      if (epoch !== accessEpoch) return;
      if (res.status === 401 || res.status === 403 || data.manualReviewNotesAccess && data.manualReviewNotesAccess.manualNotesRead !== true) {
        reset(); await onDenied(); return;
      }
      if (!res.ok || !data.success) {
        if (data.code === 'LEAD_VERSION_CONFLICT') {
          setNotice(leadId, '저장 전 · 충돌: 최신 리드를 확인하고 저장 버튼으로 다시 시도하세요. 자동 재시도하지 않습니다.');
          await onConflict(leadId);
          return;
        }
        setNotice(leadId, '저장 전 · 피드백 ' + operation + ' 실패. 입력은 유지됩니다. 다시 시도하세요.');
        return;
      }
      const lead = findLead(leadId);
      if (data.lead && lead) Object.assign(lead, data.lead);
      if (drafts.get(leadId) === submittedDraft) drafts.delete(leadId);
      notices.delete(leadId);
      onSaved(leadId);
    } catch (error) {
      if (epoch === accessEpoch) setNotice(leadId, '저장 전 · 피드백 ' + operation + ' 또는 새로고침 실패. 입력은 유지됩니다. 다시 시도하세요.');
    } finally {
      if (epoch === accessEpoch) trackWrite(leadId, -1);
      if (button) button.disabled = false;
    }
  }

  function reset() { accessEpoch++; drafts.clear(); notices.clear(); pendingWrites.clear(); }
  return {
    drafts, reset,
    hasUnsaved: () => drafts.size > 0 || pendingWrites.size > 0,
    notice: leadId => notices.get(leadId) || (drafts.has(leadId) ? draftNotice : ''),
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
      onSaved: ${onSaved}, onConflict: ${onConflict}, onDenied: ${onDenied || '() => {}'}
    });
    const reviewerFeedbackDrafts = reviewerFeedbackController.drafts;
    function rememberReviewerFeedbackDraft(section) { reviewerFeedbackController.remember(section); }
  `;
}
