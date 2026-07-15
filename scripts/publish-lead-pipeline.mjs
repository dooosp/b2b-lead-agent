import gitPublication from '../git-publication.js';

function valueAfter(args, flag, fallback = null) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

const args = process.argv.slice(2);
const resultFile = valueAfter(args, '--result-file');
const remote = valueAfter(args, '--remote', 'origin');
const branch = valueAfter(args, '--branch', 'master');
const recoverOnly = args.includes('--recover-only');

if (!resultFile) {
  console.error('ERR_REMOTE_PUBLICATION_RESULT_FILE_REQUIRED');
  process.exitCode = 2;
} else {
  try {
    const published = await (recoverOnly
      ? gitPublication.recoverVerifiedRemotePublication
      : gitPublication.publishPipelineRunToGit)({
      resultFile,
      cwd: process.cwd(),
      remote,
      branch,
    });
    console.log(`REMOTE_PUBLICATION_RESULT=${published.result.outcome}`);
  } catch (error) {
    console.error(error && error.code || 'ERR_REMOTE_PUBLICATION_FAILED');
    process.exitCode = 1;
  }
}
