/** Human note and feedback controls; only accepted lead state is labelled saved. */
export function getLeadsFeedbackViewScript(includeGeneratedReviewGuidance) {
  const generatedNoteLabel = includeGeneratedReviewGuidance ? '생성된 검토 메모 제안' : '복사 전용 검토 도우미';
  return `    function getManualReviewNoteValue(lead) {
      return String((lead && (lead.manualReviewNotes || lead.manual_review_notes || lead.notes)) || '').trim();
    }

    function getManualReviewNotesAuthorLabel(lead) {
      const label = String((lead && (lead.manualReviewNotesAuthorLabel || lead.manual_review_notes_author_label)) || '').trim();
      return label === 'manual_reviewer' ? '수동 리뷰어' : '';
    }

    function getManualReviewNoteStateLabel(lead) {
      return getManualReviewNoteValue(lead) ? '저장됨' : '비어 있음';
    }

    function getManualReviewNotesHistoryEventCount(lead) {
      const count = Number(lead && (lead.manualReviewNotesHistoryEventCount || lead.manual_review_notes_history_event_count) || 0);
      return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    }

    function formatTimestamp(raw) {
      if (!raw) return '';
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('ko-KR');
    }

    function formatLeadUpdatedAt(lead) {
      return formatTimestamp(lead && (lead.updatedAt || lead.updated_at));
    }

    function formatManualReviewNotesUpdatedAt(lead) {
      return formatTimestamp(lead && (lead.manualReviewNotesUpdatedAt || lead.manual_review_notes_updated_at));
    }

    function renderManualReviewNoteState(lead) {
      const hasSavedNote = Boolean(getManualReviewNoteValue(lead));
      const noteUpdatedAt = formatManualReviewNotesUpdatedAt(lead);
      const leadUpdatedAt = formatLeadUpdatedAt(lead);
      const authorLabel = getManualReviewNotesAuthorLabel(lead);
      const historyEventCount = getManualReviewNotesHistoryEventCount(lead);
      const timestampMeta = noteUpdatedAt
        ? \`<span class="notes-state-meta">\${hasSavedNote ? '수동 리뷰 메모 마지막 변경' : '수동 리뷰 메모가 마지막으로 비워짐/변경됨'}: \${esc(noteUpdatedAt)}</span>\`
        : (leadUpdatedAt ? \`<span class="notes-state-meta">리드 마지막 업데이트: \${esc(leadUpdatedAt)} (메모 전용 시간 아님)</span>\` : '');
      const authorMeta = authorLabel
        ? \`<span class="notes-state-meta">최근 수동 변경: \${esc(authorLabel)} (로컬/테스트 일반 라벨)</span>\`
        : '';
      const historyMeta = historyEventCount > 0
        ? \`<span class="notes-state-meta">수동 메모 메타데이터 이력 이벤트: \${historyEventCount}건</span>\`
        : '';
      return \`
        <div class="notes-state \${hasSavedNote ? 'is-saved' : 'is-empty'}" data-manual-note-state="\${hasSavedNote ? 'saved' : 'empty'}">
          <strong>\${hasSavedNote ? '저장된 수동 리뷰 메모 있음' : '저장된 수동 리뷰 메모 없음'}</strong>
          <span>\${hasSavedNote ? '사람이 입력한 수동 메모만 저장 상태로 표시됩니다.' : '비어 있음 상태입니다. ${generatedNoteLabel}은 저장 상태가 아닙니다.'}</span>
          \${timestampMeta}
          \${authorMeta}
          \${historyMeta}
        </div>
      \`;
    }

    function renderManualReviewNotePrivacyWarning() {
      return \`
        <p class="notes-privacy-warning" role="note"><strong>로컬/테스트 개인정보 주의:</strong> 수동 메모에는 민감한 영업 맥락이나 PII가 포함될 수 있습니다. 실제 개인정보/비밀은 입력하지 마세요. 지우기는 현재 저장된 메모 텍스트만 비웁니다. 자동 감지/차단은 하지 않습니다.</p>
      \`;
    }

    function updateManualReviewNoteState(section, lead) {
      if (!section || !lead) return;
      const state = section.querySelector('[data-manual-note-state]');
      if (state) state.outerHTML = renderManualReviewNoteState(lead);
      const summaryState = section.querySelector('[data-manual-note-summary-state]');
      if (summaryState) summaryState.textContent = getManualReviewNoteStateLabel(lead);
    }

    function normalizeReviewerFeedback(lead) {
      const raw = lead && (lead.reviewerFeedback || lead.reviewer_feedback);
      const record = raw && typeof raw === 'object' ? raw : {};
      const feedback = {
        hasFeedback: record.hasFeedback === true,
        actionUsefulness: reviewerFeedbackLabels.actionUsefulness[record.actionUsefulness || record.action_usefulness] ? (record.actionUsefulness || record.action_usefulness) : 'unclear',
        outcomeLabel: reviewerFeedbackLabels.outcomeLabel[record.outcomeLabel || record.outcome_label] ? (record.outcomeLabel || record.outcome_label) : 'unknown',
        dataGapPriority: reviewerFeedbackLabels.dataGapPriority[record.dataGapPriority || record.data_gap_priority] ? (record.dataGapPriority || record.data_gap_priority) : 'none',
        evidenceConfidenceAdjustment: reviewerFeedbackLabels.evidenceConfidenceAdjustment[record.evidenceConfidenceAdjustment || record.evidence_confidence_adjustment] ? (record.evidenceConfidenceAdjustment || record.evidence_confidence_adjustment) : 'unknown',
        feedbackText: String(record.feedbackText || record.feedback_text || ''),
        nextReviewerAction: String(record.nextReviewerAction || record.next_reviewer_action || ''),
        authorLabel: String(record.authorLabel || record.author_label || '').trim(),
        updatedAt: record.updatedAt || record.updated_at || null,
        historyEventCount: Number(record.historyEventCount || record.history_event_count || 0) || 0,
        historyLastEventType: String(record.historyLastEventType || record.history_last_event_type || ''),
        historyLastEventAt: record.historyLastEventAt || record.history_last_event_at || null,
        historyLastAuthorLabel: String(record.historyLastAuthorLabel || record.history_last_author_label || '').trim()
      };
      feedback.hasFeedback = feedback.hasFeedback
        || Boolean(feedback.updatedAt)
        || feedback.actionUsefulness !== 'unclear'
        || feedback.outcomeLabel !== 'unknown'
        || feedback.dataGapPriority !== 'none'
        || feedback.evidenceConfidenceAdjustment !== 'unknown'
        || Boolean(feedback.feedbackText.trim())
        || Boolean(feedback.nextReviewerAction.trim());
      return feedback;
    }

    function getReviewerFeedbackStateLabel(lead) {
      return normalizeReviewerFeedback(lead).hasFeedback ? '저장됨' : '비어 있음';
    }

    function getReviewerFeedbackAuthorLabel(feedback) {
      const label = String((feedback && (feedback.authorLabel || feedback.historyLastAuthorLabel)) || '').trim();
      return label === 'manual_reviewer' ? '수동 리뷰어' : '';
    }

    function renderReviewerFeedbackState(lead) {
      const feedback = normalizeReviewerFeedback(lead);
      const updatedAt = formatTimestamp(feedback.updatedAt);
      const historyAt = formatTimestamp(feedback.historyLastEventAt);
      const authorLabel = getReviewerFeedbackAuthorLabel(feedback);
      const outcome = reviewerFeedbackLabels.outcomeLabel[feedback.outcomeLabel] || feedback.outcomeLabel;
      const priority = reviewerFeedbackLabels.dataGapPriority[feedback.dataGapPriority] || feedback.dataGapPriority;
      const nextAction = feedback.nextReviewerAction.trim();
      const timestampMeta = updatedAt
        ? \`<span class="notes-state-meta">리뷰어 피드백 마지막 변경: \${esc(updatedAt)}</span>\`
        : (historyAt ? \`<span class="notes-state-meta">최근 메타데이터 이벤트: \${esc(historyAt)}</span>\` : '');
      const authorMeta = authorLabel
        ? \`<span class="notes-state-meta">최근 수동 변경: \${esc(authorLabel)} (로컬/테스트 일반 라벨)</span>\`
        : '';
      const historyMeta = feedback.historyEventCount > 0
        ? \`<span class="notes-state-meta">피드백 메타데이터 이력 이벤트: \${feedback.historyEventCount}건</span>\`
        : '';
      return \`
        <div class="reviewer-feedback-state \${feedback.hasFeedback ? 'is-saved' : 'is-empty'}" data-reviewer-feedback-state="\${feedback.hasFeedback ? 'saved' : 'empty'}">
          <strong>\${feedback.hasFeedback ? '저장된 리뷰어 피드백 있음' : '저장된 리뷰어 피드백 없음'}</strong>
          <span>결과 \${esc(outcome)} · 데이터 공백 우선순위 \${esc(priority)}</span>
          \${nextAction ? \`<span class="notes-state-meta">다음 수동 액션: \${esc(nextAction)}</span>\` : ''}
          \${timestampMeta}
          \${authorMeta}
          \${historyMeta}
        </div>
      \`;
    }

    function renderReviewerFeedbackOptions(group, selected) {
      const labels = reviewerFeedbackLabels[group] || {};
      return Object.keys(labels).map((value) => \`<option value="\${esc(value)}" \${value === selected ? 'selected' : ''}>\${esc(labels[value])}</option>\`).join('');
    }

    function renderReviewerFeedbackControls(lead) {
      if (cachedManualReviewNotesAccess && cachedManualReviewNotesAccess.manualNotesRead !== true) {
        return \`
          <div class="reviewer-feedback-section">
            <details>
              <summary>리뷰어 피드백 <span class="notes-summary-state">제한됨</span></summary>
              <div class="reviewer-feedback-state is-empty">
                <strong>보호된 피드백 숨김</strong>
                <span>로컬/테스트 역할 스텁에서 reviewer 역할이 아니면 수동 피드백 본문과 메타데이터를 표시하지 않습니다.</span>
              </div>
            </details>
          </div>
        \`;
      }
      const draft = reviewerFeedbackDrafts.get(getLeadId(lead));
      const feedback = { ...normalizeReviewerFeedback(lead), ...(draft ? draft.payload : {}) };
      return \`
        <div class="reviewer-feedback-section" data-feedback-lead-id="\${esc(getLeadId(lead))}" oninput="rememberReviewerFeedbackDraft(this)">
          <details>
            <summary>리뷰어 피드백 <span class="notes-summary-state" data-reviewer-feedback-summary-state>\${draft ? '저장 전' : esc(getReviewerFeedbackStateLabel(lead))}</span></summary>
            <p data-feedback-draft-state role="status">\${draft ? '저장 전 · 초안은 이 페이지에서만 보관됩니다.' : ''}</p>
            \${renderReviewerFeedbackState(lead)}
            <p class="notes-privacy-warning" role="note"><strong>로컬/테스트 사람 판단:</strong> 이 피드백은 리뷰 품질 개선용 수동 입력입니다. ${generatedNoteLabel}은 저장/전송/귀속/이력/내보내기 대상이 아닙니다.</p>
            <div class="reviewer-feedback-grid" data-reviewer-feedback-form>
              <label>액션 유용성
                <select data-feedback-field="actionUsefulness">\${renderReviewerFeedbackOptions('actionUsefulness', feedback.actionUsefulness)}</select>
              </label>
              <label>결과 라벨
                <select data-feedback-field="outcomeLabel">\${renderReviewerFeedbackOptions('outcomeLabel', feedback.outcomeLabel)}</select>
              </label>
              <label>데이터 공백 우선순위
                <select data-feedback-field="dataGapPriority">\${renderReviewerFeedbackOptions('dataGapPriority', feedback.dataGapPriority)}</select>
              </label>
              <label>근거 신뢰도 조정
                <select data-feedback-field="evidenceConfidenceAdjustment">\${renderReviewerFeedbackOptions('evidenceConfidenceAdjustment', feedback.evidenceConfidenceAdjustment)}</select>
              </label>
              <label class="reviewer-feedback-full">다음 리뷰어 액션
                <input data-feedback-field="nextReviewerAction" value="\${esc(feedback.nextReviewerAction)}" maxlength="500">
              </label>
              <label class="reviewer-feedback-full">피드백
                <textarea class="reviewer-feedback-textarea" data-feedback-field="feedbackText" maxlength="2000">\${esc(feedback.feedbackText)}</textarea>
              </label>
            </div>
            <div class="reviewer-feedback-actions">
              <button type="button" class="btn btn-secondary" onclick="saveReviewerFeedback('\${esc(getLeadId(lead))}', this)">피드백 저장</button>
              <button type="button" class="notes-clear-btn" onclick="clearReviewerFeedback('\${esc(getLeadId(lead))}', this)" \${feedback.hasFeedback ? '' : 'disabled'}>피드백 지우기</button>
            </div>
          </details>
        </div>
      \`;
    }

`;
}
