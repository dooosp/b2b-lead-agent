import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const workflowPath = path.resolve(__dirname, '../../.github/workflows/generate-report.yml');
const ciWorkflowPath = path.resolve(__dirname, '../../.github/workflows/ci.yml');
const currentSecurityAuditWorkflowPath = path.resolve(
  __dirname,
  '../../.github/workflows/security-audit-current.yml',
);
const validateNamingWorkflowPath = path.resolve(__dirname, '../../.github/workflows/validate-naming.yml');

test('generate-report workflow keeps requestId callback contract fields', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const jobEnv = workflow.slice(
    workflow.indexOf('jobs:'),
    workflow.indexOf('steps:'),
  );
  const runningCallback = workflow.slice(
    workflow.indexOf('name: Mark run running'),
    workflow.indexOf('name: Generate and locally commit publication'),
  );
  const completionCallback = workflow.slice(
    workflow.indexOf('name: Mark run completion'),
  );

  assert.match(workflow, /run-name:\s+Generate report/i);
  assert.match(workflow, /REQUEST_ID:\s+\$\{\{\s*github\.event\.client_payload\.requestId/i);
  assert.doesNotMatch(jobEnv, /STATUS_EVENT_URL|CALLBACK_TOKEN/);
  for (const callbackStep of [runningCallback, completionCallback]) {
    assert.match(callbackStep, /STATUS_EVENT_URL:\s+\$\{\{\s*github\.event\.client_payload\.statusEventUrl/i);
    assert.match(callbackStep, /CALLBACK_TOKEN:\s+\$\{\{\s*github\.event\.client_payload\.callbackToken/i);
  }
  assert.match(workflow, /"state":"running"/);
  assert.match(workflow, /"state":"\$JOB_STATE"/);
  assert.match(workflow, /X-Job-Callback-Token: \$CALLBACK_TOKEN/);
  assert.match(workflow, /Idempotency-Key: gh-\$\{REQUEST_ID\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}-running/);
  assert.match(workflow, /Idempotency-Key: gh-\$\{REQUEST_ID\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}-terminal/);
});

test('generate-report serializes publication and notifies only after verified remote push', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const generationIndex = workflow.indexOf('name: Generate and locally commit publication');
  const resultIndex = workflow.indexOf('name: Validate typed pipeline result');
  const publicationIndex = workflow.indexOf('name: Commit, push, and verify remote publication');
  const recoveryIndex = workflow.indexOf('name: Recover verified publication state after publisher interruption');
  const notificationIndex = workflow.indexOf('name: Notify only after verified remote publication');
  const persistenceIndex = workflow.indexOf('name: Persist typed pipeline result');
  const callbackIndex = workflow.indexOf('name: Mark run completion');

  assert.match(workflow, /concurrency:\s+group:\s+lead-report-publication\s+queue:\s+max/);
  assert.match(workflow, /uses:\s+actions\/checkout@v5\s+with:\s+ref:\s+master\s+fetch-depth:\s+0/);
  assert.match(workflow, /name:\s+Install dependencies\s+run:\s+npm ci/);
  assert.ok(generationIndex > 0);
  assert.ok(generationIndex < resultIndex);
  assert.ok(resultIndex < publicationIndex);
  assert.ok(publicationIndex < recoveryIndex);
  assert.ok(recoveryIndex < notificationIndex);
  assert.ok(publicationIndex < notificationIndex);
  assert.ok(notificationIndex < persistenceIndex);
  assert.ok(persistenceIndex < callbackIndex);

  const generationStep = workflow.slice(generationIndex, resultIndex);
  const publicationStep = workflow.slice(publicationIndex, recoveryIndex);
  const recoveryStep = workflow.slice(recoveryIndex, notificationIndex);
  const notificationStep = workflow.slice(notificationIndex, workflow.indexOf('name: Record final typed pipeline result'));
  assert.match(generationStep, /--notification-requested/);
  assert.match(generationStep, /--run-id "github-\$\{\{ github\.run_id \}\}"/);
  assert.match(generationStep, /--result-file \/tmp\/lead-pipeline-result\.json/);
  assert.doesNotMatch(generationStep, /GMAIL|--email/);
  assert.doesNotMatch(generationStep, /STATUS_EVENT_URL|CALLBACK_TOKEN/);
  assert.match(publicationStep, /scripts\/publish-lead-pipeline\.mjs/);
  assert.match(publicationStep, /continue-on-error:\s+true/);
  assert.doesNotMatch(publicationStep, /lead-report-\*|git add|git push/);
  assert.doesNotMatch(publicationStep, /STATUS_EVENT_URL|CALLBACK_TOKEN/);
  assert.match(recoveryStep, /if:\s+\$\{\{ always\(\) \}\}/);
  assert.match(recoveryStep, /--recover-only/);
  assert.doesNotMatch(recoveryStep, /GMAIL|secrets\./);
  assert.doesNotMatch(recoveryStep, /STATUS_EVENT_URL|CALLBACK_TOKEN/);
  assert.match(notificationStep, /scripts\/notify-lead-publication\.mjs/);
  assert.match(notificationStep, /if:\s+\$\{\{ always\(\) \}\}/);
  assert.match(notificationStep, /GMAIL_USER/);
  assert.match(notificationStep, /GMAIL_PASS/);
  assert.match(notificationStep, /GMAIL_RECIPIENT/);
  assert.doesNotMatch(notificationStep, /STATUS_EVENT_URL|CALLBACK_TOKEN/);
  assert.match(workflow, /uses:\s+actions\/upload-artifact@v4/);
  assert.match(workflow, /path:\s+\/tmp\/lead-pipeline-result\.json/);
  assert.match(workflow, /RESULT_SHA=.*lead-pipeline-result\.json/);
  assert.match(workflow, /publication\.remotePublished/);
  assert.match(workflow, /"githubSha":"\$RESULT_SHA"/);
});

test('workflows use Node 24 compatible GitHub Actions runtime versions', async () => {
  const [generateWorkflow, ciWorkflow, validateNamingWorkflow] = await Promise.all([
    readFile(workflowPath, 'utf8'),
    readFile(ciWorkflowPath, 'utf8'),
    readFile(validateNamingWorkflowPath, 'utf8')
  ]);

  for (const workflow of [generateWorkflow, ciWorkflow, validateNamingWorkflow]) {
    assert.doesNotMatch(workflow, /actions\/checkout@v4/);
    assert.doesNotMatch(workflow, /actions\/setup-node@v4/);
    assert.match(workflow, /actions\/checkout@v5/);
    assert.match(workflow, /actions\/setup-node@v5/);
  }
});

test('non-production check workflows use lockfile-backed npm ci installs', async () => {
  const [ciWorkflow, validateNamingWorkflow] = await Promise.all([
    readFile(ciWorkflowPath, 'utf8'),
    readFile(validateNamingWorkflowPath, 'utf8')
  ]);

  for (const workflow of [ciWorkflow, validateNamingWorkflow]) {
    assert.match(workflow, /run:\s+npm ci/);
    assert.doesNotMatch(workflow, /run:\s+npm install/);
  }
});

test('CI workflow runs the synthetic lead-quality evaluator before full tests', async () => {
  const workflow = await readFile(ciWorkflowPath, 'utf8');

  assert.match(workflow, /name:\s+Run synthetic lead-quality evaluation\s+run:\s+npm run eval:lead-quality/);
  assert.match(workflow, /run:\s+npm run check:schema[\s\S]*run:\s+npm run eval:lead-quality[\s\S]*run:\s+npm test/);
});

test('CI workflow runs the scoped security dependency audit triage after npm ci', async () => {
  const [workflow, currentAuditWorkflow, packageJsonRaw] = await Promise.all([
    readFile(ciWorkflowPath, 'utf8'),
    readFile(currentSecurityAuditWorkflowPath, 'utf8'),
    readFile(packageJsonPath, 'utf8'),
  ]);
  const packageJson = JSON.parse(packageJsonRaw);
  const currentAuditScript = packageJson.scripts['security:audit-current'] || '';
  const script = packageJson.scripts['security:audit-triage'] || '';

  assert.equal(currentAuditScript, 'npm audit --omit=dev --audit-level=moderate');
  assert.match(script, /node scripts\/security-dependency-audit-triage\.mjs --json --output tmp\/codex\/security-dependency-audit-triage-non-production\.json/);
  assert.doesNotMatch(script, /npm audit|wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.doesNotMatch(workflow, /npm run security:audit-current/);
  assert.match(workflow, /name:\s+Run security dependency audit triage\s+run:\s+npm run security:audit-triage/);
  assert.match(workflow, /run:\s+npm ci[\s\S]*run:\s+npm run security:audit-triage[\s\S]*run:\s+npm run check:schema/);
  assert.match(currentAuditWorkflow, /schedule:\s+- cron:\s+'17 3 \* \* \*'/);
  assert.match(currentAuditWorkflow, /workflow_dispatch:/);
  assert.match(currentAuditWorkflow, /permissions:\s+contents:\s+read/);
  assert.match(currentAuditWorkflow, /run:\s+npm ci[\s\S]*run:\s+npm run security:audit-current/);
});

test('CI workflow runs the local-only outbound HTTP enrichment boundary guard after security triage', async () => {
  const [workflow, packageJsonRaw] = await Promise.all([
    readFile(ciWorkflowPath, 'utf8'),
    readFile(packageJsonPath, 'utf8'),
  ]);
  const packageJson = JSON.parse(packageJsonRaw);
  const script = packageJson.scripts['check:enrichment-boundary'] || '';

  assert.match(script, /node --test tests\/enrichment-outbound-http-boundary\.test\.js/);
  assert.match(script, /node scripts\/outbound-http-enrichment-boundary-audit\.mjs --json --output tmp\/codex\/outbound-http-enrichment-boundary-guards-non-production\.json/);
  assert.doesNotMatch(script, /npm audit|wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(workflow, /name:\s+Run outbound HTTP enrichment boundary guard\s+run:\s+npm run check:enrichment-boundary/);
  assert.match(workflow, /run:\s+npm run security:audit-triage[\s\S]*run:\s+npm run check:enrichment-boundary[\s\S]*run:\s+npm run check:schema/);
});

test('CI workflow runs the local-only enrichment fixture replay output contract after boundary guard', async () => {
  const [workflow, packageJsonRaw] = await Promise.all([
    readFile(ciWorkflowPath, 'utf8'),
    readFile(packageJsonPath, 'utf8'),
  ]);
  const packageJson = JSON.parse(packageJsonRaw);
  const script = packageJson.scripts['check:enrichment-replay'] || '';

  assert.match(script, /node --test tests\/enrichment-fixture-replay\.test\.js/);
  assert.match(script, /node scripts\/enrichment-fixture-replay\.mjs --json --output tmp\/codex\/enrichment-fixture-replay-output-contract-non-production\.json/);
  assert.doesNotMatch(script, /npm audit|wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(workflow, /name:\s+Run enrichment fixture replay output contract\s+run:\s+npm run check:enrichment-replay/);
  assert.match(workflow, /run:\s+npm run check:enrichment-boundary[\s\S]*run:\s+npm run check:enrichment-replay[\s\S]*run:\s+npm run check:schema/);
});

test('CI workflow runs the local-only lead pipeline replay artifact contract after enrichment replay', async () => {
  const [workflow, packageJsonRaw] = await Promise.all([
    readFile(ciWorkflowPath, 'utf8'),
    readFile(packageJsonPath, 'utf8'),
  ]);
  const packageJson = JSON.parse(packageJsonRaw);
  const script = packageJson.scripts['check:lead-pipeline-replay'] || '';

  assert.match(script, /node --test tests\/lead-pipeline-fixture-replay-artifact-contract\.test\.js/);
  assert.match(script, /node scripts\/lead-pipeline-fixture-replay\.mjs --json --output tmp\/codex\/lead-pipeline-fixture-replay-artifact-contract-non-production\.json/);
  assert.doesNotMatch(script, /npm audit|wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(workflow, /name:\s+Run lead pipeline fixture replay artifact contract\s+run:\s+npm run check:lead-pipeline-replay/);
  assert.match(workflow, /run:\s+npm run check:enrichment-replay[\s\S]*run:\s+npm run check:lead-pipeline-replay[\s\S]*run:\s+npm run check:schema/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /wrangler|curl|deploy|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL/i);
});

test('CI runs claim audit, Golden Dataset boundary audit, spec-fit evaluation, and focused tests before lead replay', async () => {
  const [workflow, packageJsonRaw] = await Promise.all([
    readFile(ciWorkflowPath, 'utf8'),
    readFile(packageJsonPath, 'utf8'),
  ]);
  const scripts = JSON.parse(packageJsonRaw).scripts;
  assert.equal(scripts['audit:claims'], 'node scripts/audit-evidence-claims.mjs --json --fail-on-violations');
  assert.equal(
    scripts['check:golden-dataset'],
    'node --test tests/golden-dataset.test.js tests/golden-dataset-lineage-v1.test.js tests/golden-dataset-cli.test.js tests/golden-generated-artifacts.test.js tests/golden-human-review-batch.test.js tests/golden-human-review-proposal.test.js tests/golden-human-review-approval.test.js tests/golden-human-review-batch-02.test.js tests/golden-human-review-proposal-02.test.js tests/golden-human-review-approval-02.test.js && npm run check:golden-artifacts',
  );
  assert.equal(
    scripts['check:golden-artifacts'],
    'node scripts/check-pursuit-golden-generated-artifacts.mjs',
  );
  assert.equal(
    scripts['prepare:golden-review-batch'],
    'node scripts/prepare-pursuit-golden-human-review.mjs --json --quiet --output tmp/codex/pursuit-golden-human-review-batch-01.json',
  );
  assert.equal(
    scripts['prepare:golden-review-proposal'],
    'node scripts/prepare-pursuit-golden-human-review-proposal.mjs --quiet --output tmp/codex/pursuit-golden-human-review-batch-01-proposal.json --markdown-output docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md',
  );
  assert.equal(
    scripts['prepare:golden-review-batch-02'],
    'node scripts/prepare-pursuit-golden-human-review-batch-02.mjs --quiet --output tmp/codex/pursuit-golden-human-review-batch-02.json',
  );
  assert.equal(
    scripts['prepare:golden-review-proposal-02'],
    'node scripts/prepare-pursuit-golden-human-review-proposal-02.mjs --quiet --output tmp/codex/pursuit-golden-human-review-batch-02-proposal.json --markdown-output docs/roadmap/pursuit-golden-human-review-batch-02-proposal.md',
  );
  assert.equal(scripts['eval:spec-fit'], 'node scripts/evaluate-spec-fit.mjs --fixtures --json --repeat 2');
  assert.equal(scripts['eval:pursuit-twin'], 'node scripts/evaluate-pursuit-twin-v0.mjs --json --repeat 2');
  assert.match(scripts['test:claim-spec-fit'], /tests\/evidence-claim-registry\.test\.js/);
  assert.match(scripts['test:claim-spec-fit'], /tests\/specification-fit-engine\.test\.js/);
  assert.match(scripts['test:claim-spec-fit'], /tests\/pursuit-dossier\.test\.js/);
  assert.match(scripts['test:claim-spec-fit'], /tests\/pursuit-twin-v0\.test\.js/);
  assert.match(scripts['test:claim-spec-fit'], /tests\/pursuit-twin-v0-cli\.test\.js/);
  assert.match(workflow, /run:\s+npm run check:enrichment-replay[\s\S]*run:\s+npm run audit:claims[\s\S]*run:\s+npm run check:golden-dataset[\s\S]*run:\s+npm run eval:spec-fit[\s\S]*run:\s+npm run eval:pursuit-twin[\s\S]*run:\s+npm run test:claim-spec-fit[\s\S]*run:\s+npm run check:lead-pipeline-replay/);
  for (const scriptName of ['audit:claims', 'check:golden-dataset', 'eval:spec-fit', 'eval:pursuit-twin', 'test:claim-spec-fit']) {
    assert.doesNotMatch(scripts[scriptName], /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  }
  assert.doesNotMatch(workflow, /secrets\./);
});

test('CI runs the local-only Pursuit Value Pilot contract without human or production execution', async () => {
  const [workflow, packageJsonRaw] = await Promise.all([
    readFile(ciWorkflowPath, 'utf8'),
    readFile(packageJsonPath, 'utf8'),
  ]);
  const scripts = JSON.parse(packageJsonRaw).scripts;

  assert.equal(
    scripts['eval:pursuit-value-pilot'],
    'node scripts/evaluate-pursuit-value-pilot-v0.mjs',
  );
  assert.equal(
    scripts['prepare:pursuit-value-pilot'],
    'node scripts/prepare-pursuit-value-pilot-v0.mjs',
  );
  assert.equal(
    scripts['validate:pursuit-value-pilot'],
    'node scripts/validate-pursuit-value-pilot-v0.mjs',
  );
  assert.equal(
    scripts['check:pursuit-value-pilot'],
    'node --test tests/pursuit-value-pilot-v0.test.js tests/pursuit-value-pilot-offline-html.test.js tests/pursuit-value-pilot-v0-files.test.js tests/pursuit-value-pilot-v0-cli.test.js && npm run eval:pursuit-value-pilot',
  );
  assert.match(
    workflow,
    /run:\s+npm run eval:pursuit-twin[\s\S]*run:\s+npm run check:pursuit-value-pilot[\s\S]*run:\s+npm run test:claim-spec-fit/,
  );
  assert.doesNotMatch(workflow, /npm run prepare:pursuit-value-pilot|npm run validate:pursuit-value-pilot/);
  for (const scriptName of [
    'eval:pursuit-value-pilot',
    'prepare:pursuit-value-pilot',
    'validate:pursuit-value-pilot',
    'check:pursuit-value-pilot',
  ]) {
    assert.doesNotMatch(
      scripts[scriptName],
      /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i,
    );
  }
});

test('CI workflow runs the local-only Worker E2E smoke after full tests', async () => {
  const workflow = await readFile(ciWorkflowPath, 'utf8');

  assert.match(workflow, /name:\s+Run local-only Worker E2E smoke\s+run:\s+npm run test:e2e:local/);
  assert.match(workflow, /name:\s+Install Playwright Chromium\s+run:\s+npx playwright install --with-deps chromium/);
  assert.match(workflow, /run:\s+npm test[\s\S]*run:\s+npm run test:e2e:local/);
  assert.match(workflow, /run:\s+npx playwright install --with-deps chromium[\s\S]*run:\s+npm run test:e2e:local/);
});

test('package exposes a local-only Level 1 regression gate', async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const script = packageJson.scripts['check:level1'] || '';
  const manifestScript = packageJson.scripts['proof:level1:change-control-manifest'] || '';
  const rehearsalScript = packageJson.scripts['proof:level1:operator-rehearsal'] || '';
  const closureDashboardScript = packageJson.scripts['proof:level1:closure-dashboard'] || '';
  const approvalIntakeScript = packageJson.scripts['proof:level1:approval-intake'] || '';
  const postApprovalSimulatorScript = packageJson.scripts['proof:level1:post-approval-simulator'] || '';
  const reviewerWorkflowBoundaryScript = packageJson.scripts['check:reviewer-workflow-boundary'] || '';

  assert.match(script, /node --test/);
  assert.match(script, /worker\/tests\/local-test-auth-adapter\.test\.mjs/);
  assert.match(script, /worker\/tests\/auth-provider-session-scaffold\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-readiness-guards\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-local-proof-simulation\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-auth-route-audit\.test\.mjs/);
  assert.match(script, /worker\/tests\/manual-review-notes\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-proof-preflight\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-production-proof-approval\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-production-proof-change-control-manifest\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-operator-rehearsal\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-readiness-closure-dashboard\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-production-proof-approval-intake-gate\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-post-approval-decision-simulator\.test\.mjs/);
  assert.match(script, /npm run test:evidence/);
  assert.match(script, /npm run check:reviewer-workflow-boundary/);
  assert.match(script, /npm run proof:level1:preflight/);
  assert.match(script, /npm run proof:level1:approval-dry-run/);
  assert.match(script, /npm run proof:level1:change-control-manifest/);
  assert.match(script, /npm run proof:level1:operator-rehearsal/);
  assert.match(script, /npm run proof:level1:approval-intake/);
  assert.match(script, /npm run proof:level1:post-approval-simulator/);
  assert.match(script, /npm run proof:level1:closure-dashboard/);
  assert.doesNotMatch(script, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(manifestScript, /node scripts\/level1-production-proof-change-control-manifest\.mjs --json --output tmp\/codex\/level1-production-proof-change-control-manifest-non-production-plan\.json/);
  assert.doesNotMatch(manifestScript, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(rehearsalScript, /node scripts\/level1-operator-rehearsal\.mjs --json --output tmp\/codex\/level1-operator-rehearsal-non-production-runbook\.json/);
  assert.doesNotMatch(rehearsalScript, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(closureDashboardScript, /node scripts\/level1-readiness-closure-dashboard\.mjs --json --output tmp\/codex\/level1-readiness-closure-dashboard-non-production\.json --markdown --markdown-output docs\/roadmap\/b2b-lead-agent-level-1-readiness-closure-dashboard-non-production\.md/);
  assert.doesNotMatch(closureDashboardScript, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(approvalIntakeScript, /node scripts\/level1-production-proof-approval-intake-gate\.mjs --json --output tmp\/codex\/level1-production-proof-approval-intake-gate-non-production\.json --template-output docs\/roadmap\/b2b-lead-agent-level-1-production-proof-approval-intake-template-non-production\.json --markdown-output docs\/roadmap\/b2b-lead-agent-level-1-production-proof-approval-intake-gate-non-production\.md/);
  assert.doesNotMatch(approvalIntakeScript, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(postApprovalSimulatorScript, /node scripts\/level1-post-approval-decision-simulator\.mjs --json --output tmp\/codex\/level1-post-approval-decision-simulator-non-production\.json --markdown --markdown-output docs\/roadmap\/b2b-lead-agent-level-1-post-approval-decision-simulator-non-production\.md/);
  assert.doesNotMatch(postApprovalSimulatorScript, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(reviewerWorkflowBoundaryScript, /node --test worker\/tests\/reviewer-workflow-boundary-audit\.test\.mjs tests\/release-evidence-redaction\.test\.js/);
  assert.match(reviewerWorkflowBoundaryScript, /node scripts\/reviewer-workflow-boundary-audit\.mjs --json --output tmp\/codex\/reviewer-workflow-boundary-audit-non-production\.json/);
  assert.doesNotMatch(reviewerWorkflowBoundaryScript, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
});

test('CI workflow runs the safe Level 1 regression gate before full tests', async () => {
  const workflow = await readFile(ciWorkflowPath, 'utf8');

  assert.match(workflow, /name:\s+Run Level 1 non-production regression gate\s+run:\s+npm run check:level1/);
  assert.match(workflow, /run:\s+npm run eval:lead-quality[\s\S]*run:\s+npm run check:level1[\s\S]*run:\s+npm test/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /wrangler|curl|deploy|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL/i);
});
