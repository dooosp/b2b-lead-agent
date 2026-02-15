import { getCommonStyles } from './common-styles.js';
import { renderProfileOptions } from '../lib/profile.js';

export function getDashboardPage(env) {
  const profileOptions = renderProfileOptions(env);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>대시보드 - B2B 리드</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .dash-card { background: #1e2a3a; border-radius: 12px; padding: 16px; text-align: center; }
    .dash-card .num { font-size: 28px; font-weight: bold; color: #e94560; }
    .dash-card .label { font-size: 12px; color: #aaa; margin-top: 4px; }
    .pipeline-bar { display: flex; height: 32px; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
    .pipeline-seg { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #fff; min-width: 30px; transition: width 0.5s; }
    .activity-feed { list-style: none; padding: 0; }
    .activity-feed li { padding: 10px 0; border-bottom: 1px solid #2a3a4a; font-size: 13px; color: #ccc; }
    .activity-feed .time { color: #666; font-size: 11px; }
    .activity-feed .company { color: #e94560; font-weight: bold; }
    .section-title { font-size: 16px; color: #fff; margin: 20px 0 12px; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .profile-filter { padding: 8px 12px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-status { background: #3498db; color: #fff; }
    .badge-status.contacted { background: #9b59b6; }
    .badge-status.meeting { background: #e67e22; }
    .badge-status.proposal { background: #1abc9c; }
    .badge-status.negotiation { background: #2980b9; }
    .badge-status.won { background: #27ae60; }
    .badge-status.lost { background: #7f8c8d; }
  </style>
</head>
<body>
  <main class="container" style="max-width:700px;">
    <nav class="top-nav" aria-label="상단 이동">
      <a href="/" class="back-link">← 메인</a>
      <div style="display:flex;gap:8px;">
        <a id="dashboardLeadsLink" href="/leads" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">리드 목록</a>
        <a id="dashboardHistoryLink" href="/history" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">히스토리</a>
      </div>
    </nav>
    <h1 style="font-size:22px;">대시보드</h1>
    <p class="subtitle">리드 파이프라인 현황</p>

    <select class="profile-filter" id="profileFilter" aria-label="프로필 필터" onchange="loadDashboard()">
      <option value="all">전체 프로필</option>
      ${profileOptions}
    </select>

    <div id="dashContent"><p style="color:#aaa;">로딩 중...</p></div>
  </main>

  <script>
    function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
    function getToken() { return sessionStorage.getItem('b2b_token') || ''; }
    function detailLink(leadId) {
      const token = getToken();
      return '/leads/' + encodeURIComponent(leadId) + (token ? ('?token=' + encodeURIComponent(token)) : '');
    }
    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };
    const statusColors = { NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' };
    const profileFilter = document.getElementById('profileFilter');
    const initialProfile = new URLSearchParams(window.location.search).get('profile');
    if (initialProfile && Array.from(profileFilter.options).some(o => o.value === initialProfile)) {
      profileFilter.value = initialProfile;
    }

    function syncNavLinks(profile) {
      const p = profile && profile !== 'all' ? '?profile=' + encodeURIComponent(profile) : '';
      document.getElementById('dashboardLeadsLink').href = '/leads' + p;
      document.getElementById('dashboardHistoryLink').href = '/history' + p;
    }

    async function loadDashboard() {
      const profile = document.getElementById('profileFilter').value;
      syncNavLinks(profile);
      const container = document.getElementById('dashContent');
      try {
        const res = await fetch('/api/dashboard?profile=' + encodeURIComponent(profile), {headers:authHeaders()});
        const data = await res.json();
        if (!data.success) { container.innerHTML = '<p style="color:#e74c3c;">' + esc(data.message) + '</p>'; return; }
        const m = data.metrics;

        // 요약 카드
        let html = '<div class="dashboard-cards">';
        html += \`<div class="dash-card"><div class="num">\${m.total}</div><div class="label">총 리드</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#e94560;">\${m.gradeA}</div><div class="label">A등급</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#27ae60;">\${m.conversionRate}%</div><div class="label">전환율</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#3498db;">\${m.active}</div><div class="label">활성 리드</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#f39c12;">\${(m.totalPipelineValue || 0).toLocaleString()}</div><div class="label">진행 중 거래 총액(만원)</div></div>\`;
        html += \`<div class="dash-card"><div class="num" style="color:#e74c3c;">\${(m.followUpAlerts || []).length}</div><div class="label">후속 조치 알림</div></div>\`;
        html += '</div>';

        // 파이프라인 바
        if (m.total > 0) {
          html += '<h3 class="section-title">파이프라인</h3>';
          html += '<div class="pipeline-bar">';
          const order = ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON','LOST'];
          order.forEach(s => {
            const cnt = m.statusDistribution[s] || 0;
            if (cnt === 0) return;
            const pct = Math.max((cnt / m.total) * 100, 5);
            html += \`<div class="pipeline-seg" style="width:\${pct}%;background:\${statusColors[s]}" title="\${statusLabels[s]}: \${cnt}건">\${cnt}</div>\`;
          });
          html += '</div>';

          // 범례
          html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
          order.forEach(s => {
            const cnt = m.statusDistribution[s] || 0;
            if (cnt === 0) return;
            html += \`<span style="font-size:11px;color:#aaa;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:\${statusColors[s]};margin-right:4px;"></span>\${statusLabels[s]} \${cnt}</span>\`;
          });
          html += '</div>';
        }

        // 후속 조치 알림
        if (m.followUpAlerts && m.followUpAlerts.length > 0) {
          html += '<h3 class="section-title" style="color:#e74c3c;">후속 조치 알림</h3>';
          html += '<ul class="activity-feed">';
          m.followUpAlerts.forEach(a => {
            const icon = a.isOverdue ? '🔴' : a.isToday ? '🟡' : '🔵';
            const label = a.isOverdue ? '기한 초과' : a.isToday ? '오늘' : '내일';
            html += \`<li style="border-left:3px solid \${a.isOverdue ? '#e74c3c' : '#f39c12'};padding-left:12px;">
              \${icon} <a href="\${detailLink(a.id)}" style="color:#e94560;text-decoration:none;font-weight:bold;">\${esc(a.company)}</a>
              <span style="color:#888;font-size:11px;margin-left:8px;">\${esc(a.followUpDate)} (\${label})</span>
              <span class="badge badge-status \${(a.status||'').toLowerCase()}" style="font-size:10px;padding:1px 6px;margin-left:6px;">\${esc(statusLabels[a.status] || a.status)}</span>
            </li>\`;
          });
          html += '</ul>';
        }

        // 단계별 전환율
        if (m.stageConversions && m.stageConversions.length > 0) {
          html += '<h3 class="section-title">단계별 전환율</h3>';
          html += '<div style="display:grid;gap:8px;margin-bottom:16px;">';
          m.stageConversions.forEach(sc => {
            const barWidth = Math.max(sc.rate, 2);
            html += \`<div style="font-size:12px;color:#ccc;">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span>\${esc(statusLabels[sc.from])} → \${esc(statusLabels[sc.to])}</span>
                <span style="color:\${sc.rate >= 50 ? '#27ae60' : sc.rate >= 25 ? '#f39c12' : '#e74c3c'};font-weight:bold;">\${sc.rate}% (\${sc.count}건)</span>
              </div>
              <div style="background:#2a3a4a;border-radius:4px;height:6px;overflow:hidden;">
                <div style="width:\${barWidth}%;background:\${sc.rate >= 50 ? '#27ae60' : sc.rate >= 25 ? '#f39c12' : '#e74c3c'};height:100%;border-radius:4px;transition:width 0.5s;"></div>
              </div>
            </div>\`;
          });
          html += '</div>';
        }

        // 평균 체류 시간
        if (m.avgDwellDays && Object.keys(m.avgDwellDays).length > 0) {
          html += '<h3 class="section-title">평균 체류 시간 (일)</h3>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">';
          ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION'].forEach(s => {
            if (m.avgDwellDays[s] !== undefined) {
              html += \`<div style="background:#1e2a3a;border-radius:8px;padding:10px 14px;text-align:center;min-width:80px;">
                <div style="font-size:18px;font-weight:bold;color:\${statusColors[s]}">\${m.avgDwellDays[s]}</div>
                <div style="font-size:11px;color:#aaa;">\${esc(statusLabels[s])}</div>
              </div>\`;
            }
          });
          html += '</div>';
        }

        // 진행 중 거래 총액 (단계별)
        if (m.pipelineValueByStatus && Object.values(m.pipelineValueByStatus).some(v => v > 0)) {
          html += '<h3 class="section-title">진행 중 거래 총액 (만원)</h3>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">';
          ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON'].forEach(s => {
            const v = m.pipelineValueByStatus[s] || 0;
            if (v > 0) {
              html += \`<div style="background:#1e2a3a;border-radius:8px;padding:10px 14px;text-align:center;min-width:90px;">
                <div style="font-size:16px;font-weight:bold;color:#27ae60;">\${v.toLocaleString()}</div>
                <div style="font-size:11px;color:#aaa;">\${esc(statusLabels[s])}</div>
              </div>\`;
            }
          });
          html += '</div>';
        }

        // 최근 활동
        if (m.recentActivity && m.recentActivity.length > 0) {
          html += '<h3 class="section-title">최근 활동</h3>';
          html += '<ul class="activity-feed">';
          m.recentActivity.forEach(a => {
            const time = a.changedAt ? new Date(a.changedAt).toLocaleString('ko-KR') : '';
            html += \`<li><span class="time">\${esc(time)}</span> <span class="company">\${esc(a.company)}</span> \${esc(statusLabels[a.fromStatus] || a.fromStatus)} → \${esc(statusLabels[a.toStatus] || a.toStatus)}</li>\`;
          });
          html += '</ul>';
        }

        // 분석 실행 통계
        if (m.analyticsByType && Object.keys(m.analyticsByType).length > 0) {
          html += '<h3 class="section-title">분석 실행</h3>';
          Object.entries(m.analyticsByType).forEach(([type, info]) => {
            html += \`<p style="font-size:13px;color:#ccc;">\${esc(type)}: \${info.runs}회 실행, 총 \${info.totalLeads || 0}건 리드 발굴</p>\`;
          });
        }

        container.innerHTML = html;
      } catch(e) {
        container.innerHTML = '<p style="color:#e74c3c;">대시보드 로드 실패: ' + esc(e.message) + '</p>';
      }
    }

    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    loadDashboard();
  </script>
</body>
</html>`;
}
