/** Manager summary, reviewer queue/session and review evidence panels. */
export function getLeadsReviewPanelsScript() {
  return `    function renderLeadActionIntelligenceSummary(lead) {
      const action = getLeadQueueItem(lead);
      return \`
        <div class="lead-action-intelligence priority-\${esc(action.reviewPriority)}" aria-label="Lead Action Intelligence">
          <span class="block-label">다음 검토 행동</span>
          <strong>\${esc(reviewActionLabel(action))}</strong>
          <p>\${esc(reviewActionExplanation(action))}</p>
          <div class="lead-action-intel-meta">
            <span>검토 우선순위 \${esc(reviewPriorityLabel(action.reviewPriority))}</span>
            <span>판단 신뢰도 \${esc(reviewPriorityLabel(action.actionConfidence))}</span>
            <span>리스크 \${Number(action.riskCount) || 0}</span>
            <span>누락 정보 \${Number(action.missingInfoCount) || 0}</span>
          </div>
        </div>
      \`;
    }

    function renderLeadListReviewGate(lead) {
      const gate = buildLeadListReviewGate(lead);
      return \`
        <div class="lead-review-gate gate-\${gate.state}" aria-label="목록 품질 게이트">
          <span class="block-label">목록 품질 게이트</span>
          <strong>\${esc(gate.label)}</strong>
          <div class="lead-review-gate-items">
            \${gate.items.map((item) => \`<span>\${esc(item)}</span>\`).join('')}
          </div>
          <p>This list gate does not approve outreach; it only prioritizes human review.</p>
        </div>
      \`;
    }

    function buildReviewGateSummary(leads) {
      return (Array.isArray(leads) ? leads : []).reduce((summary, lead) => {
        const state = buildLeadListReviewGate(lead).state;
        if (Object.prototype.hasOwnProperty.call(summary, state)) summary[state] += 1;
        return summary;
      }, { ready: 0, review: 0, blocked: 0, hold: 0 });
    }

    function renderReviewGateSummary(leads) {
      const summary = buildReviewGateSummary(leads);
      return \`
        <section class="review-slice-band review-gate-summary" aria-label="목록 게이트 요약">
          <div class="review-slice-head">
            <strong>목록 게이트 요약</strong>
            <span>현재 필터 결과 기준</span>
          </div>
          <div class="review-slice-grid">
            <div class="review-slice review-slice-ready"><strong>게이트 통과 \${summary.ready}건</strong><span>검토, 검증, 근거, 데이터 공백 기준 통과</span></div>
            <div class="review-slice review-slice-risk"><strong>보강 필요 \${summary.review}건</strong><span>사람 검토 전 근거 또는 공백 확인 필요</span></div>
            <div class="review-slice review-slice-blocked"><strong>차단 \${summary.blocked}건</strong><span>반려 상태로 목록 우선순위 제외</span></div>
            <div class="review-slice review-slice-hold"><strong>보류 \${summary.hold}건</strong><span>추가 시점 또는 조건 대기</span></div>
          </div>
          <div class="review-slice-caveat">This summary does not approve outreach; it only prioritizes human review.</div>
        </section>
      \`;
    }

    function buildManagerReviewerSummary(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const session = getSessionState(leads);
      const queueItems = list
        .map((lead) => ({ lead, item: getLeadQueueItem(lead) }))
        .filter(({ item }) => item);
      const blockers = {
        evidenceMissing: 0,
        dataGaps: 0,
        riskFlags: 0,
        lowConfidence: 0,
      };
      const feedback = {
        withReviewerFeedback: 0,
        interested: 0,
        needsMoreResearch: 0,
        duplicateOrNotFit: 0,
        highOrBlockingGap: 0,
        nextActions: 0,
      };
      let readyForReviewOrAction = 0;
      let needsEvidenceOrGaps = 0;

      queueItems.forEach(({ lead, item }) => {
        const reviewerFeedback = normalizeReviewerFeedback(lead);
        const riskCodes = Array.isArray(item.riskFlags)
          ? item.riskFlags.map((flag) => String(flag && flag.code || '')).filter(Boolean)
          : [];
        const missingEvidence = getEvidenceItems(lead).length === 0
          || getSources(lead).length === 0
          || riskCodes.includes('missing_evidence')
          || riskCodes.includes('verified_without_evidence');
        const hasDataGaps = getDataGaps(lead).length > 0 || riskCodes.includes('data_gaps');
        const hasRiskFlags = (Number(item.riskCount) || 0) > 0;
        const lowConfidence = getConfidence(lead) === 'LOW' || riskCodes.includes('low_confidence');

        if (missingEvidence) blockers.evidenceMissing += 1;
        if (hasDataGaps) blockers.dataGaps += 1;
        if (hasRiskFlags) blockers.riskFlags += 1;
        if (lowConfidence) blockers.lowConfidence += 1;
        if (missingEvidence || hasDataGaps) needsEvidenceOrGaps += 1;
        if (
          item.queueLane === 'approval_candidates'
          && !hasRiskFlags
          && (Number(item.missingInfoCount) || 0) === 0
        ) {
          readyForReviewOrAction += 1;
        }
        if (reviewerFeedback.hasFeedback) feedback.withReviewerFeedback += 1;
        if (reviewerFeedback.outcomeLabel === 'interested') feedback.interested += 1;
        if (reviewerFeedback.outcomeLabel === 'needs_more_research') feedback.needsMoreResearch += 1;
        if (reviewerFeedback.outcomeLabel === 'duplicate' || reviewerFeedback.outcomeLabel === 'not_fit') feedback.duplicateOrNotFit += 1;
        if (reviewerFeedback.dataGapPriority === 'high' || reviewerFeedback.dataGapPriority === 'blocking') feedback.highOrBlockingGap += 1;
        if (reviewerFeedback.nextReviewerAction.trim()) feedback.nextActions += 1;
      });

      const nextFocus = session.nextItem && session.nextLead
        ? [
          session.nextItem.company || session.nextLead.company || '리드',
          session.nextItem.queueLaneLabel || queueLaneLabels[session.nextItem.queueLane] || session.nextItem.queueLane,
          reviewActionLabel(session.nextItem),
        ].filter(Boolean).join(' · ')
        : '현재 필터 결과에 다음 리뷰 후보 없음';

      return {
        total: list.length,
        reviewStatusCounts: session.reviewStatusCounts,
        laneCounts: session.remainingByLane,
        blockers,
        feedback,
        readyForReviewOrAction,
        needsEvidenceOrGaps,
        nextFocus,
      };
    }

    function renderManagerReviewerSummary(leads) {
      const summary = buildManagerReviewerSummary(leads);
      const counts = summary.reviewStatusCounts;
      const lanes = summary.laneCounts;
      const blockers = summary.blockers;
      const feedback = summary.feedback;

      return \`
        <section id="managerReviewerSummary" class="review-slice-band manager-reviewer-summary" aria-label="리뷰 요약">
          <div class="review-slice-head">
            <strong>리뷰 요약</strong>
            <span>현재 필터 기준 · \${summary.total}건</span>
          </div>
          <div class="review-slice-grid">
            <div class="review-slice">
              <strong>현재 필터 \${summary.total}건</strong>
              <span>승인 \${counts.APPROVED || 0}건 / 검토 필요 \${counts.NEEDS_REVIEW || 0}건 / 대기 \${counts.NEW || 0}건</span>
            </div>
            <div class="review-slice">
              <strong>큐 상태</strong>
              <span>승인 후보 \${lanes.approval_candidates || 0}건 · 보강 필요 \${lanes.needs_evidence || 0}건 · 리스크 확인 \${lanes.risk_review || 0}건 · 낮은 우선순위 \${lanes.low_priority || 0}건</span>
            </div>
            <div class="review-slice review-slice-risk">
              <strong>주요 병목</strong>
              <span>근거 누락 \${blockers.evidenceMissing}건 · 데이터 공백 \${blockers.dataGaps}건 · 리스크 플래그 \${blockers.riskFlags}건 · 낮은 신뢰도 \${blockers.lowConfidence}건</span>
            </div>
            <div class="review-slice review-slice-ready">
              <strong>준비 \${summary.readyForReviewOrAction}건 / 보강 필요 \${summary.needsEvidenceOrGaps}건</strong>
              <span>리뷰 또는 수동 액션 준비도</span>
            </div>
            <div class="review-slice">
              <strong>리뷰어 피드백 \${feedback.withReviewerFeedback}건</strong>
              <span>관심 \${feedback.interested}건 · 추가 조사 \${feedback.needsMoreResearch}건 · 중복/부적합 \${feedback.duplicateOrNotFit}건</span>
            </div>
            <div class="review-slice review-slice-risk">
              <strong>고우선 데이터 공백 \${feedback.highOrBlockingGap}건</strong>
              <span>다음 수동 액션 기록 \${feedback.nextActions}건</span>
            </div>
          </div>
          <div class="review-slice-caveat"><strong>다음 리뷰 포커스</strong>: \${esc(summary.nextFocus)}</div>
          <div class="review-slice-caveat">Advisory only · 주의: 이 요약은 리뷰 보조용이며 CRM 할당/아웃리치 승인이 아닙니다. 프로덕션 관측 근거가 아닙니다.</div>
        </section>
      \`;
    }

    function getActiveReviewFilterEntries() {
      const entries = [];
      document.querySelectorAll('#reviewQueueFilters [data-filter-key]').forEach((select) => {
        if (!select || !select.dataset || (select.value || 'all') === 'all') return;
        const label = select.closest('label') ? select.closest('label').childNodes[0].textContent.trim() : select.dataset.filterKey;
        const option = select.options[select.selectedIndex];
        entries.push({
          key: select.dataset.filterKey,
          label,
          value: option ? option.textContent.trim() : select.value,
        });
      });
      return entries;
    }

    function getSessionState(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const laneOrder = ['approval_candidates', 'needs_evidence', 'risk_review', 'low_priority'];
      const remainingByLane = laneOrder.reduce((summary, laneId) => ({ ...summary, [laneId]: 0 }), {});
      const reviewStatusCounts = reviewStatuses.reduce((summary, status) => ({ ...summary, [status]: 0 }), {});
      const queueItems = list.map((lead) => getLeadQueueItem(lead)).filter(Boolean);

      list.forEach((lead) => {
        const status = getReviewStatus(lead);
        if (Object.prototype.hasOwnProperty.call(reviewStatusCounts, status)) reviewStatusCounts[status] += 1;
      });
      queueItems.forEach((item) => {
        if (Object.prototype.hasOwnProperty.call(remainingByLane, item.queueLane)) remainingByLane[item.queueLane] += 1;
      });

      const nextItem = queueItems.find((item) => ['NEW', 'NEEDS_REVIEW'].includes(item.reviewStatus))
        || queueItems.find((item) => item.reviewStatus === 'APPROVED' && item.riskCount > 0)
        || null;
      const nextLead = nextItem
        ? list.find((lead) => getLeadId(lead) === nextItem.leadId) || null
        : null;

      return {
        total: list.length,
        remainingByLane,
        reviewStatusCounts,
        activeFilters: getActiveReviewFilterEntries(),
        nextItem,
        nextLead,
      };
    }

    function renderNextReviewStrip(leads) {
      const session = getSessionState(leads);
      if (!session.nextItem || !session.nextLead) {
        return \`
          <div class="next-review-strip-head">
            <div>
              <span>다음 리뷰</span>
              <strong>\${session.total > 0 && !session.reviewStatusCounts.DEFERRED ? '현재 필터의 검토가 완료되었습니다.' : '현재 필터에서 다음 리뷰 리드가 없습니다.'}</strong>
              <p>\${session.total > 0 ? '승인된 리드의 후속 준비와 보류된 리드의 재검토 일정은 목록에서 확인하세요.' : '필터를 조정하거나 초기화하면 리뷰 후보가 다시 표시됩니다.'}</p>
            </div>
            <div class="next-review-strip-actions">
              <button class="btn btn-secondary" type="button" data-session-action="focus-session">세션 보기</button>
            </div>
          </div>
        \`;
      }

      const nextLeadId = getLeadId(session.nextLead);
      const currentReviewStatus = getReviewStatus(session.nextLead);
      const currentSalesStatus = session.nextLead.status || 'NEW';
      return \`
        <div class="next-review-strip-head">
          <div>
            <span>\${currentReviewStatus === 'APPROVED' ? '리스크 재확인' : '다음 리뷰'}</span>
            <strong>\${esc(session.nextItem.company || session.nextLead.company || '리드')}</strong>
            <p>\${esc(reviewActionExplanation(session.nextItem))}</p>
          </div>
          <div class="next-review-strip-actions">
            <button class="btn btn-secondary" type="button" data-session-action="focus-next" data-lead-id="\${esc(nextLeadId)}">다음 리드 보기</button>
            <button class="btn btn-secondary" type="button" data-session-action="focus-session">세션 보기</button>
          </div>
        </div>
        <div class="next-review-strip-meta">
          <span>\${esc(session.nextItem.queueLaneLabel || queueLaneLabels[session.nextItem.queueLane] || session.nextItem.queueLane)}</span>
          <span>검토 우선순위 \${esc(reviewPriorityLabel(session.nextItem.reviewPriority))}</span>
          <span>\${esc(reviewActionLabel(session.nextItem))}</span>
          <span>미검토 \${session.reviewStatusCounts.NEW + session.reviewStatusCounts.NEEDS_REVIEW}건 · 승인 \${session.reviewStatusCounts.APPROVED}건</span>
          <span>\${esc(humanReviewStatusLabel(currentReviewStatus))}</span>
          <span>영업 \${esc(statusLabels[currentSalesStatus] || currentSalesStatus)}</span>
        </div>
      \`;
    }

    function renderSessionActivitySummary() {
      const lastAction = sessionActivity.lastAction || '세션 활동 없음';
      const helpHidden = shortcutHelpOpen ? '' : ' hidden';
      const helpClass = shortcutHelpOpen ? '' : ' is-hidden';
      return \`
        <section id="reviewProductivityToolkit" class="review-productivity-toolkit" aria-label="Reviewer Productivity Toolkit">
          <div class="review-productivity-head">
            <div>
              <strong>Reviewer Productivity Toolkit</strong>
              <span>복사, 포커스, 명시적 검토 변경만 현재 브라우저 세션에서 집계</span>
            </div>
            <button class="btn btn-secondary" type="button" data-shortcut-action="toggle-help" aria-expanded="\${shortcutHelpOpen ? 'true' : 'false'}" aria-controls="reviewShortcutHelp">단축키 도움말</button>
          </div>
          <div id="reviewProductivityCounts" class="review-productivity-grid">
            <span>노트 복사 \${sessionActivity.copiedNotes}건</span>
            <span>상태 변경 \${sessionActivity.reviewUpdates}건</span>
            <span>포커스 이동 \${sessionActivity.focusMoves}건</span>
            <span>필터 초기화 \${sessionActivity.filterResets}건</span>
          </div>
          <p id="reviewProductivityLastAction" class="review-productivity-last">마지막 작업: \${esc(lastAction)}</p>
          <div id="reviewShortcutHelp" class="review-shortcut-help\${helpClass}"\${helpHidden} role="region" aria-label="단축키 도움말">
            <p><kbd>n</kbd>/<kbd>j</kbd> 다음 검토 리드로 포커스</p>
            <p><kbd>q</kbd> Reviewer Action Queue로 포커스</p>
            <p><kbd>c</kbd> 보이는 리뷰 노트 복사</p>
            <p><kbd>?</kbd> 단축키 도움말 열기/닫기</p>
            <p>Shortcut keys do not change reviewStatus. 승인/검토 필요 변경은 버튼 또는 선택 상자에서만 실행됩니다.</p>
          </div>
        </section>
      \`;
    }

    function renderLeadReviewSession(leads) {
      const session = getSessionState(leads);
      const filters = session.activeFilters.length > 0
        ? session.activeFilters.map((filter) => \`<span class="review-session-filter-chip">\${esc(filter.label)}: \${esc(filter.value)}</span>\`).join('')
        : '<span class="review-session-filter-chip">필터: 전체</span>';
      const nextLeadId = session.nextLead ? getLeadId(session.nextLead) : '';
      const currentReviewStatus = session.nextLead ? getReviewStatus(session.nextLead) : '';
      const currentSalesStatus = session.nextLead ? (session.nextLead.status || 'NEW') : '';
      const nextBody = session.nextItem && session.nextLead
        ? \`
          <div class="review-session-next">
            <strong>\${currentReviewStatus === 'APPROVED' ? '리스크 재확인 리드' : '다음 검토 리드'}: \${esc(session.nextItem.company || session.nextLead.company || '리드')}</strong>
            <p>\${esc(reviewActionExplanation(session.nextItem))}</p>
            <div class="review-session-meta">
              <span>\${esc(session.nextItem.queueLaneLabel || queueLaneLabels[session.nextItem.queueLane] || session.nextItem.queueLane)}</span>
              <span>검토 우선순위 \${esc(reviewPriorityLabel(session.nextItem.reviewPriority))}</span>
              <span>리스크 \${Number(session.nextItem.riskCount) || 0}</span>
              <span>누락 정보 \${Number(session.nextItem.missingInfoCount) || 0}</span>
              <span>\${esc(humanReviewStatusLabel(currentReviewStatus))}</span>
              <span>영업 \${esc(statusLabels[currentSalesStatus] || currentSalesStatus)}</span>
            </div>
            \${renderReviewNoteSuggestion(session.nextLead, { compact: true })}
            <div class="review-session-actions" aria-label="빠른 검토 작업">
              <button class="btn btn-secondary" type="button" data-session-action="focus-next" data-lead-id="\${esc(nextLeadId)}">다음 검토 리드</button>
              <button class="btn" type="button" data-session-action="review-status" data-review-status="APPROVED" data-lead-id="\${esc(nextLeadId)}" \${currentReviewStatus === 'APPROVED' ? 'disabled' : ''} aria-label="다음 리드를 승인으로 변경">승인</button>
              <button class="btn btn-secondary" type="button" data-session-action="review-status" data-review-status="NEEDS_REVIEW" data-lead-id="\${esc(nextLeadId)}" \${currentReviewStatus === 'NEEDS_REVIEW' ? 'disabled' : ''} aria-label="다음 리드를 검토 필요로 변경">검토 필요</button>
            </div>
          </div>
        \`
        : '<div class="review-session-next"><strong>다음 검토 리드 없음</strong><p>미검토 리드가 없습니다. 승인된 리드의 후속 준비와 보류된 리드의 재검토 일정을 확인하세요.</p></div>';

      return \`
        <section id="leadReviewSession" class="review-session-panel" aria-label="Lead Review Session" tabindex="-1">
          <div class="review-session-head">
            <strong>Lead Review Session</strong>
            <span>현재 필터 기준 · reviewStatus만 빠르게 변경</span>
          </div>
          <div class="review-session-grid">
            <div class="review-session-stat"><span>현재 큐</span><strong>\${session.total}</strong></div>
            <div class="review-session-stat"><span>승인 후보</span><strong>\${session.remainingByLane.approval_candidates}</strong></div>
            <div class="review-session-stat"><span>보강/리스크</span><strong>\${session.remainingByLane.needs_evidence + session.remainingByLane.risk_review}</strong></div>
            <div class="review-session-stat"><span>승인 / 검토 필요</span><strong>\${session.reviewStatusCounts.APPROVED} / \${session.reviewStatusCounts.NEEDS_REVIEW}</strong></div>
          </div>
          <div class="review-session-meta" aria-label="현재 필터">
            \${filters}
          </div>
          \${renderSessionActivitySummary()}
          \${nextBody}
        </section>
      \`;
    }

    function renderReviewerActionQueue(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const items = list.map((lead) => getLeadQueueItem(lead)).filter(Boolean);
      const laneOrder = ['approval_candidates', 'needs_evidence', 'risk_review', 'low_priority'];
      const laneHtml = laneOrder.map((laneId) => {
        const laneItems = items.filter((item) => item.queueLane === laneId);
        const shown = laneItems.slice(0, 3).map((item) => \`
          <li>
            <b>\${esc(item.company || item.leadId || '리드')}</b>
            <em>\${esc(reviewActionLabel(item))}</em>
            <small>리스크 \${Number(item.riskCount) || 0} · 누락 정보 \${Number(item.missingInfoCount) || 0}</small>
          </li>
        \`).join('');
        const extra = laneItems.length > 3 ? \`<p class="reviewer-action-empty">외 \${laneItems.length - 3}건</p>\` : '';
        return \`
          <article class="reviewer-action-lane \${esc(laneId)}">
            <strong>\${esc(queueLaneLabels[laneId])} \${laneItems.length}건</strong>
            <span>\${esc(queueLaneDescriptions[laneId])}</span>
            \${laneItems.length > 0 ? \`<ul>\${shown}</ul>\${extra}\` : '<p class="reviewer-action-empty">없음</p>'}
          </article>
        \`;
      }).join('');

      return \`
        <section id="reviewerActionQueue" class="reviewer-action-queue" aria-label="Reviewer Action Queue" tabindex="-1">
          <div class="reviewer-action-queue-head">
            <strong>Reviewer Action Queue</strong>
            <span>현재 필터 결과 기준 · 우선순위 정렬</span>
          </div>
          <div class="reviewer-action-lanes">
            \${laneHtml}
          </div>
          <div class="review-slice-caveat">Deterministic reviewer guidance only; it does not approve outreach or send messages automatically.</div>
        </section>
      \`;
    }

    function renderReviewStatusSelect(lead) {
      const current = getReviewStatus(lead);
      const opts = reviewStatuses.map(s =>
        \`<option value="\${s}" \${s === current ? 'selected' : ''}>\${esc(reviewStatusLabels[s])}</option>\`
      ).join('');
      if (!lead.id) return \`<span class="badge badge-review \${current.toLowerCase()}">\${esc(humanReviewStatusLabel(current))}</span>\`;
      return \`<select class="status-select" aria-label="\${leadAccessibleName(lead)} 검토 상태 변경" onchange="updateReviewStatus('\${esc(lead.id)}', this.value, '\${current}')">\${opts}</select>\`;
    }

    function buildReviewEvidenceSlices(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const missingEvidence = list.filter((lead) => getEvidenceItems(lead).length === 0 || getSources(lead).length === 0).length;
      const dataGapLeads = list.filter((lead) => getDataGaps(lead).length > 0).length;
      const reviewReady = list.filter((lead) => (
        getEvidenceItems(lead).length > 0
        && getSources(lead).length > 0
        && getDataGaps(lead).length === 0
        && getVerificationStatus(lead) === 'verified'
        && getConfidence(lead) !== 'LOW'
      )).length;
      const guidance = missingEvidence > 0 || dataGapLeads > 0
        ? '직접 근거와 데이터 공백이 있는 리드를 먼저 보강하세요.'
        : '근거와 데이터 공백 기준으로 검토 가능한 상태입니다.';

      return {
        missingEvidence,
        dataGapLeads,
        reviewReady,
        guidance,
      };
    }

    function renderReviewEvidenceSlices(leads) {
      const slices = buildReviewEvidenceSlices(leads);
      return \`
        <section class="review-slice-band" aria-label="검토 리스크">
          <div class="review-slice-head">
            <strong>검토 리스크</strong>
            <span>\${esc(slices.guidance)}</span>
          </div>
          <div class="review-slice-grid">
            <div class="review-slice review-slice-risk"><strong>근거 누락 \${slices.missingEvidence}건</strong><span>직접 인용 또는 출처 보강 필요</span></div>
            <div class="review-slice review-slice-risk"><strong>데이터 공백 리드 \${slices.dataGapLeads}건</strong><span>의사결정자, 예산, 일정 등 확인 필요</span></div>
            <div class="review-slice review-slice-ready"><strong>검토 가능 \${slices.reviewReady}건</strong><span>근거와 검증 상태가 정리된 리드</span></div>
          </div>
          <div class="review-slice-caveat">This slice does not approve outreach; it only prioritizes human review.</div>
        </section>
      \`;
    }

    function renderLeadsSummary(leads, totalBeforeFilter = leads.length) {
      const total = leads.length;
      const gradeA = leads.filter(l => l.grade === 'A').length;
      const enriched = leads.filter(l => l.enriched).length;
      const needsReview = leads.filter(l => getReviewStatus(l) === 'NEEDS_REVIEW').length;
      const verified = leads.filter(l => getVerificationStatus(l) === 'verified').length;
      const dataGapCount = leads.reduce((sum, lead) => sum + getDataGaps(lead).length, 0);
      const avgScore = Math.round(leads.reduce((sum, lead) => sum + (parseInt(lead.score, 10) || 0), 0) / Math.max(1, total));
      return \`
        <div class="leads-summary">
          <div class="summary-card"><span class="label">필터 결과</span><span class="value">\${total}</span><div class="meta">전체 \${totalBeforeFilter}건 중 표시</div></div>
          <div class="summary-card"><span class="label">검토 필요</span><span class="value">\${needsReview}</span><div class="meta">사람 검토 전 상태</div></div>
          <div class="summary-card"><span class="label">검증됨</span><span class="value">\${verified}</span><div class="meta">공개 근거 확인 리드</div></div>
          <div class="summary-card"><span class="label">A등급</span><span class="value">\${gradeA}</span><div class="meta">우선 검토 후보</div></div>
          <div class="summary-card"><span class="label">평균 점수</span><span class="value">\${avgScore}</span><div class="meta">기사 신호 기준 평균</div></div>
          <div class="summary-card"><span class="label">데이터 공백</span><span class="value">\${dataGapCount}</span><div class="meta">검토 중 확인할 항목</div></div>
          <div class="summary-card"><span class="label">심층 분석 완료</span><span class="value">\${enriched}</span><div class="meta">추가 근거가 확보된 리드</div></div>
        </div>
      \`;
    }

`;
}
