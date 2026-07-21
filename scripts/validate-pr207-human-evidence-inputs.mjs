#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  EXPECTED_PR207_HEAD,
  INPUT_PATHS,
  PR207_RIGHTS_RETENTION_POLICY_EXPECTATION,
  Pr207HumanEvidenceValidationError,
  listPr207NormalizedInputPaths,
  readSafeIgnoredJsonInput,
  validatePr207HumanEvidenceInputs,
} from './lib/pr207-human-evidence-validator.mjs';
import { writeJsonArtifactInsideWorktree } from './lib/safe-local-artifact-writer.mjs';

function fail(code) {
  throw new Pr207HumanEvidenceValidationError(code);
}

function gitValue(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    fail('PR207_GIT_STATE_UNAVAILABLE');
  }
}

function fetchCanonicalRightsRetentionPolicyComment() {
  let raw;
  try {
    raw = execFileSync(
      'gh',
      [
        'api',
        `repos/dooosp/b2b-lead-agent/issues/comments/${PR207_RIGHTS_RETENTION_POLICY_EXPECTATION.commentId}`,
      ],
      {
        encoding: 'utf8',
        maxBuffer: 256 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
  } catch {
    fail('RIGHTS_POLICY_COMMENT_FETCH_FAILED');
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail('RIGHTS_POLICY_COMMENT_RESPONSE_INVALID');
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      'pr207-root': { type: 'string' },
      'as-of': { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
  });
  if (!values['pr207-root']) fail('PR207_ROOT_REQUIRED');

  const controlRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const pr207Root = path.resolve(values['pr207-root']);
  const asOf = values['as-of'] ?? new Date().toISOString();
  const gitTopLevel = path.resolve(gitValue(pr207Root, ['rev-parse', '--show-toplevel']));
  if (gitTopLevel !== pr207Root) fail('PR207_ROOT_MUST_BE_EXACT_WORKTREE_ROOT');
  const head = gitValue(pr207Root, ['rev-parse', 'HEAD']);
  if (head !== EXPECTED_PR207_HEAD) fail('PR207_HEAD_DRIFT');
  if (pr207Root === controlRoot) fail('PR207_ROOT_MUST_NOT_BE_CONTROL_WORKTREE');

  const intakeManifest = await readSafeIgnoredJsonInput({
    pr207Root,
    relativePath: INPUT_PATHS.intakeManifest,
  });
  const normalizedInputPaths = listPr207NormalizedInputPaths(intakeManifest);
  const [
    documentDecisions,
    fidelityDecisions,
    candidateDecisions,
    normalizedDocuments,
    rightsRetentionPolicyComment,
  ] =
    await Promise.all([
      readSafeIgnoredJsonInput({
        pr207Root,
        relativePath: INPUT_PATHS.documentDecisions,
      }),
      readSafeIgnoredJsonInput({
        pr207Root,
        relativePath: INPUT_PATHS.fidelityDecisions,
      }),
      readSafeIgnoredJsonInput({
        pr207Root,
        relativePath: INPUT_PATHS.candidateDecisions,
      }),
      Promise.all(normalizedInputPaths.map(async (relativePath) => ({
        relativePath,
        input: await readSafeIgnoredJsonInput({ pr207Root, relativePath }),
      }))),
      Promise.resolve().then(fetchCanonicalRightsRetentionPolicyComment),
    ]);

  const report = validatePr207HumanEvidenceInputs({
    intakeManifest,
    normalizedDocuments,
    documentDecisions,
    fidelityDecisions,
    candidateDecisions,
    rightsRetentionPolicyComment,
    asOf,
  });
  if (values.output) {
    await writeJsonArtifactInsideWorktree({
      worktreeRoot: controlRoot,
      outputPath: path.resolve(controlRoot, values.output),
      value: report,
    });
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  const code = error instanceof Pr207HumanEvidenceValidationError
    ? error.code
    : 'UNEXPECTED_VALIDATION_FAILURE';
  process.stderr.write(`PR207 human evidence input validation failed: ${code}\n`);
  process.exitCode = 1;
});
