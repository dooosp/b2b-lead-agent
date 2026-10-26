/** Filter/navigation state, roving tabs, safe shortcuts and copy controls. */
export function getLeadsNavigationScript() {
  return `    function leadListReturnUrl(leadId) {
      const url = new URL(window.location.href);
      if (leadId) url.searchParams.set('focusLeadId', leadId);
      return url.pathname + url.search;
    }
    function leadToolLink(path, leadId) {
      return path + '?profile=' + encodeURIComponent(getProfile()) + '&leadId=' + encodeURIComponent(leadId || '')
        + '&returnTo=' + encodeURIComponent(leadListReturnUrl(leadId));
    }
    function detailLink(leadId) {
      return '/leads/' + encodeURIComponent(leadId) + '?returnTo=' + encodeURIComponent(leadListReturnUrl(leadId));
    }
    async function openLeadDetail(leadId, event) {
      if (!leadId) return;
      if (event) event.preventDefault();
      if (reviewerFeedbackDrafts.size && !window.confirm('저장 전 리뷰어 피드백이 있습니다. 초안을 버리고 이동할까요?')) return;
      try {
        const href = detailLink(leadId);
        const res = await fetch(href, { headers: authHeaders() });
        const html = await res.text();
        if (!res.ok) { document.open(); document.write(html); document.close(); return; }
        history.pushState(null, '', href);
        document.open(); document.write(html); document.close();
      } catch(e) { window.location.href = detailLink(leadId); }
    }
    function applyReviewQueueFilters(leads) {
      return (Array.isArray(leads) ? leads : []).filter((lead) => {
        const queueItem = getLeadQueueItem(lead);
        if (reviewQueueFilters.reviewStatus !== 'all' && getReviewStatus(lead) !== reviewQueueFilters.reviewStatus) return false;
        if (reviewQueueFilters.verificationStatus !== 'all' && getVerificationStatus(lead) !== reviewQueueFilters.verificationStatus) return false;
        if (reviewQueueFilters.generationMode !== 'all' && getGenerationMode(lead) !== reviewQueueFilters.generationMode) return false;
        if (reviewQueueFilters.confidence !== 'all' && getConfidence(lead) !== reviewQueueFilters.confidence) return false;
        if (reviewQueueFilters.gateStatus !== 'all' && buildLeadListReviewGate(lead).state !== reviewQueueFilters.gateStatus) return false;
        if (reviewQueueFilters.queueLane !== 'all' && queueItem.queueLane !== reviewQueueFilters.queueLane) return false;
        if (reviewQueueFilters.nextReviewAction !== 'all' && queueItem.nextReviewAction !== reviewQueueFilters.nextReviewAction) return false;
        if (reviewQueueFilters.reviewPriority !== 'all' && queueItem.reviewPriority !== reviewQueueFilters.reviewPriority) return false;
        if (reviewQueueFilters.riskFlag === 'has' && queueItem.riskCount === 0) return false;
        if (reviewQueueFilters.riskFlag === 'none' && queueItem.riskCount > 0) return false;
        if (
          reviewQueueFilters.riskFlag !== 'all'
          && reviewQueueFilters.riskFlag !== 'has'
          && reviewQueueFilters.riskFlag !== 'none'
          && !(queueItem.riskFlags || []).some((flag) => flag.code === reviewQueueFilters.riskFlag)
        ) return false;
        if (reviewQueueFilters.missingInfo === 'has' && queueItem.missingInfoCount === 0) return false;
        if (reviewQueueFilters.missingInfo === 'none' && queueItem.missingInfoCount > 0) return false;
        const gapCount = getDataGaps(lead).length;
        if (reviewQueueFilters.dataGaps === 'has' && gapCount === 0) return false;
        if (reviewQueueFilters.dataGaps === 'none' && gapCount > 0) return false;
        return true;
      }).sort((a, b) => {
        const aOrder = Number(getLeadQueueItem(a).sortIndex);
        const bOrder = Number(getLeadQueueItem(b).sortIndex);
        return (Number.isFinite(aOrder) ? aOrder : 9999) - (Number.isFinite(bOrder) ? bOrder : 9999);
      });
    }

    function getFilteredLeads() {
      return applyReviewQueueFilters(cachedLeads);
    }

    function syncListNavigationState() {
      const url = new URL(window.location.href);
      Object.entries(reviewQueueFilters).forEach(([key, value]) => {
        if (value === 'all') url.searchParams.delete(key);
        else url.searchParams.set(key, value);
      });
      if (currentView === 'kanban') url.searchParams.set('view', currentView);
      else url.searchParams.delete('view');
      window.history.replaceState(null, '', url.pathname + url.search);
      const advancedCount = Object.entries(reviewQueueFilters).filter(([key, value]) => !['reviewStatus', 'verificationStatus'].includes(key) && value !== 'all').length;
      document.getElementById('advancedFilterCount').textContent = advancedCount ? '(' + advancedCount + '개 적용)' : '';
    }

    function restoreListNavigationState() {
      const params = new URLSearchParams(window.location.search);
      document.querySelectorAll('#reviewQueueFilters [data-filter-key]').forEach((select) => {
        const value = params.get(select.dataset.filterKey);
        if (value && [...select.options].some((option) => option.value === value)) {
          select.value = value;
          reviewQueueFilters[select.dataset.filterKey] = value;
        }
      });
      switchView(params.get('view'));
      document.getElementById('advancedReviewFilters').open = [...document.querySelectorAll('#advancedReviewFilters select')].some((select) => select.value !== 'all');
    }

    function setReviewQueueFilter(select) {
      const key = select && select.dataset ? select.dataset.filterKey : '';
      if (!Object.prototype.hasOwnProperty.call(reviewQueueFilters, key)) return;
      reviewQueueFilters[key] = select.value || 'all';
      syncListNavigationState();
      renderCurrentLeads();
    }

    function resetReviewQueueFilters() {
      Object.keys(reviewQueueFilters).forEach((key) => { reviewQueueFilters[key] = 'all'; });
      document.querySelectorAll('#reviewQueueFilters [data-filter-key]').forEach((select) => { select.value = 'all'; });
      syncListNavigationState();
      recordSessionActivity('filterReset', '필터를 초기화했습니다.');
      renderCurrentLeads();
    }

    function setReviewSessionStatus(message, tone = 'idle') {
      const el = document.getElementById('reviewSessionStatus');
      if (!el) return;
      el.className = 'review-session-status is-' + tone;
      el.textContent = message || '';
    }

    function updateSessionActivitySummary() {
      const counts = document.getElementById('reviewProductivityCounts');
      if (counts) {
        counts.innerHTML = [
          '<span>노트 복사 ' + sessionActivity.copiedNotes + '건</span>',
          '<span>상태 변경 ' + sessionActivity.reviewUpdates + '건</span>',
          '<span>포커스 이동 ' + sessionActivity.focusMoves + '건</span>',
          '<span>필터 초기화 ' + sessionActivity.filterResets + '건</span>'
        ].join('');
      }
      const last = document.getElementById('reviewProductivityLastAction');
      if (last) last.textContent = '마지막 작업: ' + (sessionActivity.lastAction || '세션 활동 없음');
    }

    function recordSessionActivity(type, message) {
      if (type === 'noteCopied') sessionActivity.copiedNotes += 1;
      if (type === 'reviewUpdateSucceeded') sessionActivity.reviewUpdates += 1;
      if (type === 'focusNextLead' || type === 'focusQueue' || type === 'focusSession') sessionActivity.focusMoves += 1;
      if (type === 'filterReset') sessionActivity.filterResets += 1;
      sessionActivity.lastAction = message || '세션 활동 업데이트';
      updateSessionActivitySummary();
    }

    function findCachedLead(leadId) {
      return cachedLeads.find((lead) => getLeadId(lead) === String(leadId || '')) || null;
    }

    function findLeadCard(leadId) {
      return [...document.querySelectorAll('#leadsList .lead-card')]
        .find((card) => card.dataset.leadId === String(leadId || '')) || null;
    }

    function scrollToNextReviewLead(leadId) {
      const targetLeadId = leadId || (getSessionState(getFilteredLeads()).nextItem || {}).leadId;
      if (!targetLeadId) {
        setReviewSessionStatus('현재 필터에서 이동할 다음 검토 리드가 없습니다.', 'error');
        recordSessionActivity('shortcutUnavailable', '다음 검토 리드가 없습니다.');
        return;
      }
      if (currentView !== 'list') switchView('list');
      const card = findLeadCard(targetLeadId);
      if (!card) {
        setReviewSessionStatus('다음 검토 리드가 현재 필터 결과에 없습니다.', 'error');
        recordSessionActivity('shortcutUnavailable', '다음 검토 리드를 찾지 못했습니다.');
        return;
      }
      document.querySelectorAll('.lead-card.review-session-focus').forEach((item) => item.classList.remove('review-session-focus'));
      card.classList.add('review-session-focus');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.focus({ preventScroll: true });
      const lead = findCachedLead(targetLeadId);
      const message = (lead && lead.company ? lead.company : '다음 리드') + ' 카드로 이동했습니다.';
      recordSessionActivity('focusNextLead', message);
      setReviewSessionStatus(message, 'success');
    }

    function focusReviewerActionQueue() {
      document.getElementById('reviewOverview').open = true;
      const queue = document.getElementById('reviewerActionQueue');
      if (!queue) {
        setReviewSessionStatus('Reviewer Action Queue를 찾지 못했습니다.', 'error');
        recordSessionActivity('shortcutUnavailable', 'Reviewer Action Queue를 찾지 못했습니다.');
        return;
      }
      queue.focus({ preventScroll: true });
      queue.scrollIntoView({ behavior: 'smooth', block: 'start' });
      recordSessionActivity('focusQueue', 'Reviewer Action Queue로 이동했습니다.');
      setReviewSessionStatus('Reviewer Action Queue로 이동했습니다.', 'success');
    }

    function focusLeadReviewSession() {
      document.getElementById('reviewOverview').open = true;
      const session = document.getElementById('leadReviewSession');
      if (!session) {
        setReviewSessionStatus('Lead Review Session을 찾지 못했습니다.', 'error');
        recordSessionActivity('shortcutUnavailable', 'Lead Review Session을 찾지 못했습니다.');
        return;
      }
      session.focus({ preventScroll: true });
      session.scrollIntoView({ behavior: 'smooth', block: 'start' });
      recordSessionActivity('focusSession', 'Lead Review Session으로 이동했습니다.');
      setReviewSessionStatus('Lead Review Session으로 이동했습니다.', 'success');
    }

    function getReviewNoteTextElement(source) {
      const root = source && source.closest
        ? source.closest('.review-note-variant, .review-note-suggestion') || document
        : document;
      return root.querySelector('[data-review-note-text]');
    }

    function getActiveReviewNoteTextElement() {
      const active = document.activeElement;
      const activeNote = active && active.closest
        ? active.closest('.review-note-variant, .review-note-suggestion')
        : null;
      if (activeNote) {
        const activeText = activeNote.querySelector('[data-review-note-text]');
        if (activeText) return activeText;
      }
      return document.querySelector('.review-session-panel [data-review-note-text]');
    }

    function selectTextForManualCopy(target) {
      if (!target || !window.getSelection || !document.createRange) return false;
      document.querySelectorAll('.review-note-copy-target.is-manual-copy').forEach((item) => item.classList.remove('is-manual-copy'));
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      target.classList.add('is-manual-copy');
      target.focus({ preventScroll: true });
      return true;
    }

    function showCopyButtonFeedback(button, label) {
      if (!button) return;
      const original = button.dataset.originalLabel || button.textContent;
      button.dataset.originalLabel = original;
      button.textContent = label;
      clearTimeout(button._copyFeedbackTimer);
      button._copyFeedbackTimer = setTimeout(() => {
        button.textContent = button.dataset.originalLabel || original;
      }, 1600);
    }

    async function copyReviewNote(source) {
      document.getElementById('reviewOverview').open = true;
      const button = source && source.closest ? source.closest('[data-note-copy-action]') : null;
      const target = getReviewNoteTextElement(button || source) || getActiveReviewNoteTextElement();
      const text = target ? String(target.textContent || '').trim() : '';
      if (!text) {
        recordSessionActivity('copyUnavailable', '복사할 리뷰 노트를 찾지 못했습니다.');
        setReviewSessionStatus('복사할 리뷰 노트를 찾지 못했습니다.', 'error');
        return false;
      }

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          recordSessionActivity('noteCopied', '리뷰 노트를 클립보드에 복사했습니다.');
          setReviewSessionStatus('리뷰 노트를 복사했습니다. 저장하거나 전송하지 않았습니다.', 'success');
          showCopyButtonFeedback(button, '복사됨');
          return true;
        }
      } catch {
        // Fall through to the manual-copy state below.
      }

      if (selectTextForManualCopy(target)) {
        recordSessionActivity('manualCopyReady', 'Clipboard API를 사용할 수 없어 수동 복사 상태로 전환했습니다.');
        setReviewSessionStatus('Clipboard API를 사용할 수 없어 노트 텍스트를 선택했습니다. 직접 복사하세요.', 'pending');
        showCopyButtonFeedback(button, '직접 복사');
        return false;
      }

      recordSessionActivity('copyFailed', '리뷰 노트를 복사하지 못했습니다.');
      setReviewSessionStatus('리뷰 노트를 복사하지 못했습니다. 노트 텍스트를 직접 선택해 복사하세요.', 'error');
      return false;
    }

    function copyActiveReviewNote() {
      return copyReviewNote(getActiveReviewNoteTextElement());
    }

    function updateShortcutHelpVisibility() {
      const help = document.getElementById('reviewShortcutHelp');
      if (help) {
        help.hidden = !shortcutHelpOpen;
        help.classList.toggle('is-hidden', !shortcutHelpOpen);
      }
      document.querySelectorAll('[data-shortcut-action="toggle-help"]').forEach((button) => {
        button.setAttribute('aria-expanded', shortcutHelpOpen ? 'true' : 'false');
      });
    }

    function toggleShortcutHelp() {
      document.getElementById('reviewOverview').open = true;
      shortcutHelpOpen = !shortcutHelpOpen;
      updateShortcutHelpVisibility();
      recordSessionActivity('shortcutHelp', shortcutHelpOpen ? '단축키 도움말을 열었습니다.' : '단축키 도움말을 닫았습니다.');
      setReviewSessionStatus(shortcutHelpOpen ? '단축키 도움말을 열었습니다.' : '단축키 도움말을 닫았습니다.', 'success');
    }

    function isInteractiveShortcutTarget(target) {
      if (!target) return false;
      const tagName = String(target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea', 'button', 'a', 'summary'].includes(tagName)) return true;
      if (target.isContentEditable || (target.closest && target.closest('[contenteditable="true"]'))) return true;
      return !!(target.closest && target.closest('[role="button"], [role="tab"], [role="menuitem"]'));
    }

    function shouldIgnoreReviewerShortcut(event) {
      if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
      return isInteractiveShortcutTarget(event.target);
    }

    function handleReviewerShortcut(event) {
      if (shouldIgnoreReviewerShortcut(event)) return;
      const key = String(event.key || '').toLowerCase();
      if (key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        toggleShortcutHelp();
        return;
      }
      if (key === 'n' || key === 'j') {
        event.preventDefault();
        scrollToNextReviewLead();
        return;
      }
      if (key === 'q') {
        event.preventDefault();
        focusReviewerActionQueue();
        return;
      }
      if (key === 'c') {
        event.preventDefault();
        copyActiveReviewNote();
      }
    }

    function getViewTabs() {
      return [...document.querySelectorAll('.view-tab[role="tab"]')];
    }

    function setRovingViewTab(tab) {
      getViewTabs().forEach((item) => {
        item.tabIndex = item === tab ? 0 : -1;
      });
    }

    function syncViewPanels(view) {
      const listPanel = document.getElementById('leadsList');
      const kanbanPanel = document.getElementById('kanbanView');
      if (listPanel) {
        listPanel.hidden = view !== 'list';
        listPanel.style.display = view === 'list' ? '' : 'none';
      }
      if (kanbanPanel) {
        kanbanPanel.hidden = view !== 'kanban';
        kanbanPanel.style.display = view === 'kanban' ? '' : 'none';
      }
    }

    function switchView(view) {
      const nextView = view === 'kanban' ? 'kanban' : 'list';
      currentView = nextView;
      syncListNavigationState();
      document.querySelectorAll('.view-tab').forEach((t) => {
        const active = t.dataset.viewTarget === nextView;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.tabIndex = active ? 0 : -1;
      });
      syncViewPanels(nextView);
      const container = document.querySelector('.container');
      container.style.maxWidth = nextView === 'kanban' ? '1400px' : '700px';
      if (nextView === 'kanban') renderKanban(getFilteredLeads());
    }

    function isRovingTextEntryTarget(target) {
      if (!target) return false;
      const tagName = String(target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea'].includes(tagName)) return true;
      return !!(target.isContentEditable || (target.closest && target.closest('[contenteditable="true"]')));
    }

    function shouldIgnoreRovingTabKey(event) {
      if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
      if (isRovingTextEntryTarget(event.target)) return true;
      return !event.target?.closest?.('[role="tablist"]');
    }

    function moveViewTabFocus(tab) {
      if (!tab) return;
      setRovingViewTab(tab);
      tab.focus({ preventScroll: true });
    }

    function activateFocusedViewTab(tab = document.activeElement) {
      const viewTab = tab && tab.closest ? tab.closest('.view-tab[role="tab"]') : null;
      const view = viewTab ? viewTab.dataset.viewTarget : '';
      if (!view) return;
      switchView(view);
    }

    function handleViewTabRovingKeydown(event) {
      if (shouldIgnoreRovingTabKey(event)) return;
      const tabs = getViewTabs();
      if (tabs.length === 0) return;
      const currentTab = event.target?.closest?.('.view-tab[role="tab"]') || document.activeElement?.closest?.('.view-tab[role="tab"]');
      const currentIndex = Math.max(0, tabs.indexOf(currentTab));
      const lastIndex = tabs.length - 1;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        moveViewTabFocus(tabs[(currentIndex + 1) % tabs.length]);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveViewTabFocus(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        moveViewTabFocus(tabs[0]);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        moveViewTabFocus(tabs[lastIndex]);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateFocusedViewTab(currentTab || document.activeElement);
      }
    }

`;
}
