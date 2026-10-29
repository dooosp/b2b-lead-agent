// Inlined into standalone HTML. Keep this as browser source, not Function.toString().
export const portfolioBrowserScript = String.raw`
  let activeRevision = 'R1';
  let downloaded = false;
  const fields = ['record-kind', 'checked', 'judgment', 'remaining'].map(id => document.getElementById(id));
  const download = document.getElementById('download-record');
  function hasDraft() { return fields.some(field => field.value.trim()); }
  function isAgentSimulation() { return fields[0].value === 'AGENT_SIMULATION'; }
  const fieldNames = ['기록 구분', '확인한 근거와 적용 조건', '내 판단과 이유', '아직 확인할 것 · 사용 중 막힌 점'];
  function updateCompletion() {
    const missing = fields.map((field, index) => field.value.trim() ? null : fieldNames[index]).filter(Boolean);
    document.getElementById('record-progress').textContent = '필수 항목 ' + (fields.length - missing.length) + '/4 완료';
    document.getElementById('record-meter').value = fields.length - missing.length;
    document.getElementById('record-missing').textContent = missing.length
      ? '내려받으려면 입력하세요: ' + missing.join(' · ')
      : '모든 필수 항목을 작성했습니다. 내려받아 파일로 보관하세요.';
    download.disabled = missing.length > 0;
  }
  function updateDraft() {
    downloaded = false;
    updateCompletion();
    download.textContent = isAgentSimulation() ? '시뮬레이션 기록 내려받기' : '내 판단 기록 내려받기';
    document.getElementById('record-status').textContent = isAgentSimulation()
      ? '에이전트 시뮬레이션 작성 중 · 실제 사람의 참여 기록으로 집계하지 않습니다.'
      : hasDraft() ? '작성 중 · 내려받기 전에는 파일로 저장되지 않습니다.' : '사람의 재현·판단 기록은 아직 작성되지 않았습니다.';
  }
  updateCompletion();
  fields.forEach(field => { field.addEventListener('input', updateDraft); field.addEventListener('change', updateDraft); });
  document.querySelectorAll('[data-revision]').forEach(button => button.addEventListener('click', () => {
    activeRevision = button.dataset.revision;
    document.querySelectorAll('.revision').forEach(panel => { panel.hidden = panel.id !== 'panel-' + activeRevision; });
    document.querySelectorAll('[data-revision]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.getElementById('revision-status').textContent = '현재 ' + button.textContent;
  }));
  download.addEventListener('click', () => {
    if (fields.some(field => !field.value.trim())) return;
    const record = { ...metadata, recordedAt: new Date().toISOString(), recordKind: fields[0].value,
      ...(isAgentSimulation() ? { authorship: 'AI_AGENT_SIMULATION', humanParticipant: false } : {}),
      viewedRevisionAtExport: activeRevision, checkedEvidenceAndScope: fields[1].value.trim(),
      judgmentAndReason: fields[2].value.trim(), remainingQuestionsAndFriction: fields[3].value.trim() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = isAgentSimulation() ? 'b2b-portfolio-agent-simulation.json' : 'b2b-portfolio-personal-record.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); downloaded = true;
    document.getElementById('record-status').textContent = '내려받기를 요청했습니다. 다운로드 폴더에서 JSON 파일을 확인하세요. 정식 실험 집계는 변경되지 않습니다.';
  });
  // Repeated beforeprint events must not replace the original disclosure state.
  let printDisclosureState = null;
  function expandForPrint() {
    if (printDisclosureState) return;
    printDisclosureState = [...document.querySelectorAll('details')].map(element => ({ element, open: element.open }));
    printDisclosureState.forEach(({ element }) => { element.open = true; });
  }
  function restoreAfterPrint() {
    if (!printDisclosureState) return;
    printDisclosureState.forEach(({ element, open }) => { element.open = open; });
    printDisclosureState = null;
  }
  window.addEventListener('beforeprint', expandForPrint);
  window.addEventListener('afterprint', restoreAfterPrint);
  const printMedia = window.matchMedia('print');
  printMedia.addEventListener('change', event => event.matches ? expandForPrint() : restoreAfterPrint());
  document.getElementById('print-demo').addEventListener('click', () => window.print());
  window.addEventListener('beforeunload', event => { if (hasDraft() && !downloaded) { event.preventDefault(); event.returnValue = ''; } });
`;
