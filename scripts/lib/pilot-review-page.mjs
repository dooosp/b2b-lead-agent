import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { pilotReviewStyles } from './pilot-review-styles.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fitLabels = { FIT: '조건 충족', CONDITIONAL_FIT: '조건부 검토', INSUFFICIENT_EVIDENCE: '근거 부족', NOT_FIT: '조건 불충족', NOT_EVALUATED: '미평가' };
const familyLabels = { medium_voltage_switchgear: '중전압 수배전반', fire_detection: '화재 감지', physical_security: '물리 보안', building_management: '빌딩 관리 시스템', energy_analytics: '에너지 분석' };
const labels = {
  incoming_voltage: '수전전압', required_protocols: '필수 통신 프로토콜',
  HARD: '필수 조건', SOFT: '참고 조건', GTE: '이상', LTE: '이하', EQ: '일치', CONTAINS_ALL: '요구 항목 모두 포함', KNOWN: '근거 확인됨', UNKNOWN: '미확인',
  BASIC_DESIGN: '기본설계', AWARD: '수주', TENDER: '입찰', RETROFIT: '개보수',
  OPEN: '검토 가능', CLOSED: '검토 시점 종료', NOT_YET_OPEN: '검토 시점 전',
  VERIFIED: '검증됨 · VERIFIED', UNVERIFIED: '미검증 · UNVERIFIED', EXPIRED: '기한 만료 · EXPIRED', RETRACTED: '철회됨 · RETRACTED', CLAIM_UNVERIFIED: '검증되지 않은 근거', CLAIM_EXPIRED: '유효 기한이 지난 근거', CLAIM_NOT_APPLICABLE: '현재 적용 범위에 맞지 않는 근거', BACNET_IP: 'BACnet/IP', MODBUS_TCP: 'Modbus TCP',
  ALREADY_REVIEWABLE: '현재 근거로 기술 검토 가능', EVIDENCE_REQUIRED_FOR_REEVALUATION: '재평가 전에 근거 보강 필요',
  NO_EVIDENCE_ONLY_ADVANCE_PATH: '추가 근거만으로 진행할 수 없음', NON_EVIDENCE_GATE_BLOCKED: '근거 외 진행 조건 확인 필요',
  electrical_single_line: '승인된 최신 단선결선도', verified_product_capability_record: '유효한 검증 제품 사양 자료', approved_project_stage_record: '승인된 최신 프로젝트 단계 자료',
  electrical_application_engineering: '전기 설계·응용 담당자', product_application_engineering: '제품 기술·응용 담당자', project_management: '프로젝트 관리 담당자',
  READY_FOR_TECHNICAL_REVIEW: '기술 검토 계속', REQUEST_ELECTRICAL_SINGLE_LINE: '수전전압 자료 확인', VERIFY_PRODUCT_CAPABILITY: '제품 역량 근거 확인', VERIFY_PROJECT_STAGE: '프로젝트 단계 근거 확인', HOLD_NO_VERIFIED_CAPABILITY: '기술 진행 보류',
};
const displayCopy = value => String(value).replace(/\bUNKNOWN\b/g, '미확인').replace(/\bAWARD\b/g, '수주').replace(/\bBASIC_DESIGN\b/g, '기본설계').replace(/사양 창이 닫혔습니다/g, '검토 가능한 시점이 종료되었습니다').replace(/사양 창/g, '검토 시점');
const display = value => labels[value] || familyLabels[value] || value;
const questionLabels = {
  REQUEST_ELECTRICAL_SINGLE_LINE: '승인된 단선결선도에서 수전전압 등급을 확인하세요.',
  VERIFY_PRODUCT_CAPABILITY: '필수 통신 프로토콜을 확인할 수 있는 유효한 제품 근거를 요청하세요.',
  VERIFY_PROJECT_STAGE: '검토 가능한 시점을 판단할 최신 프로젝트 단계 근거를 요청하세요.',
};
const gateLabels = {
  VERIFIED_HARD_REQUIREMENT_MISMATCH: ['확인된 필수 사양이 맞지 않습니다.', '확인된 프로젝트 요구와 후보 사양이 일치하지 않습니다. 현재 후보의 기술 조건을 다시 검토해야 합니다.'],
  APPLICABILITY_MISMATCH: ['현재 적용 범위가 맞지 않습니다.', '현재 근거가 프로젝트의 관할 등 적용 조건에 맞지 않습니다. 자료 수집 외에 적용 범위나 기술 조건을 검토해야 합니다.'],
  SPECIFICATION_WINDOW_CLOSED: ['검토 가능한 시점이 종료되었습니다.', '확인된 현재 프로젝트 단계가 이 제품군의 사양 검토 시점을 벗어났습니다.'],
};
const valueText = value => value ? `${Array.isArray(value.value) ? value.value.map(display).join(' · ') : value.value} ${value.unit || ''}`.trim() : '값 없음';
const trace = value => esc(JSON.stringify(value, null, 2));
function source(claim, item) {
  const usable = item.dossier.customerUsableClaims.some(usable => usable.claimId === claim.claimId);
  const blocked = item.dossier.blockedClaims.find(blocked => blocked.claimId === claim.claimId);
  const use = usable ? '이 평가의 사용 근거' : blocked ? `이 평가에서 차단: ${blocked.reasonCodes.map(display).join(' · ')}` : '참조 후보 · 이 평가의 사용 근거 아님';
  const scope = claim.applicability;
  return `<details class="source"><summary>${esc(claim.evidence[0]?.sourceTitle || `${display(claim.subject.id)} · 미검증 제품 주장`)}<small>${esc(display(claim.status))} · ${esc(use)}</small></summary><div class="source-content"><p>${esc(claim.statement)}</p>${claim.evidence.map(evidence => `<blockquote>${esc(evidence.directQuote)}</blockquote><p class="muted">${esc(evidence.sourceUrl)}</p>`).join('')}<dl class="scope"><div><dt>출처의 적용 관할</dt><dd>${esc(scope.jurisdictions.join(' · ') || '제한 없음')}</dd></div><div><dt>출처의 적용 제품군</dt><dd>${esc(scope.productFamilyIds.map(display).join(' · ') || '제한 없음')}</dd></div><div><dt>출처의 적용 단계</dt><dd>${esc(scope.projectStages.map(display).join(' · ') || '제한 없음')}</dd></div><div><dt>유효 기한 · 고정 평가시점 기준</dt><dd>${esc(claim.verification.validUntil || '기한 미지정')}</dd></div><div><dt>추가 조건</dt><dd>${esc(JSON.stringify(scope.conditions))}</dd></div><div><dt>검증 시각</dt><dd>${esc(claim.verification.verifiedAt || '검증되지 않음')}</dd></div></dl><code class="small-code">${esc(claim.claimKey)}<br>${esc(claim.claimId)}</code></div></details>`;
}
function casePanel(item, index) {
  const outcome = item.evaluation.results[0];
  const minimum = item.minimumEvidence;
  const capabilities = item.claims.filter(claim => claim.claimType === 'PRODUCT_CAPABILITY');
  return `<section id="case-${esc(item.id)}" aria-labelledby="case-heading-${esc(item.id)}" ${index ? 'hidden' : ''}>
    <div class="case-intro"><span class="eyebrow">CASE ${String(index + 1).padStart(2, '0')} / SYNTHETIC TECHNICAL REVIEW</span><h2 id="case-heading-${esc(item.id)}" tabindex="-1">${esc(displayCopy(item.title))}</h2><p>${esc(displayCopy(item.description))}</p><div class="context"><span>${esc(item.opportunity.identity.projectDisplayName)}</span><span>관할 ${esc(item.opportunity.jurisdiction)}</span><span>단계 ${esc(display(item.opportunity.stage.value))}</span><span>${esc(familyLabels[outcome.productFamilyId] || outcome.productFamilyId)}</span></div></div>
    <div class="result-strip ${outcome.result === 'FIT' && outcome.window.state === 'OPEN' ? '' : 'warn'}"><div><small>엔진의 기술 판정</small><strong>${esc(fitLabels[outcome.result])}</strong>${outcome.result === 'FIT' ? '<code>FIT</code>' : ''}</div><div><small>검토 가능한 시점</small><strong>${esc(display(outcome.window.state))}</strong><small>FIT는 사람의 진행 승인이나 제품 선정이 아닙니다.</small></div></div>
    <div class="comparison"><article class="panel"><span class="eyebrow">01 / 프로젝트 요구</span>${item.opportunity.requirements.map(requirement => `<div class="requirement"><h3>${esc(display(requirement.key))}</h3><div class="value">${requirement.valueState === 'KNOWN' ? esc(valueText(requirement.value)) : '미확인'}</div><p>${esc(display(requirement.priority))} · ${esc(display(requirement.operator))} · ${esc(requirement.valueState === 'KNOWN' && outcome.requirementResults.find(result => result.requirementId === requirement.requirementId)?.state === 'UNKNOWN' ? '적용 근거 미확인' : display(requirement.valueState))}</p><p class="muted">${requirement.valueState === 'KNOWN' ? '값과 출처의 적용성은 아래 엔진 추적으로 확인하세요.' : '보존된 원시 숫자는 확정 요구가 아닙니다. 현재 요구를 확인할 근거가 필요합니다.'}</p></div>`).join('')}</article>
    <article class="panel"><span class="eyebrow">02 / 후보 근거의 기재 사양</span>${capabilities.map(claim => `<div class="requirement"><h3>${esc(display(claim.subject.id))}</h3><div class="value">${esc(valueText(claim.value))}</div><p>${esc(display(claim.status))}</p><p class="muted">기재된 사양 자체가 현재 요구에 적용 가능하다는 뜻은 아닙니다.</p></div>`).join('') || '<p>등록된 후보 사양이 없습니다.</p>'}</article></div>
    <article class="panel"><span class="eyebrow">03 / 확인할 것</span><h3>추가 근거와 진행 차단 조건</h3><p class="muted">${esc(display(minimum.advancementState))} · 자료를 채워도 적합이나 사람의 승인을 보장하지 않습니다.</p>
    ${minimum.evidenceItems.map(evidence => `<div class="action-item"><strong>${esc(questionLabels[evidence.actionCode] || evidence.text)}</strong><dl><dt>요청할 자료</dt><dd>${esc(evidence.requestedArtifacts.map(display).join(' · '))}</dd><dt>확인 담당 역할</dt><dd>${esc(display(evidence.ownerRole))}</dd></dl><p class="muted">자료 확보 후에는 다시 평가합니다. 적합 판정이나 진행 승인은 보장되지 않습니다.</p></div>`).join('') || '<p class="help">엔진이 추가 근거 요청 항목을 생성하지 않았습니다. 최종 검토와 상업적 판단은 별도입니다.</p>'}
    ${minimum.nonEvidenceGates.map(gate => `<div class="blocker"><strong>${esc(gateLabels[gate.code]?.[0] || gate.code)}</strong><p>${esc(gateLabels[gate.code]?.[1] || gate.detail)}</p><p class="muted">추가 근거만으로 해결: 아니요</p></div>`).join('')}
    <p class="help">엔진이 제안하는 다음 기술 행동: ${esc(display(item.dossier.reviewerNextAction.primary))}<br>아래 검토자의 판단·이유·행동에는 자동 입력하지 않습니다.</p></article>
    <article class="panel"><span class="eyebrow">04 / 출처와 적용 범위</span><h3>합성 근거 원문 확인</h3><p class="muted">VERIFIED는 등록 근거의 검증 상태입니다. 관할·제품군·단계·기한이 현재 맥락에 맞는지 별도로 확인하세요. 출처 주소는 표시만 하며 네트워크로 열지 않습니다.</p>${item.claims.map(claim => source(claim, item)).join('')}</article>
    <article class="panel trace"><details><summary>엔진 판정 · 근거 ID · 고정 입력 전체 추적</summary><p>사례 지문 <code>${esc(item.caseSha256)}</code></p><p>입력 지문 <code>${esc(item.inputSha256)}</code></p><pre>${trace(item)}</pre></details></article>
  </section>`;
}
export function renderPilotReviewPage(workspace) {
  const script = buildSync({ entryPoints: [fileURLToPath(new URL('./pilot-review-browser.mjs', import.meta.url))], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', minify: false, legalComments: 'none' }).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const data = JSON.stringify(workspace).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>기술 검토 워크스페이스 · B2B Lead Agent</title><style>${pilotReviewStyles}</style></head><body>
  <a class="skip" href="#review-main">검토 내용으로 이동</a><header class="topbar"><p class="brand">B2B LEAD AGENT / REVIEW WORKSPACE</p><div class="top-title"><div><h1>근거를 확인하고, 다음 판단을 남기세요.</h1><p class="muted">7개 독립 합성 사례 · 요구사항 → 적용 근거 → 다음 행동 → 직접 입력한 판단</p></div><div class="toolbar" aria-label="기록 내보내기와 다시 열기"><label class="file-control">기록 JSON 다시 열기<input id="import-record" type="file" accept="application/json,.json" aria-label="기록 JSON 다시 열기"></label><button id="export-json" class="primary" type="button" disabled>JSON 기록 내보내기</button><button id="export-markdown" type="button" disabled>검토 패키지 Markdown</button></div></div></header>
  <div class="boundary">합성 데이터 전용 · 페이지 메모리에만 저장 · 개인정보·고객자료 입력 금지 · 실제 제품 검증이나 정식 파일럿 결과 아님</div><noscript><p class="noscript">기록 입력·전환·내보내기에는 JavaScript가 필요합니다. 이 문서는 외부 리소스를 사용하지 않습니다.</p></noscript>
  <div class="workspace"><aside class="queue"><h2>검토 사례 <span class="muted">/ ${workspace.cases.length}</span></h2><nav aria-label="검토 사례 선택">${workspace.cases.map((item,index) => `<button class="case-button" data-case="${esc(item.id)}" aria-controls="case-${esc(item.id)}" aria-pressed="${!index}" type="button"><span class="queue-index">사례 ${String(index + 1).padStart(2,'0')}</span><strong>${esc(displayCopy(item.title.split(' · ')[0]))}</strong><span class="queue-meta"><span>${esc(fitLabels[item.evaluation.results[0].result])}</span><span data-review-status="${esc(item.id)}">미작성</span></span></button>`).join('')}</nav><p class="queue-note">같은 프로젝트의 시간순 개정이 아닌 독립된 평가 예시입니다. 사례를 전환해도 직접 입력한 초안은 이 페이지에 남습니다.</p></aside>
  <main class="main" id="review-main"><p id="selected-case-status" role="status" aria-live="polite"></p><div class="main-grid"><div class="case-area">${workspace.cases.map(casePanel).join('')}</div>
  <section class="review-card" aria-labelledby="review-heading"><span class="eyebrow">YOUR REVIEW / 수동 기록</span><h2 id="review-heading">검토자의 판단</h2><p id="review-case-title" class="review-case-title"></p><div class="kind"><label for="record-kind">기록 구분</label><select id="record-kind"><option value="">직접 선택하세요</option><option value="OWNER_REPRODUCTION">본인 직접 재현</option><option value="OTHER_USER_TRIAL">다른 사용자 1인 체험</option><option value="AGENT_SIMULATION">에이전트 시뮬레이션</option></select><p id="authorship-status" class="help"></p></div>
  <label for="disposition">검토 판단</label><select id="disposition"><option value="UNDECIDED">미결정 / 초안</option><option value="CONTINUE_TECHNICAL_REVIEW">기술 검토 계속</option><option value="HOLD">보류</option><option value="EXCLUDE_CURRENT_CANDIDATE">현재 후보 제외</option></select>
  <label for="reason">판단 이유</label><textarea id="reason" maxlength="1600" placeholder="확인한 조건·근거와 판단 이유를 직접 적으세요."></textarea>
  <label for="nextAction">내 다음 행동</label><textarea id="nextAction" maxlength="1600" placeholder="누구에게 무엇을 확인하고 다음에 무엇을 할지 적으세요."></textarea>
  <p class="help">완료 조건: 미결정 외 판단 + 비어 있지 않은 이유 + 다음 행동. 미완료 초안도 내보낼 수 있습니다.</p>
  <details class="measurement"><summary>선택: 자기보고 작업시간</summary><p>동일 사례의 기존 방식과 도구 사용 시간을 알고 있을 때만 입력하세요. 기본값·자동 측정은 없으며, 모르면 비워둡니다.</p><div class="timings"><div><label for="baselineMinutes">기준 작업시간 (분)</label><input id="baselineMinutes" type="number" min="0" max="1440" step="any" inputmode="decimal"></div><div><label for="assistedMinutes">도구 사용시간 (분)</label><input id="assistedMinutes" type="number" min="0" max="1440" step="any" inputmode="decimal"></div></div></details>
  <p id="timing-summary" class="help"></p><p class="help">짝지은 시간만 집계합니다. 자기보고 시간은 검증된 절감·ROI·효과 또는 정식 파일럿 증거가 아닙니다.</p>
  <p id="review-progress" class="review-progress" role="status" aria-live="polite"></p><p id="record-error" class="error" role="alert"></p><p id="draft-status" role="status" aria-live="polite"></p><button id="next-case" class="next-case" type="button">다음 사례 검토 →</button><button id="reset-record" class="reset" type="button">전체 기록 초기화</button></section></div></main></div>
  <footer><p>NOT_PRODUCTION_EVIDENCE · synthetic:true · productionReady:false · Issue #165 HOLD · formalPilotContribution:false</p><p>판정 기준시각 ${esc(workspace.evaluationAsOf)} · <code>workspace ${esc(workspace.workspaceSha256)}</code></p><p>현재 페이지 입력은 서버나 브라우저 저장소로 보내지 않습니다. JSON 보관본을 내려받은 뒤 동일 워크스페이스에서만 다시 열 수 있습니다.</p></footer>
  <script id="workspace-data" type="application/json">${data}</script><script>${script}</script></body></html>`;
}
