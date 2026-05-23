# B2B Lead Agent Auth / Access Control Implementation Plan

This plan converts the existing Auth / Access Control Decision Packet plus the
approved conservative privacy policy into a future implementation roadmap for
auth and access-control guardrails.

It is documentation only. It does not implement auth, sessions, roles, access
control, runtime behavior, UI behavior, API behavior, schema behavior, database
behavior, privacy enforcement, PII detection, redaction, retention enforcement,
purge/delete behavior, export controls, CRM integration, outreach, LLM calls,
automation, staging execution, production proof, production deploy, D1 access,
endpoint calls, logs/secrets access, or customer/private data access.

## Document Status

- Document status:
  `AUTH_ACCESS_CONTROL_IMPLEMENTATION_PLAN_CREATED_DOCS_ONLY`.
- Human decision:
  `PREPARE_AUTH_ACCESS_CONTROL_IMPLEMENTATION_PLAN_DOCS_ONLY`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Baseline inspected: `origin/master` at
  `79c41338d5cea4f2e1b8437eec655604869f299c`.
- Latest related merged PR: PR #158,
  `docs: add privacy retention implementation plan`.
- Plan path:
  `docs/roadmap/b2b-lead-agent-auth-access-control-implementation-plan.md`.
- Controlling auth/access packet:
  `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md`.
- Controlling privacy implementation plan:
  `docs/roadmap/b2b-lead-agent-privacy-retention-implementation-plan.md`.
- Conservative privacy policy status:
  `COMPLETE_FOR_CONSERVATIVE_POLICY`.
- Production reviewer workflow:
  `STILL_BLOCKED_PENDING_AUTH_D1_ROLLBACK_PROOF`.
- Implementation performed by this plan: no.
- Auth/session/access-control tests or guards implemented by this plan: no.
- Production proof performed by this plan: no.
- Production, staging, CRM, outreach, LLM, automation, or customer/private data
  action performed by this plan: no.

```yaml
b2b_lead_agent_auth_access_control_implementation_plan:
  document_status: AUTH_ACCESS_CONTROL_IMPLEMENTATION_PLAN_CREATED_DOCS_ONLY
  human_decision: PREPARE_AUTH_ACCESS_CONTROL_IMPLEMENTATION_PLAN_DOCS_ONLY
  repository: dooosp/b2b-lead-agent
  default_branch: master
  inspected_origin_master: "79c41338d5cea4f2e1b8437eec655604869f299c"
  latest_related_merged_pr: 158
  conservative_privacy_policy_status: COMPLETE_FOR_CONSERVATIVE_POLICY
  implementation_authorized: false
  auth_session_access_control_tests_or_guards_implemented: false
  production_auth_proof_authorized: false
  production_reviewer_workflow: STILL_BLOCKED_PENDING_AUTH_D1_ROLLBACK_PROOF
  staging_execution: HOLD
  production_proof: HOLD
  production_deploy: HOLD
  production_d1_access: HOLD
  endpoint_calls: HOLD
  crm_outreach_llm_automation: FORBIDDEN
  customer_private_data_access: FORBIDDEN
  next_recommended_cycle: AUTH_ACCESS_CONTROL_TEST_GUARD_IMPLEMENTATION_DOCS_ONLY
  alternate_next_cycle: PRODUCTION_D1_SCHEMA_OBSERVATION_REQUEST_DOCS_ONLY
  next_decision: HOLD_PENDING_NEW_EXPLICIT_GOAL
```

## 1. Source Inputs

This plan is grounded in these repo-visible records:

- `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md`
  records that the C2 local/test role stub is not real production auth, defines
  the proposed role model, protected fields, denial/omission expectations,
  provider options, denial tests, and unresolved security decisions.
- `docs/roadmap/b2b-lead-agent-privacy-retention-implementation-plan.md`
  converts the Issue #154 conservative policy into planning phases and keeps
  generated suggestion retention/history/export/attribution forbidden.
- `docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md`
  keeps the production reviewer workflow blocked by auth/access-control,
  production D1, privacy/retention, rollback/backout, observability/evidence,
  and production proof.
- `docs/roadmap/manual-review-notes-v1-access-control-plan.md` records the
  earlier Manual Review Notes access-control plan and the C2 local/test
  boundary.
