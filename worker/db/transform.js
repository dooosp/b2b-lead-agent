export const VALID_TRANSITIONS = {
  NEW: ['CONTACTED'],
  CONTACTED: ['MEETING'],
  MEETING: ['PROPOSAL'],
  PROPOSAL: ['NEGOTIATION'],
  NEGOTIATION: ['WON', 'LOST'],
  LOST: ['NEW'],
  WON: []
};

export function rowToLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    profileId: row.profile_id,
    source: row.source,
    status: row.status,
    company: row.company,
    summary: row.summary,
    product: row.product,
    score: Number(row.score) || 0,
    grade: row.grade,
    roi: row.roi,
    salesPitch: row.sales_pitch,
    globalContext: row.global_context,
    sources: (() => { try { return JSON.parse(row.sources || '[]'); } catch { return []; } })(),
    notes: row.notes || '',
    enriched: Number(row.enriched) || 0,
    articleBody: row.article_body || '',
    actionItems: (() => { try { return JSON.parse(row.action_items || '[]'); } catch { return []; } })(),
    keyFigures: (() => { try { return JSON.parse(row.key_figures || '[]'); } catch { return []; } })(),
    painPoints: (() => { try { return JSON.parse(row.pain_points || '[]'); } catch { return []; } })(),
    meddic: (() => { try { return JSON.parse(row.meddic || '{}'); } catch { return {}; } })(),
    competitive: (() => { try { return JSON.parse(row.competitive || '{}'); } catch { return {}; } })(),
    buyingSignals: (() => { try { return JSON.parse(row.buying_signals || '[]'); } catch { return []; } })(),
    scoreReason: row.score_reason || '',
    urgency: row.urgency || '',
    urgencyReason: row.urgency_reason || '',
    buyerRole: row.buyer_role || '',
    evidence: (() => { try { return JSON.parse(row.evidence || '[]'); } catch { return []; } })(),
    confidence: row.confidence || '',
    confidenceReason: row.confidence_reason || '',
    assumptions: (() => { try { return JSON.parse(row.assumptions || '[]'); } catch { return []; } })(),
    eventType: row.event_type || '',
    enrichedAt: row.enriched_at || null,
    followUpDate: row.follow_up_date || '',
    estimatedValue: Number(row.estimated_value) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function leadToRow(lead, profileId, source) {
  const now = new Date().toISOString();
  const id = lead.id || `${(lead.company || 'unknown').replace(/\s+/g, '_')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    profile_id: profileId,
    source: source || 'managed',
    status: lead.status || 'NEW',
    company: lead.company || '',
    summary: lead.summary || '',
    product: lead.product || '',
    score: Number(lead.score) || 0,
    grade: lead.grade || 'B',
    roi: lead.roi || '',
    sales_pitch: lead.salesPitch || '',
    global_context: lead.globalContext || '',
    sources: JSON.stringify(Array.isArray(lead.sources) ? lead.sources : []),
    notes: lead.notes || '',
    score_reason: lead.scoreReason || '',
    urgency: lead.urgency || '',
    urgency_reason: lead.urgencyReason || '',
    buyer_role: lead.buyerRole || '',
    evidence: JSON.stringify(Array.isArray(lead.evidence) ? lead.evidence : []),
    confidence: lead.confidence || '',
    confidence_reason: lead.confidenceReason || '',
    assumptions: JSON.stringify(Array.isArray(lead.assumptions) ? lead.assumptions : []),
    event_type: lead.eventType || '',
    created_at: lead.createdAt || now,
    updated_at: lead.updatedAt || now
  };
}
