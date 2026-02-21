import { ensureD1Schema } from './schema.js';
import { rowToLead, leadToRow } from './transform.js';

export async function saveLeadsBatch(db, leads, profileId, source) {
  if (!db || !leads || leads.length === 0) return;
  await ensureD1Schema(db);
  const stmt = db.prepare(
    `INSERT INTO leads (id, profile_id, source, status, company, summary, product, score, grade, roi, sales_pitch, global_context, sources, notes, score_reason, urgency, urgency_reason, buyer_role, evidence, confidence, confidence_reason, assumptions, event_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       summary=excluded.summary, product=excluded.product, score=excluded.score,
       grade=excluded.grade, roi=excluded.roi, sales_pitch=excluded.sales_pitch,
       global_context=excluded.global_context, sources=excluded.sources,
       score_reason=excluded.score_reason, urgency=excluded.urgency,
       urgency_reason=excluded.urgency_reason, buyer_role=excluded.buyer_role,
       evidence=excluded.evidence, confidence=excluded.confidence,
       confidence_reason=excluded.confidence_reason, assumptions=excluded.assumptions,
       event_type=excluded.event_type, updated_at=excluded.updated_at`
  );
  const batch = leads.map(lead => {
    const r = leadToRow(lead, profileId, source);
    return stmt.bind(r.id, r.profile_id, r.source, r.status, r.company, r.summary, r.product, r.score, r.grade, r.roi, r.sales_pitch, r.global_context, r.sources, r.notes, r.score_reason, r.urgency, r.urgency_reason, r.buyer_role, r.evidence, r.confidence, r.confidence_reason, r.assumptions, r.event_type, r.created_at, r.updated_at);
  });
  await db.batch(batch);
}

export async function getLeadsByProfile(db, profileId, options = {}) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { status, limit = 100, offset = 0 } = options;
  let sql = 'SELECT * FROM leads WHERE profile_id = ?';
  const params = [profileId];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const { results } = await db.prepare(sql).bind(...params).all();
  return (results || []).map(rowToLead);
}

export async function getAllLeads(db, options = {}) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { status, limit = 500, offset = 0 } = options;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const { results } = await db.prepare(sql).bind(...params).all();
  return (results || []).map(rowToLead);
}

export async function getLeadById(db, id) {
  if (!db) return null;
  await ensureD1Schema(db);
  const row = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  return rowToLead(row);
}

export async function updateLeadStatus(db, id, newStatus, fromStatus) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').bind(newStatus, now, id),
    db.prepare('INSERT INTO status_log (lead_id, from_status, to_status, changed_at) VALUES (?, ?, ?, ?)').bind(id, fromStatus, newStatus, now)
  ]);
  return true;
}

export async function updateLeadNotes(db, id, notes) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare('UPDATE leads SET notes = ?, updated_at = ? WHERE id = ?').bind(notes, now, id).run();
  return true;
}

export async function getStatusLogByLead(db, leadId) {
  if (!db) return [];
  await ensureD1Schema(db);
  const { results } = await db.prepare(
    'SELECT * FROM status_log WHERE lead_id = ? ORDER BY changed_at ASC'
  ).bind(leadId).all();
  return (results || []).map(r => ({
    fromStatus: r.from_status, toStatus: r.to_status, changedAt: r.changed_at
  }));
}