- `worker/lib/manual-review-notes-access.js` and
  `worker/tests/manual-review-notes.test.mjs` provide current local/test role
  stub evidence only. They are not production auth or production proof.

## 2. Current State To Preserve

Current repo-visible state:

- C2 local/test role stub exists.
- The C2 local/test role stub is opt-in only through
  `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` plus
  `X-Manual-Review-Notes-Local-Test-Role`.
- The C2 local/test role stub is not real production auth.
- Real auth is not implemented.
- Real sessions are not implemented.
- Real production role ownership is not defined.
- Real reviewer identity storage is not approved.
- Production reviewer workflow is blocked.
- Production reviewer workflow remains blocked pending auth, production D1,
  rollback/backout, and proof.
- Generated suggestion persistence, history, export, and attribution are
  forbidden.
- Production, staging, CRM, outreach, LLM, and automation remain
  `HOLD` or `FORBIDDEN`.
- Customer/private data access remains forbidden.
- Current manual note behavior remains local/test only and uses the fixed
  generic `manual_reviewer` label, not real identity.
- Static privacy warning behavior is warning-only. It is not detection,
  blocking, redaction, retention enforcement, purge/delete, or compliance
  proof.
- The conservative privacy policy is approved for planning only.

## 3. Target Roles

The future role model is planning-only. No role in this section is implemented
for production by this plan.

| Role | Future purpose | Default planning posture | Protected-field posture |
| --- | --- | --- | --- |
| `reviewer` | Human reviewer who can work the reviewer workflow after future real auth and proof. | Candidate for manual-note read/write after explicit implementation approval. | May see and write allowed manual note fields only after auth, privacy, D1, rollback, and proof gates pass. |
| `manager` | Internal manager or lead reviewer who may need aggregate workflow context. | Read-only aggregate context by default. No manual note write. | Manual note text, timestamp, author label, and metadata-history summary remain omitted unless later approved. |
| `admin` | Future operational/security administration role, if selected. | Not a blanket bypass. Admin scope must be explicitly chosen. | All protected fields remain future-decision-required. |
| `API client` | Future service-to-service or approved integration access. | No protected-field access by default. No manual note write. | Protected fields remain omitted or denied unless a future scoped allowlist is approved. |
| `unauthenticated/missing role` | Request with no valid identity or role. | Deny protected workflow access. | Protected fields must be omitted or the request denied. |
| `unknown/unsupported role` | Invalid, misspelled, stale, or unsupported role. | Fail closed. | Protected fields must be omitted or the request denied. |

Protected fields include:

- `manualReviewNotes`;
- `notes` when it backs or aliases manual notes;
- `manualReviewNotesProvenance`;
- `manualReviewNotesUpdatedAt`;
- `manualReviewNotesAuthorLabel`;
- `manual_review_note_events`;
- metadata-history summary fields derived from `manual_review_note_events`;
- generated reviewer note suggestion text when it could be mistaken for saved
  note content;
- CSV `memo` compatibility content when it includes manual notes;
- any future identity, CRM, outreach, outcome-learning, audit, customer,
  private lead, or private person fields.

## 4. Implementation Phases

These phases are planning only. Each phase requires a separate future
implementation goal before any test, code, schema, API, UI, runtime,
staging, production, D1, CRM, outreach, LLM, automation, or customer/private
data work begins.

### Phase 0: Preserve Local/Test Role-Stub Behavior

#### Purpose

Preserve current C2 local/test role-stub behavior while future auth is planned.
The role stub stays opt-in, local/test-only, and clearly marked as not real
auth and not production ready.

#### Likely Files Affected

- `worker/lib/manual-review-notes-access.js`
- `worker/tests/manual-review-notes.test.mjs`
- `docs/roadmap/b2b-lead-agent-auth-access-control-implementation-plan.md`
- `docs/roadmap/current-pr-train.md` if source-of-truth state changes

#### Allowed Future Changes

- Add local/test-only guard tests that preserve the current role-stub boundary.
- Clarify docs that the stub is not real auth and not production proof.
- Preserve existing reviewer allow behavior and manager/API/missing/unknown
  omission or denial behavior under the opt-in stub.

