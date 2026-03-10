import { ensureD1Schema } from './schema.js';

function rowToLearning(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    outcome: row.outcome || '',
    reasonCode: row.reason_code || '',
    freeformReason: row.freeform_reason || '',
    observedObjection: row.observed_objection || '',
    signalAccuracyNotes: row.signal_accuracy_notes || '',
    pitchEffectivenessNotes: row.pitch_effectiveness_notes || '',
    stageWhereLost: row.stage_where_lost || '',
    competitorIfKnown: row.competitor_if_known || '',
    lessonsLearned: row.lessons_learned || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function saveDealLearning(db, leadId, learning) {
  if (!db || !leadId || !learning || typeof learning !== 'object') return null;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  const id = learning.id || `${leadId}_${Date.now().toString(36)}`;
  await db.prepare(
    `INSERT INTO deal_learning (
      id, lead_id, outcome, reason_code, freeform_reason, observed_objection,
      signal_accuracy_notes, pitch_effectiveness_notes, stage_where_lost,
      competitor_if_known, lessons_learned, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      outcome=excluded.outcome,
      reason_code=excluded.reason_code,
      freeform_reason=excluded.freeform_reason,
      observed_objection=excluded.observed_objection,
      signal_accuracy_notes=excluded.signal_accuracy_notes,
      pitch_effectiveness_notes=excluded.pitch_effectiveness_notes,
      stage_where_lost=excluded.stage_where_lost,
      competitor_if_known=excluded.competitor_if_known,
      lessons_learned=excluded.lessons_learned,
      updated_at=excluded.updated_at`
  ).bind(
    id,
    leadId,
    learning.outcome || '',
    learning.reasonCode || '',
    learning.freeformReason || '',
    learning.observedObjection || '',
    learning.signalAccuracyNotes || '',
    learning.pitchEffectivenessNotes || '',
    learning.stageWhereLost || '',
    learning.competitorIfKnown || '',
    learning.lessonsLearned || '',
    learning.createdAt || now,
    now
  ).run();
  return { id, ...learning, leadId, updatedAt: now, createdAt: learning.createdAt || now };
}

export async function getLatestDealLearningByLead(db, leadId) {
  if (!db || !leadId) return null;
  await ensureD1Schema(db);
  const row = await db.prepare(
    'SELECT * FROM deal_learning WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1'
  ).bind(leadId).first();
  return rowToLearning(row);
}

export async function getDealLearningInsights(db, profileId) {
  if (!db) return { commonLossReasons: [], commonObjectionThemes: [], strongestWinPatterns: [] };
  await ensureD1Schema(db);
  const isAll = !profileId || profileId === 'all';
  const bind = isAll ? [] : [profileId];
  const joinClause = isAll ? '' : ' WHERE l.profile_id = ?';

  const [reasonRows, objectionRows, winRows] = await db.batch([
    db.prepare(
      `SELECT dl.reason_code, COUNT(*) as cnt
       FROM deal_learning dl
       JOIN leads l ON dl.lead_id = l.id
       ${joinClause} ${isAll ? 'WHERE' : 'AND'} dl.outcome = 'LOST'
       GROUP BY dl.reason_code
       ORDER BY cnt DESC
       LIMIT 5`
    ).bind(...bind),
    db.prepare(
      `SELECT dl.observed_objection, COUNT(*) as cnt
       FROM deal_learning dl
       JOIN leads l ON dl.lead_id = l.id
       ${joinClause} ${isAll ? 'WHERE' : 'AND'} dl.observed_objection != ''
       GROUP BY dl.observed_objection
       ORDER BY cnt DESC
       LIMIT 5`
    ).bind(...bind),
    db.prepare(
      `SELECT l.product, COUNT(*) as cnt
       FROM deal_learning dl
       JOIN leads l ON dl.lead_id = l.id
       ${joinClause} ${isAll ? 'WHERE' : 'AND'} dl.outcome = 'WON'
       GROUP BY l.product
       ORDER BY cnt DESC
       LIMIT 5`
    ).bind(...bind)
  ]);

  const toList = (rows, nameKey = 'reason_code') => (rows.results || [])
    .map((row) => ({ name: row[nameKey] || 'unknown', count: row.cnt || 0 }))
    .filter((item) => item.name && item.name !== 'unknown');

  return {
    commonLossReasons: toList(reasonRows, 'reason_code'),
    commonObjectionThemes: toList(objectionRows, 'observed_objection'),
    strongestWinPatterns: toList(winRows, 'product')
  };
}
