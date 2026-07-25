import {
  buildPursuitReviewPacket,
  pursuitReviewPacketFilename,
  serializePursuitReviewPacket
} from '/assets/review-packet.mjs';

const SAFE_SCENARIO_ID = /^[a-z0-9_]{1,64}$/;

function byId(id) {
  return document.getElementById(id);
}

function announce(message) {
  const status = byId('workbench-status');
  if (!status) return;
  status.textContent = '';
  requestAnimationFrame(() => { status.textContent = message; });
}

function clearInvalidState() {
  for (const fieldset of document.querySelectorAll('#review-form fieldset')) {
    fieldset.removeAttribute('aria-invalid');
    fieldset.removeAttribute('aria-describedby');
  }
}

function clearPacket() {
  const section = byId('packet-section');
  const preview = byId('packet-preview');
  const copy = byId('packet-copy');
  const download = byId('packet-download');
  if (section) section.hidden = true;
  if (preview) preview.value = '';
  if (copy) copy.disabled = true;
  if (download) download.disabled = true;
  document.body.removeAttribute('data-packet-ready');
}

function setScopedChoice(label, visible) {
  const input = label.querySelector('input');
  label.hidden = !visible;
  if (input) {
    input.disabled = !visible;
    if (!visible) input.checked = false;
  }
}

function syncReviewScope({ clearDisposition = false, clearReasons = false, clearQuestions = false } = {}) {
  const familyId = document.querySelector('input[name="productFamily"]:checked')?.value || '';
  if (clearDisposition) {
    for (const input of document.querySelectorAll('input[name="disposition"]')) input.checked = false;
  }
  if (clearReasons || clearDisposition) {
    for (const input of document.querySelectorAll('input[name="reason"]')) input.checked = false;
  }
  if (clearQuestions) {
    for (const input of document.querySelectorAll('input[name="question"]')) input.checked = false;
  }
  for (const label of document.querySelectorAll('[data-review-family]:not([data-review-disposition])')) {
    setScopedChoice(label, label.dataset.reviewFamily === familyId);
  }
  const disposition = document.querySelector('input[name="disposition"]:checked')?.value || '';
  let visibleReasons = 0;
  for (const label of document.querySelectorAll('[data-review-family][data-review-disposition]')) {
    const visible = label.dataset.reviewFamily === familyId && label.dataset.reviewDisposition === disposition;
    setScopedChoice(label, visible);
    if (visible) visibleReasons += 1;
  }
  const reasonEmpty = byId('reason-empty');
  if (reasonEmpty) reasonEmpty.hidden = visibleReasons > 0;
  let visibleQuestions = 0;
  for (const label of document.querySelectorAll('[data-review-families]')) {
    const visible = (label.dataset.reviewFamilies || '').split(' ').includes(familyId);
    setScopedChoice(label, visible);
    if (visible) visibleQuestions += 1;
  }
  const questionEmpty = byId('question-empty');
  if (questionEmpty) questionEmpty.hidden = visibleQuestions > 0;
}

function resetReviewForm() {
  const form = byId('review-form');
  form?.reset();
  const firstFamily = form?.querySelector('input[name="productFamily"]');
  if (firstFamily) firstFamily.checked = true;
  const errors = byId('review-errors');
  if (errors) {
    errors.hidden = true;
    errors.textContent = '';
  }
  clearInvalidState();
  clearPacket();
  syncReviewScope();
}

function validationMessage(code) {
  const messages = {
    REVIEW_SELECTION_INCOMPLETE: 'Select a product family, disposition, and at least one supported reason.',
    REVIEW_DISPOSITION_UNKNOWN: 'Select a technical-review disposition.',
    REVIEW_DISPOSITION_UNSUPPORTED: 'The selected disposition is not supported by the recomputed dossier for this product family.',
    REVIEW_REASON_REQUIRED: 'Select at least one dossier-supported reason code.',
    REVIEW_REASON_UNSUPPORTED: 'One or more selected reason codes do not support this disposition.',
    REVIEW_QUESTION_UNSUPPORTED: 'A selected technical question does not apply to this product family.',
    REVIEW_ACKNOWLEDGEMENT_REQUIRED: 'Acknowledge the synthetic, non-commercial boundary before creating a packet.',
    REVIEW_PRODUCT_FAMILY_UNKNOWN: 'Select an evaluated product family.',
    REVIEW_HASH_UNAVAILABLE: 'The browser cannot create the deterministic packet identifier.',
    REVIEW_VIEW_MODEL_INVALID: 'The recomputed scenario contract is unavailable.'
  };
  return messages[code] || 'The review packet could not be created from the current structured selection.';
}