#### Forbidden Changes

- Treating the C2 stub as production auth.
- Enabling the stub by default.
- Adding real sessions, identities, provider callbacks, production roles, or
  access-control behavior.
- Changing runtime, UI, API, schema, database, staging, production, D1, CRM,
  outreach, LLM, automation, or customer/private data behavior in this phase.

#### Required Tests

- Future targeted test:
  `node --test worker/tests/manual-review-notes.test.mjs`
- Future full non-production gate:
  `npm run check:naming`, `npm run check:schema`, and `npm test`
- Assertions must prove:
  - reviewer behavior remains limited to opt-in local/test scope;
  - `realAuthImplemented` remains false under the stub;
  - `productionReady` remains false under the stub;
  - manager, API, missing, and unknown roles do not gain protected-field access
    from preservation work.

#### Privacy Constraints

- Do not store real reviewer identity.
- Do not store generated suggestions.
- Do not expose manual note text to manager, API client, missing role, or
  unknown role.
- Use synthetic/local fixtures only.
- No customer/private data in tests, screenshots, logs, evidence, or PR text.

#### Rollback Notes

- Back out only the local/test guard or docs change if it is wrong.
- Restore the previous stub semantics if a future guard accidentally broadens
  access.
- No data rollback is applicable because this phase must not change storage.

#### Stop Conditions

- The change requires production auth, production roles, or real identity.
- The change requires production/staging/D1/endpoint/log/secret access.
- The change broadens protected-field visibility.
- The change causes generated suggestions to persist, export, receive
  attribution, or enter history.

#### Separate Future Implementation Goal Required

Yes.

### Phase 1: Choose Future Auth / Session / Provider Model

#### Purpose

Select the future auth, session, and provider model before any implementation.
The selected model must explain human reviewer auth, manager/admin role source,
API-client access, session lifetime, denial behavior, identity retention, and
evidence requirements.

#### Likely Files Affected

- `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md`
- `docs/roadmap/b2b-lead-agent-auth-access-control-implementation-plan.md`
- `docs/roadmap/current-pr-train.md`
- Future implementation files only after approval, likely:
  - `worker/lib/auth.js`
  - `worker/routes/api.js`
  - `worker/routes/pages.js`
  - `worker/pages/auth-required.js`
  - `worker/tests/*auth*.test.mjs`

#### Allowed Future Changes

- Docs-only provider selection or comparison update.
- Future local/test mocks for the selected auth model after explicit approval.
- Future tests for session expiry, role mapping, callback failure, token scope,
  and fail-closed behavior after explicit approval.

#### Forbidden Changes

- Implementing provider callbacks, login/logout, sessions, cookies, tokens,
  role mapping, or middleware in this planning phase.
- Storing real reviewer identity.
- Adding production credentials, secrets, staging/prod endpoint calls, logs, or
  D1 access.
- Treating API-token-only access as sufficient for human reviewer workflow.

#### Required Tests

- Future provider-selection docs update:
  `git diff --check`, `git diff --cached --check`,
  `npm run check:naming`, `npm run check:schema`, and `npm test`
- Future implementation tests, only after approval:
  - reviewer session allow/deny;
  - manager/admin/API role mapping;
  - missing/unknown role denial;
  - session expiry;
  - invalid token/cookie rejection;
  - protected-field omission or denial;
  - no secrets, tokens, cookies, auth headers, or private data in evidence.

#### Privacy Constraints

- Real identity retention remains unresolved and unapproved.
- Role membership evidence must be redacted.
- No customer/private data or real PII in fixtures.
- No generated suggestion retention, history, export, or attribution.

#### Rollback Notes

- Docs-only provider selection can be reverted.
- Future implementation rollback must preserve fail-closed behavior and must
  not delete or mutate production data.
- Token/session revocation and provider-disable behavior need a future owner
  before implementation.

#### Stop Conditions

- Auth provider, session model, role owner, or identity retention is ambiguous.
- The future implementation would need real secrets or production/staging
  systems.
- The selected model cannot prove missing/unknown role denial without leaking
  protected fields.

#### Separate Future Implementation Goal Required

Yes.

### Phase 2: Plan Reviewer Manual-Note Read / Write Permissions

