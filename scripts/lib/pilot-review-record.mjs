// Shared Node/browser contract. Imported review text has no engine authority.
export const PILOT_RECORD_MAX_BYTES = 128 * 1024;
export const PILOT_TEXT_MAX = 1600;
export const PILOT_DISPOSITIONS = ['UNDECIDED', 'CONTINUE_TECHNICAL_REVIEW', 'HOLD', 'EXCLUDE_CURRENT_CANDIDATE'];
const kinds = ['OWNER_REPRODUCTION', 'OTHER_USER_TRIAL', 'AGENT_SIMULATION'];
const fixed = Object.freeze({ schemaVersion: 'b2b-pilot-review-record-v1', evidenceBoundary: 'NOT_PRODUCTION_EVIDENCE', synthetic: true, productionReady: false, issue165Status: 'HOLD', formalPilotContribution: false });
const reviewKeys = ['caseId', 'caseSha256', 'disposition', 'reason', 'nextAction', 'baselineMinutes', 'assistedMinutes'];
const fail = message => { throw new Error(message); };
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) fail(`${label}: missing or unknown fields`);
}
function provenance(recordKind) {
  if (!kinds.includes(recordKind)) fail('recordKind: explicitly select a record kind');
  return { authorship: recordKind === 'AGENT_SIMULATION' ? 'AI_AGENT_SIMULATION' : 'SELF_REPORTED_NOT_VERIFIED', humanParticipant: recordKind === 'AGENT_SIMULATION' ? false : null };
}
export function createPilotDraft(workspace) {
  return { recordKind: '', reviews: workspace.cases.map(item => ({ caseId: item.id, caseSha256: item.caseSha256, disposition: 'UNDECIDED', reason: '', nextAction: '', baselineMinutes: null, assistedMinutes: null })) };
}
export function createPilotReviewRecord(workspace, draft) {
  exactKeys(draft, ['recordKind', 'reviews'], 'draft');
  const record = { ...fixed, workspaceSha256: workspace.workspaceSha256, recordKind: draft.recordKind, ...provenance(draft.recordKind), reviews: draft.reviews };
  return validateRecord(record, workspace);
}
function validateRecord(record, workspace) {
  exactKeys(record, [...Object.keys(fixed), 'workspaceSha256', 'recordKind', 'authorship', 'humanParticipant', 'reviews'], 'record');
  for (const [key, value] of Object.entries(fixed)) if (record[key] !== value) fail(`${key}: fixed boundary mismatch`);
  const authority = provenance(record.recordKind);
  for (const [key, value] of Object.entries(authority)) if (record[key] !== value) fail(`${key}: provenance mismatch`);
  if (record.workspaceSha256 !== workspace.workspaceSha256) fail('workspaceSha256: this record belongs to another workspace');
  if (!Array.isArray(record.reviews) || record.reviews.length !== workspace.cases.length) fail('reviews: exact case set required');
  const seen = new Set();
  for (const review of record.reviews) {
    exactKeys(review, reviewKeys, 'review');
    const item = workspace.cases.find(item => item.id === review.caseId);
    if (!item || seen.has(review.caseId) || review.caseSha256 !== item.caseSha256) fail('caseId/caseSha256: duplicate, unknown or mismatched case');
    seen.add(review.caseId);
    if (!PILOT_DISPOSITIONS.includes(review.disposition)) fail('disposition: invalid choice');
    for (const key of ['reason', 'nextAction']) if (typeof review[key] !== 'string' || review[key].length > PILOT_TEXT_MAX) fail(`${key}: text must be at most 1600 characters`);
    for (const key of ['baselineMinutes', 'assistedMinutes']) if (review[key] !== null && (typeof review[key] !== 'number' || !Number.isFinite(review[key]) || review[key] < 0 || review[key] > 1440)) fail(`${key}: enter a finite number from 0 to 1440 or leave blank`);
  }
  if (new TextEncoder().encode(JSON.stringify(record)).byteLength > PILOT_RECORD_MAX_BYTES) fail('record: maximum 128 KiB UTF-8');
  // Return a fresh inert value; callers cannot add engine properties by reference.
  return JSON.parse(JSON.stringify(record));
}
// Export exactly the compact representation checked by the validator. Adding
// pretty-print whitespace or a trailing newline could make own exports unreadable.
export function serializePilotReviewRecord(workspace, record) {
  return JSON.stringify(validateRecord(record, workspace));
}
export function parsePilotReviewRecord(text, workspace) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > PILOT_RECORD_MAX_BYTES) fail('record: maximum 128 KiB UTF-8');
  let record;
  try { record = JSON.parse(text); } catch { fail('record: invalid JSON'); }
  return validateRecord(record, workspace);
}
export function pilotReviewSummary(record) {
  const reviews = record.reviews;
  const paired = reviews.filter(item => item.baselineMinutes !== null && item.assistedMinutes !== null);
  const sum = key => paired.reduce((total, item) => total + item[key], 0);
  return { totalCases: reviews.length, completedCases: reviews.filter(item => item.disposition !== 'UNDECIDED' && item.reason.trim() && item.nextAction.trim()).length, pairedCases: paired.length, baselineMinutes: paired.length ? sum('baselineMinutes') : null, assistedMinutes: paired.length ? sum('assistedMinutes') : null, differenceMinutes: paired.length ? sum('baselineMinutes') - sum('assistedMinutes') : null };
}
const markdownText = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&').replace(/\r?\n/g, '  \n');
export function renderPilotReviewMarkdown(workspace, input) {
  const record = validateRecord(input, workspace);
  const summary = pilotReviewSummary(record);
  const lines = ['# Synthetic technical review package', '', 'NOT_PRODUCTION_EVIDENCE · synthetic:true · productionReady:false · Issue #165 HOLD · formalPilotContribution:false', '', `Record kind: ${record.recordKind} · Authorship: ${record.authorship} · humanParticipant:${record.humanParticipant === null ? 'unverified' : record.humanParticipant}`, '', `Workspace SHA256: ${record.workspaceSha256}`, '', `Completed review drafts: ${summary.completedCases}/${summary.totalCases}. FIT is not approval; reviewer entries are self-reported and not verified.`, '', `Paired self-reported timing cases: ${summary.pairedCases}.`];
  if (summary.pairedCases) lines.push(`Paired baseline total: ${summary.baselineMinutes} minutes; assisted total: ${summary.assistedMinutes} minutes; baseline minus assisted: ${summary.differenceMinutes} minutes (negative means more assisted time).`);
  lines.push('Unpaired timings excluded. No measured effectiveness, ROI or formal-pilot evidence.', '');
  for (const item of workspace.cases) {
    const review = record.reviews.find(review => review.caseId === item.id);
    lines.push(`## ${markdownText(item.id)} · ${markdownText(item.title)}`, '', `Case SHA256: ${item.caseSha256}`, '', '### Self-reported reviewer draft', '', `Disposition: ${markdownText(review.disposition)}`, '', `Reason: ${markdownText(review.reason) || '(blank)'}`, '', `Next action: ${markdownText(review.nextAction) || '(blank)'}`, '', `Self-reported baseline minutes: ${review.baselineMinutes ?? '(blank)'}; assisted minutes: ${review.assistedMinutes ?? '(blank)'}`, '', '### Immutable engine packet', '', ...JSON.stringify(item, null, 2).split('\n').map(line => '    ' + line), '');
  }
  return lines.join('\n') + '\n';
}
