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

export async function getDashboardMetrics(db, profileId) {
  if (!db) return null;
  await ensureD1Schema(db);
  const isAll = !profileId || profileId === 'all';
  const where = isAll ? '' : ' WHERE profile_id = ?';
  const bind = isAll ? [] : [profileId];

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [total, gradeA, statusCounts, wonCount, recentActivity, analyticsCounts, allLogs, pipelineValue, followUpLeads] = await db.batch([
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where}`).bind(...bind),
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} grade = 'A'`).bind(...bind),
    db.prepare(`SELECT status, COUNT(*) as cnt FROM leads${where} GROUP BY status`).bind(...bind),
    db.prepare(`SELECT COUNT(*) as cnt FROM leads${where ? where + ' AND' : ' WHERE'} status = 'WON'`).bind(...bind),
    db.prepare(`SELECT sl.from_status, sl.to_status, sl.changed_at, l.company FROM status_log sl JOIN leads l ON sl.lead_id = l.id${isAll ? '' : ' WHERE l.profile_id = ?'} ORDER BY sl.changed_at DESC LIMIT 10`).bind(...bind),
    db.prepare(`SELECT type, COUNT(*) as cnt, SUM(leads_count) as total_leads FROM analytics${where ? ' WHERE profile_id = ?' : ''} GROUP BY type`).bind(...(isAll ? [] : [profileId])),
    db.prepare(`SELECT sl.lead_id, sl.from_status, sl.to_status, sl.changed_at FROM status_log sl JOIN leads l ON sl.lead_id = l.id${isAll ? '' : ' WHERE l.profile_id = ?'} ORDER BY sl.changed_at ASC`).bind(...bind),
    db.prepare(`SELECT status, SUM(estimated_value) as total_value FROM leads${where} GROUP BY status`).bind(...bind),
    db.prepare(`SELECT id, company, follow_up_date, status FROM leads${where ? where + ' AND' : ' WHERE'} follow_up_date != '' AND follow_up_date <= ? AND status NOT IN ('WON','LOST') ORDER BY follow_up_date ASC LIMIT 20`).bind(...bind, tomorrow)
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
  for (let i = 0; i < logList.length; i++) {
    const log = logList[i];
    const from = log.from_status;
    let entryTime = null;
    for (let j = i - 1; j >= 0; j--) {
      if (logList[j].lead_id === log.lead_id && logList[j].to_status === from) {
        entryTime = logList[j].changed_at;
        break;
      }
    }
    if (entryTime) {
      const days = Math.max(0, (new Date(log.changed_at) - new Date(entryTime)) / (1000 * 60 * 60 * 24));
      dwellTimes[from] = (dwellTimes[from] || 0) + days;
      dwellCounts[from] = (dwellCounts[from] || 0) + 1;
    }
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
    }, {})
  };
}
