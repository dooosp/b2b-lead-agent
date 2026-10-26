import { getEscScript, getProfileScript, getSafeUrlScript, getStoredTokenScript } from './script-snippets.js';
import { getReviewerFeedbackControllerScript } from './reviewer-feedback-controller.js';
import { getLeadsReviewModelScript } from './leads-review-model.js';
import { getLeadsFeedbackViewScript } from './leads-feedback-view.js';
import { getLeadsReviewGuidanceScript } from './leads-review-guidance.js';
import { getLeadsReviewPanelsScript } from './leads-review-panels.js';
import { getLeadsNavigationScript } from './leads-navigation-controller.js';
import { getLeadsMutationScript } from './leads-mutation-controller.js';
import { getLeadsRendererScript } from './leads-renderer.js';

/** Browser state, loading and bootstrap. Emitted modules share this one script scope. */
export function getLeadsBrowserScript(includeGeneratedReviewGuidance) {
  return `
    ${getEscScript()}
    ${getSafeUrlScript()}
    ${getStoredTokenScript()}
    ${getProfileScript('danfoss')}
    const generatedReviewGuidanceEnabled = ${includeGeneratedReviewGuidance ? 'true' : 'false'};
    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };
    const statusColors = { NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' };
    const transitions = { NEW: ['CONTACTED'], CONTACTED: ['MEETING'], MEETING: ['PROPOSAL'], PROPOSAL: ['NEGOTIATION'], NEGOTIATION: ['WON','LOST'], LOST: ['NEW'], WON: [] };
    const reviewStatusLabels = { NEW: '새 검토', NEEDS_REVIEW: '검토 필요', APPROVED: '승인', REJECTED: '반려', DEFERRED: '보류' };
    const reviewStatuses = Object.keys(reviewStatusLabels);
    const verificationStatusLabels = { verified: '검증됨', needs_review: '검증 필요', draft: '초안', unverified: '미검증' };
    const generationModeLabels = { llm: 'LLM 생성', heuristic: '휴리스틱 생성', demo: '데모', unavailable: '생성 불가' };
    const confidenceLabels = { HIGH: '신뢰도 HIGH', MEDIUM: '신뢰도 MEDIUM', LOW: '신뢰도 LOW' };
    const queueLaneLabels = {
      approval_candidates: '승인 후보',
      needs_evidence: '보강 필요',
      risk_review: '리스크 확인',
      low_priority: '낮은 우선순위'
    };
    const queueLaneDescriptions = {
      approval_candidates: '검토 결정 또는 후속 준비 가능',
      needs_evidence: '근거, 공백, 보강 확인 대상',
      risk_review: '충돌 또는 검토 상태 리스크 확인',
      low_priority: '반려, 보류, 재검토 대기'
    };
    const reviewerFeedbackLabels = {
      actionUsefulness: {
        useful: '유용함',
        partially_useful: '부분 유용',
        not_useful: '유용하지 않음',
        unclear: '불명확'
      },
      outcomeLabel: {
        interested: '관심 있음',
        not_fit: '부적합',
        no_response: '응답 없음',
        needs_more_research: '추가 조사 필요',
        duplicate: '중복',
        deferred: '보류',
        unknown: '알 수 없음'
      },
      dataGapPriority: {
        none: '없음',
        low: '낮음',
        medium: '중간',
        high: '높음',
        blocking: '차단'
      },
      evidenceConfidenceAdjustment: {
        increase: '상향',
        decrease: '하향',
        unchanged: '유지',
        unknown: '알 수 없음'
      }
    };
    const reviewQueueFilters = {
      reviewStatus: 'all',
      verificationStatus: 'all',
      generationMode: 'all',
      confidence: 'all',
      gateStatus: 'all',
      queueLane: 'all',
      nextReviewAction: 'all',
      reviewPriority: 'all',
      riskFlag: 'all',
      missingInfo: 'all',
      dataGaps: 'all'
    };
    ${getReviewerFeedbackControllerScript({
      findLead: 'findCachedLead',
      onSaved: 'renderCurrentLeads',
      onConflict: '(leadId) => loadLeads({ focusLeadId: leadId })'
    })}
    const reviewActionCopy = {
      prepare_human_follow_up: ['후속 준비', '검토를 마친 리드입니다. 후속 준비에 필요한 근거와 제안 내용을 확인하세요.'],
      decide_review_status: ['검토 결정', '현재 근거를 확인하고 승인 여부를 결정하세요.'],
      verify_evidence: ['근거 확인', '원문 근거와 출처를 확인한 뒤 검토 결과를 정하세요.'],
      resolve_data_gaps: ['데이터 공백 보강', '누락된 정보를 확인하고 판단에 필요한 내용을 보강하세요.'],
      enrich_before_review: ['보강 후 검토', '판단에 필요한 정보가 부족합니다. 정보를 보강한 뒤 검토하세요.'],
      refresh_signal: ['신호 갱신', '현재도 유효한 영업 기회인지 최신 근거를 확인하세요.'],
      reconcile_review_conflict: ['리스크 조정', '승인 상태와 근거 사이의 불일치를 다시 확인하세요.'],
      schedule_recheck: ['재검토 예약', '보류한 리드를 언제 다시 검토할지 확인하세요.'],
      keep_out_of_queue: ['우선순위 제외', '반려한 리드입니다. 새로운 근거가 있을 때 재검토하세요.']
    };
    function reviewActionLabel(item) { return (reviewActionCopy[item.nextReviewAction] || ['검토 정보 확인'])[0]; }
    function reviewActionExplanation(item) { return (reviewActionCopy[item.nextReviewAction] || ['', '리드의 근거와 누락 정보를 확인하세요.'])[1]; }
    function reviewPriorityLabel(value) { return ({ high: '높음', medium: '중간', low: '낮음', hold: '보류', blocked: '차단' })[value] || '확인 필요'; }


    ${getLeadsReviewModelScript(includeGeneratedReviewGuidance)}
    ${getLeadsFeedbackViewScript(includeGeneratedReviewGuidance)}
    ${getLeadsReviewGuidanceScript(includeGeneratedReviewGuidance)}
    ${getLeadsReviewPanelsScript()}
    ${getLeadsNavigationScript()}
    ${getLeadsMutationScript()}
    ${getLeadsRendererScript()}
    function renderLeadsLoadError(statusCode) {
      cachedLeads = [];
      setReviewSessionStatus('', 'idle');
      if (statusCode === 401 || statusCode === 403) reviewerFeedbackDrafts.clear();
      cacheReviewerActionQueue(null);
      document.getElementById('leadsSummary').innerHTML = '';
      document.getElementById('nextReviewStrip').innerHTML = '';
      const needsAuth = statusCode === 401;
      const message = needsAuth ? '인증이 필요합니다. 비밀번호를 입력한 뒤 다시 조회하세요.'
        : statusCode === 403 ? '이 리드 목록에 접근할 권한이 없습니다. 관리자에게 문의하세요.'
        : statusCode === 503 ? '서버 설정 또는 데이터 준비 상태를 확인해야 합니다. 잠시 후 다시 시도하세요.'
        : '리드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.';
      const signIn = '/?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
      const content = '<div role="alert"><p>' + message + '</p>'
        + (needsAuth ? '<a class="btn btn-secondary" href="' + esc(signIn) + '">인증하고 다시 보기</a>'
          : '<button class="btn btn-secondary" type="button" onclick="loadLeads()">다시 시도</button>') + '</div>';
      document.getElementById('leadsList').innerHTML = content;
      document.getElementById('kanbanView').innerHTML = content;
    }

    async function loadLeads(options = {}) {
      try {
        const res = await fetch('/api/leads?profile=' + getProfile(), {headers:authHeaders()});
        if (!res.ok) { renderLeadsLoadError(res.status); return; }
        const data = await res.json();
        if (!Array.isArray(data.leads)) { renderLeadsLoadError(500); return; }
        const container = document.getElementById('leadsList');
        const summaryContainer = document.getElementById('leadsSummary');

        cacheManualReviewNotesAccess(data.manualReviewNotesAccess);

        if (!data.leads || data.leads.length === 0) {
          summaryContainer.innerHTML = '';
          const nextReviewStrip = document.getElementById('nextReviewStrip');
          if (nextReviewStrip) nextReviewStrip.innerHTML = renderNextReviewStrip([]);
          container.innerHTML = '<p style="color:#aaa;">아직 생성된 리드가 없습니다. 메인 페이지에서 보고서를 먼저 생성하세요.</p>';
          cachedLeads = [];
          cacheReviewerActionQueue(data.reviewerActionQueue);
          if (currentView === 'kanban') renderKanban([]);
          return;
        }

        cachedLeads = data.leads;
        cacheReviewerActionQueue(data.reviewerActionQueue);
        renderCurrentLeads();
        if (options.focusLeadId) {
          requestAnimationFrame(() => {
            const card = currentView === 'kanban'
              ? [...document.querySelectorAll('#kanbanView .kanban-card')].find((item) => item.dataset.leadId === options.focusLeadId)
              : findLeadCard(options.focusLeadId);
            if (card) {
              card.classList.add('review-session-focus');
              card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }
      } catch(e) {
        renderLeadsLoadError(500);
      }
    }
    let currentView = 'list';
    let cachedLeads = [];
    let cachedReviewerQueue = { items: [], lanes: [] };
    let cachedQueueItemsByLeadId = {};
    let cachedManualReviewNotesAccess = null;
    let shortcutHelpOpen = false;
    let sessionActivity = {
      copiedNotes: 0,
      reviewUpdates: 0,
      focusMoves: 0,
      filterResets: 0,
      lastAction: '세션 시작됨'
    };

    document.getElementById('historyLink').href = '/history?profile=' + encodeURIComponent(getProfile());
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    document.addEventListener('click', (event) => {
      const copyButton = event.target.closest('[data-note-copy-action]');
      if (copyButton) {
        event.preventDefault();
        copyReviewNote(copyButton);
        return;
      }
      const shortcutButton = event.target.closest('[data-shortcut-action="toggle-help"]');
      if (shortcutButton) {
        event.preventDefault();
        toggleShortcutHelp();
        return;
      }
      const button = event.target.closest('[data-session-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.sessionAction;
      const leadId = button.dataset.leadId || '';
      if (action === 'focus-next') {
        scrollToNextReviewLead(leadId);
        return;
      }
      if (action === 'focus-session') {
        focusLeadReviewSession();
        return;
      }
      if (action === 'review-status') {
        const nextStatus = button.dataset.reviewStatus || '';
        const lead = findCachedLead(leadId);
        if (!lead || !reviewStatuses.includes(nextStatus)) {
          setReviewSessionStatus('빠른 검토 작업을 실행할 리드를 찾지 못했습니다.', 'error');
          return;
        }
        updateReviewStatus(leadId, nextStatus, getReviewStatus(lead), { focusLeadId: leadId });
      }
    });
    const viewTabList = document.querySelector('[role="tablist"][aria-label="리드 보기 전환"]');
    if (viewTabList) viewTabList.addEventListener('keydown', handleViewTabRovingKeydown);
    document.addEventListener('keydown', handleReviewerShortcut);
    window.addEventListener('beforeunload', (event) => {
      if (!reviewerFeedbackDrafts.size) return;
      event.preventDefault();
      event.returnValue = '';
    });
    window.setReviewQueueFilter = setReviewQueueFilter;
    window.resetReviewQueueFilters = resetReviewQueueFilters;
    window.scrollToNextReviewLead = scrollToNextReviewLead;
    window.copyReviewNote = copyReviewNote;
    window.handleReviewerShortcut = handleReviewerShortcut;
    window.handleViewTabRovingKeydown = handleViewTabRovingKeydown;

    restoreListNavigationState();
    loadLeads({ focusLeadId: new URLSearchParams(window.location.search).get('focusLeadId') });
`;
}