#### Purpose

Plan reviewer access to manual note read/write actions under future real auth.
Reviewer manual-note access may be considered only after the selected auth
model, privacy policy, production D1 decision, rollback/backout plan, and proof
approval are available.

#### Likely Files Affected

- `worker/lib/manual-review-notes-access.js`
- `worker/api/leads.js`
- `worker/pages/leads.js`
- `worker/pages/lead-detail.js`
- `worker/api/serializers/lead-csv.js`
- `worker/tests/manual-review-notes.test.mjs`
- `worker/tests/lead-review-status.test.mjs`
- `worker/e2e/local-e2e.test.mjs`
- `docs/roadmap/b2b-lead-agent-auth-access-control-implementation-plan.md`

#### Allowed Future Changes

- Add local/test tests proving reviewer can perform approved manual-note
  save/edit/clear actions.
- Add local/test tests proving reviewer can read only approved manual-note
  fields.
- Add docs-only matrices for reviewer field visibility and write semantics.
- Use synthetic/local fixture data only.

#### Forbidden Changes

- Production reviewer access.
- Production D1 writes or schema observation.
- Real identity storage.
- Manager, API, admin, missing, or unknown role manual-note write access.
- Generated suggestion persistence/history/export/attribution.
- Runtime/UI/API/schema/database behavior changes without a separate future
  implementation goal.

#### Required Tests

- Reviewer can perform allowed manual-note actions.
- Reviewer can read only approved protected fields.
- Reviewer manual-note save/edit/clear does not store generated suggestion
  text.
- Reviewer manual-note save/edit/clear does not store real identity unless a
  future privacy/auth approval explicitly changes that.
- Targeted future command:
  `node --test worker/tests/manual-review-notes.test.mjs`
- Full future non-production gate:
  `npm run check:naming`, `npm run check:schema`, and `npm test`

#### Privacy Constraints

- Manual notes may contain sensitive text, so test values must be synthetic and
  non-customer.
- Manual note body history remains forbidden.
- Generated suggestions remain copy-only helper text.
- Fixed `manual_reviewer` remains non-PII local/test label until future auth
  and privacy approval.

#### Rollback Notes

- Disable or revert only the reviewer access change if it broadens access too
  far.
- Preserve existing manual note data in local/test fixtures.
- Do not use data deletion, production D1 cleanup, or production rollback
  commands without separate approval.

#### Stop Conditions

- Future reviewer permissions cannot be tested without production data.
- Future write behavior needs D1 production proof that has not been approved.
- Tests would include customer/private data or real reviewer identity.
- Generated suggestion text could enter storage, history, export, or
  attribution.

#### Separate Future Implementation Goal Required

Yes.

### Phase 3: Plan Manager / API Protected-Field Omission Or Denial

#### Purpose

Plan manager and API-client protected-field behavior. Conservative privacy
policy keeps manager, export, and API manual note visibility blocked by
default. Future manager/API behavior must omit protected fields or deny access
unless later explicitly approved.

#### Likely Files Affected

- `worker/lib/manual-review-notes-access.js`
- `worker/api/leads.js`
- `worker/api/serializers/lead-csv.js`
- `worker/routes/api.js`
- `worker/pages/leads.js`
- `worker/pages/lead-detail.js`
- `worker/tests/manual-review-notes.test.mjs`
- `worker/tests/route-boundaries.test.mjs`
- `worker/tests/data-contract.test.mjs`

#### Allowed Future Changes

- Add local/test tests proving manager cannot write manual notes unless later
  approved.
- Add local/test tests proving API clients cannot access protected fields unless
  later approved.
- Add omission or denial assertions for API payloads, CSV/export payloads, and
  metadata-history summary fields.
- Add docs-only field allowlist or denylist planning.

#### Forbidden Changes

- Manager manual-note write access.
- API-client protected-field access.
- Export/CSV manual-note expansion.
- Full metadata event-list exposure.
- Manager dashboard expansion using manual note text or protected metadata.
- Production/staging/D1/endpoint/log/secret/customer data access.

#### Required Tests

- Manager cannot write manual notes unless later approved.
- API client cannot access protected fields unless later approved.
- Manager, API client, missing role, and unknown role get protected fields
  omitted or denied according to selected future policy.
