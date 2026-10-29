/** Lead trust metadata, deterministic gates/actions and queue fallback calculations. */
export function getLeadsReviewModelScript(includeGeneratedReviewGuidance) {
  return `    function normalizeReviewStatus(value) {
      const status = String(value || '').toUpperCase();
      return reviewStatuses.includes(status) ? status : 'NEEDS_REVIEW';
    }

    function getReviewStatus(lead) {
      return normalizeReviewStatus(lead.reviewStatus || lead.review_status);
    }

    function humanReviewStatusLabel(status) {
      const current = normalizeReviewStatus(status);
      if (current === 'NEEDS_REVIEW') return '사람 검토: 필요';
      return '사람 검토: ' + (reviewStatusLabels[current] || current);
    }

    function normalizeVerificationStatus(value) {
      const status = String(value || '').toLowerCase();
      return verificationStatusLabels[status] ? status : 'needs_review';
    }

    function getVerificationStatus(lead) {
      return normalizeVerificationStatus(lead.verificationStatus || lead.verification_status);
    }

    function normalizeGenerationMode(value) {
      const mode = String(value || '').toLowerCase();
      return generationModeLabels[mode] ? mode : 'llm';
    }

    function getGenerationMode(lead) {
      return normalizeGenerationMode(lead.generationMode || lead.generation_mode);
    }

    function getConfidence(lead) {
      const confidence = String(lead.confidence || '').toUpperCase();
      return confidenceLabels[confidence] ? confidence : 'LOW';
    }

    function getArrayField(lead, camelKey, snakeKey) {
      const value = lead[camelKey];
      if (Array.isArray(value)) return value.filter(Boolean);
      const legacyValue = lead[snakeKey];
      if (Array.isArray(legacyValue)) return legacyValue.filter(Boolean);
      return [];
    }

    function getDataGaps(lead) {
      return getArrayField(lead, 'dataGaps', 'data_gaps');
    }

    function getEvidenceItems(lead) {
      return getArrayField(lead, 'evidence', 'evidence');
    }

    function getSources(lead) {
      return getArrayField(lead, 'sources', 'sources');
    }

    function getLeadId(lead) {
      return String((lead && (lead.id || lead.leadId || lead.lead_id)) || '');
    }

    function cacheReviewerActionQueue(queue) {
      const items = Array.isArray(queue && queue.items) ? queue.items : [];
      cachedReviewerQueue = queue && typeof queue === 'object' ? queue : { items: [], lanes: [] };
      cachedQueueItemsByLeadId = {};
      items.forEach((item, index) => {
        const leadId = String(item && item.leadId || '');
        if (!leadId) return;
        cachedQueueItemsByLeadId[leadId] = { ...item, sortIndex: index };
      });
    }

    function cacheManualReviewNotesAccess(access) {
      cachedManualReviewNotesAccess = access && typeof access === 'object' ? access : null;
      if (cachedManualReviewNotesAccess && cachedManualReviewNotesAccess.manualNotesRead !== true) { leadsAccessEpoch++; reviewerFeedbackController.reset(); manualNoteController.reset(); }
    }

    function canShowGeneratedReviewGuidance() {
      return generatedReviewGuidanceEnabled
        && (!cachedManualReviewNotesAccess || cachedManualReviewNotesAccess.manualNotesRead === true);
    }

    function laneForFallbackAction(action) {
      if (action === 'keep_out_of_queue' || action === 'schedule_recheck') return 'low_priority';
      if (action === 'reconcile_review_conflict' || action === 'refresh_signal') return 'risk_review';
      if (action === 'prepare_human_follow_up' || action === 'decide_review_status') return 'approval_candidates';
      return 'needs_evidence';
    }

    function buildFallbackReviewerQueueItem(lead) {
      const summary = buildLeadActionIntelligenceSummary(lead);
      const dataGapCount = getDataGaps(lead).length;
      const missingEvidence = getEvidenceItems(lead).length === 0 || getSources(lead).length === 0;
      const missingInfoCount = dataGapCount + (missingEvidence ? 1 : 0) + (getVerificationStatus(lead) !== 'verified' ? 1 : 0);
      const queueLane = laneForFallbackAction(summary.nextReviewAction);
      ${includeGeneratedReviewGuidance
        ? 'const reviewNotes = canShowGeneratedReviewGuidance() ? buildFallbackReviewNoteTemplates(lead, summary) : null;'
        : 'const reviewNotes = null;'}
      return {
        leadId: getLeadId(lead),
        company: lead.company || '리드',
        reviewStatus: getReviewStatus(lead),
        verificationStatus: getVerificationStatus(lead),
        generationMode: getGenerationMode(lead),
        leadConfidence: getConfidence(lead),
        nextReviewAction: summary.nextReviewAction,
        nextReviewActionLabel: summary.action,
        reviewPriority: summary.priority,
        actionConfidence: summary.actionConfidence,
        queueLane,
        queueLaneLabel: queueLaneLabels[queueLane] || queueLane,
        reasonSnippet: summary.reason,
        riskCount: summary.risks.length,
        missingInfoCount,
        riskFlags: summary.risks.map((risk) => ({ code: risk })),
        missingInfoPrompts: [],
        ${includeGeneratedReviewGuidance
          ? `...(reviewNotes ? {
          reviewNoteSuggestion: reviewNotes.current,
          reviewNoteTemplates: reviewNotes.templates,
        } : {}),`
          : ''}
        sortIndex: 9999,
      };
    }

    function getLeadQueueItem(lead) {
      const leadId = getLeadId(lead);
      if (leadId && cachedQueueItemsByLeadId[leadId]) return cachedQueueItemsByLeadId[leadId];
      return buildFallbackReviewerQueueItem(lead);
    }

    function buildLeadListReviewGate(lead) {
      const reviewStatus = getReviewStatus(lead);
      const verificationStatus = getVerificationStatus(lead);
      const confidence = getConfidence(lead);
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const dataGapCount = getDataGaps(lead).length;
      let state = 'review';
      let label = '목록 게이트 보강 필요';

      if (reviewStatus === 'REJECTED') {
        state = 'blocked';
        label = '목록 게이트 차단';
      } else if (reviewStatus === 'DEFERRED') {
        state = 'hold';
        label = '목록 게이트 보류';
      } else if (
        reviewStatus === 'APPROVED'
        && verificationStatus === 'verified'
        && confidence !== 'LOW'
        && evidenceCount > 0
        && sourceCount > 0
        && dataGapCount === 0
      ) {
        state = 'ready';
        label = '목록 게이트 통과';
      }

      return {
        state,
        label,
        items: [
          humanReviewStatusLabel(reviewStatus),
          verificationStatusLabels[verificationStatus] || verificationStatus,
          confidenceLabels[confidence] || ('신뢰도 ' + confidence),
          evidenceCount > 0 ? '근거 ' + evidenceCount + '개 / 출처 ' + sourceCount + '개' : '직접 인용 없음 / 출처 ' + sourceCount + '개',
          dataGapCount === 0 ? '데이터 공백 없음' : '데이터 공백 ' + dataGapCount + '건',
        ],
      };
    }

    function countStaleSources(lead) {
      const staleAfterMs = 90 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      return getSources(lead).filter((source) => {
        const raw = source && (source.publishedAt || source.published_at || source.publishedDate || source.published_date || source.date);
        if (!raw) return false;
        const parsed = new Date(raw);
        return !Number.isNaN(parsed.getTime()) && now - parsed.getTime() > staleAfterMs;
      }).length;
    }

    function hasConflictingEvidence(lead) {
      if (Array.isArray(lead.conflicts) && lead.conflicts.length > 0) return true;
      return getEvidenceItems(lead).some((item) => item && (item.contradicts || item.conflictsWith || item.conflict));
    }

    function buildLeadActionIntelligenceSummary(lead) {
      const reviewStatus = getReviewStatus(lead);
      const verificationStatus = getVerificationStatus(lead);
      const generationMode = getGenerationMode(lead);
      const confidence = getConfidence(lead);
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const dataGapCount = getDataGaps(lead).length;
      const staleCount = countStaleSources(lead);
      const hasConflict = hasConflictingEvidence(lead);
      const missingEvidence = evidenceCount === 0 || sourceCount === 0;
      let nextReviewAction = 'review_lead';
      let action = 'Review lead';
      let priority = 'medium';
      let actionConfidence = 'low';
      let reason = 'Inspect review, evidence, confidence, and gaps before deciding.';

      if (reviewStatus === 'REJECTED') {
        nextReviewAction = 'keep_out_of_queue';
        action = 'Keep out of active queue';
        priority = 'blocked';
        actionConfidence = 'medium';
        reason = 'Rejected by human review.';
      } else if (reviewStatus === 'APPROVED' && (verificationStatus !== 'verified' || hasConflict || missingEvidence || dataGapCount > 0 || confidence === 'LOW')) {
        nextReviewAction = 'reconcile_review_conflict';
        action = 'Reconcile review conflict';
        priority = 'high';
        actionConfidence = 'low';
        reason = 'Approval conflicts with verification, evidence, or open gaps.';
      } else if (staleCount > 0) {
        nextReviewAction = 'refresh_signal';
        action = 'Refresh stale signal';
        priority = 'medium';
        actionConfidence = 'low';
        reason = 'Public source date is outside the freshness window.';
      } else if (confidence === 'LOW' || generationMode === 'heuristic' || generationMode === 'unavailable') {
        nextReviewAction = 'enrich_before_review';
        action = 'Enrich before review';
        priority = 'medium';
        actionConfidence = 'low';
        reason = 'Confidence or generation mode needs stronger evidence.';
      } else if (missingEvidence) {
        nextReviewAction = 'verify_evidence';
        action = 'Verify evidence first';
        priority = 'medium';
        actionConfidence = 'low';
        reason = 'Direct evidence or source coverage is incomplete.';
      } else if (dataGapCount > 0) {
        nextReviewAction = 'resolve_data_gaps';
        action = 'Resolve data gaps';
        priority = 'medium';
        actionConfidence = 'low';
        reason = 'Open data gaps remain before approval or follow-up.';
      } else if (reviewStatus === 'DEFERRED') {
        nextReviewAction = 'schedule_recheck';
        action = 'Schedule recheck';
        priority = 'hold';
        actionConfidence = 'medium';
        reason = 'Deferred until a condition or timing changes.';
      } else if (reviewStatus === 'APPROVED' && verificationStatus === 'verified') {
        nextReviewAction = 'prepare_human_follow_up';
        action = 'Prepare reviewed follow-up';
        priority = 'high';
        actionConfidence = confidence === 'HIGH' ? 'high' : 'medium';
        reason = 'Approved, verified, evidence-backed lead.';
      } else if (verificationStatus === 'verified') {
        nextReviewAction = 'decide_review_status';
        action = 'Decide review status';
        priority = 'high';
        actionConfidence = 'medium';
        reason = 'Verified evidence is present; human review remains open.';
      }

      const risks = [];
      if (verificationStatus !== 'verified') risks.push('verification');
      if (missingEvidence) risks.push('evidence');
      if (dataGapCount > 0) risks.push('data gaps ' + dataGapCount);
      if (confidence === 'LOW') risks.push('low confidence');
      if (hasConflict) risks.push('conflict');
      if (staleCount > 0) risks.push('stale signal');

      return { nextReviewAction, action, priority, actionConfidence, reason, risks };
    }

`;
}
