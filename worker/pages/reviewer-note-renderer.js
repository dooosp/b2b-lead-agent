const DEFAULT_REVIEWER_NOTE_TEXT = 'Review note suggestion unavailable. Confirm company, evidence, verification status, and data gaps before writing a review note.';

const DEFAULT_RENDER_CONFIG = Object.freeze({
  rootClass: 'opportunity-workbench-review-note',
  rootAriaLabel: '생성된 검토 메모 제안',
  labelClass: 'panel-label',
  labelText: '생성된 검토 메모 제안',
  copyHeadClass: 'opportunity-workbench-note-copy-head',
  copyActionsClass: 'opportunity-workbench-note-copy-actions',
  copyTargetClass: 'opportunity-workbench-note-copy-target',
  copyActionAttribute: 'data-workbench-note-copy-action',
  copyTextAttribute: 'data-workbench-note-text',
  currentCopyAction: 'copy-current-note',
  variantCopyAction: 'copy-variant-note',
  currentCopyAriaLabel: '현재 Workbench 리뷰 노트 복사',
  currentCopyButtonText: '현재 노트 복사',
  currentTextAriaLabel: '현재 Workbench 리뷰 노트 텍스트',
  variantClass: 'opportunity-workbench-note-variant',
  variantsClass: 'opportunity-workbench-note-variants',
  summaryClass: 'opportunity-workbench-note-summary',
  summaryItemsClass: 'opportunity-workbench-note-summary-items',
  summaryAriaLabel: '검토 메모 제안 요약',
  summaryTitle: '검토 메모 제안 요약',
  summaryEmptyText: '리뷰 노트 내용을 확인하세요.',
  summaryBoundaryText: '생성된 제안은 복사 전용이며 자동 저장/전송되지 않습니다.',
  helperClass: 'opportunity-workbench-caveat',
  helperText: '사람이 저장한 메모가 아닙니다. 복사 후 사람이 직접 검토해 사용하세요.',
  emptyVariantsHtml: '<p class="opportunity-workbench-caveat">No alternate reviewer note templates are available.</p>',
  currentLabelFallback: '검토 필요 노트',
  currentTextFallback: DEFAULT_REVIEWER_NOTE_TEXT,
});

