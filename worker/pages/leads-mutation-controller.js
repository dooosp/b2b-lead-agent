/** Explicit review, manual-note and enrichment commands with existing version checks. */
export function getLeadsMutationScript() {
  return `    async function updateStatus(leadId, newStatus, fromStatus) {
      const epoch = leadsAccessEpoch;
      if (newStatus === fromStatus) return;
      const lead = findCachedLead(leadId);
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ status: newStatus, expectedVersion: lead && lead.version })
        });
        const data = await res.json();
        if (epoch !== leadsAccessEpoch) return;
        if (!data.success) { alert(data.message); loadLeads(); return; }
        loadLeads();
      } catch(e) { if (epoch === leadsAccessEpoch) alert('상태 변경 실패: ' + e.message); }
    }

    async function updateReviewStatus(leadId, newStatus, fromStatus, options = {}) {
      const epoch = leadsAccessEpoch;
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
        if (epoch !== leadsAccessEpoch) return;
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
        if (epoch !== leadsAccessEpoch) return;
        setReviewSessionStatus('검토 상태를 저장하지 못했습니다. 네트워크 또는 로컬 저장소를 확인한 뒤 다시 시도하세요.', 'error');
        recordSessionActivity('reviewUpdateFailed', '검토 상태 변경 실패');
        renderCurrentLeads();
      }
    }

    function syncManualNoteLead(leadId) {
      const card = findLeadCard(leadId);
      const section = card && card.querySelector('.notes-section');
      const textarea = section && section.querySelector('.notes-textarea');
      const lead = findCachedLead(leadId);
      if (!textarea || !lead) return;
      textarea.value = manualNoteController.value(lead);
      const notice = section.querySelector('[data-manual-note-notice]');
      const message = manualNoteController.notice(leadId);
      if (notice) notice.textContent = message;
      const indicator = section.querySelector('.notes-saved');
      if (indicator) {
        clearTimeout(indicator._hideTimer);
        indicator.classList.toggle('show', message === '저장됨' || message === '지워짐');
        indicator.textContent = message === '지워짐' ? '지워짐' : '저장됨';
        if (indicator.classList.contains('show')) indicator._hideTimer = setTimeout(() => indicator.classList.remove('show'), 2000);
      }
      const clearButton = section.querySelector('.notes-clear-btn');
      if (clearButton) clearButton.disabled = !String(textarea.value || '').trim();
      updateManualReviewNoteState(section, lead);
      const summary = section.querySelector('[data-manual-note-summary-state]');
      if (summary && manualNoteController.drafts.has(leadId)) summary.textContent = '저장 전';
    }

    function scheduleNoteSave(leadId, textarea) { manualNoteController.input(leadId, textarea.value); }
    function saveNotes(leadId, textarea, options = {}) { return manualNoteController.save(leadId, options.explicit === true); }
    function clearManualReviewNotes(leadId) { return manualNoteController.clear(leadId); }

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
      const epoch = leadsAccessEpoch;
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
        if (epoch !== leadsAccessEpoch) return;
        if (!data.success) { alert(data.message || '분석 실패'); btn.disabled = false; btn.textContent = '상세 분석'; return; }
        loadLeads();
      } catch(e) { if (epoch !== leadsAccessEpoch) return; alert('분석 실패: ' + e.message); btn.disabled = false; btn.textContent = '상세 분석'; }
    }

    async function batchEnrich(btn) {
      const epoch = leadsAccessEpoch;
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
        if (epoch !== leadsAccessEpoch) return;
        if (data.success) {
          statusEl.textContent = '완료: ' + data.enriched + '건 분석, ' + (data.failed || 0) + '건 실패, 잔여 ' + data.remaining + '건';
          statusEl.style.color = '#27ae60';
        } else {
          statusEl.textContent = data.message || '분석 실패';
          statusEl.style.color = '#e74c3c';
        }
        loadLeads();
      } catch(e) {
        if (epoch !== leadsAccessEpoch) return;
        statusEl.textContent = '오류: ' + e.message;
        statusEl.style.color = '#e74c3c';
      }
      btn.disabled = false;
      btn.textContent = '일괄 상세 분석';
    }

`;
}
