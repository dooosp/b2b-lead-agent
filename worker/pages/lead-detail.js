import { getCommonStyles } from './common-styles.js';

export function getLeadDetailPage(lead, statusLogs) {
  const statusLabelsJS = JSON.stringify({ NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' });
  const statusColorsJS = JSON.stringify({ NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' });
  const transitionsJS = JSON.stringify({ NEW: ['CONTACTED'], CONTACTED: ['MEETING'], MEETING: ['PROPOSAL'], PROPOSAL: ['NEGOTIATION'], NEGOTIATION: ['WON','LOST'], LOST: ['NEW'], WON: [] });
  const leadJSON = JSON.stringify(lead);
  const logsJSON = JSON.stringify(statusLogs || []);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${(lead.company || '리드').replace(/[<>"'&]/g, '')} - 리드 상세</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .detail-section { background: #1e2a3a; border-radius: 12px; padding: 20px; margin: 16px 0; text-align: left; }
    .detail-section h3 { color: #e94560; font-size: 16px; margin: 0 0 14px 0; }
    .detail-row { display: flex; gap: 8px; margin: 8px 0; font-size: 14px; line-height: 1.6; }
    .detail-row .label { color: #888; min-width: 100px; flex-shrink: 0; }
    .detail-row .value { color: #ddd; word-break: break-word; }
    .timeline { list-style: none; padding: 0; margin: 0; position: relative; }
    .timeline::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 8px; width: 2px; background: #2a3a4a; }
    .timeline li { position: relative; padding: 8px 0 8px 30px; font-size: 13px; color: #ccc; }
    .timeline li::before { content: ''; position: absolute; left: 4px; top: 14px; width: 10px; height: 10px; border-radius: 50%; background: #3498db; border: 2px solid #1e2a3a; }
    .timeline li:last-child::before { background: #e94560; }
    .timeline .time { color: #666; font-size: 11px; display: block; }
    .field-group { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .field-group label { color: #aaa; font-size: 12px; display: block; margin-bottom: 4px; }
    .field-group input { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 14px; }
    .notes-area { width: 100%; min-height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #ccc; font-size: 13px; resize: vertical; font-family: inherit; margin-top: 8px; }
    .save-indicator { color: #27ae60; font-size: 11px; opacity: 0; transition: opacity 0.3s; margin-left: 8px; }
    .save-indicator.show { opacity: 1; }
    .status-select-lg { padding: 8px 12px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 14px; cursor: pointer; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <div class="top-nav">
      <a href="/leads" class="back-link" id="backLink">← 리드 목록</a>
      <div style="display:flex;gap:8px;">
        <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
      </div>
    </div>
    <h1 style="font-size:22px;" id="leadCompany"></h1>
    <p class="subtitle" id="leadSummary"></p>

    <div id="detailContent"><p style="color:#aaa;">로딩 중...</p></div>
  </div>

  <script>
    const lead = ${leadJSON};
    const statusLogs = ${logsJSON};
    const statusLabels = ${statusLabelsJS};
    const statusColors = ${statusColorsJS};
    const transitions = ${transitionsJS};

    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function safeUrl(u) { if(!u) return '#'; const c=String(u).replace(/[\\x00-\\x1f\\x7f\\s]+/g,'').toLowerCase(); if(/^(javascript|data|vbscript|blob):/i.test(c)||/^[/\\\\]{2}/.test(c)) return '#'; return esc(u); }
    const urlState = new URL(window.location.href);
    const queryToken = urlState.searchParams.get('token') || '';
    if (queryToken) {
      sessionStorage.setItem('b2b_token', queryToken);
      urlState.searchParams.delete('token');
      const cleanQuery = urlState.searchParams.toString();
      history.replaceState(null, '', urlState.pathname + (cleanQuery ? ('?' + cleanQuery) : ''));
    }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getProfile() { return lead.profileId || 'danfoss'; }

    // Back link에 프로필 쿼리 추가
    document.getElementById('backLink').href = '/leads?profile=' + encodeURIComponent(getProfile());
    document.getElementById('leadCompany').textContent = lead.company || '리드 상세';
    document.getElementById('leadSummary').textContent = lead.summary || '';

    function renderDetail() {
      const c = document.getElementById('detailContent');
      let html = '';

      // 기본 정보 + 상태 섹션
      const currentStatus = lead.status || 'NEW';
      const allowed = transitions[currentStatus] || [];
      const statusOpts = [currentStatus, ...allowed].map(s =>
        '<option value="' + s + '"' + (s === currentStatus ? ' selected' : '') + '>' + esc(statusLabels[s] || s) + '</option>'
      ).join('');

      html += '<div class="detail-section">';
      html += '<h3>기본 정보</h3>';
      html += '<div class="detail-row"><span class="label">상태</span><span class="value">';
      if (allowed.length > 0) {
        html += '<select class="status-select-lg" onchange="updateField(\\'status\\', this.value)">' + statusOpts + '</select>';
      } else {
        html += '<span style="color:' + (statusColors[currentStatus] || '#fff') + ';font-weight:bold;">' + esc(statusLabels[currentStatus]) + '</span>';
      }
      html += '</span></div>';
      html += '<div class="detail-row"><span class="label">등급</span><span class="value"><span class="badge ' + (lead.grade === 'A' ? 'badge-a' : 'badge-b') + '">' + esc(lead.grade) + '</span> (' + lead.score + '점)' + (lead.urgency ? ' <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:bold;color:#fff;background:' + (lead.urgency === 'HIGH' ? '#e74c3c' : '#f39c12') + ';">' + (lead.urgency === 'HIGH' ? '긴급' : '보통') + '</span>' : '') + '</span></div>';
      if (lead.scoreReason) html += '<div class="detail-row"><span class="label">등급 근거</span><span class="value">' + esc(lead.scoreReason) + '</span></div>';
      if (lead.urgencyReason) html += '<div class="detail-row"><span class="label">긴급도 근거</span><span class="value">' + esc(lead.urgencyReason) + '</span></div>';
      if (lead.buyerRole) html += '<div class="detail-row"><span class="label">예상 키맨</span><span class="value">' + esc(lead.buyerRole) + '</span></div>';
      if (lead.confidence) html += '<div class="detail-row"><span class="label">신뢰도</span><span class="value"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;color:#fff;background:' + (lead.confidence === 'HIGH' ? '#27ae60' : lead.confidence === 'MEDIUM' ? '#f39c12' : '#e74c3c') + ';">' + esc(lead.confidence) + '</span>' + (lead.confidenceReason ? ' <span style="color:#aaa;font-size:11px;">' + esc(lead.confidenceReason) + '</span>' : '') + '</span></div>';
      if (lead.eventType) html += '<div class="detail-row"><span class="label">이벤트 유형</span><span class="value">' + esc(lead.eventType) + '</span></div>';
      html += '<div class="detail-row"><span class="label">추천 제품</span><span class="value">' + esc(lead.product) + '</span></div>';
      html += '<div class="detail-row"><span class="label">예상 ROI</span><span class="value">' + esc(lead.roi || '-') + '</span></div>';
      html += '<div class="detail-row"><span class="label">영업 제안</span><span class="value">' + esc(lead.salesPitch) + '</span></div>';
      html += '<div class="detail-row"><span class="label">글로벌 트렌드</span><span class="value">' + esc(lead.globalContext || '-') + '</span></div>';
      html += '<div class="detail-row"><span class="label">프로필</span><span class="value">' + esc(lead.profileId) + '</span></div>';
      html += '<div class="detail-row"><span class="label">생성일</span><span class="value">' + esc((lead.createdAt || '').split('T')[0]) + '</span></div>';
      html += '</div>';

      // 후속 조치 + 예상 계약액 섹션
      html += '<div class="detail-section">';
      html += '<h3>영업 관리</h3>';
      html += '<div class="field-group">';
      html += '<div><label>다음 후속 조치일</label><input type="date" id="followUpDate" value="' + esc(lead.followUpDate || '') + '" onchange="updateField(\\'follow_up_date\\', this.value)"></div>';
      html += '<div><label>예상 계약액 (만원)</label><input type="number" id="estimatedValue" value="' + (lead.estimatedValue || 0) + '" min="0" onchange="updateField(\\'estimated_value\\', parseInt(this.value)||0)"></div>';
      html += '</div>';
      html += '<span class="save-indicator" id="saveIndicator">저장됨</span>';
      html += '</div>';

      // Enrichment 섹션
      if (lead.enriched) {
        const listItem = (text) => '<li style="color:#ccc;font-size:13px;padding:2px 0 2px 12px;position:relative;"><span style="position:absolute;left:0;color:#8e44ad;">→</span>' + esc(text) + '</li>';
        const sectionLabel = (text) => '<p style="color:#ce93d8;font-size:13px;font-weight:bold;margin-bottom:6px;">' + text + '</p>';
        const ulWrap = (items) => '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">' + items + '</ul>';
        const meddicItem = (label, val) => val ? '<li style="color:#ccc;font-size:13px;padding:3px 0;"><strong style="color:#ce93d8;">' + label + ':</strong> ' + esc(val) + '</li>' : '';

        html += '<div class="detail-section">';
        html += '<h3>심층 분석 결과</h3>';
        if (lead.keyFigures && lead.keyFigures.length) {
          html += sectionLabel('핵심 수치');
          html += ulWrap(lead.keyFigures.map(f => listItem(f)).join(''));
        }
        if (lead.painPoints && lead.painPoints.length) {
          html += sectionLabel('고객 과제 (정량)');
          html += ulWrap(lead.painPoints.map(p => listItem(p)).join(''));
        }
        if (lead.actionItems && lead.actionItems.length) {
          html += sectionLabel('후속 실행 항목');
          html += ulWrap(lead.actionItems.map(a => listItem(a)).join(''));
        }

        // MEDDIC 분석
        if (lead.meddic && Object.values(lead.meddic).some(v => v)) {
          html += sectionLabel('MEDDIC 분석');
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">';
          html += meddicItem('예산 규모', lead.meddic.budget);
          html += meddicItem('의사결정 구조', lead.meddic.authority);
          html += meddicItem('핵심 니즈', lead.meddic.need);
          html += meddicItem('구매 타임라인', lead.meddic.timeline);
          html += meddicItem('구매 프로세스', lead.meddic.decisionProcess);
          html += meddicItem('내부 챔피언', lead.meddic.champion);
          html += '</ul>';
        }

        // 경쟁 인텔리전스
        if (lead.competitive && Object.values(lead.competitive).some(v => v)) {
          html += sectionLabel('경쟁 인텔리전스');
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">';
          html += meddicItem('현재 벤더', lead.competitive.currentVendor);
          html += meddicItem('경쟁사', lead.competitive.competitors);
          html += meddicItem('우리 차별점', lead.competitive.ourAdvantage);
          html += meddicItem('전환 장벽/극복', lead.competitive.switchBarrier);
          html += '</ul>';
        }

        // 구매 신호
        if (lead.buyingSignals && lead.buyingSignals.length) {
          html += sectionLabel('구매 신호');
          html += ulWrap(lead.buyingSignals.map(s => listItem(s)).join(''));
        }

        // 근거 (Evidence)
        if (lead.evidence && lead.evidence.length) {
          html += sectionLabel('근거 (Evidence)');
          html += '<ul style="list-style:none;padding:0;margin:0 0 12px 0;">';
          lead.evidence.forEach(e => {
            html += '<li style="color:#ccc;font-size:13px;padding:3px 0;border-left:2px solid #27ae60;padding-left:10px;margin:4px 0;"><strong style="color:#27ae60;">[' + esc(e.field || '') + ']</strong> "' + esc(e.quote || '') + '"';
            if (e.sourceUrl) html += ' <a href="' + safeUrl(e.sourceUrl) + '" target="_blank" style="color:#3498db;font-size:11px;">출처</a>';
            html += '</li>';
          });
          html += '</ul>';
        }

        // 가정 (Assumptions)
        if (lead.assumptions && lead.assumptions.length) {
          html += '<div style="background:#332b00;border-left:3px solid #f39c12;padding:8px 12px;border-radius:4px;margin-bottom:12px;">';
          html += '<p style="color:#f39c12;font-size:13px;font-weight:bold;margin-bottom:6px;">가정 (Assumptions)</p>';
          html += '<ul style="list-style:none;padding:0;margin:0;">';
          lead.assumptions.forEach(a => {
            html += '<li style="color:#e6c200;font-size:12px;padding:2px 0;">⚠ ' + esc(a) + '</li>';
          });
          html += '</ul></div>';
        }

        if (lead.enrichedAt) html += '<p style="color:#666;font-size:11px;">분석일: ' + esc(lead.enrichedAt.split('T')[0]) + '</p>';
        html += '</div>';
      }

      // 출처 섹션
      if (lead.sources && lead.sources.length > 0) {
        html += '<div class="detail-section">';
        html += '<h3>출처 (' + lead.sources.length + '건)</h3>';
        html += '<ul style="list-style:none;padding:0;">';
        lead.sources.forEach(s => {
          html += '<li style="margin:6px 0;"><a href="' + safeUrl(s.url) + '" target="_blank" rel="noopener noreferrer" style="color:#3498db;text-decoration:none;font-size:13px;">' + esc(s.title) + '</a></li>';
        });
        html += '</ul></div>';
      }

      // 메모 섹션
      html += '<div class="detail-section">';
      html += '<h3>메모</h3>';
      html += '<textarea class="notes-area" id="notesArea" placeholder="메모를 입력하세요..." oninput="scheduleNoteSave()">' + esc(lead.notes || '') + '</textarea>';
      html += '</div>';

      // 타임라인 섹션
      html += '<div class="detail-section">';
      html += '<h3>상태 변경 타임라인</h3>';
      if (statusLogs.length === 0) {
        html += '<p style="color:#666;font-size:13px;">아직 상태 변경 이력이 없습니다.</p>';
      } else {
        html += '<ul class="timeline">';
        statusLogs.forEach(log => {
          const time = log.changedAt ? new Date(log.changedAt).toLocaleString('ko-KR') : '';
          html += '<li><span class="time">' + esc(time) + '</span>' +
            '<span style="color:' + (statusColors[log.fromStatus] || '#aaa') + '">' + esc(statusLabels[log.fromStatus] || log.fromStatus) + '</span>' +
            ' → <span style="color:' + (statusColors[log.toStatus] || '#aaa') + '">' + esc(statusLabels[log.toStatus] || log.toStatus) + '</span></li>';
        });
        html += '</ul>';
      }
      html += '</div>';

      c.innerHTML = html;
    }

    async function updateField(field, value) {
      try {
        const body = {};
        body[field] = value;
        if (field === 'status') body.status = value;
        const res = await fetch('/api/leads/' + encodeURIComponent(lead.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); if (field === 'status') renderDetail(); return; }
        // 로컬 lead 객체 업데이트
        if (data.lead) Object.assign(lead, data.lead);
        showSaved();
        if (field === 'status') location.reload();
      } catch(e) { alert('업데이트 실패: ' + e.message); }
    }

    let noteTimer;
    function scheduleNoteSave() {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(async () => {
        const val = document.getElementById('notesArea').value;
        await updateField('notes', val);
      }, 800);
    }

    function showSaved() {
      const el = document.getElementById('saveIndicator');
      if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2000); }
    }

    renderDetail();
  </script>
</body>
</html>`;
}
