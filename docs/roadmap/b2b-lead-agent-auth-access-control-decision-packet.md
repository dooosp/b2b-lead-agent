# B2B Lead Agent Auth / Access Control Decision Packet

This packet is the Auth / Access Control Decision Packet after
`docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md` and
`docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md`.

It is documentation only. It does not implement auth, sessions, roles, runtime
behavior, UI behavior, API behavior, schema behavior, database behavior, CRM
integration, outreach, LLM calls, staging execution, production proof,
production deploy, D1 access, endpoint calls, log access, secret access,
customer-data access, exports, manager dashboard expansion, outcome learning,
or automation.

## Document Status

- Document status: `AUTH_ACCESS_CONTROL_DECISION_PACKET_CREATED_DOCS_ONLY`.
- Human decision:
  `PREPARE_AUTH_ACCESS_CONTROL_DECISION_PACKET_DOCS_ONLY`.
- Repository: `dooosp/b2b-lead-agent`.
- Expected repo basename: `b2b-lead-agent`.
- Default branch: `master`.
- Baseline inspected: `origin/master` at
  `2479a1a9935b85c6ba1d78bcfce6a794f6ba5104`.
- Latest related merged PR: PR #150,
  `docs: add production reviewer workflow readiness packet`.
- Controlling roadmap:
  `docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md`.
- Controlling readiness packet:
  `docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md`.
- Current productization level: `LEVEL_0_COMPLETE`.
- Target productization level: `LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`.
- Runtime/UI/API/schema/database/auth behavior changed by this packet: none.
- Staging execution performed by this packet: no.
- Production proof performed by this packet: no.
- Production deploy performed by this packet: no.
- CRM/outreach/LLM/automation action performed by this packet: no.
- Generated suggestion persistence/history/export/attribution: forbidden.

```yaml
b2b_lead_agent_auth_access_control_decision_packet:
  document_status: AUTH_ACCESS_CONTROL_DECISION_PACKET_CREATED_DOCS_ONLY
  human_decision: PREPARE_AUTH_ACCESS_CONTROL_DECISION_PACKET_DOCS_ONLY
  repository: dooosp/b2b-lead-agent
  default_branch: master
  inspected_origin_master: "2479a1a9935b85c6ba1d78bcfce6a794f6ba5104"
  controlling_roadmap: docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md
  controlling_readiness_packet: docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md
  current_productization_level: LEVEL_0_COMPLETE
  target_productization_level: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW
  auth_access_control_decision: OPTION_C_NEEDS_HUMAN_SECURITY_DECISION
  production_reviewer_workflow_ready: BLOCKED
  auth_implementation_ready: false
  auth_implementation_performed: false
  staging_execution: HOLD
  production_proof: HOLD
  production_deploy: HOLD
  crm_outreach_llm_automation: FORBIDDEN
  next_recommended_cycle: PRIVACY_RETENTION_DECISION_PACKET_DOCS_ONLY
  next_decision: HOLD
```

## 1. Purpose

Productization Roadmap v1 sets the current productization level to
`LEVEL_0_COMPLETE` and the target productization level to
`LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`. The Production Reviewer Workflow
Readiness Packet then concludes that Level 1 remains blocked by unresolved
auth/access-control, production D1, privacy/retention, rollback/backout,
observability/evidence, and production proof decisions.

This packet prepares the auth/access-control decision layer only. It defines
the required production role model, protected fields, read/write boundaries,
permission matrix, provider options, denial test plan, and unresolved
security/privacy/product decisions for a future implementation plan.

This packet is not:

- auth implementation;
- access-control behavior change;
- production execution;
- production proof;
- staging execution;
- CRM, outreach, LLM, or automation work;
- manager dashboard expansion;
- export/API expansion;
- permission to use production or staging systems.

Current status remains `HOLD`.

## 2. Repo And Auth-Surface Inventory

Audited source records:

