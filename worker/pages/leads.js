import { getCommonStyles } from './common-styles.js';
import { getEscScript, getProfileScript, getSafeUrlScript, getStoredTokenScript } from './script-snippets.js';

export function getLeadsPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드 상세 보기</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .leads-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin:12px 0 18px; }
    .summary-card { background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:14px; text-align:left; }
    .summary-card .label { color:#8fa4b8; font-size:11px; display:block; margin-bottom:6px; }
    .summary-card .value { color:#f4f7fb; font-size:22px; font-weight:700; display:block; }
    .summary-card .meta { color:#9fb0c0; font-size:12px; margin-top:6px; }
    .lead-card { background: linear-gradient(180deg, #182433 0%, #121b27 100%); border-radius: 14px; padding: 18px; margin: 16px 0; border: 1px solid #26384c; }
    .lead-card.grade-a { box-shadow: 0 12px 28px rgba(233,69,96,0.14); border-color:#e94560; }
    .lead-card.grade-b { border-color: #f39c12; box-shadow: 0 10px 24px rgba(243,156,18,0.12); }
    .lead-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:12px; }
    .lead-title h3 { color: #f4f7fb; margin: 0 0 8px 0; font-size: 19px; line-height:1.4; }
    .lead-subtitle { color:#a9b9c8; font-size:13px; line-height:1.6; }
    .lead-badges { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .lead-status-row { margin:8px 0 0; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .lead-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:14px 0; }
    .lead-metric { background:#121a24; border:1px solid #223447; border-radius:10px; padding:10px 12px; }
    .lead-metric .metric-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:4px; }
    .lead-metric .metric-value { display:block; color:#f4f7fb; font-size:14px; font-weight:700; line-height:1.5; }
    .lead-sections { display:grid; gap:10px; }
    .lead-block { background:#121a24; border:1px solid #223447; border-radius:10px; padding:12px; }
    .lead-block .block-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em; }
    .lead-block .block-value { color:#d4deea; font-size:13px; line-height:1.7; }
    .lead-sources { margin-top: 12px; padding-top: 12px; border-top: 1px solid #2a3a4a; }
    .lead-sources summary { color: #aaa; font-size: 13px; cursor: pointer; }
    .lead-sources summary:hover { color: #fff; }
    .lead-sources ul { list-style: none; padding: 8px 0 0 0; margin: 0; }
    .lead-sources li { margin: 4px 0; }
    .lead-sources a { color: #3498db; text-decoration: none; font-size: 13px; }
    .lead-sources a:hover { color: #5dade2; text-decoration: underline; }
    .lead-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .lead-actions a { font-size: 12px; padding: 6px 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .badge-status { background: #3498db; color: #fff; margin-left: 8px; }
    .badge-status.contacted { background: #9b59b6; }
    .badge-status.meeting { background: #e67e22; }
    .badge-status.proposal { background: #1abc9c; }
    .badge-status.negotiation { background: #2980b9; }
    .badge-status.won { background: #27ae60; }
    .badge-status.lost { background: #7f8c8d; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .top-nav-links { display: flex; gap: 8px; }
    .status-select { padding: 4px 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 12px; cursor: pointer; }
    .notes-section { margin-top: 10px; }
    .notes-section summary { color: #aaa; font-size: 13px; cursor: pointer; }
    .notes-textarea { width: 100%; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #ccc; font-size: 13px; resize: vertical; margin-top: 6px; font-family: inherit; }
    .notes-saved { color: #27ae60; font-size: 11px; margin-left: 8px; opacity: 0; transition: opacity 0.3s; }
    .notes-saved.show { opacity: 1; }
    .csv-btn { margin-left: auto; }
    .view-tabs { display: flex; gap: 0; margin-bottom: 16px; }
    .view-tab { flex: 1; padding: 10px; text-align: center; font-size: 13px; font-weight: bold; color: #aaa; background: #1e2a3a; border: 1px solid #2a3a4a; cursor: pointer; transition: all 0.2s; }
    .view-tab:first-child { border-radius: 8px 0 0 8px; }
    .view-tab:last-child { border-radius: 0 8px 8px 0; }
    .view-tab.active { color: #fff; background: #e94560; border-color: #e94560; }
    .kanban-board { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 12px; min-height: 300px; }
    .kanban-col { min-width: 180px; flex: 1; background: #1a2332; border-radius: 10px; padding: 10px; }
    .kanban-col-header { font-size: 12px; font-weight: bold; color: #fff; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; text-align: center; }
    .kanban-col-count { font-size: 10px; color: rgba(255,255,255,0.7); margin-left: 4px; }
    .kanban-card { background: #1e2a3a; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; border-left: 3px solid transparent; }
    .kanban-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .kanban-card .k-company { font-size: 13px; font-weight: bold; color: #fff; margin-bottom: 4px; }
    .kanban-card .k-product { font-size: 11px; color: #aaa; margin-bottom: 6px; }
    .kanban-card .k-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
    .kanban-card .k-score { color: #e94560; font-weight: bold; }
    .kanban-card .k-followup { color: #aaa; font-size: 10px; }
    .kanban-card.followup-warn { border-left-color: #e74c3c; }
    .kanban-card.followup-warn .k-followup { color: #e74c3c; font-weight: bold; }
    .kanban-card .k-value { color: #27ae60; font-size: 11px; }
    @media (max-width: 720px) {
      .lead-head { flex-direction:column; }
      .lead-badges { justify-content:flex-start; }
      .lead-metrics, .leads-summary { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <main class="container" style="max-width:700px;">
    <nav class="top-nav" aria-label="상단 이동">
      <a href="/" class="back-link">← 메인</a>
      <div class="top-nav-links">
        <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
        <a id="historyLink" href="/history" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">전체 히스토리</a>
        <button class="btn btn-secondary csv-btn" style="font-size:12px;padding:6px 12px;" onclick="downloadCSV()">CSV 내보내기</button>
      </div>
    </nav>
    <h1 style="font-size:22px;">리드 상세 보기</h1>
    <p class="subtitle">최근 분석된 영업 기회 목록</p>

    <div class="view-tabs">
      <div class="view-tab active" onclick="switchView('list')">리스트</div>
      <div class="view-tab" onclick="switchView('kanban')">칸반 보드</div>
    </div>

    <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;margin-bottom:12px;" onclick="window.print()">PDF 인쇄</button>

    <div class="batch-enrich-bar">
      <span>미분석 리드를 AI로 심층 분석합니다 (최대 3건/회)</span>
      <button class="btn-enrich" onclick="batchEnrich(this)">일괄 상세 분석</button>
    </div>
    <div id="batchStatus" style="font-size:12px;margin-bottom:12px;min-height:16px;"></div>

    <div id="leadsSummary"></div>
    <div id="leadsList"><p style="color:#aaa;">로딩 중...</p></div>
    <div id="kanbanView" style="display:none;"></div>
  </main>

  <script>
    ${getEscScript()}
    ${getSafeUrlScript()}
    ${getStoredTokenScript()}
    function detailLink(leadId) {
      const base = '/leads/' + encodeURIComponent(leadId);
      const token = getToken();
      return token ? (base + '?token=' + encodeURIComponent(token)) : base;
    }
    ${getProfileScript('danfoss')}

    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };
    const statusColors = { NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' };
    const transitions = { NEW: ['CONTACTED'], CONTACTED: ['MEETING'], MEETING: ['PROPOSAL'], PROPOSAL: ['NEGOTIATION'], NEGOTIATION: ['WON','LOST'], LOST: ['NEW'], WON: [] };

    function renderStatusSelect(lead) {
      if (!lead.id) return '';
      const current = lead.status || 'NEW';
      const allowed = transitions[current] || [];
      if (allowed.length === 0) return \`<span class="badge badge-status \${current.toLowerCase()}">\${esc(statusLabels[current])}</span>\`;
      const opts = [current, ...allowed].map(s =>
        \`<option value="\${s}" \${s === current ? 'selected' : ''}>\${esc(statusLabels[s] || s)}</option>\`
      ).join('');
      return \`<select class="status-select" onchange="updateStatus('\${esc(lead.id)}', this.value, '\${current}')">\${opts}</select>\`;
    }

    async function updateStatus(leadId, newStatus, fromStatus) {
      if (newStatus === fromStatus) return;
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); loadLeads(); return; }
        loadLeads();
      } catch(e) { alert('상태 변경 실패: ' + e.message); }
    }

    let saveTimers = {};
    function scheduleNoteSave(leadId, textarea) {
      clearTimeout(saveTimers[leadId]);
      saveTimers[leadId] = setTimeout(() => saveNotes(leadId, textarea), 800);
    }

    async function saveNotes(leadId, textarea) {
      const indicator = textarea.parentElement.querySelector('.notes-saved');
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ notes: textarea.value })
        });
        const data = await res.json();
        if (data.success && indicator) {
          indicator.classList.add('show');
          setTimeout(() => indicator.classList.remove('show'), 2000);
        }
      } catch { /* silent */ }
    }

    async function downloadCSV() {
      try {
        const res = await fetch('/api/export/csv?profile=' + encodeURIComponent(getProfile()), { headers: authHeaders() });
        if (!res.ok) { alert('CSV 다운로드 실패'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leads_' + getProfile() + '.csv';
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

    async function loadLeads() {
      try {
        const res = await fetch('/api/leads?profile=' + getProfile(), {headers:authHeaders()});
        const data = await res.json();
        const container = document.getElementById('leadsList');
        const summaryContainer = document.getElementById('leadsSummary');

        if (!data.leads || data.leads.length === 0) {
          summaryContainer.innerHTML = '';
          container.innerHTML = '<p style="color:#aaa;">아직 생성된 리드가 없습니다. 메인 페이지에서 보고서를 먼저 생성하세요.</p>';
          cachedLeads = [];
          if (currentView === 'kanban') renderKanban([]);
          return;
        }

        cachedLeads = data.leads;
        summaryContainer.innerHTML = renderLeadsSummary(cachedLeads);
        if (currentView === 'kanban') renderKanban(cachedLeads);

        container.innerHTML = data.leads.map((lead, i) => \`
          <div class="lead-card \${lead.grade === 'A' ? 'grade-a' : lead.grade === 'B' ? 'grade-b' : ''}">
            <div class="lead-head">
              <div class="lead-title">
                <h3>\${lead.id ? \`<a href="\${detailLink(lead.id)}" style="color:inherit;text-decoration:none;">\${esc(lead.company)}</a>\` : esc(lead.company)}</h3>
                <div class="lead-subtitle">\${esc(lead.summary || '-')}</div>
                <div class="lead-status-row">
                  <span class="badge \${lead.grade === 'A' ? 'badge-a' : 'badge-b'}">\${esc(lead.grade)}등급</span>
                  \${renderStatusSelect(lead)}
                  \${lead.enriched ? '<span class="badge-enriched">심층 분석 완료</span>' : ''}
                </div>
              </div>
              <div class="lead-badges">
                <span class="badge badge-a" style="background:#3498db;">\${parseInt(lead.score) || 0}점</span>
                \${lead.signalStrength ? \`<span class="badge" style="background:#243547;color:#c5d5e6;">신호 \${parseInt(lead.signalStrength) || 0}</span>\` : ''}
                \${lead.urgency ? \`<span class="badge" style="background:\${lead.urgency === 'HIGH' ? '#e74c3c' : lead.urgency === 'LOW' ? '#7f8c8d' : '#f39c12'};color:#fff;">\${lead.urgency === 'HIGH' ? '긴급' : lead.urgency === 'LOW' ? '낮음' : '보통'}</span>\` : ''}
                \${lead.confidence ? \`<span class="badge" style="background:\${lead.confidence === 'HIGH' ? '#27ae60' : lead.confidence === 'MEDIUM' ? '#f39c12' : '#e74c3c'};color:#fff;">신뢰도 \${lead.confidence}</span>\` : ''}
                \${lead.eventType ? \`<span class="badge" style="background:#243547;color:#c5d5e6;">\${esc(lead.eventType)}</span>\` : ''}
              </div>
            </div>
            <div class="lead-metrics">
              <div class="lead-metric"><span class="metric-label">추천 제품</span><span class="metric-value">\${esc(lead.product || '-')}</span></div>
              <div class="lead-metric"><span class="metric-label">예상 ROI</span><span class="metric-value">\${esc(lead.roi) || '-'}</span></div>
              \${lead.stakeholderHint || lead.buyerRole ? \`<div class="lead-metric"><span class="metric-label">이해관계자 힌트</span><span class="metric-value">\${esc(lead.stakeholderHint || lead.buyerRole)}</span></div>\` : ''}
              \${lead.followUpDate ? \`<div class="lead-metric"><span class="metric-label">후속 일정</span><span class="metric-value">\${esc(lead.followUpDate)}</span></div>\` : ''}
            </div>
            <div class="lead-sections">
              \${lead.painPoint ? \`<div class="lead-block"><span class="block-label">핵심 Pain</span><div class="block-value">\${esc(lead.painPoint)}</div></div>\` : ''}
              \${lead.businessImpact ? \`<div class="lead-block"><span class="block-label">사업 영향</span><div class="block-value">\${esc(lead.businessImpact)}</div></div>\` : ''}
              \${lead.likelyInitiative ? \`<div class="lead-block"><span class="block-label">추정 이니셔티브</span><div class="block-value">\${esc(lead.likelyInitiative)}</div></div>\` : ''}
              \${lead.urgencyReason ? \`<div class="lead-block"><span class="block-label">우선순위 근거</span><div class="block-value">\${esc(lead.urgencyReason)}</div></div>\` : ''}
              \${lead.confidenceReason ? \`<div class="lead-block"><span class="block-label">신뢰도 근거</span><div class="block-value">\${esc(lead.confidenceReason)}</div></div>\` : ''}
              \${lead.scoreReason ? \`<div class="lead-block"><span class="block-label">점수 해설</span><div class="block-value">\${esc(lead.scoreReason)}</div></div>\` : ''}
              <div class="lead-block"><span class="block-label">영업 제안</span><div class="block-value">\${esc(lead.salesPitch)}</div></div>
              <div class="lead-block"><span class="block-label">시장 트렌드</span><div class="block-value">\${esc(lead.globalContext) || '-'}</div></div>
            </div>
            \${lead.enriched ? \`
            <div class="enriched-details">
              <details>
                <summary>심층 분석 상세 보기</summary>
                <div class="enriched-content">
                  \${lead.keyFigures && lead.keyFigures.length > 0 ? \`<div class="enriched-block"><h4>핵심 수치</h4><ul>\${lead.keyFigures.map(f => \`<li>\${esc(f)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.painPoints && lead.painPoints.length > 0 ? \`<div class="enriched-block"><h4>고객 과제 (정량)</h4><ul>\${lead.painPoints.map(p => \`<li>\${esc(p)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.actionItems && lead.actionItems.length > 0 ? \`<div class="enriched-block"><h4>후속 실행 항목</h4><ul>\${lead.actionItems.map(a => \`<li>\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.meddic && Object.keys(lead.meddic).length > 0 ? \`<div class="enriched-block"><h4>MEDDIC 분석</h4><ul>
                    \${lead.meddic.budget ? \`<li><strong>예산:</strong> \${esc(lead.meddic.budget)}</li>\` : ''}
                    \${lead.meddic.authority ? \`<li><strong>의사결정:</strong> \${esc(lead.meddic.authority)}</li>\` : ''}
                    \${lead.meddic.need ? \`<li><strong>핵심 니즈:</strong> \${esc(lead.meddic.need)}</li>\` : ''}
                    \${lead.meddic.timeline ? \`<li><strong>타임라인:</strong> \${esc(lead.meddic.timeline)}</li>\` : ''}
                    \${lead.meddic.decisionProcess ? \`<li><strong>구매 프로세스:</strong> \${esc(lead.meddic.decisionProcess)}</li>\` : ''}
                    \${lead.meddic.champion ? \`<li><strong>챔피언:</strong> \${esc(lead.meddic.champion)}</li>\` : ''}
                  </ul></div>\` : ''}
                  \${lead.competitive && Object.keys(lead.competitive).length > 0 ? \`<div class="enriched-block"><h4>경쟁 인텔리전스</h4><ul>
                    \${lead.competitive.currentVendor ? \`<li><strong>현재 벤더:</strong> \${esc(lead.competitive.currentVendor)}</li>\` : ''}
                    \${lead.competitive.competitors ? \`<li><strong>경쟁사:</strong> \${esc(lead.competitive.competitors)}</li>\` : ''}
                    \${lead.competitive.ourAdvantage ? \`<li><strong>우리 차별점:</strong> \${esc(lead.competitive.ourAdvantage)}</li>\` : ''}
                    \${lead.competitive.switchBarrier ? \`<li><strong>전환 장벽:</strong> \${esc(lead.competitive.switchBarrier)}</li>\` : ''}
                  </ul></div>\` : ''}
                  \${lead.buyingSignals && lead.buyingSignals.length > 0 ? \`<div class="enriched-block"><h4>구매 신호</h4><ul>\${lead.buyingSignals.map(s => \`<li>\${esc(s)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.evidence && lead.evidence.length > 0 ? \`<div class="enriched-block"><h4>근거 (Evidence)</h4><ul>\${lead.evidence.map(e => \`<li><strong>[\${esc(e.field)}]</strong> "\${esc(e.quote)}" \${e.sourceUrl ? \`<a href="\${esc(e.sourceUrl)}" target="_blank" style="color:#3498db;font-size:11px;">출처</a>\` : ''}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.missingInformation && lead.missingInformation.length > 0 ? \`<div class="enriched-block" style="background:#2a2230;border-left:3px solid #9b59b6;padding:8px 12px;"><h4 style="color:#d2b4de;">추가 확인 필요</h4><ul>\${lead.missingInformation.map(item => \`<li style="color:#e8daef;">\${esc(item)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.assumptions && lead.assumptions.length > 0 ? \`<div class="enriched-block" style="background:#fff3cd;border-left:3px solid #f39c12;padding:8px 12px;"><h4 style="color:#856404;">가정 (Assumptions)</h4><ul>\${lead.assumptions.map(a => \`<li style="color:#856404;">\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.enrichedAt ? \`<p style="color:#666;font-size:11px;margin-top:8px;">분석일: \${esc(lead.enrichedAt.split('T')[0])}</p>\` : ''}
                </div>
              </details>
            </div>\` : ''}
            \${lead.sources && lead.sources.length > 0 ? \`
            <div class="lead-sources">
              <details>
                <summary>출처 보기 (\${lead.sources.length}건)</summary>
                <ul>
                  \${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}
                </ul>
              </details>
            </div>\` : ''}
            \${lead.id ? \`
            <div class="notes-section">
              <details>
                <summary>메모 \${lead.notes ? '(작성됨)' : ''}<span class="notes-saved">저장됨</span></summary>
                <textarea class="notes-textarea" placeholder="메모를 입력하세요..."
                  oninput="scheduleNoteSave('\${esc(lead.id)}', this)"
                  onblur="saveNotes('\${esc(lead.id)}', this)">\${esc(lead.notes || '')}</textarea>
              </details>
            </div>\` : ''}
            <div class="lead-actions">
              <a href="/ppt?profile=\${encodeURIComponent(getProfile())}&lead=\${i}" class="btn btn-secondary">PPT 생성</a>
              <a href="/roleplay?profile=\${encodeURIComponent(getProfile())}&lead=\${i}" class="btn btn-secondary">영업 연습</a>
              \${lead.id && !lead.enriched ? \`<button class="btn-enrich" onclick="enrichLead('\${esc(lead.id)}', this)">상세 분석</button>\` : ''}
              \${lead.id && lead.enriched ? \`<button class="btn-enrich" style="opacity:0.6" onclick="enrichLead('\${esc(lead.id)}', this, true)" title="재분석">재분석</button>\` : ''}
            </div>
          </div>
        \`).join('');
      } catch(e) {
        document.getElementById('leadsList').innerHTML = '<p style="color:#e74c3c;">데이터 로드 실패: ' + esc(e.message) + '</p>';
      }
    }
    let currentView = 'list';
    let cachedLeads = [];

    function switchView(view) {
      currentView = view;
      document.querySelectorAll('.view-tab').forEach((t, i) => {
        t.classList.toggle('active', (i === 0 && view === 'list') || (i === 1 && view === 'kanban'));
      });
      document.getElementById('leadsList').style.display = view === 'list' ? '' : 'none';
      document.getElementById('kanbanView').style.display = view === 'kanban' ? '' : 'none';
      const container = document.querySelector('.container');
      container.style.maxWidth = view === 'kanban' ? '1400px' : '700px';
      if (view === 'kanban') renderKanban(cachedLeads);
    }

    function renderKanban(leads) {
      const order = ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON','LOST'];
      const groups = {};
      order.forEach(s => groups[s] = []);
      leads.forEach(l => { const s = l.status || 'NEW'; if (groups[s]) groups[s].push(l); });

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      let html = '<div class="kanban-board" style="max-width:100%;overflow-x:auto;">';
      order.forEach(s => {
        const cards = groups[s];
        html += '<div class="kanban-col">';
        html += '<div class="kanban-col-header" style="background:' + statusColors[s] + '">' + esc(statusLabels[s]) + '<span class="kanban-col-count">(' + cards.length + ')</span></div>';
        cards.forEach(l => {
          const fu = l.followUpDate || '';
          const isWarn = fu && fu <= today;
          html += '<div class="kanban-card' + (isWarn ? ' followup-warn' : '') + '" onclick="location.href=\\'' + detailLink(l.id) + '\\'">';
          html += '<div class="k-company">' + esc(l.company) + '</div>';
          html += '<div class="k-product">' + esc(l.product || l.summary || '-') + '</div>';
          html += '<div class="k-meta">';
          html += '<span class="k-score">' + esc(l.grade) + ' ' + l.score + '점</span>';
          if (l.estimatedValue) html += '<span class="k-value">' + l.estimatedValue.toLocaleString() + '만</span>';
          html += '</div>';
          if (fu) {
            html += '<div class="k-followup">' + (isWarn ? '⚠ ' : '') + esc(fu) + '</div>';
          }
          html += '</div>';
        });
        if (cards.length === 0) html += '<p style="color:#555;font-size:11px;text-align:center;padding:20px 0;">없음</p>';
        html += '</div>';
      });
      html += '</div>';
      document.getElementById('kanbanView').innerHTML = html;
    }

    function renderLeadsSummary(leads) {
      const total = leads.length;
      const gradeA = leads.filter(l => l.grade === 'A').length;
      const enriched = leads.filter(l => l.enriched).length;
      const avgScore = Math.round(leads.reduce((sum, lead) => sum + (parseInt(lead.score, 10) || 0), 0) / Math.max(1, total));
      return \`
        <div class="leads-summary">
          <div class="summary-card"><span class="label">총 리드</span><span class="value">\${total}</span><div class="meta">현재 프로필 기준 전체 건수</div></div>
          <div class="summary-card"><span class="label">A등급</span><span class="value">\${gradeA}</span><div class="meta">우선 제안 후보</div></div>
          <div class="summary-card"><span class="label">평균 점수</span><span class="value">\${avgScore}</span><div class="meta">기사 신호 기준 평균</div></div>
          <div class="summary-card"><span class="label">심층 분석 완료</span><span class="value">\${enriched}</span><div class="meta">추가 근거가 확보된 리드</div></div>
        </div>
      \`;
    }

    document.getElementById('historyLink').href = '/history?profile=' + encodeURIComponent(getProfile());
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

    loadLeads();
  </script>
</body>
</html>`;
}
