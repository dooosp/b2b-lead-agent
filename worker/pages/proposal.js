import { getCommonStyles } from './common-styles.js';
import { getEscScript, getPasswordTokenScript } from './script-snippets.js';

export function getProposalPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>기술제안서 자동 생성</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .proposal-output { background: linear-gradient(180deg, #172230 0%, #101823 100%); border-radius: 16px; padding: 24px; margin-top: 20px; text-align: left; font-size: 14px; line-height: 1.8; color: #ddd; display: none; max-height: 75vh; overflow-y: auto; border: 1px solid #2a3a4a; box-shadow: 0 14px 40px rgba(0,0,0,0.24); }
    .estimate-box { display:none; margin-top:12px; background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:14px 16px; text-align:left; font-size:12px; color:#c8d5e2; line-height:1.7; }
    .estimate-box strong { display:block; margin-bottom:8px; color:#f4f7fb; font-size:13px; }
    .estimate-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; margin-top:8px; }
    .estimate-item { background:#182433; border:1px solid #233447; border-radius:10px; padding:10px 12px; }
    .estimate-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:4px; }
    .estimate-value { display:block; color:#f4f7fb; font-size:13px; font-weight:700; }
    .proposal-doc { display:flex; flex-direction:column; gap:14px; }
    .proposal-section { background:#121b27; border:1px solid #223245; border-radius:14px; padding:16px 18px; }
    .proposal-section-head { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
    .proposal-index { width:32px; height:32px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; background:#e94560; color:#fff; font-size:12px; font-weight:700; flex:none; }
    .proposal-section h2 { color:#f3f6fa; font-size:17px; margin:0; }
    .proposal-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
    .proposal-item { padding:10px 12px; border-radius:10px; background:#182433; border:1px solid #223447; color:#d5dfeb; }
    .proposal-item.marker { background:transparent; border:none; padding:4px 0 0; color:#ffb4c0; font-weight:700; letter-spacing:0.01em; }
    .proposal-item-label { display:block; color:#8fa4b8; font-size:11px; text-transform:none; margin-bottom:4px; }
    .proposal-item-value { display:block; color:#f4f7fb; font-size:14px; }
    .proposal-source { display:block; margin-top:6px; color:#90a5ba; font-size:11px; }
    .proposal-note { color:#90a5ba; font-size:12px; margin-top:10px; }
    select, .form-input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; margin-bottom: 12px; }
    .form-row { display: flex; gap: 12px; }
    .form-row > * { flex: 1; }
    label { display: block; font-size: 12px; color: #aaa; margin-bottom: 4px; text-align: left; }
    .form-group { margin-bottom: 4px; text-align: left; }
    .system-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; margin:8px 0 12px; }
    .system-grid label { display:flex; align-items:center; gap:8px; margin:0; font-size:12px; color:#ccc; }
    .system-grid input { margin:0; }
    @media (max-width: 720px) {
      .estimate-grid { grid-template-columns:1fr; }
      .proposal-output { padding:18px; }
      .proposal-section { padding:14px; }
    }
  </style>
</head>
<body>
  <main class="container" style="max-width:700px;">
    <a href="/" class="back-link">← 메인으로</a>
    <h1 style="font-size:22px;">기술제안서 자동 생성</h1>
    <p class="subtitle">빌딩 정보를 입력하면 Desigo CC 기반 7섹션 제안서를 생성합니다</p>

    <div class="form-group"><label>빌딩 유형</label>
    <select id="buildingType">
      <option value="office">오피스 빌딩</option>
      <option value="datacenter">데이터센터</option>
      <option value="hospital">병원/의료시설</option>
      <option value="hotel">호텔/리조트</option>
      <option value="factory">공장/생산시설</option>
      <option value="school">학교/교육시설</option>
      <option value="apartment">아파트/주거</option>
      <option value="commercial">상업시설/몰</option>
    </select></div>

    <div class="form-row">
      <div class="form-group"><label>연면적 (㎡)</label>
      <input type="number" class="form-input" id="area" placeholder="예: 30000" min="100"></div>
      <div class="form-group"><label>층수</label>
      <input type="number" class="form-input" id="floors" placeholder="예: 20" min="1"></div>
    </div>

    <div class="form-group"><label>현재 BMS (선택)</label>
    <input type="text" class="form-input" id="currentBMS" placeholder="예: Honeywell EBI, 없음"></div>

    <div class="form-group"><label>월 에너지 비용 (만원, 선택)</label>
    <input type="number" class="form-input" id="monthlyEnergyCost" placeholder="예: 5000" min="0"></div>

    <div class="form-group">
      <label>시스템 범위</label>
      <div class="system-grid">
        <label><input type="checkbox" id="sys-hvac" checked> HVAC</label>
        <label><input type="checkbox" id="sys-lighting" checked> 조명</label>
        <label><input type="checkbox" id="sys-power" checked> 전력</label>
        <label><input type="checkbox" id="sys-fire" checked> 방재</label>
        <label><input type="checkbox" id="sys-extra" checked> 기타 설비</label>
      </div>
    </div>

    <input type="password" id="password" placeholder="비밀번호 입력" class="input-field">
    <button class="btn btn-primary" id="genBtn" onclick="generateProposal()">제안서 생성</button>
    <div class="status" id="status"></div>
    <div class="estimate-box" id="estimateBox"></div>
    <div class="proposal-output" id="output"></div>
  </main>

  <script>
    ${getEscScript()}
    ${getPasswordTokenScript('password')}

    async function generateProposal() {
      const password = getToken();
      const status = document.getElementById('status');
      const output = document.getElementById('output');
      const estimateBox = document.getElementById('estimateBox');
      const btn = document.getElementById('genBtn');

      if (!password) { status.className='status error'; status.textContent='비밀번호를 입력하세요.'; return; }

      const area = document.getElementById('area').value;
      const floors = document.getElementById('floors').value;
      if (!area || !floors) { status.className='status error'; status.textContent='면적과 층수는 필수입니다.'; return; }

      btn.disabled = true;
      btn.textContent = 'AI 생성 중...';
      status.className = 'status loading';
      status.textContent = 'AI가 기술제안서를 작성하고 있습니다... (15~25초)';
      output.style.display = 'none';
      estimateBox.style.display = 'none';
      estimateBox.innerHTML = '';

      try {
        const res = await fetch('/api/proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            buildingType: document.getElementById('buildingType').value,
            area, floors,
            currentBMS: document.getElementById('currentBMS').value,
            monthlyEnergyCost: document.getElementById('monthlyEnergyCost').value,
            systemFlags: {
              hvac: document.getElementById('sys-hvac').checked,
              lighting: document.getElementById('sys-lighting').checked,
              power: document.getElementById('sys-power').checked,
              fire: document.getElementById('sys-fire').checked,
              extra: document.getElementById('sys-extra').checked
            }
          })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = '제안서 생성 완료!';
          if (data.estimation) {
            estimateBox.innerHTML = renderEstimation(data.estimation);
            estimateBox.style.display = 'block';
          }
          output.style.display = 'block';
          output.innerHTML = formatMarkdown(data.content);
        } else {
          status.className = 'status error';
          status.textContent = data.error || data.message || '제안서 생성에 실패했습니다.';
        }
      } catch(e) {
        status.className = 'status error';
        status.textContent = '오류: ' + e.message;
      }

      btn.disabled = false;
      btn.textContent = '제안서 생성';
    }

    function renderEstimation(est) {
      const ps = est.pointsBySystem || {};
      const ctr = est.controllers || {};
      const range = est.pointRange || {};
      return [
        '<strong>산정 엔진 결과(고정)</strong>',
        '<div class="estimate-grid">',
        renderEstimateItem('HVAC', (ps.hvac || 0) + ' 포인트'),
        renderEstimateItem('조명', (ps.lighting || 0) + ' 포인트'),
        renderEstimateItem('전력', (ps.power || 0) + ' 포인트'),
        renderEstimateItem('방재', (ps.fire || 0) + ' 포인트'),
        renderEstimateItem('기타', (ps.extra || 0) + ' 포인트'),
        renderEstimateItem('총 포인트', (est.totalPoints || 0) + ' (' + (range.min || 0) + '~' + (range.max || 0) + ')'),
        renderEstimateItem('컨트롤러', '최소 ' + (ctr.min || 0) + ' / 권장 ' + (ctr.recommended || 0) + ' / 최대 ' + (ctr.max || 0)),
        '</div>'
      ].join('');
    }

    function renderEstimateItem(label, value) {
      return '<div class="estimate-item"><span class="estimate-label">' + esc(label) + '</span><span class="estimate-value">' + esc(value) + '</span></div>';
    }

    function formatMarkdown(text) {
      const sections = parseProposalSections(text);
      if (!sections.length) {
        return '<div class="proposal-note">문서 본문을 구조화하지 못했습니다. 원문을 그대로 표시합니다.</div><pre>' + esc(text) + '</pre>';
      }
      return '<div class="proposal-doc">' + sections.map(renderProposalSection).join('') + '</div>';
    }

    function parseProposalSections(text) {
      const lines = String(text || '').split(/\\r?\\n/);
      const sections = [];
      let current = null;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const headingMatch = line.match(/^##\\s+(\\d+)\\.\\s+(.+)$/);
        if (headingMatch) {
          current = { number: headingMatch[1], title: headingMatch[2], items: [] };
          sections.push(current);
          continue;
        }
        if (!current) continue;
        if (line.startsWith('- ')) {
          current.items.push(line.slice(2).trim());
        } else {
          current.items.push(line);
        }
      }

      return sections;
    }

    function renderProposalSection(section) {
      return '<section class="proposal-section">'
        + '<div class="proposal-section-head"><span class="proposal-index">' + esc(section.number) + '</span><h2>' + esc(section.title) + '</h2></div>'
        + '<ul class="proposal-list">' + section.items.map(renderProposalItem).join('') + '</ul>'
        + '</section>';
    }

    function renderProposalItem(item) {
      const markerMatch = item.match(/^(?:[A-D]\\(.+\\)|M&V\\/검증(?: placeholder)?)$/);
      if (markerMatch) {
        return '<li class="proposal-item marker">' + esc(item.replace(' placeholder', '')) + '</li>';
      }

      const sourceMatch = item.match(/\\s*\\(근거:\\s*([^)]*)\\)\\s*$/);
      const source = sourceMatch ? sourceMatch[1].trim() : '';
      const body = sourceMatch ? item.slice(0, sourceMatch.index).trim() : item.trim();
      const labelMatch = body.match(/^([^:]{1,32}):\\s+(.+)$/);

      if (labelMatch) {
        return '<li class="proposal-item"><span class="proposal-item-label">' + esc(labelMatch[1]) + '</span><span class="proposal-item-value">' + esc(labelMatch[2]) + '</span>' + renderSource(source) + '</li>';
      }

      return '<li class="proposal-item"><span class="proposal-item-value">' + esc(body) + '</span>' + renderSource(source) + '</li>';
    }

    function renderSource(source) {
      return source ? '<span class="proposal-source">근거: ' + esc(source) + '</span>' : '';
    }
  </script>
</body>
</html>`;
}
