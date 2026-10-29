// Inlined CSS keeps the portfolio a dependency-free, offline single file.
export const portfolioStyles = String.raw`
:root {
  color-scheme: light;
  --ink: #172c36;
  --muted: #52666f;
  --line: #d5dfdb;
  --paper: #f4f6f2;
  --accent: #216258;
  --green: #e8f1e9;
  --amber: #fff3dc;
  --red: #faece6;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
main { max-width: 1100px; margin: auto; padding: 24px 32px 64px; }
p { margin: 8px 0; }
h1, h2, h3 { line-height: 1.3; letter-spacing: -.03em; }
h1 { font-size: clamp(30px, 4.6vw, 46px); margin: 12px 0; }
h2 { font-size: 24px; margin: 5px 0 16px; }
h3 { font-size: 23px; margin: 10px 0; }
header { padding: 12px 0 20px; border-bottom: 1px solid var(--line); }
header p { max-width: 790px; margin-bottom: 0; }
.brand { font-size: 11px; letter-spacing: .13em; color: var(--accent); font-weight: 750; }
.boundary { display: inline-block; border: 1px solid #b6cbc2; border-radius: 20px; padding: 3px 11px; font-size: 12px; }
.muted { color: var(--muted); font-size: 13px; }
.eyebrow { font-size: 11px; font-weight: 750; letter-spacing: .045em; color: var(--muted); }
.context { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; padding: 16px 0 4px; }
.context strong { display: block; font-size: 14px; }
.trust-guide { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 14px 0 22px; font-size: 12px; }
.trust-guide div { display: flex; gap: 7px; }
.trust-guide dt { font-weight: 750; color: var(--accent); }
.trust-guide dd { margin: 0; color: var(--muted); }
.overview { margin: 0 0 24px; }
.overview-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 16px; margin-bottom: 10px; }
.overview-heading h2 { font-size: 19px; margin: 0; }
.overview-heading p { margin: 0; }
.overview-grid { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; }
.overview-item { min-width: 0; border: 1px solid var(--line); border-top: 3px solid var(--accent); border-radius: 6px; padding: 13px 16px; background: white; }
.overview-item strong { font-size: 19px; display: block; margin: 4px 0; }
.overview-item > span:not(.eyebrow) { font-size: 14px; }
.overview-item p { color: var(--muted); font-size: 12px; margin: 3px 0 0; }
.step-nav { display: flex; gap: 8px; flex-wrap: wrap; margin: 0; }
button { font: inherit; cursor: pointer; border: 1px solid #b8c9c2; background: white; color: var(--ink); padding: 10px 16px; border-radius: 6px; }
button[aria-pressed="true"], .primary { background: var(--ink); color: white; border-color: var(--ink); }
button:hover:not(:disabled) { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, summary:focus-visible, textarea:focus-visible, select:focus-visible { outline: 3px solid #478e85; outline-offset: 4px; }
#revision-status { margin: 8px 0 20px; }
.comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.comparison article, .change, .record { background: white; padding: 23px; border: 1px solid var(--line); border-radius: 8px; min-width: 0; }
.comparison h3 { font-size: 34px; margin: 7px 0; }
.source { margin-top: 17px; border-top: 1px solid var(--line); padding-top: 12px; font-size: 13px; }
summary { cursor: pointer; font-weight: 650; }
blockquote { margin: 15px 0; border-left: 3px solid #b9cec2; padding: 0 13px; }
.source p, code, .source-scope dd { overflow-wrap: anywhere; }
.source-scope { margin: 14px 0; }
.source-scope div { display: grid; grid-template-columns: 85px minmax(0, 1fr); gap: 10px; padding: 6px 0; border-bottom: 1px solid #edf0eb; }
.source-scope dt { color: var(--muted); }
.source-scope dd { margin: 0; }
code { font-size: 11px; }
.decision { border-left: 4px solid var(--accent); background: var(--green); border-radius: 6px; padding: 22px 24px; margin: 18px 0; }
.decision h3 { font-size: 27px; }
.decision small { display: inline-block; font-size: 12px; font-weight: 500; vertical-align: middle; margin-left: 5px; letter-spacing: 0; }
.decision details { margin-top: 16px; font-size: 13px; }
.INSUFFICIENT_EVIDENCE { border-color: #a37622; }
.decision.INSUFFICIENT_EVIDENCE { background: var(--amber); }
.NOT_FIT { border-color: #a75648; }
.decision.NOT_FIT { background: var(--red); }
.gap { padding: 12px; background: var(--amber); margin-top: 18px; border-radius: 5px; font-size: 14px; }
.change { margin-bottom: 24px; }
.record { margin-top: 32px; }
.record label { display: block; font-size: 14px; font-weight: 650; margin: 18px 0 6px; }
.required { display: inline-block; font-size: 11px; font-weight: 500; color: var(--accent); margin-left: 5px; }
.record-completion { background: var(--paper); border-radius: 6px; padding: 14px 16px; margin-top: 20px; font-size: 13px; }
.record-completion strong { display: block; }
.record-completion progress { display: block; width: 100%; height: 6px; margin: 10px 0; accent-color: var(--accent); }
.record-completion p { color: var(--muted); margin: 0; }
textarea, select { width: 100%; font: inherit; background: #fbfcfa; color: var(--ink); border: 1px solid #a8b9b2; border-radius: 6px; padding: 12px; }
textarea { min-height: 105px; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.record-status { min-height: 28px; color: var(--accent); font-size: 14px; }
.print-note { font-size: 13px; color: var(--muted); }
footer { border-top: 1px solid var(--line); padding-top: 22px; margin-top: 30px; font-size: 12px; color: var(--muted); }
[hidden] { display: none !important; }
@media (max-width: 640px) {
  main { padding: 18px 16px 40px; }
  header { padding-top: 10px; }
  .context { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .trust-guide { display: grid; gap: 6px; }
  .trust-guide div { display: grid; grid-template-columns: 70px minmax(0, 1fr); }
  .overview-grid { grid-template-columns: 1fr; gap: 8px; }
  .overview-item { padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 1px 8px; }
  .overview-item strong { font-size: 17px; grid-column: 2; grid-row: 1; text-align: right; margin: 0; }
  .overview-item p { grid-column: 1 / -1; }
  .step-nav { gap: 6px; }
  .step-nav button { flex: 1 1 100%; text-align: left; }
  .comparison { grid-template-columns: 1fr; }
  .comparison article, .decision, .change, .record { padding: 18px; }
  .decision small { display: block; margin: 5px 0 0; }
  .source-scope div { grid-template-columns: 70px minmax(0, 1fr); }
  .actions button { width: 100%; }
}
@media print {
  body { background: white; font-size: 12px; }
  main { padding: 0; }
  .step-nav, .actions, #revision-status { display: none; }
  .revision[hidden] { display: block !important; }
  .revision { break-before: page; }
  .comparison { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .record { break-before: page; }
  details { display: block; }
  .overview-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
`;
