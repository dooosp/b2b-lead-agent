import { createPilotDraft, createPilotReviewRecord, parsePilotReviewRecord, serializePilotReviewRecord, pilotReviewSummary, renderPilotReviewMarkdown, PILOT_RECORD_MAX_BYTES } from './pilot-review-record.mjs';
const workspace = JSON.parse(document.getElementById('workspace-data').textContent);
let draft = createPilotDraft(workspace);
let selected = workspace.cases[0].id;
let savedSnapshot = JSON.stringify(draft);
const $ = id => document.getElementById(id);
const controls = ['disposition', 'reason', 'nextAction', 'baselineMinutes', 'assistedMinutes'];
const activeReview = () => draft.reviews.find(item => item.caseId === selected);
const hasDraft = () => Boolean(draft.recordKind || draft.reviews.some(item => item.disposition !== 'UNDECIDED' || item.reason || item.nextAction || item.baselineMinutes !== null || item.assistedMinutes !== null));
const showError = message => { $('record-error').textContent = message; };
function status() {
  const summary = pilotReviewSummary(draft);
  $('review-progress').textContent = `${summary.completedCases}/${summary.totalCases} 사례 기록 완료 · 나머지는 초안`;
  for (const review of draft.reviews) {
    const complete = review.disposition !== 'UNDECIDED' && review.reason.trim() && review.nextAction.trim();
    document.querySelector(`[data-review-status="${review.caseId}"]`).textContent = complete ? '기록 완료' : (review.reason || review.nextAction || review.disposition !== 'UNDECIDED') ? '초안 작성 중' : '미작성';
  }
  let error = '';
  for (const review of draft.reviews) {
    for (const key of ['baselineMinutes','assistedMinutes']) if (review[key] !== null && (!Number.isFinite(review[key]) || review[key] < 0 || review[key] > 1440)) error = `${review.caseId} · ${key}: 0–1440분의 숫자를 입력하거나 비우세요.`;
  }
  if (!error && draft.recordKind) {
    try { createPilotReviewRecord(workspace, draft); } catch (e) { error = e.message; }
  }
  showError(error);
  $('export-json').disabled = !draft.recordKind || Boolean(error);
  $('export-markdown').disabled = !draft.recordKind || Boolean(error);
  const timing = summary.pairedCases ? `짝지은 자기보고 ${summary.pairedCases}건 · 기준 ${summary.baselineMinutes}분 / 도구 ${summary.assistedMinutes}분 · 기준−도구 ${summary.differenceMinutes}분 (음수는 도구 사용이 더 오래 걸림)` : '짝지은 자기보고 0건 · 기준과 도구 시간을 모두 입력한 사례만 집계합니다.';
  $('timing-summary').textContent = error ? '시간 입력을 확인하세요. 집계가 보류되었습니다.' : timing;
  $('authorship-status').textContent = draft.recordKind === 'AGENT_SIMULATION' ? 'AI_AGENT_SIMULATION · humanParticipant:false · 사람 참여 기록 아님' : draft.recordKind ? 'SELF_REPORTED_NOT_VERIFIED · 참여 여부와 시간은 검증되지 않은 자기보고' : '기록 구분을 직접 선택하세요. 사람 기록으로 자동 분류하지 않습니다.';
  $('draft-status').textContent = !hasDraft() ? '아직 입력한 기록이 없습니다. 초안은 페이지 메모리에만 남습니다.' : JSON.stringify(draft) === savedSnapshot ? '마지막 JSON 내보내기·열기 시점과 입력이 일치합니다.' : '현재 페이지에 변경사항이 있습니다. JSON으로 내보내 보관하세요.';
}
function selectCase(id, focus = false) {
  selected = id;
  for (const item of workspace.cases) {
    $('case-' + item.id).hidden = item.id !== id;
    const button = document.querySelector(`[data-case="${item.id}"]`);
    button.setAttribute('aria-pressed', String(item.id === id));
  }
  const item = workspace.cases.find(item => item.id === id);
  $('review-case-title').textContent = item.title.replace(/사양 창/g, '검토 시점');
  const review = activeReview();
  for (const key of controls) $(key).value = review[key] ?? '';
  $('selected-case-status').textContent = `${workspace.cases.findIndex(item => item.id === id) + 1}/${workspace.cases.length} · ${item.title.replace(/사양 창/g, '검토 시점')}`;
  status();
  if (focus) $('case-heading-' + id).focus({ preventScroll: true });
}
for (const button of document.querySelectorAll('[data-case]')) button.addEventListener('click', () => selectCase(button.dataset.case));
for (const key of controls) $(key).addEventListener('input', () => {
  activeReview()[key] = key.endsWith('Minutes') ? ($(key).validity.badInput ? NaN : $(key).value === '' ? null : Number($(key).value)) : $(key).value;
  status();
});
$('record-kind').addEventListener('change', () => { draft.recordKind = $('record-kind').value; status(); });
function download(content, filename, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('export-json').addEventListener('click', () => {
  try {
    const record = createPilotReviewRecord(workspace, draft);
    download(serializePilotReviewRecord(workspace, record), `b2b-pilot-${draft.recordKind.toLowerCase()}.json`, 'application/json');
    savedSnapshot = JSON.stringify(draft); status();
  } catch (e) { showError(e.message); }
});
$('export-markdown').addEventListener('click', () => {
  try { download(renderPilotReviewMarkdown(workspace, createPilotReviewRecord(workspace, draft)), `b2b-pilot-${draft.recordKind.toLowerCase()}.md`, 'text/markdown;charset=utf-8'); }
  catch (e) { showError(e.message); }
});
$('import-record').addEventListener('change', async () => {
  const file = $('import-record').files[0];
  if (!file) return;
  try {
    if (file.size > PILOT_RECORD_MAX_BYTES) throw new Error('record: maximum 128 KiB UTF-8');
    const record = parsePilotReviewRecord(await file.text(), workspace);
    if (hasDraft() && !window.confirm('현재 페이지의 모든 사례 기록을 파일 내용으로 바꿉니다. 내보내지 않은 입력은 사라집니다. 계속할까요?')) return;
    draft = { recordKind: record.recordKind, reviews: record.reviews };
    savedSnapshot = JSON.stringify(draft);
    $('record-kind').value = draft.recordKind;
    selectCase(selected);
    $('draft-status').textContent = 'JSON 기록을 다시 열었습니다. 엔진 결과와 근거는 고정된 원본입니다.';
  } catch (e) { showError(e.message); }
  finally { $('import-record').value = ''; }
});
$('reset-record').addEventListener('click', () => {
  if (hasDraft() && !window.confirm('모든 사례의 입력 기록을 비웁니다. 내보내지 않은 입력은 사라집니다. 계속할까요?')) return;
  draft = createPilotDraft(workspace); savedSnapshot = JSON.stringify(draft);
  $('record-kind').value = ''; selectCase(selected);
});
$('next-case').addEventListener('click', () => {
  const next = workspace.cases[(workspace.cases.findIndex(item => item.id === selected) + 1) % workspace.cases.length];
  selectCase(next.id, true);
  $('case-heading-' + next.id).scrollIntoView({ behavior: 'smooth', block: 'start' });
});
window.addEventListener('beforeunload', event => {
  if (JSON.stringify(draft) !== savedSnapshot) { event.preventDefault(); event.returnValue = ''; }
});
selectCase(selected);
