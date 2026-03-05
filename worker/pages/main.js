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
    .ss-lead-card { background: #1e2a3a; border-radius: 12px; padding: 16px; margin: 12px 0; border-left: 4px solid #e94560; }
    .ss-lead-card.grade-b { border-left-color: #f39c12; }
    .ss-lead-card h3 { color: #e94560; margin: 0 0 10px 0; font-size: 16px; }
    .ss-lead-card.grade-b h3 { color: #f39c12; }
    .ss-lead-card p { margin: 4px 0; font-size: 13px; color: #ccc; line-height: 1.6; }
    .ss-lead-card strong { color: #fff; }
    .ss-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: center; }
    .ss-stats { font-size: 12px; color: #888; margin-top: 8px; }
    .ss-sources { margin-top: 10px; padding-top: 10px; border-top: 1px solid #2a3a4a; }
    .ss-sources summary { color: #aaa; font-size: 12px; cursor: pointer; }
    .ss-sources a { color: #3498db; text-decoration: none; font-size: 12px; }
    .ss-sources a:hover { text-decoration: underline; }
    .ss-sources li { margin: 3px 0; list-style: none; }
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company, industry })
        });
        const data = await res.json();
        clearInterval(progressInterval);
        fill.style.width = '100%';

        if (!data.success) {
          status.className = 'status error'; status.textContent = data.message;
          results.innerHTML = '';
        } else if (!data.leads || data.leads.length === 0) {
          status.className = 'status success';
          status.textContent = data.message || '분석 완료했지만 유효한 리드를 찾지 못했습니다.';
          if (data.stats) status.textContent += ' (' + data.stats.elapsed + '초)';
          results.innerHTML = '';
        } else {
          status.className = 'status success';
          status.textContent = data.leads.length + '개 리드 발견! (' + (data.stats ? data.stats.elapsed + '초, 뉴스 ' + data.stats.articles + '건 분석' : '') + ')';
          if (data.message) status.textContent += ' ' + data.message;
          renderSelfServiceResults(data.leads, data.profile, data.summary);
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
      const projectTitle = String(lead?.project_title || lead?.project || lead?.summary || '').trim();
      const product = String(lead?.recommended_product || lead?.product || '').trim();
      const roi = String(lead?.expected_roi || lead?.roi || '').trim();
      const salesPitch = String(lead?.sales_pitch || lead?.salesPitch || lead?.pitch || '').trim();
      const trend = String(lead?.trend || lead?.trends || lead?.globalContext || '').trim();
      return {
        company: String(lead?.company || '').trim(),
        score,
        grade: score >= 80 ? 'A' : score >= 50 ? 'B' : 'C',
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
      container.innerHTML = validLeads.map(lead => \`
        <div class="ss-lead-card \${lead.grade === 'B' ? 'grade-b' : ''}">
          <h3>\${esc(lead.grade)} | \${esc(lead.company)} (\${parseInt(lead.score)||0}점)</h3>
          <p><strong>프로젝트:</strong> \${esc(lead.project_title)}</p>
          <p><strong>추천 제품:</strong> \${esc(lead.recommended_product)}</p>
          <p><strong>예상 ROI:</strong> \${esc(lead.expected_roi)}</p>
          <p><strong>영업 제안:</strong> \${esc(lead.sales_pitch)}</p>
          <p><strong>글로벌 트렌드:</strong> \${esc(lead.trend)}</p>
          \${lead.sources && lead.sources.length > 0 ? \`
          <div class="ss-sources">
            <details>
              <summary>출처 (\${lead.sources.length}건)</summary>
              <ul>\${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}</ul>
            </details>
          </div>\` : ''}
        </div>
      \`).join('');

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
          body: JSON.stringify({ password, profile })
        });
        const data = await res.json();
        status.className = data.success ? 'status success' : 'status error';
        status.textContent = data.message;
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
