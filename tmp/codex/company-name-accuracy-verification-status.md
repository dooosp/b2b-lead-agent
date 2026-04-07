# Company Name Accuracy Verification Status

- Phase: command and smoke verification complete
- Setup executed: `npm ci`
- Command result: `node --test tests/*.test.js` passed
- Manual smoke result:
  - `[인터뷰]` -> `동양BMS`
  - `건물에너지` -> rejected
  - `김연재` -> rejected
  - `② K-조선` -> rejected
  - `선박까지` -> rejected
  - `부평 청천동` -> rejected
- Read-only review result: valid, with `git diff --name-only` unchanged before and after review.
