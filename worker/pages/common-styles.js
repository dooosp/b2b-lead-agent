export function getCommonStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Malgun Gothic', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container { text-align: center; padding: 30px; width: 100%; max-width: 500px; }
    .logo { font-size: 48px; margin-bottom: 10px; }
    h1 { font-size: 24px; margin-bottom: 8px; color: #e94560; }
    .subtitle { font-size: 14px; color: #aaa; margin-bottom: 24px; }
    .input-field { display: block; width: 200px; margin: 0 auto 16px; padding: 12px 16px; border-radius: 8px; border: 1px solid #444; background: #1a1a2e; color: #fff; font-size: 14px; text-align: center; }
    .btn { display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: bold; color: #fff; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s; text-decoration: none; }
    .btn-primary { background: linear-gradient(135deg, #e94560, #c0392b); box-shadow: 0 4px 15px rgba(233,69,96,0.3); }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(233,69,96,0.5); }
    .btn-primary:disabled { background: #555; cursor: not-allowed; box-shadow: none; transform: none; }
    .btn-secondary { background: rgba(255,255,255,0.1); border: 1px solid #444; font-size: 13px; padding: 10px 16px; }
    .btn-secondary:hover { background: rgba(255,255,255,0.2); }
    .nav-buttons { margin-top: 30px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .status { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: 13px; display: none; }
    .status.success { display: block; background: rgba(39,174,96,0.2); border: 1px solid #27ae60; color: #2ecc71; }
    .status.error { display: block; background: rgba(231,76,60,0.2); border: 1px solid #e74c3c; color: #e74c3c; }
    .status.loading { display: block; background: rgba(52,152,219,0.2); border: 1px solid #3498db; color: #3498db; }
    .info { margin-top: 30px; font-size: 12px; color: #666; line-height: 1.8; }
    .back-link { color: #aaa; text-decoration: none; font-size: 13px; display: inline-block; margin-bottom: 16px; }
    .back-link:hover { color: #fff; }
    .btn-enrich { background: linear-gradient(135deg, #8e44ad, #9b59b6); font-size: 12px; padding: 6px 14px; border: none; border-radius: 6px; color: #fff; cursor: pointer; transition: all 0.3s; }
    .btn-enrich:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(142,68,173,0.4); }
    .btn-enrich:disabled { background: #555; cursor: not-allowed; transform: none; box-shadow: none; }
    .badge-enriched { background: #8e44ad; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: 6px; }
    .enriched-details { margin-top: 12px; padding-top: 12px; border-top: 1px solid #2a3a4a; }
    .enriched-details summary { color: #b39ddb; font-size: 13px; cursor: pointer; font-weight: bold; }
    .enriched-details summary:hover { color: #ce93d8; }
    .enriched-content { padding: 12px 0 0 0; }
    .enriched-block { margin-bottom: 10px; }
    .enriched-block h4 { color: #ce93d8; font-size: 13px; margin: 0 0 4px 0; }
    .enriched-block ul { list-style: none; padding: 0; margin: 0; }
    .enriched-block li { color: #ccc; font-size: 13px; padding: 2px 0; padding-left: 12px; position: relative; }
    .enriched-block li::before { content: '→'; position: absolute; left: 0; color: #8e44ad; }
    .batch-enrich-bar { background: #1e2a3a; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .batch-enrich-bar span { color: #aaa; font-size: 13px; }
    .batch-enrich-bar .btn-enrich { font-size: 13px; padding: 8px 18px; }
    @media print {
      body { background: #fff !important; color: #000 !important; display: block; min-height: auto; }
      .container { max-width: 100% !important; padding: 10px; }
      .btn, .back-link, .top-nav, .tabs, .tab-btn, .nav-buttons, .chat-input, .input-field, .status-select, .notes-section, .profile-filter, select, button, .csv-btn { display: none !important; }
      .lead-card, .history-card, .dash-card, .ss-lead-card { background: #f9f9f9 !important; border: 1px solid #ddd !important; color: #000 !important; page-break-inside: avoid; }
      .lead-card h3, .history-card h3 { color: #333 !important; }
      .lead-info p, .lead-info strong, .history-card p { color: #333 !important; }
      .badge { border: 1px solid #999; }
      .pipeline-bar { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      a { color: #333 !important; text-decoration: none !important; }
    }
  `;
}
