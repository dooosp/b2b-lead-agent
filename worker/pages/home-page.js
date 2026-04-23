import { getCommonStyles } from './common-styles.js';
import { renderProfileOptions } from '../lib/profile.js';
import { getEscScript, getPasswordTokenScript, getSafeUrlScript } from './script-snippets.js';

export function getMainPage(env) {
  const profileOptions = renderProfileOptions(env);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B2B Sales Intelligence</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    select.profile-select { width: 200px; margin: 0 auto 16px; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; text-align: center; display: block; }
    .tabs { display: flex; justify-content: center; gap: 0; margin-bottom: 24px; }
    .tab-btn { flex: 1; max-width: 200px; padding: 12px 16px; font-size: 14px; font-weight: bold; color: #aaa; background: transparent; border: 1px solid #444; cursor: pointer; transition: all 0.3s; }
    .tab-btn:first-child { border-radius: 8px 0 0 8px; }
    .tab-btn:last-child { border-radius: 0 8px 8px 0; }
    .tab-btn.active { color: #fff; background: rgba(233,69,96,0.2); border-color: #e94560; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .ss-input { display: block; width: 280px; margin: 0 auto 12px; padding: 12px 16px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; text-align: center; }
    .ss-input::placeholder { color: #666; }
    .progress-bar { width: 100%; height: 4px; background: #333; border-radius: 2px; margin-top: 12px; overflow: hidden; display: none; }
    .progress-bar.active { display: block; }
    .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #e94560, #3498db); border-radius: 2px; transition: width 0.5s ease; }
    .ss-results { margin-top: 20px; text-align: left; }
    .ss-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin:16px 0 18px; }
    .ss-summary-card { background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:12px 14px; }
    .ss-summary-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:6px; }
    .ss-summary-value { display:block; color:#f4f7fb; font-size:18px; font-weight:700; }
    .ss-summary-meta { color:#9fb0c0; font-size:12px; margin-top:6px; line-height:1.5; }
    .ss-summary-note { background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:14px; color:#d2dbe5; font-size:13px; line-height:1.7; margin-bottom:14px; }
    .ss-lead-card { background: linear-gradient(180deg, #182433 0%, #121b27 100%); border-radius: 14px; padding: 16px; margin: 12px 0; border: 1px solid #26384c; }
    .ss-lead-card.grade-a { box-shadow: 0 12px 28px rgba(233,69,96,0.14); border-color:#e94560; }
    .ss-lead-card.grade-b { border-color: #f39c12; box-shadow: 0 10px 24px rgba(243,156,18,0.12); }
    .ss-lead-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
    .ss-lead-title { min-width:0; }
    .ss-lead-title h3 { color: #f4f7fb; margin: 0 0 6px 0; font-size: 17px; }
    .ss-lead-project { color:#aebdcb; font-size:13px; line-height:1.6; }
    .ss-badges { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .ss-badge { display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; font-size:11px; font-weight:700; }
    .ss-badge.grade-a { background:rgba(233,69,96,0.16); color:#ffb5c1; border:1px solid rgba(233,69,96,0.28); }
    .ss-badge.grade-b { background:rgba(243,156,18,0.16); color:#ffd399; border:1px solid rgba(243,156,18,0.28); }
    .ss-badge.score { background:rgba(52,152,219,0.14); color:#9edcff; border:1px solid rgba(52,152,219,0.28); }
    .ss-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:12px 0; }
    .ss-metric { background:#121a24; border:1px solid #223447; border-radius:10px; padding:10px 12px; }
    .ss-metric-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:4px; }
    .ss-metric-value { display:block; color:#f4f7fb; font-size:14px; font-weight:700; }
    .ss-copy { margin-top:12px; color:#d2dbe5; font-size:13px; line-height:1.7; }
    .ss-section-label { color:#8fa4b8; font-size:11px; margin-bottom:4px; display:block; text-transform:uppercase; letter-spacing:0.04em; }
    .ss-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: center; }
    .ss-stats { font-size: 12px; color: #888; margin-top: 8px; }
    .ss-sources { margin-top: 10px; padding-top: 10px; border-top: 1px solid #2a3a4a; }
    .ss-sources summary { color: #aaa; font-size: 12px; cursor: pointer; }
    .ss-sources a { color: #3498db; text-decoration: none; font-size: 12px; }
    .ss-sources a:hover { text-decoration: underline; }
    .ss-sources li { margin: 3px 0; list-style: none; }
    @media (max-width: 720px) {
      .ss-metrics, .ss-summary { grid-template-columns:1fr; }
      .ss-lead-head { flex-direction:column; }
      .ss-badges { justify-content:flex-start; }
    }
  </style>
</head>
<body>
  <main class="container" style="max-width:600px;">
    <div class="logo">📊</div>
    <h1>B2B Sales Intelligence</h1>
    <p class="subtitle">AI 기반 영업 인텔리전스 플랫폼</p>

    <div class="tabs" role="tablist" aria-label="기능 탭">
      <button id="tab-btn-self-service" class="tab-btn active" role="tab" aria-selected="true" aria-controls="tab-self-service" onclick="switchTab('self-service')">셀프서비스</button>
      <button id="tab-btn-managed" class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-managed" onclick="switchTab('managed')">관리 프로필</button>
    </div>

    <!-- 셀프서비스 탭 -->
    <div class="tab-content active" id="tab-self-service" role="tabpanel" aria-labelledby="tab-btn-self-service">
      <p style="font-size:13px;color:#aaa;margin-bottom:16px;">회사명과 산업만 입력하면 AI가 즉시 리드를 분석합니다</p>
      <input type="text" class="ss-input" id="ssCompany" placeholder="회사명 (예: 삼성전자)" aria-label="회사명 (예: 삼성전자)" maxlength="50">
      <input type="text" class="ss-input" id="ssIndustry" placeholder="산업 분야 (예: 반도체 제조)" aria-label="산업 분야 (예: 반도체 제조)" maxlength="50">
      <button class="btn btn-primary" id="ssBtn" onclick="selfServiceAnalyze()">즉시 분석</button>
      <div class="progress-bar" id="ssProgress"><div class="progress-fill" id="ssProgressFill"></div></div>
      <div class="status" id="ssStatus"></div>
      <div class="ss-results" id="ssResults"></div>
    </div>

    <!-- 관리 프로필 탭 -->
    <div class="tab-content" id="tab-managed" role="tabpanel" aria-labelledby="tab-btn-managed">
      <select class="profile-select" id="profileSelect" aria-label="프로필 선택">
        ${profileOptions}
      </select>
      <input type="password" id="password" placeholder="비밀번호 입력" aria-label="비밀번호 입력" class="input-field">
      <button class="btn btn-primary" id="generateBtn" onclick="generate()">보고서 생성</button>
      <div class="status" id="status"></div>
      <nav class="nav-buttons top-nav" aria-label="주요 페이지 이동">
        <a href="/leads" class="btn btn-secondary">리드 상세 보기</a>
        <a href="/dashboard" class="btn btn-secondary">대시보드</a>
        <a href="/ppt" class="btn btn-secondary">PPT 제안서</a>
        <a href="/proposal" class="btn btn-secondary">기술제안서</a>
        <a href="/cpa" class="btn btn-secondary">CPA 견적서</a>
        <a href="/roleplay" class="btn btn-secondary">영업 역량 시뮬레이션</a>
      </nav>
      <div class="info">
        뉴스 기반 영업 기회 분석 후 리포트를 발송합니다<br>
        처리에 1~2분 정도 소요됩니다.
      </div>
    </div>
  </main>

  <script>
    ${getEscScript()}
    ${getSafeUrlScript()}

    function switchTab(tab) {
      document.querySelectorAll('.tab-btn').forEach((b, i) => {
        const active = (tab === 'self-service' ? i === 0 : i === 1);
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.getElementById('tab-self-service').classList.toggle('active', tab === 'self-service');
      document.getElementById('tab-managed').classList.toggle('active', tab === 'managed');
    }

    // ===== 셀프서비스 =====
    async function selfServiceAnalyze() {
      const company = document.getElementById('ssCompany').value.trim();
      const industry = document.getElementById('ssIndustry').value.trim();
      const btn = document.getElementById('ssBtn');
      const status = document.getElementById('ssStatus');
      const results = document.getElementById('ssResults');
      const progress = document.getElementById('ssProgress');
      const fill = document.getElementById('ssProgressFill');

      if (!company || !industry) {
        status.className = 'status error'; status.textContent = '회사명과 산업 분야를 모두 입력하세요.'; return;
      }

      btn.disabled = true; btn.textContent = '분석 중...';
      status.className = 'status loading';
      status.textContent = '프로필 생성 및 뉴스 분석 중입니다... (15~25초)';
      results.innerHTML = '';
      progress.classList.add('active');
      fill.style.width = '0%';

      // 프로그레스 애니메이션
      let pct = 0;
      const progressInterval = setInterval(() => {
        pct = Math.min(pct + 2, 90);
        fill.style.width = pct + '%';
      }, 500);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ company, industry })
        });
        const data = await res.json();
        clearInterval(progressInterval);
        fill.style.width = '100%';

        if (!data.success) {
          status.className = 'status error'; status.textContent = data.error || data.message || '분석에 실패했습니다.';
          results.innerHTML = '';
        } else if (!data.leads || data.leads.length === 0) {
          status.className = 'status success';
          status.textContent = '분석 완료했지만 유효한 리드를 찾지 못했습니다.';
          results.innerHTML = '';
        } else {
          status.className = 'status success';
          status.textContent = data.leads.length + '개 리드 발견!';
          renderSelfServiceResults(data.leads, { name: company }, data.summary);
        }
      } catch (e) {
        clearInterval(progressInterval);
        status.className = 'status error'; status.textContent = '오류: ' + e.message;
      }

      setTimeout(() => { progress.classList.remove('active'); }, 1000);
      btn.disabled = false; btn.textContent = '즉시 분석';
    }

    function normalizeSelfServiceLead(lead) {
      const score = Math.max(0, Math.min(100, parseInt(lead?.score, 10) || 0));
      const grade = ['A', 'B', 'C', 'D'].includes(String(lead?.grade || '')) ? String(lead.grade) : (score >= 80 ? 'A' : score >= 50 ? 'B' : 'C');
      const projectTitle = String(lead?.project_title || lead?.project || lead?.summary || '').trim();
      const product = String(lead?.recommended_product || lead?.product || '').trim();
      const roi = String(lead?.expected_roi || lead?.roi || '').trim();
      const salesPitch = String(lead?.sales_pitch || lead?.salesPitch || lead?.pitch || '').trim();
      const trend = String(lead?.trend || lead?.trends || lead?.globalContext || '').trim();
      return {
        company: String(lead?.company || '').trim(),
        score,
        grade,
        project_title: projectTitle,
        recommended_product: product,
        expected_roi: roi,
        sales_pitch: salesPitch,
        trend,
        sources: Array.isArray(lead?.sources) ? lead.sources.filter(s => s && s.title && s.url) : []
      };
    }

    function renderSelfServiceResults(leads, profile, summary) {
      const normalizedLeads = (Array.isArray(leads) ? leads : []).map(normalizeSelfServiceLead);
      const validLeads = normalizedLeads.filter(l =>
        l.company && (l.project_title || l.recommended_product || l.expected_roi || l.sales_pitch || l.trend)
      );
      const container = document.getElementById('ssResults');
      if (validLeads.length === 0) {
        const status = document.getElementById('ssStatus');
        status.className = 'status error';
        status.textContent = '분석 결과 파싱에 실패했습니다. 잠시 후 다시 시도해주세요.';
        container.innerHTML = '';
        return;
      }
      const avgScore = Math.round(validLeads.reduce((sum, lead) => sum + lead.score, 0) / validLeads.length);
      const topLead = validLeads[0];
      const gradeACount = validLeads.filter((lead) => lead.grade === 'A').length;
      container.innerHTML = [
        renderSelfServiceSummary(validLeads.length, avgScore, gradeACount, topLead, summary),
        validLeads.map(renderSelfServiceLeadCard).join('')
      ].join('');

      // 복사/다운로드 버튼
      container.innerHTML += \`
        <div class="ss-actions">
          <button class="btn btn-secondary" onclick="copySelfServiceResults()">클립보드 복사</button>
          <button class="btn btn-secondary" onclick="downloadSelfServiceResults()">JSON 다운로드</button>
        </div>
      \`;

      // 결과 데이터 저장
      window._ssLeads = validLeads;
      window._ssSummary = typeof summary === 'string' ? summary : '';
      window._ssProfile = profile;
    }

    function renderSelfServiceSummary(count, avgScore, gradeACount, topLead, summary) {
      return \`
        <div class="ss-summary">
          <div class="ss-summary-card">
            <span class="ss-summary-label">분석 리드 수</span>
            <span class="ss-summary-value">\${count}건</span>
            <div class="ss-summary-meta">즉시 검토 가능한 후보만 남겼습니다.</div>
          </div>
          <div class="ss-summary-card">
            <span class="ss-summary-label">평균 점수</span>
            <span class="ss-summary-value">\${avgScore}점</span>
            <div class="ss-summary-meta">기사 최신성과 키워드 적합도 기준</div>
          </div>
          <div class="ss-summary-card">
            <span class="ss-summary-label">A등급 비중</span>
            <span class="ss-summary-value">\${gradeACount}건</span>
            <div class="ss-summary-meta">우선 제안 후보 수</div>
          </div>
          <div class="ss-summary-card">
            <span class="ss-summary-label">대표 제안 제품</span>
            <span class="ss-summary-value">\${esc((topLead && topLead.recommended_product) || '-')}</span>
            <div class="ss-summary-meta">\${topLead ? esc(topLead.company + ' 기준') : '추천 제품 없음'}</div>
          </div>
        </div>
        <div class="ss-summary-note">\${esc(String(summary || '').trim() || (count + '개 영업 기회를 즉시 분석했습니다.'))}</div>
      \`;
    }

    function renderSelfServiceLeadCard(lead) {
      const gradeClass = lead.grade === 'A' ? 'grade-a' : (lead.grade === 'B' ? 'grade-b' : '');
      return \`
        <article class="ss-lead-card \${gradeClass}">
          <div class="ss-lead-head">
            <div class="ss-lead-title">
              <h3>\${esc(lead.company)}</h3>
              <div class="ss-lead-project">\${esc(lead.project_title)}</div>
            </div>
            <div class="ss-badges">
              <span class="ss-badge \${lead.grade === 'A' ? 'grade-a' : 'grade-b'}">\${esc(lead.grade)}등급</span>
              <span class="ss-badge score">\${parseInt(lead.score, 10) || 0}점</span>
            </div>
          </div>
          <div class="ss-metrics">
            <div class="ss-metric">
              <span class="ss-metric-label">추천 제품</span>
              <span class="ss-metric-value">\${esc(lead.recommended_product)}</span>
            </div>
            <div class="ss-metric">
              <span class="ss-metric-label">예상 ROI</span>
              <span class="ss-metric-value">\${esc(lead.expected_roi)}</span>
            </div>
          </div>
          <div class="ss-copy">
            <span class="ss-section-label">영업 제안</span>
            \${esc(lead.sales_pitch)}
          </div>
          <div class="ss-copy">
            <span class="ss-section-label">시장 트렌드</span>
            \${esc(lead.trend)}
          </div>
          \${lead.sources && lead.sources.length > 0 ? \`
          <div class="ss-sources">
            <details>
              <summary>출처 (\${lead.sources.length}건)</summary>
              <ul>\${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}</ul>
            </details>
          </div>\` : ''}
        </article>
      \`;
    }

    function copySelfServiceResults() {
      if (!window._ssLeads) return;
      const text = window._ssLeads.map(l =>
        \`[\${l.grade}] \${l.company} (\${l.score}점)\\n프로젝트: \${l.project_title}\\n제품: \${l.recommended_product}\\nROI: \${l.expected_roi}\\nPitch: \${l.sales_pitch}\\n트렌드: \${l.trend}\`
      ).join('\\n\\n---\\n\\n');
      navigator.clipboard.writeText(text).then(() => {
        const status = document.getElementById('ssStatus');
        status.className = 'status success'; status.textContent = '클립보드에 복사되었습니다!';
      });
    }

    function downloadSelfServiceResults() {
      if (!window._ssLeads) return;
      const payload = {
        leads: window._ssLeads.map(normalizeSelfServiceLead),
        summary: String(window._ssSummary || '').trim() || (window._ssLeads.length + '개 영업 기회를 즉시 분석했습니다.')
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = (window._ssProfile?.name || 'leads') + '_' + new Date().toISOString().split('T')[0] + '.json';
      a.click(); URL.revokeObjectURL(a.href);
    }

    // ===== 관리 프로필 =====
    ${getPasswordTokenScript('password')}
    async function generate() {
      const btn = document.getElementById('generateBtn');
      const status = document.getElementById('status');
      const password = getToken();
      const profile = document.getElementById('profileSelect').value || 'danfoss';

      if (!password) {
        status.className = 'status error';
        status.textContent = '비밀번호를 입력하세요.';
        return;
      }

      btn.disabled = true;
      btn.textContent = '처리 중...';
      status.className = 'status loading';
      status.textContent = '보고서 생성을 요청하고 있습니다...';

      try {
        const res = await fetch('/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + password },
          body: JSON.stringify({ profile })
        });
        const data = await res.json();
        status.className = data.success ? 'status success' : 'status error';
        status.textContent = data.message + (data.requestId ? ' (requestId: ' + data.requestId + ')' : '');
      } catch (e) {
        status.className = 'status error';
        status.textContent = '요청 실패: ' + e.message;
      }

      btn.disabled = false;
      btn.textContent = '보고서 생성';
    }

    document.querySelectorAll('.nav-buttons a').forEach((a) => {
      a.addEventListener('click', function (e) {
        const profile = document.getElementById('profileSelect').value || 'danfoss';
        e.preventDefault();
        window.location.href = this.getAttribute('href') + '?profile=' + encodeURIComponent(profile);
      });
    });
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  </script>
</body>
</html>`;
}

export const getHomePage = getMainPage;