- Generated suggestions cannot be exported or treated as saved notes.
- Targeted future command:
  `node --test worker/tests/manual-review-notes.test.mjs`
- Add route/data-contract targeted tests only if affected.
- Full future non-production gate:
  `npm run check:naming`, `npm run check:schema`, and `npm test`

#### Privacy Constraints

- Manual note text and metadata are protected by default.
- Exported files and API payloads must not contain customer/private data in
  evidence.
- Generated suggestions must not appear in saved-note exports, history, or
  attribution.
- Manager/API expansion requires future privacy and role approval.

#### Rollback Notes

- Restore omission or denial behavior if future manager/API changes leak
  protected fields.
- Do not remove stored manual note data as rollback.
- Do not call production endpoints or mutate D1 as rollback.

#### Stop Conditions

- A future requirement asks managers, exports, or API clients to see manual
  note fields without a new explicit approval.
- The future API-client model lacks scope, token, revocation, or evidence
  rules.
- Protected-field omission cannot be proven with synthetic/local fixtures.

#### Separate Future Implementation Goal Required

Yes.

### Phase 4: Plan Missing / Unknown Role Denial Tests

#### Purpose

Plan fail-closed behavior for unauthenticated, missing, unknown, and
unsupported roles. Future implementation must either deny protected workflow
access or omit protected fields, using explicit policy per surface.

#### Likely Files Affected

- `worker/lib/manual-review-notes-access.js`
- `worker/lib/auth.js`
- `worker/routes/api.js`
- `worker/routes/pages.js`
- `worker/pages/auth-required.js`
- `worker/tests/manual-review-notes.test.mjs`
- `worker/tests/route-dispatch.test.mjs`
- `worker/tests/route-boundaries.test.mjs`
- `worker/e2e/local-e2e.test.mjs`

#### Allowed Future Changes

- Add local/test tests for missing role denial or protected-field omission.
- Add local/test tests for unknown/unsupported role denial or protected-field
  omission.
- Add safe error-shape tests that do not leak role internals, secrets, note
  text, generated suggestions, or private data.
- Add docs-only policy specifying when to return `401`, `403`, redirect, or
  omit fields.

#### Forbidden Changes

- Allowing unknown roles to inherit reviewer access.
- Returning protected fields before auth state is resolved.
- Logging secrets, cookies, tokens, auth headers, customer payloads, or manual
  note text.
- Production/staging endpoint calls or real auth-provider calls.

#### Required Tests

- Missing role denied or protected fields omitted.
- Unknown role denied or protected fields omitted.
- Unsupported role denied or protected fields omitted.
- Unauthorized manual-note write returns safe denial.
- Unauthorized read returns safe denial or omission.
- No customer/private data in evidence.
- Full future non-production gate:
  `npm run check:naming`, `npm run check:schema`, and `npm test`

#### Privacy Constraints

- Denial responses must not include protected fields or manual note text.
- Denial evidence must not include secrets, tokens, cookies, or real identity.
- Use synthetic/local fixtures only.
- Generated suggestions must remain unsaved, unexported, unattributed, and
  absent from history.

#### Rollback Notes

- Revert unsafe denial-shape changes to the last known safe omission or denial
  behavior.
- Do not weaken missing/unknown role behavior as rollback.
- Do not run production cleanup or production proof as rollback.

#### Stop Conditions

- Missing/unknown role behavior is ambiguous after policy review.
- A future implementation requires provider secrets or production identity
  groups.
- Any evidence would expose auth headers, cookies, secrets, note bodies,
  customer data, or private data.

#### Separate Future Implementation Goal Required

Yes.

### Phase 5: Plan Attribution / Audit Policy Without Real Identity Storage Until Approved

#### Purpose

Plan attribution and audit policy while preserving the current privacy boundary:
real identity storage is not approved. Current local/test attribution remains
the fixed non-PII `manual_reviewer` label, and audit-grade attribution is not
claimed.

#### Likely Files Affected

