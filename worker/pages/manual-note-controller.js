/** Memory-only drafts shared by the list and detail views. No browser persistence. */
export function getManualNoteControllerScript({ findLead, onChange, onConflict, onDenied }) {
  return `
    function createManualNoteController({ findLead, onChange, onConflict, onDenied }) {
      const drafts = new Map();
      const notices = new Map();
      const timers = new Map();
      const queues = new Map();
      const pending = new Map();
      const submissions = new WeakMap();
      let accessEpoch = 0;
      const draftNotice = '저장 전 · 초안은 이 페이지에서만 보관됩니다.';
      const savedValue = lead => String(lead && (lead.manualReviewNotes ?? lead.notes) || '');
      const value = lead => drafts.has(lead.id) ? drafts.get(lead.id).value : savedValue(lead);
      function changed(id) { onChange(id); }
      function remember(id, text) {
        const lead = findLead(id);
        if (!lead) return;
        const previous = drafts.get(id);
        if (pending.has(id) || text !== savedValue(lead) || previous && previous.blocked) {
          drafts.set(id, { value: text, blocked: Boolean(previous && previous.blocked) });
        } else drafts.delete(id);
        if (!previous || !previous.blocked) notices.set(id, drafts.has(id) ? draftNotice : '');
        changed(id);
      }
      function cancelTimer(id) { clearTimeout(timers.get(id)); timers.delete(id); }
      function reset() {
        accessEpoch++;
        timers.forEach(clearTimeout);
        timers.clear(); drafts.clear(); notices.clear(); pending.clear(); queues.clear();
      }
      function block(id, message) {
        cancelTimer(id);
        const draft = drafts.get(id);
        if (draft) draft.blocked = true;
        notices.set(id, message);
        changed(id);
      }
      function save(id, explicit = false) {
        cancelTimer(id);
        const draft = drafts.get(id);
        if (!draft || draft.blocked && !explicit) return Promise.resolve();
        if (submissions.has(draft)) return submissions.get(draft);
        if (explicit) draft.blocked = false;
        const epoch = accessEpoch;
        const text = draft.value;
        pending.set(id, (pending.get(id) || 0) + 1);
        notices.set(id, '저장 중 · 새 입력은 저장 전입니다.');
        changed(id);
        const previous = queues.get(id) || Promise.resolve();
        const next = previous.then(async () => {
          if (epoch !== accessEpoch || drafts.get(id)?.blocked) return;
          const lead = findLead(id);
          if (!lead) return;
          try {
            const res = await fetch('/api/leads/' + encodeURIComponent(id), {
              method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({ manualReviewNotes: text, expectedVersion: lead.version })
            });
            const data = await res.json().catch(() => ({}));
            if (epoch !== accessEpoch) return;
            if (res.status === 401 || res.status === 403 || data.manualReviewNotesAccess && data.manualReviewNotesAccess.manualNotesRead !== true) {
              reset(); await onDenied(); return;
            }
            if (data.code === 'LEAD_VERSION_CONFLICT') {
              block(id, '저장 전 · 충돌: 최신 리드를 확인하고 저장 버튼으로 다시 시도하세요. 자동 재시도하지 않습니다.');
              await onConflict(id);
              return;
            }
            if (!res.ok || !data.success || !data.lead || data.lead.id !== id) {
              block(id, '저장 전 · 저장 실패. 입력은 유지됩니다. 저장 버튼으로 다시 시도하세요.');
              return;
            }
            // A refresh can replace the cached object while this request is pending.
            const currentLead = findLead(id);
            if (!currentLead) {
              block(id, '저장 전 · 저장 응답을 받았지만 최신 리드를 확인할 수 없습니다. 다시 조회하고 확인하세요.');
              return;
            }
            if (Number(currentLead.version) > Number(data.lead.version)) {
              if (savedValue(currentLead) !== savedValue(data.lead)) {
                block(id, '저장 전 · 충돌: 더 최신 메모가 있습니다. 최신 리드를 확인하고 저장 버튼으로 다시 시도하세요.');
                return;
              }
            } else Object.assign(currentLead, data.lead);
            if (drafts.get(id) === draft) drafts.delete(id);
            notices.set(id, drafts.has(id) ? draftNotice : text.trim() ? '저장됨' : '지워짐');
            changed(id);
          } catch (error) {
            if (epoch === accessEpoch) block(id, '저장 전 · 네트워크 또는 새로고침 실패. 입력은 유지됩니다. 저장 버튼으로 다시 시도하세요.');
          }
        }).finally(() => {
          submissions.delete(draft);
          if (epoch !== accessEpoch) return;
          const count = (pending.get(id) || 1) - 1;
          if (count > 0) pending.set(id, count); else pending.delete(id);
          if (queues.get(id) === next) queues.delete(id);
        });
        submissions.set(draft, next);
        queues.set(id, next);
        return next;
      }
      return {
        drafts, value, reset,
        notice: id => notices.get(id) || (drafts.has(id) ? draftNotice : ''),
        hasUnsaved: () => drafts.size > 0 || pending.size > 0,
        input(id, text) {
          remember(id, text);
          cancelTimer(id);
          if (!drafts.get(id)?.blocked) timers.set(id, setTimeout(() => save(id), 800));
        },
        save,
        clear(id) {
          if (!window.confirm('저장된 수동 리뷰 메모를 지울까요? 생성된 리뷰 노트 제안은 그대로 유지됩니다.')) return;
          remember(id, '');
          // A clear can reverse an in-flight save even when the saved value is empty.
          return save(id, true);
        }
      };
    }
    const manualNoteController = createManualNoteController({
      findLead: ${findLead}, onChange: ${onChange}, onConflict: ${onConflict}, onDenied: ${onDenied}
    });
  `;
}
