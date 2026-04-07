# Root Identity Trust Verification Plan

## Required Checks
- Root tests cover reordered source identity stability.
- Root tests cover equivalent canonical source identity stability despite query-token variation.
- Root tests confirm missing body is not promoted into trusted prompt context.
- Root tests confirm low-trust body content is excluded from trusted body prompt context.
- Root tests confirm invalid company names are rejected from accepted lead output.

## Review Gate
- Capture `git diff --name-only` before and after the read-only review.
- Treat the review as invalid if the diff changes during the review phase.
