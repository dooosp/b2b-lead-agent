export const LEVEL1_AUTH_ROUTE_AUDIT_NON_PRODUCTION = Object.freeze([
  Object.freeze({
    surface: 'reviewer_queue_api',
    routeId: 'api.leads.list',
    method: 'GET',
    path: '/api/leads',
    manualNoteBody: 'synthetic_reviewer_only',
    generatedSuggestion: 'synthetic_reviewer_only',
    productionReady: false,
  }),
  Object.freeze({
    surface: 'history_api',
    routeId: 'api.history',
    method: 'GET',
    path: '/api/history',
    manualNoteBody: 'synthetic_reviewer_only',
    generatedSuggestion: 'never_return',
    productionReady: false,
  }),
  Object.freeze({
    surface: 'export_csv_api',
    routeId: 'api.exportCsv',
    method: 'GET',
    path: '/api/export/csv',
    manualNoteBody: 'never_export',
    generatedSuggestion: 'never_export',
    productionReady: false,
  }),
  Object.freeze({
    surface: 'enrichment_api',
    routeId: 'api.leads.enrich',
    method: 'POST',
    path: '/api/leads/:leadId/enrich',
    manualNoteBody: 'synthetic_reviewer_only',
    generatedSuggestion: 'never_return',
    productionReady: false,
  }),
  Object.freeze({
    surface: 'manual_note_write_api',
    routeId: 'api.leads.patch',
    method: 'PATCH',
    path: '/api/leads/:leadId',
    manualNoteBody: 'synthetic_reviewer_write_only',
    generatedSuggestion: 'reject_on_write',
    productionReady: false,
  }),
  Object.freeze({
    surface: 'reviewer_queue_page',
    routeId: 'page.leads',
    method: 'GET',
    path: '/leads',
    manualNoteBody: 'synthetic_reviewer_only',
    generatedSuggestion: 'synthetic_reviewer_ui_only',
    productionReady: false,
  }),
  Object.freeze({
    surface: 'lead_detail_page',
    routeId: 'page.leadDetail',
    method: 'GET',
    path: '/leads/:leadId',
    manualNoteBody: 'synthetic_reviewer_only',
    generatedSuggestion: 'synthetic_reviewer_ui_only',
    productionReady: false,
  }),
]);

function routeIds(routes = []) {
  return new Set(routes.map((route) => route.id));
}

export function auditLevel1AuthRouteCoverage({ apiRoutes = [], pageRoutes = [] } = {}) {
  const apiRouteIds = routeIds(apiRoutes);
  const pageRouteIds = routeIds(pageRoutes);
  const missingRouteIds = LEVEL1_AUTH_ROUTE_AUDIT_NON_PRODUCTION
    .filter((surface) => (
      surface.routeId.startsWith('api.')
        ? !apiRouteIds.has(surface.routeId)
        : !pageRouteIds.has(surface.routeId)
    ))
    .map((surface) => surface.routeId);

  return {
    status: missingRouteIds.length === 0 ? 'PASS_LOCAL' : 'HOLD',
    productionReady: false,
    notProductionEvidence: true,
    auditedSurfaces: LEVEL1_AUTH_ROUTE_AUDIT_NON_PRODUCTION.map((surface) => ({ ...surface })),
    missingRouteIds,
  };
}