| Area | Repo-visible finding |
| --- | --- |
| Productization Roadmap v1 | `docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md` sets `CURRENT_PRODUCTIZATION_LEVEL: LEVEL_0_COMPLETE`, `NEXT_TARGET_LEVEL: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`, and recommends the readiness packet followed by auth/access-control planning. |
| Production Reviewer Workflow Readiness Packet | `docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md` concludes `PRODUCTION_REVIEWER_WORKFLOW_READY: BLOCKED` and recommends `AUTH_ACCESS_CONTROL_DECISION_PACKET_DOCS_ONLY`. |
| Lead Action Intelligence v1 | `docs/lead-action-intelligence-v1.md` defines deterministic reviewer guidance from existing LeadBrief fields only. It is not LLM, outreach, CRM mutation, or automation. |
| Reviewer Action Queue | `docs/lead-action-intelligence-v1.md` and `worker/lib/lead-action-intelligence.js` define queue lanes, deterministic sorting, compact summaries, and copy-only note suggestions. |
| Lead Review Session | `/leads` page code and tests cover current-filter progress, lane counts, next-lead focus, and explicit review-status actions. |
| Manual Review Notes v1 | `docs/roadmap/manual-review-notes-v1-non-production-cycle-closeout.md` records local/test `SHIP`: save/read/edit/clear, note timestamp, fixed generic author label, metadata-only history, privacy warning, and C2 local/test role stub. |
| Local fake-D1 evidence | `docs/roadmap/manual-review-notes-v1-local-fake-d1-dry-run-evidence.md` records local/fake-D1 evidence only. It is not staging evidence or production proof. |
| C2 local/test role stub | `worker/lib/manual-review-notes-access.js` implements only the opt-in local/test role stub when `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` and `X-Manual-Review-Notes-Local-Test-Role` is present. |
| C2 local/test tests | `worker/tests/manual-review-notes.test.mjs` covers reviewer read/write, manager/API/missing/unknown protected-field omission and write denial, CSV filtering, generated suggestion exclusion, metadata-only history, and warning-only privacy behavior. |
| Access-control plan | `docs/roadmap/manual-review-notes-v1-access-control-plan.md` keeps C2 local/test only and keeps C3-C5 real access controls, auth/session, production roles, manager visibility, and export/API expansion on `HOLD`. |
| Access / visibility / export packet | `docs/roadmap/manual-review-notes-v1-access-visibility-export-decision-packet.md` keeps manager visibility, export expansion, API exposure expansion, full metadata event visibility, and generated suggestion export/persistence/history/attribution unapproved. |
| Retention/privacy packet | `docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md` keeps retention enforcement, purge/delete jobs, redaction, automated PII detection, export/manager visibility expansion, and production saved-note use unapproved. |
| Production readiness/proof/rollback docs | The production readiness gap, production proof, production D1 migration, and rollback/backout plans are docs-only and not approved for execution. |
| Current PR train | `docs/roadmap/current-pr-train.md` records the Manual Review Notes v1 and B2B Lead Agent productization train. |
| Package scripts | `package.json` exposes `check:naming`, `check:schema`, `eval:lead-quality`, `test:e2e:local`, `test:root`, `test:unit`, `test:contract`, `test:worker`, and `test`. |
| CI workflows | `.github/workflows/ci.yml` runs schema, eval, tests, and local-only Worker E2E. `.github/workflows/validate-naming.yml` runs naming plus worker tests. |
| Relevant routes/pages | `worker/routes/pages.js`, `worker/routes/api.js`, `worker/pages/leads.js`, `worker/pages/lead-detail.js`, `worker/api/leads.js`, `worker/api/serializers/lead-csv.js`. |
| Relevant schema/data files | `worker/schema.sql`, `worker/db/schema.js`, `worker/db/leads.js`, `worker/db/transform.js`, `worker/lib/manual-review-notes-access.js`. |
| GitHub PR state | Pre-edit GitHub inspection found no open PRs. Recently merged related PRs include #147, #148, #149, and #150. |

## 3. Current Auth State

Current repo-visible auth/access-control state:

- C2 local/test role stub exists.
- C2 local/test role stub is not real production auth.
- C2 local/test role stub is opt-in only through
  `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` plus
  `X-Manual-Review-Notes-Local-Test-Role`.
- C2 local/test `reviewer` can read and write manual review notes locally.
- C2 local/test `manager`, `api`, missing role, and unknown role omit protected
  manual note fields and cannot write manual notes when the stub is enabled.
- C2 local/test access metadata explicitly reports
  `realAuthImplemented: false` and `productionReady: false`.
- Current manual note write behavior remains local/test only and uses the fixed
  generic `manual_reviewer` label, not real identity.
- Generated suggestions remain copy-only helper text and are not saved as
  manual notes.
