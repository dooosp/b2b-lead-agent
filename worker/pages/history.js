import { getCommonStyles } from './common-styles.js';

export function getHistoryPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드 히스토리 - CRM</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .history-card { background: #1e2a3a; border-radius: 12px; padding: 16px; margin: 12px 0; border-left: 4px solid #3498db; }
    .history-card.won { border-left-color: #27ae60; }
    .history-card.lost { border-left-color: #7f8c8d; }
    .history-card h3 { color: #fff; margin: 0 0 8px 0; font-size: 16px; }
    .history-card p { margin: 4px 0; font-size: 13px; color: #aaa; }
    .history-card .meta { font-size: 11px; color: #666; margin-top: 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 6px; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .badge-status { background: #3498db; color: #fff; }
    .badge-status.new { background: #3498db; }
    .badge-status.contacted { background: #9b59b6; }
    .badge-status.meeting { background: #e67e22; }
    .badge-status.proposal { background: #1abc9c; }
    .badge-status.won { background: #27ae60; }
    .badge-status.lost { background: #7f8c8d; }
    .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; justify-content: center; }
    .filter-btn { padding: 6px 12px; font-size: 12px; border-radius: 6px; border: 1px solid #444; background: transparent; color: #aaa; cursor: pointer; }
    .filter-btn.active { background: #3498db; border-color: #3498db; color: #fff; }
    .stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 20px; flex-wrap: wrap; }
    .stat-item { text-align: center; }
    .stat-item .num { font-size: 24px; font-weight: bold; color: #e94560; }
    .stat-item .label { font-size: 11px; color: #aaa; }
  </style>
</head>
<body>
  <div class="container" style="max-width:700px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <a id="leadsBackLink" href="/leads" class="back-link" style="margin-bottom:0;">← 최신 리드</a>
      <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
    </div>
    <h1 style="font-size:22px;">리드 히스토리</h1>
    <p class="subtitle">발굴된 모든 리드를 추적하고 관리하세요</p>

    <div class="stats" id="stats"></div>
    <div class="filter-bar" id="filterBar"></div>
    <div id="historyList"><p style="color:#aaa;">로딩 중...</p></div>
  </div>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getProfile() { return new URLSearchParams(window.location.search).get('profile') || 'danfoss'; }
    document.getElementById('leadsBackLink').href = '/leads?profile=' + encodeURIComponent(getProfile());
    let allHistory = [];
    let currentFilter = 'ALL';
    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };

    async function loadHistory() {
      try {
        const res = await fetch('/api/history?profile=' + getProfile(), {headers:authHeaders()});
        const data = await res.json();
        allHistory = data.history || [];

        if (allHistory.length === 0) {
          document.getElementById('historyList').innerHTML = '<p style="color:#aaa;">아직 히스토리가 없습니다.</p>';
          return;
        }

        renderStats();
        renderFilters();
        renderHistory();
      } catch(e) {
        document.getElementById('historyList').innerHTML = '<p style="color:#e74c3c;">로드 실패: ' + esc(e.message) + '</p>';
      }
    }

    function renderStats() {
      const total = allHistory.length;
      const won = allHistory.filter(h => h.status === 'WON').length;
      const active = allHistory.filter(h => !['WON', 'LOST'].includes(h.status)).length;
      document.getElementById('stats').innerHTML = \`
        <div class="stat-item"><div class="num">\${total}</div><div class="label">총 리드</div></div>
        <div class="stat-item"><div class="num" style="color:#27ae60;">\${won}</div><div class="label">수주 성공</div></div>
        <div class="stat-item"><div class="num" style="color:#3498db;">\${active}</div><div class="label">진행 중</div></div>
      \`;
    }

    function renderFilters() {
      const statuses = ['ALL', ...Object.keys(statusLabels)];
      document.getElementById('filterBar').innerHTML = statuses.map(s =>
        \`<button class="filter-btn \${currentFilter === s ? 'active' : ''}" onclick="setFilter('\${s}')">\${s === 'ALL' ? '전체' : statusLabels[s]}</button>\`
      ).join('');
    }

    function setFilter(status) {
      currentFilter = status;
      renderFilters();
      renderHistory();
    }

    function renderHistory() {
      const filtered = currentFilter === 'ALL' ? allHistory : allHistory.filter(h => h.status === currentFilter);
      const sorted = filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      document.getElementById('historyList').innerHTML = sorted.map(lead => \`
        <div class="history-card \${lead.status ? esc(lead.status).toLowerCase() : ''}">
          <h3>
            <span class="badge \${lead.grade === 'A' ? 'badge-a' : 'badge-b'}">\${esc(lead.grade)}</span>
            <span class="badge badge-status \${(lead.status || 'new').toLowerCase()}">\${esc(statusLabels[lead.status]) || '신규'}</span>
            \${esc(lead.company)}
          </h3>
          <p>\${esc(lead.summary)}</p>
          <p><strong>제품:</strong> \${esc(lead.product)} | <strong>점수:</strong> \${parseInt(lead.score)||0}점</p>
          <div class="meta">
            생성: \${lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('ko-KR') : '-'}
            \${lead.updatedAt && lead.updatedAt !== lead.createdAt ? ' | 업데이트: ' + new Date(lead.updatedAt).toLocaleDateString('ko-KR') : ''}
          </div>
        </div>
      \`).join('');
    }

    loadHistory();
  </script>
</body>
</html>`;
}
