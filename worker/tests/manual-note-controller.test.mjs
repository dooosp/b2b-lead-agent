import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getManualNoteControllerScript } from '../pages/manual-note-controller.js';

function createController(fetchImpl, { onConflict = () => {}, onDenied = () => {} } = {}) {
  const lead = { id: 'synthetic-lead', version: 1, manualReviewNotes: 'accepted' };
  const timers = new Map();
  let timerId = 0;
  const context = vm.createContext({
    Map, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
    fetch: fetchImpl, authHeaders: () => ({}), lead, conflict: onConflict, denied: onDenied,
    window: { confirm: () => true }
  });
  vm.runInContext(getManualNoteControllerScript({ findLead: 'id => id === lead.id ? lead : null', onChange: '() => {}', onConflict: 'conflict', onDenied: 'denied' }) + '\nglobalThis.controller = manualNoteController;', context);
  return { controller: context.controller, lead, timers, replaceLead: replacement => { context.lead = replacement; } };
}

const accepted = (version, note) => ({ ok: true, status: 200, json: async () => ({ success: true, lead: { id: 'synthetic-lead', version, manualReviewNotes: note } }) });

test('manual note controller serializes writes using accepted versions while retaining reversed draft identity', async () => {
  const bodies = [];
  let release;
  const { controller, lead } = createController(async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (bodies.length === 1) await new Promise(resolve => { release = resolve; });
    return accepted(bodies.length + 1, body.manualReviewNotes);
  });
  controller.input(lead.id, 'first');
  const first = controller.save(lead.id, true);
  await Promise.resolve();
  controller.input(lead.id, 'newer');
  controller.input(lead.id, 'accepted');
  release();
  await first;
  assert.equal(controller.value(lead), 'accepted');
  assert.equal(lead.manualReviewNotes, 'first');
  assert.match(controller.notice(lead.id), /저장 전/);
  assert.equal(controller.hasUnsaved(), true);
  await controller.save(lead.id, true);
  assert.deepEqual(bodies, [ { manualReviewNotes: 'first', expectedVersion: 1 }, { manualReviewNotes: 'accepted', expectedVersion: 2 } ]);
  assert.equal(controller.hasUnsaved(), false);
});

test('manual conflict blocks already queued and blur writes until an explicit retry', async () => {
  let calls = 0;
  let refreshes = 0;
  let state;
  state = createController(async () => {
    calls++;
    return calls === 1 ? { ok: false, status: 409, json: async () => ({ success: false, code: 'LEAD_VERSION_CONFLICT' }) } : accepted(5, 'second');
  }, { onConflict: () => { refreshes++; state.lead.version = 4; } });
  state.controller.input(state.lead.id, 'first');
  const first = state.controller.save(state.lead.id);
  state.controller.input(state.lead.id, 'second');
  const second = state.controller.save(state.lead.id);
  await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(refreshes, 1);
  assert.equal(state.controller.value(state.lead), 'second');
  assert.match(state.controller.notice(state.lead.id), /충돌/);
  await state.controller.save(state.lead.id);
  assert.equal(calls, 1);
  await state.controller.save(state.lead.id, true);
  assert.equal(calls, 2);
  assert.equal(state.controller.hasUnsaved(), false);
});

test('access reset cancels note timers and prevents a delayed accepted write restoring protected state', async () => {
  let release;
  const { controller, lead, timers } = createController(async () => {
    await new Promise(resolve => { release = resolve; });
    return accepted(2, 'private-draft');
  });
  controller.input(lead.id, 'private-draft');
  const request = controller.save(lead.id, true);
  await Promise.resolve();
  controller.input(lead.id, 'new-private-draft');
  assert.equal(timers.size, 1);
  controller.reset();
  release();
  await request;
  assert.equal(controller.hasUnsaved(), false);
  assert.equal(timers.size, 0);
  assert.equal(lead.manualReviewNotes, 'accepted');
  assert.equal(lead.version, 1);
});

test('blur and save button submit the same pending note only once', async () => {
  let calls = 0;
  let release;
  const { controller, lead } = createController(async () => {
    calls++;
    await new Promise(resolve => { release = resolve; });
    return accepted(2, 'one edit');
  });
  controller.input(lead.id, 'one edit');
  const blur = controller.save(lead.id);
  await Promise.resolve();
  const button = controller.save(lead.id, true);
  release();
  await blur;
  // A duplicate request would wait on a second release and create a second write.
  await Promise.resolve();
  assert.equal(calls, 1);
  await button;
  assert.equal(lead.version, 2);
});

for (const scenario of ['replaced-cache', 'newer-different-note', 'newer-same-note']) {
  test(`accepted manual write reconciles the current lead cache: ${scenario}`, async () => {
    let release;
    const state = createController(async () => {
      await new Promise(resolve => { release = resolve; });
      return accepted(2, 'submitted');
    });
    state.controller.input(state.lead.id, 'submitted');
    const pending = state.controller.save(state.lead.id, true);
    await Promise.resolve();
    const replacement = { id: state.lead.id, version: scenario === 'replaced-cache' ? 1 : 3,
      manualReviewNotes: scenario === 'newer-same-note' ? 'submitted' : scenario === 'newer-different-note' ? 'newer accepted note' : 'accepted' };
    state.replaceLead(replacement);
    release();
    await pending;
    assert.equal(replacement.version, scenario === 'replaced-cache' ? 2 : 3);
    assert.equal(replacement.manualReviewNotes, scenario === 'newer-different-note' ? 'newer accepted note' : 'submitted');
    assert.equal(state.controller.hasUnsaved(), scenario === 'newer-different-note');
    if (scenario === 'newer-different-note') {
      assert.equal(state.controller.value(replacement), 'submitted');
      assert.match(state.controller.notice(replacement.id), /충돌/);
    }
  });
}