- `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md`
- `docs/roadmap/b2b-lead-agent-privacy-retention-implementation-plan.md`
- `docs/roadmap/b2b-lead-agent-auth-access-control-implementation-plan.md`
- `docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md`
- `worker/lib/manual-review-notes-access.js`
- `worker/db/leads.js`
- `worker/db/transform.js`
- `worker/tests/manual-review-notes.test.mjs`
- `tests/release-evidence-redaction.test.js` only if a later approved
  evidence-redaction guard explicitly touches release evidence

#### Allowed Future Changes

- Docs-only audit/attribution policy updates.
- Local/test tests proving generated suggestions do not receive attribution.
- Local/test tests proving `manual_reviewer` is not treated as real identity.
- Future identity storage planning only after security, privacy, retention, and
  legal approval.

#### Forbidden Changes

- Storing real reviewer identity.
- Displaying real reviewer names or emails.
- Adding audit-grade claims.
- Adding old/new manual note body history.
- Generated suggestion attribution.
- Evidence artifacts containing real PII, secrets, tokens, customer payloads,
  manual note bodies, or private data.

#### Required Tests

- Generated suggestions cannot be persisted, exported, attributed, or added to
  history.
- Manual note metadata does not store old note text, new note text, generated
  suggestion text, or real identity.
- Evidence and tests do not include customer/private data.
- Future targeted command:
  `node --test worker/tests/manual-review-notes.test.mjs`
- Full future non-production gate:
  `npm run check:naming`, `npm run check:schema`, and `npm test`

#### Privacy Constraints

- Real identity retention remains unresolved.
- The fixed `manual_reviewer` label remains non-PII and local/test-only.
- Metadata-only history remains metadata-only.
- Manual note body history remains forbidden.
- Generated suggestion attribution remains forbidden.

#### Rollback Notes

- Revert any attribution/audit change that creates real identity retention or
  audit overclaim.
- Preserve current manual note current-value behavior.
- Do not purge, delete, or mutate production data as rollback.

#### Stop Conditions

- Security/privacy owners have not approved real identity storage.
- Retention duration or metadata retention duration is required but unresolved.
- Evidence would include real identity, customer/private data, note bodies,
  secrets, or auth tokens.

#### Separate Future Implementation Goal Required

Yes.

### Phase 6: Plan Future Production Proof Requirements

#### Purpose

Plan the future proof gate for production reviewer workflow auth/access
controls. This phase does not execute proof. It defines what must exist before
any future proof request can be considered.

#### Likely Files Affected

- `docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md`
- `docs/roadmap/manual-review-notes-v1-production-proof-plan.md`
- `docs/roadmap/manual-review-notes-v1-production-d1-migration-plan.md`
- `docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md`
- `docs/roadmap/b2b-lead-agent-auth-access-control-implementation-plan.md`
- `docs/roadmap/current-pr-train.md`
- Future implementation/test files only after explicit approval

#### Allowed Future Changes

- Docs-only proof checklist updates.
- Docs-only owner matrix for auth owner, D1 owner, rollback owner, privacy
  owner, and proof approver.
- Future non-production proof rehearsal with synthetic fixtures only after
  explicit approval.

#### Forbidden Changes

- Production proof execution.
- Production deploy.
- Production D1 schema observation, migration, access, write, or delete.
- Production endpoint calls.
- Production logs/secrets access.
- Staging execution unless separately approved.
- Customer/private data access.
- Runtime/UI/API/schema/database/auth behavior changes under this docs-only
  phase.

#### Required Tests

- Future proof request must name exact non-production tests first.
- Required future tests include:
  - reviewer can perform allowed manual-note actions;
  - manager cannot write manual notes unless later approved;
  - API client cannot access protected fields unless later approved;
  - missing/unknown role denied or protected fields omitted;
  - generated suggestions cannot be persisted, exported, attributed, or added
    to history;
  - no customer/private data in evidence.
- Future full non-production gate before any proof request:
  `npm run check:naming`, `npm run check:schema`, and `npm test`

#### Privacy Constraints

- Production proof cannot include customer/private data unless a future explicit
  approval changes that boundary.
- Evidence must redact secrets, tokens, cookies, auth headers, private URLs,
  manual note bodies, customer payloads, and real PII.
- Generated suggestion persistence/history/export/attribution remains
  forbidden.