- Generated suggestion persistence attempts are rejected or ignored by current
  local/test persistence paths.
- No production auth proof exists.
- No real identity/session provider is confirmed.
- No production permission matrix is finalized.
- No production role membership source is confirmed.
- No audit-grade attribution is implemented.
- No manager visibility expansion, export expansion, API expansion, CRM
  integration, outreach, LLM, outcome learning, or automation is approved.

## 4. Required Roles

The following role model is proposed for decision planning. It is not
implemented in production.

### Reviewer

- Purpose: human reviewer who works the production reviewer workflow.
- Expected users/systems: internal human reviewers only.
- Allowed read surfaces after future approval: `/leads`, lead detail,
  Reviewer Action Queue, Lead Review Session, Lead Action Intelligence v1,
  current manual note text, note-specific timestamp, generic or future approved
  author label, metadata-only history summary, privacy warning, and copy-only
  generated suggestion helper.
- Allowed write surfaces after future approval: manual note save/edit/clear and
  existing explicit review-status actions, only under real auth and approved
  production proof.
- Forbidden surfaces: generated suggestion persistence/history/export/
  attribution, CRM mutation, outreach send, automation execution, and any
  production action outside a future approved proof.
- Protected fields: `manualReviewNotes`, `manualReviewNotesUpdatedAt`,
  `manualReviewNotesAuthorLabel`, `manual_review_note_events` summary, any
  future CRM/outreach/outcome fields, and private lead/customer/person fields.
- Audit requirements: at minimum, role decision, authenticated session,
  unauthorized denial tests, evidence redaction, and privacy/retention policy.
- Unresolved decisions: provider, identity source, session lifetime, whether to
  store real identity, note visibility scope, and production proof plan.
- Implementation exists today: local/test C2 stub only.
- Production proof exists today: no.

### Manager

- Purpose: manager or lead reviewer who may need aggregate queue health and
  coaching context.
- Expected users/systems: internal managers, not broad API consumers.
- Allowed read surfaces after future approval: non-protected aggregate workflow
  summaries only by default; any manual note text or metadata visibility needs
  an explicit manager visibility decision.
- Allowed write surfaces: none assumed for manual notes.
- Forbidden surfaces: manual note write unless separately approved, generated
  suggestion persistence/history/export/attribution, CRM mutation, outreach
  send, and automation execution.
- Protected fields: same manual note fields as reviewer, with default
  `OMIT_FIELD` posture until a future manager policy changes it.
- Audit requirements: manager role source, allow/deny tests, export tests,
  field omission tests, privacy/retention approval for any note visibility.
- Unresolved decisions: whether managers can see current note text, metadata
  summary, full metadata events, exports, or no manual note data at all.
- Implementation exists today: local/test C2 stub denial/omission only.
- Production proof exists today: no.

### Admin

- Purpose: future operational/security administration role.
- Expected users/systems: production owner, security owner, or support admin if
  explicitly approved.
- Allowed read surfaces: not assumed. Admin access must not become a bypass for
  protected manual note fields.
- Allowed write surfaces: not assumed. Admin actions require separate policy,
  privacy, evidence, and rollback decisions.
- Forbidden surfaces: generated suggestion saved-note treatment, CRM mutation,
  outreach send, and automation execution unless a later explicit cycle
  approves a narrower action.
- Protected fields: all manual note fields, identity fields, CRM-linked fields,
  outreach-linked fields, outcome-learning fields, and private lead/customer/
  person fields.
- Audit requirements: strongest role provenance, least-privilege policy,
  tamper-resistant audit expectations if selected, redaction, and incident
  owner.
- Unresolved decisions: whether admin exists at all, what admin can see, what
  admin can change, and whether admin audit logs are required.
- Implementation exists today: no.
- Production proof exists today: no.

### API Client

- Purpose: future service-to-service or approved integration access.
- Expected users/systems: explicitly registered internal clients or future
  CRM/reporting integration services.
- Allowed read surfaces: not assumed for protected fields. API clients may read
  only explicitly allowlisted non-protected fields until policy changes.
- Allowed write surfaces: none assumed for manual notes.
- Forbidden surfaces: manual note write by default, generated suggestion
  persistence/history/export/attribution, CRM mutation, outreach send, and
  automation execution.
