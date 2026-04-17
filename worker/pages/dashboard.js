import { getCommonStyles } from './common-styles.js';
import { renderProfileOptions } from '../lib/profile.js';
import { getEscScript, getStoredTokenScript } from './script-snippets.js';

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
    .dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .dash-card { background: linear-gradient(180deg, #182433 0%, #121b27 100%); border-radius: 14px; padding: 16px; text-align: left; border:1px solid #26384c; }
    .dash-card .num { font-size: 28px; font-weight: bold; color: #e94560; display:block; }
    .dash-card .label { font-size: 12px; color: #8fa4b8; margin-top: 4px; display:block; }
    .dash-card .meta { font-size:11px; color:#9fb0c0; margin-top:8px; line-height:1.5; }
    .pipeline-bar { display: flex; height: 32px; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
    .pipeline-seg { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #fff; min-width: 30px; transition: width 0.5s; }
    .activity-feed { list-style: none; padding: 0; }
    .activity-feed li { padding: 10px 0; border-bottom: 1px solid #2a3a4a; font-size: 13px; color: #ccc; }
    .activity-feed .time { color: #666; font-size: 11px; }
    .activity-feed .company { color: #e94560; font-weight: bold; }
    .section-shell { background:#121a24; border:1px solid #26384c; border-radius:14px; padding:16px; margin:18px 0; text-align:left; }
    .section-title { font-size: 16px; color: #fff; margin: 0 0 12px; }
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
    @media (max-width: 720px) {
      .dashboard-cards { grid-template-columns:1fr; }
    }
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
    ${getEscScript()}
    ${getStoredTokenScript()}
    function detailLink(leadId) {
      const base = '/leads/' + encodeURIComponent(leadId);
      const token = getToken();
      return token ? (base + '?token=' + encodeURIComponent(token)) : base;
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

    function renderDashboardState(title, description, actionHref, actionLabel) {
      return \`<div class="section-shell" role="alert" style="max-width:520px;margin:18px auto 0;text-align:center;padding:28px 24px;">
        <h2 style="font-size:28px;color:#e94560;margin:0 0 10px;">\${esc(title)}</h2>
        <p class="subtitle" style="margin-bottom:18px;">\${esc(description)}</p>
        <a href="\${esc(actionHref || '/')}" class="btn btn-secondary">\${esc(actionLabel || '메인으로 이동')}</a>
      </div>\`;
    }

    async function loadDashboard() {
      const profile = document.getElementById('profileFilter').value;
      syncNavLinks(profile);
      const container = document.getElementById('dashContent');
      try {
        const res = await fetch('/api/dashboard?profile=' + encodeURIComponent(profile), {headers:authHeaders()});
        const data = await res.json();
        if (res.status === 401) {
          container.innerHTML = renderDashboardState(
            '인증이 필요합니다',
            '이 대시보드는 권한이 확인된 사용자만 볼 수 있습니다. 메인 화면에서 인증한 뒤 다시 시도하세요.',
            '/',
            '메인으로 이동'
          );
          return;
        }
        if (res.status === 503) {
          container.innerHTML = renderDashboardState(
            '시스템 설정이 필요합니다',
            '서버 인증 설정이 누락되었습니다. 관리자에게 문의하세요.',
            '/',
            '메인으로 이동'
          );
          return;
        }
        if (!data.success) { container.innerHTML = '<p style="color:#e74c3c;">' + esc(data.message) + '</p>'; return; }
        const m = data.metrics;

        // 경영진 요약
        let html = '';
        if (m.executiveSummary && m.executiveSummary.text) {
          html += '<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-left:4px solid #e94560;border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:left;">';
          html += '<h3 style="font-size:14px;color:#e94560;margin:0 0 8px;">경영진 요약</h3>';
          html += '<p style="font-size:13px;color:#ddd;line-height:1.6;margin:0;">' + esc(m.executiveSummary.text) + '</p>';
          html += '</div>';
        }

        // 요약 카드
        html += '<div class="dashboard-cards">';
        html += renderDashCard(m.total, '총 리드', '현재 프로필 기준 전체 건수');
        html += renderDashCard(m.gradeA, 'A등급', '우선 공략할 상위 리드', '#e94560');
        html += renderDashCard(m.conversionRate + '%', '전환율', '수주 기준 전체 전환 성과', '#27ae60');
        html += renderDashCard(m.active, '활성 리드', '진행 중인 파이프라인 수', '#3498db');
        html += renderDashCard((m.totalPipelineValue || 0).toLocaleString(), '진행 중 거래 총액(만원)', '활성 단계 누적 거래액', '#f39c12');
        html += renderDashCard((m.followUpAlerts || []).length, '후속 조치 알림', '오늘 또는 기한 초과 일정', '#e74c3c');
        html += '</div>';

        // 파이프라인 바
        if (m.total > 0) {
          html += '<div class="section-shell"><h3 class="section-title">파이프라인</h3>';
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
          html += '</div></div>';
        }

        // 후속 조치 알림
        if (m.followUpAlerts && m.followUpAlerts.length > 0) {
          html += '<div class="section-shell"><h3 class="section-title" style="color:#e74c3c;">후속 조치 알림</h3>';
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
          html += '</ul></div>';
        }

        // 파이프라인 속도
        if (m.pipelineVelocity && (m.pipelineVelocity.closedCount > 0 || m.pipelineVelocity.lostCycleCount > 0)) {
          const pv = m.pipelineVelocity;
          html += '<div class="section-shell"><h3 class="section-title">파이프라인 속도</h3>';
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px;">';
          if (pv.closedCount > 0) {
            html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:24px;font-weight:bold;color:#27ae60;">\${pv.avgDaysToClose}</div>
              <div style="font-size:11px;color:#aaa;">평균 수주 소요일</div>
              <div style="font-size:10px;color:#666;margin-top:4px;">\${pv.closedCount}건 기준</div>
            </div>\`;
          }
          if (pv.lostCycleCount > 0) {
            html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:24px;font-weight:bold;color:#e74c3c;">\${pv.avgDaysToLoss}</div>
              <div style="font-size:11px;color:#aaa;">평균 실주 소요일</div>
              <div style="font-size:10px;color:#666;margin-top:4px;">\${pv.lostCycleCount}건 기준</div>
            </div>\`;
          }
          if (pv.bottleneckStage) {
            html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;border:1px solid #e67e22;">
              <div style="font-size:24px;font-weight:bold;color:#e67e22;">\${pv.bottleneckDays}일</div>
              <div style="font-size:11px;color:#aaa;">병목 단계</div>
              <div style="font-size:10px;color:#e67e22;margin-top:4px;">\${esc(statusLabels[pv.bottleneckStage] || pv.bottleneckStage)}</div>
            </div>\`;
          }
          html += '</div></div>';
        }

        // 단계별 전환율
        if (m.stageConversions && m.stageConversions.length > 0) {
          html += '<div class="section-shell"><h3 class="section-title">단계별 전환율</h3>';
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
          html += '</div></div>';
        }

        // 수주/실주 분석
        if (m.winLossAnalysis && (m.winLossAnalysis.wonCount > 0 || m.winLossAnalysis.lostCount > 0)) {
          const wl = m.winLossAnalysis;
          html += '<div class="section-shell"><h3 class="section-title">수주/실주 분석</h3>';
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px;">';
          html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#27ae60;">\${wl.winRate}%</div>
            <div style="font-size:11px;color:#aaa;">수주율</div></div>\`;
          html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#27ae60;">\${wl.wonCount}</div>
            <div style="font-size:11px;color:#aaa;">수주 건수</div></div>\`;
          html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#e74c3c;">\${wl.lostCount}</div>
            <div style="font-size:11px;color:#aaa;">실주 건수</div></div>\`;
          html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#3498db;">\${(wl.wonCount + wl.lostCount)}</div>
            <div style="font-size:11px;color:#aaa;">결정 건수</div></div>\`;
          html += '</div>';
          // 거래액 비교
          if (wl.wonTotalValue > 0 || wl.lostTotalValue > 0) {
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
            html += \`<div style="background:#1e2a3a;border-radius:10px;padding:12px;text-align:center;border-top:3px solid #27ae60;">
              <div style="font-size:11px;color:#aaa;margin-bottom:4px;">수주 거래액</div>
              <div style="font-size:18px;font-weight:bold;color:#27ae60;">\${wl.wonTotalValue.toLocaleString()}<span style="font-size:11px;color:#aaa;">만원</span></div>
              <div style="font-size:10px;color:#666;margin-top:4px;">건당 평균 \${wl.avgDealSizeWon.toLocaleString()}만원</div>
            </div>\`;
            html += \`<div style="background:#1e2a3a;border-radius:10px;padding:12px;text-align:center;border-top:3px solid #e74c3c;">
              <div style="font-size:11px;color:#aaa;margin-bottom:4px;">실주 거래액</div>
              <div style="font-size:18px;font-weight:bold;color:#e74c3c;">\${wl.lostTotalValue.toLocaleString()}<span style="font-size:11px;color:#aaa;">만원</span></div>
              <div style="font-size:10px;color:#666;margin-top:4px;">건당 평균 \${wl.avgDealSizeLost.toLocaleString()}만원</div>
            </div>\`;
            html += '</div>';
          }
          // 등급별 수주 분포
          if (wl.wonByGrade && Object.keys(wl.wonByGrade).length > 0) {
            const gradeColors = { A: '#e94560', B: '#3498db', C: '#f39c12', D: '#7f8c8d', 'N/A': '#555' };
            const totalWon = wl.wonCount || 1;
            html += '<div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin-bottom:16px;">';
            Object.entries(wl.wonByGrade).sort((a,b) => b[1]-a[1]).forEach(([g, cnt]) => {
              const pct = Math.max((cnt/totalWon)*100, 8);
              html += \`<div style="width:\${pct}%;background:\${gradeColors[g]||'#555'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:#fff;" title="\${g}등급 \${cnt}건">\${g} \${cnt}</div>\`;
            });
            html += '</div>';
          }
          html += '</div>';
        }

        // 평균 체류 시간
        if (m.avgDwellDays && Object.keys(m.avgDwellDays).length > 0) {
          html += '<div class="section-shell"><h3 class="section-title">평균 체류 시간 (일)</h3>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">';
          ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION'].forEach(s => {
            if (m.avgDwellDays[s] !== undefined) {
              html += \`<div style="background:#1e2a3a;border-radius:8px;padding:10px 14px;text-align:center;min-width:80px;">
                <div style="font-size:18px;font-weight:bold;color:\${statusColors[s]}">\${m.avgDwellDays[s]}</div>
                <div style="font-size:11px;color:#aaa;">\${esc(statusLabels[s])}</div>
              </div>\`;
            }
          });
          html += '</div></div>';
        }

        // 진행 중 거래 총액 (단계별)
        if (m.pipelineValueByStatus && Object.values(m.pipelineValueByStatus).some(v => v > 0)) {
          html += '<div class="section-shell"><h3 class="section-title">진행 중 거래 총액 (만원)</h3>';
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
          html += '</div></div>';
        }

        // 비즈니스 케이스 인사이트
        if (m.businessCaseInsights && m.businessCaseInsights.totalEnriched > 0) {
          const bi = m.businessCaseInsights;
          html += '<div class="section-shell"><h3 class="section-title">비즈니스 케이스 인사이트</h3>';
          // 커버리지 카드
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px;">';
          html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#9b59b6;">\${bi.enrichmentRate}%</div>
            <div style="font-size:11px;color:#aaa;">Enrichment 커버리지</div>
            <div style="font-size:10px;color:#666;margin-top:4px;">\${bi.totalEnriched}/\${m.total}건</div></div>\`;
          html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#1abc9c;">\${bi.meddicCompletenessRate}%</div>
            <div style="font-size:11px;color:#aaa;">MEDDIC 완성도</div>
            <div style="font-size:10px;color:#666;margin-top:4px;">\${bi.meddicCompleteCount}/\${bi.totalEnriched}건</div></div>\`;
          if (bi.totalAddressableROI > 0) {
            html += \`<div style="background:#1e2a3a;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:24px;font-weight:bold;color:#f39c12;">\${bi.totalAddressableROI.toLocaleString()}</div>
              <div style="font-size:11px;color:#aaa;">활성 Enriched 가치(만원)</div></div>\`;
          }
          html += '</div>';
          // 고객 과제 빈도 바
          if (bi.topPainPoints && bi.topPainPoints.length > 0) {
            html += '<div style="margin-bottom:12px;">';
            html += '<div style="font-size:12px;color:#aaa;margin-bottom:8px;">주요 고객 과제 (Top 5)</div>';
            const maxCnt = bi.topPainPoints[0].count;
            bi.topPainPoints.forEach(pp => {
              const pct = Math.max((pp.count/maxCnt)*100, 5);
              html += \`<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <div style="flex:1;font-size:11px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="\${esc(pp.name)}">\${esc(pp.name)}</div>
                <div style="width:120px;background:#2a3a4a;border-radius:3px;height:14px;overflow:hidden;">
                  <div style="width:\${pct}%;background:#e94560;height:100%;border-radius:3px;"></div>
                </div>
                <div style="font-size:11px;color:#888;min-width:20px;text-align:right;">\${pp.count}</div>
              </div>\`;
            });
            html += '</div>';
          }
          // 벤더/경쟁사 2열
          if ((bi.topVendors && bi.topVendors.length > 0) || (bi.topCompetitors && bi.topCompetitors.length > 0)) {
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">';
            if (bi.topVendors && bi.topVendors.length > 0) {
              html += '<div>';
              html += '<div style="font-size:12px;color:#aaa;margin-bottom:6px;">현재 벤더</div>';
              bi.topVendors.forEach(v => {
                html += \`<div style="font-size:11px;color:#ccc;padding:3px 0;border-bottom:1px solid #2a3a4a;">\${esc(v.name)} <span style="color:#888;">(\${v.count})</span></div>\`;
              });
              html += '</div>';
            }
            if (bi.topCompetitors && bi.topCompetitors.length > 0) {
              html += '<div>';
              html += '<div style="font-size:12px;color:#aaa;margin-bottom:6px;">경쟁사</div>';
              bi.topCompetitors.forEach(c => {
                html += \`<div style="font-size:11px;color:#ccc;padding:3px 0;border-bottom:1px solid #2a3a4a;">\${esc(c.name)} <span style="color:#888;">(\${c.count})</span></div>\`;
              });
              html += '</div>';
            }
            html += '</div>';
          }
          html += '</div>';
        }

        // 최근 활동
        if (m.recentActivity && m.recentActivity.length > 0) {
          html += '<div class="section-shell"><h3 class="section-title">최근 활동</h3>';
          html += '<ul class="activity-feed">';
          m.recentActivity.forEach(a => {
            const time = a.changedAt ? new Date(a.changedAt).toLocaleString('ko-KR') : '';
            html += \`<li><span class="time">\${esc(time)}</span> <span class="company">\${esc(a.company)}</span> \${esc(statusLabels[a.fromStatus] || a.fromStatus)} → \${esc(statusLabels[a.toStatus] || a.toStatus)}</li>\`;
          });
          html += '</ul></div>';
        }

        // 분석 실행 통계
        if (m.analyticsByType && Object.keys(m.analyticsByType).length > 0) {
          html += '<div class="section-shell"><h3 class="section-title">분석 실행</h3>';
          Object.entries(m.analyticsByType).forEach(([type, info]) => {
            html += \`<p style="font-size:13px;color:#ccc;">\${esc(type)}: \${info.runs}회 실행, 총 \${info.totalLeads || 0}건 리드 발굴</p>\`;
          });
          html += '</div>';
        }

        container.innerHTML = html;
      } catch(e) {
        container.innerHTML = '<p style="color:#e74c3c;">대시보드 로드 실패: ' + esc(e.message) + '</p>';
      }
    }

    function renderDashCard(value, label, meta, color) {
      return \`<div class="dash-card"><span class="num" style="color:\${color || '#e94560'}">\${value}</span><span class="label">\${label}</span><div class="meta">\${meta}</div></div>\`;
    }

    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    loadDashboard();
  </script>
</body>
</html>`;
}