- Real identity storage remains unresolved until approved.

#### Rollback Notes

- A future production proof request must name rollback owner, rollback trigger,
  rollback command boundary, data preservation rules, and stop conditions before
  execution.
- Rollback cannot rely on destructive production data action unless separately
  approved by DB/privacy/ops owners.
- This docs-only plan has no runtime rollback because it changes no behavior.

#### Stop Conditions

- Auth provider is unresolved.
- Session model is unresolved.
- Production role owner is unresolved.
- Real identity retention is unresolved.
- Production D1 proof is unresolved.
- Rollback owner is unresolved.
- Production proof approval is unresolved.
- Evidence would require customer/private data, production logs/secrets,
  production endpoint calls, or production D1 access without explicit approval.

#### Separate Future Implementation Goal Required

Yes.

## 5. Required Future Test Matrix

Future implementation goals must include tests for all applicable rows before
claiming auth/access-control readiness.

| Required future test | Minimum expected proof |
| --- | --- |
| Reviewer can perform allowed manual-note actions | Reviewer role can save, edit, clear, and read allowed manual note fields only under approved auth/session behavior. |
| Manager cannot write manual notes unless later approved | Manager manual-note write returns safe denial and does not mutate note text, timestamp, author label, or metadata history. |
| API client cannot access protected fields unless later approved | API payloads and exports omit or deny protected fields for API clients by default. |
| Missing role denied or protected fields omitted | Requests with no authenticated role fail closed or omit protected fields according to selected policy. |
| Unknown role denied or protected fields omitted | Unsupported roles fail closed or omit protected fields according to selected policy. |
| Generated suggestions cannot be persisted, exported, attributed, or added to history | Generated helper text cannot update `manualReviewNotes`, `manualReviewNotesUpdatedAt`, `manualReviewNotesAuthorLabel`, `manual_review_note_events`, CSV/export, API saved-note fields, CRM/outreach/outcome-learning surfaces, or audit attribution. |
| No customer/private data in evidence | Tests, logs, screenshots, PR bodies, and evidence use synthetic/local fixtures and redact secrets, tokens, cookies, auth headers, private URLs, note bodies, customer payloads, and real PII. |

## 6. Unresolved Values Kept Open

The following remain unresolved and must stay unresolved in this plan:

- Auth provider.
- Session model.
- Production role owner.
- Real identity retention.
- Production D1 proof.
- Rollback owner.
- Production proof approval.

These unresolved values block implementation, production proof, production
deploy, production D1 access, endpoint calls, CRM, outreach, LLM, automation,
customer/private data access, production reviewer workflow readiness, and any
production auth/access-control claim.

## 7. Next Recommended Cycle

Recommended next cycle:

```text
AUTH_ACCESS_CONTROL_TEST_GUARD_IMPLEMENTATION_DOCS_ONLY
```

Reason: the safest next step is to plan or implement non-production test guards
that preserve current role-stub and protected-field boundaries before any real
auth/session/provider work begins.

Acceptable alternate next cycle:

```text
PRODUCTION_D1_SCHEMA_OBSERVATION_REQUEST_DOCS_ONLY
```

Reason: production reviewer workflow also remains blocked by production D1
proof, but any D1 observation request must remain docs-only unless a later
explicit goal approves exact production boundaries.

Final next decision remains:

```text
HOLD_PENDING_NEW_EXPLICIT_GOAL
```

## 8. Boundary Confirmation

This plan authorizes none of the following:

- auth implementation;
- access-control behavior change;
- session/provider implementation;
- production role implementation;
- runtime behavior changes;
- UI behavior changes;
- API behavior changes;
- schema behavior changes;
- database behavior changes;
- privacy enforcement;
- PII detection;
- redaction;
- retention enforcement;
- purge/delete behavior;
- export-control behavior;
- staging or production access;
- production proof;
- production deploy;
- production D1 access;
- endpoint calls;
- logs/secrets access;
- CRM, outreach, LLM, or automation;
- customer/private data access;
- generated suggestion persistence, history, export, or attribution.

Future implementation, proof, production access, D1 access, endpoint calls,
CRM, outreach, LLM, automation, customer/private data access, or readiness
claims require a separate explicit goal and approval boundary.