- Protected fields: same as reviewer/manager plus any integration tokens,
  external IDs, CRM ownership fields, outreach recipients, and outcome labels.
- Audit requirements: token/session issuance, scope, rotation, revocation,
  allowlisted fields, unauthorized tests, and redacted evidence.
- Unresolved decisions: API token vs session model, scopes, field allowlist,
  export behavior, CRM read-only compatibility, and production proof.
- Implementation exists today: local/test C2 `api` value exists only as a
  protected-field omission/write-denial stub, not production API-client auth.
- Production proof exists today: no.

### Unauthenticated / Missing Role

- Purpose: absence of a valid authenticated role.
- Expected users/systems: browser/API requests with no valid identity or role.
- Allowed read surfaces: none for protected reviewer workflow.
- Allowed write surfaces: none.
- Forbidden surfaces: all protected fields, manual note writes, exports, API
  access, CRM, outreach, LLM, outcome learning, and automation.
- Protected fields: all manual note, identity, CRM, outreach, outcome, and
  private lead/customer/person fields.
- Audit requirements: safe denial/omission behavior without leaking secrets,
  note text, generated suggestions as saved data, or role internals.
- Unresolved decisions: exact UI/API status codes and redirect/error shape.
- Implementation exists today: local/test C2 treats missing role as no role for
  protected manual note fields when the stub is enabled.
- Production proof exists today: no.

### Unknown / Unsupported Role

- Purpose: invalid, unsupported, or misspelled role.
- Expected users/systems: bad headers, stale clients, unsupported identities.
- Allowed read surfaces: none for protected reviewer workflow.
- Allowed write surfaces: none.
- Forbidden surfaces: all protected fields and all external/action surfaces.
- Protected fields: all manual note, identity, CRM, outreach, outcome, and
  private lead/customer/person fields.
- Audit requirements: fail closed, deny writes, omit protected fields where
  selected, and avoid logging sensitive payloads.
- Unresolved decisions: whether unknown roles should get `403`, `401`, safe
  field omission, or a UI auth-required page by surface.
- Implementation exists today: local/test C2 normalizes unknown role to `none`
  for protected manual note fields when the stub is enabled.
- Production proof exists today: no.

## 5. Required Permission Matrix

Classification values:

- `ALLOW`: proposed access may be allowed after the selected auth/provider,
  privacy, production D1, proof, and rollback gates are approved.
- `DENY`: access should be denied.
- `OMIT_FIELD`: field should be removed from payload/export rather than shown.
- `READ_ONLY`: read-only access; no mutation.
- `WRITE_ALLOWED`: proposed write access, still blocked until real auth and
  production proof exist.
- `FUTURE_DECISION_REQUIRED`: repo-visible evidence is insufficient for a
  production policy or implementation plan.
- `FORBIDDEN`: not allowed by this packet or current roadmap boundaries.
- `NOT_APPLICABLE`: surface does not apply to the role.

This matrix is a decision recommendation, not current production behavior.
Current production auth/access-control implementation remains absent.