export async function updateLeadEnrichment(db, id, enrichData, articleBody) {
  if (!db) return false;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE leads SET
      enriched = 1,
      summary = ?, roi = ?, sales_pitch = ?, global_context = ?,
      article_body = ?, action_items = ?, key_figures = ?, pain_points = ?,
      meddic = ?, competitive = ?, buying_signals = ?,
      evidence = ?, assumptions = ?,
      enriched_at = ?, updated_at = ?
    WHERE id = ?`
  ).bind(
    enrichData.summary || '', enrichData.roi || '', enrichData.salesPitch || '', enrichData.globalContext || '',
    articleBody || '', JSON.stringify(enrichData.actionItems || []), JSON.stringify(enrichData.keyFigures || []), JSON.stringify(enrichData.painPoints || []),
    JSON.stringify(enrichData.meddic || {}), JSON.stringify(enrichData.competitive || {}), JSON.stringify(enrichData.buyingSignals || []),
    JSON.stringify(enrichData.evidence || []), JSON.stringify(enrichData.assumptions || []),
    now, now, id
  ).run();
  return true;
}

export async function logAnalyticsRun(db, data) {
  if (!db) return;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO analytics (type, profile_id, company, industry, leads_count, articles_count, elapsed_sec, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(data.type, data.profileId || null, data.company || null, data.industry || null, data.leadsCount || 0, data.articlesCount || 0, data.elapsedSec || 0, data.ipHash || null, now).run();
}

function buildExecutiveSummary(metrics) {
  const { total, gradeA, active, won, conversionRate, totalPipelineValue, followUpAlerts,
    monthlyNewCount, pipelineVelocity, winLossAnalysis, businessCaseInsights } = metrics;
  const gradeARatio = total > 0 ? Math.round((gradeA / total) * 100) : 0;
  const overdueCount = (followUpAlerts || []).filter(a => a.isOverdue).length;

  const lines = [];
  lines.push(`총 ${total}건 리드 중 ${active}건 활성, A등급 비율 ${gradeARatio}%.`);
  if (monthlyNewCount > 0) lines.push(`이번 달 신규 ${monthlyNewCount}건 유입.`);
  if (totalPipelineValue > 0) lines.push(`파이프라인 총 가치 ${totalPipelineValue.toLocaleString()}만원.`);
  if (winLossAnalysis && (winLossAnalysis.wonCount + winLossAnalysis.lostCount) > 0) {
    lines.push(`수주율 ${winLossAnalysis.winRate}% (${winLossAnalysis.wonCount}건 수주 / ${winLossAnalysis.lostCount}건 실주).`);
  }
  if (pipelineVelocity && pipelineVelocity.avgDaysToClose > 0) {
    lines.push(`평균 수주 소요일 ${pipelineVelocity.avgDaysToClose}일.`);
  }

  const warnings = [];
  if (overdueCount > 0) warnings.push(`기한 초과 ${overdueCount}건`);
  if (pipelineVelocity && pipelineVelocity.bottleneckStage) {
    warnings.push(`${pipelineVelocity.bottleneckStage} 단계 병목 (${pipelineVelocity.bottleneckDays}일)`);
  }
  if (businessCaseInsights && businessCaseInsights.enrichmentRate < 50) {
    warnings.push(`Enrichment 커버리지 ${businessCaseInsights.enrichmentRate}%`);
  }
  if (warnings.length > 0) lines.push(`⚠ 주의: ${warnings.join(', ')}.`);

  return {
    text: lines.join(' '),
    highlights: { totalCount: total, active, gradeARatio, monthlyNewCount, totalPipelineValue, conversionRate, overdueCount }
  };
}

export async function getDashboardMetrics(db, profileId) {
  if (!db) return null;
  await ensureD1Schema(db);
  const isAll = !profileId || profileId === 'all';
  const where = isAll ? '' : ' WHERE profile_id = ?';
  const bind = isAll ? [] : [profileId];

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  const [total, gradeA, statusCounts, wonCount, recentActivity, analyticsCounts, allLogs, pipelineValue, followUpLeads,
    monthlyNew, wonDetails, lostDetails, enrichCoverage, activeEnriched] = await db.batch([
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where}`).bind(...bind),
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} grade = 'A'`).bind(...bind),
    db.prepare(`SELECT status, COUNT(*) as cnt FROM leads${where} GROUP BY status`).bind(...bind),
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} status = 'WON'`).bind(...bind),
    db.prepare(`SELECT sl.from_status, sl.to_status, sl.changed_at, l.company FROM status_log sl JOIN leads l ON sl.lead_id = l.id${isAll ? '' : ' WHERE l.profile_id = ?'} ORDER BY sl.changed_at DESC LIMIT 10`).bind(...bind),
    db.prepare(`SELECT type, COUNT(*) as cnt, SUM(leads_count) as total_leads FROM analytics${where ? ' WHERE profile_id = ?' : ''} GROUP BY type`).bind(...(isAll ? [] : [profileId])),
    db.prepare(`SELECT sl.lead_id, sl.from_status, sl.to_status, sl.changed_at FROM status_log sl JOIN leads l ON sl.lead_id = l.id${isAll ? '' : ' WHERE l.profile_id = ?'} ORDER BY sl.changed_at ASC`).bind(...bind),
    db.prepare(`SELECT status, SUM(estimated_value) as total_value FROM leads${where} GROUP BY status`).bind(...bind),
    db.prepare(`SELECT id, company, follow_up_date, status FROM leads${where ? where + ' AND' : ' WHERE'} follow_up_date != '' AND follow_up_date <= ? AND status NOT IN ('WON','LOST') ORDER BY follow_up_date ASC LIMIT 20`).bind(...bind, tomorrow),
    // Q10: 이번 달 신규 리드
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} created_at >= ?`).bind(...bind, monthStart),
    // Q11: WON 리드 상세
    db.prepare(`SELECT id, grade, estimated_value, created_at, (SELECT MAX(changed_at) FROM status_log WHERE lead_id=l.id AND to_status='WON') as won_at FROM leads l${where ? where + ' AND' : ' WHERE'} status='WON'`).bind(...bind),
    // Q12: LOST 리드 상세
    db.prepare(`SELECT id, grade, estimated_value, created_at, (SELECT MAX(changed_at) FROM status_log WHERE lead_id=l.id AND to_status='LOST') as lost_at FROM leads l${where ? where + ' AND' : ' WHERE'} status='LOST'`).bind(...bind),
    // Q13: Enrichment 커버리지
    db.prepare(`SELECT COUNT(*) as total_enriched, SUM(CASE WHEN meddic != '{}' AND meddic != '' AND meddic IS NOT NULL THEN 1 ELSE 0 END) as has_meddic FROM leads${where ? where + ' AND' : ' WHERE'} enriched=1`).bind(...bind),
    // Q14: 활성 enriched 리드
    db.prepare(`SELECT pain_points, competitive, estimated_value, meddic FROM leads${where ? where + ' AND' : ' WHERE'} enriched=1 AND status NOT IN ('WON','LOST') LIMIT 200`).bind(...bind)
  ]);

  const totalCount = total.results?.[0]?.cnt || 0;
  const gradeACount = gradeA.results?.[0]?.cnt || 0;
  const wonCountVal = wonCount.results?.[0]?.cnt || 0;
  const statusDist = {};
  (statusCounts.results || []).forEach(r => { statusDist[r.status] = r.cnt; });
  const active = totalCount - (statusDist.WON || 0) - (statusDist.LOST || 0);

  const stageOrder = ['NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON'];
  const transitionCounts = {};
  (allLogs.results || []).forEach(r => {
    const key = `${r.from_status}→${r.to_status}`;
    transitionCounts[key] = (transitionCounts[key] || 0) + 1;
  });
  const stageConversions = [];
  for (let i = 0; i < stageOrder.length - 1; i++) {
    const from = stageOrder[i];
    const to = stageOrder[i + 1];
    const key = `${from}→${to}`;
    const fromCount = statusDist[from] || 0;
    const transitioned = transitionCounts[key] || 0;
    const denominator = fromCount + transitioned;
    stageConversions.push({
      from, to,
      rate: denominator > 0 ? Math.round((transitioned / denominator) * 100) : 0,
      count: transitioned
    });
  }

  const logList = allLogs.results || [];
  const dwellTimes = {};
  const dwellCounts = {};
  const lastEntryByLead = new Map();
  for (const log of logList) {
    const key = `${log.lead_id}:${log.from_status}`;
    const entryTime = lastEntryByLead.get(key);
    if (entryTime) {
      const days = Math.max(0, (new Date(log.changed_at) - new Date(entryTime)) / 86400000);
      dwellTimes[log.from_status] = (dwellTimes[log.from_status] || 0) + days;
      dwellCounts[log.from_status] = (dwellCounts[log.from_status] || 0) + 1;
    }
    lastEntryByLead.set(`${log.lead_id}:${log.to_status}`, log.changed_at);
  }
  const avgDwellDays = {};
  Object.keys(dwellTimes).forEach(s => {
    avgDwellDays[s] = dwellCounts[s] > 0 ? Math.round(dwellTimes[s] / dwellCounts[s] * 10) / 10 : 0;
  });

  const pipelineValueByStatus = {};
  let totalPipelineValue = 0;
  (pipelineValue.results || []).forEach(r => {
    const v = Number(r.total_value) || 0;
    pipelineValueByStatus[r.status] = v;
    if (r.status !== 'LOST') totalPipelineValue += v;
  });

  const followUpAlerts = (followUpLeads.results || []).map(r => ({
    id: r.id, company: r.company, followUpDate: r.follow_up_date, status: r.status,
    isOverdue: r.follow_up_date < today,
    isToday: r.follow_up_date === today
  }));

  const monthlyNewCount = monthlyNew.results?.[0]?.cnt || 0;

  // Pipeline Velocity
  const wonRows = wonDetails.results || [];
  const lostRows = lostDetails.results || [];
  let avgDaysToClose = 0, avgDaysToLoss = 0;
  if (wonRows.length > 0) {
    const totalDays = wonRows.reduce((sum, r) => {
      if (!r.won_at || !r.created_at) return sum;
      return sum + Math.max(0, (new Date(r.won_at) - new Date(r.created_at)) / 86400000);
    }, 0);
    avgDaysToClose = Math.round(totalDays / wonRows.length * 10) / 10;
  }
  if (lostRows.length > 0) {
    const totalDays = lostRows.reduce((sum, r) => {
      if (!r.lost_at || !r.created_at) return sum;
      return sum + Math.max(0, (new Date(r.lost_at) - new Date(r.created_at)) / 86400000);
    }, 0);
    avgDaysToLoss = Math.round(totalDays / lostRows.length * 10) / 10;
  }
  let bottleneckStage = null, bottleneckDays = 0;
  Object.entries(avgDwellDays).forEach(([stage, days]) => {
    if (days > bottleneckDays) { bottleneckStage = stage; bottleneckDays = days; }
  });
  const pipelineVelocity = { avgDaysToClose, avgDaysToLoss, bottleneckStage, bottleneckDays, closedCount: wonRows.length, lostCycleCount: lostRows.length };

  // Win-Loss Analysis
  const wonTotalValue = wonRows.reduce((s, r) => s + (Number(r.estimated_value) || 0), 0);
  const lostTotalValue = lostRows.reduce((s, r) => s + (Number(r.estimated_value) || 0), 0);
  const decidedCount = wonRows.length + lostRows.length;
  const wonByGrade = {};
  wonRows.forEach(r => { const g = r.grade || 'N/A'; wonByGrade[g] = (wonByGrade[g] || 0) + 1; });
  const winLossAnalysis = {
    wonCount: wonRows.length, lostCount: lostRows.length,
    winRate: decidedCount > 0 ? Math.round((wonRows.length / decidedCount) * 100) : 0,
    lossRate: decidedCount > 0 ? Math.round((lostRows.length / decidedCount) * 100) : 0,
    avgDealSizeWon: wonRows.length > 0 ? Math.round(wonTotalValue / wonRows.length) : 0,
    avgDealSizeLost: lostRows.length > 0 ? Math.round(lostTotalValue / lostRows.length) : 0,
    wonTotalValue, lostTotalValue, wonByGrade
  };

  // Business Case Insights
  const enrichRes = enrichCoverage.results?.[0] || {};
  const totalEnriched = enrichRes.total_enriched || 0;
  const enrichmentRate = totalCount > 0 ? Math.round((totalEnriched / totalCount) * 100) : 0;
  const meddicWithData = enrichRes.has_meddic || 0;
  const activeEnrichedRows = activeEnriched.results || [];
  const meddicFields = ['budget', 'authority', 'need', 'timeline', 'decisionProcess', 'champion'];
  let meddicCompleteCount = 0;
  const painFreq = {}, vendorFreq = {}, competitorFreq = {};
  let totalAddressableROI = 0;
  activeEnrichedRows.forEach(r => {
    totalAddressableROI += Number(r.estimated_value) || 0;
    // MEDDIC completeness
    try {
      const m = typeof r.meddic === 'string' ? JSON.parse(r.meddic || '{}') : (r.meddic || {});
      const filled = meddicFields.filter(f => m[f] && String(m[f]).trim().length > 0).length;
      if (filled === meddicFields.length) meddicCompleteCount++;
    } catch {}
    // Pain points frequency
    try {
      const pp = typeof r.pain_points === 'string' ? JSON.parse(r.pain_points || '[]') : (r.pain_points || []);
      (Array.isArray(pp) ? pp : []).forEach(p => { const k = String(p).trim(); if (k) painFreq[k] = (painFreq[k] || 0) + 1; });
    } catch {}
    // Competitive: current_vendor / competitors
    try {
      const c = typeof r.competitive === 'string' ? JSON.parse(r.competitive || '{}') : (r.competitive || {});
      if (c.currentVendor) { const k = String(c.currentVendor).trim(); if (k) vendorFreq[k] = (vendorFreq[k] || 0) + 1; }
      (Array.isArray(c.competitors) ? c.competitors : []).forEach(x => { const k = String(x).trim(); if (k) competitorFreq[k] = (competitorFreq[k] || 0) + 1; });
    } catch {}
  });
  const topN = (freq, n) => Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  const businessCaseInsights = {
    totalEnriched, enrichmentRate, meddicWithData, meddicCompleteCount,
    meddicCompletenessRate: totalEnriched > 0 ? Math.round((meddicCompleteCount / totalEnriched) * 100) : 0,
    totalAddressableROI, topPainPoints: topN(painFreq, 5), topVendors: topN(vendorFreq, 5), topCompetitors: topN(competitorFreq, 5)
  };

  // Executive Summary (depends on computed metrics above)
  const summaryInput = { total: totalCount, gradeA: gradeACount, active, won: wonCountVal, conversionRate: totalCount > 0 ? Math.round((wonCountVal / totalCount) * 100) : 0,
    totalPipelineValue, followUpAlerts, monthlyNewCount, pipelineVelocity, winLossAnalysis, businessCaseInsights };
  const executiveSummary = buildExecutiveSummary(summaryInput);

  return {
    total: totalCount,
    gradeA: gradeACount,
    won: wonCountVal,
    conversionRate: totalCount > 0 ? Math.round((wonCountVal / totalCount) * 100) : 0,
    active,
    statusDistribution: statusDist,
    stageConversions,
    avgDwellDays,
    totalPipelineValue,
    pipelineValueByStatus,
    followUpAlerts,
    recentActivity: (recentActivity.results || []).map(r => ({
      company: r.company, fromStatus: r.from_status, toStatus: r.to_status, changedAt: r.changed_at
    })),
    analyticsByType: (analyticsCounts.results || []).reduce((acc, r) => {
      acc[r.type] = { runs: r.cnt, totalLeads: r.total_leads }; return acc;
    }, {}),
    executiveSummary,
    pipelineVelocity,
    winLossAnalysis,
    businessCaseInsights,
    monthlyNewCount
  };
}