function showValidationError(error) {
  clearPacket();
  clearInvalidState();
  const summary = byId('review-errors');
  if (!summary) return;
  const code = typeof error?.code === 'string' ? error.code : 'REVIEW_SELECTION_INVALID';
  summary.textContent = validationMessage(code);
  summary.hidden = false;
  const fieldsetId = code.includes('ACKNOWLEDGEMENT') ? null
    : code.includes('QUESTION') ? 'question-fieldset'
      : code.includes('REASON') ? 'reason-fieldset'
        : code.includes('PRODUCT_FAMILY') ? 'family-fieldset'
          : 'disposition-fieldset';
  const fieldset = fieldsetId ? byId(fieldsetId) : byId('review-acknowledgement')?.closest('fieldset');
  if (fieldset) {
    fieldset.setAttribute('aria-invalid', 'true');
    fieldset.setAttribute('aria-describedby', 'review-errors');
  }
  summary.focus();
  announce('Review packet validation failed. Choices were preserved.');
}

function collectSelection() {
  return {
    productFamilyId: document.querySelector('input[name="productFamily"]:checked')?.value || '',
    disposition: document.querySelector('input[name="disposition"]:checked')?.value || '',
    reasonCodes: [...document.querySelectorAll('input[name="reason"]:checked')].map((input) => input.value),
    selectedQuestionIds: [...document.querySelectorAll('input[name="question"]:checked')].map((input) => input.value),
    acknowledgedNonClaims: byId('review-acknowledgement')?.checked === true
  };
}

function selectPacketPreview() {
  const preview = byId('packet-preview');
  if (!preview) return;
  preview.focus();
  preview.select();
}

async function loadViewModel(scenarioId) {
  const response = await fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error('SCENARIO_LOAD_FAILED');
  const value = await response.json();
  if (value?.schemaVersion !== 'datacenter-pursuit-workbench-v0' || value?.scenario?.id !== scenarioId) throw new Error('SCENARIO_CONTRACT_FAILED');
  return value;
}

async function initialize() {
  const loadError = byId('load-error');
  if (document.body.dataset.loadError === 'true') {
    loadError?.focus();
    return;
  }
  const scenarioId = document.body.dataset.scenarioId || '';
  if (!SAFE_SCENARIO_ID.test(scenarioId)) {
    announce('The allowlisted scenario identifier is invalid.');
    return;
  }
  resetReviewForm();
  let viewModel;
  try {
    viewModel = await loadViewModel(scenarioId);
  } catch {
    const create = byId('packet-create');
    if (create) create.disabled = true;
    announce('The synthetic scenario contract could not be loaded safely.');
    return;
  }

  byId('review-form')?.addEventListener('submit', (event) => event.preventDefault());
  byId('review-form')?.addEventListener('change', (event) => {
    if (event.target?.name === 'productFamily') syncReviewScope({ clearDisposition: true, clearQuestions: true });
    if (event.target?.name === 'disposition') syncReviewScope({ clearReasons: true });
    clearInvalidState();
    const errors = byId('review-errors');
    if (errors) { errors.hidden = true; errors.textContent = ''; }
    if (document.body.hasAttribute('data-packet-ready')) {
      clearPacket();
      announce('Review selection changed. The prior page-memory packet was cleared.');
    }
  });

  byId('packet-create')?.addEventListener('click', async () => {
    try {
      const packet = await buildPursuitReviewPacket(viewModel, collectSelection());
      const serialized = serializePursuitReviewPacket(packet);
      const section = byId('packet-section');
      const preview = byId('packet-preview');
      preview.value = serialized;
      preview.dataset.filename = pursuitReviewPacketFilename(packet);
      section.hidden = false;
      byId('packet-copy').disabled = false;
      byId('packet-download').disabled = false;
      document.body.setAttribute('data-packet-ready', 'true');
      clearInvalidState();
      const errors = byId('review-errors');
      errors.hidden = true;
      errors.textContent = '';
      section.focus?.();
      announce('Structured review packet created in current page memory. It is not saved or sent.');
    } catch (error) {
      showValidationError(error);
    }
  });

  byId('packet-copy')?.addEventListener('click', async () => {
    const text = byId('packet-preview')?.value || '';
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
      await navigator.clipboard.writeText(text);
      announce('Review packet JSON copied. The Workbench did not save or send it.');
    } catch {
      selectPacketPreview();
      announce('Clipboard access was unavailable. Packet JSON is selected; press Control+C or Command+C to copy manually.');
    }
  });

  byId('packet-download')?.addEventListener('click', () => {
    const preview = byId('packet-preview');
    const text = preview?.value || '';
    const filename = preview?.dataset.filename || '';
    if (!text || !/^pursuit-review-[a-z0-9_]+-[a-f0-9]{12}\.json$/.test(filename)) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    announce('Review packet JSON download requested. No review state was saved by the Workbench.');
  });

  if (location.hash === '#scenario-heading') {
    byId('scenario-heading')?.focus();
    announce(`Scenario changed to ${viewModel.scenario.title}. Prior review selections and packet state were cleared.`);
  }
}

byId('scenario-load')?.addEventListener('click', () => {
  const scenarioId = byId('scenario-select')?.value || '';
  if (!SAFE_SCENARIO_ID.test(scenarioId)) {
    announce('Only an allowlisted synthetic scenario can be loaded.');
    return;
  }
  location.assign(`/scenario/${encodeURIComponent(scenarioId)}#scenario-heading`);
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) resetReviewForm();
});

initialize();
