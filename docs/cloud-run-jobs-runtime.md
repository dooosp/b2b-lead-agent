# Cloud Run Jobs Runtime Contract

## Scope

This runtime seam keeps the existing batch CLI and GitHub fallback intact while adding an opt-in Cloud Run Job path.

- Local CLI remains `node main.js --profile <id> [--email]`
- GitHub Actions remains the default remote path
- Cloud Run Jobs are enabled only by deployment config

## Entrypoints

Local execution continues to use:

```bash
node main.js --profile danfoss --email
```

The container entrypoint is:

```bash
node runtime/cloud-run-job.js
```

That wrapper:

- disables production `.env` loading with `B2B_LOAD_DOTENV=0`
- syncs the current GitHub-managed report baseline before execution
- delegates to the unchanged batch pipeline in `main.js`
- pushes updated artifacts back to GitHub after the run

Cloud Run executions still pass explicit CLI args:

```bash
gcloud run jobs execute b2b-lead-agent \
  --region "$REGION" \
  --wait \
  --args="--profile,danfoss,--email"
```

## Local vs Production Env Strategy

- Local development can continue using the repository `.env` file.
- Managed environments should inject env vars and Secret Manager bindings instead of relying on `.env`.
- The container should set `B2B_LOAD_DOTENV=0`.

## Required Runtime Configuration

Secret-backed env vars:

- `GEMINI_API_KEY`
- `GMAIL_USER`
- `GMAIL_PASS`
- `GMAIL_RECIPIENT`
- `GITHUB_TOKEN`

Non-secret env vars:

- `NODE_ENV=production`
- `B2B_LOAD_DOTENV=0`
- `GITHUB_REPO`
- `GITHUB_BRANCH` optional, defaults to `master`

## Recommended Job Shape

Use one Cloud Run Job with one task and explicit CLI args per execution.

```bash
gcloud run jobs create b2b-lead-agent \
  --image "$IMAGE_URL" \
  --region "$REGION" \
  --max-retries 0 \
  --tasks 1 \
  --parallelism 1 \
  --task-timeout 1800s \
  --set-env-vars NODE_ENV=production,B2B_LOAD_DOTENV=0,GITHUB_REPO=dooosp/b2b-lead-agent \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,GMAIL_USER=GMAIL_USER:latest,GMAIL_PASS=GMAIL_PASS:latest,GMAIL_RECIPIENT=GMAIL_RECIPIENT:latest,GITHUB_TOKEN=GITHUB_TOKEN:latest
```

## Scheduler Model

Prefer Cloud Scheduler calling the Cloud Run Jobs `:run` API directly with OAuth service account auth.

Example request body:

```json
{
  "overrides": {
    "containerOverrides": [
      {
        "args": ["--profile", "danfoss", "--email"],
        "env": [
          { "name": "B2B_LOAD_DOTENV", "value": "0" }
        ]
      }
    ]
  }
}
```

## GitHub Fallback

`.github/workflows/generate-report.yml` remains the default path.

- Default: run the batch inside GitHub Actions and commit artifacts
- Opt-in: if `BATCH_RUNTIME_TARGET=cloud-run-job`, execute the Cloud Run Job instead

## Rollback

Rollback is config-only:

- unset `BATCH_RUNTIME_TARGET` or set it back to `github-actions`
- keep using the existing GitHub Actions path
- local CLI stays unchanged