function cleanText(value, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAttribute(name, value) {
  return `${name}="${escapeHtml(value)}"`;
}

function renderBooleanAttribute(name) {
  return escapeHtml(name);
}

function rendererConfig(overrides = {}) {
  return { ...DEFAULT_RENDER_CONFIG, ...(overrides && typeof overrides === 'object' ? overrides : {}) };
}

export function normalizeReviewerNoteSuggestion(intelligence = {}, options = {}) {
  const config = rendererConfig(options);
  const suggestion = intelligence.reviewNoteSuggestion && typeof intelligence.reviewNoteSuggestion === 'object'
    ? intelligence.reviewNoteSuggestion
    : intelligence;

  return {
    state: cleanText(suggestion.state, 'NEEDS_REVIEW'),
    label: cleanText(suggestion.label, config.currentLabelFallback),
    text: cleanText(suggestion.text, config.currentTextFallback),
  };
}

export function truncateReviewerNoteSummaryText(value, limit = 120) {
  const text = cleanText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

export function findReviewerNoteSegment(text, prefixes) {
  const raw = String(text || '');
  const lines = raw.split(/\n+/).map((line) => cleanText(line)).filter(Boolean);
  const fromLines = lines.find((line) => prefixes.some((prefix) => line.toLowerCase().startsWith(prefix.toLowerCase())));
  if (fromLines) return fromLines;

  const normalized = cleanText(raw);
  const markers = [
    'Decision:',
    'Follow-up check:',
    'Lead:',
    'Why:',
    'Reason:',
    'Evidence status:',
    'Evidence:',
    'Review basis:',
    'Missing/risk check:',
    'Open items:',
    'Missing prompts:',
    'Missing:',
    'Current state:',
    'Next:',
  ];
  const lower = normalized.toLowerCase();
  for (const prefix of prefixes) {
    const start = lower.indexOf(prefix.toLowerCase());
    if (start === -1) continue;
    const afterPrefix = start + prefix.length;
    const next = markers
      .map((marker) => lower.indexOf(marker.toLowerCase(), afterPrefix))
      .filter((index) => index > start)
      .sort((a, b) => a - b)[0];
    return normalized.slice(start, next || normalized.length).trim();
  }
  return '';
}

export function buildReviewerNoteSummaryItems(note = {}) {
  const text = note.text || '';
  const decision = findReviewerNoteSegment(text, ['Decision:', 'Follow-up check:']) || note.label || note.state || '검토 필요 노트';
  const lead = findReviewerNoteSegment(text, ['Lead:']);
  const reason = findReviewerNoteSegment(text, ['Reason:', 'Review basis:']);
  const evidence = findReviewerNoteSegment(text, ['Evidence status:', 'Evidence:']);
  const risk = findReviewerNoteSegment(text, ['Missing/risk check:', 'Open items:', 'Missing:', 'Missing prompts:']);
  return [decision, lead, reason, evidence || risk]
    .map((item) => truncateReviewerNoteSummaryText(item, 96))
    .filter(Boolean)
    .slice(0, 4);
}

export function renderReviewerNoteSummary(note = {}, options = {}) {
  const config = rendererConfig(options);
  const items = buildReviewerNoteSummaryItems(note);
  const itemHtml = items.length > 0
    ? items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')
    : `<span>${escapeHtml(config.summaryEmptyText)}</span>`;

  return `
              <div class="${escapeHtml(config.summaryClass)}" aria-label="${escapeHtml(config.summaryAriaLabel)}">
                <strong>${escapeHtml(config.summaryTitle)}</strong>
                <div class="${escapeHtml(config.summaryItemsClass)}">${itemHtml}</div>
                <p>${escapeHtml(config.summaryBoundaryText)}</p>
              </div>`;
}

function renderReviewerNoteVariant(template, config) {
  const label = template.label || template.state;
  return `
              <details class="${escapeHtml(config.variantClass)}">
                <summary>${escapeHtml(label)}</summary>
                ${renderReviewerNoteSummary(template, config)}
                <pre class="${escapeHtml(config.copyTargetClass)}" ${renderBooleanAttribute(config.copyTextAttribute)} tabindex="0" aria-label="${escapeHtml(label)} 텍스트">${escapeHtml(template.text)}</pre>
                <div class="${escapeHtml(config.copyActionsClass)}">
                  <button class="btn btn-secondary" type="button" ${renderAttribute(config.copyActionAttribute, config.variantCopyAction)} aria-label="${escapeHtml(label)} 복사">복사</button>
                </div>
              </details>`;
}

export function renderReviewerNoteTemplates(intelligence = {}, options = {}) {
  const config = rendererConfig(options);
  const current = normalizeReviewerNoteSuggestion(intelligence, config);
  const templates = Array.isArray(intelligence.reviewerNoteTemplates?.templates)
    ? intelligence.reviewerNoteTemplates.templates
    : [];
  const variants = templates.length > 0
    ? templates.map((template) => renderReviewerNoteVariant(template, config)).join('')
    : config.emptyVariantsHtml;

  return `
            <div class="${escapeHtml(config.rootClass)}" aria-label="${escapeHtml(config.rootAriaLabel)}">
              <span class="${escapeHtml(config.labelClass)}">${escapeHtml(config.labelText)}</span>
              <div class="${escapeHtml(config.copyHeadClass)}">
                <strong>${escapeHtml(current.label)}</strong>
                <div class="${escapeHtml(config.copyActionsClass)}">
                  <button class="btn btn-secondary" type="button" ${renderAttribute(config.copyActionAttribute, config.currentCopyAction)} aria-label="${escapeHtml(config.currentCopyAriaLabel)}">${escapeHtml(config.currentCopyButtonText)}</button>
                </div>
              </div>
              ${renderReviewerNoteSummary(current, config)}
              <pre class="${escapeHtml(config.copyTargetClass)}" ${renderBooleanAttribute(config.copyTextAttribute)} tabindex="0" aria-label="${escapeHtml(config.currentTextAriaLabel)}">${escapeHtml(current.text)}</pre>
              <p class="${escapeHtml(config.helperClass)}">${escapeHtml(config.helperText)}</p>
              <div class="${escapeHtml(config.variantsClass)}">
                ${variants}
              </div>
            </div>`;
}
