# Local E2E Harness

The Playwright harness in `e2e-test.mjs` is intended for local or explicitly
approved non-production validation.

## Configuration

- `E2E_BASE_URL` selects the target URL.
- When `E2E_BASE_URL` is not set, the harness defaults to `http://127.0.0.1:8787`.
- `B2B_TOKEN`, `API_TOKEN`, or `TRIGGER_PASSWORD` provides the browser/API auth token.
- URLs under `*.workers.dev` are refused unless `ALLOW_PRODUCTION_E2E=yes` is set for a
  separately approved production run.

## Safe Local Run

Start a local Worker-compatible server, then run:

```sh
E2E_BASE_URL=http://127.0.0.1:8787 API_TOKEN=local-token npm run e2e
```

This repository does not treat local E2E, CI, docs, or config as production evidence.
