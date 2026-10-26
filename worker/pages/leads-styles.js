/** List, queue, feedback and Kanban presentation, including responsive states. */
export function getLeadsStyles() {
  return `    .leads-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin:12px 0 18px; }
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
    .review-filter-bar { background:#121a24; border:1px solid #26384c; border-radius:10px; display:grid; gap:10px; grid-template-columns:repeat(2,minmax(0,1fr)); margin:0 0 14px; padding:12px; text-align:left; }
    .review-disclosure { border:1px solid #26384c; border-radius:10px; padding:10px 12px; margin:0 0 12px; text-align:left; min-width:0; }
    .review-disclosure > summary, .review-filter-advanced > summary { color:#cbd8e6; cursor:pointer; font-size:13px; padding:4px 0; }
    .review-disclosure[open] > summary { margin-bottom:12px; }
    .review-filter-advanced { grid-column:1 / -1; min-width:0; }
    .review-filter-advanced-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(128px,1fr)); gap:10px; margin-top:10px; }
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
`;
}
