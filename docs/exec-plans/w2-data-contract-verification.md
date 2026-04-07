# W2 Data Contract Verification Plan

## Required Checks
- Worker tests cover same-logical-lead identity stability when source order changes.
- Worker tests cover canonical identity stability for equivalent discovery/query URL variants.
- Worker tests confirm normalization occurs before persistence paths serialize rows.
- Worker tests confirm `leadToRow` -> `rowToLead` round-trip stability for canonical fields.
- Worker tests confirm legacy rows without new fields still deserialize safely.

## Review Gate
- Capture `git diff --name-only` before and after the read-only review.
- Treat the review as invalid if the diff changes during the review phase.
