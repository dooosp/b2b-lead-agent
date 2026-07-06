# Local/Test-Safe Reviewer Workflow Intelligence v1 Analysis Memo

Date: 2026-07-06

## Preflight Evidence

- Repo root: `/Users/jangtaeho/Documents/New/b2b-lead-agent-hardening-control`
- Current branch: `master`
- HEAD: `c90eeded7c6d6718482993d5d233ed343aee0771`
- Default branch: `origin/master` / `refs/remotes/origin/master`
- Remote: `https://github.com/dooosp/b2b-lead-agent.git`
- Initial working tree: clean
- Available commands from `package.json`: `npm run check:naming`, `npm run check:schema`, `npm audit --audit-level=moderate`, `npm test`, `npm run test:worker`, `npm run test:contract`, `npm run test:unit`, `npm run check:level1`, enrichment/replay/proof local gates.

## Source-of-Truth Reading

Read local source-of-truth and current boundary docs before implementation:

- `AGENTS.md`
- `HARDENING_PLAN.md`
- `NEXT_SESSION_PROMPT.md`
- `docs/roadmap/current-pr-train.md`
- `docs/roadmap/production-proof-boundaries.md`
- `docs/standing-approval-policy.md`
- `docs/lead-action-intelligence-v1.md`
- `docs/architecture/worker-routes.md`
- `docs/architecture/data-path.md`
- `docs/architecture/repo-map.md`
- `docs/d1-schema-drift-hardening.md`
- `docs/local-e2e-harness.md`
- `docs/reviewer-workflow-final-audit.md`
- `docs/reviewer-workflow-human-ux-review.md`
- Manual Review Notes v1 decision/access/privacy/feedback roadmap packets.

Checked GitHub issues with comments:

- #144 remains the open reviewer feedback intake container. The first feedback record was P3/docs/no-follow-up and did not request implementation.
- #154 remains open for privacy/retention. Static warning is approved; PII detection, redaction, purge, retention enforcement, and production privacy proof remain unimplemented and blocked.
- #162 remains open for real auth/session/provider implementation. Only local/test scaffolds and docs-planning are approved.
- #163 remains open for production D1 schema observation. No production/staging D1 access, observation, migration, write, or delete is approved.
- #164 remains open for rollback/backout execution. Docs-planning exists; rollback execution and destructive data actions remain blocked.
- #165 remains open for separate final production proof. A later validator held the proof approval packet because production-like command text was refused. No production proof execution is approved.

## Boundary Conclusions

This task can only add local/test-safe workflow intelligence. It must not:

- call production or staging endpoints;
- observe, migrate, write, delete, or otherwise access production/staging D1;
- read production logs or secrets;
- create CRM/email/outbound automation;
- persist, attribute, export, or history-track generated reviewer suggestions;
- claim `productionReady:true`;
- close #165, #162, #163, #164, or #154.

All new evidence and tests are `NOT_PRODUCTION_EVIDENCE`. The work may improve local reviewer workflow quality, but production reviewer workflow readiness remains blocked until separate human approval.

## Current Architecture Findings

Root generation pipeline:

- `main.js` runs batch lead generation and optional email only with explicit `--email`.
- `orchestrator/news-orchestrator.js`, `enricher/article-enricher.js`, and `enricher/outbound-http-boundary.js` keep enrichment outbound HTTP behind local/test-verified guards.
- `lead-qualifier.js` produces LeadBrief fields, confidence, data gaps, evidence, generation mode, and review status.
- `lead-report-publisher.js` intentionally omits protected/manual/generated note fields from published report artifacts.

Worker API:

- Existing safest route for reviewer updates is `PATCH /api/leads/:id`; it already handles status, review status, and human-entered manual notes.
- Existing safest aggregate surface is `GET /api/leads`; it already returns leads, reviewer action queue, and lead review session metadata.
- `GET /api/export/csv` currently strips manual note fields before serialization.

D1/data layer:

- `leads.notes` stores current human-entered manual notes only.
- `manual_review_note_events` stores metadata-only note history: lead id, event type, timestamp, fixed `manual_reviewer` author label. It does not retain note text.
- `updateLeadPatchAtomic` rejects generated reviewer suggestion patch fields atomically.
- `ensureD1Schema`, `worker/schema.sql`, and `scripts/check-d1-schema-consistency.js` must be updated together for new persisted tables.

Access/privacy:

