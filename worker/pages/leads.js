import { getCommonStyles } from './common-styles.js';
import { getEscScript, getProfileScript, getSafeUrlScript, getStoredTokenScript } from './script-snippets.js';

function stripGeneratedReviewGuidanceFromLeadsPage(html) {
  return String(html || '')
    .replace(
      /function summarizeReviewNoteEvidence\(lead\) \{[\s\S]*?function normalizeReviewNoteData\(lead\) \{[\s\S]*?return \{ current, templates \};\n    \}/,
      'function normalizeReviewNoteData() { return { current: null, templates: [] }; }'
    )
    .replace(
      /function normalizeSummaryText\(value, fallback = ''\) \{[\s\S]*?function renderReviewNoteSuggestion\(lead, options = \{\}\) \{[\s\S]*?\n    \}/,
      'function renderReviewNoteSuggestion() { return ""; }'
    )
    .replace(
      /function normalizeReviewNoteData\(lead\) \{[\s\S]*?return \{ current, templates \};\n    \}/,
      'function normalizeReviewNoteData() { return { current: null, templates: [] }; }'
    )
    .replace(/reviewNoteSuggestion/g, 'reviewNoteSuppressed')
    .replace(/reviewNoteTemplates/g, 'reviewNoteTemplateSuppressed')
    .replace(/Follow-up check:/g, 'Follow up check removed:')
    .replace(/생성된 검토 메모 제안/g, '복사 전용 검토 도우미');
}

export function getLeadsPage({ includeGeneratedReviewGuidance = true } = {}) {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>프로젝트 신호 검토 큐</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}
    .leads-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin:12px 0 18px; }
    .summary-card { background:#121a24; border:1px solid #2a3a4a; border-radius:12px; padding:14px; text-align:left; }
    .summary-card .label { color:#8fa4b8; font-size:11px; display:block; margin-bottom:6px; }
    .summary-card .value { color:#f4f7fb; font-size:22px; font-weight:700; display:block; }
    .summary-card .meta { color:#9fb0c0; font-size:12px; margin-top:6px; }
    .lead-card { background: linear-gradient(180deg, #182433 0%, #121b27 100%); border-radius: 14px; padding: 18px; margin: 16px 0; border: 1px solid #26384c; min-width:0; }
    .lead-card.grade-a { box-shadow: 0 12px 28px rgba(233,69,96,0.14); border-color:#e94560; }
    .lead-card.grade-b { border-color: #f39c12; box-shadow: 0 10px 24px rgba(243,156,18,0.12); }
    .lead-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:12px; }
    .lead-title h3 { color: #f4f7fb; margin: 0 0 8px 0; font-size: 19px; line-height:1.4; }
    .lead-subtitle { color:#a9b9c8; font-size:13px; line-height:1.6; }
    .lead-badges { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .lead-status-row { margin:8px 0 0; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .lead-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:14px 0; }
    .lead-metric { background:#121a24; border:1px solid #223447; border-radius:10px; padding:10px 12px; }
    .lead-metric .metric-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:4px; }
    .lead-metric .metric-value { display:block; color:#f4f7fb; font-size:14px; font-weight:700; line-height:1.5; }
    .lead-sections { display:grid; gap:10px; }
    .lead-block { background:#121a24; border:1px solid #223447; border-radius:10px; padding:12px; }
    .lead-block .block-label { display:block; color:#8fa4b8; font-size:11px; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em; }
    .lead-block .block-value { color:#d4deea; font-size:13px; line-height:1.7; }
    .lead-sources { margin-top: 12px; padding-top: 12px; border-top: 1px solid #2a3a4a; }
    .lead-sources summary { color: #aaa; font-size: 13px; cursor: pointer; }
    .lead-sources summary:hover { color: #fff; }
    .lead-sources ul { list-style: none; padding: 8px 0 0 0; margin: 0; }
    .lead-sources li { margin: 4px 0; }
    .lead-sources a { color: #3498db; text-decoration: none; font-size: 13px; }
    .lead-sources a:hover { color: #5dade2; text-decoration: underline; }
    .lead-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .lead-actions a { font-size: 12px; padding: 6px 12px; }
    .lead-secondary-tools { margin-top:12px; border:1px solid #2a3a4a; border-radius:8px; background:#111a25; }
    .lead-secondary-tools summary { cursor:pointer; padding:9px 11px; color:#9fb0c0; font-size:12px; font-weight:700; }
    .lead-secondary-tools .lead-actions { margin:0; padding:0 10px 10px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-a { background: #e94560; color: #fff; }
    .badge-b { background: #f39c12; color: #fff; }
    .badge-status { background: #3498db; color: #fff; margin-left: 8px; }
    .badge-status.contacted { background: #9b59b6; }
    .badge-status.meeting { background: #e67e22; }
    .badge-status.proposal { background: #1abc9c; }
    .badge-status.negotiation { background: #2980b9; }
    .badge-status.won { background: #27ae60; }
    .badge-status.lost { background: #7f8c8d; }
    .badge-review { background:#243547; color:#dbeafe; border:1px solid #36506c; }
    .badge-review.needs_review { background:#4a3a12; color:#ffe58a; border-color:#806718; }
    .badge-review.approved { background:#17462a; color:#a8efc0; border-color:#2e7d4f; }
    .badge-review.rejected { background:#4a1f1f; color:#ffc4c4; border-color:#8a3b3b; }
    .badge-review.deferred { background:#2f3542; color:#d7dee8; border-color:#566273; }
    .badge-verification { background:#27364a; color:#d8e8ff; border:1px solid #3a5575; }
    .badge-verification.verified { background:#17462a; color:#a8efc0; border-color:#2e7d4f; }
    .badge-verification.needs_review, .badge-verification.unverified { background:#4a3a12; color:#ffe58a; border-color:#806718; }
    .badge-verification.draft { background:#2f3542; color:#d7dee8; border-color:#566273; }
    .badge-generation { background:#203345; color:#cde7ff; border:1px solid #38536c; }
    .badge-generation.heuristic, .badge-generation.unavailable { background:#3e2f16; color:#ffdca3; border-color:#6f5525; }
    .badge-generation.demo { background:#3a294b; color:#e4c8ff; border-color:#6b4a88; }
    .badge-confidence { background:#29384a; color:#dbeafe; border:1px solid #3b536d; }
    .badge-confidence.high { background:#17462a; color:#a8efc0; border-color:#2e7d4f; }
    .badge-confidence.medium { background:#4a3a12; color:#ffe58a; border-color:#806718; }
    .badge-confidence.low { background:#4a1f1f; color:#ffc4c4; border-color:#8a3b3b; }
    .badge-evidence { background:#223142; color:#d4deea; border:1px solid #344b63; }
    .badge-evidence.missing_evidence { background:#4a1f1f; color:#ffc4c4; border-color:#8a3b3b; }
    .lead-review-meta { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; align-items:center; }
    .select-label { color:#8fa4b8; font-size:11px; font-weight:700; }
    .lead-block.data-gap-summary { border-color:#6f5525; background:#171d25; }
    .lead-block.data-gap-clear { border-color:#2e7d4f; background:#141f1b; }
    .lead-review-gate { background:#101925; border:1px solid #223447; border-radius:10px; display:grid; gap:8px; padding:12px; text-align:left; }
    .lead-review-gate .block-label { color:#8fa4b8; display:block; font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
    .lead-review-gate strong { color:#f4f7fb; font-size:14px; line-height:1.4; }
    .lead-review-gate-items { display:flex; flex-wrap:wrap; gap:6px; }
    .lead-review-gate-items span { background:#162338; border:1px solid #2e4157; border-radius:6px; color:#cbd8e6; font-size:11px; line-height:1.4; padding:4px 7px; }
    .lead-review-gate p { color:#9fb0c0; font-size:11px; line-height:1.5; margin:0; }
    .lead-review-gate.gate-ready { border-color:#2e7d4f; background:#101f1a; }
    .lead-review-gate.gate-ready strong { color:#a8efc0; }
    .lead-review-gate.gate-blocked { border-color:#8a3b3b; background:#211719; }
    .lead-review-gate.gate-blocked strong { color:#ffc4c4; }
    .lead-review-gate.gate-hold, .lead-review-gate.gate-review { border-color:#806718; background:#1f1c12; }
    .lead-review-gate.gate-hold strong, .lead-review-gate.gate-review strong { color:#ffe58a; }
    .lead-action-intelligence { background:#101925; border:1px solid #223447; border-radius:10px; display:grid; gap:7px; padding:12px; text-align:left; }
    .lead-action-intelligence strong { color:#f4f7fb; font-size:14px; line-height:1.4; }
    .lead-action-intelligence p { color:#9fb0c0; font-size:11px; line-height:1.5; margin:0; }
    .lead-action-intelligence.priority-high { border-color:#2e7d4f; background:#101f1a; }
    .lead-action-intelligence.priority-medium { border-color:#806718; background:#1f1c12; }
    .lead-action-intelligence.priority-low, .lead-action-intelligence.priority-blocked { border-color:#8a3b3b; background:#211719; }
    .lead-action-intelligence.priority-hold { border-color:#566273; background:#171d25; }
    .lead-action-intel-meta { color:#cbd8e6; display:flex; flex-wrap:wrap; gap:6px; font-size:11px; line-height:1.5; }
    .lead-action-intel-meta span { background:#162338; border:1px solid #2e4157; border-radius:6px; padding:3px 6px; }
    .reviewer-action-queue { background:#121a24; border:1px solid #26384c; border-radius:8px; display:grid; gap:12px; margin:0 0 16px; padding:12px; text-align:left; }
    .reviewer-action-queue-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap; }
    .reviewer-action-queue-head strong { color:#f4f7fb; font-size:13px; line-height:1.4; }
    .reviewer-action-queue-head span { color:#8fa4b8; font-size:11px; line-height:1.5; }
    .reviewer-action-lanes { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .reviewer-action-lane { background:#101925; border:1px solid #223447; border-radius:8px; min-width:0; padding:10px; }
    .reviewer-action-lane strong { color:#f4f7fb; display:block; font-size:13px; line-height:1.4; }
    .reviewer-action-lane > span { color:#9fb0c0; display:block; font-size:11px; line-height:1.5; margin-top:3px; }
    .reviewer-action-lane.approval_candidates strong { color:#a8efc0; }
    .reviewer-action-lane.needs_evidence strong, .reviewer-action-lane.risk_review strong { color:#ffe58a; }
    .reviewer-action-lane.low_priority strong { color:#ffc4c4; }
    .reviewer-action-lane ul { display:grid; gap:7px; list-style:none; margin:9px 0 0; padding:0; }
    .reviewer-action-lane li { border-top:1px solid #223447; display:grid; gap:2px; padding-top:7px; }
    .reviewer-action-lane li b { color:#dbe7f3; font-size:12px; line-height:1.35; }
    .reviewer-action-lane li em { color:#cbd8e6; font-size:11px; font-style:normal; line-height:1.35; }
    .reviewer-action-lane li small { color:#8fa4b8; font-size:10px; line-height:1.4; }
    .reviewer-action-empty { color:#566273; font-size:11px; margin:9px 0 0; }
    .next-review-strip { background:#101925; border:1px solid #31506c; border-radius:8px; display:grid; gap:8px; margin:0 0 14px; min-width:0; padding:12px; text-align:left; }
    .next-review-strip-head { align-items:flex-start; display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; }
    .next-review-strip-head span { color:#8fa4b8; display:block; font-size:11px; font-weight:700; line-height:1.4; margin-bottom:3px; }
    .next-review-strip-head strong { color:#f4f7fb; display:block; font-size:15px; line-height:1.35; }
    .next-review-strip-head p { color:#9fb0c0; font-size:12px; line-height:1.5; margin:4px 0 0; }
    .next-review-strip-actions { align-items:center; display:flex; flex-wrap:wrap; gap:6px; }
    .next-review-strip-actions button { font-size:11px; padding:5px 9px; }
    .next-review-strip-meta { display:flex; flex-wrap:wrap; gap:6px; }
    .next-review-strip-meta span { background:#162338; border:1px solid #2e4157; border-radius:6px; color:#cbd8e6; font-size:11px; line-height:1.4; padding:4px 7px; }
    .review-session-panel { background:#121a24; border:1px solid #31506c; border-radius:8px; display:grid; gap:12px; margin:0 0 16px; padding:12px; text-align:left; }
    .review-session-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap; }
    .review-session-head strong { color:#f4f7fb; font-size:14px; line-height:1.4; }
    .review-session-head span { color:#8fa4b8; font-size:11px; line-height:1.5; }
    .review-session-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .review-session-stat { background:#101925; border:1px solid #223447; border-radius:8px; min-width:0; padding:10px; }
    .review-session-stat span { color:#8fa4b8; display:block; font-size:11px; line-height:1.4; margin-bottom:4px; }
    .review-session-stat strong { color:#f4f7fb; display:block; font-size:18px; line-height:1.25; }
    .review-session-next { background:#101925; border:1px solid #223447; border-radius:8px; display:grid; gap:9px; padding:10px; }
    .review-session-next strong { color:#f4f7fb; font-size:14px; line-height:1.4; }
    .review-session-next p { color:#9fb0c0; font-size:12px; line-height:1.5; margin:0; }
    .review-session-meta { display:flex; flex-wrap:wrap; gap:6px; }
    .review-session-meta span, .review-session-filter-chip { background:#162338; border:1px solid #2e4157; border-radius:6px; color:#cbd8e6; font-size:11px; line-height:1.4; padding:4px 7px; }
    .review-session-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .review-session-actions button { font-size:12px; padding:6px 10px; }
    .review-session-actions button:disabled { cursor:not-allowed; opacity:0.55; }
    .review-note-suggestion { border-top:1px solid #223447; display:grid; gap:8px; padding-top:10px; }
    .review-note-suggestion strong { color:#f4f7fb; font-size:13px; line-height:1.4; }
    .review-note-suggestion pre, .review-note-variant pre { background:#0d1520; border:1px solid #223447; border-radius:6px; color:#d7e5f3; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12px; line-height:1.55; margin:0; max-height:210px; overflow:auto; padding:10px; white-space:pre-wrap; word-break:break-word; }
    .review-note-copy-head { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; flex-wrap:wrap; }
    .review-note-copy-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .review-note-copy-actions button { font-size:11px; padding:5px 8px; }
    .review-note-copy-target.is-manual-copy { outline:2px solid #8fbfe8; outline-offset:2px; }
    .review-note-summary { background:#101925; border:1px solid #223447; border-radius:8px; display:grid; gap:7px; padding:9px; }
    .review-note-summary strong { color:#f4f7fb; font-size:12px; line-height:1.4; }
    .review-note-summary-items { display:flex; flex-wrap:wrap; gap:6px; }
    .review-note-summary-items span { background:#162338; border:1px solid #2e4157; border-radius:6px; color:#cbd8e6; font-size:11px; line-height:1.4; padding:4px 7px; }
    .review-note-summary p { color:#9fb0c0; font-size:11px; line-height:1.5; margin:0; }
    .review-note-helper { color:#9fb0c0; font-size:11px; line-height:1.5; margin:0; }
    .review-note-variants { display:grid; gap:7px; }
    .review-note-variant { border-top:1px solid #223447; padding-top:7px; }
    .review-note-variant summary { color:#a8efc0; cursor:pointer; font-size:12px; font-weight:700; line-height:1.4; }
    .review-note-variant .review-note-copy-actions { margin-top:6px; }
    .review-productivity-toolkit { background:#101925; border:1px solid #223447; border-radius:8px; display:grid; gap:10px; padding:10px; }
    .review-productivity-head { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; flex-wrap:wrap; }
    .review-productivity-head strong { color:#f4f7fb; font-size:13px; line-height:1.4; }
    .review-productivity-head span { color:#8fa4b8; display:block; font-size:11px; line-height:1.5; margin-top:2px; }
    .review-productivity-head button { font-size:11px; padding:5px 9px; }
    .review-productivity-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
    .review-productivity-grid span { background:#162338; border:1px solid #2e4157; border-radius:6px; color:#cbd8e6; font-size:11px; line-height:1.4; padding:6px 7px; }
    .review-productivity-last { color:#9fb0c0; font-size:11px; line-height:1.5; margin:0; }
    .review-shortcut-help { background:#0d1520; border:1px solid #2e4157; border-radius:8px; color:#cbd8e6; display:grid; gap:5px; font-size:11px; line-height:1.5; padding:9px; }
    .review-shortcut-help.is-hidden { display:none; }
    .review-shortcut-help kbd { background:#223447; border:1px solid #36506c; border-radius:4px; color:#f4f7fb; display:inline-block; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:10px; margin-right:4px; padding:1px 5px; }
    .review-shortcut-help p { margin:0; }
    .review-session-status { border-radius:8px; color:#9fb0c0; font-size:12px; line-height:1.5; min-height:18px; padding:8px 10px; }
    .review-session-status.is-idle { padding:0; }
    .review-session-status.is-pending { background:#172338; color:#cde7ff; }
    .review-session-status.is-success { background:#101f1a; color:#a8efc0; }
    .review-session-status.is-error { background:#211719; color:#ffc4c4; }
    .lead-card.review-session-focus { outline:2px solid #8fbfe8; outline-offset:3px; }
    .reviewer-action-queue:focus, .review-session-panel:focus, .view-tab:focus-visible, .next-review-strip-actions button:focus-visible, .review-session-actions button:focus-visible, .review-note-copy-actions button:focus-visible, .review-filter-actions button:focus-visible, .review-productivity-head button:focus-visible, .status-select:focus-visible, .notes-textarea:focus-visible { outline:2px solid #8fbfe8; outline-offset:3px; }
    .review-filter-bar { background:#121a24; border:1px solid #26384c; border-radius:10px; display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(128px,1fr)); margin:0 0 14px; padding:12px; text-align:left; }
    .review-filter-bar label { color:#8fa4b8; display:grid; gap:5px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0; }
    .review-filter-bar select { background:#16213e; border:1px solid #36506c; border-radius:7px; color:#f4f7fb; font-size:12px; padding:7px 8px; width:100%; }
    .review-filter-actions { align-self:end; display:flex; gap:8px; justify-content:flex-end; }
    .review-filter-actions button { min-height:33px; padding:6px 12px; white-space:nowrap; }
    .filter-empty-state { background:#121a24; border:1px dashed #566273; border-radius:10px; color:#9fb0c0; margin:14px 0; padding:18px; text-align:center; }
    .filter-empty-state .btn { font-size:12px; margin-top:10px; padding:6px 12px; }
    .review-slice-band { background:#121a24; border:1px solid #26384c; border-radius:8px; display:grid; gap:10px; margin:0 0 16px; padding:12px; text-align:left; }
    .review-slice-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap; }
    .review-slice-head strong { color:#f4f7fb; font-size:13px; line-height:1.4; }
    .review-slice-head span { color:#8fa4b8; font-size:11px; line-height:1.5; }
    .review-slice-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .review-gate-summary .review-slice-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
    .manager-reviewer-summary .review-slice-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
    .review-slice { border:1px solid #223447; border-radius:8px; background:#101925; min-width:0; padding:10px; }
    .review-slice strong { color:#f4f7fb; display:block; font-size:13px; line-height:1.4; }
    .review-slice span { color:#9fb0c0; display:block; font-size:11px; line-height:1.5; margin-top:4px; }
    .review-slice-risk strong { color:#ffe58a; }
    .review-slice-ready strong { color:#a8efc0; }
    .review-slice-blocked strong { color:#ffc4c4; }
    .review-slice-hold strong { color:#ffe58a; }
    .review-slice-caveat { border-top:1px solid #223447; color:#9fb0c0; font-size:12px; line-height:1.6; padding-top:10px; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .top-nav-links { display: flex; gap: 8px; flex-wrap:wrap; justify-content:flex-end; }
    .status-select { padding: 4px 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #fff; font-size: 12px; cursor: pointer; }
    .notes-section { margin-top: 10px; }
    .notes-section summary { color: #aaa; font-size: 13px; cursor: pointer; }
    .notes-textarea { width: 100%; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #16213e; color: #ccc; font-size: 13px; resize: vertical; margin-top: 6px; font-family: inherit; }
    .notes-saved { color: #27ae60; font-size: 11px; margin-left: 8px; opacity: 0; transition: opacity 0.3s; }
    .notes-saved.show { opacity: 1; }
    .notes-summary-state { color:#8fa4b8; font-size:11px; margin-left:6px; }
    .notes-state { background:#101925; border:1px solid #223447; border-radius:8px; color:#9fb0c0; display:grid; gap:4px; font-size:11px; line-height:1.5; margin-top:8px; padding:8px; }
    .notes-state strong { color:#d4deea; font-size:12px; line-height:1.4; }
    .notes-state.is-saved { border-color:#2e7d4f; background:#101f1a; }
    .notes-state.is-saved strong { color:#a8efc0; }
    .notes-state.is-empty { border-color:#566273; background:#171d25; }
    .notes-state-meta { color:#8fa4b8; }
    .notes-privacy-warning { background:#1f1c12; border:1px solid #806718; border-radius:8px; color:#ffe58a; font-size:11px; line-height:1.5; margin:8px 0 0; padding:8px; }
    .notes-privacy-warning strong { color:#fff0a8; }
    .notes-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 6px; }
    .notes-clear-btn { border: 1px solid #555; background: #1f2b3d; color: #d4deea; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
    .notes-clear-btn:hover:not(:disabled), .notes-clear-btn:focus-visible:not(:disabled) { background: #2b3a50; border-color: #8fbfe8; }
    .notes-clear-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .reviewer-feedback-section { margin-top:10px; }
    .reviewer-feedback-section summary { color:#aaa; cursor:pointer; font-size:13px; }
    .reviewer-feedback-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:8px; }
    .reviewer-feedback-grid label { color:#9fb0c0; display:grid; gap:4px; font-size:11px; line-height:1.4; }
    .reviewer-feedback-grid select, .reviewer-feedback-grid input, .reviewer-feedback-textarea { background:#16213e; border:1px solid #444; border-radius:6px; color:#d4deea; font:inherit; font-size:12px; min-width:0; padding:7px 8px; }
    .reviewer-feedback-textarea { min-height:58px; resize:vertical; width:100%; }
    .reviewer-feedback-full { grid-column:1 / -1; }
    .reviewer-feedback-actions { align-items:center; display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; margin-top:8px; }
    .reviewer-feedback-state { background:#101925; border:1px solid #223447; border-radius:8px; color:#9fb0c0; display:grid; gap:4px; font-size:11px; line-height:1.5; margin-top:8px; padding:8px; }
    .reviewer-feedback-state.is-saved { background:#101f1a; border-color:#2e7d4f; }
    .reviewer-feedback-state.is-saved strong { color:#a8efc0; }
    .reviewer-feedback-state.is-empty { background:#171d25; border-color:#566273; }
    .csv-btn { margin-left: auto; }
    .view-tabs { display: flex; flex-direction: column; gap: 0; margin-bottom: 16px; }
    .view-tab { flex: 1; min-width:0; padding: 10px; text-align: center; font-size: 13px; font-weight: bold; color: #aaa; background: #1e2a3a; border: 1px solid #2a3a4a; cursor: pointer; transition: all 0.2s; }
    .view-tab:first-child { border-radius: 8px 8px 0 0; }
    .view-tab:last-child { border-radius: 0 0 8px 8px; margin-top:-1px; }
    .view-tab.active { color: #fff; background: #e94560; border-color: #e94560; }
    .kanban-board { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 12px; min-height: 300px; }
    .kanban-col { min-width: 180px; flex: 1; background: #1a2332; border-radius: 10px; padding: 10px; }
    .kanban-col-header { font-size: 12px; font-weight: bold; color: #fff; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; text-align: center; }
    .kanban-col-count { font-size: 10px; color: rgba(255,255,255,0.7); margin-left: 4px; }
    .kanban-card { background: #1e2a3a; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; border-left: 3px solid transparent; }
    .kanban-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .kanban-card .k-company { font-size: 13px; font-weight: bold; color: #fff; margin-bottom: 4px; }
    .kanban-card .k-product { font-size: 11px; color: #aaa; margin-bottom: 6px; }
    .kanban-card .k-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
    .kanban-card .k-score { color: #e94560; font-weight: bold; }
    .kanban-card .k-followup { color: #aaa; font-size: 10px; }
    .kanban-card .k-review { color:#b7c6d8; font-size:10px; margin-top:6px; line-height:1.4; }
    .kanban-card .k-gate { display:inline-block; border:1px solid #806718; border-radius:6px; color:#ffe58a; font-size:10px; font-weight:700; line-height:1.4; margin-top:6px; padding:3px 6px; }
    .kanban-card .k-gate.gate-ready { background:#101f1a; border-color:#2e7d4f; color:#a8efc0; }
    .kanban-card .k-gate.gate-review, .kanban-card .k-gate.gate-hold { background:#1f1c12; border-color:#806718; color:#ffe58a; }
    .kanban-card .k-gate.gate-blocked { background:#211719; border-color:#8a3b3b; color:#ffc4c4; }
    .kanban-card .k-action { color:#cbd8e6; font-size:10px; line-height:1.4; margin-top:6px; }
    .kanban-card .k-action.priority-high { color:#a8efc0; }
    .kanban-card .k-action.priority-medium, .kanban-card .k-action.priority-hold { color:#ffe58a; }
    .kanban-card .k-action.priority-low, .kanban-card .k-action.priority-blocked { color:#ffc4c4; }
    .kanban-card.followup-warn { border-left-color: #e74c3c; }
    .kanban-card.followup-warn .k-followup { color: #e74c3c; font-weight: bold; }
    .kanban-card .k-value { color: #27ae60; font-size: 11px; }
    @media (max-width: 720px) {
      .lead-head { flex-direction:column; }
      .lead-badges { justify-content:flex-start; }
      .lead-metrics, .leads-summary, .reviewer-feedback-grid { grid-template-columns:1fr; }
      .review-slice-grid, .review-gate-summary .review-slice-grid, .manager-reviewer-summary .review-slice-grid, .reviewer-action-lanes, .review-session-grid, .review-productivity-grid { grid-template-columns:1fr; }
      .top-nav { align-items:flex-start; }
      .top-nav-links { justify-content:flex-start; width:100%; }
      .top-nav-links .btn, .top-nav-links button { flex:1 1 auto; min-width:0; }
      .review-filter-actions { justify-content:stretch; }
      .review-filter-actions button { width:100%; }
      .next-review-strip-actions button, .review-session-actions button, .review-note-copy-actions button { flex:1 1 auto; min-width:0; }
    }
  </style>
</head>
<body>
  <main class="container" style="max-width:700px;">
    <nav class="top-nav" aria-label="상단 이동">
      <a href="/" class="back-link">← 메인</a>
      <div class="top-nav-links">
        <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
        <a id="historyLink" href="/history" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">전체 히스토리</a>
        <button class="btn btn-secondary csv-btn" style="font-size:12px;padding:6px 12px;" onclick="downloadCSV()">CSV 내보내기</button>
      </div>
    </nav>
    <h1 style="font-size:22px;">프로젝트 신호 검토 큐</h1>
    <p class="subtitle">Project Pursuit 후보를 찾기 위한 LeadBrief 기반 보조 신호 목록</p>

    <div class="view-tabs" role="tablist" aria-label="리드 보기 전환" aria-orientation="vertical">
      <button id="listViewTab" class="view-tab active" type="button" role="tab" aria-selected="true" aria-controls="leadsList" tabindex="0" data-view-target="list" onclick="switchView('list')">리스트</button>
      <button id="kanbanViewTab" class="view-tab" type="button" role="tab" aria-selected="false" aria-controls="kanbanView" tabindex="-1" data-view-target="kanban" onclick="switchView('kanban')">칸반 보드</button>
    </div>

    <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;margin-bottom:12px;" onclick="window.print()">PDF 인쇄</button>

    <div class="batch-enrich-bar">
      <span>미분석 리드를 AI로 심층 분석합니다 (최대 3건/회)</span>
      <button class="btn-enrich" onclick="batchEnrich(this)">일괄 상세 분석</button>
    </div>
    <div id="batchStatus" style="font-size:12px;margin-bottom:12px;min-height:16px;"></div>

    <section id="nextReviewStrip" class="next-review-strip" aria-label="다음 리뷰">
      <div class="next-review-strip-head">
        <div>
          <span>다음 리뷰</span>
          <strong>리드 큐를 불러오는 중입니다.</strong>
        </div>
      </div>
    </section>

    <div id="reviewQueueFilters" class="review-filter-bar" aria-label="리드 검토 필터">
      <label>검토 상태
        <select data-filter-key="reviewStatus" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="NEW">새 검토</option>
          <option value="NEEDS_REVIEW">검토 필요</option>
          <option value="APPROVED">승인</option>
          <option value="REJECTED">반려</option>
          <option value="DEFERRED">보류</option>
        </select>
      </label>
      <label>검증 상태
        <select data-filter-key="verificationStatus" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="verified">검증됨</option>
          <option value="needs_review">검증 필요</option>
          <option value="draft">초안</option>
          <option value="unverified">미검증</option>
        </select>
      </label>
      <label>생성 방식
        <select data-filter-key="generationMode" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="llm">LLM 생성</option>
          <option value="heuristic">휴리스틱 생성</option>
          <option value="demo">데모</option>
          <option value="unavailable">생성 불가</option>
        </select>
      </label>
      <label>신뢰도
        <select data-filter-key="confidence" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
      </label>
      <label>게이트 상태
        <select data-filter-key="gateStatus" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="ready">게이트 통과</option>
          <option value="review">보강 필요</option>
          <option value="blocked">차단</option>
          <option value="hold">보류</option>
        </select>
      </label>
      <label>액션 레인
        <select data-filter-key="queueLane" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="approval_candidates">승인 후보</option>
          <option value="needs_evidence">보강 필요</option>
          <option value="risk_review">리스크 확인</option>
          <option value="low_priority">낮은 우선순위</option>
        </select>
      </label>
      <label>다음 액션
        <select data-filter-key="nextReviewAction" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="prepare_human_follow_up">후속 준비</option>
          <option value="decide_review_status">검토 결정</option>
          <option value="verify_evidence">근거 확인</option>
          <option value="resolve_data_gaps">데이터 공백 보강</option>
          <option value="enrich_before_review">보강 후 검토</option>
          <option value="refresh_signal">신호 갱신</option>
          <option value="reconcile_review_conflict">리스크 조정</option>
          <option value="schedule_recheck">재검토 예약</option>
          <option value="keep_out_of_queue">우선순위 제외</option>
        </select>
      </label>
      <label>검토 우선순위
        <select data-filter-key="reviewPriority" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="high">높음</option>
          <option value="medium">중간</option>
          <option value="hold">보류</option>
          <option value="blocked">차단</option>
        </select>
      </label>
      <label>리스크 플래그
        <select data-filter-key="riskFlag" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="has">리스크 있음</option>
          <option value="none">리스크 없음</option>
          <option value="missing_evidence">근거 누락</option>
          <option value="data_gaps">데이터 공백</option>
          <option value="low_confidence">낮은 신뢰도</option>
          <option value="conflicting_evidence">충돌 근거</option>
          <option value="approved_but_unverified">승인/검증 충돌</option>
          <option value="stale_signal">오래된 신호</option>
        </select>
      </label>
      <label>누락 정보
        <select data-filter-key="missingInfo" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="has">누락 있음</option>
          <option value="none">누락 없음</option>
        </select>
      </label>
      <label>데이터 공백
        <select data-filter-key="dataGaps" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="has">공백 있음</option>
          <option value="none">공백 없음</option>
        </select>
      </label>
      <div class="review-filter-actions">
        <button class="btn btn-secondary" type="button" onclick="resetReviewQueueFilters()">초기화</button>
      </div>
    </div>
    <div id="leadsSummary"></div>
    <div id="leadsList" role="tabpanel" aria-labelledby="listViewTab"><p style="color:#aaa;">로딩 중...</p></div>
    <div id="kanbanView" role="tabpanel" aria-labelledby="kanbanViewTab" style="display:none;" hidden></div>
  </main>

  <script>
    ${getEscScript()}
    ${getSafeUrlScript()}
    ${getStoredTokenScript()}
    const generatedReviewGuidanceEnabled = ${includeGeneratedReviewGuidance ? 'true' : 'false'};
    function detailLink(leadId) {
      return '/leads/' + encodeURIComponent(leadId);
    }
    async function openLeadDetail(leadId, event) {
      if (!leadId) return;
      if (event) event.preventDefault();
      try {
        const href = detailLink(leadId);
        const res = await fetch(href, { headers: authHeaders() });
        const html = await res.text();
        if (!res.ok) { document.open(); document.write(html); document.close(); return; }
        history.pushState(null, '', href);
        document.open(); document.write(html); document.close();
      } catch(e) { window.location.href = detailLink(leadId); }
    }
    ${getProfileScript('danfoss')}

    const statusLabels = { NEW: '신규', CONTACTED: '접촉 완료', MEETING: '미팅진행', PROPOSAL: '제안제출', NEGOTIATION: '협상중', WON: '수주성공', LOST: '보류' };
    const statusColors = { NEW: '#3498db', CONTACTED: '#9b59b6', MEETING: '#e67e22', PROPOSAL: '#1abc9c', NEGOTIATION: '#2980b9', WON: '#27ae60', LOST: '#7f8c8d' };
    const transitions = { NEW: ['CONTACTED'], CONTACTED: ['MEETING'], MEETING: ['PROPOSAL'], PROPOSAL: ['NEGOTIATION'], NEGOTIATION: ['WON','LOST'], LOST: ['NEW'], WON: [] };
    const reviewStatusLabels = { NEW: '새 검토', NEEDS_REVIEW: '검토 필요', APPROVED: '승인', REJECTED: '반려', DEFERRED: '보류' };
    const reviewStatuses = Object.keys(reviewStatusLabels);
    const verificationStatusLabels = { verified: '검증됨', needs_review: '검증 필요', draft: '초안', unverified: '미검증' };
    const generationModeLabels = { llm: 'LLM 생성', heuristic: '휴리스틱 생성', demo: '데모', unavailable: '생성 불가' };
    const confidenceLabels = { HIGH: '신뢰도 HIGH', MEDIUM: '신뢰도 MEDIUM', LOW: '신뢰도 LOW' };
    const queueLaneLabels = {
      approval_candidates: '승인 후보',
      needs_evidence: '보강 필요',
      risk_review: '리스크 확인',
      low_priority: '낮은 우선순위'
    };
    const queueLaneDescriptions = {
      approval_candidates: '검토 결정 또는 후속 준비 가능',
      needs_evidence: '근거, 공백, 보강 확인 대상',
      risk_review: '충돌 또는 검토 상태 리스크 확인',
      low_priority: '반려, 보류, 재검토 대기'
    };
    const reviewerFeedbackLabels = {
      actionUsefulness: {
        useful: '유용함',
        partially_useful: '부분 유용',
        not_useful: '유용하지 않음',
        unclear: '불명확'
      },
      outcomeLabel: {
        interested: '관심 있음',
        not_fit: '부적합',
        no_response: '응답 없음',
        needs_more_research: '추가 조사 필요',
        duplicate: '중복',
        deferred: '보류',
        unknown: '알 수 없음'
      },
      dataGapPriority: {
        none: '없음',
        low: '낮음',
        medium: '중간',
        high: '높음',
        blocking: '차단'
      },
      evidenceConfidenceAdjustment: {
        increase: '상향',
        decrease: '하향',
        unchanged: '유지',
        unknown: '알 수 없음'
      }
    };
    const reviewQueueFilters = {
      reviewStatus: 'all',
      verificationStatus: 'all',
      generationMode: 'all',
      confidence: 'all',
      gateStatus: 'all',
      queueLane: 'all',
      nextReviewAction: 'all',
      reviewPriority: 'all',
      riskFlag: 'all',
      missingInfo: 'all',
      dataGaps: 'all'
    };

    function leadAccessibleName(lead) {
      return esc((lead && (lead.company || lead.id)) || '리드');
    }

    function renderStatusSelect(lead) {
      if (!lead.id) return '';
      const current = lead.status || 'NEW';
      const allowed = transitions[current] || [];
      if (allowed.length === 0) return \`<span class="badge badge-status \${current.toLowerCase()}">\${esc(statusLabels[current])}</span>\`;
      const opts = [current, ...allowed].map(s =>
        \`<option value="\${s}" \${s === current ? 'selected' : ''}>\${esc(statusLabels[s] || s)}</option>\`
      ).join('');
      return \`<select class="status-select" aria-label="\${leadAccessibleName(lead)} 영업 상태 변경" onchange="updateStatus('\${esc(lead.id)}', this.value, '\${current}')">\${opts}</select>\`;
    }

    function normalizeReviewStatus(value) {
      const status = String(value || '').toUpperCase();
      return reviewStatuses.includes(status) ? status : 'NEEDS_REVIEW';
    }

    function getReviewStatus(lead) {
      return normalizeReviewStatus(lead.reviewStatus || lead.review_status);
    }

    function humanReviewStatusLabel(status) {
      const current = normalizeReviewStatus(status);
      if (current === 'NEEDS_REVIEW') return '사람 검토: 필요';
      return '사람 검토: ' + (reviewStatusLabels[current] || current);
    }

    function normalizeVerificationStatus(value) {
      const status = String(value || '').toLowerCase();
      return verificationStatusLabels[status] ? status : 'needs_review';
    }

    function getVerificationStatus(lead) {
      return normalizeVerificationStatus(lead.verificationStatus || lead.verification_status);
    }

    function normalizeGenerationMode(value) {
      const mode = String(value || '').toLowerCase();
      return generationModeLabels[mode] ? mode : 'llm';
    }

    function getGenerationMode(lead) {
      return normalizeGenerationMode(lead.generationMode || lead.generation_mode);
    }

    function getConfidence(lead) {
      const confidence = String(lead.confidence || '').toUpperCase();
      return confidenceLabels[confidence] ? confidence : 'LOW';
    }

    function getArrayField(lead, camelKey, snakeKey) {
      const value = lead[camelKey];
      if (Array.isArray(value)) return value.filter(Boolean);
      const legacyValue = lead[snakeKey];
      if (Array.isArray(legacyValue)) return legacyValue.filter(Boolean);
      return [];
    }

    function getDataGaps(lead) {
      return getArrayField(lead, 'dataGaps', 'data_gaps');
    }

    function getEvidenceItems(lead) {
      return getArrayField(lead, 'evidence', 'evidence');
    }

    function getSources(lead) {
      return getArrayField(lead, 'sources', 'sources');
    }

    function getLeadId(lead) {
      return String((lead && (lead.id || lead.leadId || lead.lead_id)) || '');
    }

    function getManualReviewNoteValue(lead) {
      return String((lead && (lead.manualReviewNotes || lead.manual_review_notes || lead.notes)) || '').trim();
    }

    function getManualReviewNotesAuthorLabel(lead) {
      const label = String((lead && (lead.manualReviewNotesAuthorLabel || lead.manual_review_notes_author_label)) || '').trim();
      return label === 'manual_reviewer' ? '수동 리뷰어' : '';
    }

    function getManualReviewNoteStateLabel(lead) {
      return getManualReviewNoteValue(lead) ? '저장됨' : '비어 있음';
    }

    function getManualReviewNotesHistoryEventCount(lead) {
      const count = Number(lead && (lead.manualReviewNotesHistoryEventCount || lead.manual_review_notes_history_event_count) || 0);
      return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    }

    function formatTimestamp(raw) {
      if (!raw) return '';
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('ko-KR');
    }

    function formatLeadUpdatedAt(lead) {
      return formatTimestamp(lead && (lead.updatedAt || lead.updated_at));
    }

    function formatManualReviewNotesUpdatedAt(lead) {
      return formatTimestamp(lead && (lead.manualReviewNotesUpdatedAt || lead.manual_review_notes_updated_at));
    }

    function renderManualReviewNoteState(lead) {
      const hasSavedNote = Boolean(getManualReviewNoteValue(lead));
      const noteUpdatedAt = formatManualReviewNotesUpdatedAt(lead);
      const leadUpdatedAt = formatLeadUpdatedAt(lead);
      const authorLabel = getManualReviewNotesAuthorLabel(lead);
      const historyEventCount = getManualReviewNotesHistoryEventCount(lead);
      const timestampMeta = noteUpdatedAt
        ? \`<span class="notes-state-meta">\${hasSavedNote ? '수동 리뷰 메모 마지막 변경' : '수동 리뷰 메모가 마지막으로 비워짐/변경됨'}: \${esc(noteUpdatedAt)}</span>\`
        : (leadUpdatedAt ? \`<span class="notes-state-meta">리드 마지막 업데이트: \${esc(leadUpdatedAt)} (메모 전용 시간 아님)</span>\` : '');
      const authorMeta = authorLabel
        ? \`<span class="notes-state-meta">최근 수동 변경: \${esc(authorLabel)} (로컬/테스트 일반 라벨)</span>\`
        : '';
      const historyMeta = historyEventCount > 0
        ? \`<span class="notes-state-meta">수동 메모 메타데이터 이력 이벤트: \${historyEventCount}건</span>\`
        : '';
      return \`
        <div class="notes-state \${hasSavedNote ? 'is-saved' : 'is-empty'}" data-manual-note-state="\${hasSavedNote ? 'saved' : 'empty'}">
          <strong>\${hasSavedNote ? '저장된 수동 리뷰 메모 있음' : '저장된 수동 리뷰 메모 없음'}</strong>
          <span>\${hasSavedNote ? '사람이 입력한 수동 메모만 저장 상태로 표시됩니다.' : '비어 있음 상태입니다. 생성된 검토 메모 제안은 저장 상태가 아닙니다.'}</span>
          \${timestampMeta}
          \${authorMeta}
          \${historyMeta}
        </div>
      \`;
    }

    function renderManualReviewNotePrivacyWarning() {
      return \`
        <p class="notes-privacy-warning" role="note"><strong>로컬/테스트 개인정보 주의:</strong> 수동 메모에는 민감한 영업 맥락이나 PII가 포함될 수 있습니다. 실제 개인정보/비밀은 입력하지 마세요. 지우기는 현재 저장된 메모 텍스트만 비웁니다. 자동 감지/차단은 하지 않습니다.</p>
      \`;
    }

    function updateManualReviewNoteState(section, lead) {
      if (!section || !lead) return;
      const state = section.querySelector('[data-manual-note-state]');
      if (state) state.outerHTML = renderManualReviewNoteState(lead);
      const summaryState = section.querySelector('[data-manual-note-summary-state]');
      if (summaryState) summaryState.textContent = getManualReviewNoteStateLabel(lead);
    }

    function normalizeReviewerFeedback(lead) {
      const raw = lead && (lead.reviewerFeedback || lead.reviewer_feedback);
      const record = raw && typeof raw === 'object' ? raw : {};
      const feedback = {
        hasFeedback: record.hasFeedback === true,
        actionUsefulness: reviewerFeedbackLabels.actionUsefulness[record.actionUsefulness || record.action_usefulness] ? (record.actionUsefulness || record.action_usefulness) : 'unclear',
        outcomeLabel: reviewerFeedbackLabels.outcomeLabel[record.outcomeLabel || record.outcome_label] ? (record.outcomeLabel || record.outcome_label) : 'unknown',
        dataGapPriority: reviewerFeedbackLabels.dataGapPriority[record.dataGapPriority || record.data_gap_priority] ? (record.dataGapPriority || record.data_gap_priority) : 'none',
        evidenceConfidenceAdjustment: reviewerFeedbackLabels.evidenceConfidenceAdjustment[record.evidenceConfidenceAdjustment || record.evidence_confidence_adjustment] ? (record.evidenceConfidenceAdjustment || record.evidence_confidence_adjustment) : 'unknown',
        feedbackText: String(record.feedbackText || record.feedback_text || ''),
        nextReviewerAction: String(record.nextReviewerAction || record.next_reviewer_action || ''),
        authorLabel: String(record.authorLabel || record.author_label || '').trim(),
        updatedAt: record.updatedAt || record.updated_at || null,
        historyEventCount: Number(record.historyEventCount || record.history_event_count || 0) || 0,
        historyLastEventType: String(record.historyLastEventType || record.history_last_event_type || ''),
        historyLastEventAt: record.historyLastEventAt || record.history_last_event_at || null,
        historyLastAuthorLabel: String(record.historyLastAuthorLabel || record.history_last_author_label || '').trim()
      };
      feedback.hasFeedback = feedback.hasFeedback
        || Boolean(feedback.updatedAt)
        || feedback.actionUsefulness !== 'unclear'
        || feedback.outcomeLabel !== 'unknown'
        || feedback.dataGapPriority !== 'none'
        || feedback.evidenceConfidenceAdjustment !== 'unknown'
        || Boolean(feedback.feedbackText.trim())
        || Boolean(feedback.nextReviewerAction.trim());
      return feedback;
    }

    function getReviewerFeedbackStateLabel(lead) {
      return normalizeReviewerFeedback(lead).hasFeedback ? '저장됨' : '비어 있음';
    }

    function getReviewerFeedbackAuthorLabel(feedback) {
      const label = String((feedback && (feedback.authorLabel || feedback.historyLastAuthorLabel)) || '').trim();
      return label === 'manual_reviewer' ? '수동 리뷰어' : '';
    }

    function renderReviewerFeedbackState(lead) {
      const feedback = normalizeReviewerFeedback(lead);
      const updatedAt = formatTimestamp(feedback.updatedAt);
      const historyAt = formatTimestamp(feedback.historyLastEventAt);
      const authorLabel = getReviewerFeedbackAuthorLabel(feedback);
      const outcome = reviewerFeedbackLabels.outcomeLabel[feedback.outcomeLabel] || feedback.outcomeLabel;
      const priority = reviewerFeedbackLabels.dataGapPriority[feedback.dataGapPriority] || feedback.dataGapPriority;
      const nextAction = feedback.nextReviewerAction.trim();
      const timestampMeta = updatedAt
        ? \`<span class="notes-state-meta">리뷰어 피드백 마지막 변경: \${esc(updatedAt)}</span>\`
        : (historyAt ? \`<span class="notes-state-meta">최근 메타데이터 이벤트: \${esc(historyAt)}</span>\` : '');
      const authorMeta = authorLabel
        ? \`<span class="notes-state-meta">최근 수동 변경: \${esc(authorLabel)} (로컬/테스트 일반 라벨)</span>\`
        : '';
      const historyMeta = feedback.historyEventCount > 0
        ? \`<span class="notes-state-meta">피드백 메타데이터 이력 이벤트: \${feedback.historyEventCount}건</span>\`
        : '';
      return \`
        <div class="reviewer-feedback-state \${feedback.hasFeedback ? 'is-saved' : 'is-empty'}" data-reviewer-feedback-state="\${feedback.hasFeedback ? 'saved' : 'empty'}">
          <strong>\${feedback.hasFeedback ? '저장된 리뷰어 피드백 있음' : '저장된 리뷰어 피드백 없음'}</strong>
          <span>결과 \${esc(outcome)} · 데이터 공백 우선순위 \${esc(priority)}</span>
          \${nextAction ? \`<span class="notes-state-meta">다음 수동 액션: \${esc(nextAction)}</span>\` : ''}
          \${timestampMeta}
          \${authorMeta}
          \${historyMeta}
        </div>
      \`;
    }

    function renderReviewerFeedbackOptions(group, selected) {
      const labels = reviewerFeedbackLabels[group] || {};
      return Object.keys(labels).map((value) => \`<option value="\${esc(value)}" \${value === selected ? 'selected' : ''}>\${esc(labels[value])}</option>\`).join('');
    }

    function renderReviewerFeedbackControls(lead) {
      if (cachedManualReviewNotesAccess && cachedManualReviewNotesAccess.manualNotesRead !== true) {
        return \`
          <div class="reviewer-feedback-section">
            <details>
              <summary>리뷰어 피드백 <span class="notes-summary-state">제한됨</span></summary>
              <div class="reviewer-feedback-state is-empty">
                <strong>보호된 피드백 숨김</strong>
                <span>로컬/테스트 역할 스텁에서 reviewer 역할이 아니면 수동 피드백 본문과 메타데이터를 표시하지 않습니다.</span>
              </div>
            </details>
          </div>
        \`;
      }
      const feedback = normalizeReviewerFeedback(lead);
      return \`
        <div class="reviewer-feedback-section">
          <details>
            <summary>리뷰어 피드백 <span class="notes-summary-state" data-reviewer-feedback-summary-state>\${esc(getReviewerFeedbackStateLabel(lead))}</span></summary>
            \${renderReviewerFeedbackState(lead)}
            <p class="notes-privacy-warning" role="note"><strong>로컬/테스트 사람 판단:</strong> 이 피드백은 리뷰 품질 개선용 수동 입력입니다. 생성된 검토 메모 제안은 저장/전송/귀속/이력/내보내기 대상이 아닙니다.</p>
            <div class="reviewer-feedback-grid" data-reviewer-feedback-form>
              <label>액션 유용성
                <select data-feedback-field="actionUsefulness">\${renderReviewerFeedbackOptions('actionUsefulness', feedback.actionUsefulness)}</select>
              </label>
              <label>결과 라벨
                <select data-feedback-field="outcomeLabel">\${renderReviewerFeedbackOptions('outcomeLabel', feedback.outcomeLabel)}</select>
              </label>
              <label>데이터 공백 우선순위
                <select data-feedback-field="dataGapPriority">\${renderReviewerFeedbackOptions('dataGapPriority', feedback.dataGapPriority)}</select>
              </label>
              <label>근거 신뢰도 조정
                <select data-feedback-field="evidenceConfidenceAdjustment">\${renderReviewerFeedbackOptions('evidenceConfidenceAdjustment', feedback.evidenceConfidenceAdjustment)}</select>
              </label>
              <label class="reviewer-feedback-full">다음 리뷰어 액션
                <input data-feedback-field="nextReviewerAction" value="\${esc(feedback.nextReviewerAction)}" maxlength="500">
              </label>
              <label class="reviewer-feedback-full">피드백
                <textarea class="reviewer-feedback-textarea" data-feedback-field="feedbackText" maxlength="2000">\${esc(feedback.feedbackText)}</textarea>
              </label>
            </div>
            <div class="reviewer-feedback-actions">
              <button type="button" class="btn btn-secondary" onclick="saveReviewerFeedback('\${esc(getLeadId(lead))}', this)">피드백 저장</button>
              <button type="button" class="notes-clear-btn" onclick="clearReviewerFeedback('\${esc(getLeadId(lead))}', this)" \${feedback.hasFeedback ? '' : 'disabled'}>피드백 지우기</button>
            </div>
          </details>
        </div>
      \`;
    }

    function cacheReviewerActionQueue(queue) {
      const items = Array.isArray(queue && queue.items) ? queue.items : [];
      cachedReviewerQueue = queue && typeof queue === 'object' ? queue : { items: [], lanes: [] };
      cachedQueueItemsByLeadId = {};
      items.forEach((item, index) => {
        const leadId = String(item && item.leadId || '');
        if (!leadId) return;
        cachedQueueItemsByLeadId[leadId] = { ...item, sortIndex: index };
      });
    }

    function cacheManualReviewNotesAccess(access) {
      cachedManualReviewNotesAccess = access && typeof access === 'object' ? access : null;
    }

    function canShowGeneratedReviewGuidance() {
      return generatedReviewGuidanceEnabled
        && (!cachedManualReviewNotesAccess || cachedManualReviewNotesAccess.manualNotesRead === true);
    }

    function laneForFallbackAction(action) {
      if (action === 'keep_out_of_queue' || action === 'schedule_recheck') return 'low_priority';
      if (action === 'reconcile_review_conflict' || action === 'refresh_signal') return 'risk_review';
      if (action === 'prepare_human_follow_up' || action === 'decide_review_status') return 'approval_candidates';
      return 'needs_evidence';
    }

    function buildFallbackReviewerQueueItem(lead) {
      const summary = buildLeadActionIntelligenceSummary(lead);
      const dataGapCount = getDataGaps(lead).length;
      const missingEvidence = getEvidenceItems(lead).length === 0 || getSources(lead).length === 0;
      const missingInfoCount = dataGapCount + (missingEvidence ? 1 : 0) + (getVerificationStatus(lead) !== 'verified' ? 1 : 0);
      const queueLane = laneForFallbackAction(summary.nextReviewAction);
      ${includeGeneratedReviewGuidance
        ? 'const reviewNotes = canShowGeneratedReviewGuidance() ? buildFallbackReviewNoteTemplates(lead, summary) : null;'
        : 'const reviewNotes = null;'}
      return {
        leadId: getLeadId(lead),
        company: lead.company || '리드',
        reviewStatus: getReviewStatus(lead),
        verificationStatus: getVerificationStatus(lead),
        generationMode: getGenerationMode(lead),
        leadConfidence: getConfidence(lead),
        nextReviewAction: summary.nextReviewAction,
        nextReviewActionLabel: summary.action,
        reviewPriority: summary.priority,
        actionConfidence: summary.actionConfidence,
        queueLane,
        queueLaneLabel: queueLaneLabels[queueLane] || queueLane,
        reasonSnippet: summary.reason,
        riskCount: summary.risks.length,
        missingInfoCount,
        riskFlags: summary.risks.map((risk) => ({ code: risk })),
        missingInfoPrompts: [],
        ${includeGeneratedReviewGuidance
          ? `...(reviewNotes ? {
          reviewNoteSuggestion: reviewNotes.current,
          reviewNoteTemplates: reviewNotes.templates,
        } : {}),`
          : ''}
        sortIndex: 9999,
      };
    }

    function getLeadQueueItem(lead) {
      const leadId = getLeadId(lead);
      if (leadId && cachedQueueItemsByLeadId[leadId]) return cachedQueueItemsByLeadId[leadId];
      return buildFallbackReviewerQueueItem(lead);
    }

    function renderReviewBadge(lead) {
      const current = getReviewStatus(lead);
      return \`<span class="badge badge-review \${current.toLowerCase()}">\${esc(humanReviewStatusLabel(current))}</span>\`;
    }

    function renderVerificationBadge(lead) {
      const status = getVerificationStatus(lead);
      return \`<span class="badge badge-verification \${status}">\${esc(verificationStatusLabels[status])}</span>\`;
    }

    function renderGenerationBadge(lead) {
      const mode = getGenerationMode(lead);
      return \`<span class="badge badge-generation \${mode}">\${esc(generationModeLabels[mode])}</span>\`;
    }

    function renderConfidenceBadge(lead) {
      const confidence = getConfidence(lead);
      return \`<span class="badge badge-confidence \${confidence.toLowerCase()}">\${esc(confidenceLabels[confidence])}</span>\`;
    }

    function renderEvidenceSummary(lead) {
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const label = evidenceCount > 0 ? \`근거 \${evidenceCount}개\` : '직접 인용 없음';
      const evidenceClass = evidenceCount > 0 ? 'has_evidence' : 'missing_evidence';
      return \`<span class="badge badge-evidence \${evidenceClass}">\${esc(label)} / 출처 \${sourceCount}개</span>\`;
    }

    function renderReviewTrustBadges(lead) {
      return \`
        <span class="lead-review-meta">
          \${renderVerificationBadge(lead)}
          \${renderGenerationBadge(lead)}
          \${renderConfidenceBadge(lead)}
          \${renderEvidenceSummary(lead)}
        </span>
      \`;
    }

    function renderDataGapSummary(lead) {
      const gaps = getDataGaps(lead);
      if (gaps.length === 0) {
        return '<div class="lead-block data-gap-clear"><span class="block-label">데이터 공백</span><div class="block-value">확인된 데이터 공백 없음</div></div>';
      }
      const shown = gaps.slice(0, 2).map((gap) => esc(gap)).join(', ');
      const extra = gaps.length > 2 ? ' 외 ' + (gaps.length - 2) + '건' : '';
      return \`<div class="lead-block data-gap-summary"><span class="block-label">데이터 공백 \${gaps.length}건</span><div class="block-value">\${shown}\${extra}</div></div>\`;
    }

    function buildLeadListReviewGate(lead) {
      const reviewStatus = getReviewStatus(lead);
      const verificationStatus = getVerificationStatus(lead);
      const confidence = getConfidence(lead);
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const dataGapCount = getDataGaps(lead).length;
      let state = 'review';
      let label = '목록 게이트 보강 필요';

      if (reviewStatus === 'REJECTED') {
        state = 'blocked';
        label = '목록 게이트 차단';
      } else if (reviewStatus === 'DEFERRED') {
        state = 'hold';
        label = '목록 게이트 보류';
      } else if (
        reviewStatus === 'APPROVED'
        && verificationStatus === 'verified'
        && confidence !== 'LOW'
        && evidenceCount > 0
        && sourceCount > 0
        && dataGapCount === 0
      ) {
        state = 'ready';
        label = '목록 게이트 통과';
      }

      return {
        state,
        label,
        items: [
          humanReviewStatusLabel(reviewStatus),
          verificationStatusLabels[verificationStatus] || verificationStatus,
          confidenceLabels[confidence] || ('신뢰도 ' + confidence),
          evidenceCount > 0 ? '근거 ' + evidenceCount + '개 / 출처 ' + sourceCount + '개' : '직접 인용 없음 / 출처 ' + sourceCount + '개',
          dataGapCount === 0 ? '데이터 공백 없음' : '데이터 공백 ' + dataGapCount + '건',
        ],
      };
    }

    function countStaleSources(lead) {
      const staleAfterMs = 90 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      return getSources(lead).filter((source) => {
        const raw = source && (source.publishedAt || source.published_at || source.publishedDate || source.published_date || source.date);
        if (!raw) return false;
        const parsed = new Date(raw);
        return !Number.isNaN(parsed.getTime()) && now - parsed.getTime() > staleAfterMs;
      }).length;
    }

    function hasConflictingEvidence(lead) {
      if (Array.isArray(lead.conflicts) && lead.conflicts.length > 0) return true;
      return getEvidenceItems(lead).some((item) => item && (item.contradicts || item.conflictsWith || item.conflict));
    }

    function buildLeadActionIntelligenceSummary(lead) {
      const reviewStatus = getReviewStatus(lead);
      const verificationStatus = getVerificationStatus(lead);
      const generationMode = getGenerationMode(lead);
      const confidence = getConfidence(lead);
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const dataGapCount = getDataGaps(lead).length;
      const staleCount = countStaleSources(lead);
      const hasConflict = hasConflictingEvidence(lead);
      const missingEvidence = evidenceCount === 0 || sourceCount === 0;
      let nextReviewAction = 'review_lead';
      let action = 'Review lead';
      let priority = 'medium';
      let actionConfidence = 'low';
      let reason = 'Inspect review, evidence, confidence, and gaps before deciding.';

      if (reviewStatus === 'REJECTED') {
        nextReviewAction = 'keep_out_of_queue';
        action = 'Keep out of active queue';
        priority = 'blocked';
        actionConfidence = 'medium';
        reason = 'Rejected by human review.';
      } else if (reviewStatus === 'APPROVED' && (verificationStatus !== 'verified' || hasConflict || missingEvidence || dataGapCount > 0 || confidence === 'LOW')) {
        nextReviewAction = 'reconcile_review_conflict';
        action = 'Reconcile review conflict';
        priority = 'high';
        actionConfidence = 'low';
        reason = 'Approval conflicts with verification, evidence, or open gaps.';
      } else if (staleCount > 0) {
        nextReviewAction = 'refresh_signal';
        action = 'Refresh stale signal';
        priority = 'medium';
        actionConfidence = 'low';
        reason = 'Public source date is outside the freshness window.';
      } else if (confidence === 'LOW' || generationMode === 'heuristic' || generationMode === 'unavailable') {
        nextReviewAction = 'enrich_before_review';
        action = 'Enrich before review';
        priority = 'medium';
        actionConfidence = 'low';
        reason = 'Confidence or generation mode needs stronger evidence.';
      } else if (missingEvidence) {
        nextReviewAction = 'verify_evidence';
        action = 'Verify evidence first';
        priority = 'medium';
        actionConfidence = 'low';
        reason = 'Direct evidence or source coverage is incomplete.';
      } else if (dataGapCount > 0) {
        nextReviewAction = 'resolve_data_gaps';
        action = 'Resolve data gaps';
        priority = 'medium';
        actionConfidence = 'low';
        reason = 'Open data gaps remain before approval or follow-up.';
      } else if (reviewStatus === 'DEFERRED') {
        nextReviewAction = 'schedule_recheck';
        action = 'Schedule recheck';
        priority = 'hold';
        actionConfidence = 'medium';
        reason = 'Deferred until a condition or timing changes.';
      } else if (reviewStatus === 'APPROVED' && verificationStatus === 'verified') {
        nextReviewAction = 'prepare_human_follow_up';
        action = 'Prepare reviewed follow-up';
        priority = 'high';
        actionConfidence = confidence === 'HIGH' ? 'high' : 'medium';
        reason = 'Approved, verified, evidence-backed lead.';
      } else if (verificationStatus === 'verified') {
        nextReviewAction = 'decide_review_status';
        action = 'Decide review status';
        priority = 'high';
        actionConfidence = 'medium';
        reason = 'Verified evidence is present; human review remains open.';
      }

      const risks = [];
      if (verificationStatus !== 'verified') risks.push('verification');
      if (missingEvidence) risks.push('evidence');
      if (dataGapCount > 0) risks.push('data gaps ' + dataGapCount);
      if (confidence === 'LOW') risks.push('low confidence');
      if (hasConflict) risks.push('conflict');
      if (staleCount > 0) risks.push('stale signal');

      return { nextReviewAction, action, priority, actionConfidence, reason, risks };
    }

    ${includeGeneratedReviewGuidance ? `
    function summarizeReviewNoteEvidence(lead) {
      const evidence = getEvidenceItems(lead);
      const sources = getSources(lead);
      if (evidence.length > 0) {
        const quote = String(evidence[0].quote || '').trim() || 'direct evidence';
        const source = String(evidence[0].sourceUrl || evidence[0].source_url || (sources[0] && sources[0].url) || '').trim();
        return source ? '"' + quote + '" (' + source + ')' : '"' + quote + '"';
      }
      if (sources.length > 0) {
        return 'Source to review: ' + (sources[0].title || sources[0].url || 'published source');
      }
      return 'No direct evidence quote or published source is available.';
    }

    function summarizeReviewNoteList(items, fallback) {
      const normalized = (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean);
      return normalized.length > 0 ? normalized.slice(0, 3).join('; ') : fallback;
    }

    function buildFallbackReviewNoteTemplates(lead, summary = buildLeadActionIntelligenceSummary(lead)) {
      const company = lead.company || '리드';
      const product = lead.product || lead.recommendedProduct || lead.recommended_product || 'recommended solution';
      const why = lead.whyNow || lead.why_now || lead.signal || lead.summary || 'Lead context needs review.';
      const evidence = summarizeReviewNoteEvidence(lead);
      const gaps = summarizeReviewNoteList(getDataGaps(lead), 'No open data gaps in current LeadBrief.');
      const risks = summarizeReviewNoteList(summary.risks, 'No risk flags in current LeadBrief.');
      const missing = getDataGaps(lead).length > 0 ? gaps : risks;
      const followUpState = getDataGaps(lead).length > 0 ? 'DATA_GAP' : 'RISK_CHECK';
      const followUpLabel = followUpState === 'DATA_GAP' ? '데이터 공백 확인 노트' : '리스크 확인 노트';
      const labels = {
        APPROVED: '승인 노트',
        NEEDS_REVIEW: '검토 필요 노트',
        DATA_GAP: '데이터 공백 확인 노트',
        RISK_CHECK: '리스크 확인 노트'
      };
      const approved = {
        state: 'APPROVED',
        label: labels.APPROVED,
        text: [
          'Decision: APPROVED',
          'Lead: ' + company + ' | Product: ' + product,
          'Why: ' + why,
          'Evidence: ' + evidence,
          'Review basis: verification=' + getVerificationStatus(lead) + '; confidence=' + getConfidence(lead) + '; action=' + summary.action + '.',
          'Missing/risk check: ' + missing,
          'Next: use as an internal review note and personalize before any CRM log or outreach.'
        ].join('\\n')
      };
      const needsReview = {
        state: 'NEEDS_REVIEW',
        label: labels.NEEDS_REVIEW,
        text: [
          'Decision: NEEDS_REVIEW',
          'Lead: ' + company + ' | Product: ' + product,
          'Reason: ' + summary.action + ' - ' + summary.reason,
          'Evidence status: ' + evidence,
          'Missing: ' + missing,
          'Current state: reviewStatus=' + getReviewStatus(lead) + '; verification=' + getVerificationStatus(lead) + '; confidence=' + getConfidence(lead) + '.',
          'Next: keep reviewStatus=NEEDS_REVIEW until evidence, gaps, and reviewer decision are resolved.'
        ].join('\\n')
      };
      const followUp = {
        state: followUpState,
        label: followUpLabel,
        text: [
          'Follow-up check: ' + followUpState,
          'Lead: ' + company + ' | Product: ' + product,
          'Reason: ' + summary.action + ' - ' + summary.reason,
          'Evidence status: ' + evidence,
          'Open items: ' + (followUpState === 'DATA_GAP' ? gaps : risks),
          'Missing prompts: ' + missing,
          'Next: resolve this check before approval or follow-up; this does not save or send notes.'
        ].join('\\n')
      };
      const templates = [approved, needsReview, followUp];
      const currentState = summary.nextReviewAction === 'prepare_human_follow_up'
        ? 'APPROVED'
        : followUpState === 'DATA_GAP' || summary.risks.length > 0
          ? followUpState
          : getReviewStatus(lead) === 'APPROVED'
            ? 'APPROVED'
            : 'NEEDS_REVIEW';

      return {
        current: templates.find((template) => template.state === currentState) || needsReview,
        templates,
        labels
      };
    }
    ` : `
    function buildFallbackReviewNoteTemplates() {
      return { current: null, templates: [], labels: {} };
    }
    `}

    function normalizeReviewNoteData(lead) {
      if (!canShowGeneratedReviewGuidance()) return { current: null, templates: [] };
      const item = getLeadQueueItem(lead);
      const fallback = buildFallbackReviewNoteTemplates(lead);
      const current = item.reviewNoteSuggestion && item.reviewNoteSuggestion.text
        ? item.reviewNoteSuggestion
        : fallback.current;
      const templates = Array.isArray(item.reviewNoteTemplates) && item.reviewNoteTemplates.length > 0
        ? item.reviewNoteTemplates
        : fallback.templates;
      return { current, templates };
    }

    function normalizeSummaryText(value, fallback = '') {
      const text = String(value || '').replace(/\\s+/g, ' ').trim();
      return text || fallback;
    }

    function truncateSummaryText(value, limit = 120) {
      const text = normalizeSummaryText(value);
      if (text.length <= limit) return text;
      return text.slice(0, Math.max(0, limit - 3)).trim() + '...';
    }

    function findReviewNoteLine(text, prefixes) {
      const lines = String(text || '').split(/\\n+/).map((line) => normalizeSummaryText(line)).filter(Boolean);
      return lines.find((line) => prefixes.some((prefix) => line.toLowerCase().startsWith(prefix.toLowerCase()))) || '';
    }

    function renderReviewNoteSummary(note = {}) {
      const text = note.text || '';
      const decision = findReviewNoteLine(text, ['Decision:', 'Follow-up check:']) || note.label || note.state || '검토 필요 노트';
      const lead = findReviewNoteLine(text, ['Lead:']);
      const reason = findReviewNoteLine(text, ['Reason:', 'Review basis:']);
      const evidence = findReviewNoteLine(text, ['Evidence status:', 'Evidence:']);
      const risk = findReviewNoteLine(text, ['Missing/risk check:', 'Open items:', 'Missing:', 'Missing prompts:']);
      const items = [decision, lead, reason, evidence || risk]
        .map((item) => truncateSummaryText(item, 96))
        .filter(Boolean)
        .slice(0, 4);
      const itemHtml = items.length > 0
        ? items.map((item) => \`<span>\${esc(item)}</span>\`).join('')
        : '<span>리뷰 노트 내용을 확인하세요.</span>';
      return \`
        <div class="review-note-summary" aria-label="검토 메모 제안 요약">
          <strong>검토 메모 제안 요약</strong>
          <div class="review-note-summary-items">\${itemHtml}</div>
          <p>생성된 제안은 복사 전용이며 자동 저장/전송되지 않습니다.</p>
        </div>
      \`;
    }

    function renderReviewNoteSuggestion(lead, options = {}) {
      if (!canShowGeneratedReviewGuidance()) return '';
      const noteData = normalizeReviewNoteData(lead || {});
      const current = noteData.current || {};
      const templates = noteData.templates || [];
      const variants = templates.map((template) => \`
        <details class="review-note-variant">
          <summary>\${esc(template.label || template.state)}</summary>
          \${renderReviewNoteSummary(template)}
          <pre class="review-note-copy-target" data-review-note-text tabindex="0" aria-label="\${esc(template.label || template.state)} 텍스트">\${esc(template.text || 'Review note suggestion unavailable.')}</pre>
          <div class="review-note-copy-actions">
            <button class="btn btn-secondary" type="button" data-note-copy-action="copy-variant-note" aria-label="\${esc(template.label || template.state)} 복사">복사</button>
          </div>
        </details>
      \`).join('');
      return \`
        <div class="review-note-suggestion \${options.compact ? 'is-compact' : ''}" aria-label="생성된 검토 메모 제안">
          <span class="block-label">생성된 검토 메모 제안</span>
          <div class="review-note-copy-head">
            <strong>\${esc(current.label || '검토 필요 노트')}</strong>
            <div class="review-note-copy-actions">
              <button class="btn btn-secondary" type="button" data-note-copy-action="copy-current-note" aria-label="현재 노트 복사">현재 노트 복사</button>
            </div>
          </div>
          \${renderReviewNoteSummary(current)}
          <pre class="review-note-copy-target" data-review-note-text tabindex="0" aria-label="현재 리뷰 노트 텍스트">\${esc(current.text || 'Review note suggestion unavailable. Confirm company, evidence, verification status, and data gaps before writing a review note.')}</pre>
          <p class="review-note-helper">사람이 저장한 메모가 아닙니다. 복사 후 사람이 직접 검토해 사용하세요.</p>
          <div class="review-note-variants" aria-label="review note variants">
            \${variants}
          </div>
        </div>
      \`;
    }

    function renderLeadActionIntelligenceSummary(lead) {
      const action = getLeadQueueItem(lead);
      return \`
        <div class="lead-action-intelligence priority-\${esc(action.reviewPriority)}" aria-label="Lead Action Intelligence">
          <span class="block-label">Lead Action Intelligence</span>
          <strong>\${esc(action.nextReviewActionLabel)}</strong>
          <p>\${esc(action.reasonSnippet)}</p>
          <div class="lead-action-intel-meta">
            <span>Priority \${esc(action.reviewPriority)}</span>
            <span>Confidence \${esc(action.actionConfidence)}</span>
            <span>Risk flags \${Number(action.riskCount) || 0}</span>
            <span>Missing info \${Number(action.missingInfoCount) || 0}</span>
          </div>
        </div>
      \`;
    }

    function renderLeadListReviewGate(lead) {
      const gate = buildLeadListReviewGate(lead);
      return \`
        <div class="lead-review-gate gate-\${gate.state}" aria-label="목록 품질 게이트">
          <span class="block-label">목록 품질 게이트</span>
          <strong>\${esc(gate.label)}</strong>
          <div class="lead-review-gate-items">
            \${gate.items.map((item) => \`<span>\${esc(item)}</span>\`).join('')}
          </div>
          <p>This list gate does not approve outreach; it only prioritizes human review.</p>
        </div>
      \`;
    }

    function buildReviewGateSummary(leads) {
      return (Array.isArray(leads) ? leads : []).reduce((summary, lead) => {
        const state = buildLeadListReviewGate(lead).state;
        if (Object.prototype.hasOwnProperty.call(summary, state)) summary[state] += 1;
        return summary;
      }, { ready: 0, review: 0, blocked: 0, hold: 0 });
    }

    function renderReviewGateSummary(leads) {
      const summary = buildReviewGateSummary(leads);
      return \`
        <section class="review-slice-band review-gate-summary" aria-label="목록 게이트 요약">
          <div class="review-slice-head">
            <strong>목록 게이트 요약</strong>
            <span>현재 필터 결과 기준</span>
          </div>
          <div class="review-slice-grid">
            <div class="review-slice review-slice-ready"><strong>게이트 통과 \${summary.ready}건</strong><span>검토, 검증, 근거, 데이터 공백 기준 통과</span></div>
            <div class="review-slice review-slice-risk"><strong>보강 필요 \${summary.review}건</strong><span>사람 검토 전 근거 또는 공백 확인 필요</span></div>
            <div class="review-slice review-slice-blocked"><strong>차단 \${summary.blocked}건</strong><span>반려 상태로 목록 우선순위 제외</span></div>
            <div class="review-slice review-slice-hold"><strong>보류 \${summary.hold}건</strong><span>추가 시점 또는 조건 대기</span></div>
          </div>
          <div class="review-slice-caveat">This summary does not approve outreach; it only prioritizes human review.</div>
        </section>
      \`;
    }

    function buildManagerReviewerSummary(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const session = getSessionState(leads);
      const queueItems = list
        .map((lead) => ({ lead, item: getLeadQueueItem(lead) }))
        .filter(({ item }) => item);
      const blockers = {
        evidenceMissing: 0,
        dataGaps: 0,
        riskFlags: 0,
        lowConfidence: 0,
      };
      const feedback = {
        withReviewerFeedback: 0,
        interested: 0,
        needsMoreResearch: 0,
        duplicateOrNotFit: 0,
        highOrBlockingGap: 0,
        nextActions: 0,
      };
      let readyForReviewOrAction = 0;
      let needsEvidenceOrGaps = 0;

      queueItems.forEach(({ lead, item }) => {
        const reviewerFeedback = normalizeReviewerFeedback(lead);
        const riskCodes = Array.isArray(item.riskFlags)
          ? item.riskFlags.map((flag) => String(flag && flag.code || '')).filter(Boolean)
          : [];
        const missingEvidence = getEvidenceItems(lead).length === 0
          || getSources(lead).length === 0
          || riskCodes.includes('missing_evidence')
          || riskCodes.includes('verified_without_evidence');
        const hasDataGaps = getDataGaps(lead).length > 0 || riskCodes.includes('data_gaps');
        const hasRiskFlags = (Number(item.riskCount) || 0) > 0;
        const lowConfidence = getConfidence(lead) === 'LOW' || riskCodes.includes('low_confidence');

        if (missingEvidence) blockers.evidenceMissing += 1;
        if (hasDataGaps) blockers.dataGaps += 1;
        if (hasRiskFlags) blockers.riskFlags += 1;
        if (lowConfidence) blockers.lowConfidence += 1;
        if (missingEvidence || hasDataGaps) needsEvidenceOrGaps += 1;
        if (
          item.queueLane === 'approval_candidates'
          && !hasRiskFlags
          && (Number(item.missingInfoCount) || 0) === 0
        ) {
          readyForReviewOrAction += 1;
        }
        if (reviewerFeedback.hasFeedback) feedback.withReviewerFeedback += 1;
        if (reviewerFeedback.outcomeLabel === 'interested') feedback.interested += 1;
        if (reviewerFeedback.outcomeLabel === 'needs_more_research') feedback.needsMoreResearch += 1;
        if (reviewerFeedback.outcomeLabel === 'duplicate' || reviewerFeedback.outcomeLabel === 'not_fit') feedback.duplicateOrNotFit += 1;
        if (reviewerFeedback.dataGapPriority === 'high' || reviewerFeedback.dataGapPriority === 'blocking') feedback.highOrBlockingGap += 1;
        if (reviewerFeedback.nextReviewerAction.trim()) feedback.nextActions += 1;
      });

      const nextFocus = session.nextItem && session.nextLead
        ? [
          session.nextItem.company || session.nextLead.company || '리드',
          session.nextItem.queueLaneLabel || queueLaneLabels[session.nextItem.queueLane] || session.nextItem.queueLane,
          session.nextItem.nextReviewActionLabel || 'Review lead',
        ].filter(Boolean).join(' · ')
        : '현재 필터 결과에 다음 리뷰 후보 없음';

      return {
        total: list.length,
        reviewStatusCounts: session.reviewStatusCounts,
        laneCounts: session.remainingByLane,
        blockers,
        feedback,
        readyForReviewOrAction,
        needsEvidenceOrGaps,
        nextFocus,
      };
    }

    function renderManagerReviewerSummary(leads) {
      const summary = buildManagerReviewerSummary(leads);
      const counts = summary.reviewStatusCounts;
      const lanes = summary.laneCounts;
      const blockers = summary.blockers;
      const feedback = summary.feedback;

      return \`
        <section id="managerReviewerSummary" class="review-slice-band manager-reviewer-summary" aria-label="리뷰 요약">
          <div class="review-slice-head">
            <strong>리뷰 요약</strong>
            <span>현재 필터 기준 · \${summary.total}건</span>
          </div>
          <div class="review-slice-grid">
            <div class="review-slice">
              <strong>현재 필터 \${summary.total}건</strong>
              <span>승인 \${counts.APPROVED || 0}건 / 검토 필요 \${counts.NEEDS_REVIEW || 0}건 / 대기 \${counts.NEW || 0}건</span>
            </div>
            <div class="review-slice">
              <strong>큐 상태</strong>
              <span>승인 후보 \${lanes.approval_candidates || 0}건 · 보강 필요 \${lanes.needs_evidence || 0}건 · 리스크 확인 \${lanes.risk_review || 0}건 · 낮은 우선순위 \${lanes.low_priority || 0}건</span>
            </div>
            <div class="review-slice review-slice-risk">
              <strong>주요 병목</strong>
              <span>근거 누락 \${blockers.evidenceMissing}건 · 데이터 공백 \${blockers.dataGaps}건 · 리스크 플래그 \${blockers.riskFlags}건 · 낮은 신뢰도 \${blockers.lowConfidence}건</span>
            </div>
            <div class="review-slice review-slice-ready">
              <strong>준비 \${summary.readyForReviewOrAction}건 / 보강 필요 \${summary.needsEvidenceOrGaps}건</strong>
              <span>리뷰 또는 수동 액션 준비도</span>
            </div>
            <div class="review-slice">
              <strong>리뷰어 피드백 \${feedback.withReviewerFeedback}건</strong>
              <span>관심 \${feedback.interested}건 · 추가 조사 \${feedback.needsMoreResearch}건 · 중복/부적합 \${feedback.duplicateOrNotFit}건</span>
            </div>
            <div class="review-slice review-slice-risk">
              <strong>고우선 데이터 공백 \${feedback.highOrBlockingGap}건</strong>
              <span>다음 수동 액션 기록 \${feedback.nextActions}건</span>
            </div>
          </div>
          <div class="review-slice-caveat"><strong>다음 리뷰 포커스</strong>: \${esc(summary.nextFocus)}</div>
          <div class="review-slice-caveat">Advisory only · 주의: 이 요약은 리뷰 보조용이며 CRM 할당/아웃리치 승인이 아닙니다. 프로덕션 관측 근거가 아닙니다.</div>
        </section>
      \`;
    }

    function getActiveReviewFilterEntries() {
      const entries = [];
      document.querySelectorAll('#reviewQueueFilters [data-filter-key]').forEach((select) => {
        if (!select || !select.dataset || (select.value || 'all') === 'all') return;
        const label = select.closest('label') ? select.closest('label').childNodes[0].textContent.trim() : select.dataset.filterKey;
        const option = select.options[select.selectedIndex];
        entries.push({
          key: select.dataset.filterKey,
          label,
          value: option ? option.textContent.trim() : select.value,
        });
      });
      return entries;
    }

    function getSessionState(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const laneOrder = ['approval_candidates', 'needs_evidence', 'risk_review', 'low_priority'];
      const remainingByLane = laneOrder.reduce((summary, laneId) => ({ ...summary, [laneId]: 0 }), {});
      const reviewStatusCounts = reviewStatuses.reduce((summary, status) => ({ ...summary, [status]: 0 }), {});
      const queueItems = list.map((lead) => getLeadQueueItem(lead)).filter(Boolean);

      list.forEach((lead) => {
        const status = getReviewStatus(lead);
        if (Object.prototype.hasOwnProperty.call(reviewStatusCounts, status)) reviewStatusCounts[status] += 1;
      });
      queueItems.forEach((item) => {
        if (Object.prototype.hasOwnProperty.call(remainingByLane, item.queueLane)) remainingByLane[item.queueLane] += 1;
      });

      const nextItem = queueItems[0] || null;
      const nextLead = nextItem
        ? list.find((lead) => getLeadId(lead) === nextItem.leadId) || null
        : null;

      return {
        total: list.length,
        remainingByLane,
        reviewStatusCounts,
        activeFilters: getActiveReviewFilterEntries(),
        nextItem,
        nextLead,
      };
    }

    function renderNextReviewStrip(leads) {
      const session = getSessionState(leads);
      if (!session.nextItem || !session.nextLead) {
        return \`
          <div class="next-review-strip-head">
            <div>
              <span>다음 리뷰</span>
              <strong>현재 필터에서 다음 리뷰 리드가 없습니다.</strong>
              <p>필터를 조정하거나 초기화하면 리뷰 후보가 다시 표시됩니다.</p>
            </div>
            <div class="next-review-strip-actions">
              <button class="btn btn-secondary" type="button" data-session-action="focus-session">세션 보기</button>
            </div>
          </div>
        \`;
      }

      const nextLeadId = getLeadId(session.nextLead);
      const currentReviewStatus = getReviewStatus(session.nextLead);
      const currentSalesStatus = session.nextLead.status || 'NEW';
      return \`
        <div class="next-review-strip-head">
          <div>
            <span>다음 리뷰</span>
            <strong>\${esc(session.nextItem.company || session.nextLead.company || '리드')}</strong>
            <p>\${esc(session.nextItem.nextReviewActionLabel || 'Review lead')} · \${esc(session.nextItem.reasonSnippet || '')}</p>
          </div>
          <div class="next-review-strip-actions">
            <button class="btn btn-secondary" type="button" data-session-action="focus-next" data-lead-id="\${esc(nextLeadId)}">다음 리드 보기</button>
            <button class="btn btn-secondary" type="button" data-session-action="focus-session">세션 보기</button>
          </div>
        </div>
        <div class="next-review-strip-meta">
          <span>\${esc(session.nextItem.queueLaneLabel || queueLaneLabels[session.nextItem.queueLane] || session.nextItem.queueLane)}</span>
          <span>Priority \${esc(session.nextItem.reviewPriority)}</span>
          <span>\${esc(session.nextItem.nextReviewActionLabel || 'Review lead')}</span>
          <span>\${esc(humanReviewStatusLabel(currentReviewStatus))}</span>
          <span>영업 \${esc(statusLabels[currentSalesStatus] || currentSalesStatus)}</span>
        </div>
      \`;
    }

    function renderSessionActivitySummary() {
      const lastAction = sessionActivity.lastAction || '세션 활동 없음';
      const helpHidden = shortcutHelpOpen ? '' : ' hidden';
      const helpClass = shortcutHelpOpen ? '' : ' is-hidden';
      return \`
        <section id="reviewProductivityToolkit" class="review-productivity-toolkit" aria-label="Reviewer Productivity Toolkit">
          <div class="review-productivity-head">
            <div>
              <strong>Reviewer Productivity Toolkit</strong>
              <span>복사, 포커스, 명시적 검토 변경만 현재 브라우저 세션에서 집계</span>
            </div>
            <button class="btn btn-secondary" type="button" data-shortcut-action="toggle-help" aria-expanded="\${shortcutHelpOpen ? 'true' : 'false'}" aria-controls="reviewShortcutHelp">단축키 도움말</button>
          </div>
          <div id="reviewProductivityCounts" class="review-productivity-grid">
            <span>노트 복사 \${sessionActivity.copiedNotes}건</span>
            <span>상태 변경 \${sessionActivity.reviewUpdates}건</span>
            <span>포커스 이동 \${sessionActivity.focusMoves}건</span>
            <span>필터 초기화 \${sessionActivity.filterResets}건</span>
          </div>
          <p id="reviewProductivityLastAction" class="review-productivity-last">마지막 작업: \${esc(lastAction)}</p>
          <div id="reviewShortcutHelp" class="review-shortcut-help\${helpClass}"\${helpHidden} role="region" aria-label="단축키 도움말">
            <p><kbd>n</kbd>/<kbd>j</kbd> 다음 검토 리드로 포커스</p>
            <p><kbd>q</kbd> Reviewer Action Queue로 포커스</p>
            <p><kbd>c</kbd> 보이는 리뷰 노트 복사</p>
            <p><kbd>?</kbd> 단축키 도움말 열기/닫기</p>
            <p>Shortcut keys do not change reviewStatus. 승인/검토 필요 변경은 버튼 또는 선택 상자에서만 실행됩니다.</p>
          </div>
        </section>
      \`;
    }

    function renderLeadReviewSession(leads) {
      const session = getSessionState(leads);
      const filters = session.activeFilters.length > 0
        ? session.activeFilters.map((filter) => \`<span class="review-session-filter-chip">\${esc(filter.label)}: \${esc(filter.value)}</span>\`).join('')
        : '<span class="review-session-filter-chip">필터: 전체</span>';
      const nextLeadId = session.nextLead ? getLeadId(session.nextLead) : '';
      const currentReviewStatus = session.nextLead ? getReviewStatus(session.nextLead) : '';
      const currentSalesStatus = session.nextLead ? (session.nextLead.status || 'NEW') : '';
      const nextBody = session.nextItem && session.nextLead
        ? \`
          <div class="review-session-next">
            <strong>다음 검토 리드: \${esc(session.nextItem.company || session.nextLead.company || '리드')}</strong>
            <p>\${esc(session.nextItem.nextReviewActionLabel || 'Review lead')} · \${esc(session.nextItem.reasonSnippet || '')}</p>
            <div class="review-session-meta">
              <span>\${esc(session.nextItem.queueLaneLabel || queueLaneLabels[session.nextItem.queueLane] || session.nextItem.queueLane)}</span>
              <span>Priority \${esc(session.nextItem.reviewPriority)}</span>
              <span>Risk flags \${Number(session.nextItem.riskCount) || 0}</span>
              <span>Missing info \${Number(session.nextItem.missingInfoCount) || 0}</span>
              <span>\${esc(humanReviewStatusLabel(currentReviewStatus))}</span>
              <span>영업 \${esc(statusLabels[currentSalesStatus] || currentSalesStatus)}</span>
            </div>
            \${renderReviewNoteSuggestion(session.nextLead, { compact: true })}
            <div class="review-session-actions" aria-label="빠른 검토 작업">
              <button class="btn btn-secondary" type="button" data-session-action="focus-next" data-lead-id="\${esc(nextLeadId)}">다음 검토 리드</button>
              <button class="btn" type="button" data-session-action="review-status" data-review-status="APPROVED" data-lead-id="\${esc(nextLeadId)}" \${currentReviewStatus === 'APPROVED' ? 'disabled' : ''} aria-label="다음 리드를 승인으로 변경">승인</button>
              <button class="btn btn-secondary" type="button" data-session-action="review-status" data-review-status="NEEDS_REVIEW" data-lead-id="\${esc(nextLeadId)}" \${currentReviewStatus === 'NEEDS_REVIEW' ? 'disabled' : ''} aria-label="다음 리드를 검토 필요로 변경">검토 필요</button>
            </div>
          </div>
        \`
        : '<div class="review-session-next"><strong>다음 검토 리드 없음</strong><p>현재 필터 결과에 검토할 리드가 없습니다.</p></div>';
      const noticeTone = reviewSessionNotice.tone || 'idle';
      const noticeMessage = reviewSessionNotice.message || '';

      return \`
        <section id="leadReviewSession" class="review-session-panel" aria-label="Lead Review Session" tabindex="-1">
          <div class="review-session-head">
            <strong>Lead Review Session</strong>
            <span>현재 필터 기준 · reviewStatus만 빠르게 변경</span>
          </div>
          <div class="review-session-grid">
            <div class="review-session-stat"><span>현재 큐</span><strong>\${session.total}</strong></div>
            <div class="review-session-stat"><span>승인 후보</span><strong>\${session.remainingByLane.approval_candidates}</strong></div>
            <div class="review-session-stat"><span>보강/리스크</span><strong>\${session.remainingByLane.needs_evidence + session.remainingByLane.risk_review}</strong></div>
            <div class="review-session-stat"><span>승인 / 검토 필요</span><strong>\${session.reviewStatusCounts.APPROVED} / \${session.reviewStatusCounts.NEEDS_REVIEW}</strong></div>
          </div>
          <div class="review-session-meta" aria-label="현재 필터">
            \${filters}
          </div>
          \${renderSessionActivitySummary()}
          \${nextBody}
          <div id="reviewSessionStatus" class="review-session-status is-\${esc(noticeTone)}" role="status" aria-live="polite" aria-atomic="true">\${esc(noticeMessage)}</div>
        </section>
      \`;
    }

    function renderReviewerActionQueue(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const items = list.map((lead) => getLeadQueueItem(lead)).filter(Boolean);
      const laneOrder = ['approval_candidates', 'needs_evidence', 'risk_review', 'low_priority'];
      const laneHtml = laneOrder.map((laneId) => {
        const laneItems = items.filter((item) => item.queueLane === laneId);
        const shown = laneItems.slice(0, 3).map((item) => \`
          <li>
            <b>\${esc(item.company || item.leadId || '리드')}</b>
            <em>\${esc(item.nextReviewActionLabel || '-')}</em>
            <small>Risk flags \${Number(item.riskCount) || 0} · Missing info \${Number(item.missingInfoCount) || 0}</small>
          </li>
        \`).join('');
        const extra = laneItems.length > 3 ? \`<p class="reviewer-action-empty">외 \${laneItems.length - 3}건</p>\` : '';
        return \`
          <article class="reviewer-action-lane \${esc(laneId)}">
            <strong>\${esc(queueLaneLabels[laneId])} \${laneItems.length}건</strong>
            <span>\${esc(queueLaneDescriptions[laneId])}</span>
            \${laneItems.length > 0 ? \`<ul>\${shown}</ul>\${extra}\` : '<p class="reviewer-action-empty">없음</p>'}
          </article>
        \`;
      }).join('');

      return \`
        <section id="reviewerActionQueue" class="reviewer-action-queue" aria-label="Reviewer Action Queue" tabindex="-1">
          <div class="reviewer-action-queue-head">
            <strong>Reviewer Action Queue</strong>
            <span>현재 필터 결과 기준 · 우선순위 정렬</span>
          </div>
          <div class="reviewer-action-lanes">
            \${laneHtml}
          </div>
          <div class="review-slice-caveat">Deterministic reviewer guidance only; it does not approve outreach or send messages automatically.</div>
        </section>
      \`;
    }

    function renderReviewStatusSelect(lead) {
      const current = getReviewStatus(lead);
      const opts = reviewStatuses.map(s =>
        \`<option value="\${s}" \${s === current ? 'selected' : ''}>\${esc(reviewStatusLabels[s])}</option>\`
      ).join('');
      if (!lead.id) return \`<span class="badge badge-review \${current.toLowerCase()}">\${esc(humanReviewStatusLabel(current))}</span>\`;
      return \`<select class="status-select" aria-label="\${leadAccessibleName(lead)} 검토 상태 변경" onchange="updateReviewStatus('\${esc(lead.id)}', this.value, '\${current}')">\${opts}</select>\`;
    }

    function buildReviewEvidenceSlices(leads) {
      const list = Array.isArray(leads) ? leads : [];
      const missingEvidence = list.filter((lead) => getEvidenceItems(lead).length === 0 || getSources(lead).length === 0).length;
      const dataGapLeads = list.filter((lead) => getDataGaps(lead).length > 0).length;
      const reviewReady = list.filter((lead) => (
        getEvidenceItems(lead).length > 0
        && getSources(lead).length > 0
        && getDataGaps(lead).length === 0
        && getVerificationStatus(lead) === 'verified'
        && getConfidence(lead) !== 'LOW'
      )).length;
      const guidance = missingEvidence > 0 || dataGapLeads > 0
        ? '직접 근거와 데이터 공백이 있는 리드를 먼저 보강하세요.'
        : '근거와 데이터 공백 기준으로 검토 가능한 상태입니다.';

      return {
        missingEvidence,
        dataGapLeads,
        reviewReady,
        guidance,
      };
    }

    function renderReviewEvidenceSlices(leads) {
      const slices = buildReviewEvidenceSlices(leads);
      return \`
        <section class="review-slice-band" aria-label="검토 리스크">
          <div class="review-slice-head">
            <strong>검토 리스크</strong>
            <span>\${esc(slices.guidance)}</span>
          </div>
          <div class="review-slice-grid">
            <div class="review-slice review-slice-risk"><strong>근거 누락 \${slices.missingEvidence}건</strong><span>직접 인용 또는 출처 보강 필요</span></div>
            <div class="review-slice review-slice-risk"><strong>데이터 공백 리드 \${slices.dataGapLeads}건</strong><span>의사결정자, 예산, 일정 등 확인 필요</span></div>
            <div class="review-slice review-slice-ready"><strong>검토 가능 \${slices.reviewReady}건</strong><span>근거와 검증 상태가 정리된 리드</span></div>
          </div>
          <div class="review-slice-caveat">This slice does not approve outreach; it only prioritizes human review.</div>
        </section>
      \`;
    }

    function applyReviewQueueFilters(leads) {
      return (Array.isArray(leads) ? leads : []).filter((lead) => {
        const queueItem = getLeadQueueItem(lead);
        if (reviewQueueFilters.reviewStatus !== 'all' && getReviewStatus(lead) !== reviewQueueFilters.reviewStatus) return false;
        if (reviewQueueFilters.verificationStatus !== 'all' && getVerificationStatus(lead) !== reviewQueueFilters.verificationStatus) return false;
        if (reviewQueueFilters.generationMode !== 'all' && getGenerationMode(lead) !== reviewQueueFilters.generationMode) return false;
        if (reviewQueueFilters.confidence !== 'all' && getConfidence(lead) !== reviewQueueFilters.confidence) return false;
        if (reviewQueueFilters.gateStatus !== 'all' && buildLeadListReviewGate(lead).state !== reviewQueueFilters.gateStatus) return false;
        if (reviewQueueFilters.queueLane !== 'all' && queueItem.queueLane !== reviewQueueFilters.queueLane) return false;
        if (reviewQueueFilters.nextReviewAction !== 'all' && queueItem.nextReviewAction !== reviewQueueFilters.nextReviewAction) return false;
        if (reviewQueueFilters.reviewPriority !== 'all' && queueItem.reviewPriority !== reviewQueueFilters.reviewPriority) return false;
        if (reviewQueueFilters.riskFlag === 'has' && queueItem.riskCount === 0) return false;
        if (reviewQueueFilters.riskFlag === 'none' && queueItem.riskCount > 0) return false;
        if (
          reviewQueueFilters.riskFlag !== 'all'
          && reviewQueueFilters.riskFlag !== 'has'
          && reviewQueueFilters.riskFlag !== 'none'
          && !(queueItem.riskFlags || []).some((flag) => flag.code === reviewQueueFilters.riskFlag)
        ) return false;
        if (reviewQueueFilters.missingInfo === 'has' && queueItem.missingInfoCount === 0) return false;
        if (reviewQueueFilters.missingInfo === 'none' && queueItem.missingInfoCount > 0) return false;
        const gapCount = getDataGaps(lead).length;
        if (reviewQueueFilters.dataGaps === 'has' && gapCount === 0) return false;
        if (reviewQueueFilters.dataGaps === 'none' && gapCount > 0) return false;
        return true;
      }).sort((a, b) => {
        const aOrder = Number(getLeadQueueItem(a).sortIndex);
        const bOrder = Number(getLeadQueueItem(b).sortIndex);
        return (Number.isFinite(aOrder) ? aOrder : 9999) - (Number.isFinite(bOrder) ? bOrder : 9999);
      });
    }

    function getFilteredLeads() {
      return applyReviewQueueFilters(cachedLeads);
    }

    function setReviewQueueFilter(select) {
      const key = select && select.dataset ? select.dataset.filterKey : '';
      if (!Object.prototype.hasOwnProperty.call(reviewQueueFilters, key)) return;
      reviewQueueFilters[key] = select.value || 'all';
      renderCurrentLeads();
    }

    function resetReviewQueueFilters() {
      Object.keys(reviewQueueFilters).forEach((key) => { reviewQueueFilters[key] = 'all'; });
      document.querySelectorAll('#reviewQueueFilters [data-filter-key]').forEach((select) => { select.value = 'all'; });
      recordSessionActivity('filterReset', '필터를 초기화했습니다.');
      renderCurrentLeads();
    }

    function setReviewSessionStatus(message, tone = 'idle') {
      reviewSessionNotice = { message: message || '', tone };
      const el = document.getElementById('reviewSessionStatus');
      if (!el) return;
      el.className = 'review-session-status is-' + tone;
      el.textContent = message || '';
    }

    function updateSessionActivitySummary() {
      const counts = document.getElementById('reviewProductivityCounts');
      if (counts) {
        counts.innerHTML = [
          '<span>노트 복사 ' + sessionActivity.copiedNotes + '건</span>',
          '<span>상태 변경 ' + sessionActivity.reviewUpdates + '건</span>',
          '<span>포커스 이동 ' + sessionActivity.focusMoves + '건</span>',
          '<span>필터 초기화 ' + sessionActivity.filterResets + '건</span>'
        ].join('');
      }
      const last = document.getElementById('reviewProductivityLastAction');
      if (last) last.textContent = '마지막 작업: ' + (sessionActivity.lastAction || '세션 활동 없음');
    }

    function recordSessionActivity(type, message) {
      if (type === 'noteCopied') sessionActivity.copiedNotes += 1;
      if (type === 'reviewUpdateSucceeded') sessionActivity.reviewUpdates += 1;
      if (type === 'focusNextLead' || type === 'focusQueue' || type === 'focusSession') sessionActivity.focusMoves += 1;
      if (type === 'filterReset') sessionActivity.filterResets += 1;
      sessionActivity.lastAction = message || '세션 활동 업데이트';
      updateSessionActivitySummary();
    }

    function findCachedLead(leadId) {
      return cachedLeads.find((lead) => getLeadId(lead) === String(leadId || '')) || null;
    }

    function findLeadCard(leadId) {
      return [...document.querySelectorAll('#leadsList .lead-card')]
        .find((card) => card.dataset.leadId === String(leadId || '')) || null;
    }

    function scrollToNextReviewLead(leadId) {
      const targetLeadId = leadId || (getSessionState(getFilteredLeads()).nextItem || {}).leadId;
      if (!targetLeadId) {
        setReviewSessionStatus('현재 필터에서 이동할 다음 검토 리드가 없습니다.', 'error');
        recordSessionActivity('shortcutUnavailable', '다음 검토 리드가 없습니다.');
        return;
      }
      if (currentView !== 'list') switchView('list');
      const card = findLeadCard(targetLeadId);
      if (!card) {
        setReviewSessionStatus('다음 검토 리드가 현재 필터 결과에 없습니다.', 'error');
        recordSessionActivity('shortcutUnavailable', '다음 검토 리드를 찾지 못했습니다.');
        return;
      }
      document.querySelectorAll('.lead-card.review-session-focus').forEach((item) => item.classList.remove('review-session-focus'));
      card.classList.add('review-session-focus');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.focus({ preventScroll: true });
      const lead = findCachedLead(targetLeadId);
      const message = (lead && lead.company ? lead.company : '다음 리드') + ' 카드로 이동했습니다.';
      recordSessionActivity('focusNextLead', message);
      setReviewSessionStatus(message, 'success');
    }

    function focusReviewerActionQueue() {
      const queue = document.getElementById('reviewerActionQueue');
      if (!queue) {
        setReviewSessionStatus('Reviewer Action Queue를 찾지 못했습니다.', 'error');
        recordSessionActivity('shortcutUnavailable', 'Reviewer Action Queue를 찾지 못했습니다.');
        return;
      }
      queue.focus({ preventScroll: true });
      queue.scrollIntoView({ behavior: 'smooth', block: 'start' });
      recordSessionActivity('focusQueue', 'Reviewer Action Queue로 이동했습니다.');
      setReviewSessionStatus('Reviewer Action Queue로 이동했습니다.', 'success');
    }

    function focusLeadReviewSession() {
      const session = document.getElementById('leadReviewSession');
      if (!session) {
        setReviewSessionStatus('Lead Review Session을 찾지 못했습니다.', 'error');
        recordSessionActivity('shortcutUnavailable', 'Lead Review Session을 찾지 못했습니다.');
        return;
      }
      session.focus({ preventScroll: true });
      session.scrollIntoView({ behavior: 'smooth', block: 'start' });
      recordSessionActivity('focusSession', 'Lead Review Session으로 이동했습니다.');
      setReviewSessionStatus('Lead Review Session으로 이동했습니다.', 'success');
    }

    function getReviewNoteTextElement(source) {
      const root = source && source.closest
        ? source.closest('.review-note-variant, .review-note-suggestion') || document
        : document;
      return root.querySelector('[data-review-note-text]');
    }

    function getActiveReviewNoteTextElement() {
      const active = document.activeElement;
      const activeNote = active && active.closest
        ? active.closest('.review-note-variant, .review-note-suggestion')
        : null;
      if (activeNote) {
        const activeText = activeNote.querySelector('[data-review-note-text]');
        if (activeText) return activeText;
      }
      return document.querySelector('.review-session-panel [data-review-note-text]');
    }

    function selectTextForManualCopy(target) {
      if (!target || !window.getSelection || !document.createRange) return false;
      document.querySelectorAll('.review-note-copy-target.is-manual-copy').forEach((item) => item.classList.remove('is-manual-copy'));
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      target.classList.add('is-manual-copy');
      target.focus({ preventScroll: true });
      return true;
    }

    function showCopyButtonFeedback(button, label) {
      if (!button) return;
      const original = button.dataset.originalLabel || button.textContent;
      button.dataset.originalLabel = original;
      button.textContent = label;
      clearTimeout(button._copyFeedbackTimer);
      button._copyFeedbackTimer = setTimeout(() => {
        button.textContent = button.dataset.originalLabel || original;
      }, 1600);
    }

    async function copyReviewNote(source) {
      const button = source && source.closest ? source.closest('[data-note-copy-action]') : null;
      const target = getReviewNoteTextElement(button || source) || getActiveReviewNoteTextElement();
      const text = target ? String(target.textContent || '').trim() : '';
      if (!text) {
        recordSessionActivity('copyUnavailable', '복사할 리뷰 노트를 찾지 못했습니다.');
        setReviewSessionStatus('복사할 리뷰 노트를 찾지 못했습니다.', 'error');
        return false;
      }

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          recordSessionActivity('noteCopied', '리뷰 노트를 클립보드에 복사했습니다.');
          setReviewSessionStatus('리뷰 노트를 복사했습니다. 저장하거나 전송하지 않았습니다.', 'success');
          showCopyButtonFeedback(button, '복사됨');
          return true;
        }
      } catch {
        // Fall through to the manual-copy state below.
      }

      if (selectTextForManualCopy(target)) {
        recordSessionActivity('manualCopyReady', 'Clipboard API를 사용할 수 없어 수동 복사 상태로 전환했습니다.');
        setReviewSessionStatus('Clipboard API를 사용할 수 없어 노트 텍스트를 선택했습니다. 직접 복사하세요.', 'pending');
        showCopyButtonFeedback(button, '직접 복사');
        return false;
      }

      recordSessionActivity('copyFailed', '리뷰 노트를 복사하지 못했습니다.');
      setReviewSessionStatus('리뷰 노트를 복사하지 못했습니다. 노트 텍스트를 직접 선택해 복사하세요.', 'error');
      return false;
    }

    function copyActiveReviewNote() {
      return copyReviewNote(getActiveReviewNoteTextElement());
    }

    function updateShortcutHelpVisibility() {
      const help = document.getElementById('reviewShortcutHelp');
      if (help) {
        help.hidden = !shortcutHelpOpen;
        help.classList.toggle('is-hidden', !shortcutHelpOpen);
      }
      document.querySelectorAll('[data-shortcut-action="toggle-help"]').forEach((button) => {
        button.setAttribute('aria-expanded', shortcutHelpOpen ? 'true' : 'false');
      });
    }

    function toggleShortcutHelp() {
      shortcutHelpOpen = !shortcutHelpOpen;
      updateShortcutHelpVisibility();
      recordSessionActivity('shortcutHelp', shortcutHelpOpen ? '단축키 도움말을 열었습니다.' : '단축키 도움말을 닫았습니다.');
      setReviewSessionStatus(shortcutHelpOpen ? '단축키 도움말을 열었습니다.' : '단축키 도움말을 닫았습니다.', 'success');
    }

    function isInteractiveShortcutTarget(target) {
      if (!target) return false;
      const tagName = String(target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea', 'button', 'a', 'summary'].includes(tagName)) return true;
      if (target.isContentEditable || (target.closest && target.closest('[contenteditable="true"]'))) return true;
      return !!(target.closest && target.closest('[role="button"], [role="tab"], [role="menuitem"]'));
    }

    function shouldIgnoreReviewerShortcut(event) {
      if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
      return isInteractiveShortcutTarget(event.target);
    }

    function handleReviewerShortcut(event) {
      if (shouldIgnoreReviewerShortcut(event)) return;
      const key = String(event.key || '').toLowerCase();
      if (key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        toggleShortcutHelp();
        return;
      }
      if (key === 'n' || key === 'j') {
        event.preventDefault();
        scrollToNextReviewLead();
        return;
      }
      if (key === 'q') {
        event.preventDefault();
        focusReviewerActionQueue();
        return;
      }
      if (key === 'c') {
        event.preventDefault();
        copyActiveReviewNote();
      }
    }

    function renderFilterEmptyState(extraClass) {
      const className = 'filter-empty-state' + (extraClass ? ' ' + extraClass : '');
      return \`
        <div class="\${className}" role="status" aria-live="polite" aria-atomic="true">
          <div>필터 결과가 없습니다. 필터를 초기화하거나 다른 조건을 선택하세요.</div>
          <button class="btn btn-secondary" type="button" aria-label="검토 필터 초기화" onclick="resetReviewQueueFilters()">필터 초기화</button>
        </div>
      \`;
    }

    async function updateStatus(leadId, newStatus, fromStatus) {
      if (newStatus === fromStatus) return;
      const lead = findCachedLead(leadId);
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ status: newStatus, expectedVersion: lead && lead.version })
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); loadLeads(); return; }
        loadLeads();
      } catch(e) { alert('상태 변경 실패: ' + e.message); }
    }

    async function updateReviewStatus(leadId, newStatus, fromStatus, options = {}) {
      if (newStatus === fromStatus) return;
      const lead = findCachedLead(leadId);
      const originalSalesStatus = lead ? (lead.status || 'NEW') : '';
      const label = reviewStatusLabels[newStatus] || newStatus;
      setReviewSessionStatus('검토 상태 저장 중: ' + label, 'pending');
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ reviewStatus: newStatus, expectedVersion: lead && lead.version })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          if (data.code === 'LEAD_VERSION_CONFLICT') {
            setReviewSessionStatus('다른 변경이 먼저 저장되어 최신 리드를 불러왔습니다.', 'error');
            await loadLeads({ focusLeadId: options.focusLeadId || leadId });
            return;
          }
          setReviewSessionStatus('검토 상태를 저장하지 못했습니다. 필터와 리드는 그대로 유지됩니다.', 'error');
          recordSessionActivity('reviewUpdateFailed', '검토 상태 변경 실패');
          renderCurrentLeads();
          return;
        }
        const returnedSalesStatus = data.lead ? (data.lead.status || 'NEW') : originalSalesStatus;
        const salesStatusLabel = statusLabels[returnedSalesStatus] || returnedSalesStatus || '유지';
        const message = '검토 상태만 ' + label + '(으)로 저장했습니다. 영업 상태는 ' + salesStatusLabel + ' 유지.';
        recordSessionActivity('reviewUpdateSucceeded', '검토 상태 변경: ' + label);
        setReviewSessionStatus(message, 'success');
        await loadLeads({ focusLeadId: options.focusLeadId || leadId });
      } catch(e) {
        setReviewSessionStatus('검토 상태를 저장하지 못했습니다. 네트워크 또는 로컬 저장소를 확인한 뒤 다시 시도하세요.', 'error');
        recordSessionActivity('reviewUpdateFailed', '검토 상태 변경 실패');
        renderCurrentLeads();
      }
    }

    let saveTimers = {};
    let noteMutationQueues = {};
    function scheduleNoteSave(leadId, textarea) {
      syncManualNoteControls(textarea);
      clearTimeout(saveTimers[leadId]);
      saveTimers[leadId] = setTimeout(() => saveNotes(leadId, textarea), 800);
    }

    function enqueueNoteMutation(leadId, mutation) {
      const previous = noteMutationQueues[leadId] || Promise.resolve();
      const next = previous.then(mutation);
      noteMutationQueues[leadId] = next;
      const cleanup = () => {
        if (noteMutationQueues[leadId] === next) delete noteMutationQueues[leadId];
      };
      next.then(cleanup, cleanup);
      next.catch(() => {});
      return next;
    }

    function showManualNoteIndicator(indicator, message) {
      if (!indicator) return;
      indicator.textContent = message;
      indicator.classList.add('show');
      clearTimeout(indicator._hideTimer);
      indicator._hideTimer = setTimeout(() => indicator.classList.remove('show'), 2000);
    }

    function syncManualNoteControls(textarea) {
      const section = textarea ? textarea.closest('.notes-section') : null;
      const clearButton = section ? section.querySelector('.notes-clear-btn') : null;
      if (clearButton) clearButton.disabled = !String(textarea.value || '').trim();
    }

    function saveNotes(leadId, textarea, options = {}) {
      clearTimeout(saveTimers[leadId]);
      const value = textarea.value;
      return enqueueNoteMutation(leadId, () => persistNotes(leadId, textarea, value, options));
    }

    async function persistNotes(leadId, textarea, value, options = {}) {
      const indicator = textarea.parentElement.querySelector('.notes-saved');
      const section = textarea ? textarea.closest('.notes-section') : null;
      const cachedLead = findCachedLead(leadId);
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ manualReviewNotes: value, expectedVersion: cachedLead && cachedLead.version })
        });
        const data = await res.json();
        const lead = findCachedLead(leadId);
        if (data.code === 'LEAD_VERSION_CONFLICT') {
          await loadLeads({ focusLeadId: leadId });
          throw Object.assign(new Error('manual note version conflict'), { code: data.code });
        }
        if (data.success && data.lead && lead) Object.assign(lead, data.lead);
        if (data.success && indicator) {
          const message = options.cleared || !String(value || '').trim() ? '지워짐' : '저장됨';
          showManualNoteIndicator(indicator, message);
        }
        if (data.success) updateManualReviewNoteState(section, lead);
        if (data.success) syncManualNoteControls(textarea);
      } catch (error) {
        if (error && error.code === 'LEAD_VERSION_CONFLICT') throw error;
      }
    }

    async function clearManualReviewNotes(leadId, button) {
      const section = button ? button.closest('.notes-section') : null;
      const textarea = section ? section.querySelector('.notes-textarea') : null;
      const indicator = section ? section.querySelector('.notes-saved') : null;
      if (!textarea || !String(textarea.value || '').trim()) return;
      const confirmed = window.confirm('저장된 수동 리뷰 메모를 지울까요? 생성된 리뷰 노트 제안은 그대로 유지됩니다.');
      if (!confirmed) return;
      clearTimeout(saveTimers[leadId]);
      textarea.value = '';
      button.disabled = true;
      try {
        await enqueueNoteMutation(leadId, async () => {
          const cachedLead = findCachedLead(leadId);
          try {
            const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({ manualReviewNotes: '', expectedVersion: cachedLead && cachedLead.version })
            });
            const data = await res.json();
            const lead = findCachedLead(leadId);
            if (!res.ok || !data.success) {
              if (data.code === 'LEAD_VERSION_CONFLICT') {
                await loadLeads({ focusLeadId: leadId });
                throw Object.assign(new Error('manual note version conflict'), { code: data.code });
              }
              if (lead) textarea.value = lead.manualReviewNotes || lead.notes || '';
              syncManualNoteControls(textarea);
              return;
            }
            if (data.lead && lead) Object.assign(lead, data.lead);
            showManualNoteIndicator(indicator, '지워짐');
            updateManualReviewNoteState(section, lead);
            syncManualNoteControls(textarea);
          } catch (error) {
            if (error && error.code === 'LEAD_VERSION_CONFLICT') throw error;
            const lead = findCachedLead(leadId);
            if (lead) textarea.value = lead.manualReviewNotes || lead.notes || '';
            syncManualNoteControls(textarea);
          }
        });
      } catch (error) {
        if (!error || error.code !== 'LEAD_VERSION_CONFLICT') throw error;
      }
    }

    function collectReviewerFeedbackPayload(section) {
      const payload = {};
      if (!section) return payload;
      section.querySelectorAll('[data-feedback-field]').forEach((field) => {
        payload[field.dataset.feedbackField] = field.value || '';
      });
      return payload;
    }

    async function saveReviewerFeedback(leadId, button) {
      const section = button ? button.closest('.reviewer-feedback-section') : null;
      if (!section || !leadId) return;
      button.disabled = true;
      const cachedLead = findCachedLead(leadId);
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ reviewerFeedback: collectReviewerFeedbackPayload(section), expectedVersion: cachedLead && cachedLead.version })
        });
        const data = await res.json().catch(() => ({}));
        const lead = findCachedLead(leadId);
        if (!res.ok || !data.success) {
          if (data.code === 'LEAD_VERSION_CONFLICT') {
            await loadLeads({ focusLeadId: leadId });
            return;
          }
          alert(data.message || '리뷰어 피드백 저장 실패');
          return;
        }
        if (data.lead && lead) Object.assign(lead, data.lead);
        renderCurrentLeads();
      } catch(e) {
        alert('리뷰어 피드백 저장 실패: ' + e.message);
      } finally {
        button.disabled = false;
      }
    }

    async function clearReviewerFeedback(leadId, button) {
      if (!leadId) return;
      const confirmed = window.confirm('저장된 리뷰어 피드백을 지울까요? 메타데이터 이력은 본문 없이 남습니다.');
      if (!confirmed) return;
      button.disabled = true;
      const cachedLead = findCachedLead(leadId);
      try {
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ reviewerFeedback: { clear: true }, expectedVersion: cachedLead && cachedLead.version })
        });
        const data = await res.json().catch(() => ({}));
        const lead = findCachedLead(leadId);
        if (!res.ok || !data.success) {
          if (data.code === 'LEAD_VERSION_CONFLICT') {
            await loadLeads({ focusLeadId: leadId });
            return;
          }
          alert(data.message || '리뷰어 피드백 지우기 실패');
          return;
        }
        if (data.lead && lead) Object.assign(lead, data.lead);
        renderCurrentLeads();
      } catch(e) {
        alert('리뷰어 피드백 지우기 실패: ' + e.message);
      } finally {
        button.disabled = false;
      }
    }

    async function downloadCSV() {
      try {
        const res = await fetch('/api/export/csv?profile=' + encodeURIComponent(getProfile()), { headers: authHeaders() });
        if (!res.ok) { alert('CSV 다운로드 실패'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leads-' + getProfile() + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch(e) { alert('CSV 다운로드 실패: ' + e.message); }
    }

    async function enrichLead(leadId, btn, force) {
      if (!leadId) return;
      btn.disabled = true;
      btn.textContent = '분석 중...';
      try {
        const forceParam = force ? '?force=true' : '';
        const res = await fetch('/api/leads/' + encodeURIComponent(leadId) + '/enrich' + forceParam, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() }
        });
        const data = await res.json();
        if (!data.success) { alert(data.message || '분석 실패'); btn.disabled = false; btn.textContent = '상세 분석'; return; }
        loadLeads();
      } catch(e) { alert('분석 실패: ' + e.message); btn.disabled = false; btn.textContent = '상세 분석'; }
    }

    async function batchEnrich(btn) {
      btn.disabled = true;
      btn.textContent = '일괄 분석 중...';
      const statusEl = document.getElementById('batchStatus');
      statusEl.textContent = 'AI가 리드를 심층 분석하고 있습니다...';
      statusEl.style.color = '#3498db';
      try {
        const res = await fetch('/api/leads/batch-enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ profile: getProfile() })
        });
        const data = await res.json();
        if (data.success) {
          statusEl.textContent = '완료: ' + data.enriched + '건 분석, ' + (data.failed || 0) + '건 실패, 잔여 ' + data.remaining + '건';
          statusEl.style.color = '#27ae60';
        } else {
          statusEl.textContent = data.message || '분석 실패';
          statusEl.style.color = '#e74c3c';
        }
        loadLeads();
      } catch(e) {
        statusEl.textContent = '오류: ' + e.message;
        statusEl.style.color = '#e74c3c';
      }
      btn.disabled = false;
      btn.textContent = '일괄 상세 분석';
    }

    async function loadLeads(options = {}) {
      try {
        const res = await fetch('/api/leads?profile=' + getProfile(), {headers:authHeaders()});
        const data = await res.json();
        const container = document.getElementById('leadsList');
        const summaryContainer = document.getElementById('leadsSummary');

        cacheManualReviewNotesAccess(data.manualReviewNotesAccess);

        if (!data.leads || data.leads.length === 0) {
          summaryContainer.innerHTML = '';
          const nextReviewStrip = document.getElementById('nextReviewStrip');
          if (nextReviewStrip) nextReviewStrip.innerHTML = renderNextReviewStrip([]);
          container.innerHTML = '<p style="color:#aaa;">아직 생성된 리드가 없습니다. 메인 페이지에서 보고서를 먼저 생성하세요.</p>';
          cachedLeads = [];
          cacheReviewerActionQueue(data.reviewerActionQueue);
          if (currentView === 'kanban') renderKanban([]);
          return;
        }

        cachedLeads = data.leads;
        cacheReviewerActionQueue(data.reviewerActionQueue);
        renderCurrentLeads();
        if (options.focusLeadId) {
          requestAnimationFrame(() => {
            const card = findLeadCard(options.focusLeadId);
            if (card) {
              card.classList.add('review-session-focus');
              card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }
      } catch(e) {
        document.getElementById('leadsList').innerHTML = '<p style="color:#e74c3c;">데이터 로드 실패: ' + esc(e.message) + '</p>';
      }
    }
    let currentView = 'list';
    let cachedLeads = [];
    let cachedReviewerQueue = { items: [], lanes: [] };
    let cachedQueueItemsByLeadId = {};
    let cachedManualReviewNotesAccess = null;
    let reviewSessionNotice = { message: '', tone: 'idle' };
    let shortcutHelpOpen = false;
    let sessionActivity = {
      copiedNotes: 0,
      reviewUpdates: 0,
      focusMoves: 0,
      filterResets: 0,
      lastAction: '세션 시작됨'
    };

    function renderCurrentLeads() {
      const container = document.getElementById('leadsList');
      const summaryContainer = document.getElementById('leadsSummary');
      const nextReviewStrip = document.getElementById('nextReviewStrip');
      const filteredLeads = getFilteredLeads();
      if (nextReviewStrip) nextReviewStrip.innerHTML = renderNextReviewStrip(filteredLeads);
      summaryContainer.innerHTML = renderLeadsSummary(filteredLeads, cachedLeads.length) + renderManagerReviewerSummary(filteredLeads) + renderLeadReviewSession(filteredLeads) + renderReviewerActionQueue(filteredLeads) + renderReviewGateSummary(filteredLeads) + renderReviewEvidenceSlices(filteredLeads);
      if (currentView === 'kanban') renderKanban(filteredLeads);

      if (filteredLeads.length === 0) {
        container.innerHTML = renderFilterEmptyState();
        return;
      }

      container.innerHTML = filteredLeads.map((lead, i) => \`
          <div class="lead-card \${lead.grade === 'A' ? 'grade-a' : lead.grade === 'B' ? 'grade-b' : ''}" data-lead-id="\${esc(getLeadId(lead))}" tabindex="-1">
            <div class="lead-head">
              <div class="lead-title">
                <h3>\${lead.id ? \`<a href="\${detailLink(lead.id)}" onclick="openLeadDetail('\${esc(lead.id)}', event)" style="color:inherit;text-decoration:none;">\${esc(lead.company)}</a>\` : esc(lead.company)}</h3>
                <div class="lead-subtitle">\${esc(lead.signal || lead.summary || '-')}</div>
                <div class="lead-status-row">
                  <span class="badge \${lead.grade === 'A' ? 'badge-a' : 'badge-b'}">\${esc(lead.grade)}등급</span>
                  \${renderReviewBadge(lead)}
                  <span class="select-label">검토 변경</span>
                  \${renderReviewStatusSelect(lead)}
                  <span class="select-label">영업 상태</span>
                  \${renderStatusSelect(lead)}
                  \${lead.enriched ? '<span class="badge-enriched">심층 분석 완료</span>' : ''}
                </div>
                \${renderReviewTrustBadges(lead)}
              </div>
              <div class="lead-badges">
                <span class="badge badge-a" style="background:#3498db;">\${parseInt(lead.score) || 0}점</span>
                \${lead.urgency ? \`<span class="badge" style="background:\${lead.urgency === 'HIGH' ? '#e74c3c' : '#f39c12'};color:#fff;">\${lead.urgency === 'HIGH' ? '긴급' : '보통'}</span>\` : ''}
                \${lead.eventType ? \`<span class="badge" style="background:#243547;color:#c5d5e6;">\${esc(lead.eventType)}</span>\` : ''}
              </div>
            </div>
            <div class="lead-metrics">
              <div class="lead-metric"><span class="metric-label">추천 제품</span><span class="metric-value">\${esc(lead.product || '-')}</span></div>
              <div class="lead-metric"><span class="metric-label">예상 ROI</span><span class="metric-value">\${esc(lead.roi) || '-'}</span></div>
              \${lead.buyerRole ? \`<div class="lead-metric"><span class="metric-label">예상 키맨</span><span class="metric-value">\${esc(lead.buyerRole)}</span></div>\` : ''}
              \${lead.followUpDate ? \`<div class="lead-metric"><span class="metric-label">후속 일정</span><span class="metric-value">\${esc(lead.followUpDate)}</span></div>\` : ''}
            </div>
            <div class="lead-sections">
              \${lead.whyNow ? \`<div class="lead-block"><span class="block-label">왜 지금</span><div class="block-value">\${esc(lead.whyNow)}</div></div>\` : ''}
              \${lead.urgencyReason ? \`<div class="lead-block"><span class="block-label">우선순위 근거</span><div class="block-value">\${esc(lead.urgencyReason)}</div></div>\` : ''}
              \${lead.confidenceReason ? \`<div class="lead-block"><span class="block-label">신뢰도 근거</span><div class="block-value">\${esc(lead.confidenceReason)}</div></div>\` : ''}
              \${renderLeadListReviewGate(lead)}
              \${renderLeadActionIntelligenceSummary(lead)}
              \${renderDataGapSummary(lead)}
              \${lead.assumptions && lead.assumptions.length > 0 ? \`<div class="lead-block"><span class="block-label">가정</span><div class="block-value">\${esc(lead.assumptions.join(', '))}</div></div>\` : ''}
              \${lead.scoreReason ? \`<div class="lead-block"><span class="block-label">점수 해설</span><div class="block-value">\${esc(lead.scoreReason)}</div></div>\` : ''}
              <div class="lead-block"><span class="block-label">추천 메시지</span><div class="block-value">\${esc(lead.recommendedMessage || lead.salesPitch)}</div></div>
              <div class="lead-block"><span class="block-label">시장 트렌드</span><div class="block-value">\${esc(lead.globalContext) || '-'}</div></div>
            </div>
            \${lead.enriched ? \`
            <div class="enriched-details">
              <details>
                <summary>심층 분석 상세 보기</summary>
                <div class="enriched-content">
                  \${lead.keyFigures && lead.keyFigures.length > 0 ? \`<div class="enriched-block"><h4>핵심 수치</h4><ul>\${lead.keyFigures.map(f => \`<li>\${esc(f)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.painPoints && lead.painPoints.length > 0 ? \`<div class="enriched-block"><h4>고객 과제 (정량)</h4><ul>\${lead.painPoints.map(p => \`<li>\${esc(p)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.actionItems && lead.actionItems.length > 0 ? \`<div class="enriched-block"><h4>후속 실행 항목</h4><ul>\${lead.actionItems.map(a => \`<li>\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.meddic && Object.keys(lead.meddic).length > 0 ? \`<div class="enriched-block"><h4>MEDDIC 분석</h4><ul>
                    \${lead.meddic.budget ? \`<li><strong>예산:</strong> \${esc(lead.meddic.budget)}</li>\` : ''}
                    \${lead.meddic.authority ? \`<li><strong>의사결정:</strong> \${esc(lead.meddic.authority)}</li>\` : ''}
                    \${lead.meddic.need ? \`<li><strong>핵심 니즈:</strong> \${esc(lead.meddic.need)}</li>\` : ''}
                    \${lead.meddic.timeline ? \`<li><strong>타임라인:</strong> \${esc(lead.meddic.timeline)}</li>\` : ''}
                    \${lead.meddic.decisionProcess ? \`<li><strong>구매 프로세스:</strong> \${esc(lead.meddic.decisionProcess)}</li>\` : ''}
                    \${lead.meddic.champion ? \`<li><strong>챔피언:</strong> \${esc(lead.meddic.champion)}</li>\` : ''}
                  </ul></div>\` : ''}
                  \${lead.competitive && Object.keys(lead.competitive).length > 0 ? \`<div class="enriched-block"><h4>경쟁 인텔리전스</h4><ul>
                    \${lead.competitive.currentVendor ? \`<li><strong>현재 벤더:</strong> \${esc(lead.competitive.currentVendor)}</li>\` : ''}
                    \${lead.competitive.competitors ? \`<li><strong>경쟁사:</strong> \${esc(lead.competitive.competitors)}</li>\` : ''}
                    \${lead.competitive.ourAdvantage ? \`<li><strong>우리 차별점:</strong> \${esc(lead.competitive.ourAdvantage)}</li>\` : ''}
                    \${lead.competitive.switchBarrier ? \`<li><strong>전환 장벽:</strong> \${esc(lead.competitive.switchBarrier)}</li>\` : ''}
                  </ul></div>\` : ''}
                  \${lead.buyingSignals && lead.buyingSignals.length > 0 ? \`<div class="enriched-block"><h4>구매 신호</h4><ul>\${lead.buyingSignals.map(s => \`<li>\${esc(s)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.evidence && lead.evidence.length > 0 ? \`<div class="enriched-block"><h4>근거 (Evidence)</h4><ul>\${lead.evidence.map(e => \`<li><strong>[\${esc(e.field)}]</strong> "\${esc(e.quote)}" \${e.sourceUrl ? \`<a href="\${safeUrl(e.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#3498db;font-size:11px;">출처</a>\` : ''}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.assumptions && lead.assumptions.length > 0 ? \`<div class="enriched-block" style="background:#fff3cd;border-left:3px solid #f39c12;padding:8px 12px;"><h4 style="color:#856404;">가정 (Assumptions)</h4><ul>\${lead.assumptions.map(a => \`<li style="color:#856404;">\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.enrichedAt ? \`<p style="color:#666;font-size:11px;margin-top:8px;">분석일: \${esc(lead.enrichedAt.split('T')[0])}</p>\` : ''}
                </div>
              </details>
            </div>\` : ''}
            \${lead.sources && lead.sources.length > 0 ? \`
            <div class="lead-sources">
              <details>
                <summary>출처 보기 (\${lead.sources.length}건)</summary>
                <ul>
                  \${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}
                </ul>
              </details>
            </div>\` : ''}
            \${lead.id ? \`
            <div class="notes-section">
              <details>
                <summary>수동 리뷰 메모 <span class="notes-summary-state" data-manual-note-summary-state>\${esc(getManualReviewNoteStateLabel(lead))}</span><span class="notes-saved">저장됨</span></summary>
                \${renderManualReviewNoteState(lead)}
                \${renderManualReviewNotePrivacyWarning()}
                <textarea class="notes-textarea" aria-label="수동 리뷰 메모 입력" placeholder="수동 리뷰 메모를 입력하세요..."
                  oninput="scheduleNoteSave('\${esc(lead.id)}', this)"
                  onblur="saveNotes('\${esc(lead.id)}', this)">\${esc(lead.manualReviewNotes || lead.notes || '')}</textarea>
                <div class="notes-actions">
                  <button type="button" class="notes-clear-btn" aria-label="저장된 수동 리뷰 메모 지우기"
                    onclick="clearManualReviewNotes('\${esc(lead.id)}', this)" \${(lead.manualReviewNotes || lead.notes) ? '' : 'disabled'}>지우기</button>
                </div>
              </details>
            </div>\` : ''}
            \${lead.id ? renderReviewerFeedbackControls(lead) : ''}
            <div class="lead-actions">
              \${lead.id && !lead.enriched ? \`<button class="btn-enrich" onclick="enrichLead('\${esc(lead.id)}', this)">상세 분석</button>\` : ''}
              \${lead.id && lead.enriched ? \`<button class="btn-enrich" style="opacity:0.6" onclick="enrichLead('\${esc(lead.id)}', this, true)" title="재분석">재분석</button>\` : ''}
            </div>
            <details class="lead-secondary-tools">
              <summary>제안·연습 보조 도구</summary>
              <div class="lead-actions">
                <a href="/ppt?profile=\${encodeURIComponent(getProfile())}&lead=\${i}" class="btn btn-secondary">PPT 생성</a>
                <a href="/roleplay?profile=\${encodeURIComponent(getProfile())}&lead=\${i}" class="btn btn-secondary">영업 연습</a>
              </div>
            </details>
          </div>
        \`).join('');
    }

    function getViewTabs() {
      return [...document.querySelectorAll('.view-tab[role="tab"]')];
    }

    function setRovingViewTab(tab) {
      getViewTabs().forEach((item) => {
        item.tabIndex = item === tab ? 0 : -1;
      });
    }

    function syncViewPanels(view) {
      const listPanel = document.getElementById('leadsList');
      const kanbanPanel = document.getElementById('kanbanView');
      if (listPanel) {
        listPanel.hidden = view !== 'list';
        listPanel.style.display = view === 'list' ? '' : 'none';
      }
      if (kanbanPanel) {
        kanbanPanel.hidden = view !== 'kanban';
        kanbanPanel.style.display = view === 'kanban' ? '' : 'none';
      }
    }

    function switchView(view) {
      const nextView = view === 'kanban' ? 'kanban' : 'list';
      currentView = nextView;
      document.querySelectorAll('.view-tab').forEach((t) => {
        const active = t.dataset.viewTarget === nextView;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.tabIndex = active ? 0 : -1;
      });
      syncViewPanels(nextView);
      const container = document.querySelector('.container');
      container.style.maxWidth = nextView === 'kanban' ? '1400px' : '700px';
      if (nextView === 'kanban') renderKanban(getFilteredLeads());
    }

    function isRovingTextEntryTarget(target) {
      if (!target) return false;
      const tagName = String(target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea'].includes(tagName)) return true;
      return !!(target.isContentEditable || (target.closest && target.closest('[contenteditable="true"]')));
    }

    function shouldIgnoreRovingTabKey(event) {
      if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
      if (isRovingTextEntryTarget(event.target)) return true;
      return !event.target?.closest?.('[role="tablist"]');
    }

    function moveViewTabFocus(tab) {
      if (!tab) return;
      setRovingViewTab(tab);
      tab.focus({ preventScroll: true });
    }

    function activateFocusedViewTab(tab = document.activeElement) {
      const viewTab = tab && tab.closest ? tab.closest('.view-tab[role="tab"]') : null;
      const view = viewTab ? viewTab.dataset.viewTarget : '';
      if (!view) return;
      switchView(view);
    }

    function handleViewTabRovingKeydown(event) {
      if (shouldIgnoreRovingTabKey(event)) return;
      const tabs = getViewTabs();
      if (tabs.length === 0) return;
      const currentTab = event.target?.closest?.('.view-tab[role="tab"]') || document.activeElement?.closest?.('.view-tab[role="tab"]');
      const currentIndex = Math.max(0, tabs.indexOf(currentTab));
      const lastIndex = tabs.length - 1;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        moveViewTabFocus(tabs[(currentIndex + 1) % tabs.length]);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveViewTabFocus(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        moveViewTabFocus(tabs[0]);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        moveViewTabFocus(tabs[lastIndex]);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateFocusedViewTab(currentTab || document.activeElement);
      }
    }

    function renderKanban(leads, totalBeforeFilter = cachedLeads.length) {
      const list = Array.isArray(leads) ? leads : [];
      const order = ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON','LOST'];
      const groups = {};
      order.forEach(s => groups[s] = []);
      list.forEach(l => { const s = l.status || 'NEW'; if (groups[s]) groups[s].push(l); });

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      let html = list.length === 0 && totalBeforeFilter > 0
        ? renderFilterEmptyState('kanban-empty-state')
        : '';
      html += '<div class="kanban-board" style="max-width:100%;overflow-x:auto;">';
      order.forEach(s => {
        const cards = groups[s];
        html += '<div class="kanban-col">';
        html += '<div class="kanban-col-header" style="background:' + statusColors[s] + '">' + esc(statusLabels[s]) + '<span class="kanban-col-count">(' + cards.length + ')</span></div>';
        cards.forEach(l => {
          const gate = buildLeadListReviewGate(l);
          const action = getLeadQueueItem(l);
          const fu = l.followUpDate || '';
          const isWarn = fu && fu <= today;
          html += '<div class="kanban-card' + (isWarn ? ' followup-warn' : '') + '" onclick="openLeadDetail(\\'' + esc(l.id) + '\\', event)">';
          html += '<div class="k-company">' + esc(l.company) + '</div>';
          html += '<div class="k-product">' + esc(l.product || l.summary || '-') + '</div>';
          html += '<div class="k-meta">';
          html += '<span class="k-score">' + esc(l.grade) + ' ' + l.score + '점</span>';
          if (l.estimatedValue) html += '<span class="k-value">' + l.estimatedValue.toLocaleString() + '만</span>';
          html += '</div>';
          if (fu) {
            html += '<div class="k-followup">' + (isWarn ? '⚠ ' : '') + esc(fu) + '</div>';
          }
          html += '<div class="k-review">' + esc(humanReviewStatusLabel(getReviewStatus(l))) + ' / ' + esc(verificationStatusLabels[getVerificationStatus(l)]) + '</div>';
          html += '<div class="k-gate gate-' + esc(gate.state) + '">' + esc(gate.label) + '</div>';
          html += '<div class="k-action priority-' + esc(action.reviewPriority) + '">Action: ' + esc(action.nextReviewActionLabel) + '</div>';
          html += '</div>';
        });
        if (cards.length === 0) html += '<p style="color:#555;font-size:11px;text-align:center;padding:20px 0;">없음</p>';
        html += '</div>';
      });
      html += '</div>';
      document.getElementById('kanbanView').innerHTML = html;
    }

    function renderLeadsSummary(leads, totalBeforeFilter = leads.length) {
      const total = leads.length;
      const gradeA = leads.filter(l => l.grade === 'A').length;
      const enriched = leads.filter(l => l.enriched).length;
      const needsReview = leads.filter(l => getReviewStatus(l) === 'NEEDS_REVIEW').length;
      const verified = leads.filter(l => getVerificationStatus(l) === 'verified').length;
      const dataGapCount = leads.reduce((sum, lead) => sum + getDataGaps(lead).length, 0);
      const avgScore = Math.round(leads.reduce((sum, lead) => sum + (parseInt(lead.score, 10) || 0), 0) / Math.max(1, total));
      return \`
        <div class="leads-summary">
          <div class="summary-card"><span class="label">필터 결과</span><span class="value">\${total}</span><div class="meta">전체 \${totalBeforeFilter}건 중 표시</div></div>
          <div class="summary-card"><span class="label">검토 필요</span><span class="value">\${needsReview}</span><div class="meta">사람 검토 전 상태</div></div>
          <div class="summary-card"><span class="label">검증됨</span><span class="value">\${verified}</span><div class="meta">공개 근거 확인 리드</div></div>
          <div class="summary-card"><span class="label">A등급</span><span class="value">\${gradeA}</span><div class="meta">우선 검토 후보</div></div>
          <div class="summary-card"><span class="label">평균 점수</span><span class="value">\${avgScore}</span><div class="meta">기사 신호 기준 평균</div></div>
          <div class="summary-card"><span class="label">데이터 공백</span><span class="value">\${dataGapCount}</span><div class="meta">검토 중 확인할 항목</div></div>
          <div class="summary-card"><span class="label">심층 분석 완료</span><span class="value">\${enriched}</span><div class="meta">추가 근거가 확보된 리드</div></div>
        </div>
      \`;
    }

    document.getElementById('historyLink').href = '/history?profile=' + encodeURIComponent(getProfile());
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    document.addEventListener('click', (event) => {
      const copyButton = event.target.closest('[data-note-copy-action]');
      if (copyButton) {
        event.preventDefault();
        copyReviewNote(copyButton);
        return;
      }
      const shortcutButton = event.target.closest('[data-shortcut-action="toggle-help"]');
      if (shortcutButton) {
        event.preventDefault();
        toggleShortcutHelp();
        return;
      }
      const button = event.target.closest('[data-session-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.sessionAction;
      const leadId = button.dataset.leadId || '';
      if (action === 'focus-next') {
        scrollToNextReviewLead(leadId);
        return;
      }
      if (action === 'focus-session') {
        focusLeadReviewSession();
        return;
      }
      if (action === 'review-status') {
        const nextStatus = button.dataset.reviewStatus || '';
        const lead = findCachedLead(leadId);
        if (!lead || !reviewStatuses.includes(nextStatus)) {
          setReviewSessionStatus('빠른 검토 작업을 실행할 리드를 찾지 못했습니다.', 'error');
          return;
        }
        updateReviewStatus(leadId, nextStatus, getReviewStatus(lead), { focusLeadId: leadId });
      }
    });
    const viewTabList = document.querySelector('[role="tablist"][aria-label="리드 보기 전환"]');
    if (viewTabList) viewTabList.addEventListener('keydown', handleViewTabRovingKeydown);
    document.addEventListener('keydown', handleReviewerShortcut);
    window.setReviewQueueFilter = setReviewQueueFilter;
    window.resetReviewQueueFilters = resetReviewQueueFilters;
    window.scrollToNextReviewLead = scrollToNextReviewLead;
    window.copyReviewNote = copyReviewNote;
    window.handleReviewerShortcut = handleReviewerShortcut;
    window.handleViewTabRovingKeydown = handleViewTabRovingKeydown;

    loadLeads();
  </script>
</body>
</html>`;
  return includeGeneratedReviewGuidance ? html : stripGeneratedReviewGuidanceFromLeadsPage(html);
}
