/** Explicit review, manual-note and enrichment commands with existing version checks. */
export function getLeadsMutationScript() {
  return `    async function updateStatus(leadId, newStatus, fromStatus) {
      if (newStatus === fromStatus) return;
      const lead = findCachedLead(leadId);
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ status: newStatus, expectedVersion: lead && lead.version })
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); loadLeads(); return; }
        loadLeads();
      } catch(e) { alert('상태 변경 실패: ' + e.message); }
    }

    async function updateReviewStatus(leadId, newStatus, fromStatus, options = {}) {
      if (newStatus === fromStatus) return;
      const lead = findCachedLead(leadId);
      const originalSalesStatus = lead ? (lead.status || 'NEW') : '';
      const label = reviewStatusLabels[newStatus] || newStatus;
      setReviewSessionStatus('검토 상태 저장 중: ' + label, 'pending');
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ reviewStatus: newStatus, expectedVersion: lead && lead.version })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          if (data.code === 'LEAD_VERSION_CONFLICT') {
            setReviewSessionStatus('다른 변경이 먼저 저장되어 최신 리드를 불러왔습니다.', 'error');
            await loadLeads({ focusLeadId: options.focusLeadId || leadId });
            return;
          }
          setReviewSessionStatus('검토 상태를 저장하지 못했습니다. 필터와 리드는 그대로 유지됩니다.', 'error');
          recordSessionActivity('reviewUpdateFailed', '검토 상태 변경 실패');
          renderCurrentLeads();
          return;
        }
        const returnedSalesStatus = data.lead ? (data.lead.status || 'NEW') : originalSalesStatus;
        const salesStatusLabel = statusLabels[returnedSalesStatus] || returnedSalesStatus || '유지';
        const message = '검토 상태만 ' + label + '(으)로 저장했습니다. 영업 상태는 ' + salesStatusLabel + ' 유지.';
        recordSessionActivity('reviewUpdateSucceeded', '검토 상태 변경: ' + label);
        setReviewSessionStatus(message, 'success');
        await loadLeads({ focusLeadId: options.focusLeadId || leadId });
      } catch(e) {
        setReviewSessionStatus('검토 상태를 저장하지 못했습니다. 네트워크 또는 로컬 저장소를 확인한 뒤 다시 시도하세요.', 'error');
        recordSessionActivity('reviewUpdateFailed', '검토 상태 변경 실패');
        renderCurrentLeads();
      }
    }

    let saveTimers = {};
    let noteMutationQueues = {};
    function scheduleNoteSave(leadId, textarea) {
      syncManualNoteControls(textarea);
      clearTimeout(saveTimers[leadId]);
      saveTimers[leadId] = setTimeout(() => saveNotes(leadId, textarea), 800);
    }

    function enqueueNoteMutation(leadId, mutation) {
      const previous = noteMutationQueues[leadId] || Promise.resolve();
      const next = previous.then(mutation);
      noteMutationQueues[leadId] = next;
      const cleanup = () => {
        if (noteMutationQueues[leadId] === next) delete noteMutationQueues[leadId];
      };
      next.then(cleanup, cleanup);
      next.catch(() => {});
      return next;
    }

    function showManualNoteIndicator(indicator, message) {
      if (!indicator) return;
      indicator.textContent = message;
      indicator.classList.add('show');
      clearTimeout(indicator._hideTimer);
      indicator._hideTimer = setTimeout(() => indicator.classList.remove('show'), 2000);
    }

    function syncManualNoteControls(textarea) {
      const section = textarea ? textarea.closest('.notes-section') : null;
      const clearButton = section ? section.querySelector('.notes-clear-btn') : null;
      if (clearButton) clearButton.disabled = !String(textarea.value || '').trim();
    }

    function saveNotes(leadId, textarea, options = {}) {
      clearTimeout(saveTimers[leadId]);
      const value = textarea.value;
      return enqueueNoteMutation(leadId, () => persistNotes(leadId, textarea, value, options));
    }

    async function persistNotes(leadId, textarea, value, options = {}) {
      const indicator = textarea.parentElement.querySelector('.notes-saved');
      const section = textarea ? textarea.closest('.notes-section') : null;
      const cachedLead = findCachedLead(leadId);
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ manualReviewNotes: value, expectedVersion: cachedLead && cachedLead.version })
        });
        const data = await res.json();
        const lead = findCachedLead(leadId);
        if (data.code === 'LEAD_VERSION_CONFLICT') {
          await loadLeads({ focusLeadId: leadId });
          throw Object.assign(new Error('manual note version conflict'), { code: data.code });
        }
        if (data.success && data.lead && lead) Object.assign(lead, data.lead);
        if (data.success && indicator) {
          const message = options.cleared || !String(value || '').trim() ? '지워짐' : '저장됨';
          showManualNoteIndicator(indicator, message);
        }
        if (data.success) updateManualReviewNoteState(section, lead);
        if (data.success) syncManualNoteControls(textarea);
      } catch (error) {
        if (error && error.code === 'LEAD_VERSION_CONFLICT') throw error;
      }
    }

    async function clearManualReviewNotes(leadId, button) {
      const section = button ? button.closest('.notes-section') : null;
      const textarea = section ? section.querySelector('.notes-textarea') : null;
      const indicator = section ? section.querySelector('.notes-saved') : null;
      if (!textarea || !String(textarea.value || '').trim()) return;
      const confirmed = window.confirm('저장된 수동 리뷰 메모를 지울까요? 생성된 리뷰 노트 제안은 그대로 유지됩니다.');
      if (!confirmed) return;
      clearTimeout(saveTimers[leadId]);
      textarea.value = '';
      button.disabled = true;
      try {
        await enqueueNoteMutation(leadId, async () => {
          const cachedLead = findCachedLead(leadId);
          try {
            const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({ manualReviewNotes: '', expectedVersion: cachedLead && cachedLead.version })
            });
            const data = await res.json();
            const lead = findCachedLead(leadId);
            if (!res.ok || !data.success) {
              if (data.code === 'LEAD_VERSION_CONFLICT') {
                await loadLeads({ focusLeadId: leadId });
                throw Object.assign(new Error('manual note version conflict'), { code: data.code });
              }
              if (lead) textarea.value = lead.manualReviewNotes || lead.notes || '';
              syncManualNoteControls(textarea);
              return;
            }
            if (data.lead && lead) Object.assign(lead, data.lead);
            showManualNoteIndicator(indicator, '지워짐');
            updateManualReviewNoteState(section, lead);
            syncManualNoteControls(textarea);
          } catch (error) {
            if (error && error.code === 'LEAD_VERSION_CONFLICT') throw error;
            const lead = findCachedLead(leadId);
            if (lead) textarea.value = lead.manualReviewNotes || lead.notes || '';
            syncManualNoteControls(textarea);
          }
        });
      } catch (error) {
        if (!error || error.code !== 'LEAD_VERSION_CONFLICT') throw error;
      }
    }

    function saveReviewerFeedback(leadId, button) {
      return reviewerFeedbackController.save(leadId, button && button.closest('.reviewer-feedback-section'), button);
    }

    function clearReviewerFeedback(leadId, button) {
      return reviewerFeedbackController.clear(leadId, button);
    }

    async function downloadCSV() {
      try {
        const res = await fetch('/api/export/csv?profile=' + encodeURIComponent(getProfile()), { headers: authHeaders() });
        if (!res.ok) { alert('CSV 다운로드 실패'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leads-' + getProfile() + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch(e) { alert('CSV 다운로드 실패: ' + e.message); }
    }

    async function enrichLead(leadId, btn, force) {
      if (!leadId) return;
      btn.disabled = true;
      btn.textContent = '분석 중...';
      try {
        const forceParam = force ? '?force=true' : '';
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId) + '/enrich' + forceParam, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() }
        });
        const data = await res.json();
        if (!data.success) { alert(data.message || '분석 실패'); btn.disabled = false; btn.textContent = '상세 분석'; return; }
        loadLeads();
      } catch(e) { alert('분석 실패: ' + e.message); btn.disabled = false; btn.textContent = '상세 분석'; }
    }

    async function batchEnrich(btn) {
      btn.disabled = true;
      btn.textContent = '일괄 분석 중...';
      const statusEl = document.getElementById('batchStatus');
      statusEl.textContent = 'AI가 리드를 심층 분석하고 있습니다...';
      statusEl.style.color = '#3498db';
      try {
        const res = await fetch('/api/leads/batch-enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ profile: getProfile() })
        });
        const data = await res.json();
        if (data.success) {
          statusEl.textContent = '완료: ' + data.enriched + '건 분석, ' + (data.failed || 0) + '건 실패, 잔여 ' + data.remaining + '건';
          statusEl.style.color = '#27ae60';
        } else {
          statusEl.textContent = data.message || '분석 실패';
          statusEl.style.color = '#e74c3c';
        }
        loadLeads();
      } catch(e) {
        statusEl.textContent = '오류: ' + e.message;
        statusEl.style.color = '#e74c3c';
      }
      btn.disabled = false;
      btn.textContent = '일괄 상세 분석';
    }

`;
}