- `worker/lib/manual-review-notes-access.js` implements the C2 local/test role stub. `reviewer` can read/write protected manual note fields; `manager`, `api`, missing, and unknown roles cannot.
- The same role-stub protection is the safest model for reviewer feedback because it includes freeform human-entered text and sensitive reviewer judgment.
- Static privacy warning remains warning-only. No detection, blocking, redaction, purge, or retention enforcement should be claimed.

UI:

- `/leads` already includes reviewer queue/session summaries, generated copy-only note suggestions, and manual note controls.
- `/leads/:id` detail page already includes Opportunity Workbench, generated copy-only guidance, review status controls, and manual note controls.
- The UI change should be additive: show feedback state, outcome label, data-gap priority, next reviewer action, and local/test boundary language on list/detail surfaces.

## Implementation Shape

Use existing routes rather than adding new routes:

- `PATCH /api/leads/:id` accepts a `reviewerFeedback` object.
- `GET /api/leads` returns local/test reviewer summary v1 and data-gap prioritization metadata.
- `GET /api/export/csv` continues to exclude feedback freeform text and feedback metadata.

Persist current human feedback separately from generated suggestions:

- New `reviewer_feedback` table stores the current per-lead human-entered feedback signals:
  - `action_usefulness`
  - `outcome_label`
  - `data_gap_priority`
  - `evidence_confidence_adjustment`
  - `feedback_text`
  - `next_reviewer_action`
  - fixed `author_label = manual_reviewer`
  - `updated_at`
- New `reviewer_feedback_events` table stores metadata-only history:
  - lead id
  - event type: create/edit/clear
  - changed timestamp
  - fixed `manual_reviewer` author label
  - changed fields JSON
- The event table must not store feedback text, old text, new text, generated suggestion text, real identity, email, or display name.

Patch semantics:

- Allowed enum values:
  - action usefulness: `useful`, `partially_useful`, `not_useful`, `unclear`
  - outcome label: `interested`, `not_fit`, `no_response`, `needs_more_research`, `duplicate`, `deferred`, `unknown`
  - data gap priority: `none`, `low`, `medium`, `high`, `blocking`
  - evidence confidence adjustment: `increase`, `decrease`, `unchanged`, `unknown`
- Freeform feedback and next reviewer action are human-entered local/test fields only.
- `{ reviewerFeedback: { clear: true } }` clears current feedback and creates a metadata-only clear event when current feedback exists.
- Generated reviewer suggestion fields remain rejected atomically, including attempts to smuggle them into reviewer feedback payloads.

Reviewer Summary v1:

- Count total leads.
- Count by review status.
- Count by confidence band.
- Count by current feedback data-gap priority and outcome label.
- Count leads needing human review.
- Count leads blocked by missing evidence/source.
- Count leads with manual notes.
- Count leads with reviewer feedback.
- Aggregate top review risks from existing deterministic Lead Action Intelligence.
- Return suggested queue buckets from data-gap prioritization.
- Include explicit local/test boundary metadata: `NOT_PRODUCTION_EVIDENCE`, `productionReady:false`, no generated suggestion persistence/export/history/attribution.

Data Gap Prioritization v1:

- Deterministically bucket and sort leads using:
  - blocking/high data-gap priority;
  - low confidence;
  - missing source/evidence;
  - unavailable/needs-review qualification;
  - stale generated signal;
  - missing manual note;
  - `needs_more_research`, `duplicate`, `not_fit`, and `interested` feedback outcomes.
- No fake leads, generated approvals, outreach approvals, or production evidence.

Testing Plan

- Add failing tests first for:
  - pure summary/prioritization helpers;
  - reviewer feedback patch create/edit/clear;
  - enum rejection and generated suggestion rejection;
  - C2 local/test role-stub read/write protection;
  - metadata-only feedback history without freeform text;
  - CSV/export omission;
  - schema consistency for new tables/indexes.
- Then implement code and run targeted tests before the full validation suite.

## Documentation Plan

Update source-of-truth docs after implementation:

- `AGENTS.md`
- `HARDENING_PLAN.md`
- `NEXT_SESSION_PROMPT.md`
- `docs/roadmap/current-pr-train.md`
- `docs/roadmap/production-proof-boundaries.md`
- `docs/lead-action-intelligence-v1.md`
- architecture/data/schema route docs as needed
- new roadmap packet for Reviewer Workflow Intelligence v1.

Docs must repeat that the feature is local/test-only, `NOT_PRODUCTION_EVIDENCE`, `productionReady:false`, and does not resolve real auth/session, production D1, rollback, retention/privacy enforcement, generated suggestion persistence, or production proof blockers.
