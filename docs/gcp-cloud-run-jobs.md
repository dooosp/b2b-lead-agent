# GCP Cloud Run Job Runtime

This repository now supports an incremental runtime seam for Cloud Run Jobs without changing the local batch CLI contract.

## What stays the same

- Local execution remains `node main.js --profile <id> [--email]`.
- The existing GitHub Actions path remains the default remote trigger path.
- Report generation still starts from `main.js`.
- The managed artifact contract stays `reports/<profile>/latest_leads.json` and `lead_history.json` in GitHub.

## Runtime contract

### Local CLI

```bash
node main.js --profile danfoss
node main.js --profile danfoss --email
```

`main.js` still loads `.env` by default for local development. In container or managed environments, set `B2B_LOAD_DOTENV=0` so production secrets come from the platform instead of a local file.

### Container image

The Cloud Run image entrypoint is:

```bash
node runtime/cloud-run-job.js
```

That wrapper:

- syncs the current `reports/<profile>` baseline from GitHub before the run
- delegates to the unchanged `main.js` pipeline
- pushes updated artifacts back to GitHub after the run

Cloud Run Job executions still use the same arguments:

```text
--profile <id> [--email]
```

So the execution seam stays aligned with the current CLI while keeping the existing GitHub artifact reader path working.

## Cloud Run Job shape

Recommended baseline:

- One Cloud Run Job for this batch runner
- One task per execution
- Execution args overridden per run for `--profile <id> [--email]`
- Secret Manager mounted as environment-variable secrets, not a checked-in `.env`
- GitHub artifact sync preserved so the worker keeps reading the same managed JSON files

Example execution override body:

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

## Required runtime env vars

Non-secret env vars for the batch container:

- `B2B_LOAD_DOTENV=0`
- `NODE_ENV=production`

Secret-backed env vars for the batch container:

- `GEMINI_API_KEY`
- `GMAIL_USER`
- `GMAIL_PASS`
- `GMAIL_RECIPIENT`
- `GITHUB_TOKEN`

Optional debug env vars can stay as plain env vars if needed:

- `ARTICLE_COLLECTOR_DEBUG`
- `LEAD_QUALIFIER_DEBUG`
- `QUALIFIER_DEBUG`
- `LEAD_REPORT_PUBLISHER_DEBUG`

## Secret Manager mapping

Use Cloud Run Job secret references so the process still receives the same environment variable names it expects today:

- Secret `gemini-api-key` -> env `GEMINI_API_KEY`
- Secret `gmail-user` -> env `GMAIL_USER`
- Secret `gmail-pass` -> env `GMAIL_PASS`
- Secret `gmail-recipient` -> env `GMAIL_RECIPIENT`
- Secret `github-token` -> env `GITHUB_TOKEN`

Pin production jobs to explicit secret versions for env-var injection. That makes rotations deliberate and rollback-friendly.

## Worker trigger seam

The worker trigger now supports two targets:

- `REPORT_TRIGGER_TARGET=github-actions` (default)
- `REPORT_TRIGGER_TARGET=cloud-run-job`

When `REPORT_TRIGGER_TARGET=cloud-run-job`, the worker expects:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `CLOUD_RUN_JOB_NAME`
- `CLOUD_RUN_JOB_SEND_EMAIL` optional, defaults to `true`
- One of:
  - `GCP_SERVICE_ACCOUNT_JSON`
  - `GCP_CLIENT_EMAIL` and `GCP_PRIVATE_KEY`

The worker exchanges the service account for an OAuth access token and calls the Cloud Run Jobs `jobs.run` API with argument overrides.

The Cloud Run Job itself also expects:

- `GITHUB_REPO`
- `GITHUB_BRANCH` optional, defaults to `master`
- `GITHUB_TOKEN`

## Scheduler model

Recommended scheduled path inside GCP:

- Cloud Scheduler HTTP job
- Target: `https://run.googleapis.com/v2/projects/PROJECT_ID/locations/REGION/jobs/JOB_NAME:run`
- Auth: OAuth service account, because `*.googleapis.com` expects OAuth tokens
- Body: the execution override JSON with `["--profile", "<id>", "--email"]`

Use one Scheduler job per profile so schedule ownership stays simple and explicit.

Keep the worker `/trigger` endpoint for interactive/manual triggering and gradual cutover. That path can stay on GitHub Actions until `REPORT_TRIGGER_TARGET=cloud-run-job` is deliberately enabled.

## IAM notes

- A principal that only executes a job can use `roles/run.invoker`.
- A principal that executes with overrides needs permissions equivalent to `roles/run.developer`.
- The Cloud Run Job runtime service account also needs Secret Manager access to the secrets it consumes.
- The GitHub token used by the job needs permission to update `reports/<profile>/latest_leads.json` and `reports/<profile>/lead_history.json` on the target branch.

## Suggested cutover order

1. Build and deploy the container image.
2. Create the Cloud Run Job with the existing env var names mapped from Secret Manager, including GitHub artifact-sync credentials.
3. Manually execute the job with one profile and verify both the run output and the GitHub artifact updates.
4. Switch manual/API trigger traffic by setting `REPORT_TRIGGER_TARGET=cloud-run-job`.
5. Add Cloud Scheduler jobs per profile after the manual path is stable.
6. Leave the GitHub Actions workflow available as rollback/fallback until the GCP path proves stable.