| Workflow surface | Reviewer | Manager | Admin | API client | Unauthenticated / missing role | Unknown / unsupported role |
| --- | --- | --- | --- | --- | --- | --- |
| `/leads` list | `ALLOW` | `READ_ONLY` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| Lead detail | `ALLOW` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| Reviewer Action Queue | `ALLOW` | `READ_ONLY` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| Lead Review Session | `ALLOW` | `READ_ONLY` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| Lead Action Intelligence v1 guidance | `READ_ONLY` | `READ_ONLY` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| Manual Review Notes v1 read | `ALLOW` | `OMIT_FIELD` | `FUTURE_DECISION_REQUIRED` | `OMIT_FIELD` | `OMIT_FIELD` | `OMIT_FIELD` |
| Manual Review Notes v1 save | `WRITE_ALLOWED` | `DENY` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` | `DENY` |
| Manual Review Notes v1 edit/update | `WRITE_ALLOWED` | `DENY` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` | `DENY` |
| Manual Review Notes v1 clear/delete-as-empty-string | `WRITE_ALLOWED` | `DENY` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` | `DENY` |
| `manualReviewNotesUpdatedAt` | `READ_ONLY` | `OMIT_FIELD` | `FUTURE_DECISION_REQUIRED` | `OMIT_FIELD` | `OMIT_FIELD` | `OMIT_FIELD` |
| `manualReviewNotesAuthorLabel` | `READ_ONLY` | `OMIT_FIELD` | `FUTURE_DECISION_REQUIRED` | `OMIT_FIELD` | `OMIT_FIELD` | `OMIT_FIELD` |
| `manual_review_note_events` metadata-only history | `READ_ONLY` | `OMIT_FIELD` | `FUTURE_DECISION_REQUIRED` | `OMIT_FIELD` | `OMIT_FIELD` | `OMIT_FIELD` |
| Privacy warning | `ALLOW` | `READ_ONLY` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| Generated reviewer note suggestion helper | `READ_ONLY` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| Generated suggestion copy action | `ALLOW` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `NOT_APPLICABLE` | `DENY` | `DENY` |
| Generated suggestion persistence | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` |
| Generated suggestion history/export/attribution | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` |
| Manager dashboard | `NOT_APPLICABLE` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| Exports | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| API access | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| CRM read-only mapping | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |
| CRM mutation | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` |
| Outreach draft | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` |
| Outreach send | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` |
| Outcome learning | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` |
| Automation policy engine | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `FUTURE_DECISION_REQUIRED` | `DENY` | `DENY` |

Matrix notes:

- Reviewer `ALLOW` and `WRITE_ALLOWED` cells are future production policy
  candidates only. They do not mean production access exists today.
- Manager `READ_ONLY` cells exclude protected manual note fields unless a later
  manager visibility decision changes that.
- Admin cells are intentionally not blanket-allowed. Admin is not implemented
  and must be explicitly scoped.
- API client cells remain future-gated because no production API-client role,
  scopes, token model, or protected field allowlist is finalized.
- `FORBIDDEN` generated-suggestion cells preserve the Issue #113 / PR #114
  copy-only boundary and the Manual Review Notes v1 non-production closeout.
- Outreach draft/send, CRM mutation, outcome learning, and automation execution
  remain forbidden by this packet.

## 6. Protected Field Policy

Protected current fields:

- `manualReviewNotes`;
- `notes` when it backs or aliases manual notes;
- `manualReviewNotesProvenance`;
- `manualReviewNotesUpdatedAt`;
- `manualReviewNotesAuthorLabel`;
- `manual_review_note_events`;
- API summary fields derived from `manual_review_note_events`:
  `manualReviewNotesHistoryEventCount`,
  `manualReviewNotesHistoryLastEventType`,
  `manualReviewNotesHistoryLastEventAt`, and
  `manualReviewNotesHistoryLastAuthorLabel`;
- generated reviewer note suggestion text and template text when it could be
  mistaken for saved note content;
- current CSV `memo` compatibility content when it includes manual notes.

Protected future fields:

- any CRM-linked account, contact, owner, opportunity, lifecycle, or external ID
  fields;
- any outreach-linked recipient, message, consent, suppression, draft, send, or
  delivery fields;
- any outcome-learning labels, win/loss facts, conversion facts, scoring
  feedback, or reviewer performance metrics;
- private lead/customer/person fields, including contact-like identifiers,
  buyer role, evidence details, assumptions, article body, private URLs, or
  sensitive sales context if present in future data.

Visibility rules:

- Reviewer visibility may be approved only after real auth, privacy/retention,
  production D1, proof, and rollback gates are satisfied.
- Manager visibility defaults to `OMIT_FIELD` for manual note text and metadata.
- API-client visibility defaults to `OMIT_FIELD` for protected manual note
  fields unless an explicit API allowlist is approved.
- Unauthenticated, missing, unknown, and unsupported roles must not receive
  protected fields.
- Generated suggestion text must not become persisted manual note text.
- Generated suggestion text must not appear in manual note history.
- Generated suggestion text must not be exported as a human-authored note.
- Generated suggestion text must not receive reviewer attribution.
- Manual note body history must not be expanded without a privacy/retention
  decision.
- Manager, export, and API expansion remains blocked until explicit role,
  protected-field, privacy, and evidence decisions exist.

## 7. Write Boundary Policy

Manual note writes:

- Reviewer manual note writes may be considered for production only after real
  auth, production role selection, privacy/retention approval, production D1
  decision, rollback/backout approval, and production proof approval.
- Manual note save means saving human-entered `manualReviewNotes`.
- Manual note edit/update means saving a changed human-entered
  `manualReviewNotes` value.
- Manual note clear/delete means setting `manualReviewNotes: ""`; it clears the
  current saved value, not necessarily retained metadata unless a future
  privacy/retention policy says so.
- Metadata-only event recording may record only approved create/edit/clear
  metadata and must not include old note text, new note text, generated
  suggestion text, real identity, secrets, customer payloads, or private
  payloads.

Non-reviewer writes:

- Manager write behavior is not assumed.
- API client write behavior is not assumed.
- Admin write behavior is not assumed.
- Unknown, missing, and unauthenticated write behavior is `DENY`.

External/action writes:

- CRM mutation is forbidden.
- Outreach send is forbidden.
- Outreach draft implementation is forbidden by this packet.
- Automation execution is forbidden.
- Outcome learning implementation is forbidden.
- Generated suggestion persistence, history, export, retention, and attribution
  are forbidden.

## 8. Read Boundary Policy

Reviewer:

- Current local/test evidence supports reviewer read/write only inside the C2
  opt-in local/test role stub.
- Proposed production reviewer read access is limited to reviewer workflow
  surfaces and protected fields selected by a future approved policy.
- Production reviewer read access is not implemented and not proven.

Manager:

- Current local/test evidence supports omission of protected manual note fields
  for the C2 manager role.
- Proposed production manager read access defaults to non-protected summaries
  only.
- Manager visibility to note text, metadata summary, full metadata events,
  exports, or APIs remains future-gated.

Admin:

- No current admin role implementation exists.
- Admin read access must not be assumed as a blanket bypass.
- Any admin visibility requires a separate security/privacy/audit decision.

API client:

- Current local/test C2 `api` behavior omits protected manual note fields.
- Production API-client access requires a future provider/scope/token decision.
- Protected manual note fields default to `OMIT_FIELD`.

Unauthenticated / missing role:

- Production protected workflow access should be denied.
- Current local/test C2 missing role receives protected fields omitted when the
  stub is enabled.

Unknown / unsupported role:

- Production protected workflow access should fail closed.
- Current local/test C2 unknown role is normalized to no role for protected
  manual note fields.

Forbidden read surfaces:

- Staging or production D1 rows.
- Staging or production endpoints.
- Staging or production logs/secrets.
- Customer data.
- CRM systems.
- Outreach systems.
- LLM APIs.
- Generated suggestion saved-note history/export/attribution records.

## 9. Identity / Attribution Policy

Current state:

- `manualReviewNotesAuthorLabel` is a fixed generic local/test label.
- The only current allowed value is `manual_reviewer`.
- `manual_reviewer` is non-PII.
- `manual_reviewer` is not a real reviewer identity.
- `manual_reviewer` is not an authenticated identity.
- `manual_reviewer` is not a display name, email, or audit actor.
- Real authenticated reviewer identity is not implemented.
- Audit-grade attribution is not claimed.

Future production policy:

- Production identity attribution requires a future human security decision.
- Storing real user identity requires privacy, retention, legal, and evidence
  review.
- If real identity is stored, role membership, display labels, retention,
  deletion, exports, logs, evidence packets, screenshots, and support access
  must be decided before implementation.
- Generated suggestions must never receive human attribution unless a human
  separately writes final text into `manualReviewNotes` under an approved
  future policy.

## 10. Session / Provider Decision

No production provider is selected by this packet.

| Option | Benefits | Risks | Complexity | Test requirements | Privacy implications | Production proof requirements | Reviewer workflow compatibility | Recommended now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Option A: keep local/test stub only | Lowest blast radius; preserves current HOLD; keeps role tests local. | Does not solve Level 1 production auth; can be mistaken for real auth if docs are sloppy. | Low. | Existing C2 stub tests plus no-production-auth-claim checks. | Low new privacy impact. | None, because production remains blocked. | Good for local regression only. | No as final production path; yes as safe current baseline. |
| Option B: simple session-based internal auth | Can support human reviewer workflow with simpler UX than external provider. | Needs session storage, CSRF/session lifecycle, role owner, logout, and security review. | Medium. | Login/logout, session expiry, reviewer/manager/admin deny/allow, CSRF, unauthorized API/UI tests. | May store identity/role data and session metadata. | Requires approved non-customer proof, redacted evidence, rollback, and owner. | Potentially compatible. | Not recommended until security owner selects it. |
| Option C: external identity provider | Centralizes identity, MFA, role groups, lifecycle, and revocation. | Integration complexity, provider outage behavior, group mapping errors, PII handling. | Medium to high. | OIDC/SAML/provider mocks, role mapping, callback, expiry, revocation, unauthorized, audit, redaction tests. | Real identities and group memberships may be PII. | Requires provider owner, test tenant or fixture flow, redacted proof, rollback, and incident plan. | Likely strongest production candidate. | Needs human security decision. |
| Option D: API-token based service access for API clients | Fits service-to-service integrations and scoped API access. | Human reviewer workflow still needs human auth; token leakage risk; scopes can drift. | Medium. | Token scope, rotation, revocation, unauthorized, field allowlist, log redaction, rate-limit tests. | Tokens and client IDs are sensitive; protected fields need allowlists. | Requires owner, secret handling policy, proof without exposing tokens. | Compatible only for API clients, not enough for human reviewers. | Future gated. |
| Option E: hybrid human + API-client model | Separates human reviewer sessions from service clients; supports future CRM read-only mapping. | More moving parts; role matrix and audit evidence are harder. | High. | Full human auth tests plus API-token scope tests, cross-role denial, export/log/evidence tests. | Highest because identities, tokens, and integration metadata coexist. | Requires all provider, privacy, D1, rollback, and proof approvals. | Best long-term architecture if product expands. | Future candidate after security/privacy decisions. |

Recommended provider decision now:

`AUTH_ACCESS_CONTROL_DECISION: OPTION_C_NEEDS_HUMAN_SECURITY_DECISION`

Reason: repo-visible evidence does not resolve provider, role membership,
session model, identity retention, API-client scopes, production permission
matrix, or production proof requirements.

## 11. Access Denial Test Plan

Future implementation must include tests for the selected scope before any
production proof:

- reviewer can read only allowed manual note fields;
- reviewer can write only allowed manual note fields;
- manager cannot write manual notes unless explicitly allowed;
- manager protected field behavior is decided and tested;
- API client cannot access protected fields unless explicitly allowed;
- missing role is denied or receives protected fields omitted according to
  selected policy;
- unknown role is denied or receives protected fields omitted according to
  selected policy;
- generated suggestion cannot be persisted;
- generated suggestion cannot enter history;
- generated suggestion cannot enter export;
- generated suggestion cannot receive attribution;
- unauthorized write returns a safe error;
- unauthorized read omits protected fields or denies request according to
  selected policy;
- full metadata event lists remain unavailable unless explicitly approved;
- old/new manual note text is not retained in history unless a future
  privacy/legal decision approves it;
- evidence and tests do not include secrets, tokens, cookies, auth headers,
  private URLs, customer data, customer payloads, or real PII.

## 12. Audit And Evidence Policy

Acceptable local/test evidence now:

- repo root, branch, HEAD, default branch, remote default branch HEAD, and clean
  status;
- scoped docs-only diff;
- package script inspection;
- CI workflow inspection;
- local validation command output;
- local/fake-D1 fixture results;
- local role-stub tests with synthetic data;
- PR checks and docs review.

Future production evidence would require separate explicit approval naming:

- exact target;
- environment owner;
- auth/provider owner;
- D1 owner if D1 observation is needed;
- exact command allowlist;
- endpoint allowlist if endpoint calls are needed;
- fixture/non-customer data policy;
- evidence storage and redaction policy;
- rollback/backout owner;
- stop conditions.

Never claim now:

- production auth proof;
- production role enforcement;
- production reviewer workflow readiness;
- production D1 schema state;
- production endpoint behavior;
- staging evidence;
- privacy compliance;
- audit-grade attribution;
- generated suggestion production exclusion proof;
- CRM, outreach, LLM, outcome learning, or automation readiness.

Never capture:

- secrets, tokens, cookies, auth headers, private URLs, customer rows, customer
  payloads, production/staging logs, production/staging D1 data, CRM payloads,
  outreach recipient data, LLM prompts/responses, or real PII.

Evidence must be redacted if it could include:

- names, emails, phone-like values, account identifiers, CRM IDs, opportunity
  IDs, private URLs, auth/session metadata, note text, generated suggestion
  text, customer context, or payload fragments.

Docs, PRs, CI, local tests, and local fixtures are not production proof because
they do not observe real production identity, production sessions, production
role enforcement, production D1, production endpoint behavior, production
rollback, production logs, production privacy controls, or production evidence
handling.

## 13. Privacy / Retention Bridge

Auth/access-control cannot be separated from privacy/retention:

- Manual notes may contain sensitive sales context or PII.
- Static privacy warning is not detection, redaction, retention enforcement, or
  compliance proof.
- Real identity attribution could create PII.
- Role-based access can expose manual note text, timestamps, and activity
  metadata to broader audiences.
- Exports, API clients, manager views, screenshots, logs, and evidence packets
  can create retained copies outside the application.
- Clear/delete semantics remain policy-sensitive because current value,
  metadata events, exported copies, evidence, and logs can each have different
  retention behavior.
- Retention/purge policy remains unresolved for production.

Before implementation, a future privacy/retention decision must answer:

- whether current note text can be retained in production;
- whether metadata-only events survive clear/delete;
- whether real identity can be stored;
- whether exports may include note text or metadata;
- whether redaction, automated detection, purge/delete jobs, or legal/privacy
  approval are required;
- what evidence may be retained and where.

## 14. CRM / Outreach / Manager Dashboard Bridge

CRM:

- CRM read-only integration should remain after auth/access-control and
  privacy decisions.
- CRM read-only mapping still requires CRM owner, field allowlist,
  credential/token policy, customer-data boundary, and tests.
- CRM mutation remains forbidden.

Outreach:

- Outreach draft implementation remains forbidden by this packet.
- Outreach send remains forbidden.
- No email or message send is approved.
- No LLM call is approved.

Manager dashboard / exports / API:

- Manager dashboard expansion depends on role, protected field, privacy,
  retention, evidence, and product decisions.
- Export expansion depends on role, protected field, privacy, retention, and
  clear/delete decisions.
- API expansion depends on role, protected field, scope/token, privacy, and
  evidence decisions.
- Outcome learning depends on privacy/data governance, source-of-truth,
  retention, bias, and data-quality decisions.

## 15. Recommended Decision

Recommended decision:

`AUTH_ACCESS_CONTROL_DECISION: OPTION_C_NEEDS_HUMAN_SECURITY_DECISION`

Rationale:

- The C2 local/test role stub is useful evidence for desired denial/omission
  behavior, but it is not production auth.
- No real provider, session model, role owner, or API-client scope is selected.
- No production permission matrix is proven.
- No privacy/retention policy is approved for real identities or production
  manual notes.
- No production D1 proof or production reviewer workflow proof exists.
- Manager visibility, export/API expansion, CRM, outreach, outcome learning,
  and automation remain blocked.

Rejected current decisions:

- `OPTION_A_DOCS_ONLY_STUB_CONTINUES` is truthful as a current state but not
  enough to move toward Level 1.
- `OPTION_B_DECISION_READY_FOR_IMPLEMENTATION_PLAN` is not supported because
  provider, identity, privacy/retention, and production proof decisions remain
  unresolved.
- `OPTION_D_NEEDS_PRIVACY_RETENTION_DECISION` is true but incomplete because
  security/provider decisions are also unresolved.
- `OPTION_E_NEEDS_PRODUCTION_OWNER_INPUT` is true but should come after
  security/privacy decisions define what production proof would need.

## 16. Final Recommendation

```text
AUTH_ACCESS_CONTROL_DECISION_PACKET: CREATED
CURRENT_PRODUCTIZATION_LEVEL: LEVEL_0_COMPLETE
TARGET_PRODUCTIZATION_LEVEL: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW
PRODUCTION_REVIEWER_WORKFLOW_READY: BLOCKED
AUTH_IMPLEMENTATION_READY: NO
AUTH_IMPLEMENTATION_PERFORMED: NO
STAGING_EXECUTION: HOLD
PRODUCTION_PROOF: HOLD
PRODUCTION_DEPLOY: HOLD
CRM_OUTREACH_LLM_AUTOMATION: FORBIDDEN
NEXT_RECOMMENDED_CYCLE: PRIVACY_RETENTION_DECISION_PACKET_DOCS_ONLY
NEXT_DECISION: HOLD
```

This packet should not unlock implementation. It should be used as input for a
future human security decision and a privacy/retention decision before any
auth implementation plan, production reviewer workflow proof, CRM read-only
planning, manager dashboard expansion, export/API expansion, outreach, LLM, or
automation work.
